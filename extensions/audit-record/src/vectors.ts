// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Notboatanchor Labs LLC
//
// Tamper-Evident Audit Record Contract: conformance vectors
// (canonical_form_version audit-record-contract/1).
// Machine-checkable surface (C-REC-1…7), input→expected style, mirroring the
// appendix of ATSA (MCP PR #2809). The append-only ENFORCEMENT of §2.5 is attested via the
// manifest (C-REC-7), not vector-checkable; the vectors verify its observable
// CONSEQUENCE (verification fails after an out-of-band mutation, C-REC-4).
//
// /2 shape: layer context lives in `extensions` (a keyed object), one entry per
// registered type id; a single record can carry MORE THAN ONE extension under
// one digest. The two known-answer tests below are sealed in the specification
// (`../spec/audit-record-contract.md`, Conformance).

import {
  type AuditRecord,
  type AttestationManifest,
  type CheckResult,
  canonicalPreimage,
  computeEventHash,
  validateSkeleton,
  validateExtensions,
  verifyChainSegment,
  verifyRecordHash,
  validateManifest,
} from './audit-record-contract.ts';

// ---------------------------------------------------------------------------
// Known-answer fixtures (cross-implementation interop anchor).
//
// KAT digests are FIXED and independently reproducible: a third-party
// implementation that adopts the §2.3 sorted-JSON canonicalization MUST
// reproduce them byte-for-byte. Reproduce either from a shell:
//
//   printf '%s' '<canonical preimage>' | sha256sum
//
// where the preimage is the sorted-key canonical JSON (see the README / the
// specification for the exact strings). This is the same canonical form ATSA's
// clearance assertion (MCP PR #2809) uses, so the two record types share one
// canonicalizer / one matrix.
// ---------------------------------------------------------------------------

// Single-extension caller-governance KAT (gif's companion vector). Reproduced
// d494769c via stock sha256sum AND gif's canonicalizer (both agree, 2026-06-14).
export const KAT_HASH_CG =
  'd494769c1ae442ea88dd190068747abf63c0568a3b856f85791b1a50a99d48b4';
// Two-extension KAT — one record carrying BOTH registered extensions side by
// side under one digest. Sealed in the specification. Reproduced by the
// canonicalizer here over the published preimage (and pinned by this vector);
// gif's live Postgres trigger emits a single extension and does NOT reproduce
// this two-extension digest (migration 015).
export const KAT_HASH_2X =
  'f733fed9cc757165f810b778e4baba1f51a45504988e937707aaab4361b2f064';

const SID = '55555555-5555-5555-5555-555555555555';
const PRINCIPAL = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const NINES = '99999999-9999-9999-9999-999999999999';

// Build a record and seal it with its computed event_hash.
function seal(base: Omit<AuditRecord, 'event_hash'>): AuditRecord {
  const rec = { ...base } as AuditRecord;
  rec.event_hash = computeEventHash(rec);
  return rec;
}

// For string-rule negatives (C-REC-2): the record is re-sealed with the
// verifier's own canonicalizer BEFORE verification, so the only ground for
// rejection is the normalization rule under test. Sealing the mutated record
// with the fixture's stale event_hash would reject on hash mismatch even on a
// verifier that lacks the rule, and the vector would not discriminate.
function sealOrReject(base: Omit<AuditRecord, 'event_hash'>): CheckResult {
  let sealed: AuditRecord;
  try {
    sealed = seal(base);
  } catch (e) {
    return { ok: false, failures: [`rejected at emission: ${(e as Error).message}`] };
  }
  return verifyRecordHash(sealed);
}

// rec1 — the single-extension caller-governance KAT fixture (segment head).
// Identifiers + values match gif's companion preimage exactly → reproduces
// KAT_HASH_CG. purpose_declared is in the extension, and therefore inside the
// chain (resolved O1).
const rec1: AuditRecord = seal({
  event_id: NINES,
  occurred_at: '2026-06-06T12:00:00.000Z',
  principal_id: PRINCIPAL,
  event_type: 'tool_call',
  tool_name: 'export',
  outcome: 'deferred',
  previous_hash: null,
  extensions: {
    'caller-governance': {
      session_id: SID,
      invoked_by_principal_id: null,
      purpose_declared: 'reconcile June invoices',
      flagged: false,
    },
  },
});

// rec2 — a second caller-governance record chained off rec1 (for GOOD_CHAIN).
const rec2: AuditRecord = seal({
  event_id: '22222222-2222-2222-2222-222222222222',
  occurred_at: '2026-06-06T12:00:01.000Z',
  principal_id: PRINCIPAL,
  event_type: 'tool_call',
  tool_name: 'export',
  outcome: 'allowed',
  previous_hash: rec1.event_hash,
  extensions: {
    'caller-governance': {
      session_id: SID,
      invoked_by_principal_id: null,
      purpose_declared: 'bulk export',
      flagged: true,
    },
  },
});

const GOOD_CHAIN: AuditRecord[] = [rec1, rec2];

// recBoth — the two-extension KAT fixture: ONE record carrying both
// caller-governance and runtime-security side by side. Matches the sealed
// preimage in the specification exactly → reproduces KAT_HASH_2X. It shares rec1's
// event_id + caller-governance body
// by design (gif's single-extension companion IS this record minus the
// runtime-security entry); they are standalone fixtures, never chained together.
const recBoth: AuditRecord = seal({
  event_id: NINES,
  occurred_at: '2026-06-06T12:00:00.000Z',
  principal_id: PRINCIPAL,
  event_type: 'tool_call',
  tool_name: 'export',
  outcome: 'deferred',
  previous_hash: null,
  extensions: {
    'caller-governance': {
      flagged: false,
      invoked_by_principal_id: null,
      purpose_declared: 'reconcile June invoices',
      session_id: SID,
    },
    'runtime-security': {
      drift_status: 'confirmed',
      evidence_hash: 'sha256:b2c547e2c8f17eafc72ef5c2d4d7b6b4d0f7437ab52bae573a9af14ff5e2d9be',
      policy_id: 'example.org/runtime-drift@3',
      quarantine_decision: 'quarantine',
      severity: 'high',
    },
  },
});

// recRS — a standalone runtime-security record chained off rec1. DIFFERENT
// extension type, SAME chain construction: demonstrates the mechanism is
// emitter-neutral. Uses the registered runtime-security field set.
const recRS: AuditRecord = seal({
  event_id: '33333333-3333-3333-3333-333333333333',
  occurred_at: '2026-06-06T12:00:02.000Z',
  principal_id: PRINCIPAL,
  event_type: 'policy_evaluation',
  tool_name: 'export',
  outcome: 'allowed',
  previous_hash: rec1.event_hash,
  extensions: {
    'runtime-security': {
      drift_status: 'observed',
      severity: 'medium',
      quarantine_decision: 'release',
      policy_id: 'example.org/runtime-drift@3',
    },
  },
});

const MIXED_CHAIN: AuditRecord[] = [rec1, recRS];

const clone = (r: AuditRecord): AuditRecord => structuredClone(r);

const MANIFEST_GOOD: AttestationManifest = {
  storage_mechanism: 'revoked-dml-rls',
  chain_algorithm: 'sha-256',
  canonical_form_version: 'audit-record-contract/1',
  verification_procedure_ref: 'https://github.com/notboatanchor/audit-record-contract/tree/main/vectors',
};

// ---------------------------------------------------------------------------
// Vector type
// ---------------------------------------------------------------------------

export interface Vector {
  id: string;
  requirement: string; // C-REC-n
  title: string;
  expect: 'conformant' | 'nonconformant';
  evaluate: () => CheckResult;
}

const matches = (a: string, b: string, msg: string): CheckResult =>
  a === b ? { ok: true, failures: [] } : { ok: false, failures: [msg] };
const differs = (a: string, b: string, msg: string): CheckResult =>
  a !== b ? { ok: true, failures: [] } : { ok: false, failures: [msg] };

export const VECTORS: Vector[] = [
  // ---- C-REC-1 — core skeleton + declared extensions ----
  {
    id: 'V-REC1-good',
    requirement: 'C-REC-1',
    title: 'a complete record carries the core skeleton + extensions with conforming types',
    expect: 'conformant',
    evaluate: () => validateSkeleton(rec1),
  },
  {
    id: 'V-REC1-missing-core',
    requirement: 'C-REC-1',
    title: 'a record missing previous_hash is rejected',
    expect: 'nonconformant',
    evaluate: () => {
      const bad = clone(rec1) as Partial<AuditRecord>;
      delete bad.previous_hash;
      return validateSkeleton(bad as AuditRecord);
    },
  },
  {
    id: 'V-REC1-missing-extensions',
    requirement: 'C-REC-1',
    title: 'a record missing extensions is rejected',
    expect: 'nonconformant',
    evaluate: () => {
      const bad = clone(rec1) as Partial<AuditRecord>;
      delete bad.extensions;
      return validateSkeleton(bad as AuditRecord);
    },
  },
  {
    id: 'V-REC1-extension-required-field',
    requirement: 'C-REC-1',
    title: 'a caller-governance extension without purpose_declared is rejected',
    expect: 'nonconformant',
    evaluate: () => {
      const bad = clone(rec1);
      delete (bad.extensions['caller-governance'] as Record<string, unknown>).purpose_declared;
      return validateExtensions(bad);
    },
  },
  {
    id: 'V-REC1-unregistered-extension',
    requirement: 'C-REC-1',
    title: 'a record declaring an unregistered extension type is rejected',
    expect: 'nonconformant',
    evaluate: () => {
      const bad = clone(rec1);
      bad.extensions['not-a-real-extension'] = { foo: 'bar' };
      return validateExtensions(bad);
    },
  },

  // ---- C-REC-2 — canonicalization: deterministic, injective, normalized ----
  {
    id: 'V-REC2-determinism',
    requirement: 'C-REC-2',
    title: 'canonical form is independent of top-level AND nested (extension-field) key order',
    expect: 'conformant',
    evaluate: () => {
      const reordered: AuditRecord = {
        event_hash: rec1.event_hash,
        previous_hash: rec1.previous_hash,
        outcome: rec1.outcome,
        tool_name: rec1.tool_name,
        event_type: rec1.event_type,
        principal_id: rec1.principal_id,
        occurred_at: rec1.occurred_at,
        event_id: rec1.event_id,
        extensions: {
          'caller-governance': {
            flagged: false,
            purpose_declared: 'reconcile June invoices',
            invoked_by_principal_id: null,
            session_id: SID,
          },
        },
      };
      return matches(canonicalPreimage(rec1), canonicalPreimage(reordered),
        'canonical form depends on field insertion order');
    },
  },
  {
    id: 'V-REC2-injective-core',
    requirement: 'C-REC-2',
    title: 'records differing in one CORE field produce different canonical forms',
    expect: 'conformant',
    evaluate: () => {
      const v = clone(rec1);
      v.outcome = 'denied';
      return differs(canonicalPreimage(rec1), canonicalPreimage(v),
        'distinct core tuples collided');
    },
  },
  {
    id: 'V-REC2-injective-extension',
    requirement: 'C-REC-2',
    title: 'records differing only in an extension field (purpose_declared) produce different canonical forms',
    expect: 'conformant',
    evaluate: () => {
      const v = clone(rec1);
      (v.extensions['caller-governance'] as Record<string, unknown>).purpose_declared = 'exfiltration';
      return differs(canonicalPreimage(rec1), canonicalPreimage(v),
        'altered purpose_declared did not change the canonical form');
    },
  },
  {
    id: 'V-REC2-null-vs-empty',
    requirement: 'C-REC-2',
    title: 'a null field encodes distinguishably from empty string',
    expect: 'conformant',
    evaluate: () => {
      const nullTool = clone(rec1); nullTool.tool_name = null;
      const emptyTool = clone(rec1); emptyTool.tool_name = '';
      return differs(canonicalPreimage(nullTool), canonicalPreimage(emptyTool),
        'null and empty-string tool_name produced identical canonical forms');
    },
  },
  {
    id: 'V-REC2-normalization',
    requirement: 'C-REC-2',
    title: 'NFC + trim normalization: NFD input with trailing space matches its NFC form',
    expect: 'conformant',
    evaluate: () => {
      const nfc = clone(rec1);
      (nfc.extensions['caller-governance'] as Record<string, unknown>).purpose_declared =
        'café audit'; // precomposed é (U+00E9)
      const nfd = clone(rec1);
      (nfd.extensions['caller-governance'] as Record<string, unknown>).purpose_declared =
        'café audit '; // e + combining acute (U+0301) + trailing space
      return matches(canonicalPreimage(nfc), canonicalPreimage(nfd),
        'NFC/trim normalization did not converge equivalent strings');
    },
  },
  {
    id: 'V-REC2-control-char',
    requirement: 'C-REC-2',
    title: 'a control character in a protected string field is rejected',
    expect: 'nonconformant',
    evaluate: () => {
      const bad = clone(rec1);
      (bad.extensions['caller-governance'] as Record<string, unknown>).purpose_declared = 'line1\nline2';
      return sealOrReject(bad); // canonicalization throws -> rejected
    },
  },
  {
    id: 'V-REC2-c1-control',
    requirement: 'C-REC-2',
    title: 'a C1 control character (U+0085 NEL) in a protected string field is rejected, not only C0',
    expect: 'nonconformant',
    evaluate: () => {
      // §2.3 rejects the full Cc category (U+0000–U+001F and U+007F–U+009F). A
      // verifier that screens C0 + DEL only passes V-REC2-control-char and fails
      // here: U+0085 is a C1 control that survives a C0-only check.
      const bad = clone(rec1);
      (bad.extensions['caller-governance'] as Record<string, unknown>).purpose_declared = 'line1\u0085line2';
      return sealOrReject(bad); // canonicalization throws -> rejected
    },
  },
  {
    id: 'V-REC2-unpaired-surrogate',
    requirement: 'C-REC-2',
    title: 'an unpaired surrogate code unit in a protected string field is rejected (well-formed Unicode only)',
    expect: 'nonconformant',
    evaluate: () => {
      // §2.3: a value carrying an unpaired surrogate makes the record
      // non-conforming. RFC 8259 §8.2 leaves receiver behavior unpredictable, so
      // such a value has no single canonical byte form.
      const bad = clone(rec1);
      (bad.extensions['caller-governance'] as Record<string, unknown>).purpose_declared = 'lone \uD83D surrogate';
      return sealOrReject(bad); // canonicalization throws -> rejected
    },
  },
  {
    id: 'V-REC2-astral-literal',
    requirement: 'C-REC-2',
    title: 'a well-formed surrogate pair (astral code point) is accepted and serialized literally, not \\u-escaped',
    expect: 'conformant',
    evaluate: () => {
      // The companion to V-REC2-unpaired-surrogate: the well-formedness rule
      // rejects unpaired code units, not astral characters. §2.3 also requires
      // minimal escaping, so U+1F512 appears in the preimage as its UTF-8 bytes,
      // never as the escape sequence "🔒".
      const good = clone(rec1);
      (good.extensions['caller-governance'] as Record<string, unknown>).purpose_declared = 'export \u{1F512} locked';
      const pre = canonicalPreimage(good);
      if (!pre.includes('export \u{1F512} locked')) {
        return { ok: false, failures: ['astral character was not serialized literally'] };
      }
      if (/\\u[dD]8/.test(pre)) {
        return { ok: false, failures: ['astral character was \\u-escaped in the canonical form'] };
      }
      return verifyRecordHash(seal(good));
    },
  },

  // ---- C-REC-3 — known-answer hash (cross-impl interop) ----
  {
    id: 'V-REC3-kat',
    requirement: 'C-REC-3',
    title: 'event_hash equals the fixed known-answer SHA-256 for both the single- and two-extension fixtures',
    expect: 'conformant',
    evaluate: () => {
      const failures: string[] = [];
      if (computeEventHash(rec1) !== KAT_HASH_CG) {
        failures.push(`rec1 (caller-governance) KAT mismatch: ${computeEventHash(rec1)} != ${KAT_HASH_CG}`);
      }
      if (computeEventHash(recBoth) !== KAT_HASH_2X) {
        failures.push(`recBoth (two-extension) KAT mismatch: ${computeEventHash(recBoth)} != ${KAT_HASH_2X}`);
      }
      return { ok: failures.length === 0, failures };
    },
  },

  // ---- C-REC-4 — chain integrity + tamper detection ----
  {
    id: 'V-REC4-good-chain',
    requirement: 'C-REC-4',
    title: 'a well-formed segment verifies (per-record hash + continuous threading)',
    expect: 'conformant',
    evaluate: () => verifyChainSegment(GOOD_CHAIN),
  },
  {
    id: 'V-REC4-tamper-core',
    requirement: 'C-REC-4',
    title: 'mutating a committed CORE field breaks verification at that record',
    expect: 'nonconformant',
    evaluate: () => {
      const t = GOOD_CHAIN.map(clone);
      t[0].outcome = 'denied';
      return verifyChainSegment(t);
    },
  },
  {
    id: 'V-REC4-tamper-purpose',
    requirement: 'C-REC-4',
    title: 'rewriting purpose_declared after commitment breaks verification (the stated reason cannot be altered post-hoc)',
    expect: 'nonconformant',
    evaluate: () => {
      const t = GOOD_CHAIN.map(clone);
      (t[0].extensions['caller-governance'] as Record<string, unknown>).purpose_declared = 'authorized maintenance';
      return verifyChainSegment(t);
    },
  },
  {
    id: 'V-REC4-delete-record',
    requirement: 'C-REC-4',
    title: 'deleting the head record breaks previous_hash threading',
    expect: 'nonconformant',
    evaluate: () => verifyChainSegment([clone(rec2)]),
  },

  // ---- C-REC-5 — emission completeness + session linkage ----
  {
    id: 'V-REC5-emission',
    requirement: 'C-REC-5',
    title: 'a scripted governed sequence records each required event_type, linked to its session',
    expect: 'conformant',
    evaluate: () => {
      // A referencing proposal declares its required event_type set; this uses
      // the GIF reference impl's caller-governance lifecycle set as the example.
      const required = ['session_start', 'session_close', 'session_expired', 'session_rejected_closed'];
      const emitted: AuditRecord[] = required.map((et, i) => ({
        event_id: `e${i}`,
        occurred_at: `2026-06-06T12:01:0${i}.000Z`,
        principal_id: PRINCIPAL,
        event_type: et,
        tool_name: null,
        outcome: 'recorded',
        previous_hash: null,
        event_hash: 'n/a-not-under-test',
        extensions: { 'caller-governance': { session_id: SID, purpose_declared: 'lifecycle' } },
      }));
      const failures: string[] = [];
      for (const et of required) {
        const row = emitted.find((r) => r.event_type === et);
        if (!row) { failures.push(`missing required event_type: ${et}`); continue; }
        const cg = row.extensions['caller-governance'] as Record<string, unknown>;
        if (cg?.session_id == null) {
          failures.push(`${et} not linked to a session_id`);
        }
      }
      return { ok: failures.length === 0, failures };
    },
  },

  // ---- C-REC-6 — extension mechanism (emitter-neutral chaining; multi-extension) ----
  {
    id: 'V-REC6-mixed-extension-chain',
    requirement: 'C-REC-6',
    title: 'a caller-governance record and a runtime-security record chain under ONE construction',
    expect: 'conformant',
    evaluate: () => verifyChainSegment(MIXED_CHAIN),
  },
  {
    id: 'V-REC6-extension-fields-chained',
    requirement: 'C-REC-6',
    title: 'a runtime-security extension field (severity) is integrity-protected by the same chain',
    expect: 'nonconformant',
    evaluate: () => {
      const t = [clone(rec1), clone(recRS)];
      (t[1].extensions['runtime-security'] as Record<string, unknown>).severity = 'low'; // downgrade after commit
      return verifyChainSegment(t);
    },
  },
  {
    id: 'V-REC6-two-extension-record',
    requirement: 'C-REC-6',
    title: 'a single record carrying BOTH caller-governance and runtime-security verifies under one digest',
    expect: 'conformant',
    evaluate: () => verifyRecordHash(recBoth),
  },
  {
    id: 'V-REC6-two-extension-tamper',
    requirement: 'C-REC-6',
    title: 'tampering one extension in a two-extension record breaks the single digest',
    expect: 'nonconformant',
    evaluate: () => {
      const bad = clone(recBoth);
      (bad.extensions['runtime-security'] as Record<string, unknown>).severity = 'low';
      return verifyRecordHash(bad);
    },
  },

  // ---- C-REC-7 — structured attestation (not bare "trust us") ----
  {
    id: 'V-REC7-manifest-good',
    requirement: 'C-REC-7',
    title: 'an attestation manifest declaring mechanism + algorithm + version + verifier-ref is structured',
    expect: 'conformant',
    evaluate: () => validateManifest(MANIFEST_GOOD),
  },
  {
    id: 'V-REC7-manifest-bare',
    requirement: 'C-REC-7',
    title: 'a bare attestation (no declared mechanism/verifier) is rejected',
    expect: 'nonconformant',
    evaluate: () => validateManifest({}),
  },
];
