// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Notboatanchor Labs LLC
//
// Tamper-Evident Audit Record Contract: reference verifier.
// Vendor-neutral. Implements the machine-checkable surface of the contract:
// §2.1 core skeleton, §2.2 typed-extension mechanism (the `extensions` keyed
// object), §2.3 sorted-JSON canonicalization (aligned with ATSA, MCP PR #2809), §2.4 hash
// chain, §2.6 verification, and §2.7 the attestation-manifest (the *structured*
// attestation surface).
// It does NOT implement storage or append-only ENFORCEMENT — that is attested
// via the manifest, not wire-observable, per the resolved conformance boundary.
//
// canonical_form_version: audit-record-contract/1 (`extensions` keyed object;
// abstract `outcome` enum; no bare numbers). The sealed two-extension
// known-answer test lives in the specification (`../spec/audit-record-contract.md`,
// Conformance); the canonicalizer here reproduces it over the published preimage.
// The reference implementation (gif) labels the same form `gif-audit/2` internally.
//
// Runnable with: `npx tsx run.ts`  or  Node >= 22.6 `node --experimental-strip-types run.ts`.

import { createHash } from 'node:crypto';

// ---------------------------------------------------------------------------
// §2.1 The audit record — minimal protected CORE + typed extensions.
//
// The core is emitter-neutral: every conforming record carries it, whatever
// layer authored the record. Layer-specific context lives in `extensions`, a
// JSON object keyed by registered type id (`{"<type>": <data>, ...}`), one entry
// per type. The type id is a preimage KEY (so a type cannot be swapped without
// breaking the chain), and every extension's data is canonicalized into the same
// preimage as the core — so extension fields are integrity-protected by the same
// chain construction. There is one chain construction, not one per emitter, and
// a single record can carry MORE THAN ONE extension (caller-governance +
// runtime-security side by side under one digest — see the specification).
// ---------------------------------------------------------------------------

export interface AuditRecord {
  // ---- Protected CORE (MUST; every conforming record, every extension) ----
  event_id: string;              // unique within the chain
  occurred_at: string;           // RFC 3339 UTC 'Z'; recorder clock, not caller-settable
  principal_id: string;          // the governed identity
  event_type: string;            // from a registered vocabulary
  tool_name: string | null;      // what was acted on; null where not applicable
  outcome: string;               // abstract disposition: allowed | denied | deferred | error
  previous_hash: string | null;  // chain link; null only for a segment head
  event_hash: string;            // integrity digest (output; excluded from the preimage)

  // ---- Typed extensions (MUST be present; keyed by registered type id) ----
  // `{"<type>": {<fields>}, ...}` — one entry per registered extension type.
  extensions: Record<string, Record<string, unknown>>;

  // ---- Reserved (§2.8). Unused in v1; defined by a follow-on anchoring profile.
  // Excluded from the v1 preimage so reserving the name does not bind v1.
  anchor_witness?: unknown;

  // Unknown TOP-LEVEL fields MUST be ignored, not rejected (forward-extension).
  [key: string]: unknown;
}

// The protected core field order is irrelevant to the hash (canonicalization is
// order-independent), but this is the documented core set, minus event_hash.
// `profile` is gone in /2 — the extension type id is a KEY inside `extensions`.
export const CORE_PROTECTED = [
  'event_id',
  'occurred_at',
  'principal_id',
  'event_type',
  'tool_name',
  'outcome',
  'previous_hash',
] as const;

const CORE_REQUIRED = [...CORE_PROTECTED, 'event_hash', 'extensions'] as const;

// The abstract outcome vocabulary (§2.1). The base record owns the disposition;
// an extension's own status fields (e.g. runtime-security `drift_status`) are
// EVIDENCE informing it, not a competing outcome. The verifier does not enforce
// this enum (audit never blocks), but conforming emitters write from it.
export const OUTCOMES = ['allowed', 'denied', 'deferred', 'error'] as const;

// ---------------------------------------------------------------------------
// Extension registry. The contract defines the MECHANISM and the first worked
// extension (caller-governance, gif's). Other emitter types register their own
// extension: runtime-security is registered from its implementer's normative
// text (Interlock/Maaz, sealed 2026-06-14); admission-control is NAMED as a
// future contributor (skeleton only). The const name `PROFILES` reads as "the
// per-type field spec" — each extension type registers one profile.
// ---------------------------------------------------------------------------

export const PROFILES = {
  // Worked, fully specified by this contract (the reference implementation's shape).
  'caller-governance': {
    required: ['purpose_declared'] as const, // declared intent is REQUIRED + chained
    optional: ['session_id', 'invoked_by_principal_id', 'flagged',
               'sources_touched', 'sensitivity_encountered',
               'output_disposition', 'human_actor_id'] as const,
  },
  // Registered from the implementer's normative runtime-security text (sealed
  // 2026-06-14). All values are strings (the profile's all-string convention);
  // `evidence_hash` is OPTIONAL (a `drift_status:none` event has nothing to
  // commit to — the choice does not change the digest).
  'runtime-security': {
    required: ['drift_status', 'severity', 'quarantine_decision', 'policy_id'] as const,
    optional: ['evidence_hash'] as const,
  },
  // Named, contributed by an implementer of that emitter type (skeleton only).
  'admission-control': { required: [] as const, optional: [] as const },
} as const;

export type ProfileId = keyof typeof PROFILES;

// ---------------------------------------------------------------------------
// §2.3 Canonicalization — sorted-key canonical JSON (aligned with PR #2809).
//
// One canonicalizer for the whole record, including the nested `extensions`, so
// adopters run clearance assertions (#2809) and audit records on the same code
// path. Protected string VALUES are normalized (NFC, trim U+0020 only, length
// cap, no control characters, well-formed Unicode). Object KEYS — including
// extension type ids and registered field names — are a controlled ASCII
// registry vocabulary and are serialized as-is (sorted), NOT passed through
// value normalization. null encodes distinguishably from "". No bare numbers in
// /2: every extension value is a string, boolean, or null — each has exactly one
// canonical JSON form.
// ---------------------------------------------------------------------------

export const MAX_FIELD_LEN = 8192;

// Recursion bound for canonicalize(): conforming records are shallow (core + one
// `extensions` level + flat string/bool/null data), so this is far above any valid
// record. It guards a verifier importing untrusted records against stack exhaustion
// from hostile deeply-nested input; it changes no canonical output for valid records.
export const MAX_DEPTH = 64;

export function normalizeString(s: string): string {
  // Control characters (Unicode category Cc: U+0000–U+001F and U+007F–U+009F)
  // are not permitted in a protected string field.
  if (/[\u0000-\u001f\u007f-\u009f]/.test(s)) {
    throw new Error('control character in protected string field');
  }
  // Well-formed Unicode only (§2.3): a value carrying an unpaired surrogate code
  // unit is rejected. Under the `u` flag a valid surrogate pair is read as one
  // astral code point, so \p{Surrogate} matches unpaired code units only.
  if (/\p{Surrogate}/u.test(s)) {
    throw new Error('unpaired surrogate in protected string field');
  }
  // Trim U+0020 (ASCII space) only, not the full whitespace class, to match
  // the contract's §2.3 (PG btrim parity). Control chars are already rejected above;
  // non-control Unicode whitespace (NBSP, U+2000–U+200A, …) is preserved.
  const n = s.normalize('NFC').replace(/^ +| +$/g, '');
  if (n.length > MAX_FIELD_LEN) {
    throw new Error('protected string field exceeds length cap');
  }
  return n;
}

// Deterministic, injective sorted-JSON encoding over the protected value tree.
// Object keys are serialized as-is and sorted (registry vocabulary, not
// normalized); string values are normalized. Numbers remain supported for
// forward-safety but are excluded by the /2 no-bare-numbers convention.
export function canonicalize(value: unknown, depth = 0): string {
  // Bound recursion against hostile deeply-nested input (stack-exhaustion guard).
  // Conforming records are shallow, so this throws only on pathological nesting and
  // never alters canonical output for a valid record.
  if (depth > MAX_DEPTH) throw new Error('protected value nesting exceeds depth cap');
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('non-finite number');
    return JSON.stringify(value);
  }
  if (typeof value === 'string') return JSON.stringify(normalizeString(value));
  if (Array.isArray(value)) {
    return '[' + value.map((v) => canonicalize(v, depth + 1)).join(',') + ']';
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).filter((k) => obj[k] !== undefined).sort();
    return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalize(obj[k], depth + 1)).join(',') + '}';
  }
  throw new Error(`uncanonicalizable value of type ${typeof value}`);
}

// The integrity preimage: the protected core (minus event_hash) plus the typed
// `extensions` keyed object, as one canonical object. anchor_witness is reserved
// and NOT included in v1.
export function canonicalBody(record: AuditRecord): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  for (const f of CORE_PROTECTED) body[f] = record[f];
  body.extensions = record.extensions;
  return body;
}

export function canonicalPreimage(record: AuditRecord): string {
  return canonicalize(canonicalBody(record));
}

// §2.4 — H = SHA-256 at baseline.
export function sha256hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

export function computeEventHash(record: AuditRecord): string {
  return sha256hex(canonicalPreimage(record));
}

// ---------------------------------------------------------------------------
// Validation surfaces
// ---------------------------------------------------------------------------

export interface CheckResult {
  ok: boolean;
  failures: string[];
}

// C-REC-1 — core skeleton present with conforming types, extensions declared.
export function validateSkeleton(record: AuditRecord): CheckResult {
  const failures: string[] = [];
  for (const f of CORE_REQUIRED) {
    if (!(f in record)) failures.push(`missing required field: ${f}`);
  }
  if ('outcome' in record && typeof record.outcome !== 'string') {
    failures.push('outcome MUST be string');
  }
  if ('tool_name' in record &&
      record.tool_name !== null && typeof record.tool_name !== 'string') {
    failures.push('tool_name MUST be string or null');
  }
  if ('previous_hash' in record &&
      record.previous_hash !== null && typeof record.previous_hash !== 'string') {
    failures.push('previous_hash MUST be string or null');
  }
  if ('extensions' in record &&
      (record.extensions === null || typeof record.extensions !== 'object' ||
       Array.isArray(record.extensions))) {
    failures.push('extensions MUST be a keyed object');
  }
  return { ok: failures.length === 0, failures };
}

// C-REC-1b — every declared extension type is registered, and each type's
// required fields are present (non-null) in its data object.
export function validateExtensions(record: AuditRecord): CheckResult {
  const failures: string[] = [];
  const registry = PROFILES as Record<string, { required: readonly string[] }>;
  const entries = Object.entries(record.extensions ?? {});
  if (entries.length === 0) {
    failures.push('extensions MUST declare at least one registered type');
  }
  for (const [type, data] of entries) {
    const spec = registry[type];
    if (!spec) {
      failures.push(`unregistered extension type: ${type}`);
      continue;
    }
    const fields = (data ?? {}) as Record<string, unknown>;
    for (const f of spec.required) {
      if (!(f in fields) || fields[f] == null) {
        failures.push(`extension ${type} requires ${f}`);
      }
    }
  }
  return { ok: failures.length === 0, failures };
}

// C-REC-3 — event_hash equals H(canonical_form(protected_fields)).
export function verifyRecordHash(record: AuditRecord): CheckResult {
  let expected: string;
  try {
    expected = computeEventHash(record);
  } catch (e) {
    return { ok: false, failures: [`canonicalization failed on ${record.event_id}: ${(e as Error).message}`] };
  }
  return expected === record.event_hash
    ? { ok: true, failures: [] }
    : { ok: false, failures: [`event_hash mismatch on ${record.event_id}: expected ${expected}, stored ${record.event_hash}`] };
}

// C-REC-4 — chain segment integrity: per-record hash + previous_hash threading.
export function verifyChainSegment(records: AuditRecord[]): CheckResult {
  const failures: string[] = [];
  records.forEach((rec, i) => {
    const h = verifyRecordHash(rec);
    if (!h.ok) failures.push(...h.failures);
    if (i === 0) {
      if (rec.previous_hash !== null) {
        failures.push(`segment head ${rec.event_id} MUST have null previous_hash`);
      }
    } else {
      const prev = records[i - 1];
      if (rec.previous_hash !== prev.event_hash) {
        failures.push(`broken link at ${rec.event_id}: previous_hash ${rec.previous_hash} != prior event_hash ${prev.event_hash}`);
      }
    }
  });
  return { ok: failures.length === 0, failures };
}

// ---------------------------------------------------------------------------
// §2.7 Attestation manifest — the STRUCTURED attestation surface.
//
// The append-only enforcement of §2.5 is not wire-observable, but "attested"
// must not collapse to "trust us" (a bare attestation is non-conformant). A
// conforming implementation publishes a machine-readable manifest declaring the
// storage mechanism, the chain algorithm, the canonical-form version, and a
// pointer to a reproducible verification procedure that runs over an exported
// record set and produces a deterministic verdict.
// ---------------------------------------------------------------------------

export interface AttestationManifest {
  storage_mechanism: string;      // e.g. revoked-dml-rls | worm | ledger-db | append-only-file
  chain_algorithm: string;        // e.g. sha-256
  canonical_form_version: string; // audit-record-contract/1 for this version of §2.3
  verification_procedure_ref: string; // resolvable pointer to a reproducible verifier
}

const MANIFEST_REQUIRED = [
  'storage_mechanism',
  'chain_algorithm',
  'canonical_form_version',
  'verification_procedure_ref',
] as const;

// C-REC-7 — the attestation is structured (not bare "trust us").
export function validateManifest(manifest: Partial<AttestationManifest>): CheckResult {
  const failures: string[] = [];
  for (const f of MANIFEST_REQUIRED) {
    const v = (manifest as Record<string, unknown>)[f];
    if (typeof v !== 'string' || v.trim() === '') {
      failures.push(`attestation manifest missing or empty: ${f}`);
    }
  }
  return { ok: failures.length === 0, failures };
}
