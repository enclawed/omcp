import { test } from "node:test";
import assert from "node:assert/strict";
import { Slugger, headingAliases, slugify } from "../slug";

test("slugify lowercases, drops punctuation, and hyphenates spaces", () => {
  assert.equal(slugify("Version Negotiation"), "version-negotiation");
  assert.equal(slugify("CallToolRequest"), "calltoolrequest");
  assert.equal(slugify("tasks/get"), "tasksget");
  assert.equal(slugify("_meta"), "_meta");
  assert.equal(slugify("Tool Result (Structured)"), "tool-result-structured");
});

test("Slugger suffixes repeated headings like github-slugger", () => {
  const slugger = new Slugger();
  assert.equal(slugger.slug("Example"), "example");
  assert.equal(slugger.slug("Example"), "example-1");
  assert.equal(slugger.slug("Example"), "example-2");
  assert.equal(slugger.slug("Other"), "other");
});

test("Slugger never returns an empty id", () => {
  assert.equal(new Slugger().slug("!!!"), "section");
});

test("headingAliases covers the anchors existing links use", () => {
  assert.deepEqual(headingAliases("_meta", "_meta"), ["meta"]);
  assert.deepEqual(headingAliases("tasksget", "tasks/get"), ["tasks/get"]);
  assert.deepEqual(headingAliases("https", "https://"), ["https://"]);
});

test("headingAliases adds nothing for ordinary headings", () => {
  assert.deepEqual(
    headingAliases("version-negotiation", "Version Negotiation"),
    [],
  );
  assert.deepEqual(
    headingAliases("tool-result-structured", "Tool Result (Structured)"),
    [],
  );
});
