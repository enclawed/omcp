import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { readProposals, statusKey } from "../proposals";

const SEPS = path.join(__dirname, "fixtures", "repo", "seps");
const files = fs
  .readdirSync(SEPS)
  .sort()
  .map((name) => ({
    name,
    content: fs.readFileSync(path.join(SEPS, name), "utf8"),
  }));

test("reads proposals and skips the README, template, and 0000 placeholders", () => {
  const proposals = readProposals(files);
  assert.deepEqual(
    proposals.map((p) => p.name),
    ["999-early-proposal", "1000-first-proposal"],
  );
});

test("orders proposals numerically, not lexically", () => {
  // Lexically "1000-..." sorts before "999-...".
  assert.deepEqual(
    readProposals(files).map((p) => p.meta.number),
    ["999", "1000"],
  );
});

test("parses proposal metadata", () => {
  const [, first] = readProposals(files);
  assert.equal(first.meta.title, "First Proposal");
  assert.equal(first.meta.status, "In-Review");
  assert.equal(first.meta.type, "Standards Track");
  assert.equal(first.route, "seps/1000-first-proposal");
});

test("statusKey produces CSS-safe keys", () => {
  assert.equal(statusKey("In-Review"), "in-review");
  assert.equal(statusKey("Final"), "final");
  assert.equal(statusKey("  "), "unknown");
});
