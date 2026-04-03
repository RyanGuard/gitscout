"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Activity, Search, List, X, AlertTriangle, Clock } from "lucide-react";
import Link from "next/link";

type BriefingIconKind = "search" | "activity" | "list" | "stale" | "clock";

interface BriefingItem {
  id: string;
  icon: React.ReactNode;
  message: string;
  cta: { label: string; href: string };
  type: "activity" | "stale" | "tip";
}

interface BriefingItemData {
  id: string;
  iconKind: BriefingIconKind;
  message: string;
  cta: { label: string; href: string };
  type: BriefingItem["type"];
}

function iconFor(kind: BriefingIconKind): React.ReactNode {
  switch (kind) {
    case "search":
      return <Search className="h-4 w-4 text-gold" />;
    case "activity":
      return <Activity className="h-4 w-4 text-emerald-400" />;
    case "list":
      return <List className="h-4 w-4 text-purple-400" />;
    case "stale":
      return <AlertTriangle className="h-4 w-4 text-yellow-400" />;
    case "clock":
      return <Clock className="h-4 w-4 text-orange-400" />;
    default:
      return null;
  }
}

async function fetchBriefingItems(): Promise<BriefingItemData[]> {
  const briefingItems: BriefingItemData[] = [];

  try {
    const favRes = await fetch("/api/favorites");
    const favData = await favRes.json();
    const favCount = favData.favorites?.length || 0;

    if (favCount === 0) {
      briefingItems.push({
        id: "no-favorites",
        iconKind: "search",
        message: "Start building your pipeline — save developers from search results.",
        cta: { label: "Search now", href: "/search" },
        type: "tip",
      });
    } else {
      briefingItems.push({
        id: "favorites-count",
        iconKind: "activity",
        message: `You have ${favCount} saved developer${favCount !== 1 ? "s" : ""}. Check for new activity.`,
        cta: { label: "View saved", href: "/favorites" },
        type: "activity",
      });
    }
  } catch {
    // Ignore
  }

  try {
    const listsRes = await fetch("/api/lists");
    const listsData = await listsRes.json();
    const lists = listsData.lists || [];

    if (lists.length === 0) {
      briefingItems.push({
        id: "no-lists",
        iconKind: "list",
        message: "Create your first candidate list to organize your pipeline.",
        cta: { label: "Create list", href: "/lists" },
        type: "tip",
      });
    } else {
      const staleList = lists.find((l: { updatedAt: string }) => {
        const days = (Date.now() - new Date(l.updatedAt).getTime()) / (1000 * 60 * 60 * 24);
        return days > 7;
      });
      if (staleList) {
        briefingItems.push({
          id: "stale-list",
          iconKind: "stale",
          message: `Your "${staleList.name}" list hasn't been updated in a while.`,
          cta: { label: "Check it", href: `/lists/${staleList.id}` },
          type: "stale",
        });
      }
    }
  } catch {
    // Ignore
  }

  const streakKey = "scout_active_dates";
  const today = new Date().toISOString().split("T")[0];
  const stored: string[] = JSON.parse(localStorage.getItem(streakKey) || "[]");
  if (!stored.includes(today)) {
    stored.push(today);
    const recent = stored.filter((d: string) => {
      const diff = (Date.now() - new Date(d).getTime()) / (1000 * 60 * 60 * 24);
      return diff <= 30;
    });
    localStorage.setItem(streakKey, JSON.stringify(recent));
  }

  const sorted = [...stored].sort().reverse();
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
      iconKind: "clock",
      message: `${streak}-day scouting streak 🔥 Keep hunting.`,
      cta: { label: "Search", href: "/search" },
      type: "activity",
    });
  }

  return briefingItems;
}

export function DailyBriefing() {
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const { data: rawItems = [], isPending } = useQuery({
    queryKey: ["daily-briefing", userId],
    queryFn: fetchBriefingItems,
    enabled: Boolean(userId),
    staleTime: 2 * 60 * 1000,
  });

  const items: BriefingItem[] = rawItems.map((row) => ({
    id: row.id,
    message: row.message,
    cta: row.cta,
    type: row.type,
    icon: iconFor(row.iconKind),
  }));

  if (!session || !userId || isPending) return null;

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
            className="shrink-0 text-xs font-medium text-gold hover:text-gold-hover"
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
