"use client";

import { motion, AnimatePresence } from "framer-motion";

interface AnimatedResultsListProps {
  children: React.ReactNode[];
  searchKey?: string; // Changes when a new search is made, triggering re-animation
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.15 },
  },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: "easeOut" as const },
  },
};

export function AnimatedResultsList({ children, searchKey }: AnimatedResultsListProps) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={searchKey || "results"}
        variants={container}
        initial="hidden"
        animate="show"
        exit="exit"
        className="space-y-3"
      >
        {children.map((child, i) => (
          <motion.div
            key={i}
            variants={item}
            style={{
              // Cap stagger at 15 items
              transitionDelay: `${Math.min(i, 15) * 0.08}s`,
            }}
          >
            {child}
          </motion.div>
        ))}
      </motion.div>
    </AnimatePresence>
  );
}
