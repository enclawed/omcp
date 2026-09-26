import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";

const SCHEMA = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "..", "schema", "attestation.schema.json"),
    "utf8",
  ),
);
const VECTORS = path.join(__dirname, "vectors");

const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
const validate = ajv.compile(SCHEMA);

const vectors = fs
  .readdirSync(VECTORS)
  .filter((f) => f.endsWith(".json") && !f.startsWith("_"))
  .sort()
  .map((f) => ({
    file: f,
    ...JSON.parse(fs.readFileSync(path.join(VECTORS, f), "utf8")),
  }));

test("the schema itself compiles", () => {
  assert.equal(typeof validate, "function");
});

test("every document a verifier admits is schema-valid", () => {
  for (const vector of vectors.filter((v) => v.expect.admitted)) {
    assert.ok(
      validate(vector.sad),
      `${vector.file}: ${ajv.errorsText(validate.errors)}`,
    );
  }
});

test("the schema rejects a document missing a required field", () => {
  assert.equal(
    validate({
      v: 1,
      id: "x",
      publisher: "p",
      version: "1",
      clearance: "internal",
    }),
    false,
  );
});

test("the schema rejects capabilities without mcp-server", () => {
  const sad = {
    v: 1,
    id: "x",
    publisher: "p",
    version: "1",
    clearance: "internal",
    capabilities: ["other"],
  };
  assert.equal(validate(sad), false);
});

test("the schema rejects an unsupported major version", () => {
  const vector = vectors.find(
    (v) => v.name === "rejects-unsupported-major-version",
  )!;
  assert.equal(validate(vector.sad), false);
});

test("the schema permits unknown fields, which the canonical body then ignores", () => {
  const vector = vectors.find((v) => v.name === "ignores-unknown-fields")!;
  assert.ok(validate(vector.sad), ajv.errorsText(validate.errors));
});
