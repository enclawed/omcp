/**
 * Stubs that make documentation-shaped URLs land on the right section.
 *
 * The specification is published as one document per version, so a URL written
 * against the documentation site — `/specification/2025-06-18/server/tools` —
 * names no file here; the content is a section of `2025-06-18/index.html`.
 * Those URLs are in every imported proposal and in other people's links, so
 * each route gets a stub that forwards to its section rather than a 404.
 *
 * A fragment on the incoming URL is carried across. Section anchors nest by
 * joining with `--` (`server-tools` + `error-handling` becomes
 * `server-tools--error-handling`), so the stub appends the fragment the same
 * way, client-side, where it can see it.
 */

import { pageAnchor, routes, type SpecVersion } from "./nav";
import { relativize } from "./links";

export interface Redirect {
  /** Output file, relative to the site root. */
  file: string;
  /** Where it forwards to, relative to `file`, anchor included. */
  target: string;
}

/** A stub for every specification page route, plus the `latest` aliases. */
export function sectionRedirects(
  versions: SpecVersion[],
  latestId: string,
): Redirect[] {
  const byFile = new Map<string, Redirect>();

  const add = (file: string, versionId: string, anchor: string) => {
    // First writer wins, so a real page is never shadowed by a stub.
    if (byFile.has(file)) return;
    byFile.set(file, {
      file,
      target: relativize(file, `${versionId}/index.html#${anchor}`),
    });
  };

  for (const v of versions) {
    for (const route of routes(v.nav)) {
      const anchor = pageAnchor(route);
      add(`${route}.html`, v.id, anchor);
      if (v.id === latestId) {
        // "/specification/latest/..." names the same section.
        add(
          `${route.replace(`specification/${v.id}/`, "specification/latest/")}.html`,
          v.id,
          anchor,
        );
      }
    }
  }

  // The bare version root, for a link that stops at "/specification/<id>".
  for (const v of versions) {
    add(`specification/${v.id}/index.html`, v.id, "overview");
    if (v.id === latestId)
      add("specification/latest/index.html", v.id, "overview");
  }

  return [...byFile.values()].sort((a, b) => (a.file < b.file ? -1 : 1));
}

/**
 * The stub page.
 *
 * `meta refresh` handles the no-script case; the script exists only to carry a
 * fragment across, which a static redirect cannot do. Both point at the same
 * place, and the link in the body means the page still works if neither runs.
 */
export function redirectPage(target: string): string {
  const [base] = target.split("#");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Redirecting</title>
<link rel="canonical" href="${escapeAttr(base)}">
<meta http-equiv="refresh" content="0; url=${escapeAttr(target)}">
<script>
(function () {
  var to = ${JSON.stringify(target)};
  var extra = location.hash.slice(1);
  location.replace(extra ? to + "--" + extra : to);
})();
</script>
</head>
<body>
<p>This section is published as part of <a href="${escapeAttr(target)}">the specification document</a>.</p>
</body>
</html>
`;
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}
