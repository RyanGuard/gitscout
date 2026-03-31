import type { ParsedRequirements } from "@/types";

// --- Dictionaries ---

const LANGUAGE_MAP: Record<string, string> = {
  typescript: "TypeScript",
  javascript: "JavaScript",
  python: "Python",
  rust: "Rust",
  go: "Go",
  golang: "Go",
  java: "Java",
  "c++": "C++",
  cpp: "C++",
  c: "C",
  "c#": "C#",
  "c sharp": "C#",
  csharp: "C#",
  ruby: "Ruby",
  php: "PHP",
  swift: "Swift",
  kotlin: "Kotlin",
  scala: "Scala",
  elixir: "Elixir",
  haskell: "Haskell",
  dart: "Dart",
  r: "R",
  lua: "Lua",
  zig: "Zig",
  "objective-c": "Objective-C",
  objc: "Objective-C",
  perl: "Perl",
  shell: "Shell",
  bash: "Shell",
  sql: "SQL",
  html: "HTML",
  css: "CSS",
  clojure: "Clojure",
  erlang: "Erlang",
  julia: "Julia",
  ocaml: "OCaml",
  nim: "Nim",
  groovy: "Groovy",
  fortran: "Fortran",
  cobol: "COBOL",
  assembly: "Assembly",
  solidity: "Solidity",
  move: "Move",
  v: "V",
  crystal: "Crystal",
  f: "F#",
  "f#": "F#",
  fsharp: "F#",
  powershell: "PowerShell",
  ts: "TypeScript",
  js: "JavaScript",
  node: "Node.js",
  "node.js": "Node.js",
  nodejs: "Node.js",
};

// Aliases that should resolve to a framework, not a language
const LANGUAGE_FRAMEWORK_OVERRIDES: Record<string, string> = {
  node: "Node.js",
  "node.js": "Node.js",
  nodejs: "Node.js",
};

export const FRAMEWORK_MAP: Record<string, string> = {
  react: "React",
  "react.js": "React",
  reactjs: "React",
  "next.js": "Next.js",
  nextjs: "Next.js",
  next: "Next.js",
  vue: "Vue",
  "vue.js": "Vue",
  vuejs: "Vue",
  angular: "Angular",
  svelte: "Svelte",
  sveltekit: "SvelteKit",
  express: "Express",
  "express.js": "Express",
  fastify: "Fastify",
  nestjs: "NestJS",
  django: "Django",
  flask: "Flask",
  fastapi: "FastAPI",
  rails: "Rails",
  "ruby on rails": "Rails",
  spring: "Spring",
  "spring boot": "Spring Boot",
  springboot: "Spring Boot",
  laravel: "Laravel",
  phoenix: "Phoenix",
  gin: "Gin",
  fiber: "Fiber",
  actix: "Actix",
  "actix-web": "Actix",
  axum: "Axum",
  tokio: "tokio",
  tonic: "tonic",
  grpc: "gRPC",
  "g-rpc": "gRPC",
  graphql: "GraphQL",
  rest: "REST",
  restful: "REST",
  tailwind: "Tailwind",
  tailwindcss: "Tailwind",
  "tailwind css": "Tailwind",
  bootstrap: "Bootstrap",
  remix: "Remix",
  gatsby: "Gatsby",
  nuxt: "Nuxt",
  "nuxt.js": "Nuxt",
  astro: "Astro",
  htmx: "htmx",
  "react native": "React Native",
  flutter: "Flutter",
  electron: "Electron",
  tauri: "Tauri",
  deno: "Deno",
  bun: "Bun",
};

export const TOOL_MAP: Record<string, string> = {
  docker: "Docker",
  kubernetes: "Kubernetes",
  k8s: "Kubernetes",
  terraform: "Terraform",
  aws: "AWS",
  "amazon web services": "AWS",
  gcp: "GCP",
  "google cloud": "GCP",
  azure: "Azure",
  postgresql: "PostgreSQL",
  postgres: "PostgreSQL",
  mysql: "MySQL",
  mongodb: "MongoDB",
  mongo: "MongoDB",
  redis: "Redis",
  elasticsearch: "Elasticsearch",
  kafka: "Kafka",
  rabbitmq: "RabbitMQ",
  nginx: "Nginx",
  jenkins: "Jenkins",
  "github actions": "GitHub Actions",
  circleci: "CircleCI",
  datadog: "Datadog",
  grafana: "Grafana",
  prometheus: "Prometheus",
  ansible: "Ansible",
  pulumi: "Pulumi",
  vault: "Vault",
  consul: "Consul",
  nomad: "Nomad",
  "new relic": "New Relic",
  sentry: "Sentry",
  supabase: "Supabase",
  firebase: "Firebase",
  vercel: "Vercel",
  netlify: "Netlify",
  heroku: "Heroku",
  dynamodb: "DynamoDB",
  s3: "S3",
  lambda: "Lambda",
  cloudflare: "Cloudflare",
  nats: "NATS",
  cockroachdb: "CockroachDB",
  clickhouse: "ClickHouse",
  snowflake: "Snowflake",
  bigquery: "BigQuery",
  airflow: "Airflow",
  spark: "Spark",
  flink: "Flink",
  git: "Git",
  linux: "Linux",
  "ci/cd": "CI/CD",
};

const SENIORITY_PATTERNS: Array<{ pattern: RegExp; level: string }> = [
  { pattern: /\bprincipal\b/i, level: "principal" },
  { pattern: /\bstaff\b/i, level: "staff" },
  { pattern: /\bsenior\b|\bsr\.?\b/i, level: "senior" },
  { pattern: /\blead\b/i, level: "senior" },
  { pattern: /\bmid[- ]?level\b|\bmid[- ]?senior\b/i, level: "mid" },
  { pattern: /\bjunior\b|\bjr\.?\b/i, level: "junior" },
  { pattern: /\bentry[- ]?level\b/i, level: "junior" },
  { pattern: /\bintern\b/i, level: "junior" },
];

const LOCATION_PATTERNS: Array<{ pattern: RegExp; location: string }> = [
  { pattern: /\bremote\b/i, location: "Remote" },
  { pattern: /\bhybrid\b/i, location: "Hybrid" },
  { pattern: /\bon[- ]?site\b/i, location: "On-site" },
];

// Major cities for location extraction
const CITIES = [
  "San Francisco", "New York", "Los Angeles", "Chicago", "Seattle",
  "Austin", "Boston", "Denver", "Portland", "San Diego",
  "San Jose", "Washington DC", "Atlanta", "Dallas", "Miami",
  "Philadelphia", "Phoenix", "Minneapolis", "Detroit", "Nashville",
  "London", "Berlin", "Paris", "Amsterdam", "Dublin",
  "Toronto", "Vancouver", "Montreal", "Sydney", "Melbourne",
  "Singapore", "Tokyo", "Bangalore", "Hyderabad", "Tel Aviv",
  "Stockholm", "Copenhagen", "Oslo", "Helsinki", "Zurich",
  "Munich", "Barcelona", "Lisbon", "Warsaw", "Prague",
];

const KEYWORD_PATTERNS = [
  "full-stack", "full stack", "fullstack",
  "backend", "back-end", "back end",
  "frontend", "front-end", "front end",
  "devops", "dev-ops",
  "machine learning", "ml",
  "data engineering", "data science",
  "distributed systems", "microservices",
  "high-performance", "low-latency",
  "real-time", "realtime",
  "embedded", "systems programming",
  "cloud native", "cloud-native",
  "infrastructure", "platform engineering",
  "security", "cybersecurity",
  "blockchain", "web3",
  "mobile", "ios", "android",
  "site reliability", "sre",
  "observability", "monitoring",
  "api design", "api development",
  "compiler", "language design",
];

// --- Parser ---

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchDictionary(
  text: string,
  dict: Record<string, string>,
  wordBoundary = true
): string[] {
  const found = new Set<string>();
  const lower = text.toLowerCase();

  // Sort keys by length (longest first) to match multi-word terms first
  const keys = Object.keys(dict).sort((a, b) => b.length - a.length);

  for (const key of keys) {
    const escaped = escapeRegex(key);
    const pattern = wordBoundary
      ? new RegExp(`\\b${escaped}\\b`, "i")
      : new RegExp(escaped, "i");

    if (pattern.test(lower)) {
      found.add(dict[key]);
    }
  }
  return [...found].sort();
}

function extractYearsExperience(text: string): number | null {
  const match = text.match(/(\d+)\+?\s*years?/i);
  return match ? parseInt(match[1], 10) : null;
}

function extractSeniority(text: string): string | null {
  for (const { pattern, level } of SENIORITY_PATTERNS) {
    if (pattern.test(text)) return level;
  }
  return null;
}

function extractLocation(text: string): string | null {
  // Check for remote/hybrid/on-site first
  for (const { pattern, location } of LOCATION_PATTERNS) {
    if (pattern.test(text)) return location;
  }

  // Check for city names (case-insensitive)
  for (const city of CITIES) {
    const escaped = escapeRegex(city);
    if (new RegExp(`\\b${escaped}\\b`, "i").test(text)) {
      return city;
    }
  }

  return null;
}

function extractKeywords(text: string): string[] {
  const found: string[] = [];
  const lower = text.toLowerCase();

  for (const kw of KEYWORD_PATTERNS) {
    const escaped = escapeRegex(kw);
    if (new RegExp(`\\b${escaped}\\b`, "i").test(lower)) {
      // Normalize to the canonical form
      const normalized = kw.replace(/-/g, "-");
      if (!found.includes(normalized)) {
        found.push(normalized);
      }
    }
  }
  return found.sort();
}

export function parseJobDescription(text: string): ParsedRequirements {
  // Extract languages, but exclude terms that are frameworks
  const rawLanguages = matchDictionary(text, LANGUAGE_MAP);
  const frameworkOverrideValues = new Set(
    Object.values(LANGUAGE_FRAMEWORK_OVERRIDES)
  );

  const languages = rawLanguages.filter(
    (lang) => !frameworkOverrideValues.has(lang)
  );

  const frameworks = matchDictionary(text, FRAMEWORK_MAP);
  // Add any language aliases that are actually frameworks
  for (const lang of rawLanguages) {
    if (frameworkOverrideValues.has(lang) && !frameworks.includes(lang)) {
      frameworks.push(lang);
    }
  }
  frameworks.sort();

  const tools = matchDictionary(text, TOOL_MAP);
  const location = extractLocation(text);
  const seniority = extractSeniority(text);
  const keywords = extractKeywords(text);
  const yearsExperience = extractYearsExperience(text);

  return {
    languages,
    frameworks,
    tools,
    location,
    seniority,
    keywords,
    yearsExperience,
  };
}
