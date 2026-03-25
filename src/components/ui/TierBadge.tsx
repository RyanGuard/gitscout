"use client";

import { motion } from "framer-motion";

interface TierInfo {
  emoji: string;
  label: string;
  color: string;
  bgClass: string;
  range: string;
}

export function getTierInfo(score: number): TierInfo {
  if (score >= 90) return { emoji: "🦄", label: "Unicorn", color: "text-violet-400", bgClass: "bg-violet-500/10 border-violet-500/20", range: "90-100" };
  if (score >= 75) return { emoji: "🔥", label: "On Fire", color: "text-amber-400", bgClass: "bg-amber-500/10 border-amber-500/20", range: "75-89" };
  if (score >= 60) return { emoji: "💎", label: "Gem", color: "text-cyan-400", bgClass: "bg-cyan-500/10 border-cyan-500/20", range: "60-74" };
  if (score >= 40) return { emoji: "🌱", label: "Seedling", color: "text-green-400", bgClass: "bg-green-500/10 border-green-500/20", range: "40-59" };
  return { emoji: "🌫️", label: "Mystery", color: "text-neutral-400", bgClass: "bg-neutral-500/10 border-neutral-500/20", range: "0-39" };
}

interface TierBadgeProps {
  score: number;
  size?: "sm" | "md" | "lg";
}

export function TierBadge({ score, size = "md" }: TierBadgeProps) {
  const tier = getTierInfo(score);
  const isUnicorn = score >= 90;

  if (size === "sm") {
    return (
      <motion.span
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 400, damping: 15 }}
        className={`inline-flex ${isUnicorn ? "animate-shimmer" : ""}`}
        title={`${tier.label} (${tier.range})`}
      >
        {tier.emoji}
      </motion.span>
    );
  }

  if (size === "lg") {
    return (
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 400, damping: 15 }}
        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 ${tier.bgClass}`}
      >
        <span className={`text-lg ${isUnicorn ? "animate-shimmer" : ""}`}>{tier.emoji}</span>
        <span className={`text-sm font-semibold ${tier.color}`}>{tier.label}</span>
        <span className="text-xs text-neutral-500">{tier.range}</span>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ scale: 0.5, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 15 }}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${tier.bgClass}`}
    >
      <span className={isUnicorn ? "animate-shimmer" : ""}>{tier.emoji}</span>
      <span className={`text-xs font-semibold ${tier.color}`}>{tier.label}</span>
    </motion.div>
  );
}
