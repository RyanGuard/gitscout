import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") || "";
  const languages = searchParams.get("languages")?.split(",").filter(Boolean);
  const location = searchParams.get("location");
  const minStars = searchParams.get("minStars")
    ? parseInt(searchParams.get("minStars")!)
    : undefined;
  const hireable = searchParams.get("hireable") === "true";
  const sort = searchParams.get("sort") || "score";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20")));

  const where: Prisma.DeveloperWhereInput = {};
  const conditions: Prisma.DeveloperWhereInput[] = [];

  if (q) {
    conditions.push({
      OR: [
        { username: { contains: q, mode: "insensitive" } },
        { name: { contains: q, mode: "insensitive" } },
        { bio: { contains: q, mode: "insensitive" } },
        { location: { contains: q, mode: "insensitive" } },
        { primaryLanguage: { contains: q, mode: "insensitive" } },
      ],
    });
  }

  if (languages && languages.length > 0) {
    conditions.push({
      languages: { some: { language: { in: languages } } },
    });
  }

  if (location) {
    conditions.push({
      location: { contains: location, mode: "insensitive" },
    });
  }

  if (minStars !== undefined) {
    conditions.push({ totalStars: { gte: minStars } });
  }

  if (hireable) {
    conditions.push({ hireable: true });
  }

  if (conditions.length > 0) {
    where.AND = conditions;
  }

  const orderBy: Prisma.DeveloperOrderByWithRelationInput =
    sort === "stars"
      ? { totalStars: "desc" }
      : sort === "followers"
        ? { followers: "desc" }
        : sort === "commits"
          ? { totalCommits: "desc" }
          : { score: "desc" };

  const [developers, total] = await Promise.all([
    prisma.developer.findMany({
      where,
      include: { languages: { orderBy: { percentage: "desc" }, take: 5 }, repositories: { orderBy: { stars: "desc" }, take: 3 } },
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.developer.count({ where }),
  ]);

  const mapped = developers.map((d) => ({
    id: d.id,
    githubId: d.githubId,
    username: d.username,
    name: d.name,
    email: d.email,
    avatarUrl: d.avatarUrl,
    bio: d.bio,
    company: d.company,
    location: d.location,
    blog: d.blog,
    twitterUsername: d.twitterUsername,
    publicRepos: d.publicRepos,
    followers: d.followers,
    following: d.following,
    hireable: d.hireable,
    primaryLanguage: d.primaryLanguage,
    totalCommits: d.totalCommits,
    totalStars: d.totalStars,
    score: d.score,
    languages: d.languages,
    repositories: d.repositories.map((r) => ({
      id: r.id,
      name: r.name,
      fullName: r.fullName,
      description: r.description,
      language: r.language,
      stars: r.stars,
      forks: r.forks,
      topics: r.topics,
      pushedAt: r.pushedAt?.toISOString() ?? null,
    })),
  }));

  return Response.json({
    developers: mapped,
    total,
    page,
    totalPages: Math.ceil(total / limit),
    query: q,
  });
}
