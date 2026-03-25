export async function GET() {
  return Response.json({
    hasGithubId: !!process.env.GITHUB_ID,
    githubIdLength: process.env.GITHUB_ID?.length ?? 0,
    githubIdPrefix: process.env.GITHUB_ID?.slice(0, 6) ?? "MISSING",
    hasGithubSecret: !!process.env.GITHUB_SECRET,
    secretLength: process.env.GITHUB_SECRET?.length ?? 0,
    hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
    nextAuthUrl: process.env.NEXTAUTH_URL ?? "MISSING",
  });
}
