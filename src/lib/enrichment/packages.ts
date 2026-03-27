// Package registry enrichment — checks npm, PyPI, crates.io for maintainership

export interface PackageInfo {
  registry: "npm" | "pypi" | "crates";
  name: string;
  description: string | null;
  weeklyDownloads: number;
  version: string;
  homepage: string | null;
}

export interface PackageEnrichment {
  packages: PackageInfo[];
  totalDownloads: number;
  topPackage: string | null;
  registries: string[];
  packageMaintainerScore: number; // 0-100 based on package popularity
}

// ── npm ──

async function fetchNpmPackages(username: string): Promise<PackageInfo[]> {
  try {
    // npm registry search by maintainer
    const res = await fetch(
      `https://registry.npmjs.org/-/v1/search?text=maintainer:${encodeURIComponent(username)}&size=20`,
      { next: { revalidate: 86400 } } // cache 24h
    );
    if (!res.ok) return [];
    const data = await res.json();

    const packages: PackageInfo[] = [];
    for (const obj of data.objects || []) {
      const pkg = obj.package;
      // Get download count
      let weeklyDownloads = 0;
      try {
        const dlRes = await fetch(
          `https://api.npmjs.org/downloads/point/last-week/${encodeURIComponent(pkg.name)}`
        );
        if (dlRes.ok) {
          const dlData = await dlRes.json();
          weeklyDownloads = dlData.downloads || 0;
        }
      } catch {
        // skip download count on error
      }

      packages.push({
        registry: "npm",
        name: pkg.name,
        description: pkg.description || null,
        weeklyDownloads,
        version: pkg.version,
        homepage: pkg.links?.homepage || pkg.links?.npm || null,
      });
    }

    return packages.sort((a, b) => b.weeklyDownloads - a.weeklyDownloads);
  } catch {
    return [];
  }
}

// ── PyPI ──

async function fetchPyPIPackages(username: string): Promise<PackageInfo[]> {
  // PyPI doesn't have a maintainer search API, but we can check known package names
  // that match the GitHub username pattern. Check if user has a package named after them
  // or their popular repos.
  try {
    // Try the username as a package name first
    const candidates = [username, username.toLowerCase().replace(/-/g, "_")];
    const packages: PackageInfo[] = [];

    for (const name of candidates) {
      try {
        const res = await fetch(`https://pypi.org/pypi/${name}/json`, {
          next: { revalidate: 86400 },
        });
        if (!res.ok) continue;
        const data = await res.json();
        const info = data.info;

        // Verify the author matches
        const authorMatch =
          info.author?.toLowerCase().includes(username.toLowerCase()) ||
          info.author_email?.toLowerCase().includes(username.toLowerCase()) ||
          info.maintainer?.toLowerCase().includes(username.toLowerCase()) ||
          (info.project_urls?.Source || "").toLowerCase().includes(username.toLowerCase());

        if (!authorMatch) continue;

        // Get download stats from pypistats
        let weeklyDownloads = 0;
        try {
          const statsRes = await fetch(
            `https://pypistats.org/api/packages/${name}/recent?period=week`
          );
          if (statsRes.ok) {
            const statsData = await statsRes.json();
            weeklyDownloads = statsData.data?.last_week || 0;
          }
        } catch {
          // skip
        }

        packages.push({
          registry: "pypi",
          name: info.name,
          description: info.summary || null,
          weeklyDownloads,
          version: info.version,
          homepage: info.home_page || info.project_urls?.Homepage || null,
        });
      } catch {
        continue;
      }
    }

    return packages;
  } catch {
    return [];
  }
}

// ── crates.io ──

async function fetchCratesPackages(username: string): Promise<PackageInfo[]> {
  try {
    const res = await fetch(
      `https://crates.io/api/v1/crates?user_id=${encodeURIComponent(username)}&per_page=20&sort=downloads`,
      {
        headers: { "User-Agent": "Scout/1.0 (https://gitscout.dev)" },
        next: { revalidate: 86400 },
      }
    );

    // crates.io user_id needs the numeric ID, try searching by keyword instead
    if (!res.ok) {
      // Fallback: search crates by username
      const searchRes = await fetch(
        `https://crates.io/api/v1/crates?q=${encodeURIComponent(username)}&per_page=10`,
        {
          headers: { "User-Agent": "Scout/1.0 (https://gitscout.dev)" },
          next: { revalidate: 86400 },
        }
      );
      if (!searchRes.ok) return [];
      const searchData = await searchRes.json();

      return (searchData.crates || [])
        .filter(
          (c: { repository?: string }) =>
            c.repository?.toLowerCase().includes(username.toLowerCase())
        )
        .slice(0, 10)
        .map(
          (c: {
            name: string;
            description: string | null;
            recent_downloads: number;
            max_version: string;
            homepage: string | null;
          }) => ({
            registry: "crates" as const,
            name: c.name,
            description: c.description || null,
            weeklyDownloads: c.recent_downloads || 0,
            version: c.max_version,
            homepage: c.homepage || null,
          })
        );
    }

    const data = await res.json();
    return (data.crates || []).map(
      (c: {
        name: string;
        description: string | null;
        recent_downloads: number;
        max_version: string;
        homepage: string | null;
      }) => ({
        registry: "crates" as const,
        name: c.name,
        description: c.description || null,
        weeklyDownloads: c.recent_downloads || 0,
        version: c.max_version,
        homepage: c.homepage || null,
      })
    );
  } catch {
    return [];
  }
}

// ── Scoring ──

function computePackageMaintainerScore(packages: PackageInfo[]): number {
  if (packages.length === 0) return 0;

  const totalDownloads = packages.reduce((s, p) => s + p.weeklyDownloads, 0);
  const topDownloads = packages[0]?.weeklyDownloads || 0;

  // Package count signal
  const countScore = Math.min(30, packages.length * 5);

  // Download volume signal (logarithmic)
  // 100/wk = 10, 1K/wk = 20, 10K/wk = 30, 100K/wk = 40, 1M/wk = 50
  const downloadScore = totalDownloads > 0
    ? Math.min(50, Math.log10(totalDownloads) * 10)
    : 0;

  // Top package signal
  const topScore = topDownloads > 100000 ? 20 : topDownloads > 10000 ? 15 : topDownloads > 1000 ? 10 : topDownloads > 100 ? 5 : 0;

  return Math.min(100, Math.round(countScore + downloadScore + topScore));
}

// ── Main Enrichment Function ──

export async function enrichPackages(
  username: string,
  primaryLanguage?: string | null
): Promise<PackageEnrichment> {
  // Run relevant registry lookups based on primary language
  const lookups: Promise<PackageInfo[]>[] = [];

  // Always check npm (most developers have JS/TS packages)
  lookups.push(fetchNpmPackages(username));

  // Check PyPI for Python developers
  if (!primaryLanguage || primaryLanguage === "Python" || primaryLanguage === "Jupyter Notebook") {
    lookups.push(fetchPyPIPackages(username));
  }

  // Check crates.io for Rust developers
  if (!primaryLanguage || primaryLanguage === "Rust") {
    lookups.push(fetchCratesPackages(username));
  }

  const results = await Promise.all(lookups);
  const allPackages = results
    .flat()
    .sort((a, b) => b.weeklyDownloads - a.weeklyDownloads);

  const totalDownloads = allPackages.reduce((s, p) => s + p.weeklyDownloads, 0);
  const registries = [...new Set(allPackages.map((p) => p.registry))];

  return {
    packages: allPackages,
    totalDownloads,
    topPackage: allPackages[0]?.name || null,
    registries,
    packageMaintainerScore: computePackageMaintainerScore(allPackages),
  };
}
