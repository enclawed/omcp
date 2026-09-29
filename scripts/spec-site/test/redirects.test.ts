import { test } from "node:test";
import assert from "node:assert/strict";
import { redirectPage, sectionRedirects } from "../redirects";
import type { SpecVersion } from "../nav";

const version = (id: string, latest: boolean): SpecVersion => ({
  id,
  label: `Version ${id}`,
  latest,
  draft: id === "draft",
  nav: [
    { kind: "page", route: `specification/${id}/index` },
    {
      kind: "group",
      title: "Server",
      children: [
        { kind: "page", route: `specification/${id}/server/tools` },
        { kind: "page", route: `specification/${id}/server/index` },
      ],
    },
  ],
});

const VERSIONS = [version("2025-06-18", true), version("draft", false)];
const byFile = (rs: { file: string; target: string }[]) =>
  new Map(rs.map((r) => [r.file, r.target]));

test("every specification page route gets a stub pointing at its section", () => {
  const files = byFile(sectionRedirects(VERSIONS, "2025-06-18"));
  assert.equal(
    files.get("specification/2025-06-18/server/tools.html"),
    "../../../2025-06-18/index.html#server-tools",
  );
  assert.equal(
    files.get("specification/draft/server/tools.html"),
    "../../../draft/index.html#server-tools",
  );
});

test("an index route lands on the section, not the document top", () => {
  const files = byFile(sectionRedirects(VERSIONS, "2025-06-18"));
  // "specification/<v>/server/index" is the Server overview, anchored as
  // "server" — a reader following it should not be dropped at the very top of
  // a document that is hundreds of sections long.
  assert.equal(
    files.get("specification/draft/server/index.html"),
    "../../../draft/index.html#server",
  );
  assert.equal(
    files.get("specification/draft/index.html"),
    "../../draft/index.html#overview",
  );
});

test("latest is an alias for the default version", () => {
  const files = byFile(sectionRedirects(VERSIONS, "2025-06-18"));
  assert.equal(
    files.get("specification/latest/server/tools.html"),
    "../../../2025-06-18/index.html#server-tools",
  );
  assert.equal(
    files.get("specification/latest/index.html"),
    "../../2025-06-18/index.html#overview",
  );
  // The draft is never aliased as latest.
  assert.equal(files.has("specification/latest/basic.html"), false);
});

test("no file is emitted twice", () => {
  const redirects = sectionRedirects(VERSIONS, "2025-06-18");
  const seen = new Set(redirects.map((r) => r.file));
  assert.equal(seen.size, redirects.length);
});

test("the stub forwards without script and carries a fragment with it", () => {
  const html = redirectPage("../../2025-06-18/index.html#server-tools");
  // No-script path.
  assert.match(
    html,
    /<meta http-equiv="refresh" content="0; url=\.\.\/\.\.\/2025-06-18\/index\.html#server-tools">/,
  );
  // A visible link, so the page works even if neither refresh nor script runs.
  assert.match(html, /<a href="[^"]*#server-tools">/);
  // The script exists only to do what a static redirect cannot: nest the
  // incoming fragment under the section anchor.
  assert.match(html, /location\.hash\.slice\(1\)/);
  assert.match(html, /to \+ "--" \+ extra/);
  // Stubs are not content and should not compete with the document in search.
  assert.match(html, /<meta name="robots" content="noindex">/);
});

test("the stub's target is escaped where it is interpolated", () => {
  const html = redirectPage('../x.html#a"onload="alert(1)');
  assert.doesNotMatch(html, /"onload="/);
  assert.match(html, /&quot;onload=/);
});
