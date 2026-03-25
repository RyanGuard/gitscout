export interface DeveloperProfile {
  id: string;
  githubId: number;
  username: string;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  bio: string | null;
  company: string | null;
  location: string | null;
  blog: string | null;
  twitterUsername: string | null;
  publicRepos: number;
  followers: number;
  following: number;
  hireable: boolean;
  primaryLanguage: string | null;
  totalCommits: number;
  totalStars: number;
  score: number;
  languages: LanguageStat[];
  repositories: RepositorySummary[];
}

export interface LanguageStat {
  language: string;
  bytes: number;
  repoCount: number;
  percentage: number;
}

export interface RepositorySummary {
  id: string;
  name: string;
  fullName: string;
  description: string | null;
  language: string | null;
  stars: number;
  forks: number;
  topics: string[];
  pushedAt: string | null;
}

export interface SearchQuery {
  q: string;
  languages?: string[];
  location?: string;
  minStars?: number;
  minRepos?: number;
  hireable?: boolean;
  sort?: "score" | "stars" | "followers" | "commits";
  page?: number;
  limit?: number;
}

export interface SearchResult {
  developers: DeveloperProfile[];
  total: number;
  page: number;
  totalPages: number;
  query: string;
}

export interface GitHubEvent {
  id: string;
  type: string;
  actor: {
    id: number;
    login: string;
    display_login: string;
    avatar_url: string;
    url: string;
  };
  repo: {
    id: number;
    name: string;
    url: string;
  };
  payload: Record<string, unknown>;
  public: boolean;
  created_at: string;
}

export interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string;
  bio: string | null;
  company: string | null;
  location: string | null;
  blog: string | null;
  twitter_username: string | null;
  public_repos: number;
  followers: number;
  following: number;
  hireable: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  watchers_count: number;
  fork: boolean;
  archived: boolean;
  topics: string[];
  homepage: string | null;
  default_branch: string;
  pushed_at: string | null;
  created_at: string;
  updated_at: string;
  owner: {
    login: string;
    id: number;
  };
}

export interface PipelineStats {
  totalDevelopers: number;
  totalRepositories: number;
  totalActivities: number;
  lastSyncedAt: string | null;
}
