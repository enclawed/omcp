/**
 * Maps links written for the documentation site to where the same content
 * lives in the published documents.
 *
 * Specification pages become sections of one document per version, proposals
 * become pages of their own, and anything else is sent to its source file on
 * GitHub, so a reader never lands on a link that goes nowhere.
 */

import * as path from "node:path";

export interface LinkTargets {
  /** Version id -> (page route -> section anchor), for every version being built. */
  versions: Map<string, Map<string, string>>;
  /** Version id that "specification/latest" means. */
  latest: string;
  /** Proposal file name without extension (e.g. "1850-pr-based-sep-workflow") -> number. */
  proposals: Map<string, string>;
  /** Whether a repository-relative path names an existing file. */
  repoFileExists: (repoPath: string) => boolean;
  /** Host the documentation links were written against, e.g. "openmodelcontextprotocol.org". */
  siteHost: string;
  /** Base for source links, e.g. "https://github.com/enclawed/omcp/blob/main". */
  repoBlobUrl: string;
}

export interface LinkSource {
  /** Output file the link appears in, relative to the site root, e.g. "draft/index.html". */
  file: string;
  /** Route of the source the link was written in, e.g. "specification/draft/server/tools". */
  route: string;
  /** Point proposal links at sections of the combined proposals document. */
  proposalsInline?: boolean;
}

const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

export function resolveLink(
  href: string,
  from: LinkSource,
  targets: LinkTargets,
): string {
  if (href === "" || href.startsWith("#") || href.startsWith("//")) return href;

  let pathPart: string;
  let fragment: string;
  if (SCHEME.test(href)) {
    let url: URL;
    try {
      url = new URL(href);
    } catch {
      return href;
    }
    const host = url.hostname.replace(/^www\./, "");
    if (!/^https?:$/.test(url.protocol) || host !== targets.siteHost)
      return href;
    pathPart = url.pathname;
    fragment = url.hash.slice(1);
  } else {
    [pathPart, fragment] = splitFragment(href);
    if (!pathPart.startsWith("/")) {
      pathPart = path.posix.join(path.posix.dirname(from.route), pathPart);
    }
  }

  const resolvedPath = path.posix.normalize(pathPart).replace(/^\/+|\/+$/g, "");
  const route = resolvedPath.replace(/\.mdx?$/, "");

  const published = publishedTarget(route, fragment, from, targets);
  if (published) return relativize(from.file, published);
  return sourceTarget(resolvedPath, route, fragment, targets);
}

function publishedTarget(
  route: string,
  fragment: string,
  from: LinkSource,
  t: LinkTargets,
): string | null {
  const parts = route.split("/");

  if (parts[0] === "specification") {
    const version = !parts[1] || parts[1] === "latest" ? t.latest : parts[1];
    const pages = t.versions.get(version);
    if (!pages) return null;
    const rest = parts.slice(2).join("/");
    const candidates = rest
      ? [
          `specification/${version}/${rest}`,
          `specification/${version}/${rest}/index`,
        ]
      : [`specification/${version}/index`];
    const anchor = candidates
      .map((c) => pages.get(c))
      .find((a) => a !== undefined);
    const file = `${version}/index.html`;
    if (anchor === undefined) return file;
    return `${file}#${fragment ? `${anchor}--${fragment}` : anchor}`;
  }

  if (parts[0] === "seps") {
    const name = parts[1];
    if (!name || name === "index") return "seps/index.html";
    const number = t.proposals.get(name);
    if (number === undefined) return null;
    if (from.proposalsInline) {
      return `seps/all.html#${fragment ? `sep-${number}--${fragment}` : `sep-${number}`}`;
    }
    return `seps/${name}.html${fragment ? `#${fragment}` : ""}`;
  }

  return null;
}

function sourceTarget(
  resolvedPath: string,
  route: string,
  fragment: string,
  t: LinkTargets,
): string {
  const hash = fragment ? `#${fragment}` : "";
  const candidates = [
    resolvedPath,
    `${route}.md`,
    `docs/${route}.mdx`,
    `docs/${route}/index.mdx`,
  ];
  const found = candidates.find(
    (candidate) => candidate && t.repoFileExists(candidate),
  );
  if (found) return `${t.repoBlobUrl}/${found}${hash}`;
  return `https://${t.siteHost}/${route}${hash}`;
}

function splitFragment(href: string): [string, string] {
  const index = href.indexOf("#");
  return index === -1
    ? [href, ""]
    : [href.slice(0, index), href.slice(index + 1)];
}

/** Expresses a site-root-relative target relative to the file the link appears in. */
export function relativize(fromFile: string, target: string): string {
  const [targetPath, fragment] = splitFragment(target);
  const hash = fragment ? `#${fragment}` : "";
  if (targetPath === fromFile) return hash || path.posix.basename(targetPath);
  return path.posix.relative(path.posix.dirname(fromFile), targetPath) + hash;
}

/**
 * Locates an image (or other embedded file) referenced from a page, and the
 * path it is published at. Returns null for external references, and for
 * files that do not exist, which the link checker then reports.
 */
export function resolveAsset(
  src: string,
  from: LinkSource,
  repoFileExists: (repoPath: string) => boolean,
): { repoPath: string; sitePath: string } | null {
  if (src === "" || SCHEME.test(src) || src.startsWith("//")) return null;
  const [pathPart] = splitFragment(src.split("?")[0]);
  const joined = pathPart.startsWith("/")
    ? pathPart
    : path.posix.join(path.posix.dirname(from.route), pathPart);
  const normalized = path.posix.normalize(joined).replace(/^\/+/, "");
  if (normalized.startsWith("..")) return null;
  const repoPath = [`docs/${normalized}`, normalized].find(repoFileExists);
  return repoPath ? { repoPath, sitePath: `media/${repoPath}` } : null;
}
