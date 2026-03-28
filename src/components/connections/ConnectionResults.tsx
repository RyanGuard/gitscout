"use client";

import {
  Users,
  Building2,
  GraduationCap,
  Code2,
  Share2,
  Tag,
  ArrowRight,
  Copy,
  Check,
  Sparkles,
  ExternalLink,
  PenLine,
} from "lucide-react";
import { useState } from "react";
import Link from "next/link";
import { FeatureHint } from "@/components/ui/FeatureHint";

interface ConnectionData {
  id: string;
  connectionType: string;
  strength: string;
  homePersonName: string | null;
  homePersonTitle: string | null;
  targetPersonName: string | null;
  targetPersonTitle: string | null;
  detail: Record<string, unknown>;
  suggestedAction: string | null;
}

interface LookupResult {
  id: string;
  targetCompanyName: string;
  targetCompanyDomain: string;
  totalConnectionsFound: number;
  connectionBreakdown: Record<string, number>;
  connections: ConnectionData[];
}

const TYPE_CONFIG: Record<
  string,
  { label: string; icon: typeof Users; color: string }
> = {
  former_employee: {
    label: "Former Employee Overlap",
    icon: Users,
    color: "text-gold",
  },
  shared_investor: {
    label: "Shared Investor",
    icon: Building2,
    color: "text-amber-500",
  },
  shared_education: {
    label: "Shared Education",
    icon: GraduationCap,
    color: "text-purple-500",
  },
  github_overlap: {
    label: "GitHub / OSS Overlap",
    icon: Code2,
    color: "text-emerald-500",
  },
  linkedin_import: {
    label: "LinkedIn Connection",
    icon: Share2,
    color: "text-blue-500",
  },
  manual_tag: { label: "Manual Tag", icon: Tag, color: "text-neutral-500" },
};

const STRENGTH_CONFIG: Record<string, { label: string; classes: string }> = {
  strong: {
    label: "Strong",
    classes:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
  medium: {
    label: "Medium",
    classes:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  },
  weak: {
    label: "Weak",
    classes:
      "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
  },
};

// Sort priority for connection types
const TYPE_PRIORITY: Record<string, number> = {
  former_employee: 1,
  linkedin_import: 2,
  github_overlap: 3,
  shared_investor: 4,
  shared_education: 5,
  manual_tag: 6,
};

const STRENGTH_PRIORITY: Record<string, number> = {
  strong: 1,
  medium: 2,
  weak: 3,
};

export function ConnectionResults({ result }: { result: LookupResult }) {
  if (result.totalConnectionsFound === 0) {
    return (
      <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-8 text-center dark:border-neutral-800 dark:bg-neutral-900">
        <p className="text-neutral-500 dark:text-neutral-400">
          No connections found to{" "}
          <span className="font-medium text-neutral-700 dark:text-neutral-300">
            {result.targetCompanyName || result.targetCompanyDomain}
          </span>
        </p>
        <p className="mt-1 text-sm text-neutral-400 dark:text-neutral-500">
          Try importing your LinkedIn connections for deeper mapping.
        </p>
      </div>
    );
  }

  // Group connections by type
  const grouped = result.connections.reduce(
    (acc, conn) => {
      const type = conn.connectionType;
      if (!acc[type]) acc[type] = [];
      acc[type].push(conn);
      return acc;
    },
    {} as Record<string, ConnectionData[]>
  );

  // Sort groups by priority and connections within groups by strength
  const sortedGroups = Object.entries(grouped).sort(
    ([a], [b]) => (TYPE_PRIORITY[a] || 99) - (TYPE_PRIORITY[b] || 99)
  );

  for (const [, conns] of sortedGroups) {
    conns.sort(
      (a, b) =>
        (STRENGTH_PRIORITY[a.strength] || 99) -
        (STRENGTH_PRIORITY[b.strength] || 99)
    );
  }

  // Build breakdown pills
  const breakdownPills = Object.entries(result.connectionBreakdown || {})
    .filter(([, count]) => count > 0)
    .map(([type, count]) => {
      const config = TYPE_CONFIG[type];
      return config
        ? `${count} ${config.label.toLowerCase()}`
        : `${count} ${type}`;
    });

  return (
    <div className="mt-6 space-y-4">
      {/* Summary bar */}
      <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">
            {result.totalConnectionsFound} connection
            {result.totalConnectionsFound !== 1 ? "s" : ""} found to{" "}
            <span className="text-teal-600 dark:text-teal-400">
              {result.targetCompanyName || result.targetCompanyDomain}
            </span>
          </h3>
        </div>
        {breakdownPills.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {breakdownPills.map((pill, i) => (
              <span
                key={i}
                className="rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
              >
                {pill}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Connection cards grouped by type */}
      {sortedGroups.map(([type, conns]) => {
        const config = TYPE_CONFIG[type] || TYPE_CONFIG.manual_tag;
        const Icon = config.icon;

        return (
          <div key={type}>
            <div className="mb-2 flex items-center gap-2 px-1">
              <Icon className={`h-4 w-4 ${config.color}`} />
              <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                {config.label}
              </span>
              <span className="text-xs text-neutral-400">({conns.length})</span>
            </div>

            <div className="space-y-2">
              {conns.map((conn) => (
                <ConnectionCard key={conn.id} connection={conn} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ConnectionCard({ connection }: { connection: ConnectionData }) {
  const [copied, setCopied] = useState(false);
  const strength =
    STRENGTH_CONFIG[connection.strength] || STRENGTH_CONFIG.weak;
  const typeConfig =
    TYPE_CONFIG[connection.connectionType] || TYPE_CONFIG.manual_tag;

  const handleCopy = () => {
    if (connection.suggestedAction) {
      navigator.clipboard.writeText(connection.suggestedAction);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm transition-colors hover:border-neutral-300 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-700">
      {/* Header: strength badge */}
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${strength.classes}`}
          >
            {strength.label}
          </span>
          <FeatureHint id="conn-strength" message="Strong = worked together directly. Medium = shared network. Start with strong connections for the warmest intro." position="right" />
        </span>
      </div>

      {/* People */}
      <div className="mt-3 flex items-center gap-3">
        {connection.homePersonName && (
          <div className="flex-1">
            <p className="text-sm font-medium text-neutral-900 dark:text-white">
              {connection.homePersonName}
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {connection.homePersonTitle || "Your company"}
            </p>
          </div>
        )}

        {connection.homePersonName && connection.targetPersonName && (
          <ArrowRight className="h-4 w-4 shrink-0 text-neutral-300 dark:text-neutral-600" />
        )}

        {connection.targetPersonName && (
          <div className="flex-1 text-right">
            <p className="text-sm font-medium text-neutral-900 dark:text-white">
              {connection.targetPersonName}
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {connection.targetPersonTitle || "Target company"}
            </p>
          </div>
        )}
      </div>

      {/* Detail */}
      <div className="mt-3">
        <ConnectionDetail
          type={connection.connectionType}
          detail={connection.detail}
        />
      </div>

      {/* Suggested action */}
      {connection.suggestedAction && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 p-3 dark:bg-amber-900/10">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
          <FeatureHint id="conn-action" message="Scout suggests exactly how to leverage each connection. Click copy to use it in your outreach." position="top" />
          <p className="flex-1 text-sm text-amber-800 dark:text-amber-300">
            {connection.suggestedAction}
          </p>
          <button
            onClick={handleCopy}
            className="shrink-0 rounded p-1 text-amber-500 hover:bg-amber-100 dark:hover:bg-amber-900/20"
            title="Copy to clipboard"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
          {connection.targetPersonName && (
            <Link
              href={`/outreach?${new URLSearchParams({
                name: connection.targetPersonName,
                ...(connection.targetPersonTitle ? { title: connection.targetPersonTitle } : {}),
                source: "connection",
                ctx: JSON.stringify({
                  connections: [{
                    name: connection.homePersonName,
                    type: connection.connectionType,
                    title: connection.homePersonTitle,
                  }],
                }),
              }).toString()}`}
              className="shrink-0 rounded p-1 text-amber-500 hover:bg-amber-100 dark:hover:bg-amber-900/20"
              title="Draft outreach"
            >
              <PenLine className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

function ConnectionDetail({
  type,
  detail,
}: {
  type: string;
  detail: Record<string, unknown>;
}) {
  switch (type) {
    case "former_employee": {
      const company =
        (detail.overlapping_company as string) || "a shared company";
      const months = detail.overlap_months as number;
      const role = detail.role_at_overlap as string;
      const direction = detail.direction as string;

      let text = "";
      if (direction === "target_to_home") {
        text = `Previously worked at your company`;
        if (role) text += ` as ${role}`;
      } else if (detail.overlapping_company) {
        text = `Both worked at ${company}`;
        if (months) text += ` (${months} months overlap)`;
      } else {
        text = `Previously worked at this company`;
        if (role) text += ` as ${role}`;
      }

      return (
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          {text}
        </p>
      );
    }

    case "shared_investor": {
      const investor = detail.investor_name as string;
      const homeRound = detail.home_round as string | undefined;
      const targetRound = detail.target_round as string | undefined;
      return (
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Shared investor: <span className="font-medium">{investor}</span>
          {homeRound ? ` (${homeRound} / ${targetRound})` : ""}
        </p>
      );
    }

    case "shared_education": {
      const school = detail.school_name as string;
      const overlap = detail.years_overlap as boolean;
      return (
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Both attended <span className="font-medium">{school}</span>
          {overlap ? " (overlapping years)" : ""}
        </p>
      );
    }

    case "github_overlap": {
      const repo = detail.repo as string;
      const repoUrl = detail.repo_url as string;
      return (
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Both contribute to{" "}
          {repoUrl ? (
            <a
              href={repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium text-teal-600 hover:underline dark:text-teal-400"
            >
              {repo} <ExternalLink className="h-3 w-3" />
            </a>
          ) : (
            <span className="font-medium">{repo}</span>
          )}
          {(detail.home_contributions as number) > 0 &&
            ` (${detail.home_contributions as number} + ${detail.target_contributions as number} contributions)`}
        </p>
      );
    }

    case "linkedin_import": {
      return (
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          1st degree LinkedIn connection
        </p>
      );
    }

    default:
      return (
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          {detail.context as string || "Connection found"}
        </p>
      );
  }
}
