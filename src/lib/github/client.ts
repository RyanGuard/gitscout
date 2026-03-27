// GitScout GitHub API Client
// Rate limiting, Supabase caching, retry with exponential backoff, REST + GraphQL

const GITHUB_API = "https://api.github.com";
const GITHUB_GRAPHQL = "https://api.github.com/graphql";

// Cache TTLs in seconds
const CACHE_TTL = {
  user: 86400,        // 24 hours
  repos: 43200,       // 12 hours
  contributors: 21600, // 6 hours
  search: 3600,       // 1 hour
};

interface RateLimitState {
  remaining: number;
  reset: number; // Unix timestamp
}

export class GitHubClient {
  private token: string;
  private rateLimit: RateLimitState = { remaining: Infinity, reset: 0 };
  private searchRateLimit: RateLimitState = { remaining: Infinity, reset: 0 };
  private dbUrl: string;

  constructor() {
    this.token = process.env.GITHUB_TOKEN || "";
    this.dbUrl = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL || "";
  }

  private headers(): HeadersInit {
    const h: HeadersInit = {
      Accept: "application/vnd.github+json",
      "User-Agent": "GitScout/2.0",
    };
    if (this.token) h.Authorization = `Bearer ${this.token}`;
    return h;
  }

  // ─── Rate Limit Management ───

  private updateRateLimit(res: Response, isSearch = false) {
    const remaining = res.headers.get("x-ratelimit-remaining");
    const reset = res.headers.get("x-ratelimit-reset");
    const state = isSearch ? this.searchRateLimit : this.rateLimit;
    if (remaining !== null) state.remaining = parseInt(remaining, 10);
    if (reset !== null) state.reset = parseInt(reset, 10);
  }

  private async waitForRateLimit(isSearch = false) {
    const state = isSearch ? this.searchRateLimit : this.rateLimit;
    if (state.remaining < 100 && state.reset > 0) {
      const waitMs = Math.max(0, state.reset * 1000 - Date.now()) + 1000;
      if (state.remaining < 10) {
        console.log(`[github] Rate limit critical (${state.remaining}), waiting ${Math.ceil(waitMs / 1000)}s`);
        await new Promise((r) => setTimeout(r, waitMs));
      } else {
        // Slow down when under 100 remaining
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }

  // ─── Supabase Cache ───

  private async getCached<T>(key: string): Promise<T | null> {
    if (!this.dbUrl) return null;
    try {
      const { Client } = await import("pg");
      const client = new Client({ connectionString: this.dbUrl });
      await client.connect();
      const result = await client.query(
        `SELECT response, created_at, ttl_seconds FROM api_cache WHERE cache_key = $1`,
        [key]
      );
      await client.end();

      if (result.rows.length === 0) return null;
      const row = result.rows[0];
      const age = (Date.now() - new Date(row.created_at).getTime()) / 1000;
      if (age > row.ttl_seconds) return null; // Expired
      return row.response as T;
    } catch {
      return null;
    }
  }

  private async setCache(key: string, data: unknown, ttl: number) {
    if (!this.dbUrl) return;
    try {
      const { Client } = await import("pg");
      const client = new Client({ connectionString: this.dbUrl });
      await client.connect();
      await client.query(
        `INSERT INTO api_cache (cache_key, response, ttl_seconds) VALUES ($1, $2, $3)
         ON CONFLICT (cache_key) DO UPDATE SET response = $2, created_at = now(), ttl_seconds = $3`,
        [key, JSON.stringify(data), ttl]
      );
      await client.end();
    } catch {
      // Cache write failures are non-fatal
    }
  }

  // ─── Fetch with Retry ───

  private async fetchWithRetry(
    url: string,
    options: { isSearch?: boolean; cacheTtl?: number; cacheKey?: string } = {}
  ): Promise<Response> {
    const { isSearch = false } = options;

    // Check cache first
    if (options.cacheKey && options.cacheTtl) {
      const cached = await this.getCached(options.cacheKey);
      if (cached) {
        return new Response(JSON.stringify(cached), {
          status: 200,
          headers: { "Content-Type": "application/json", "X-Cache": "HIT" },
        });
      }
    }

    const maxAttempts = 3;
    const backoff = [1000, 2000, 4000];

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await this.waitForRateLimit(isSearch);

      const res = await fetch(url, { headers: this.headers() });
      this.updateRateLimit(res, isSearch);

      if (res.ok) {
        // Cache successful responses
        if (options.cacheKey && options.cacheTtl) {
          const data = await res.json();
          await this.setCache(options.cacheKey, data, options.cacheTtl);
          return new Response(JSON.stringify(data), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        return res;
      }

      // 202 = stats being computed, wait and retry
      if (res.status === 202 && attempt < maxAttempts - 1) {
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }

      // Rate limited
      if (res.status === 403 || res.status === 429) {
        const resetHeader = res.headers.get("x-ratelimit-reset");
        if (resetHeader) {
          const waitMs = Math.max(0, parseInt(resetHeader, 10) * 1000 - Date.now()) + 1000;
          console.log(`[github] Rate limited, waiting ${Math.ceil(waitMs / 1000)}s`);
          await new Promise((r) => setTimeout(r, waitMs));
          continue;
        }
      }

      // 404 — don't retry
      if (res.status === 404) return res;

      // 5xx — retry with backoff
      if (res.status >= 500 && attempt < maxAttempts - 1) {
        await new Promise((r) => setTimeout(r, backoff[attempt]));
        continue;
      }

      return res;
    }

    return new Response(JSON.stringify({ error: "All retries failed" }), { status: 500 });
  }

  // ─── REST API Methods ───

  async searchUsers(
    query: string,
    sort = "followers",
    perPage = 30,
    page = 1
  ) {
    const params = new URLSearchParams({ q: query, sort, order: "desc", per_page: String(perPage), page: String(page) });
    const cacheKey = `search:users:${query}:${sort}:${page}`;
    const res = await this.fetchWithRetry(`${GITHUB_API}/search/users?${params}`, {
      isSearch: true,
      cacheKey,
      cacheTtl: CACHE_TTL.search,
    });
    if (!res.ok) return { total_count: 0, items: [] };
    return res.json();
  }

  async searchRepos(
    query: string,
    sort = "stars",
    perPage = 20,
    page = 1
  ) {
    const params = new URLSearchParams({ q: query, sort, order: "desc", per_page: String(perPage), page: String(page) });
    const cacheKey = `search:repos:${query}:${sort}:${page}`;
    const res = await this.fetchWithRetry(`${GITHUB_API}/search/repositories?${params}`, {
      isSearch: true,
      cacheKey,
      cacheTtl: CACHE_TTL.search,
    });
    if (!res.ok) return { total_count: 0, items: [] };
    return res.json();
  }

  async getUser(username: string) {
    const cacheKey = `user:${username}`;
    const res = await this.fetchWithRetry(`${GITHUB_API}/users/${username}`, {
      cacheKey,
      cacheTtl: CACHE_TTL.user,
    });
    if (!res.ok) return null;
    return res.json();
  }

  async getUserRepos(username: string, perPage = 100, sort = "stars") {
    const cacheKey = `repos:${username}:${sort}:${perPage}`;
    const res = await this.fetchWithRetry(
      `${GITHUB_API}/users/${username}/repos?per_page=${perPage}&sort=${sort}&direction=desc`,
      { cacheKey, cacheTtl: CACHE_TTL.repos }
    );
    if (!res.ok) return [];
    return res.json();
  }

  async getRepoContributors(owner: string, repo: string, perPage = 30) {
    const cacheKey = `contributors:${owner}/${repo}:${perPage}`;
    const res = await this.fetchWithRetry(
      `${GITHUB_API}/repos/${owner}/${repo}/contributors?per_page=${perPage}`,
      { cacheKey, cacheTtl: CACHE_TTL.contributors }
    );
    if (!res.ok) return [];
    return res.json();
  }

  async getUserEvents(username: string, perPage = 30) {
    const res = await this.fetchWithRetry(
      `${GITHUB_API}/users/${username}/events/public?per_page=${perPage}`
    );
    if (!res.ok) return [];
    return res.json();
  }

  // ─── GraphQL ───

  async graphql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T | null> {
    if (!this.token) return null;
    await this.waitForRateLimit();

    try {
      const res = await fetch(GITHUB_GRAPHQL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query, variables }),
      });

      this.updateRateLimit(res);
      if (!res.ok) return null;

      const json = await res.json();
      return json.data as T;
    } catch {
      return null;
    }
  }

  // ─── Merged PRs to External Repos (the #1 signal) ───

  async getExternalMergedPRs(username: string): Promise<number> {
    const cacheKey = `external_prs:${username}`;
    const cached = await this.getCached<{ total_count: number }>(cacheKey);
    if (cached) return cached.total_count;

    const q = `author:${username} is:pr is:merged -user:${username}`;
    const res = await this.fetchWithRetry(
      `${GITHUB_API}/search/issues?q=${encodeURIComponent(q)}&per_page=1`,
      { isSearch: true }
    );
    if (!res.ok) return 0;
    const data = await res.json();
    const count = data.total_count ?? 0;
    await this.setCache(cacheKey, { total_count: count }, CACHE_TTL.user);
    return count;
  }

  // ─── Full Enrichment Query (contributions, repos, orgs) ───

  async getEnrichedProfile(username: string) {
    const cacheKey = `enriched:${username}`;
    const cached = await this.getCached<Record<string, unknown>>(cacheKey);
    if (cached) return cached;

    const query = `
      query($login: String!) {
        user(login: $login) {
          contributionsCollection {
            totalCommitContributions
            totalPullRequestContributions
            totalPullRequestReviewContributions
            totalIssueContributions
            restrictedContributionsCount
            contributionCalendar {
              totalContributions
              weeks {
                contributionDays {
                  contributionCount
                  date
                }
              }
            }
          }
          repositories(first: 20, orderBy: {field: STARGAZERS, direction: DESC}, ownerAffiliations: OWNER) {
            nodes {
              name
              stargazerCount
              forkCount
              primaryLanguage { name }
              isFork
              description
              updatedAt
            }
          }
          followers { totalCount }
          following { totalCount }
          organizations(first: 10) {
            nodes { login name }
          }
          sponsorshipsAsMaintainer(first: 1) { totalCount }
          isSponsorable
        }
      }
    `;

    const data = await this.graphql<{ user: Record<string, unknown> }>(query, { login: username });
    if (!data?.user) return null;
    await this.setCache(cacheKey, data.user, CACHE_TTL.user);
    return data.user;
  }

  // ─── Rate Limit Status ───

  getRateLimitStatus() {
    return {
      core: { remaining: this.rateLimit.remaining, resetAt: new Date(this.rateLimit.reset * 1000).toISOString() },
      search: { remaining: this.searchRateLimit.remaining, resetAt: new Date(this.searchRateLimit.reset * 1000).toISOString() },
    };
  }
}

// Singleton
let _client: GitHubClient | null = null;
export function getGitHubClient(): GitHubClient {
  if (!_client) _client = new GitHubClient();
  return _client;
}
