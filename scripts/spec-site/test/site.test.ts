import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { buildSite, type BuildOptions } from "../site";
import { checkLinks } from "../linkcheck";

const ROOT = path.join(__dirname, "fixtures", "repo");

function tempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "spec-site-test-"));
}

function options(
  outDir: string,
  overrides: Partial<BuildOptions> = {},
): BuildOptions {
  return {
    root: ROOT,
    outDir,
    siteHost: "openmodelcontextprotocol.org",
    repoUrl: "https://github.com/enclawed/omcp",
    revision: {
      commit: "0123456789abcdef0123456789abcdef01234567",
      date: "2025-01-02T03:04:05Z",
    },
    renderDiagrams: async (diagrams) => ({
      svgs: new Map(
        diagrams.map((d) => [d.hash, `<svg data-diagram="${d.hash}"></svg>`]),
      ),
      failures: [],
    }),
    printPdfs: async (jobs) => {
      for (const job of jobs)
        fs.writeFileSync(job.pdf, `%PDF-stub ${job.title}`);
    },
    ...overrides,
  };
}

const read = (dir: string, rel: string) =>
  fs.readFileSync(path.join(dir, rel), "utf8");

test("builds every document, asset, schema copy, and PDF", async () => {
  const out = path.join(tempDir(), "site");
  const result = await buildSite(options(out));

  for (const file of [
    "index.html",
    "2025-01-01/index.html",
    "draft/index.html",
    "seps/index.html",
    "seps/all.html",
    "seps/999-early-proposal.html",
    "seps/1000-first-proposal.html",
    "assets/style.css",
    "2025-01-01/schema.json",
    "2025-01-01/schema.ts",
    "manifest.json",
    ".nojekyll",
    "pdf/omcp-specification-2025-01-01.pdf",
    "pdf/omcp-specification-draft.pdf",
    "pdf/omcp-proposals.pdf",
  ]) {
    assert.ok(fs.existsSync(path.join(out, file)), `missing ${file}`);
  }
  assert.deepEqual(result.stats, {
    versions: 2,
    pages: 6,
    proposals: 2,
    diagrams: 2,
  });
  assert.equal(result.pdfs.length, 3);
});

test("produces no warnings and no broken links on clean input", async () => {
  const out = path.join(tempDir(), "site");
  const result = await buildSite(options(out));
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(result.brokenLinks, []);
});

test("numbers sections after docs.json and resolves links inside the document", async () => {
  const out = path.join(tempDir(), "site");
  await buildSite(options(out));
  const doc = read(out, "2025-01-01/index.html");

  assert.match(
    doc,
    /<section class="spec-group" id="group-base-protocol">\n<h2><span class="num">2<\/span> Base Protocol<\/h2>/,
  );
  assert.match(
    doc,
    /<section class="spec-page" id="basic-lifecycle">\n<h3><span class="num">2\.2<\/span> Lifecycle<\/h3>/,
  );
  assert.match(doc, /href="#basic-lifecycle"/);
  assert.match(doc, /href="#basic--meta"/);
  assert.match(doc, /href="\.\.\/draft\/index\.html#basic"/);
  assert.match(doc, /href="\.\.\/seps\/1000-first-proposal\.html"/);
  assert.match(
    doc,
    /href="https:\/\/github\.com\/enclawed\/omcp\/blob\/main\/docs\/community\/contributing\.mdx"/,
  );
  assert.match(
    doc,
    /href="https:\/\/modelcontextprotocol\.io\/community\/governance"/,
  );
});

test("publishes images next to the documents that reference them", async () => {
  const out = path.join(tempDir(), "site");
  await buildSite(options(out));
  const published = "media/docs/specification/2025-01-01/basic/diagram.svg";
  assert.ok(fs.existsSync(path.join(out, published)));
  const doc = read(out, "2025-01-01/index.html");
  assert.equal(
    doc.split(`src="../${published}"`).length - 1,
    2,
    "absolute and relative references",
  );
  assert.match(
    read(out, "seps/1000-first-proposal.html"),
    /src="https:\/\/example\.com\/external\.png"/,
  );
});

test("substitutes rendered diagrams, and falls back to their source when rendering fails", async () => {
  const out = path.join(tempDir(), "site");
  await buildSite(options(out));
  assert.match(
    read(out, "2025-01-01/index.html"),
    /<figure class="diagram"><svg data-diagram="[0-9a-f]{16}"><\/svg><\/figure>/,
  );

  const fallback = path.join(tempDir(), "site");
  const result = await buildSite(
    options(fallback, {
      renderDiagrams: async (diagrams) => ({
        svgs: new Map(),
        failures: diagrams.map((d) => `diagram ${d.hash}: boom`),
      }),
    }),
  );
  assert.match(
    read(fallback, "2025-01-01/index.html"),
    /<pre class="diagram-source"><code>sequenceDiagram/,
  );
  assert.equal(result.warnings.length, 2);
});

test("stamps every document with its source commit", async () => {
  const out = path.join(tempDir(), "site");
  await buildSite(options(out));
  for (const file of [
    "index.html",
    "2025-01-01/index.html",
    "seps/1000-first-proposal.html",
  ]) {
    assert.match(
      read(out, file),
      /commit\/0123456789abcdef0123456789abcdef01234567"><code>0123456<\/code>/,
    );
  }
  const manifest = JSON.parse(read(out, "manifest.json"));
  assert.equal(manifest.commit, "0123456789abcdef0123456789abcdef01234567");
  assert.equal(
    manifest.versions[0].pdf,
    "pdf/omcp-specification-2025-01-01.pdf",
  );
});

test("builds identical output from identical input", async () => {
  const a = path.join(tempDir(), "site");
  const b = path.join(tempDir(), "site");
  const first = await buildSite(options(a));
  await buildSite(options(b));
  for (const file of first.files) {
    assert.ok(
      fs
        .readFileSync(path.join(a, file))
        .equals(fs.readFileSync(path.join(b, file))),
      `${file} differs`,
    );
  }
});

test("without a PDF printer, skips PDFs and does not report their links as broken", async () => {
  const out = path.join(tempDir(), "site");
  const result = await buildSite(options(out, { printPdfs: undefined }));
  assert.equal(result.pdfs.length, 0);
  assert.equal(fs.existsSync(path.join(out, "pdf")), false);
  assert.deepEqual(result.brokenLinks, []);
  assert.equal(JSON.parse(read(out, "manifest.json")).versions[0].pdf, null);
});

test("can build a subset of versions, and rejects unknown ones", async () => {
  const out = path.join(tempDir(), "site");
  const result = await buildSite(options(out, { versions: ["draft"] }));
  assert.equal(result.stats.versions, 1);
  assert.ok(fs.existsSync(path.join(out, "draft/index.html")));
  assert.ok(!fs.existsSync(path.join(out, "2025-01-01/index.html")));

  await assert.rejects(
    buildSite(
      options(path.join(tempDir(), "site"), { versions: ["1999-01-01"] }),
    ),
    /unknown specification version/,
  );
});

test("rebuilds over a previous build", async () => {
  const out = path.join(tempDir(), "site");
  await buildSite(options(out));
  fs.writeFileSync(path.join(out, "stale.html"), "stale");
  await buildSite(options(out));
  assert.ok(!fs.existsSync(path.join(out, "stale.html")));
});

test("refuses to delete a directory that is not a previous build", async () => {
  const out = tempDir();
  fs.writeFileSync(path.join(out, "precious.txt"), "keep me");
  await assert.rejects(buildSite(options(out)), /refusing to overwrite/);
  assert.equal(
    fs.readFileSync(path.join(out, "precious.txt"), "utf8"),
    "keep me",
  );

  await assert.rejects(buildSite(options(ROOT)), /contains the repository/);
  await assert.rejects(
    buildSite(options(path.dirname(ROOT))),
    /contains the repository/,
  );
});

test("fails loudly when a brand asset every page references is missing", async () => {
  const repo = path.join(tempDir(), "repo");
  fs.cpSync(ROOT, repo, { recursive: true });
  fs.rmSync(path.join(repo, "docs", "favicon.svg"));
  await assert.rejects(
    buildSite({ ...options(path.join(tempDir(), "site")), root: repo }),
    /missing brand asset\(s\) every page references: docs\/favicon\.svg/,
  );
});

test("link checker reports missing files and missing anchors", () => {
  const dir = tempDir();
  fs.writeFileSync(
    path.join(dir, "a.html"),
    '<p id="here"></p><a href="b.html#nope"></a><a href="gone.html"></a><a href="#here"></a>' +
      '<a href="pdf/x.pdf"></a><a href="https://x.test/"></a><img src="missing.svg">' +
      '<picture><source srcset="b.html 1x, lost.svg 2x"></picture>',
  );
  fs.writeFileSync(path.join(dir, "b.html"), '<p id="there"></p>');
  const broken = checkLinks(dir, ["a.html", "b.html"], (target) =>
    target.startsWith("pdf/"),
  );
  assert.deepEqual(broken, [
    { file: "a.html", href: "b.html#nope", reason: "missing anchor" },
    { file: "a.html", href: "gone.html", reason: "missing file" },
    { file: "a.html", href: "missing.svg", reason: "missing file" },
    { file: "a.html", href: "lost.svg", reason: "missing file" },
  ]);
});
