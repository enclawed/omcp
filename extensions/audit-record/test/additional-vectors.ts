/**
 * Supplementary conformance vectors for the Tamper-Evident Audit Record
 * Contract.
 *
 * The vendored suite under `src/vectors.ts` covers C-REC-3 and C-REC-5 with
 * accepting cases only: it shows that a correct record reproduces the published
 * known-answer hash, and that a complete emission sequence is accepted. Neither
 * requirement has a case proving the check can *fail*, so a verifier that
 * always returned "ok" would pass both.
 *
 * These vectors supply the missing rejecting cases. They are kept separate so
 * the upstream suite stays byte-identical to its published form, and they are
 * offered back to that project.
 */

import {
  computeEventHash,
  type AuditRecord,
  type CheckResult,
} from "../src/audit-record-contract.ts";
import { KAT_HASH_CG, type Vector } from "../src/vectors.ts";

const PRINCIPAL = "principal:alice@example.com";
const SID = "sess-0001";

/** A record shaped like the published single-extension known-answer fixture. */
function katLikeRecord(): AuditRecord {
  return {
    event_id: "evt-0001",
    occurred_at: "2026-06-06T12:00:00.000Z",
    principal_id: PRINCIPAL,
    event_type: "tool_call",
    tool_name: "search",
    outcome: "allowed",
    previous_hash: null,
    event_hash: "unset",
    extensions: {
      "caller-governance": { session_id: SID, purpose_declared: "research" },
    },
  };
}

/**
 * Vectors return the verifier's verdict, as the vendored suite does: `ok: true`
 * means the record was accepted. A rejecting vector therefore expects `false`.
 */
const verdict = (accepted: boolean, failure: string): CheckResult =>
  accepted ? { ok: true, failures: [] } : { ok: false, failures: [failure] };

/** Does this record still reproduce the published known-answer hash? */
const matchesKat = (record: AuditRecord): CheckResult =>
  verdict(
    computeEventHash(record) === KAT_HASH_CG,
    `hash ${computeEventHash(record)} does not match the known answer ${KAT_HASH_CG}`,
  );

export const ADDITIONAL_VECTORS: Vector[] = [
  {
    id: "V-REC3-kat-tampered",
    requirement: "C-REC-3",
    title:
      "a record whose protected field was altered no longer matches the known-answer hash",
    expect: "nonconformant",
    evaluate: () => {
      const tampered = katLikeRecord();
      // `outcome` is a protected core field, so changing it must change the hash.
      tampered.outcome = "denied";
      return matchesKat(tampered);
    },
  },
  {
    id: "V-REC3-kat-extension-swapped",
    requirement: "C-REC-3",
    title:
      "changing an extension's data changes the hash, because extensions are in the preimage",
    expect: "nonconformant",
    evaluate: () => {
      const tampered = katLikeRecord();
      tampered.extensions = {
        "caller-governance": {
          session_id: SID,
          purpose_declared: "exfiltration",
        },
      };
      return matchesKat(tampered);
    },
  },
  {
    id: "V-REC5-emission-incomplete",
    requirement: "C-REC-5",
    title: "a sequence missing a declared-required event_type is detected",
    expect: "nonconformant",
    evaluate: () => {
      const required = [
        "session_start",
        "session_close",
        "session_expired",
        "session_rejected_closed",
      ];
      // The sequence omits session_close, which a conforming emitter must record.
      const emitted: AuditRecord[] = required
        .filter((eventType) => eventType !== "session_close")
        .map((eventType, index) => ({
          event_id: `e${index}`,
          occurred_at: `2026-06-06T12:01:0${index}.000Z`,
          principal_id: PRINCIPAL,
          event_type: eventType,
          tool_name: null,
          outcome: "recorded",
          previous_hash: null,
          event_hash: "n/a-not-under-test",
          extensions: {
            "caller-governance": {
              session_id: SID,
              purpose_declared: "lifecycle",
            },
          },
        }));

      const missing = required.filter(
        (eventType) => !emitted.some((r) => r.event_type === eventType),
      );
      return verdict(
        missing.length === 0,
        `missing required event_type: ${missing.join(", ")}`,
      );
    },
  },
  {
    id: "V-REC5-emission-unlinked",
    requirement: "C-REC-5",
    title: "a required event recorded without a session link is detected",
    expect: "nonconformant",
    evaluate: () => {
      const record: AuditRecord = {
        event_id: "e0",
        occurred_at: "2026-06-06T12:01:00.000Z",
        principal_id: PRINCIPAL,
        event_type: "session_start",
        tool_name: null,
        outcome: "recorded",
        previous_hash: null,
        event_hash: "n/a-not-under-test",
        // Present, but carrying no session_id to link the event to.
        extensions: { "caller-governance": { purpose_declared: "lifecycle" } },
      };
      const governance = record.extensions["caller-governance"] as Record<
        string,
        unknown
      >;
      return verdict(
        governance?.session_id != null,
        `${record.event_type} is not linked to a session_id`,
      );
    },
  },
];
