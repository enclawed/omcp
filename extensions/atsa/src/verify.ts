/**
 * Host-side verification for Attested Tool-Server Admission.
 *
 * SEP-2809 § Host verification rules: a host "MUST evaluate the following in
 * order and MUST deny on the first failure". The order is load-bearing — it is
 * what makes a denial reason meaningful — so the rules are evaluated as written
 * and the first failure short-circuits.
 */

import { createPublicKey, verify as cryptoVerify } from "node:crypto";
import { canonicalBody } from "./canonicalize";
import {
  DENIAL_REASONS,
  MCP_SERVER_CAPABILITY,
  SAD_VERSION,
  type AdmissionContext,
  type AdmissionResult,
  type ClearanceScheme,
  type DenialReason,
  type ServerAttestationDocument,
  type TrustRoot,
} from "./types";

function deny(reason: DenialReason, detail: string): AdmissionResult {
  return { admitted: false, reason, code: DENIAL_REASONS[reason], detail };
}

/** Resolves a canonical name or alias to its rank in the scheme. */
export function rankOf(
  scheme: ClearanceScheme,
  nameOrAlias: string,
): number | undefined {
  const level = scheme.levels.find(
    (l) => l.name === nameOrAlias || (l.aliases ?? []).includes(nameOrAlias),
  );
  return level?.rank;
}

/** Compares origins by scheme, host, and port, ignoring path and case. */
function sameOrigin(a: string, b: string): boolean {
  try {
    const x = new URL(a);
    const y = new URL(b);
    return (
      x.protocol === y.protocol &&
      x.hostname.toLowerCase() === y.hostname.toLowerCase() &&
      x.port === y.port
    );
  } catch {
    return false;
  }
}

/** SPKI header for a raw Ed25519 public key. */
const SPKI_ED25519_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

/**
 * Checks the detached signature over the canonical body. A malformed key or
 * signature is a failed verification, not an exception.
 */
function signatureVerifies(
  sad: ServerAttestationDocument,
  publicKeyBase64: string,
): boolean {
  try {
    const publicKey = createPublicKey({
      key: Buffer.concat([
        SPKI_ED25519_PREFIX,
        Buffer.from(publicKeyBase64, "base64"),
      ]),
      format: "der",
      type: "spki",
    });
    return cryptoVerify(
      null,
      canonicalBody(sad),
      publicKey,
      Buffer.from(String(sad.signature), "base64"),
    );
  } catch {
    return false;
  }
}

/**
 * Evaluates a Server Attestation Document against a trust root.
 *
 * Returns the admission decision; it never throws on malformed input, because
 * a malformed document is a denial rather than an error.
 */
export function verifyAttestation(
  sad: ServerAttestationDocument | null | undefined,
  trustRoot: TrustRoot,
  context: AdmissionContext,
): AdmissionResult {
  // An absent document is "unattested": the host applies its posture.
  if (!sad || typeof sad !== "object") {
    return deny("not_mcp_server", "no attestation document");
  }

  // "a verifier MUST reject versions it does not understand"
  if (sad.v !== SAD_VERSION) {
    return deny(
      "unsupported_version",
      `unsupported document version: ${String(sad.v)}`,
    );
  }

  // Rule 1: parses, and capabilities contain "mcp-server".
  if (
    !Array.isArray(sad.capabilities) ||
    !sad.capabilities.includes(MCP_SERVER_CAPABILITY)
  ) {
    return deny(
      "not_mcp_server",
      `capabilities must contain "${MCP_SERVER_CAPABILITY}"`,
    );
  }

  // Rule 2: signerKeyId and signature are present.
  if (
    typeof sad.signerKeyId !== "string" ||
    sad.signerKeyId === "" ||
    typeof sad.signature !== "string" ||
    sad.signature === ""
  ) {
    return deny("unsigned", "signerKeyId and signature are required");
  }

  // Rule 3: signerKeyId resolves to a key in the trust root.
  const key = trustRoot.keys.find((k) => k.id === sad.signerKeyId);
  if (!key) {
    return deny(
      "signer_not_trusted",
      `signer ${sad.signerKeyId} is not in the trust root`,
    );
  }

  // Rule 4: the key's validity window includes now.
  const now = context.now ?? new Date();
  if (key.notAfter !== undefined) {
    const notAfter = new Date(key.notAfter);
    if (Number.isNaN(notAfter.getTime())) {
      return deny(
        "signer_expired",
        `signer ${key.id} has an unparseable notAfter`,
      );
    }
    if (now.getTime() >= notAfter.getTime()) {
      return deny(
        "signer_expired",
        `signer ${key.id} expired at ${key.notAfter}`,
      );
    }
  }

  // Rule 5: the key is approved for the asserted clearance.
  // Checked against the canonical name so an alias cannot widen a key's scope.
  const assertedRank = rankOf(trustRoot.scheme, sad.clearance);
  if (assertedRank === undefined) {
    return deny(
      "signer_not_approved",
      `clearance "${sad.clearance}" is not a level in scheme "${trustRoot.scheme.name}"`,
    );
  }
  const assertedCanonical = trustRoot.scheme.levels.find(
    (l) => l.rank === assertedRank,
  )!.name;
  if (!key.approvedClearances.includes(assertedCanonical)) {
    return deny(
      "signer_not_approved",
      `signer ${key.id} may not sign for "${assertedCanonical}"`,
    );
  }

  // Rule 6: the signature verifies over the canonical body.
  if (!signatureVerifies(sad, key.publicKey)) {
    return deny(
      "bad_signature",
      "signature does not verify over the canonical body",
    );
  }

  // Rule 7: clearance dominates the host's required level.
  const requiredRank = rankOf(trustRoot.scheme, context.requiredClearance);
  if (requiredRank === undefined) {
    return deny(
      "below_required",
      `required clearance "${context.requiredClearance}" is not a level in scheme "${trustRoot.scheme.name}"`,
    );
  }
  if (assertedRank < requiredRank) {
    return deny(
      "below_required",
      `clearance "${assertedCanonical}" does not dominate "${context.requiredClearance}"`,
    );
  }

  // Rule 8: when netAllowedHosts is non-empty, the connected origin is a member.
  if (Array.isArray(sad.netAllowedHosts) && sad.netAllowedHosts.length > 0) {
    if (
      !sad.netAllowedHosts.some((origin) => sameOrigin(origin, context.origin))
    ) {
      return deny(
        "host_not_bound",
        `origin ${context.origin} is not bound by netAllowedHosts`,
      );
    }
  }

  return { admitted: true, clearance: assertedCanonical, rank: assertedRank };
}

/**
 * Tool authorization, kept deliberately separate from admission.
 *
 * "Admitting a server MUST NOT be read as authorizing all its tools." The host
 * denies before any network dispatch, whatever tools/list advertised.
 */
export function authorizeTool(
  toolName: string,
  allowList: readonly string[],
): AdmissionResult {
  if (!allowList.includes(toolName)) {
    return deny(
      "tool_not_admitted",
      `tool "${toolName}" is not in the server's allow-list`,
    );
  }
  return { admitted: true, clearance: "", rank: 0 };
}
