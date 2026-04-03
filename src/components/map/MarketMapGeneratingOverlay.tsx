"use client";

import { useEffect, useState } from "react";
import { useIsClient } from "@/lib/use-is-client";
import { createPortal } from "react-dom";
import { Map, Sparkles } from "lucide-react";

type Kind = "generate" | "search";

const GENERATE_PHASES: { title: string; body: (ctx: string) => string }[] = [
  {
    title: "Mapping the market",
    body: (ctx) =>
      `For “${ctx}”, we’re drawing where this hire really lives—companies, clusters, and pockets worth your time, not a flat list of names.`,
  },
  {
    title: "Reading the territory",
    body: () =>
      "We blend role fit, footprint, and signals you’d normally pay a research team for. You’re about to see the landscape, not a spreadsheet.",
  },
  {
    title: "Placing anchor companies",
    body: () =>
      "Your tiers are taking shape: who competes for this talent, who’s adjacent, and where the strongest candidates tend to sit.",
  },
  {
    title: "One more beat",
    body: () =>
      "Good maps take a moment to resolve. When this clears, you’ll have something you can actually walk a hiring manager through—with confidence.",
  },
];

const SEARCH_PHASES: { title: string; body: (ctx: string) => string }[] = [
  {
    title: "Scanning the landscape",
    body: (ctx) =>
      ctx
        ? `Filtering the market with your criteria—“${ctx}”—so every row on the next screen earns its place.`
        : "Filtering the market with your criteria so every row on the next screen earns its place.",
  },
  {
    title: "Lining up matches",
    body: () => "Pulling companies you can drop straight onto your map—ready when you are.",
  },
];

interface Props {
  show: boolean;
  /** Role title, stack summary, or short filter hint for personalization */
  focusLabel: string;
  kind: Kind;
}

export function MarketMapGeneratingOverlay({ show, focusLabel, kind }: Props) {
  const mounted = useIsClient();
  const [phase, setPhase] = useState(0);

  const phases = kind === "search" ? SEARCH_PHASES : GENERATE_PHASES;
  const intervalMs = kind === "search" ? 2200 : 3200;
  const ctx =
    focusLabel.trim() ||
    (kind === "search" ? "your filters" : "this search");

  useEffect(() => {
    if (!show) {
      queueMicrotask(() => setPhase(0));
      return;
    }
    const id = window.setInterval(() => {
      setPhase((p) => (p + 1) % phases.length);
    }, intervalMs);
    return () => clearInterval(id);
  }, [show, phases.length, intervalMs]);

  useEffect(() => {
    if (!show) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [show]);

  if (!mounted || !show) return null;

  const { title, body } = phases[phase];

  const node = (
    <div
      className="map-gen-overlay fixed inset-0 z-[300] flex items-center justify-center p-5 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="map-gen-title"
      aria-describedby="map-gen-desc"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-amber-950/88 via-neutral-950/92 to-orange-950/85 backdrop-blur-md dark:from-amber-950/90 dark:via-neutral-950/94 dark:to-orange-950/88" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(251,191,36,0.12),transparent)]" />

      <div className="relative z-[1] w-full max-w-lg">
        <div className="map-hud-card overflow-hidden border-amber-200/25 bg-white/90 shadow-[0_0_80px_rgba(251,191,36,0.12)] dark:border-amber-500/15 dark:bg-neutral-950/80 dark:shadow-[0_0_100px_rgba(251,191,36,0.08)]">
          <div className="map-hud-beam opacity-90" aria-hidden />

          <div className="px-6 pb-7 pt-2 sm:px-8 sm:pb-8">
            <div className="mb-6 flex items-center justify-center">
              <div className="relative h-[200px] w-[200px] sm:h-[220px] sm:w-[220px]">
                <div
                  className="map-gen-radar-sweep pointer-events-none absolute inset-0 rounded-full"
                  aria-hidden
                />
                <svg
                  className="map-gen-lines absolute inset-0 h-full w-full text-amber-400/35 dark:text-amber-400/25"
                  viewBox="0 0 200 200"
                  aria-hidden
                >
                  {[0, 60, 120, 180, 240, 300].map((deg, i) => {
                    const rad = (deg * Math.PI) / 180;
                    const x2 = 100 + 78 * Math.cos(rad - Math.PI / 2);
                    const y2 = 100 + 78 * Math.sin(rad - Math.PI / 2);
                    return (
                      <line
                        key={deg}
                        x1="100"
                        y1="100"
                        x2={x2}
                        y2={y2}
                        stroke="currentColor"
                        strokeWidth="1"
                        strokeDasharray="4 3"
                        className="map-gen-line"
                        style={{ animationDelay: `${i * 0.35}s` }}
                      />
                    );
                  })}
                </svg>
                {[0, 60, 120, 180, 240, 300].map((deg, i) => {
                  const rad = (deg * Math.PI) / 180;
                  const x = 50 + 39 * Math.cos(rad - Math.PI / 2);
                  const y = 50 + 39 * Math.sin(rad - Math.PI / 2);
                  return (
                    <div
                      key={deg}
                      className="map-gen-node pointer-events-none absolute h-2.5 w-2.5 rounded-full bg-gradient-to-br from-amber-300 to-amber-600 shadow-[0_0_12px_rgba(251,191,36,0.7)] dark:from-amber-200 dark:to-amber-500"
                      style={{
                        left: `${x}%`,
                        top: `${y}%`,
                        transform: "translate(-50%, -50%)",
                        animationDelay: `${i * 0.25}s`,
                      }}
                      aria-hidden
                    />
                  );
                })}
                <div className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-2xl border border-amber-400/40 bg-gradient-to-br from-amber-100/90 to-amber-50 shadow-[0_0_28px_rgba(251,191,36,0.35)] dark:border-amber-400/30 dark:from-amber-500/20 dark:to-amber-700/20 dark:shadow-[0_0_32px_rgba(251,191,36,0.25)]">
                  <Map className="h-7 w-7 text-amber-800 dark:text-amber-200" strokeWidth={1.75} />
                </div>
              </div>
            </div>

            <div className="text-center">
              <p className="mb-1 flex items-center justify-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-800/80 dark:text-amber-200/60">
                <Sparkles className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                {kind === "search" ? "Market sweep" : "Live market map"}
              </p>
              <h2
                id="map-gen-title"
                key={phase}
                className="map-gen-phase-title text-xl font-semibold tracking-tight text-neutral-900 dark:text-amber-50 sm:text-2xl"
              >
                {title}
              </h2>
              <p
                id="map-gen-desc"
                key={`${phase}-body`}
                className="map-gen-phase-body mt-3 text-sm leading-relaxed text-neutral-600 dark:text-amber-100/65"
              >
                {body(ctx)}
              </p>
            </div>

            <div className="mt-6 flex justify-center gap-1.5" aria-hidden>
              {phases.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-500 ${
                    i === phase
                      ? "w-6 bg-amber-500 dark:bg-amber-400"
                      : "w-1.5 bg-amber-800/15 dark:bg-amber-200/20"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(node, document.body);
}
