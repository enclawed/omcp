/**
 * Tamper-Evident Audit Record Contract — conformance vectors, run under the
 * repository's test runner.
 *
 * The contract, its reference verifier, and these vectors are the work of
 * Notboatanchor Labs LLC and are vendored unmodified under `src/`. This file
 * replaces the upstream standalone runner (`vectors/run.ts`) so the same
 * vectors execute as part of `npm test`, and so a regression fails the build
 * rather than printing to a console nobody reads.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { VECTORS, type Vector } from "../src/vectors.ts";
import { ADDITIONAL_VECTORS } from "./additional-vectors";

/** The vendored suite plus the rejecting cases it was missing. */
const ALL_VECTORS: Vector[] = [...VECTORS, ...ADDITIONAL_VECTORS];

test("the vendored vector set is present", () => {
  assert.ok(VECTORS.length > 0, "no conformance vectors found");
  assert.ok(ADDITIONAL_VECTORS.length > 0, "no supplementary vectors found");
});

/** Groups vectors by the requirement they exercise, e.g. "C-REC-1". */
const byRequirement = new Map<string, Vector[]>();
for (const vector of ALL_VECTORS) {
  const list = byRequirement.get(vector.requirement) ?? [];
  list.push(vector);
  byRequirement.set(vector.requirement, list);
}

for (const [requirement, vectors] of byRequirement) {
  for (const vector of vectors) {
    test(`${requirement}: ${vector.id} — ${vector.title}`, () => {
      const result = vector.evaluate();
      // A "conformant" vector must be accepted; a "nonconformant" one must be
      // rejected. A rejection that never happens is the failure that matters.
      if (vector.expect === "conformant") {
        assert.equal(
          result.ok,
          true,
          result.failures.join("; ") || "verifier rejected a conformant record",
        );
      } else {
        assert.equal(
          result.ok,
          false,
          "verifier accepted a non-conformant record",
        );
        assert.ok(
          result.failures.length > 0,
          "a rejection must say what failed",
        );
      }
    });
  }
}

test("every requirement is covered by both an accepting and a rejecting vector", () => {
  const uncovered: string[] = [];
  for (const [requirement, vectors] of byRequirement) {
    const accepts = vectors.some((v) => v.expect === "conformant");
    const rejects = vectors.some((v) => v.expect === "nonconformant");
    if (!accepts || !rejects) {
      uncovered.push(
        `${requirement} (${accepts ? "" : "no accepting vector"}${!accepts && !rejects ? ", " : ""}${rejects ? "" : "no rejecting vector"})`,
      );
    }
  }
  assert.deepEqual(
    uncovered,
    [],
    `requirements without both cases: ${uncovered.join("; ")}`,
  );
});
