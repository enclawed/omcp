/**
 * Loads proposals (SEPs) from seps/ in a stable, numeric order.
 */

import { parseSEPMetadata, type SEPMetadata } from "../sep-metadata";

export interface Proposal {
  meta: SEPMetadata;
  /** File name without extension, e.g. "1850-pr-based-sep-workflow". */
  name: string;
  /** Route used for link resolution, e.g. "seps/1850-pr-based-sep-workflow". */
  route: string;
  source: string;
}

export function readProposals(
  files: { name: string; content: string }[],
): Proposal[] {
  return files
    .map(({ name, content }) => {
      const meta = parseSEPMetadata(content, name);
      if (!meta) return null;
      const base = name.replace(/\.md$/, "");
      return { meta, name: base, route: `seps/${base}`, source: content };
    })
    .filter((p): p is Proposal => p !== null)
    .sort((a, b) => Number(a.meta.number) - Number(b.meta.number));
}

/** CSS-safe status key, e.g. "In-Review" -> "in-review". */
export function statusKey(status: string): string {
  return (
    status
      .toLowerCase()
      .replace(/[^a-z]+/g, "-")
      .replace(/^-|-$/g, "") || "unknown"
  );
}
