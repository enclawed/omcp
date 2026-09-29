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
  /** Routes of published extension chapters, e.g. "extensions/attestation/overview". */
  extensions: Set<string>;
  /** Whether a repository-relative path names an existing file. */
  repoFileExists: (repoPath: string) => boolean;
  /** Host the documentation links were written against, e.g. "omcp.tech". */
  siteHost: string;
  /** Base for source links, e.g. "https://github.com/enclawed/omcp/blob/main". */
  repoBlobUrl: string;
  /**
   * Called for a link written against this site that names nothing published
   * and no file in the repository.
   *
   * Without this the resolver's last resort was to synthesize
   * `https://<siteHost>/<route>` — a plausible-looking URL for a page that does
   * not exist, which is precisely the outcome this module claims to prevent.
   * Reporting it makes the build say so instead.
   */
  onUnresolved?: (route: string) => void;
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

/**
 * Marks a target that is already final — relative to the linking file, or
 * absolute — so the caller does not relativize it a second time.
 */
const ABSOLUTE = "\u0000";

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
  if (published)
    return published.startsWith(ABSOLUTE)
      ? published.slice(ABSOLUTE.length)
      : relativize(from.file, published);
  return sourceTarget(resolvedPath, route, fragment, targets);
}

/**
 * Specification pages that other documents link by a path this fork does not
 * publish, and where the content actually is.
 *
 * Both entries are content we hold: the security guidance is published as a
 * guide rather than a specification page, and tasks left the core protocol for
 * the Tasks extension in SEP-2663. Without this the links land on the top of a
 * version document, which looks like it worked and is not where the reader
 * asked to go.
 *
 * A value containing `{version}` is a repository path; anything else is a route
 * this site publishes.
 */
export const RELOCATED_SPEC_PAGES: Readonly<Record<string, string>> = {
  "basic/security_best_practices":
    "docs/docs/{version}/tutorials/security/security_best_practices.mdx",
  "basic/utilities/tasks": "extensions/tasks/overview",
};

/**
 * Resolves a relocated specification page, or null when nothing is registered.
 *
 * Returns a site-relative target for a published route, or an absolute source
 * link for a page that exists only in the repository.
 */
export function relocatedTarget(
  rest: string,
  version: string,
  fragment: string,
  from: LinkSource,
  t: LinkTargets,
): string | null {
  const moved = RELOCATED_SPEC_PAGES[rest];
  if (!moved) return null;
  const hash = fragment ? `#${fragment}` : "";
  if (moved.includes("{version}")) {
    const file = moved.replace("{version}", version);
    return t.repoFileExists(file) ? `${t.repoBlobUrl}/${file}${hash}` : null;
  }
  const published = publishedTarget(moved, fragment, from, t);
  return published ? relativize(from.file, published) : null;
}

function publishedTarget(
  route: string,
  fragment: string,
  from: LinkSource,
  t: LinkTargets,
): string | null {
  // The site root: "https://omcp.tech/" means this document set's landing page.
  if (route === "") return `index.html${fragment ? `#${fragment}` : ""}`;

  // The documentation site serves chapters under /docs as well as at the top
  // level; both name the same published chapter.
  if (route.startsWith("docs/")) {
    const inner = publishedTarget(route.slice(5), fragment, from, t);
    if (inner) return inner;
  }

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
    if (anchor === undefined) {
      // Not a page of this version. It may be one that moved; otherwise the
      // version document itself is the closest honest answer.
      const moved = relocatedTarget(rest, version, fragment, from, t);
      // A moved target is already expressed relative to the linking file, and
      // the caller relativizes what this function returns, so it is returned
      // through a marker the caller leaves alone.
      if (moved) return `${ABSOLUTE}${moved}`;
      return file;
    }
    return `${file}#${fragment ? `${anchor}--${fragment}` : anchor}`;
  }

  if (parts[0] === "extensions") {
    if (t.extensions.has(route)) {
      return `${route}.html${fragment ? `#${fragment}` : ""}`;
    }
    // A chapter directory, e.g. /extensions/attestation -> its overview.
    const overview = `${route}/overview`;
    if (t.extensions.has(overview)) {
      return `${overview}.html${fragment ? `#${fragment}` : ""}`;
    }
    return null;
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
  // Guides are versioned on disk but linked without a version, so
  // "/docs/learn/versioning" is docs/docs/<latest>/learn/versioning.mdx.
  if (route.startsWith("docs/")) {
    const rest = route.slice(5);
    candidates.push(
      `docs/docs/${t.latest}/${rest}.mdx`,
      `docs/docs/${t.latest}/${rest}/index.mdx`,
    );
  }
  const found = candidates.find(
    (candidate) => candidate && t.repoFileExists(candidate),
  );
  if (found) return `${t.repoBlobUrl}/${found}${hash}`;
  t.onUnresolved?.(route);
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
