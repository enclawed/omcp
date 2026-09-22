/**
 * Builds the published specification: one single-page HTML document per
 * specification version, a page per proposal plus a combined proposals
 * document, a landing page, and (when a printer is supplied) a PDF of each.
 *
 * Diagram rendering and PDF printing are injected, so this module has no
 * browser dependency and can be exercised end to end in unit tests.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { pageAnchor, readSpecVersions, routes, type NavNode } from "./nav";
import { diagramPlaceholder, renderMarkdown, type Diagram } from "./markdown";
import {
  relativize,
  resolveAsset,
  resolveLink,
  type LinkSource,
  type LinkTargets,
} from "./links";
import { readProposals, statusKey, type Proposal } from "./proposals";
import { checkLinks, type BrokenLink } from "./linkcheck";
import { slugify } from "./slug";
import {
  escapeHtml,
  landingPage,
  proposalCollectionPage,
  proposalIndexPage,
  proposalPage,
  versionPage,
  type ProposalSummary,
  type Revision,
  type SiteInfo,
  type TocEntry,
  type VersionSummary,
} from "./templates";

export const GENERATOR = "omcp spec-site";

export interface PdfJob {
  /** Absolute path of the HTML file to print. */
  html: string;
  /** Absolute path of the PDF to write. */
  pdf: string;
  /** Shown in the running header. */
  title: string;
  /** Shown in the running footer. */
  footer: string;
}

export interface BuildOptions {
  /** Repository root containing docs/, schema/, and seps/. */
  root: string;
  outDir: string;
  /** Host that documentation links were written against, e.g. "openmodelcontextprotocol.org". */
  siteHost: string;
  /** e.g. "https://github.com/enclawed/omcp" */
  repoUrl: string;
  revision: Revision;
  /** Build only these version ids (default: every version in docs.json). */
  versions?: string[];
  renderDiagrams: (
    diagrams: Diagram[],
  ) => Promise<{ svgs: Map<string, string>; failures: string[] }>;
  /** Omit to skip PDF output. */
  printPdfs?: (jobs: PdfJob[]) => Promise<void>;
}

export interface BuildResult {
  /** Every file written, relative to outDir. */
  files: string[];
  pdfs: string[];
  warnings: string[];
  brokenLinks: BrokenLink[];
  stats: {
    versions: number;
    pages: number;
    proposals: number;
    diagrams: number;
  };
}

/** Repository files every page references, and where they are published. */
const BRAND_ASSETS: [string, string][] = [
  ["docs/logo/light.svg", "assets/logo-light.svg"],
  ["docs/logo/dark.svg", "assets/logo-dark.svg"],
  ["docs/favicon.svg", "assets/favicon.svg"],
];

const PLACEHOLDER = new RegExp(
  diagramPlaceholder("HASH")
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace("HASH", "([0-9a-f]+)"),
  "g",
);

export async function buildSite(o: BuildOptions): Promise<BuildResult> {
  const root = path.resolve(o.root);
  const out = path.resolve(o.outDir);
  guardOutDir(root, out);

  const info: SiteInfo = { repoUrl: o.repoUrl, revision: o.revision };
  const inRepo = (p: string) => path.join(root, p);
  const read = (p: string) => fs.readFileSync(inRepo(p), "utf8");
  const isFile = (p: string) => {
    const abs = path.resolve(root, p);
    return (
      abs.startsWith(root + path.sep) &&
      fs.existsSync(abs) &&
      fs.statSync(abs).isFile()
    );
  };

  const missing = BRAND_ASSETS.map(([from]) => from).filter(
    (from) => !isFile(from),
  );
  if (missing.length > 0)
    throw new Error(
      `missing brand asset(s) every page references: ${missing.join(", ")}`,
    );

  let versions = readSpecVersions(JSON.parse(read("docs/docs.json")));
  if (o.versions && o.versions.length > 0) {
    const unknown = o.versions.filter(
      (id) => !versions.some((v) => v.id === id),
    );
    if (unknown.length > 0)
      throw new Error(
        `unknown specification version(s): ${unknown.join(", ")}`,
      );
    versions = versions.filter((v) => o.versions!.includes(v.id));
  }

  const proposals = readProposals(
    fs
      .readdirSync(inRepo("seps"))
      .filter((name) => name.endsWith(".md"))
      .sort()
      .map((name) => ({ name, content: read(`seps/${name}`) })),
  );

  const latest =
    versions.find((v) => v.latest) ??
    versions.find((v) => !v.draft) ??
    versions[0];
  const targets: LinkTargets = {
    versions: new Map(
      versions.map((v) => [
        v.id,
        new Map(routes(v.nav).map((r) => [r, pageAnchor(r)])),
      ]),
    ),
    latest: latest.id,
    proposals: new Map(proposals.map((p) => [p.name, p.meta.number])),
    repoFileExists: isFile,
    siteHost: o.siteHost,
    repoBlobUrl: `${o.repoUrl}/blob/main`,
  };

  const summaries: VersionSummary[] = versions.map((v) => ({
    id: v.id,
    latest: v.latest,
    draft: v.draft,
    pdf: `pdf/omcp-specification-${v.id}.pdf`,
    schemaJson: isFile(`schema/${v.id}/schema.json`)
      ? "schema.json"
      : undefined,
    schemaTs: isFile(`schema/${v.id}/schema.ts`) ? "schema.ts" : undefined,
  }));

  const warnings: string[] = [];
  const diagrams: Diagram[] = [];
  const pages: { file: string; html: string }[] = [];
  let pageCount = 0;

  // Images referenced by pages, published alongside them: site path -> repository path.
  const media = new Map<string, string>();
  const publishAsset = (from: LinkSource) => (src: string) => {
    const asset = resolveAsset(src, from, isFile);
    if (!asset) return src;
    media.set(asset.sitePath, asset.repoPath);
    return relativize(from.file, asset.sitePath);
  };

  // One document per specification version, sections numbered after docs.json.
  for (const [index, v] of versions.entries()) {
    const file = `${v.id}/index.html`;
    const toc: TocEntry[] = [];

    const renderNodes = (
      nodes: NavNode[],
      parentNumber: string,
      level: number,
      tocOut: TocEntry[],
      groups: string[],
    ): string =>
      nodes
        .map((node, i) => {
          const number = parentNumber ? `${parentNumber}.${i + 1}` : `${i + 1}`;
          const depth = Math.min(6, 2 + level);

          if (node.kind === "group") {
            const anchor = `group-${slugify([...groups, node.title].join(" "))}`;
            const entry: TocEntry = {
              number,
              title: node.title,
              anchor,
              children: [],
            };
            tocOut.push(entry);
            const inner = renderNodes(
              node.children,
              number,
              level + 1,
              entry.children,
              [...groups, node.title],
            );
            return `<section class="spec-group" id="${anchor}">\n<h${depth}><span class="num">${number}</span> ${escapeHtml(node.title)}</h${depth}>\n${inner}\n</section>`;
          }

          const sourcePath = `docs/${node.route}.mdx`;
          if (!isFile(sourcePath)) {
            throw new Error(
              `docs.json lists "${node.route}" but ${sourcePath} does not exist`,
            );
          }
          const anchor = pageAnchor(node.route);
          const rendered = renderMarkdown(read(sourcePath), {
            format: "mdx",
            idPrefix: anchor,
            headingOffset: depth - 1,
            resolveLink: (href) =>
              resolveLink(href, { file, route: node.route }, targets),
            resolveAsset: publishAsset({ file, route: node.route }),
          });
          pageCount++;
          diagrams.push(...rendered.diagrams);
          warnings.push(...rendered.warnings.map((w) => `${sourcePath}: ${w}`));

          const title =
            typeof rendered.frontmatter.title === "string"
              ? rendered.frontmatter.title
              : node.route;
          const description = rendered.frontmatter.description;
          tocOut.push({
            number,
            title,
            anchor,
            children: rendered.headings
              .filter((h) => h.depth === 2)
              .map((h) => ({
                number: "",
                title: h.text,
                anchor: h.id,
                children: [],
              })),
          });
          const lede =
            typeof description === "string"
              ? `<p class="lede">${escapeHtml(description)}</p>\n`
              : "";
          return `<section class="spec-page" id="${anchor}">\n<h${depth}><span class="num">${number}</span> ${escapeHtml(title)}</h${depth}>\n${lede}${rendered.html}\n</section>`;
        })
        .join("\n");

    const sections = renderNodes(v.nav, "", 0, toc, []);
    pages.push({
      file,
      html: versionPage({
        info,
        version: summaries[index],
        versions: summaries,
        toc,
        sections,
      }),
    });
  }

  // Proposals: a page each, an index, and one combined document.
  const proposalSummaries = proposals.map(summarize);
  const collection: { proposal: ProposalSummary; html: string }[] = [];
  for (const [index, p] of proposals.entries()) {
    const file = `seps/${p.name}.html`;
    const standalone = renderMarkdown(p.source, {
      format: "md",
      dropFirstH1: true,
      resolveLink: (href) =>
        resolveLink(href, { file, route: p.route }, targets),
      resolveAsset: publishAsset({ file, route: p.route }),
    });
    diagrams.push(...standalone.diagrams);
    warnings.push(...standalone.warnings.map((w) => `seps/${p.name}.md: ${w}`));
    pages.push({
      file,
      html: proposalPage({
        info,
        proposal: proposalSummaries[index],
        html: standalone.html,
        source: `${o.repoUrl}/blob/main/seps/${p.name}.md`,
      }),
    });

    const inline = renderMarkdown(p.source, {
      format: "md",
      dropFirstH1: true,
      idPrefix: `sep-${p.meta.number}`,
      headingOffset: 1,
      resolveLink: (href) =>
        resolveLink(
          href,
          { file: "seps/all.html", route: p.route, proposalsInline: true },
          targets,
        ),
      resolveAsset: publishAsset({ file: "seps/all.html", route: p.route }),
    });
    diagrams.push(...inline.diagrams);
    collection.push({ proposal: proposalSummaries[index], html: inline.html });
  }
  const proposalsPdf = "pdf/omcp-proposals.pdf";
  pages.push({
    file: "seps/index.html",
    html: proposalIndexPage({
      info,
      proposals: proposalSummaries,
      pdf: proposalsPdf,
    }),
  });
  pages.push({
    file: "seps/all.html",
    html: proposalCollectionPage({ info, sections: collection }),
  });
  pages.push({
    file: "index.html",
    html: landingPage({
      info,
      versions: summaries,
      proposals: { count: proposals.length, pdf: proposalsPdf },
    }),
  });

  // Diagrams: render each distinct one once, then substitute everywhere.
  const unique = [...new Map(diagrams.map((d) => [d.hash, d])).values()];
  const { svgs, failures } = await o.renderDiagrams(unique);
  warnings.push(...failures);
  const codeOf = new Map(unique.map((d) => [d.hash, d.code]));
  const withDiagrams = (html: string) =>
    html.replace(PLACEHOLDER, (_, hash: string) => {
      const svg = svgs.get(hash);
      return svg
        ? `<figure class="diagram">${svg}</figure>`
        : `<pre class="diagram-source"><code>${escapeHtml(codeOf.get(hash) ?? "")}</code></pre>`;
    });

  // Write the site.
  fs.rmSync(out, { recursive: true, force: true });
  const files: string[] = [];
  const write = (rel: string, content: string | Buffer) => {
    fs.mkdirSync(path.dirname(path.join(out, rel)), { recursive: true });
    fs.writeFileSync(path.join(out, rel), content);
    files.push(rel);
  };

  for (const page of pages) write(page.file, withDiagrams(page.html));
  write(
    "assets/style.css",
    fs.readFileSync(path.join(__dirname, "assets", "style.css")),
  );
  for (const [sitePath, repoPath] of [...media].sort()) {
    write(sitePath, fs.readFileSync(inRepo(repoPath)));
  }
  for (const [from, to] of BRAND_ASSETS)
    write(to, fs.readFileSync(inRepo(from)));
  for (const v of summaries) {
    if (v.schemaJson)
      write(
        `${v.id}/schema.json`,
        fs.readFileSync(inRepo(`schema/${v.id}/schema.json`)),
      );
    if (v.schemaTs)
      write(
        `${v.id}/schema.ts`,
        fs.readFileSync(inRepo(`schema/${v.id}/schema.ts`)),
      );
  }
  // Serve files verbatim on GitHub Pages rather than through Jekyll.
  write(".nojekyll", "");

  const pdfs: string[] = [];
  if (o.printPdfs) {
    const footer = `${o.revision.commit.slice(0, 7)} · ${o.revision.date.slice(0, 10)}`;
    const jobs: PdfJob[] = [
      ...summaries.map((v) => ({
        html: path.join(out, v.id, "index.html"),
        pdf: path.join(out, v.pdf),
        title: `Open Model Context Protocol — Specification ${v.id}`,
        footer: `omcp ${v.id} · ${footer}`,
      })),
      {
        html: path.join(out, "seps", "all.html"),
        pdf: path.join(out, proposalsPdf),
        title: "Open Model Context Protocol — Proposals",
        footer: `omcp proposals · ${footer}`,
      },
    ];
    fs.mkdirSync(path.join(out, "pdf"), { recursive: true });
    await o.printPdfs(jobs);
    for (const job of jobs) {
      const rel = path.relative(out, job.pdf).split(path.sep).join("/");
      pdfs.push(rel);
      files.push(rel);
    }
  }

  write(
    "manifest.json",
    JSON.stringify(
      {
        generator: GENERATOR,
        commit: o.revision.commit,
        date: o.revision.date,
        versions: summaries.map((v) => ({
          id: v.id,
          latest: v.latest,
          draft: v.draft,
          html: `${v.id}/index.html`,
          pdf: o.printPdfs ? v.pdf : null,
          schemaJson: v.schemaJson ? `${v.id}/${v.schemaJson}` : null,
          schemaTs: v.schemaTs ? `${v.id}/${v.schemaTs}` : null,
        })),
        proposals: {
          count: proposals.length,
          index: "seps/index.html",
          all: "seps/all.html",
          pdf: o.printPdfs ? proposalsPdf : null,
        },
      },
      null,
      2,
    ) + "\n",
  );

  // PDFs are linked from every document; without them those links are expected to dangle.
  const brokenLinks = checkLinks(
    out,
    files.filter((f) => f.endsWith(".html")),
    o.printPdfs ? undefined : (target) => target.startsWith("pdf/"),
  );

  return {
    files,
    pdfs,
    warnings,
    brokenLinks,
    stats: {
      versions: versions.length,
      pages: pageCount,
      proposals: proposals.length,
      diagrams: unique.length,
    },
  };
}

function summarize(p: Proposal): ProposalSummary {
  return {
    number: p.meta.number,
    title: p.meta.title,
    status: p.meta.status,
    statusKey: statusKey(p.meta.status),
    type: p.meta.type,
    created: p.meta.created,
    name: p.name,
  };
}

/** Refuses to delete anything that is not empty and not a previous build. */
function guardOutDir(root: string, out: string): void {
  if (
    out === root ||
    root.startsWith(out + path.sep) ||
    path.parse(out).root === out
  ) {
    throw new Error(
      `refusing to build into ${out}: it contains the repository`,
    );
  }
  if (!fs.existsSync(out) || fs.readdirSync(out).length === 0) return;
  const manifest = path.join(out, "manifest.json");
  let generator: unknown;
  try {
    generator = (
      JSON.parse(fs.readFileSync(manifest, "utf8")) as { generator?: unknown }
    ).generator;
  } catch {
    generator = undefined;
  }
  if (generator !== GENERATOR) {
    throw new Error(
      `refusing to overwrite ${out}: it is not empty and is not a previous ${GENERATOR} build`,
    );
  }
}
