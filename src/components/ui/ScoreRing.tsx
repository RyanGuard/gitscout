"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { getTierInfo } from "./TierBadge";

function getRingColor(score: number): string {
  if (score >= 90) return "#AFA9EC";
  if (score >= 75) return "#EF9F27";
  if (score >= 60) return "#85B7EB";
  if (score >= 40) return "#5DCAA5";
  return "#888780";
}

interface ScoreRingProps {
  score: number;
  size?: number;
}

export function ScoreRing({ score, size = 100 }: ScoreRingProps) {
  const [displayScore, setDisplayScore] = useState(0);
  const [showTier, setShowTier] = useState(false);
  const animRef = useRef<number | null>(null);

  const strokeWidth = size * 0.08;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = getRingColor(score);
  const tier = getTierInfo(score);

  useEffect(() => {
    const duration = 1200;
    const start = performance.now();

    function animate(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayScore(Math.round(eased * score));

      if (progress < 1) {
        animRef.current = requestAnimationFrame(animate);
      } else {
        setShowTier(true);
      }
    }

    animRef.current = requestAnimationFrame(animate);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [score]);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          {/* Background ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeWidth={strokeWidth}
            fill="none"
            className="stroke-neutral-200 dark:stroke-neutral-800"
          />
          {/* Score ring */}
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeWidth={strokeWidth}
            fill="none"
            stroke={color}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.2, ease: [0.4, 0, 0.2, 1] }}
          />
        </svg>
        {/* Score number */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="font-black tabular-nums leading-none"
            style={{ fontSize: size * 0.32, color }}
          >
            {displayScore}
          </span>
          <span className="text-neutral-400" style={{ fontSize: size * 0.12 }}>
            /100
          </span>
        </div>
      </div>

      {/* Tier emoji */}
      <motion.div
        initial={{ opacity: 0, y: 5 }}
        animate={showTier ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.3 }}
      >
        <span className="text-lg">{tier.emoji}</span>
        <span className={`ml-1 text-sm font-semibold ${tier.color}`}>{tier.label}</span>
      </motion.div>
    </div>
  );
}
