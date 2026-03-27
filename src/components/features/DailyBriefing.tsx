"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import { Activity, Search, List, X, AlertTriangle, Clock } from "lucide-react";
import Link from "next/link";

interface BriefingItem {
  id: string;
  icon: React.ReactNode;
  message: string;
  cta: { label: string; href: string };
  type: "activity" | "stale" | "tip";
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return "Burning the midnight oil?";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 21) return "Good evening";
  return "Burning the midnight oil?";
}

export function DailyBriefing() {
  const { data: session } = useSession();
  const [items, setItems] = useState<BriefingItem[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.user?.id) {
      setLoading(false);
      return;
    }

    async function loadBriefing() {
      const briefingItems: BriefingItem[] = [];

      // Check saved developers count
      try {
        const favRes = await fetch("/api/favorites");
        const favData = await favRes.json();
        const favCount = favData.favorites?.length || 0;

        if (favCount === 0) {
          briefingItems.push({
            id: "no-favorites",
            icon: <Search className="h-4 w-4 text-blue-400" />,
            message: "Start building your pipeline — save developers from search results.",
            cta: { label: "Search now", href: "/search" },
            type: "tip",
          });
        } else if (favCount > 0) {
          briefingItems.push({
            id: "favorites-count",
            icon: <Activity className="h-4 w-4 text-emerald-400" />,
            message: `You have ${favCount} saved developer${favCount !== 1 ? "s" : ""}. Check for new activity.`,
            cta: { label: "View saved", href: "/favorites" },
            type: "activity",
          });
        }
      } catch {
        // Ignore
      }

      // Check lists
      try {
        const listsRes = await fetch("/api/lists");
        const listsData = await listsRes.json();
        const lists = listsData.lists || [];

        if (lists.length === 0) {
          briefingItems.push({
            id: "no-lists",
            icon: <List className="h-4 w-4 text-purple-400" />,
            message: "Create your first candidate list to organize your pipeline.",
            cta: { label: "Create list", href: "/lists" },
            type: "tip",
          });
        } else {
          // Find stale lists (placeholder — check updatedAt)
          const staleList = lists.find((l: { updatedAt: string }) => {
            const days = (Date.now() - new Date(l.updatedAt).getTime()) / (1000 * 60 * 60 * 24);
            return days > 7;
          });
          if (staleList) {
            briefingItems.push({
              id: "stale-list",
              icon: <AlertTriangle className="h-4 w-4 text-yellow-400" />,
              message: `Your "${staleList.name}" list hasn't been updated in a while.`,
              cta: { label: "Check it", href: `/lists/${staleList.id}` },
              type: "stale",
            });
          }
        }
      } catch {
        // Ignore
      }

      // Check streak
      const streakKey = "gitscout_active_dates";
      const today = new Date().toISOString().split("T")[0];
      const stored = JSON.parse(localStorage.getItem(streakKey) || "[]") as string[];
      if (!stored.includes(today)) {
        stored.push(today);
        // Keep last 30 days
        const recent = stored.filter((d: string) => {
          const diff = (Date.now() - new Date(d).getTime()) / (1000 * 60 * 60 * 24);
          return diff <= 30;
        });
        localStorage.setItem(streakKey, JSON.stringify(recent));
      }

      // Count consecutive days
      const sorted = stored.sort().reverse();
      let streak = 0;
      for (let i = 0; i < sorted.length; i++) {
        const expected = new Date();
        expected.setDate(expected.getDate() - i);
        if (sorted[i] === expected.toISOString().split("T")[0]) {
          streak++;
        } else break;
      }

      if (streak >= 3) {
        briefingItems.push({
          id: "streak",
          icon: <Clock className="h-4 w-4 text-orange-400" />,
          message: `${streak}-day scouting streak 🔥 Keep hunting.`,
          cta: { label: "Search", href: "/search" },
          type: "activity",
        });
      }

      setItems(briefingItems);
      setLoading(false);
    }

    loadBriefing();
  }, [session?.user?.id]);

  if (!session || loading) return null;

  const visibleItems = items.filter((i) => !dismissed.has(i.id));

  if (visibleItems.length === 0) return null;

  return (
    <div className="space-y-2 mb-6">
      {visibleItems.map((item, i) => (
        <motion.div
          key={item.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1, duration: 0.3 }}
          className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-3 dark:border-neutral-700 dark:bg-neutral-900"
        >
          {item.icon}
          <span className="flex-1 text-sm text-neutral-600 dark:text-neutral-300">
            {item.message}
          </span>
          <Link
            href={item.cta.href}
            className="shrink-0 text-xs font-medium text-blue-600 hover:text-blue-700"
          >
            {item.cta.label}
          </Link>
          <button
            onClick={() => setDismissed((prev) => new Set([...prev, item.id]))}
            className="shrink-0 text-neutral-400 hover:text-neutral-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </motion.div>
      ))}
    </div>
  );
}
