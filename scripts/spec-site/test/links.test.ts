import { test } from "node:test";
import assert from "node:assert/strict";
import {
  relativize,
  resolveAsset,
  resolveLink,
  type LinkSource,
  type LinkTargets,
} from "../links";

const targets: LinkTargets = {
  versions: new Map([
    [
      "2025-01-01",
      new Map([
        ["specification/2025-01-01/index", "overview"],
        ["specification/2025-01-01/basic/index", "basic"],
        ["specification/2025-01-01/basic/lifecycle", "basic-lifecycle"],
        ["specification/2025-01-01/schema", "schema"],
      ]),
    ],
    [
      "draft",
      new Map([
        ["specification/draft/index", "overview"],
        ["specification/draft/basic/index", "basic"],
      ]),
    ],
  ]),
  latest: "2025-01-01",
  proposals: new Map([
    ["999-early-proposal", "999"],
    ["1000-first-proposal", "1000"],
  ]),
  repoFileExists: (p) =>
    ["docs/community/contributing.mdx", "schema/2025-01-01/schema.ts"].includes(
      p,
    ),
  siteHost: "openmodelcontextprotocol.org",
  repoBlobUrl: "https://github.com/enclawed/omcp/blob/main",
};

const page: LinkSource = {
  file: "2025-01-01/index.html",
  route: "specification/2025-01-01/basic/lifecycle",
};
const resolve = (href: string, from: LinkSource = page) =>
  resolveLink(href, from, targets);

test("links within the same version become fragments of the version document", () => {
  assert.equal(
    resolve("/specification/2025-01-01/basic/lifecycle"),
    "#basic-lifecycle",
  );
  assert.equal(
    resolve("/specification/2025-01-01/basic/index#messages"),
    "#basic--messages",
  );
  assert.equal(
    resolve("/specification/2025-01-01/basic#messages"),
    "#basic--messages",
  );
  assert.equal(
    resolve("/specification/2025-01-01/schema#calltoolrequest"),
    "#schema--calltoolrequest",
  );
});

test("relative links resolve against the source file's directory", () => {
  assert.equal(resolve("./index#messages"), "#basic--messages");
  assert.equal(
    resolve("../schema#calltoolrequest"),
    "#schema--calltoolrequest",
  );
  assert.equal(resolve("../index"), "#overview");
});

test("links to another version point at that version's document", () => {
  assert.equal(
    resolve("/specification/draft/basic"),
    "../draft/index.html#basic",
  );
  assert.equal(resolve("/specification/draft"), "../draft/index.html#overview");
});

test("'latest' and bare 'specification' mean the latest version", () => {
  assert.equal(resolve("/specification/latest"), "#overview");
  assert.equal(resolve("/specification"), "#overview");
  assert.equal(
    resolve("/specification/latest/basic#messages"),
    "#basic--messages",
  );
});

test("absolute URLs on the site's own host are treated as internal", () => {
  assert.equal(
    resolve("https://openmodelcontextprotocol.org/specification/draft/basic"),
    "../draft/index.html#basic",
  );
  assert.equal(
    resolve(
      "https://www.openmodelcontextprotocol.org/specification/2025-01-01",
    ),
    "#overview",
  );
});

test("a page missing from a built version lands on that version's document", () => {
  assert.equal(
    resolve("/specification/draft/server/tools#x"),
    "../draft/index.html",
  );
});

test("proposal links go to proposal pages, or into the combined document", () => {
  assert.equal(
    resolve("/seps/1000-first-proposal"),
    "../seps/1000-first-proposal.html",
  );
  assert.equal(
    resolve("/seps/1000-first-proposal#abstract"),
    "../seps/1000-first-proposal.html#abstract",
  );
  assert.equal(resolve("/seps"), "../seps/index.html");

  const proposal: LinkSource = {
    file: "seps/1000-first-proposal.html",
    route: "seps/1000-first-proposal",
  };
  assert.equal(
    resolve("./999-early-proposal.md#abstract", proposal),
    "999-early-proposal.html#abstract",
  );

  const combined: LinkSource = {
    ...proposal,
    file: "seps/all.html",
    proposalsInline: true,
  };
  assert.equal(
    resolve("./999-early-proposal.md#abstract", combined),
    "#sep-999--abstract",
  );
  assert.equal(resolve("/seps/999-early-proposal", combined), "#sep-999");
});

test("other repository content links to its source on GitHub", () => {
  assert.equal(
    resolve("/community/contributing"),
    "https://github.com/enclawed/omcp/blob/main/docs/community/contributing.mdx",
  );
  assert.equal(
    resolve("https://openmodelcontextprotocol.org/community/contributing#bar"),
    "https://github.com/enclawed/omcp/blob/main/docs/community/contributing.mdx#bar",
  );
  const proposal: LinkSource = {
    file: "seps/x.html",
    route: "seps/1000-first-proposal",
  };
  assert.equal(
    resolve("../schema/2025-01-01/schema.ts", proposal),
    "https://github.com/enclawed/omcp/blob/main/schema/2025-01-01/schema.ts",
  );
});

test("unknown site paths stay on the site's host", () => {
  assert.equal(
    resolve("/does/not/exist#x"),
    "https://openmodelcontextprotocol.org/does/not/exist#x",
  );
});

test("external, fragment, and protocol-relative links are left alone", () => {
  for (const href of [
    "https://modelcontextprotocol.io/community/governance",
    "https://datatracker.ietf.org/doc/html/rfc2119",
    "mailto:security@example.com",
    "#local",
    "//cdn.example.com/x.js",
    "",
  ]) {
    assert.equal(resolve(href), href);
  }
});

test("relativize expresses site paths relative to the linking file", () => {
  assert.equal(
    relativize("2025-01-01/index.html", "2025-01-01/index.html#a"),
    "#a",
  );
  assert.equal(
    relativize("2025-01-01/index.html", "2025-01-01/index.html"),
    "index.html",
  );
  assert.equal(
    relativize("index.html", "draft/index.html"),
    "draft/index.html",
  );
  assert.equal(
    relativize("seps/a.html", "draft/index.html#x"),
    "../draft/index.html#x",
  );
});

test("resolveAsset locates images in the repository and names their published path", () => {
  const exists = (p: string) =>
    [
      "docs/specification/2025-01-01/basic/diagram.svg",
      "seps/img/flow.png",
    ].includes(p);
  const expected = {
    repoPath: "docs/specification/2025-01-01/basic/diagram.svg",
    sitePath: "media/docs/specification/2025-01-01/basic/diagram.svg",
  };
  assert.deepEqual(
    resolveAsset("/specification/2025-01-01/basic/diagram.svg", page, exists),
    expected,
  );
  assert.deepEqual(resolveAsset("./diagram.svg", page, exists), expected);
  assert.deepEqual(
    resolveAsset(
      "./img/flow.png",
      { file: "seps/x.html", route: "seps/x" },
      exists,
    ),
    { repoPath: "seps/img/flow.png", sitePath: "media/seps/img/flow.png" },
  );
});

test("resolveAsset leaves external and missing images to the caller", () => {
  const exists = () => true;
  assert.equal(resolveAsset("https://example.com/x.png", page, exists), null);
  assert.equal(resolveAsset("data:image/png;base64,AAAA", page, exists), null);
  assert.equal(resolveAsset("//cdn.example.com/x.png", page, exists), null);
  assert.equal(
    resolveAsset("./missing.png", page, () => false),
    null,
  );
  assert.equal(resolveAsset("../../../../../etc/passwd", page, exists), null);
});
