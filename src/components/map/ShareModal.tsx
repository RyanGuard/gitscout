"use client";

import { useState, useEffect } from "react";
import {
  X,
  Copy,
  Check,
  Link2,
  Trash2,
  Eye,
  Loader2,
} from "lucide-react";

interface Share {
  id: string;
  shareToken: string;
  share_url: string;
  permissionLevel: string;
  recipientName: string | null;
  recipientEmail: string | null;
  expiresAt: string | null;
  viewCount: number;
  lastViewedAt: string | null;
  createdAt: string;
  expired: boolean;
}

interface ShareModalProps {
  mapId: string;
  mapName: string;
  onClose: () => void;
}

export function ShareModal({ mapId, mapName, onClose }: ShareModalProps) {
  const [permissionLevel, setPermissionLevel] = useState<"overview" | "full">("overview");
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [expiresDays, setExpiresDays] = useState(30);
  const [generating, setGenerating] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [shares, setShares] = useState<Share[]>([]);
  const [loadingShares, setLoadingShares] = useState(true);

  // Load existing shares
  useEffect(() => {
    async function loadShares() {
      try {
        const res = await fetch(`/api/market-map/${mapId}/share`);
        if (res.ok) {
          const data = await res.json();
          setShares(data.shares || []);
        }
      } finally {
        setLoadingShares(false);
      }
    }
    loadShares();
  }, [mapId]);

  async function generateLink() {
    setGenerating(true);
    try {
      const res = await fetch(`/api/market-map/${mapId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          permission_level: permissionLevel,
          recipient_name: recipientName || undefined,
          recipient_email: recipientEmail || undefined,
          expires_days: expiresDays,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setGeneratedUrl(data.share_url);
        // Refresh shares list
        const listRes = await fetch(`/api/market-map/${mapId}/share`);
        if (listRes.ok) {
          const listData = await listRes.json();
          setShares(listData.shares || []);
        }
      }
    } finally {
      setGenerating(false);
    }
  }

  async function revokeShare(shareId: string) {
    const res = await fetch(`/api/market-map/${mapId}/share`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ share_id: shareId }),
    });
    if (res.ok) {
      setShares((prev) => prev.filter((s) => s.id !== shareId));
    }
  }

  function copyUrl(url: string) {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg rounded-xl border border-neutral-700/50 bg-neutral-900 p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Share with Hiring Manager
            </h2>
            <p className="text-sm text-neutral-400 mt-0.5">{mapName}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Generate new link */}
        {!generatedUrl ? (
          <div className="space-y-4">
            {/* Permission level */}
            <div>
              <label className="text-sm font-medium text-neutral-300 mb-2 block">
                Permission level
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setPermissionLevel("overview")}
                  className={`rounded-lg border p-3 text-left transition-colors ${
                    permissionLevel === "overview"
                      ? "border-indigo-500 bg-indigo-500/10"
                      : "border-neutral-700/50 hover:border-neutral-600"
                  }`}
                >
                  <div className="text-sm font-medium text-white">
                    Overview
                  </div>
                  <div className="text-xs text-neutral-400 mt-0.5">
                    Company-level only
                  </div>
                </button>
                <button
                  onClick={() => setPermissionLevel("full")}
                  className={`rounded-lg border p-3 text-left transition-colors ${
                    permissionLevel === "full"
                      ? "border-indigo-500 bg-indigo-500/10"
                      : "border-neutral-700/50 hover:border-neutral-600"
                  }`}
                >
                  <div className="text-sm font-medium text-white">
                    Full detail
                  </div>
                  <div className="text-xs text-neutral-400 mt-0.5">
                    Includes candidates
                  </div>
                </button>
              </div>
            </div>

            {/* Recipient (optional) */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-neutral-400 mb-1 block">
                  Recipient name (optional)
                </label>
                <input
                  type="text"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="John Smith"
                  className="w-full rounded-lg border border-neutral-700/50 bg-neutral-800 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-neutral-400 mb-1 block">
                  Recipient email (optional)
                </label>
                <input
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="john@company.com"
                  className="w-full rounded-lg border border-neutral-700/50 bg-neutral-800 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Expiration */}
            <div>
              <label className="text-xs text-neutral-400 mb-1 block">
                Link expires in
              </label>
              <select
                value={expiresDays}
                onChange={(e) => setExpiresDays(Number(e.target.value))}
                className="w-full rounded-lg border border-neutral-700/50 bg-neutral-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
              >
                <option value={7}>7 days</option>
                <option value={14}>14 days</option>
                <option value={30}>30 days</option>
                <option value={90}>90 days</option>
              </select>
            </div>

            {/* Generate button */}
            <button
              onClick={generateLink}
              disabled={generating}
              className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Link2 className="h-4 w-4" />
              )}
              Generate link
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Generated URL */}
            <div className="rounded-lg border border-neutral-700/50 bg-neutral-800 p-3 flex items-center gap-2">
              <input
                readOnly
                value={generatedUrl}
                className="flex-1 bg-transparent text-sm text-white outline-none"
              />
              <button
                onClick={() => copyUrl(generatedUrl)}
                className="rounded-md bg-neutral-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-600 transition-colors flex items-center gap-1.5"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <button
              onClick={() => setGeneratedUrl(null)}
              className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              Generate another link
            </button>
          </div>
        )}

        {/* Existing shares */}
        {shares.length > 0 && (
          <div className="mt-6 border-t border-neutral-800/50 pt-4">
            <h3 className="text-sm font-medium text-neutral-300 mb-3">
              Active share links
            </h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {shares.map((s) => (
                <div
                  key={s.id}
                  className={`rounded-lg border border-neutral-800/50 bg-neutral-800/30 p-3 flex items-center gap-3 ${s.expired ? "opacity-50" : ""}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs">
                      <span
                        className={`rounded px-1.5 py-0.5 font-medium ${
                          s.permissionLevel === "full"
                            ? "bg-indigo-500/10 text-indigo-400"
                            : "bg-neutral-500/10 text-neutral-400"
                        }`}
                      >
                        {s.permissionLevel}
                      </span>
                      {s.recipientName && (
                        <span className="text-neutral-400 truncate">
                          {s.recipientName}
                        </span>
                      )}
                      {s.expired && (
                        <span className="text-red-400">expired</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-neutral-500">
                      <span className="flex items-center gap-1">
                        <Eye className="h-3 w-3" /> {s.viewCount} views
                      </span>
                      <span>
                        Created{" "}
                        {new Date(s.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => copyUrl(s.share_url)}
                      className="rounded p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-700 transition-colors"
                      title="Copy link"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => revokeShare(s.id)}
                      className="rounded p-1.5 text-neutral-400 hover:text-red-400 hover:bg-neutral-700 transition-colors"
                      title="Revoke link"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {loadingShares && (
          <div className="mt-4 flex justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-neutral-500" />
          </div>
        )}
      </div>
    </>
  );
}
