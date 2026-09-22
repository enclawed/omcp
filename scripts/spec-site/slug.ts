/**
 * Heading ids compatible with GitHub/Mintlify-style slugs, so existing links of
 * the form `page#some-heading` keep resolving in the published documents.
 */

const DISALLOWED = /[^\p{L}\p{M}\p{N}\p{Pc} -]/gu;

export function slugify(text: string): string {
  return text.toLowerCase().replace(DISALLOWED, "").replace(/ /g, "-");
}

/** Hands out unique slugs, suffixing repeats with -1, -2, ... like github-slugger. */
export class Slugger {
  private readonly occurrences = new Map<string, number>();

  slug(text: string): string {
    const base = slugify(text) || "section";
    let result = base;
    while (this.occurrences.has(result)) {
      const count = this.occurrences.get(base)! + 1;
      this.occurrences.set(base, count);
      result = `${base}-${count}`;
    }
    this.occurrences.set(result, 0);
    return result;
  }
}

const LITERAL = /^[\p{L}\p{N}_\-/:.]+$/u;

/**
 * Other anchors the documentation site answers to for the same heading, which
 * existing links rely on: underscores dropped ("`_meta`" -> "meta"), and
 * punctuation kept ("`tasks/get`" -> "tasks/get", "https://" -> "https://").
 */
export function headingAliases(slug: string, text: string): string[] {
  const literal = text.toLowerCase().trim().replace(/\s+/g, "-");
  const candidates = [
    slug.replace(/_/g, ""),
    LITERAL.test(literal) ? literal : "",
  ];
  return [...new Set(candidates)].filter(
    (alias) => alias !== "" && alias !== slug,
  );
}
