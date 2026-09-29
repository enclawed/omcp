/**
 * Cross-implementation agreement between ATSA and the audit record contract.
 *
 * The contract's §2.3 canonical form is stated to be the same one ATSA uses.
 * That claim is only worth anything if the two canonicalizers, written
 * independently, produce identical bytes for the same record — so this runs the
 * contract's published preimages through **ATSA's** canonicalizer and checks the
 * digests against the values sealed in the specification.
 *
 * Running the contract's own verifier here would prove nothing: it reproduces
 * its own known-answer test by construction.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { canonicalValue } from "../../atsa/src/canonicalize";
import { KAT_HASH_CG, KAT_HASH_2X } from "../src/vectors.ts";

const sha256 = (input: string) =>
  createHash("sha256").update(input, "utf8").digest("hex");

/** Fixture identifiers, as published in the specification's Conformance section. */
const NINES = "99999999-9999-9999-9999-999999999999";
const PRINCIPAL = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const SID = "55555555-5555-5555-5555-555555555555";

/**
 * The single-extension protected body. `event_hash` is the computed output and
 * is excluded from its own preimage.
 */
const singleExtension = {
  event_id: NINES,
  event_type: "tool_call",
  extensions: {
    "caller-governance": {
      flagged: false,
      invoked_by_principal_id: null,
      purpose_declared: "reconcile June invoices",
      session_id: SID,
    },
  },
  occurred_at: "2026-06-06T12:00:00.000Z",
  outcome: "deferred",
  previous_hash: null,
  principal_id: PRINCIPAL,
  tool_name: "export",
};

/** The two-extension body, transcribed from the specification's table. */
const twoExtension = {
  ...singleExtension,
  extensions: {
    ...singleExtension.extensions,
    "runtime-security": {
      drift_status: "confirmed",
      evidence_hash:
        "sha256:b2c547e2c8f17eafc72ef5c2d4d7b6b4d0f7437ab52bae573a9af14ff5e2d9be",
      policy_id: "example.org/runtime-drift@3",
      quarantine_decision: "quarantine",
      severity: "high",
    },
  },
};

/** The exact byte string the specification seals for the two-extension record. */
const PUBLISHED_PREIMAGE_2X =
  '{"event_id":"99999999-9999-9999-9999-999999999999","event_type":"tool_call","extensions":' +
  '{"caller-governance":{"flagged":false,"invoked_by_principal_id":null,"purpose_declared":' +
  '"reconcile June invoices","session_id":"55555555-5555-5555-5555-555555555555"},' +
  '"runtime-security":{"drift_status":"confirmed","evidence_hash":"sha256:b2c547e2c8f17eafc72ef5' +
  'c2d4d7b6b4d0f7437ab52bae573a9af14ff5e2d9be","policy_id":"example.org/runtime-drift@3",' +
  '"quarantine_decision":"quarantine","severity":"high"}},"occurred_at":"2026-06-06T12:00:00.000Z",' +
  '"outcome":"deferred","previous_hash":null,"principal_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",' +
  '"tool_name":"export"}';

test("ATSA's canonicalizer produces the byte string the contract publishes", () => {
  assert.equal(canonicalValue(twoExtension), PUBLISHED_PREIMAGE_2X);
});

test("ATSA's canonicalizer reproduces the two-extension known-answer digest", () => {
  assert.equal(sha256(canonicalValue(twoExtension)), KAT_HASH_2X);
  assert.match(KAT_HASH_2X, /^f733fed9/);
});

test("ATSA's canonicalizer reproduces the single-extension known-answer digest", () => {
  assert.equal(sha256(canonicalValue(singleExtension)), KAT_HASH_CG);
  assert.match(KAT_HASH_CG, /^d494769c/);
});

test("the published preimage hashes to the published digest", () => {
  // The digest is a property of the bytes alone, so this holds with no
  // implementation involved at all.
  assert.equal(sha256(PUBLISHED_PREIMAGE_2X), KAT_HASH_2X);
});

test("key order in the source object does not affect the canonical bytes", () => {
  const shuffled = {
    tool_name: twoExtension.tool_name,
    previous_hash: twoExtension.previous_hash,
    extensions: twoExtension.extensions,
    outcome: twoExtension.outcome,
    principal_id: twoExtension.principal_id,
    occurred_at: twoExtension.occurred_at,
    event_type: twoExtension.event_type,
    event_id: twoExtension.event_id,
  };
  assert.equal(canonicalValue(shuffled), PUBLISHED_PREIMAGE_2X);
});

test("altering any protected value changes the digest", () => {
  const cases: [string, unknown][] = [
    ["outcome", { ...twoExtension, outcome: "allowed" }],
    ["tool_name", { ...twoExtension, tool_name: "import" }],
    ["previous_hash", { ...twoExtension, previous_hash: "sha256:0000" }],
    [
      "extension data",
      {
        ...twoExtension,
        extensions: {
          ...twoExtension.extensions,
          "caller-governance": {
            ...twoExtension.extensions["caller-governance"],
            purpose_declared: "something else",
          },
        },
      },
    ],
  ];
  for (const [what, altered] of cases) {
    assert.notEqual(
      sha256(canonicalValue(altered)),
      KAT_HASH_2X,
      `altering ${what} left the digest unchanged`,
    );
  }
});
