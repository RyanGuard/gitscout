// Returns indexed developer counts per target city

import { prisma } from "@/lib/prisma";
import { TARGET_CITIES, matchesLocation } from "@/lib/search/locationMatch";

export async function GET() {
  // Get all developers with locations
  const developers = await prisma.developer.findMany({
    where: { location: { not: null } },
    select: { location: true },
  });

  // Count matches per city
  const counts = TARGET_CITIES.map((city) => {
    const count = developers.filter((d) =>
      matchesLocation(d.location, city.aliases[0])
    ).length;
    return { cityId: city.id, count };
  });

  return Response.json(counts);
}
