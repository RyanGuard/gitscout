import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { DeveloperCard } from "@/components/profile/DeveloperCard";
import { Heart } from "lucide-react";
import Link from "next/link";

export default async function FavoritesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/api/auth/signin?callbackUrl=/favorites");

  const favorites = await prisma.favorite.findMany({
    where: { userId: session.user.id },
    include: {
      developer: {
        include: {
          languages: { orderBy: { percentage: "desc" }, take: 5 },
          repositories: { orderBy: { stars: "desc" }, take: 3 },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  if (favorites.length === 0) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-12 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: "rgba(200,165,90,0.08)", border: "1px solid rgba(200,165,90,0.25)" }}>
          <Heart className="h-6 w-6" style={{ color: "#C8A55A" }} />
        </div>
        <h2 className="mt-5 text-lg font-semibold text-neutral-900 dark:text-white">
          Your saved developers
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-neutral-500">
          Star any developer from search results or their profile to save them here.
          Think of it as your personal shortlist across all searches.
        </p>
        <Link
          href="/search"
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-gold px-5 py-2.5 text-sm font-semibold text-white hover:bg-gold-hover"
        >
          Search developers →
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-neutral-900 dark:text-white">
        My Favorites
      </h1>
      <div className="space-y-3">
        {favorites.map((fav) => (
          <DeveloperCard
            key={fav.id}
            developer={{
              ...fav.developer,
              languages: fav.developer.languages,
              repositories: fav.developer.repositories.map((r) => ({
                ...r,
                pushedAt: r.pushedAt?.toISOString() ?? null,
              })),
            }}
          />
        ))}
      </div>
    </div>
  );
}
