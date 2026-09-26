/**
 * Canonical body serialization for the Server Attestation Document.
 *
 * SEP-2809 § Canonicalization and signature: "the deterministic JSON
 * serialization of every registered field except `signature`, with object keys
 * in sorted order, array members sorted, and an absent `signerKeyId`
 * serialized as `null`."
 *
 * Signer and verifier must produce exactly these bytes, so every rule here is
 * deliberate and none of it may depend on property insertion order.
 */

import { REGISTERED_FIELDS, type ServerAttestationDocument } from "./types";

/** Registered fields that are part of the signed body, in canonical order. */
const SIGNED_FIELDS = REGISTERED_FIELDS.filter((f) => f !== "signature");

/**
 * Deterministic JSON: object keys sorted, array members sorted by their own
 * canonical form, no insignificant whitespace.
 */
function canonicalValue(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (Array.isArray(value)) {
    // Array members are sorted, so membership rather than order is signed.
    const members = value.map(canonicalValue).sort();
    return `[${members.join(",")}]`;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, canonicalValue(v)] as const)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${v}`).join(",")}}`;
  }
  if (typeof value === "number" && !Number.isFinite(value)) {
    throw new TypeError("canonical body cannot contain a non-finite number");
  }
  return JSON.stringify(value);
}

/**
 * The exact bytes a signature is computed over.
 *
 * Unknown fields are excluded: a verifier "MUST ignore unknown fields and MUST
 * NOT include them in the canonical body until a future `v` registers them",
 * so an attacker cannot smuggle signed content through an unregistered key.
 */
export function canonicalBody(sad: ServerAttestationDocument): Buffer {
  const body: Record<string, unknown> = {};
  for (const field of SIGNED_FIELDS) {
    const value = sad[field];
    if (field === "signerKeyId") {
      // Absent signerKeyId is serialized as null rather than omitted.
      body[field] = value === undefined ? null : value;
      continue;
    }
    if (value !== undefined) body[field] = value;
  }
  return Buffer.from(canonicalValue(body), "utf8");
}
