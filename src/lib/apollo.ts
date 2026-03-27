const APOLLO_API = "https://api.apollo.io/api/v1";

export interface ApolloPersonMatch {
  id: string | null;
  email: string | null;
  phone_numbers: Array<{ sanitized_number: string }> | null;
  linkedin_url: string | null;
  twitter_url: string | null;
  title: string | null;
  headline: string | null;
  photo_url: string | null;
  seniority: string | null;
  organization_name: string | null;
  employment_history: Array<{
    organization_name: string;
    title: string | null;
    current: boolean;
    start_date: string | null;
  }> | null;
}

async function apolloMatch(
  body: Record<string, string>,
): Promise<ApolloPersonMatch | null> {
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) return null;

  const res = await fetch(`${APOLLO_API}/people/match`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) return null;
  const data = await res.json();
  return data.person || null;
}

function splitName(fullName: string): {
  first_name: string;
  last_name?: string;
} {
  const trimmed = fullName.trim();
  const spaceIdx = trimmed.indexOf(" ");
  if (spaceIdx === -1) return { first_name: trimmed };
  return {
    first_name: trimmed.slice(0, spaceIdx),
    last_name: trimmed.slice(spaceIdx + 1),
  };
}

function cleanCompany(raw: string): string {
  return raw.replace(/^@/, "").trim();
}

export interface EnrichFromApolloParams {
  name?: string | null;
  company?: string | null;
  email?: string | null;
  linkedinUrl?: string | null;
  githubUsername?: string | null;
}

export async function enrichFromApollo(
  params: EnrichFromApolloParams,
): Promise<ApolloPersonMatch | null> {
  // Strategy 1: name + company
  if (params.name && params.company) {
    const { first_name, last_name } = splitName(params.name);
    const body: Record<string, string> = {
      first_name,
      organization_name: cleanCompany(params.company),
    };
    if (last_name) body.last_name = last_name;
    const result = await apolloMatch(body);
    if (result?.email || result?.linkedin_url) return result;
  }

  // Strategy 2: LinkedIn URL
  if (params.linkedinUrl) {
    const result = await apolloMatch({ linkedin_url: params.linkedinUrl });
    if (result?.email || result?.linkedin_url) return result;
  }

  // Strategy 3: Email
  if (params.email) {
    const result = await apolloMatch({ email: params.email });
    if (result?.email || result?.linkedin_url) return result;
  }

  // Strategy 4: GitHub URL (lowest match rate)
  if (params.githubUsername) {
    const result = await apolloMatch({
      github_url: `https://github.com/${params.githubUsername}`,
    });
    if (result) return result;
  }

  return null;
}
