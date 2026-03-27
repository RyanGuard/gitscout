"use client";

import { useState, useEffect } from "react";
import {
  Mail,
  Check,
  X,
  Send,
  Loader2,
} from "lucide-react";

interface OutreachMsg {
  id: string;
  subjectLine: string | null;
  firstLine: string | null;
  body: string;
  status: string;
  sentAt: string | null;
  responseReceivedAt: string | null;
  createdAt: string;
}

interface OutreachHistoryProps {
  mapId: string;
  candidateId: string;
}

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  draft: { bg: "bg-neutral-500/10", text: "text-neutral-400", label: "Draft" },
  sent: { bg: "bg-blue-500/10", text: "text-blue-400", label: "Sent" },
  responded: { bg: "bg-emerald-500/10", text: "text-emerald-400", label: "Responded" },
  bounced: { bg: "bg-red-500/10", text: "text-red-400", label: "Bounced" },
};

export function OutreachHistory({ mapId, candidateId }: OutreachHistoryProps) {
  const [messages, setMessages] = useState<OutreachMsg[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      // Fetch outreach messages for this candidate from the map's outreach messages
      try {
        const res = await fetch(
          `/api/market-map/${mapId}/outreach/by-candidate?candidateId=${candidateId}`
        );
        if (res.ok) {
          const data = await res.json();
          setMessages(data.messages || []);
        }
      } catch {
        // Ignore errors — may not have outreach yet
      }
      setLoading(false);
    }
    load();
  }, [mapId, candidateId]);

  async function updateStatus(messageId: string, newStatus: string) {
    setUpdating(messageId);
    try {
      const res = await fetch(
        `/api/market-map/${mapId}/outreach/${messageId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        }
      );
      if (res.ok) {
        const data = await res.json();
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? { ...m, status: data.status, sentAt: data.sentAt, responseReceivedAt: data.responseReceivedAt }
              : m
          )
        );
      }
    } finally {
      setUpdating(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-neutral-500 text-xs py-2">
        <Loader2 className="h-3 w-3 animate-spin" /> Loading outreach...
      </div>
    );
  }

  if (messages.length === 0) return null;

  return (
    <div className="mt-4 border-t border-neutral-800/50 pt-3">
      <div className="flex items-center gap-1.5 mb-2">
        <Mail className="h-3.5 w-3.5 text-neutral-500" />
        <span className="text-xs font-medium text-neutral-400">
          Outreach history
        </span>
      </div>
      <div className="space-y-2">
        {messages.map((msg) => {
          const statusCfg = STATUS_COLORS[msg.status] || STATUS_COLORS.draft;
          return (
            <div
              key={msg.id}
              className="rounded-lg border border-neutral-800/50 bg-neutral-800/20 p-3"
            >
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${statusCfg.bg} ${statusCfg.text}`}
                >
                  {statusCfg.label}
                </span>
                {msg.subjectLine && (
                  <span className="text-xs text-neutral-300 truncate">
                    {msg.subjectLine}
                  </span>
                )}
              </div>
              {msg.firstLine && (
                <p className="text-xs text-neutral-400 line-clamp-2 mb-2">
                  {msg.firstLine}
                </p>
              )}
              <div className="flex items-center gap-2">
                {msg.status === "draft" && (
                  <button
                    onClick={() => updateStatus(msg.id, "sent")}
                    disabled={updating === msg.id}
                    className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 transition-colors"
                  >
                    {updating === msg.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Send className="h-3 w-3" />
                    )}
                    Mark sent
                  </button>
                )}
                {msg.status === "sent" && (
                  <>
                    <button
                      onClick={() => updateStatus(msg.id, "responded")}
                      disabled={updating === msg.id}
                      className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors"
                    >
                      <Check className="h-3 w-3" /> Responded
                    </button>
                    <button
                      onClick={() => updateStatus(msg.id, "bounced")}
                      disabled={updating === msg.id}
                      className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-colors"
                    >
                      <X className="h-3 w-3" /> Bounced
                    </button>
                  </>
                )}
                <span className="ml-auto text-[10px] text-neutral-600">
                  {msg.sentAt
                    ? `Sent ${new Date(msg.sentAt).toLocaleDateString()}`
                    : `Created ${new Date(msg.createdAt).toLocaleDateString()}`}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
