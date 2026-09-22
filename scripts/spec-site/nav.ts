/**
 * Reads the specification's structure from docs/docs.json.
 *
 * docs.json is the single source of truth for which pages make up each
 * specification version and in what order, so the published documents follow
 * it exactly rather than keeping a second, drift-prone list.
 */

export type NavNode =
  | { kind: "page"; route: string }
  | { kind: "group"; title: string; children: NavNode[] };

export interface SpecVersion {
  /** Directory name under docs/specification, e.g. "2026-07-28" or "draft". */
  id: string;
  /** Label shown in docs.json, e.g. "Version 2026-07-28 (latest)". */
  label: string;
  latest: boolean;
  draft: boolean;
  nav: NavNode[];
}

const VERSION_ROUTE = /^specification\/([^/]+)\//;

export function readSpecVersions(docsJson: unknown): SpecVersion[] {
  const tabs = (docsJson as { navigation?: { tabs?: unknown[] } })?.navigation
    ?.tabs;
  if (!Array.isArray(tabs))
    throw new Error("docs.json: navigation.tabs is missing");

  const tab = tabs.find(
    (t) => (t as { tab?: string }).tab === "Specification",
  ) as { versions?: unknown[] } | undefined;
  if (!tab || !Array.isArray(tab.versions)) {
    throw new Error('docs.json: no "Specification" tab with versions');
  }

  return tab.versions.map((raw) => {
    const v = raw as { version?: string; pages?: unknown[]; default?: boolean };
    if (typeof v.version !== "string" || !Array.isArray(v.pages)) {
      throw new Error("docs.json: malformed specification version entry");
    }
    const nav = toNodes(v.pages, v.version);
    const first = routes(nav)[0];
    const match = first ? VERSION_ROUTE.exec(first) : null;
    if (!match)
      throw new Error(
        `docs.json: cannot determine version id for "${v.version}"`,
      );
    const id = match[1];
    return {
      id,
      label: v.version,
      latest: v.default === true,
      draft: id === "draft",
      nav,
    };
  });
}

function toNodes(pages: unknown[], context: string): NavNode[] {
  return pages.map((entry): NavNode => {
    if (typeof entry === "string") return { kind: "page", route: entry };
    const group = entry as { group?: string; pages?: unknown[] };
    if (typeof group.group === "string" && Array.isArray(group.pages)) {
      return {
        kind: "group",
        title: group.group,
        children: toNodes(group.pages, context),
      };
    }
    throw new Error(`docs.json: unsupported navigation entry in "${context}"`);
  });
}

/** All page routes in navigation order. */
export function routes(nav: NavNode[]): string[] {
  return nav.flatMap((node) =>
    node.kind === "page" ? [node.route] : routes(node.children),
  );
}

/**
 * The fragment id a page receives inside its version's single-page document.
 * "specification/draft/basic/transports/index" -> "basic-transports",
 * "specification/draft/index" -> "overview".
 */
export function pageAnchor(route: string): string {
  const rest = route.replace(VERSION_ROUTE, "").replace(/(^|\/)index$/, "");
  return rest === "" ? "overview" : rest.replace(/\//g, "-");
}
