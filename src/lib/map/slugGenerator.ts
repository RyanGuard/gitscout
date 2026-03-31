/**
 * Generates 1-3 slug candidates for ATS board tokens and GitHub org names.
 */
export function generateBoardSlugs(
  companyName: string,
  companyDomain: string
): string[] {
  const slugs = new Set<string>();

  // Company name: lowercased, non-alphanum to hyphens, trim edges
  const nameSlug = companyName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (nameSlug.length > 1) slugs.add(nameSlug);

  // Domain without TLD
  const domainSlug = companyDomain
    .toLowerCase()
    .replace(/^www\./, "")
    .split(".")[0];
  if (domainSlug.length > 1) slugs.add(domainSlug);

  // First word of company name (if >2 chars)
  const firstWord = companyName
    .split(/\s+/)[0]
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  if (firstWord.length > 2 && !slugs.has(firstWord)) slugs.add(firstWord);

  return Array.from(slugs);
}
