/**
 * Wire identifiers are not ours to rename.
 *
 * omcp is a superset of MCP, which means an omcp implementation has to put the
 * *same* bytes on the wire as an MCP one for everything MCP already defines.
 * Namespaced identifiers — `_meta` keys, capability names, well-known URIs — are
 * on the wire. Rebranding one from `modelcontextprotocol.io/...` to an
 * omcp-owned domain would produce an implementation that an MCP peer silently
 * fails to understand, which is exactly the break the project forbids.
 *
 * A bulk rewrite of documentation URLs did this once, to SEP-1686's
 * `modelcontextprotocol.io/task` and `modelcontextprotocol.io/related-task`.
 * This test is the thing that would have caught it.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { extname } from "node:path";

/** Domains this project owns. None of them may name a protocol identifier. */
const OURS = [
  "omcp.tech",
  "omcp.fun",
  "openmodelcontextprotocol.org",
  "enclawed.github.io",
];

/**
 * An identifier, as opposed to a link: a quoted or backticked token that *is*
 * the whole string and carries a path segment — `"modelcontextprotocol.io/task"`
 * rather than a sentence mentioning a URL.
 */
const IDENTIFIER_SPAN = /(?:"([^"\n]{1,200})"|`([^`\n]{1,200})`)/g;

function trackedFiles(): string[] {
  const out = execFileSync(
    "git",
    ["ls-files", "-z", "seps", "docs", "schema", "extensions"],
    { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
  );
  const keep = new Set([".md", ".mdx", ".ts", ".json", ".py"]);
  return out
    .split("\0")
    .filter(Boolean)
    .filter((f) => keep.has(extname(f)));
}

test("no protocol identifier is namespaced under a domain we own", () => {
  const offences: string[] = [];
  for (const file of trackedFiles()) {
    const text = readFileSync(file, "utf8");
    const lines = text.split("\n");
    lines.forEach((line, i) => {
      for (const match of line.matchAll(IDENTIFIER_SPAN)) {
        const token = (match[1] ?? match[2] ?? "").trim();
        // A link is fine anywhere in the token — including inside a
        // backticked markdown link. A bare namespaced token is not.
        if (token.includes("://")) continue;
        for (const domain of OURS) {
          if (token.startsWith(`${domain}/`) || token.includes(`/${domain}/`)) {
            offences.push(`${file}:${i + 1}  ${token}`);
          }
        }
      }
    });
  }
  assert.deepEqual(
    offences,
    [],
    `identifiers renamed onto an omcp-owned domain break MCP interoperability:\n${offences.join("\n")}`,
  );
});

test("SEP-1686 still names the MCP task metadata keys", () => {
  // The two keys the rewrite hit, asserted positively so a future revert of the
  // revert fails here rather than in someone's client.
  for (const file of ["seps/1686-tasks.md", "docs/seps/1686-tasks.mdx"]) {
    const text = readFileSync(file, "utf8");
    assert.match(text, /"modelcontextprotocol\.io\/task"/, file);
    assert.match(text, /"modelcontextprotocol\.io\/related-task"/, file);
    assert.doesNotMatch(text, /omcp\.[a-z]+\/(related-)?task/, file);
  }
});

test("the tasks extension keeps its reverse-DNS capability names", () => {
  const text = readFileSync("docs/extensions/tasks/overview.mdx", "utf8");
  assert.match(text, /"io\.modelcontextprotocol\/tasks"/);
  assert.match(text, /"io\.modelcontextprotocol\/clientCapabilities"/);
});
