import { test } from "node:test";
import assert from "node:assert/strict";
import { canonicalBody } from "../src/canonicalize";
import {
  ATSA_VERSION,
  SAD_MAJOR_VERSION,
  SAD_VERSION,
  type ServerAttestationDocument,
} from "../src/types";

const sad = (
  overrides: Partial<ServerAttestationDocument> = {},
): ServerAttestationDocument => ({
  v: "1.0",
  id: "urn:omcp:server:weather",
  publisher: "Example Tools Ltd",
  version: "2.3.1",
  clearance: "internal",
  capabilities: ["mcp-server"],
  signerKeyId: "key-prod-2026",
  ...overrides,
});

const body = (doc: ServerAttestationDocument) =>
  canonicalBody(doc).toString("utf8");

test("object keys are sorted, whatever order they were written in", () => {
  const a = canonicalBody(sad());
  const reordered: ServerAttestationDocument = {
    capabilities: ["mcp-server"],
    signerKeyId: "key-prod-2026",
    version: "2.3.1",
    v: "1.0",
    clearance: "internal",
    publisher: "Example Tools Ltd",
    id: "urn:omcp:server:weather",
  };
  assert.deepEqual(a, canonicalBody(reordered));
  assert.match(body(sad()), /^\{"capabilities":/);
});

test("array members are sorted, so membership is signed rather than order", () => {
  const one = canonicalBody(
    sad({
      netAllowedHosts: ["https://b.example.com", "https://a.example.com"],
    }),
  );
  const two = canonicalBody(
    sad({
      netAllowedHosts: ["https://a.example.com", "https://b.example.com"],
    }),
  );
  assert.deepEqual(one, two);
});

test("the signature field is never part of the body it signs", () => {
  const unsigned = canonicalBody(sad());
  const signedLater = canonicalBody(sad({ signature: "AAAA" }));
  assert.deepEqual(unsigned, signedLater);
});

test("an absent signerKeyId is serialized as null, not omitted", () => {
  assert.match(body(sad({ signerKeyId: undefined })), /"signerKeyId":null/);
});

test("unknown fields are excluded, so they cannot carry signed content", () => {
  const plain = canonicalBody(sad());
  const withExtra = canonicalBody({
    ...sad(),
    attacker: "payload",
    nested: { deep: [1, 2] },
  });
  assert.deepEqual(plain, withExtra);
});

test("absent optional fields are omitted rather than nulled", () => {
  const text = body(sad());
  assert.doesNotMatch(text, /netAllowedHosts/);
  assert.doesNotMatch(text, /verification/);
});

test("present optional fields are included", () => {
  assert.match(
    body(sad({ verification: "tested" })),
    /"verification":"tested"/,
  );
});

test("the body is deterministic across repeated serialization", () => {
  const doc = sad({
    netAllowedHosts: ["https://b.example.com", "https://a.example.com"],
    verification: "tested",
  });
  assert.equal(body(doc), body(doc));
  assert.equal(body(doc), body(JSON.parse(JSON.stringify(doc))));
});

test("non-finite numbers are rejected rather than silently serialized", () => {
  // A malformed document can carry anything at runtime, whatever the types say.
  const malformed = sad({ v: Number.POSITIVE_INFINITY as unknown as string });
  assert.throws(() => canonicalBody(malformed), TypeError);
});

test("the extension version and the document version are kept distinct", () => {
  // Conflating these would change the wire format whenever the extension is revised.
  assert.equal(ATSA_VERSION, "1.0");
  assert.equal(SAD_VERSION, "1.0");
  assert.equal(SAD_MAJOR_VERSION, 1);
});
