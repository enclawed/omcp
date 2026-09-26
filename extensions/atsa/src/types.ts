/**
 * Attested Tool-Server Admission (ATSA) — types.
 *
 * Implements SEP-2809. The document a server publishes is a Server Attestation
 * Document (SAD); the host verifies it against a locally pinned trust root
 * before admitting the server, and authorizes tools separately.
 */

/**
 * Fields registered in v1. Unknown fields are ignored and never signed.
 * `signature` is registered but excluded from the body it signs.
 */
export const REGISTERED_FIELDS = [
  "v",
  "id",
  "publisher",
  "version",
  "clearance",
  "capabilities",
  "signerKeyId",
  "signature",
  "netAllowedHosts",
  "verification",
] as const;

export const SAD_VERSION = 1;

/** The capability every attested MCP server must assert. */
export const MCP_SERVER_CAPABILITY = "mcp-server";

export interface ServerAttestationDocument {
  /** Document version. A verifier rejects versions it does not understand. */
  v: number;
  /** Stable server identity. */
  id: string;
  publisher: string;
  version: string;
  /** Canonical name or alias of a level in the host's classification scheme. */
  clearance: string;
  /** Must contain "mcp-server". */
  capabilities: string[];
  /** Identifies a key in the host trust root. */
  signerKeyId?: string;
  /** Detached base64 signature over the canonical body. */
  signature?: string;
  /** When non-empty, binds the document to these origins. */
  netAllowedHosts?: string[];
  verification?: string;
  [key: string]: unknown;
}

export interface TrustedKey {
  id: string;
  /** Raw Ed25519 public key, base64. */
  publicKey: string;
  /** ISO 8601. The key is unusable from this instant onward. */
  notAfter?: string;
  /** Canonical clearance names this key may sign for. */
  approvedClearances: string[];
}

/** A named, totally ordered classification scheme. */
export interface ClearanceScheme {
  name: string;
  levels: ClearanceLevel[];
}

export interface ClearanceLevel {
  /** Canonical name. */
  name: string;
  /** Higher dominates lower. */
  rank: number;
  aliases?: string[];
}

export interface TrustRoot {
  keys: TrustedKey[];
  scheme: ClearanceScheme;
}

export interface AdmissionContext {
  /** Origin the host actually connected to, e.g. "https://tools.example.com". */
  origin: string;
  /** Canonical name (or alias) of the level the host requires. */
  requiredClearance: string;
  /** Evaluation instant; defaults to now. Supplied explicitly so tests are deterministic. */
  now?: Date;
  /**
   * Deny-by-default posture. A high-assurance host rejects an unattested or
   * failing server; a permissive host surfaces the failure instead.
   */
  denyByDefault?: boolean;
}

/**
 * Machine-readable denial reasons, one per verification rule, as registered in
 * SEP-2809 § Error signalling.
 */
export const DENIAL_REASONS = {
  not_mcp_server: 1,
  unsigned: 2,
  signer_not_trusted: 3,
  signer_expired: 4,
  signer_not_approved: 5,
  bad_signature: 6,
  below_required: 7,
  host_not_bound: 8,
  tool_not_admitted: 9,
  /**
   * Precedes the numbered rules: a document whose version a verifier does not
   * understand cannot be evaluated against them.
   */
  unsupported_version: 0,
} as const;

export type DenialReason = keyof typeof DENIAL_REASONS;

export type AdmissionResult =
  | { admitted: true; clearance: string; rank: number }
  | { admitted: false; reason: DenialReason; code: number; detail: string };
