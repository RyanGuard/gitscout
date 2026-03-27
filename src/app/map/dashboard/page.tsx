"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  Map,
  Users,
  TrendingUp,
  ArrowRight,
  Loader2,
  BarChart3,
} from "lucide-react";

interface MapSummary {
  id: string;
  name: string;
  roleTitle: string;
  status: string;
  createdAt: string;
  totalCompanies: number;
  totalCandidates: number;
  avgFitScore: number;
  statusCounts: Record<string, number>;
  inPipeline: number;
}

interface Aggregate {
  activeMaps: number;
  totalCandidates: number;
  inPipeline: number;
  responseRate: number;
  statusCounts: Record<string, number>;
}

const STAGES = [
  { key: "mapped", color: "bg-neutral-500" },
  { key: "shortlisted", color: "bg-blue-500" },
  { key: "contacted", color: "bg-amber-500" },
  { key: "responded", color: "bg-teal-500" },
  { key: "screening", color: "bg-purple-500" },
  { key: "offer", color: "bg-emerald-500" },
];

function MiniFunnel({ statusCounts }: { statusCounts: Record<string, number> }) {
  const total = Object.values(statusCounts).reduce((s, v) => s + v, 0);
  if (total === 0) return <div className="h-2 rounded-full bg-neutral-800 w-full" />;

  return (
    <div className="flex rounded-full overflow-hidden h-2 w-full">
      {STAGES.map((stage) => {
        const count = statusCounts[stage.key] || 0;
        if (count === 0) return null;
        const pct = (count / total) * 100;
        return (
          <div
            key={stage.key}
            className={stage.color}
            style={{ width: `${Math.max(pct, 2)}%` }}
          />
        );
      })}
    </div>
  );
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const [aggregate, setAggregate] = useState<Aggregate | null>(null);
  const [maps, setMaps] = useState<MapSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) return;
    async function load() {
      const res = await fetch("/api/market-map/dashboard");
      if (res.ok) {
        const data = await res.json();
        setAggregate(data.aggregate);
        setMaps(data.maps);
      }
      setLoading(false);
    }
    load();
  }, [session]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-500" />
      </div>
    );
  }

  return (
    <div className="flex-1 max-w-5xl mx-auto w-full px-6 py-8">
      <div className="flex items-center gap-3 mb-8">
        <BarChart3 className="h-6 w-6 text-gold" />
        <h1 className="text-2xl font-bold text-white">Pipeline Dashboard</h1>
      </div>

      {/* Metric cards */}
      {aggregate && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[
            { label: "Active Maps", value: aggregate.activeMaps, icon: Map },
            {
              label: "Total Candidates",
              value: aggregate.totalCandidates,
              icon: Users,
            },
            {
              label: "In Pipeline",
              value: aggregate.inPipeline,
              icon: TrendingUp,
            },
            {
              label: "Response Rate",
              value: `${aggregate.responseRate}%`,
              icon: ArrowRight,
            },
          ].map((m) => (
            <div
              key={m.label}
              className="rounded-xl border border-neutral-800/50 bg-neutral-900/50 p-4"
            >
              <div className="flex items-center gap-2 text-neutral-400 mb-1">
                <m.icon className="h-4 w-4" />
                <span className="text-xs">{m.label}</span>
              </div>
              <div className="text-2xl font-bold text-white">{m.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Map list */}
      <h2 className="text-lg font-semibold text-white mb-4">Your Maps</h2>
      <div className="space-y-3">
        {maps.map((m) => (
          <Link
            key={m.id}
            href={`/map?id=${m.id}`}
            className="block rounded-xl border border-neutral-800/50 bg-neutral-900/30 p-4 hover:bg-neutral-800/30 transition-colors"
          >
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="font-semibold text-white">{m.name}</h3>
                <p className="text-sm text-neutral-400">{m.roleTitle}</p>
              </div>
              <div className="text-right text-xs text-neutral-500">
                <div>
                  {m.totalCompanies} companies · {m.totalCandidates} candidates
                </div>
                <div>
                  {new Date(m.createdAt).toLocaleDateString()}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <MiniFunnel statusCounts={m.statusCounts} />
              </div>
              {m.inPipeline > 0 && (
                <span className="text-xs text-gold whitespace-nowrap">
                  {m.inPipeline} in pipeline
                </span>
              )}
            </div>
          </Link>
        ))}
        {maps.length === 0 && (
          <div className="text-center py-12 text-neutral-500">
            No maps yet.{" "}
            <Link href="/map" className="text-gold hover:underline">
              Create your first map
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
