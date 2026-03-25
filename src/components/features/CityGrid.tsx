"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { TARGET_CITIES, type TargetCity } from "@/lib/search/locationMatch";
import { useEffect, useState } from "react";

interface CityCount {
  cityId: string;
  count: number;
}

export function CityGrid() {
  const router = useRouter();
  const [counts, setCounts] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    // Fetch indexed counts per city from our DB
    fetch("/api/stats/cities")
      .then((r) => r.json())
      .then((data: CityCount[]) => {
        const map = new Map<string, number>();
        for (const c of data) map.set(c.cityId, c.count);
        setCounts(map);
      })
      .catch(() => {});
  }, []);

  function handleCityClick(city: TargetCity) {
    // Search with the city's primary alias
    const query = city.aliases[0];
    router.push(`/search?q=${encodeURIComponent(query)}`);
  }

  const tier1 = TARGET_CITIES.filter((c) => c.tier === 1);
  const tier2 = TARGET_CITIES.filter((c) => c.tier === 2);
  const tier3 = TARGET_CITIES.filter((c) => c.tier === 3);

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-700 dark:bg-neutral-900">
      <h2 className="text-sm font-semibold text-neutral-900 dark:text-white mb-4">
        Popular Markets
      </h2>

      {/* Tier 1 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
        {tier1.map((city, i) => (
          <CityCard key={city.id} city={city} count={counts.get(city.id)} onClick={() => handleCityClick(city)} delay={i * 0.05} />
        ))}
      </div>

      {/* Tier 2 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
        {tier2.map((city, i) => (
          <CityCard key={city.id} city={city} count={counts.get(city.id)} onClick={() => handleCityClick(city)} delay={(i + 4) * 0.05} />
        ))}
      </div>

      {/* Tier 3 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {tier3.slice(0, 8).map((city, i) => (
          <CityCard key={city.id} city={city} count={counts.get(city.id)} onClick={() => handleCityClick(city)} delay={(i + 8) * 0.05} />
        ))}
      </div>
    </div>
  );
}

function CityCard({
  city,
  count,
  onClick,
  delay,
}: {
  city: TargetCity;
  count?: number;
  onClick: () => void;
  delay: number;
}) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.2 }}
      onClick={onClick}
      className="flex flex-col items-start rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2.5 text-left transition-all hover:border-blue-300 hover:bg-blue-50 dark:border-neutral-800 dark:bg-neutral-800/50 dark:hover:border-blue-600 dark:hover:bg-blue-950/30"
    >
      <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
        {city.flag} {city.displayName}
      </span>
      <span className="text-xs text-neutral-500 tabular-nums">
        {count ? `${count.toLocaleString()} devs` : "Search →"}
      </span>
    </motion.button>
  );
}
