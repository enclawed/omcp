/**
 * Verifies every relative link and embedded resource in the built site: the
 * target file must exist and, when the link carries a fragment, the target
 * must contain that id.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as cheerio from "cheerio";

export interface BrokenLink {
  /** File containing the link, relative to the site root. */
  file: string;
  href: string;
  reason: "missing file" | "missing anchor";
}

const EXTERNAL = /^([a-z][a-z0-9+.-]*:|\/\/)/i;

/**
 * @param ignoreMissing Targets (relative to siteDir) that are allowed not to
 *   exist, e.g. PDFs in a build that skipped printing.
 */
export function checkLinks(
  siteDir: string,
  htmlFiles: string[],
  ignoreMissing?: (target: string) => boolean,
): BrokenLink[] {
  const idCache = new Map<string, Set<string>>();
  const idsOf = (file: string): Set<string> => {
    let ids = idCache.get(file);
    if (!ids) {
      const $ = cheerio.load(fs.readFileSync(path.join(siteDir, file), "utf8"));
      ids = new Set(
        $("[id]")
          .map((_, el) => $(el).attr("id") ?? "")
          .get(),
      );
      idCache.set(file, ids);
    }
    return ids;
  };

  const broken: BrokenLink[] = [];
  for (const file of htmlFiles) {
    const $ = cheerio.load(fs.readFileSync(path.join(siteDir, file), "utf8"));
    const hrefs = new Set(
      $("a[href], link[href], img[src], script[src], source[srcset]")
        .map((_, el) => {
          const $el = $(el);
          // srcset may list candidates ("a.svg 1x, b.svg 2x"); each URL is the first token of its entry.
          const srcset = $el.attr("srcset");
          if (srcset)
            return srcset
              .split(",")
              .map((entry) => entry.trim().split(/\s+/)[0]);
          return $el.attr("href") ?? $el.attr("src") ?? "";
        })
        .get(),
    );

    for (const href of hrefs) {
      if (href === "" || EXTERNAL.test(href)) continue;
      const hashIndex = href.indexOf("#");
      const targetPart = hashIndex === -1 ? href : href.slice(0, hashIndex);
      const fragment =
        hashIndex === -1 ? "" : decodeURIComponent(href.slice(hashIndex + 1));
      const target = targetPart
        ? path.posix.normalize(
            path.posix.join(path.posix.dirname(file), decodeURI(targetPart)),
          )
        : file;

      if (!fs.existsSync(path.join(siteDir, target))) {
        if (!ignoreMissing?.(target))
          broken.push({ file, href, reason: "missing file" });
      } else if (
        fragment &&
        target.endsWith(".html") &&
        !idsOf(target).has(fragment)
      ) {
        broken.push({ file, href, reason: "missing anchor" });
      }
    }
  }
  return broken;
}
