/**
 * Attested Tool-Server Admission (ATSA) — reference implementation of SEP-2809.
 *
 * A server publishes an offline-signed clearance assertion; a host verifies it
 * against a locally pinned trust root before any tool dispatch, and authorizes
 * tools separately from admitting the server.
 */

export { canonicalBody } from "./canonicalize";
export { authorizeTool, rankOf, verifyAttestation } from "./verify";
export {
  DENIAL_REASONS,
  MCP_SERVER_CAPABILITY,
  REGISTERED_FIELDS,
  SAD_VERSION,
  type AdmissionContext,
  type AdmissionResult,
  type ClearanceLevel,
  type ClearanceScheme,
  type DenialReason,
  type ServerAttestationDocument,
  type TrustRoot,
  type TrustedKey,
} from "./types";
