import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;

  const developer = await prisma.developer.findUnique({
    where: { username },
    include: {
      languages: { orderBy: { percentage: "desc" } },
      repositories: { orderBy: { stars: "desc" } },
    },
  });

  if (!developer) {
    return Response.json({ error: "Developer not found" }, { status: 404 });
  }

  return Response.json({
    id: developer.id,
    githubId: developer.githubId,
    username: developer.username,
    name: developer.name,
    email: developer.email,
    avatarUrl: developer.avatarUrl,
    bio: developer.bio,
    company: developer.company,
    location: developer.location,
    blog: developer.blog,
    twitterUsername: developer.twitterUsername,
    publicRepos: developer.publicRepos,
    followers: developer.followers,
    following: developer.following,
    hireable: developer.hireable,
    primaryLanguage: developer.primaryLanguage,
    totalCommits: developer.totalCommits,
    totalStars: developer.totalStars,
    score: developer.score,
    languages: developer.languages,
    repositories: developer.repositories.map((r) => ({
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
  });
}
