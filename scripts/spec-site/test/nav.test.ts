import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { pageAnchor, readSpecVersions, routes } from "../nav";

const docsJson = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "fixtures", "repo", "docs", "docs.json"),
    "utf8",
  ),
);

test("reads every specification version from docs.json in order", () => {
  const versions = readSpecVersions(docsJson);
  assert.deepEqual(
    versions.map((v) => ({ id: v.id, latest: v.latest, draft: v.draft })),
    [
      { id: "2025-01-01", latest: true, draft: false },
      { id: "draft", latest: false, draft: true },
    ],
  );
});

test("keeps navigation groups and page order", () => {
  const [released] = readSpecVersions(docsJson);
  assert.equal(released.nav[1].kind, "group");
  assert.deepEqual(routes(released.nav), [
    "specification/2025-01-01/index",
    "specification/2025-01-01/basic/index",
    "specification/2025-01-01/basic/lifecycle",
    "specification/2025-01-01/schema",
  ]);
});

test("rejects docs.json without a Specification tab", () => {
  assert.throws(
    () =>
      readSpecVersions({ navigation: { tabs: [{ tab: "Documentation" }] } }),
    /Specification/,
  );
});

test("rejects navigation entries it does not understand", () => {
  const bad = {
    navigation: {
      tabs: [
        {
          tab: "Specification",
          versions: [{ version: "X", pages: [{ href: "x" }] }],
        },
      ],
    },
  };
  assert.throws(() => readSpecVersions(bad), /unsupported navigation entry/);
});

test("pageAnchor derives a stable section id from a route", () => {
  assert.equal(pageAnchor("specification/draft/index"), "overview");
  assert.equal(pageAnchor("specification/draft/basic/index"), "basic");
  assert.equal(
    pageAnchor("specification/draft/basic/transports/index"),
    "basic-transports",
  );
  assert.equal(
    pageAnchor("specification/draft/basic/transports/stdio"),
    "basic-transports-stdio",
  );
  assert.equal(pageAnchor("specification/2025-01-01/schema"), "schema");
});
