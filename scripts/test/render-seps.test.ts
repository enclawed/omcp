/**
 * The rendered SEP pages are what the site publishes, so what the renderer
 * silently drops is what readers never see.
 *
 * Two defects this guards against, both of which shipped:
 *   - everything between the metadata bullets and `## Abstract` was discarded,
 *     which is exactly where an imported proposal records whose work it is,
 *     where it came from, and which copy of the text is normative;
 *   - an author handle that was already a markdown link got linked a second
 *     time, rendering as `[[@name](url)](url)` in the attribution field.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const SEPS = join(__dirname, "..", "..", "seps");
const DOCS = join(__dirname, "..", "..", "docs", "seps");

/** The prose a source SEP carries between its metadata and its Abstract. */
function preambleOf(text: string): string {
  const i = text.indexOf("## Abstract");
  if (i === -1) return "";
  return text
    .slice(0, i)
    .split("\n")
    .filter(
      (line) =>
        !line.startsWith("# ") &&
        !/^- \*\*/.test(line) &&
        // Linter directives, not content, and MDX cannot parse them.
        !/^\s*<!--.*-->\s*$/.test(line),
    )
    .join("\n")
    .trim();
}

function sourceFiles(): string[] {
  return readdirSync(SEPS).filter((f) => f.endsWith(".md") && /^\d/.test(f));
}

/** The rendered page for a source file, by SEP number. */
function renderedFor(file: string): string | undefined {
  const number = file.split("-")[0];
  const match = readdirSync(DOCS).find(
    (f) => f.endsWith(".mdx") && f.split("-")[0] === number,
  );
  return match ? readFileSync(join(DOCS, match), "utf8") : undefined;
}

test("every provenance note survives rendering", () => {
  const missing: string[] = [];
  let checked = 0;
  for (const file of sourceFiles()) {
    const preamble = preambleOf(readFileSync(join(SEPS, file), "utf8"));
    if (!preamble) continue;
    const rendered = renderedFor(file);
    if (rendered === undefined) continue;
    checked += 1;
    // Compare on the first sentence: prettier reflows the blockquote, so the
    // whole block will not match byte for byte, but its opening will.
    const opening = preamble
      .split("\n")[0]
      .replace(/^> ?/, "")
      .slice(0, 60)
      .trim();
    if (opening && !rendered.includes(opening))
      missing.push(`${file}: ${opening}`);
  }
  assert.ok(checked > 0, "no SEP preambles were checked — the test is vacuous");
  assert.deepEqual(
    missing,
    [],
    `preamble dropped from rendered page:\n${missing.join("\n")}`,
  );
});

test("imported proposals still say so on the published page", () => {
  const imported = sourceFiles().filter((f) =>
    readFileSync(join(SEPS, f), "utf8").includes("**Imported from upstream.**"),
  );
  assert.ok(
    imported.length >= 30,
    `expected the upstream imports, found ${imported.length}`,
  );
  for (const file of imported) {
    const rendered = renderedFor(file);
    assert.ok(rendered, `no rendered page for ${file}`);
    assert.match(rendered, /Imported from upstream/, file);
  }
});

test("no author handle is linked twice", () => {
  for (const file of readdirSync(DOCS).filter((f) => f.endsWith(".mdx"))) {
    const text = readFileSync(join(DOCS, file), "utf8");
    assert.doesNotMatch(
      text,
      /\[\[@[\w-]+\]\(/,
      `${file} double-wraps an author link`,
    );
  }
});
