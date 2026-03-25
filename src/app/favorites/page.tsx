import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { DeveloperCard } from "@/components/profile/DeveloperCard";
import { Heart } from "lucide-react";
import Link from "next/link";

export default async function FavoritesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/");

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
      <div className="mx-auto w-full max-w-4xl px-4 py-16 text-center">
        <Heart className="mx-auto h-12 w-12 text-neutral-300 dark:text-neutral-600" />
        <h2 className="mt-4 text-lg font-medium text-neutral-600 dark:text-neutral-400">
          No favorites yet
        </h2>
        <p className="mt-1 text-sm text-neutral-500">
          Save developers from search results or profile pages to see them here.
        </p>
        <Link
          href="/search"
          className="mt-4 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Search developers
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
