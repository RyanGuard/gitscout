"use client";

import { useState, useMemo } from "react";

interface CompanyTimelineProps {
  candidates: Array<{
    id: string;
    name: string;
    tenureMonths: number | null;
    fitScore: number | null;
    status: string;
  }>;
  newsEvents: Array<{
    event_type: string;
    severity: string;
    summary: string;
    date: string;
  }> | null;
  headcount: number | null;
  engHeadcount: number | null;
}

const STATUS_COLORS: Record<string, string> = {
  shortlisted: "#C8A55A",
  contacted: "#fbbf24",
  mapped: "#737373",
};

const EVENT_COLORS: Record<string, string> = {
  LAYOFFS: "#f87171",
  FUNDING: "#34d399",
  ACQUISITION: "#60a5fa",
  LEADERSHIP_CHANGE: "#fbbf24",
  REORG: "#fb923c",
};

function getStatusColor(status: string): string {
  return STATUS_COLORS[status] || "#737373";
}

function getEventColor(eventType: string): string {
  return EVENT_COLORS[eventType] || "#a3a3a3";
}

export default function CompanyTimeline({
  candidates,
  newsEvents,
  headcount,
  engHeadcount,
}: CompanyTimelineProps) {
  const [expanded, setExpanded] = useState(false);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    text: string;
  } | null>(null);

  const hasTenureData = candidates.some((c) => c.tenureMonths != null && c.tenureMonths > 0);

  const timeRange = useMemo(() => {
    if (!hasTenureData) return { minMonths: 12, maxMonths: 12 };
    const maxTenure = Math.max(
      ...candidates
        .filter((c) => c.tenureMonths != null)
        .map((c) => c.tenureMonths!)
    );
    const totalMonths = Math.max(12, Math.min(60, maxTenure + 3));
    return { minMonths: 0, maxMonths: totalMonths };
  }, [candidates, hasTenureData]);

  const now = Date.now();
  const msPerMonth = 30.44 * 86400000;
  const timelineStartMs = now - timeRange.maxMonths * msPerMonth;
  const timelineDurationMs = timeRange.maxMonths * msPerMonth;

  // SVG dimensions
  const svgWidth = 800;
  const svgHeight = Math.max(140, candidates.length * 8 + 40);
  const leftPadding = 100;
  const rightPadding = 60;
  const topPadding = 20;
  const barHeight = 4;
  const barGap = 4;
  const chartWidth = svgWidth - leftPadding - rightPadding;

  function msToX(ms: number): number {
    const fraction = (ms - timelineStartMs) / timelineDurationMs;
    return leftPadding + fraction * chartWidth;
  }

  // Generate year markers
  const yearMarkers = useMemo(() => {
    const markers: { year: number; x: number }[] = [];
    const startDate = new Date(timelineStartMs);
    const startYear = startDate.getFullYear();
    const endYear = new Date().getFullYear();
    for (let y = startYear; y <= endYear; y++) {
      const yearMs = new Date(y, 0, 1).getTime();
      if (yearMs >= timelineStartMs && yearMs <= now) {
        markers.push({ year: y, x: msToX(yearMs) });
      }
    }
    return markers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRange.maxMonths]);

  // Sorted candidates by tenure (longest first)
  const sortedCandidates = useMemo(() => {
    return [...candidates].sort(
      (a, b) => (b.tenureMonths || 0) - (a.tenureMonths || 0)
    );
  }, [candidates]);

  const newsMarkers = useMemo(() => {
    if (!newsEvents) return [];
    return newsEvents
      .filter((e) => e.date)
      .map((e) => {
        const dateMs = new Date(e.date).getTime();
        if (dateMs < timelineStartMs || dateMs > now) return null;
        return { ...e, x: msToX(dateMs) };
      })
      .filter(Boolean) as Array<{
      event_type: string;
      severity: string;
      summary: string;
      date: string;
      x: number;
    }>;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newsEvents, timeRange.maxMonths]);

  return (
    <div className="mt-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-xs text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
      >
        Timeline {expanded ? "\u25BE" : "\u25B8"}
      </button>

      {expanded && (
        <div className="relative mt-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-3 overflow-x-auto">
          {!hasTenureData ? (
            <p className="text-xs text-neutral-400 dark:text-neutral-500 py-4 text-center">
              Tenure data unavailable
            </p>
          ) : (
            <div className="relative">
              <svg
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                className="w-full"
                style={{ minWidth: 500 }}
                onMouseLeave={() => setTooltip(null)}
              >
                {/* Year marker lines and labels */}
                {yearMarkers.map((m) => (
                  <g key={m.year}>
                    <line
                      x1={m.x}
                      y1={topPadding - 5}
                      x2={m.x}
                      y2={svgHeight - 20}
                      stroke="currentColor"
                      className="text-neutral-200 dark:text-neutral-700"
                      strokeWidth={0.5}
                    />
                    <text
                      x={m.x}
                      y={svgHeight - 6}
                      textAnchor="middle"
                      className="fill-neutral-400 dark:fill-neutral-500"
                      fontSize={9}
                    >
                      {m.year}
                    </text>
                  </g>
                ))}

                {/* Candidate bars */}
                {sortedCandidates.map((c, i) => {
                  const joinMs =
                    now - (c.tenureMonths || 0) * msPerMonth;
                  const barX = msToX(joinMs);
                  const barY = topPadding + i * (barHeight + barGap);
                  const barW = msToX(now) - barX;
                  const color = getStatusColor(c.status);

                  return (
                    <g key={c.id}>
                      {/* Name label */}
                      <text
                        x={barX - 4}
                        y={barY + barHeight / 2 + 1}
                        textAnchor="end"
                        className="fill-neutral-400 dark:fill-neutral-500"
                        fontSize={8}
                        dominantBaseline="middle"
                      >
                        {c.name.length > 14
                          ? c.name.slice(0, 13) + "\u2026"
                          : c.name}
                      </text>
                      {/* Bar */}
                      <rect
                        x={barX}
                        y={barY}
                        width={Math.max(barW, 2)}
                        height={barHeight}
                        rx={2}
                        fill={color}
                        opacity={0.85}
                      />
                    </g>
                  );
                })}

                {/* News event markers */}
                {newsMarkers.map((e, i) => {
                  const color = getEventColor(e.event_type);
                  return (
                    <g key={`news-${i}`}>
                      <line
                        x1={e.x}
                        y1={topPadding - 10}
                        x2={e.x}
                        y2={svgHeight - 20}
                        stroke={color}
                        strokeWidth={1}
                        strokeDasharray="3,3"
                        opacity={0.6}
                      />
                      <circle
                        cx={e.x}
                        cy={topPadding - 12}
                        r={4}
                        fill={color}
                        className="cursor-pointer"
                        onMouseEnter={(evt) => {
                          const rect = (
                            evt.target as SVGElement
                          ).closest("svg")?.getBoundingClientRect();
                          if (rect) {
                            setTooltip({
                              x: evt.clientX - rect.left,
                              y: evt.clientY - rect.top - 30,
                              text: `${e.event_type.replace(/_/g, " ")}: ${e.summary} (${e.date})`,
                            });
                          }
                        }}
                        onMouseLeave={() => setTooltip(null)}
                      />
                    </g>
                  );
                })}

                {/* Headcount label on right edge */}
                {(headcount != null || engHeadcount != null) && (
                  <text
                    x={svgWidth - 5}
                    y={topPadding + 4}
                    textAnchor="end"
                    className="fill-neutral-400 dark:fill-neutral-500"
                    fontSize={8}
                  >
                    {headcount != null && `HC: ${headcount.toLocaleString()}`}
                    {headcount != null && engHeadcount != null && " / "}
                    {engHeadcount != null &&
                      `Eng: ${engHeadcount.toLocaleString()}`}
                  </text>
                )}
              </svg>

              {/* Tooltip */}
              {tooltip && (
                <div
                  className="absolute pointer-events-none z-10 max-w-xs px-2 py-1 rounded bg-neutral-800 dark:bg-neutral-700 text-white text-[10px] leading-tight shadow-lg"
                  style={{ left: tooltip.x, top: tooltip.y }}
                >
                  {tooltip.text}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
