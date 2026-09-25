/**
 * HTML page templates for the published specification.
 *
 * Every link is relative (via `root`), so the site works unchanged at a domain
 * root, under a subpath such as GitHub Pages' /<repo>/, or opened from disk.
 */

export interface Revision {
  commit: string;
  /** ISO 8601 commit date. Using the commit's date, not the build time, keeps output reproducible. */
  date: string;
}

export interface SiteInfo {
  repoUrl: string;
  revision: Revision;
}

export interface TocEntry {
  number: string;
  title: string;
  anchor: string;
  children: TocEntry[];
}

export interface VersionSummary {
  id: string;
  latest: boolean;
  draft: boolean;
  pdf: string;
  schemaJson?: string;
  schemaTs?: string;
}

export interface ProposalSummary {
  number: string;
  title: string;
  status: string;
  statusKey: string;
  type: string;
  created: string;
  name: string;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const e = escapeHtml;

function shortCommit(info: SiteInfo): string {
  return info.revision.commit.slice(0, 7);
}

function day(info: SiteInfo): string {
  return info.revision.date.slice(0, 10);
}

function commitLink(info: SiteInfo): string {
  if (!/^[0-9a-f]{7,40}$/.test(info.revision.commit))
    return e(info.revision.commit);
  return `<a href="${e(info.repoUrl)}/commit/${e(info.revision.commit)}"><code>${e(shortCommit(info))}</code></a>`;
}

export function versionStatus(v: { latest: boolean; draft: boolean }): string {
  if (v.latest) return "Latest";
  if (v.draft) return "Draft";
  return "Superseded";
}

interface LayoutOptions {
  title: string;
  description: string;
  root: string;
  info: SiteInfo;
  body: string;
  bodyClass?: string;
}

function layout(o: LayoutOptions): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(o.title)}</title>
<meta name="description" content="${e(o.description)}">
<meta name="generator" content="omcp spec-site ${e(shortCommit(o.info))}">
<link rel="icon" href="${o.root}assets/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="${o.root}assets/style.css">
</head>
<body class="${o.bodyClass ?? ""}">
<header class="site-header">
  <a class="brand" href="${o.root}index.html">
    <picture>
      <source srcset="${o.root}assets/logo-dark.svg" media="(prefers-color-scheme: dark)">
      <img src="${o.root}assets/logo-light.svg" alt="" width="32" height="32">
    </picture>
    <span>omcp</span>
  </a>
  <nav class="site-nav" aria-label="Site">
    <a href="${o.root}index.html">Specification</a>
    <a href="${o.root}seps/index.html">Proposals</a>
    <a href="${e(o.info.repoUrl)}">GitHub</a>
  </nav>
</header>
${o.body}
<footer class="site-footer">
  <p>Generated from ${commitLink(o.info)} (${e(day(o.info))}) by <code>npm run build:spec</code>.
  Every document here is rebuilt from <code>docs/specification</code>, <code>schema/</code>, and
  <code>seps/</code> on each change to <code>main</code>.</p>
  <p>omcp&#8482;. omcp and the omcp logo are trademarks of Enclawed, Inc.
  Specification licensed under Apache-2.0; documentation under CC-BY-4.0.</p>
  <p>omcp is a fork of the Model Context Protocol and is not affiliated with, endorsed by, or
  sponsored by that project, Anthropic, PBC, or LF Projects, LLC.</p>
</footer>
</body>
</html>
`;
}

function tocList(entries: TocEntry[]): string {
  if (entries.length === 0) return "";
  const items = entries
    .map(
      (entry) =>
        `<li><a href="#${e(entry.anchor)}">${entry.number ? `<span class="num">${e(entry.number)}</span> ` : ""}${e(entry.title)}</a>${tocList(entry.children)}</li>`,
    )
    .join("");
  return `<ol>${items}</ol>`;
}

export function versionPage(o: {
  info: SiteInfo;
  version: VersionSummary;
  versions: VersionSummary[];
  toc: TocEntry[];
  sections: string;
}): string {
  const v = o.version;
  const status = versionStatus(v);
  const latest = o.versions.find((x) => x.latest);
  const others = o.versions
    .filter((x) => x.id !== v.id)
    .map((x) => `<a href="../${e(x.id)}/index.html">${e(x.id)}</a>`)
    .join(" · ");

  const banner = v.draft
    ? `<aside class="callout callout-warning version-banner"><p class="callout-label">Working draft</p><p>This document changes on every merge to <code>main</code>. It is not a released version and must not be relied on for interoperability.</p></aside>`
    : !v.latest && latest
      ? `<aside class="callout callout-info version-banner"><p class="callout-label">Superseded</p><p>This version has been superseded by <a href="../${e(latest.id)}/index.html">${e(latest.id)}</a>.</p></aside>`
      : "";

  const downloads = [
    `<a href="../${e(v.pdf)}">PDF</a>`,
    v.schemaJson ? `<a href="${e(v.schemaJson)}">schema.json</a>` : "",
    v.schemaTs ? `<a href="${e(v.schemaTs)}">schema.ts</a>` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const body = `<div class="doc-layout">
<nav class="toc" aria-label="Contents">
  <p class="toc-title">Contents</p>
  ${tocList(o.toc)}
</nav>
<main class="doc">
  <header class="doc-header">
    <p class="eyebrow">Specification · <span class="pill pill-${status.toLowerCase()}">${e(status)}</span></p>
    <h1>omcp<br><span class="doc-version">Version ${e(v.id)}</span></h1>
    <p class="doc-meta screen-only">Download: ${downloads}</p>
    ${others ? `<p class="doc-meta screen-only">Other versions: ${others}</p>` : ""}
    <p class="doc-meta">Built from ${commitLink(o.info)} · ${e(day(o.info))}</p>
    ${banner}
  </header>
  <nav class="print-toc" aria-hidden="true"><h2>Contents</h2>${tocList(o.toc)}</nav>
  ${o.sections}
</main>
</div>`;

  return layout({
    title: `omcp — Specification ${v.id}`,
    description: `The omcp specification, version ${v.id}.`,
    root: "../",
    info: o.info,
    body,
    bodyClass: "page-spec",
  });
}

export function landingPage(o: {
  info: SiteInfo;
  versions: VersionSummary[];
  proposals: { count: number; pdf: string };
}): string {
  const order = [...o.versions].sort(
    (a, b) => rank(a) - rank(b) || b.id.localeCompare(a.id),
  );
  const rows = order
    .map((v) => {
      const status = versionStatus(v);
      const extras = [
        v.schemaJson
          ? `<a href="${e(v.id)}/${e(v.schemaJson)}">schema.json</a>`
          : "",
        v.schemaTs ? `<a href="${e(v.id)}/${e(v.schemaTs)}">schema.ts</a>` : "",
      ]
        .filter(Boolean)
        .join(" · ");
      return `<tr>
  <td><a href="${e(v.id)}/index.html"><strong>${e(v.id)}</strong></a></td>
  <td><span class="pill pill-${status.toLowerCase()}">${e(status)}</span></td>
  <td><a href="${e(v.id)}/index.html">HTML</a> · <a href="${e(v.pdf)}">PDF</a></td>
  <td>${extras}</td>
</tr>`;
    })
    .join("\n");

  const body = `<main class="landing">
  <section class="hero">
    <picture>
      <source srcset="assets/logo-dark.svg" media="(prefers-color-scheme: dark)">
      <img class="hero-logo" src="assets/logo-light.svg" alt="" width="112" height="112">
    </picture>
    <h1>omcp</h1>
    <p class="lede">The specification, generated from source on every change.
    Read it in the browser or download it as PDF. Nothing here is written by hand.</p>
  </section>

  <section>
    <h2>Specification</h2>
    <table class="versions">
      <thead><tr><th>Version</th><th>Status</th><th>Read</th><th>Schema</th></tr></thead>
      <tbody>
${rows}
      </tbody>
    </table>
  </section>

  <section>
    <h2>Proposals</h2>
    <p>Every proposal (SEP) in the repository — ${o.proposals.count} in total — rendered from
    <code>seps/</code>. A proposal is a pull request; these are the design records behind the
    specification.</p>
    <p><a href="seps/index.html">Browse proposals</a> · <a href="seps/all.html">All proposals on one page</a> · <a href="${e(o.proposals.pdf)}">PDF</a></p>
  </section>

  <section>
    <h2>Source</h2>
    <p>Built from ${commitLink(o.info)} on ${e(day(o.info))}. The source, the build, and the
    submission process are all in <a href="${e(o.info.repoUrl)}">${e(o.info.repoUrl.replace(/^https:\/\//, ""))}</a>.
    To build this site yourself: <code>npm ci &amp;&amp; npm run build:spec</code>.</p>
  </section>
</main>`;

  return layout({
    title: "omcp — Specification",
    description:
      "The omcp specification in HTML and PDF, generated from source.",
    root: "",
    info: o.info,
    body,
    bodyClass: "page-landing",
  });
}

function rank(v: VersionSummary): number {
  return v.latest ? 0 : v.draft ? 1 : 2;
}

export function proposalIndexPage(o: {
  info: SiteInfo;
  proposals: ProposalSummary[];
  pdf: string;
}): string {
  const rows = [...o.proposals]
    .sort((a, b) => Number(b.number) - Number(a.number))
    .map(
      (p) => `<tr>
  <td><a href="${e(p.name)}.html">SEP-${e(p.number)}</a></td>
  <td><a href="${e(p.name)}.html">${e(p.title)}</a></td>
  <td><span class="pill pill-${e(p.statusKey)}">${e(p.status)}</span></td>
  <td>${e(p.type)}</td>
  <td>${e(p.created)}</td>
</tr>`,
    )
    .join("\n");

  const body = `<main class="doc doc-narrow">
  <header class="doc-header">
    <p class="eyebrow">Proposals</p>
    <h1>Proposals</h1>
    <p class="lede">A proposal is a pull request that carries a design document. These are all of
    them, newest first, rendered from <code>seps/</code>.</p>
    <p class="doc-meta"><a href="all.html">All proposals on one page</a> · <a href="../${e(o.pdf)}">PDF</a></p>
  </header>
  <table class="proposals">
    <thead><tr><th>Number</th><th>Title</th><th>Status</th><th>Type</th><th>Created</th></tr></thead>
    <tbody>
${rows}
    </tbody>
  </table>
</main>`;

  return layout({
    title: "Proposals — omcp",
    description: "Every omcp proposal (SEP), rendered from source.",
    root: "../",
    info: o.info,
    body,
    bodyClass: "page-proposals",
  });
}

export function proposalPage(o: {
  info: SiteInfo;
  proposal: ProposalSummary;
  html: string;
  source: string;
}): string {
  const p = o.proposal;
  const body = `<main class="doc doc-narrow">
  <header class="doc-header">
    <p class="eyebrow"><a href="index.html">Proposals</a> · SEP-${e(p.number)} · <span class="pill pill-${e(p.statusKey)}">${e(p.status)}</span></p>
    <h1>${e(p.title)}</h1>
    <p class="doc-meta">${e(p.type)} · Created ${e(p.created)} · <a href="${e(o.source)}">Source</a></p>
  </header>
  <article class="proposal">
${o.html}
  </article>
</main>`;

  return layout({
    title: `SEP-${p.number}: ${p.title} — omcp`,
    description: `Proposal SEP-${p.number}: ${p.title}`,
    root: "../",
    info: o.info,
    body,
    bodyClass: "page-proposal",
  });
}

export function proposalCollectionPage(o: {
  info: SiteInfo;
  sections: { proposal: ProposalSummary; html: string }[];
}): string {
  const toc: TocEntry[] = o.sections.map(({ proposal }) => ({
    number: `SEP-${proposal.number}`,
    title: proposal.title,
    anchor: `sep-${proposal.number}`,
    children: [],
  }));
  const sections = o.sections
    .map(
      ({
        proposal: p,
        html,
      }) => `<section class="spec-page proposal" id="sep-${e(p.number)}">
  <h2><span class="num">SEP-${e(p.number)}</span> ${e(p.title)}</h2>
  <p class="doc-meta"><span class="pill pill-${e(p.statusKey)}">${e(p.status)}</span> · ${e(p.type)} · Created ${e(p.created)}</p>
${html}
</section>`,
    )
    .join("\n");

  const body = `<div class="doc-layout">
<nav class="toc" aria-label="Contents">
  <p class="toc-title">Contents</p>
  ${tocList(toc)}
</nav>
<main class="doc">
  <header class="doc-header">
    <p class="eyebrow">Proposals</p>
    <h1>omcp<br><span class="doc-version">Proposals</span></h1>
    <p class="doc-meta">All ${o.sections.length} proposals in numeric order · Built from ${commitLink(o.info)} · ${e(day(o.info))}</p>
  </header>
  <nav class="print-toc" aria-hidden="true"><h2>Contents</h2>${tocList(toc)}</nav>
  ${sections}
</main>
</div>`;

  return layout({
    title: "omcp — Proposals",
    description: "Every omcp proposal (SEP) in one document.",
    root: "../",
    info: o.info,
    body,
    bodyClass: "page-spec",
  });
}
