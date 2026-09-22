#!/usr/bin/env tsx
/**
 * Builds the published specification (HTML and PDF) from the repository.
 *
 * Usage: npm run build:spec -- [options]
 *   --out <dir>        Output directory (default: site)
 *   --version <id>     Build only this version; repeatable (default: all)
 *   --no-pdf           Skip PDF output
 *   --no-browser       Skip everything that needs Chromium: no PDFs, and
 *                      diagrams are shown as their mermaid source
 *   --strict           Exit non-zero on any warning or broken link
 */

import { execFileSync } from "node:child_process";
import * as path from "node:path";
import { parseArgs } from "node:util";
import { buildSite } from "./site";
import type { Revision } from "./templates";

const ROOT = path.resolve(__dirname, "..", "..");

const { values } = parseArgs({
  options: {
    out: { type: "string", default: "site" },
    version: { type: "string", multiple: true },
    "no-pdf": { type: "boolean", default: false },
    "no-browser": { type: "boolean", default: false },
    strict: { type: "boolean", default: false },
    "site-host": { type: "string", default: "openmodelcontextprotocol.org" },
    "repo-url": { type: "string", default: "https://github.com/enclawed/omcp" },
  },
});

function revision(): Revision {
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
  try {
    return {
      commit: git("rev-parse", "HEAD"),
      date: git("log", "-1", "--format=%cI"),
    };
  } catch {
    return { commit: "unknown", date: "1970-01-01T00:00:00Z" };
  }
}

async function main(): Promise<void> {
  const started = Date.now();
  const useBrowser = !values["no-browser"];
  const renderer = useBrowser
    ? await (await import("./browser")).launchRenderer()
    : null;

  try {
    const result = await buildSite({
      root: ROOT,
      outDir: path.resolve(ROOT, values.out!),
      siteHost: values["site-host"]!,
      repoUrl: values["repo-url"]!,
      revision: revision(),
      versions: values.version,
      renderDiagrams: renderer
        ? (diagrams) => renderer.renderDiagrams(diagrams)
        : async () => ({ svgs: new Map(), failures: [] }),
      printPdfs:
        renderer && !values["no-pdf"]
          ? (jobs) => renderer.printPdfs(jobs)
          : undefined,
    });

    const { stats } = result;
    console.log(
      `Built ${stats.versions} version(s), ${stats.pages} page(s), ${stats.proposals} proposal(s), ` +
        `${stats.diagrams} diagram(s), ${result.pdfs.length} PDF(s) into ${path.relative(ROOT, path.resolve(ROOT, values.out!)) || "."}/ ` +
        `in ${((Date.now() - started) / 1000).toFixed(1)}s.`,
    );

    if (result.warnings.length > 0) {
      console.log(`\n${result.warnings.length} warning(s):`);
      for (const warning of result.warnings) console.log(`  ${warning}`);
    }
    if (result.brokenLinks.length > 0) {
      console.log(`\n${result.brokenLinks.length} broken link(s):`);
      for (const link of result.brokenLinks)
        console.log(`  ${link.file}: ${link.href} (${link.reason})`);
    }
    if (
      values.strict &&
      (result.warnings.length > 0 || result.brokenLinks.length > 0)
    ) {
      process.exitCode = 1;
    }
  } finally {
    await renderer?.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
