/**
 * The one stage that needs a browser: rendering mermaid diagrams to static SVG
 * and printing the documents to PDF. Both use the same headless Chromium, so
 * the diagrams in the PDF are exactly the ones on the web.
 */

import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { chromium, type Browser } from "playwright";
import type { Diagram } from "./markdown";
import type { PdfJob } from "./site";
import { escapeHtml } from "./templates";

export interface Renderer {
  renderDiagrams(
    diagrams: Diagram[],
  ): Promise<{ svgs: Map<string, string>; failures: string[] }>;
  printPdfs(jobs: PdfJob[]): Promise<void>;
  close(): Promise<void>;
}

declare const mermaid: {
  initialize(config: Record<string, unknown>): void;
  render(id: string, code: string): Promise<{ svg: string }>;
};

export async function launchRenderer(): Promise<Renderer> {
  const browser: Browser = await chromium.launch();
  const mermaidScript = createRequire(__filename).resolve(
    "mermaid/dist/mermaid.min.js",
  );

  return {
    async renderDiagrams(diagrams) {
      const svgs = new Map<string, string>();
      const failures: string[] = [];
      if (diagrams.length === 0) return { svgs, failures };

      const page = await browser.newPage();
      await page.setContent("<!doctype html><html><body></body></html>");
      await page.addScriptTag({ path: mermaidScript });
      await page.evaluate(() =>
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "neutral",
          // SVG text rather than embedded HTML keeps diagrams selectable and searchable in the PDF.
          htmlLabels: false,
          flowchart: { htmlLabels: false },
          fontFamily: "system-ui, 'DejaVu Sans', Arial, sans-serif",
        }),
      );

      for (const { hash, code } of diagrams) {
        const result = await page.evaluate(
          async ({ id, source }) => {
            try {
              return { svg: (await mermaid.render(id, source)).svg };
            } catch (error) {
              return { error: String((error as Error)?.message ?? error) };
            }
          },
          { id: `diagram-${hash}`, source: code },
        );
        if ("svg" in result && result.svg) svgs.set(hash, result.svg);
        else
          failures.push(
            `diagram ${hash}: ${"error" in result ? result.error : "no output"}`,
          );
      }
      await page.close();
      return { svgs, failures };
    },

    async printPdfs(jobs) {
      const page = await browser.newPage();
      for (const job of jobs) {
        await page.goto(pathToFileURL(job.html).href, { waitUntil: "load" });
        await page.emulateMedia({ media: "print" });
        // Paper can't be clicked: expand collapsed sections (such as schema examples) before printing.
        await page.evaluate(() =>
          document.querySelectorAll("details").forEach((d) => (d.open = true)),
        );
        await page.pdf({
          path: job.pdf,
          format: "A4",
          printBackground: true,
          preferCSSPageSize: true,
          outline: true,
          tagged: true,
          displayHeaderFooter: true,
          headerTemplate: `<div style="width:100%;padding:0 16mm;font:7pt system-ui,sans-serif;color:#777;">${escapeHtml(job.title)}</div>`,
          footerTemplate: `<div style="width:100%;padding:0 16mm;font:7pt system-ui,sans-serif;color:#777;display:flex;justify-content:space-between;"><span>${escapeHtml(job.footer)}</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
        });
      }
      await page.close();
    },

    close: () => browser.close(),
  };
}
