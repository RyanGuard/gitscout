"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Map, Copy, Trash2, Clock, Building2, Loader2, Plus,
} from "lucide-react";
import Link from "next/link";

interface Template {
  id: string;
  name: string;
  roleConfig: {
    role_title: string;
    role_level: string | null;
    role_stack: string[];
    geography: string[];
  };
  companyConfig: Array<{
    company_name: string;
    tier: string;
  }>;
  useCount: number;
  createdAt: string;
  updatedAt: string;
}

export default function TemplatesPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [cloning, setCloning] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.user?.id) return;
    fetch("/api/market-map/templates")
      .then((r) => r.json())
      .then((data) => setTemplates(data.templates || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [session]);

  async function cloneTemplate(templateId: string) {
    setCloning(templateId);
    try {
      const res = await fetch(`/api/market-map/templates/${templateId}/clone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const data = await res.json();
        router.push(`/map?id=${data.mapId}`);
      }
    } catch {
      // error
    } finally {
      setCloning(null);
    }
  }

  async function deleteTemplate(templateId: string) {
    setTemplates((prev) => prev.filter((t) => t.id !== templateId));
    // No delete API yet — would need to add
  }

  if (!session) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <p className="text-neutral-500">Sign in to view your templates</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <Map className="h-5 w-5 text-indigo-400" />
            <h1 className="text-xl font-bold text-white tracking-tight">Map Templates</h1>
          </div>
          <p className="text-sm text-neutral-500">Saved market maps you can reuse and refresh</p>
        </div>
        <Link
          href="/map"
          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition-colors"
        >
          <Plus className="h-4 w-4" /> New map
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
        </div>
      ) : templates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-700/40 bg-neutral-900/30 p-12 text-center">
          <Map className="mx-auto h-10 w-10 text-neutral-600" />
          <p className="mt-3 text-sm font-medium text-neutral-400">No templates yet</p>
          <p className="mt-1 text-xs text-neutral-500">Generate a market map and save it as a template to reuse later</p>
          <Link
            href="/map"
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> Create your first map
          </Link>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => {
            const rc = t.roleConfig;
            const companies = t.companyConfig || [];
            const tierA = companies.filter((c) => c.tier === "A").length;
            const tierB = companies.filter((c) => c.tier === "B").length;
            const tierC = companies.filter((c) => c.tier === "C").length;

            return (
              <div
                key={t.id}
                className="rounded-xl border border-neutral-800/80 bg-neutral-900/60 p-5 transition-all hover:border-neutral-700/80"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-white">{t.name}</h3>
                    <p className="text-[11px] text-neutral-500 mt-0.5">
                      {rc.role_title}{rc.role_level ? ` · ${rc.role_level}` : ""}
                    </p>
                  </div>
                  <button
                    onClick={() => deleteTemplate(t.id)}
                    className="text-neutral-700 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                {rc.role_stack?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {rc.role_stack.map((s) => (
                      <span key={s} className="rounded-md bg-neutral-800/60 px-1.5 py-0.5 text-[10px] text-neutral-400">
                        {s}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-3 text-[11px] text-neutral-500 mb-3">
                  <span className="flex items-center gap-1">
                    <Building2 className="h-3 w-3" />
                    {companies.length} companies
                  </span>
                  <span>{tierA} A · {tierB} B · {tierC} C</span>
                </div>

                <div className="flex items-center gap-2 text-[11px] text-neutral-600 mb-4">
                  <Clock className="h-3 w-3" />
                  {new Date(t.createdAt).toLocaleDateString()}
                  {t.useCount > 0 && (
                    <span className="ml-2">· Used {t.useCount} time{t.useCount !== 1 ? "s" : ""}</span>
                  )}
                </div>

                <button
                  onClick={() => cloneTemplate(t.id)}
                  disabled={cloning === t.id}
                  className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors disabled:opacity-50"
                >
                  {cloning === t.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  {cloning === t.id ? "Cloning..." : "Use template"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
