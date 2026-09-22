import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  diagramHash,
  diagramPlaceholder,
  renderMarkdown,
  splitFrontmatter,
} from "../markdown";

const SPEC = path.join(
  __dirname,
  "fixtures",
  "repo",
  "docs",
  "specification",
  "2025-01-01",
);
const fixture = (name: string) =>
  fs.readFileSync(path.join(SPEC, name), "utf8");

test("splitFrontmatter separates YAML from the body", () => {
  const { data, body } = splitFrontmatter("---\ntitle: Hello\n---\n\nBody\n");
  assert.deepEqual(data, { title: "Hello" });
  assert.equal(body.trim(), "Body");
  assert.deepEqual(splitFrontmatter("No frontmatter").data, {});
});

test("renders callouts and cards, and drops MDX comments silently", () => {
  const out = renderMarkdown(fixture("index.mdx"), { format: "mdx" });
  assert.equal(out.frontmatter.title, "Specification");
  assert.equal(out.frontmatter.description, "The fixture protocol.");
  assert.match(
    out.html,
    /<aside class="callout callout-note"><p class="callout-label">Note<\/p>/,
  );
  assert.match(out.html, /<aside class="callout callout-warning">/);
  assert.match(out.html, /<div class="card-group">/);
  assert.match(
    out.html,
    /<p class="card-title"><a href="\.\/basic\/lifecycle">Lifecycle<\/a><\/p>/,
  );
  assert.doesNotMatch(out.html, /MDX comment/);
  assert.deepEqual(out.warnings, []);
});

test("renders GitHub-flavored tables", () => {
  const out = renderMarkdown(fixture("basic/index.mdx"), { format: "mdx" });
  assert.match(out.html, /<table>/);
  assert.match(out.html, /<td><code>jsonrpc<\/code><\/td>/);
});

test("prefixes ids and in-page links, and offsets heading levels", () => {
  const out = renderMarkdown(fixture("index.mdx"), {
    format: "mdx",
    idPrefix: "overview",
    headingOffset: 1,
  });
  assert.match(out.html, /<h3 id="overview--links">Links<\/h3>/);
  assert.match(out.html, /<a href="#overview--links">links<\/a>/);
  assert.deepEqual(out.headings, [
    { depth: 2, id: "overview--links", text: "Links" },
  ]);
});

test("adds alias anchors that existing links rely on, without shadowing real ids", () => {
  const out = renderMarkdown(fixture("basic/index.mdx"), {
    format: "mdx",
    idPrefix: "basic",
  });
  assert.match(
    out.html,
    /<h3 id="basic--_meta"><span id="basic--meta" class="anchor-alias"><\/span>/,
  );
  assert.match(
    out.html,
    /<h3 id="basic--tasksget"><span id="basic--tasks\/get" class="anchor-alias"><\/span>/,
  );

  const clash = renderMarkdown("## `_meta`\n\n## Meta\n", { format: "mdx" });
  assert.match(clash.html, /<h2 id="meta">Meta<\/h2>/);
  assert.doesNotMatch(clash.html, /<span id="meta"/);
});

test("passes every non-fragment link through resolveLink", () => {
  const seen: string[] = [];
  renderMarkdown(fixture("index.mdx"), {
    format: "mdx",
    resolveLink: (href) => {
      seen.push(href);
      return href;
    },
  });
  assert.ok(seen.includes("/specification/2025-01-01/basic/lifecycle"));
  assert.ok(seen.includes("./basic/lifecycle"));
  assert.ok(seen.includes("/seps/1000-first-proposal"));
  assert.ok(!seen.includes("#links"), "fragment links are handled locally");
});

test("turns mermaid blocks into placeholders and reports them", () => {
  const out = renderMarkdown(fixture("basic/lifecycle.mdx"), { format: "mdx" });
  assert.equal(out.diagrams.length, 1);
  const [diagram] = out.diagrams;
  assert.match(diagram.code, /^sequenceDiagram/);
  assert.equal(diagram.hash, diagramHash(diagram.code));
  assert.ok(out.html.includes(diagramPlaceholder(diagram.hash)));
});

test("highlights code without warnings", () => {
  const out = renderMarkdown(fixture("basic/lifecycle.mdx"), { format: "mdx" });
  assert.match(out.html, /<code class="hljs language-json">/);
  assert.deepEqual(out.warnings, []);
});

test("renders typedoc markup: keeps classes and ids, strips unpublished icons", () => {
  const out = renderMarkdown(fixture("schema.mdx"), {
    format: "mdx",
    idPrefix: "schema",
  });
  assert.match(out.html, /<div class="tsd-signature">/);
  assert.match(out.html, /id="schema--calltoolrequest-method"/);
  assert.match(out.html, /href="#schema--calltoolrequest-method"/);
  assert.match(out.html, /<h3 id="schema--calltoolrequest">/);
  assert.doesNotMatch(out.html, /tsd-anchor-icon|icons\.svg/);
});

test("warns about components and expressions it cannot render faithfully", () => {
  const out = renderMarkdown("<Accordion>Body</Accordion>\n\n{1 + 1}\n", {
    format: "mdx",
  });
  assert.match(out.html, /<div class="component component-accordion">/);
  assert.equal(out.warnings.length, 2);
  assert.match(out.warnings[0], /unsupported component <Accordion>/);
  assert.match(out.warnings[1], /dropped MDX expression/);
});

test("proposal mode drops the title heading and keeps raw HTML", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "fixtures", "repo", "seps", "1000-first-proposal.md"),
    "utf8",
  );
  const out = renderMarkdown(source, { format: "md", dropFirstH1: true });
  assert.doesNotMatch(out.html, /<h1/);
  assert.match(out.html, /<h2 id="abstract">Abstract<\/h2>/);
  assert.match(
    out.html,
    /<details><summary>Raw HTML is allowed in proposals<\/summary>/,
  );
});

test("passes every image through resolveAsset", () => {
  const out = renderMarkdown('![a](/x.png)\n\n<img src="y.svg" />\n', {
    format: "mdx",
    resolveAsset: (src) => `published/${src}`,
  });
  assert.match(out.html, /<img src="published\/\/x\.png" alt="a">/);
  assert.match(out.html, /<img src="published\/y\.svg">/);
});
