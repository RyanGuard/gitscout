"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { PenLine, Copy, Check, RefreshCw, X } from "lucide-react";

interface ProfileData {
  name: string | null;
  bio: string | null;
  location: string | null;
  company: string | null;
  followers: number;
  totalStars: number;
  publicRepos: number;
  languages: { language: string; percentage: number }[];
  repositories: {
    name: string;
    stars: number;
    language: string | null;
    description: string | null;
  }[];
}

interface OutreachDraftProps {
  username: string;
  profileData: ProfileData;
}

export function OutreachDraft({ username, profileData }: OutreachDraftProps) {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [roleContext, setRoleContext] = useState("");
  const [companyContext, setCompanyContext] = useState("");
  const [variants, setVariants] = useState<[string, string] | null>(null);
  const [displayedVariants, setDisplayedVariants] = useState<[string, string]>([
    "",
    "",
  ]);
  const [activeTab, setActiveTab] = useState<0 | 1>(0);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Restore from localStorage on mount
  useEffect(() => {
    const storageKey = `outreach_draft_${username}`;
    const cached = localStorage.getItem(storageKey);
    if (cached) {
      try {
        const data = JSON.parse(cached);
        if (data.variants) {
          setVariants(data.variants);
          setDisplayedVariants(data.variants);
        }
        if (data.roleContext) setRoleContext(data.roleContext);
        if (data.companyContext) setCompanyContext(data.companyContext);
      } catch {
        localStorage.removeItem(storageKey);
      }
    }
  }, [username]);

  // Save to localStorage when variants change
  useEffect(() => {
    if (!variants) return;
    const storageKey = `outreach_draft_${username}`;
    localStorage.setItem(
      storageKey,
      JSON.stringify({ variants, roleContext, companyContext })
    );
  }, [variants, roleContext, companyContext, username]);

  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);
    setVariants(null);
    setDisplayedVariants(["", ""]);

    try {
      const res = await fetch("/api/outreach-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          profileData,
          roleContext: roleContext || undefined,
          companyContext: companyContext || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to generate drafts");
      }

      const data = await res.json();
      const newVariants: [string, string] = [
        data.variants[0] || "",
        data.variants[1] || "",
      ];
      setVariants(newVariants);

      // Typewriter animation for active tab
      const text = newVariants[activeTab];
      let i = 0;
      const interval = setInterval(() => {
        i++;
        setDisplayedVariants((prev) => {
          const next: [string, string] = [...prev];
          next[activeTab] = text.slice(0, i);
          return next;
        });
        if (i >= text.length) {
          clearInterval(interval);
          // Set the other variant fully after animation completes
          setDisplayedVariants(newVariants);
        }
      }, 1500 / Math.max(text.length, 1));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [username, profileData, roleContext, companyContext, activeTab]);

  const copyVariant = useCallback(async () => {
    if (!variants) return;
    await navigator.clipboard.writeText(variants[activeTab]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [variants, activeTab]);

  const handleEditVariant = useCallback(
    (value: string) => {
      if (!variants) return;
      const updated: [string, string] = [...variants];
      updated[activeTab] = value;
      setVariants(updated);
      setDisplayedVariants(updated);
    },
    [variants, activeTab]
  );

  if (!session) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
      >
        <PenLine className="h-4 w-4" />
        Draft Outreach
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="relative w-full max-w-lg rounded-xl border border-neutral-200 bg-white shadow-xl dark:border-neutral-700 dark:bg-neutral-900">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4 dark:border-neutral-700">
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
                Draft Outreach for @{username}
              </h2>
              <button
                onClick={() => setOpen(false)}
                className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5">
              {/* Optional context inputs */}
              <div className="mb-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-500 dark:text-neutral-400">
                    Role you&apos;re hiring for (optional)
                  </label>
                  <input
                    type="text"
                    value={roleContext}
                    onChange={(e) => setRoleContext(e.target.value)}
                    placeholder="Senior Frontend Engineer"
                    className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-blue-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-500 dark:text-neutral-400">
                    Your company (optional)
                  </label>
                  <input
                    type="text"
                    value={companyContext}
                    onChange={(e) => setCompanyContext(e.target.value)}
                    placeholder="Acme Corp — Series B fintech"
                    className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-blue-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                  />
                </div>
              </div>

              {!variants && !loading && (
                <button
                  onClick={generate}
                  className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                >
                  Generate
                </button>
              )}

              {loading && (
                <div className="flex items-center justify-center gap-2 py-8 text-sm text-neutral-500">
                  <PenLine className="h-4 w-4 animate-pulse text-blue-500" />
                  Drafting messages...
                </div>
              )}

              {error && (
                <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
                  {error}
                </div>
              )}

              {variants && !loading && (
                <div>
                  {/* Tabs */}
                  <div className="mb-3 flex gap-1 rounded-lg bg-neutral-100 p-1 dark:bg-neutral-800">
                    <button
                      onClick={() => setActiveTab(0)}
                      className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                        activeTab === 0
                          ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-white"
                          : "text-neutral-500 hover:text-neutral-700 dark:text-neutral-400"
                      }`}
                    >
                      Direct approach
                    </button>
                    <button
                      onClick={() => setActiveTab(1)}
                      className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                        activeTab === 1
                          ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-white"
                          : "text-neutral-500 hover:text-neutral-700 dark:text-neutral-400"
                      }`}
                    >
                      Soft approach
                    </button>
                  </div>

                  {/* Editable textarea */}
                  <textarea
                    value={displayedVariants[activeTab]}
                    onChange={(e) => handleEditVariant(e.target.value)}
                    rows={6}
                    className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2.5 text-sm leading-relaxed text-neutral-700 focus:border-blue-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
                  />

                  {/* Character count */}
                  <div className="mt-1 text-right text-xs text-neutral-400">
                    {variants[activeTab].length} characters
                  </div>

                  {/* Action buttons */}
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={copyVariant}
                      className="inline-flex items-center gap-1.5 rounded-md bg-neutral-100 px-3 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
                    >
                      {copied ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-500" />{" "}
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" /> Copy
                        </>
                      )}
                    </button>
                    <button
                      onClick={generate}
                      className="inline-flex items-center gap-1.5 rounded-md bg-neutral-100 px-3 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
                    >
                      <RefreshCw className="h-3.5 w-3.5" /> Regenerate
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
