// Curated seed repositories for each role category
// Contributors to these repos are high-signal candidates
// Weight: 3 = elite/landmark, 2 = strong/notable, 1 = good/respected

export interface SeedRepo {
  owner: string;
  name: string;
  weight: number; // 1-3
}

export interface RoleCategory {
  id: string;
  label: string;
  languages: string[];
  seedRepos: SeedRepo[];
}

export const ROLE_CATEGORIES: RoleCategory[] = [
  {
    id: "frontend",
    label: "Frontend Engineer",
    languages: ["TypeScript", "JavaScript"],
    seedRepos: [
      // Weight 3 — elite
      { owner: "facebook", name: "react", weight: 3 },
      { owner: "vercel", name: "next.js", weight: 3 },
      { owner: "sveltejs", name: "svelte", weight: 3 },
      { owner: "vuejs", name: "core", weight: 3 },
      { owner: "tailwindlabs", name: "tailwindcss", weight: 3 },
      // Weight 2 — strong
      { owner: "remix-run", name: "remix", weight: 2 },
      { owner: "withastro", name: "astro", weight: 2 },
      { owner: "solidjs", name: "solid", weight: 2 },
      { owner: "preactjs", name: "preact", weight: 2 },
      { owner: "radix-ui", name: "primitives", weight: 2 },
      { owner: "shadcn-ui", name: "ui", weight: 2 },
      { owner: "storybookjs", name: "storybook", weight: 2 },
      // Weight 1 — good
      { owner: "pmndrs", name: "zustand", weight: 1 },
      { owner: "TanStack", name: "query", weight: 1 },
      { owner: "framer", name: "motion", weight: 1 },
      { owner: "recharts", name: "recharts", weight: 1 },
    ],
  },
  {
    id: "backend",
    label: "Backend Engineer",
    languages: ["TypeScript", "Python", "Go", "Java", "Rust"],
    seedRepos: [
      // Weight 3
      { owner: "nodejs", name: "node", weight: 3 },
      { owner: "expressjs", name: "express", weight: 3 },
      { owner: "django", name: "django", weight: 3 },
      { owner: "pallets", name: "flask", weight: 3 },
      { owner: "golang", name: "go", weight: 3 },
      // Weight 2
      { owner: "nestjs", name: "nest", weight: 2 },
      { owner: "fastify", name: "fastify", weight: 2 },
      { owner: "tiangolo", name: "fastapi", weight: 2 },
      { owner: "gin-gonic", name: "gin", weight: 2 },
      { owner: "spring-projects", name: "spring-boot", weight: 2 },
      { owner: "prisma", name: "prisma", weight: 2 },
      // Weight 1
      { owner: "trpc", name: "trpc", weight: 1 },
      { owner: "drizzle-team", name: "drizzle-orm", weight: 1 },
      { owner: "encode", name: "starlette", weight: 1 },
      { owner: "labstack", name: "echo", weight: 1 },
    ],
  },
  {
    id: "ml",
    label: "ML / AI Engineer",
    languages: ["Python", "Jupyter Notebook", "C++"],
    seedRepos: [
      // Weight 3
      { owner: "pytorch", name: "pytorch", weight: 3 },
      { owner: "tensorflow", name: "tensorflow", weight: 3 },
      { owner: "huggingface", name: "transformers", weight: 3 },
      { owner: "langchain-ai", name: "langchain", weight: 3 },
      // Weight 2
      { owner: "scikit-learn", name: "scikit-learn", weight: 2 },
      { owner: "openai", name: "openai-python", weight: 2 },
      { owner: "microsoft", name: "DeepSpeed", weight: 2 },
      { owner: "facebookresearch", name: "llama", weight: 2 },
      { owner: "vllm-project", name: "vllm", weight: 2 },
      // Weight 1
      { owner: "ggerganov", name: "llama.cpp", weight: 1 },
      { owner: "mlflow", name: "mlflow", weight: 1 },
      { owner: "ray-project", name: "ray", weight: 1 },
      { owner: "Lightning-AI", name: "pytorch-lightning", weight: 1 },
    ],
  },
  {
    id: "devops",
    label: "DevOps / Infrastructure",
    languages: ["Go", "Python", "Shell", "HCL"],
    seedRepos: [
      // Weight 3
      { owner: "kubernetes", name: "kubernetes", weight: 3 },
      { owner: "hashicorp", name: "terraform", weight: 3 },
      { owner: "docker", name: "compose", weight: 3 },
      { owner: "prometheus", name: "prometheus", weight: 3 },
      // Weight 2
      { owner: "ansible", name: "ansible", weight: 2 },
      { owner: "argoproj", name: "argo-cd", weight: 2 },
      { owner: "grafana", name: "grafana", weight: 2 },
      { owner: "hashicorp", name: "vault", weight: 2 },
      { owner: "pulumi", name: "pulumi", weight: 2 },
      // Weight 1
      { owner: "containers", name: "podman", weight: 1 },
      { owner: "cilium", name: "cilium", weight: 1 },
      { owner: "crossplane", name: "crossplane", weight: 1 },
      { owner: "open-telemetry", name: "opentelemetry-go", weight: 1 },
    ],
  },
  {
    id: "rust",
    label: "Rust Systems",
    languages: ["Rust"],
    seedRepos: [
      // Weight 3
      { owner: "rust-lang", name: "rust", weight: 3 },
      { owner: "denoland", name: "deno", weight: 3 },
      { owner: "tauri-apps", name: "tauri", weight: 3 },
      { owner: "tokio-rs", name: "tokio", weight: 3 },
      // Weight 2
      { owner: "starship", name: "starship", weight: 2 },
      { owner: "BurntSushi", name: "ripgrep", weight: 2 },
      { owner: "sharkdp", name: "bat", weight: 2 },
      { owner: "serde-rs", name: "serde", weight: 2 },
      { owner: "actix", name: "actix-web", weight: 2 },
      // Weight 1
      { owner: "bevyengine", name: "bevy", weight: 1 },
      { owner: "pola-rs", name: "polars", weight: 1 },
      { owner: "swc-project", name: "swc", weight: 1 },
      { owner: "nushell", name: "nushell", weight: 1 },
    ],
  },
  {
    id: "mobile",
    label: "Mobile Developer",
    languages: ["Swift", "Kotlin", "Dart", "TypeScript"],
    seedRepos: [
      // Weight 3
      { owner: "facebook", name: "react-native", weight: 3 },
      { owner: "flutter", name: "flutter", weight: 3 },
      { owner: "expo", name: "expo", weight: 3 },
      // Weight 2
      { owner: "realm", name: "realm-swift", weight: 2 },
      { owner: "airbnb", name: "lottie-ios", weight: 2 },
      { owner: "ReactiveX", name: "RxSwift", weight: 2 },
      { owner: "JetBrains", name: "compose-multiplatform", weight: 2 },
      // Weight 1
      { owner: "nicklockwood", name: "SwiftFormat", weight: 1 },
      { owner: "pointfreeco", name: "swift-composable-architecture", weight: 1 },
      { owner: "cashapp", name: "sqldelight", weight: 1 },
    ],
  },
];

export function getCategoryById(id: string): RoleCategory | undefined {
  return ROLE_CATEGORIES.find((c) => c.id === id);
}

export function getAllSeedRepos(): SeedRepo[] {
  return ROLE_CATEGORIES.flatMap((c) => c.seedRepos);
}
