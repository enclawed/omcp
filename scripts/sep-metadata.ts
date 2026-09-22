/**
 * Parsing of SEP (proposal) files in seps/.
 *
 * Shared by render-seps.ts (Mintlify pages) and spec-site/ (published HTML and
 * PDF), so both read proposal metadata identically.
 */

export interface SEPMetadata {
  number: string;
  title: string;
  status: string;
  type: string;
  created: string;
  accepted?: string;
  authors: string;
  sponsor: string;
  prNumber: string;
  slug: string;
  filename: string;
}

/**
 * Parse SEP metadata from markdown content
 */
export function parseSEPMetadata(
  content: string,
  filename: string,
): SEPMetadata | null {
  // Skip template, README, and 0000- placeholder drafts
  if (
    filename === "TEMPLATE.md" ||
    filename === "README.md" ||
    filename.startsWith("0000-")
  ) {
    return null;
  }

  // Extract SEP number and slug from filename (e.g., "1850-pr-based-sep-workflow.md")
  const filenameMatch = filename.match(/^(\d+)-(.+)\.md$/);
  if (!filenameMatch) {
    console.warn(
      `Warning: Skipping ${filename} - doesn't match SEP naming convention`,
    );
    return null;
  }

  const [, number, slug] = filenameMatch;

  // Parse title from first heading
  const titleMatch = content.match(/^#\s+SEP-\d+:\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : "Untitled";

  // Parse metadata fields using regex
  const statusMatch = content.match(/^\s*-\s*\*\*Status\*\*:\s*(.+)$/m);
  const typeMatch = content.match(/^\s*-\s*\*\*Type\*\*:\s*(.+)$/m);
  const createdMatch = content.match(/^\s*-\s*\*\*Created\*\*:\s*(.+)$/m);
  const acceptedMatch = content.match(/^\s*-\s*\*\*Accepted\*\*:\s*(.+)$/m);
  const authorsMatch = content.match(
    /^[ \t]*-[ \t]*\*\*Author\(s\)\*\*:[ \t]*([^\n]*(?:\n[ \t]+(?![-*+][ \t])[^\n]*)*)/m,
  );
  const sponsorMatch = content.match(/^\s*-\s*\*\*Sponsor\*\*:\s*(.+)$/m);
  const prMatch = content.match(/^\s*-\s*\*\*PR\*\*:.*?(?:#|\/pull\/)(\d+)/m);

  return {
    number,
    title,
    status: statusMatch ? statusMatch[1].trim() : "Unknown",
    type: typeMatch ? typeMatch[1].trim() : "Unknown",
    created: createdMatch ? createdMatch[1].trim() : "Unknown",
    accepted: acceptedMatch ? acceptedMatch[1].trim() : undefined,
    authors: authorsMatch
      ? authorsMatch[1].replace(/\s+/g, " ").trim()
      : "Unknown",
    sponsor: sponsorMatch ? sponsorMatch[1].trim() : "None",
    prNumber: prMatch ? prMatch[1] : number,
    slug,
    filename,
  };
}
