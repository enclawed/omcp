import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { admitServer, verifyAttestation } from "../src/verify";
import { COMPATIBILITY_MODE_ENV } from "../../compatibility-mode/src/index";
import type { ServerAttestationDocument, TrustRoot } from "../src/types";

const VECTORS = path.join(__dirname, "vectors");
const trustRoot: TrustRoot = JSON.parse(
  fs.readFileSync(path.join(VECTORS, "_trust-root.json"), "utf8"),
);
const valid: ServerAttestationDocument = JSON.parse(
  fs.readFileSync(path.join(VECTORS, "admits-a-valid-document.json"), "utf8"),
).sad;

const context = {
  origin: "https://tools.example.com",
  requiredClearance: "internal",
  now: new Date("2026-06-01T12:00:00Z"),
  denyByDefault: true,
};

/** Runs a function with OMCP_COMPATIBILITY_MODE set, restoring it afterwards. */
function withEnv<T>(value: string | undefined, fn: () => T): T {
  const saved = process.env[COMPATIBILITY_MODE_ENV];
  if (value === undefined) delete process.env[COMPATIBILITY_MODE_ENV];
  else process.env[COMPATIBILITY_MODE_ENV] = value;
  try {
    return fn();
  } finally {
    if (saved === undefined) delete process.env[COMPATIBILITY_MODE_ENV];
    else process.env[COMPATIBILITY_MODE_ENV] = saved;
  }
}

test("admitServer does not evaluate attestation in compatibility mode", () => {
  const outcome = admitServer(valid, trustRoot, {
    ...context,
    compatibilityMode: "yes",
  });
  assert.equal(outcome.applied, false);
  assert.equal(
    outcome.applied === false && outcome.reason,
    "compatibility-mode",
  );
});

test("admitServer evaluates attestation when the mode is off", () => {
  const outcome = admitServer(valid, trustRoot, {
    ...context,
    compatibilityMode: "no",
  });
  assert.equal(outcome.applied, true);
  assert.equal(outcome.applied === true && outcome.result.admitted, true);
});

test("admitServer honours the environment when the mode is not passed", () => {
  withEnv("yes", () => {
    assert.equal(admitServer(valid, trustRoot, context).applied, false);
  });
  withEnv("no", () => {
    assert.equal(admitServer(valid, trustRoot, context).applied, true);
  });
  withEnv(undefined, () => {
    assert.equal(admitServer(valid, trustRoot, context).applied, true);
  });
});

test("a not-applied outcome cannot be mistaken for an admission", () => {
  const outcome = admitServer(valid, trustRoot, {
    ...context,
    compatibilityMode: "yes",
  });
  // There is no `admitted` field to read by accident: the caller must branch on
  // `applied` and decide what compatibility mode means for its posture.
  assert.equal("admitted" in outcome, false);
  assert.equal("result" in outcome, false);
});

test("verifying an attestation under compatibility mode is a misconfiguration", () => {
  assert.throws(
    () =>
      verifyAttestation(valid, trustRoot, {
        ...context,
        compatibilityMode: "yes",
      }),
    /attested tool-server admission is an omcp addition and compatibility mode is on/,
  );
});

test("verifyAttestation ignores the ambient environment, so vectors stay deterministic", () => {
  withEnv("yes", () => {
    const result = verifyAttestation(valid, trustRoot, context);
    assert.equal(result.admitted, true);
  });
});
