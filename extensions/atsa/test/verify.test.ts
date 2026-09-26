import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { authorizeTool, rankOf, verifyAttestation } from "../src/verify";
import {
  DENIAL_REASONS,
  type ServerAttestationDocument,
  type TrustRoot,
} from "../src/types";

const VECTORS = path.join(__dirname, "vectors");
const trustRoot: TrustRoot = JSON.parse(
  fs.readFileSync(path.join(VECTORS, "_trust-root.json"), "utf8"),
);

interface Vector {
  name: string;
  rule: string;
  description: string;
  sad: ServerAttestationDocument | null;
  context: { origin: string; requiredClearance: string; now: string };
  expect: { admitted: boolean; reason?: string; code?: number };
}

const vectors: Vector[] = fs
  .readdirSync(VECTORS)
  .filter((f) => f.endsWith(".json") && !f.startsWith("_"))
  .sort()
  .map((f) => JSON.parse(fs.readFileSync(path.join(VECTORS, f), "utf8")));

test("the committed conformance vectors are present", () => {
  assert.ok(
    vectors.length >= 19,
    `expected the full vector set, found ${vectors.length}`,
  );
});

for (const vector of vectors) {
  test(`vector: ${vector.name} (${vector.rule})`, () => {
    const result = verifyAttestation(vector.sad, trustRoot, {
      origin: vector.context.origin,
      requiredClearance: vector.context.requiredClearance,
      now: new Date(vector.context.now),
      denyByDefault: true,
    });

    assert.equal(result.admitted, vector.expect.admitted, vector.description);
    if (!vector.expect.admitted && !result.admitted) {
      assert.equal(result.reason, vector.expect.reason);
      assert.equal(result.code, vector.expect.code);
    }
  });
}

test("every denial reason in the registry is exercised by a vector", () => {
  const exercised = new Set(
    vectors.filter((v) => v.expect.reason).map((v) => v.expect.reason),
  );
  // tool_not_admitted is tool authorization, covered separately below.
  const expected = Object.keys(DENIAL_REASONS).filter(
    (r) => r !== "tool_not_admitted",
  );
  for (const reason of expected) {
    assert.ok(exercised.has(reason), `no vector covers "${reason}"`);
  }
});

test("rules are evaluated in order, so the first failure is the one reported", () => {
  // A document that fails rules 1, 2 and 3 at once reports rule 1.
  const result = verifyAttestation(
    {
      v: "1.0",
      id: "x",
      publisher: "p",
      version: "1",
      clearance: "internal",
      capabilities: [],
      signerKeyId: undefined,
    },
    trustRoot,
    {
      origin: "https://tools.example.com",
      requiredClearance: "internal",
      now: new Date("2026-06-01T12:00:00Z"),
    },
  );
  assert.equal(result.admitted, false);
  assert.equal(result.admitted === false && result.reason, "not_mcp_server");
});

test("admission does not authorize tools", () => {
  const allowList = ["get_forecast", "list_stations"];
  assert.equal(authorizeTool("get_forecast", allowList).admitted, true);

  const denied = authorizeTool("delete_everything", allowList);
  assert.equal(denied.admitted, false);
  assert.equal(denied.admitted === false && denied.reason, "tool_not_admitted");
  assert.equal(denied.admitted === false && denied.code, 9);
});

test("an empty allow-list admits no tools", () => {
  assert.equal(authorizeTool("anything", []).admitted, false);
});

test("clearance aliases resolve to their canonical rank", () => {
  assert.equal(rankOf(trustRoot.scheme, "confidential"), 20);
  assert.equal(rankOf(trustRoot.scheme, "conf"), 20);
  assert.equal(rankOf(trustRoot.scheme, "unclassified"), 0);
  assert.equal(rankOf(trustRoot.scheme, "nonexistent"), undefined);
});

test("origin binding compares scheme, host and port, not path or case", () => {
  const withHosts = (hosts: string[]) => {
    const vector = vectors.find(
      (v) => v.name === "admits-when-origin-is-bound",
    )!;
    return {
      ...(vector.sad as ServerAttestationDocument),
      netAllowedHosts: hosts,
    };
  };
  const at = (origin: string, hosts: string[]) =>
    verifyAttestation(withHosts(hosts), trustRoot, {
      origin,
      requiredClearance: "internal",
      now: new Date("2026-06-01T12:00:00Z"),
    });

  // Case and trailing path do not matter; the signature covers sorted members.
  assert.equal(
    at("https://TOOLS.example.com", [
      "https://tools.example.com",
      "https://backup.example.com",
    ]).admitted,
    true,
  );
  // A different port is a different origin.
  assert.equal(
    at("https://tools.example.com:8443", [
      "https://tools.example.com",
      "https://backup.example.com",
    ]).admitted,
    false,
  );
  // So is a different scheme.
  assert.equal(
    at("http://tools.example.com", [
      "https://tools.example.com",
      "https://backup.example.com",
    ]).admitted,
    false,
  );
});

test("an absent document is a denial rather than a crash", () => {
  for (const input of [null, undefined]) {
    const result = verifyAttestation(input, trustRoot, {
      origin: "https://tools.example.com",
      requiredClearance: "internal",
    });
    assert.equal(result.admitted, false);
  }
});
