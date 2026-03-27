"use client";

import { useState } from "react";
import {
  X,
  Loader2,
  RefreshCw,
  Download,
  Copy,
  Check,
  Save,
  Send,
} from "lucide-react";
import { TemplateSelector } from "@/components/map/TemplateSelector";

interface OutreachCandidate {
  id: string;
  name: string;
  title: string | null;
  company: string;
  email: string | null;
}

interface GeneratedMessage {
  id?: string;
  candidateId: string;
  subjectLine: string;
  firstLine: string;
  body: string;
}

interface OutreachModalProps {
  mapId: string;
  roleTitle: string;
  candidates: OutreachCandidate[];
  onClose: () => void;
  onComplete: () => void;
}

export function OutreachModal({
  mapId,
  roleTitle,
  candidates,
  onClose,
  onComplete,
}: OutreachModalProps) {
  const [step, setStep] = useState<"config" | "review">("config");
  const [tone, setTone] = useState("professional");
  const [sellingPoints, setSellingPoints] = useState("");
  const [customInstructions, setCustomInstructions] = useState("");
  const [generating, setGenerating] = useState(false);
  const [messages, setMessages] = useState<GeneratedMessage[]>([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(
    null
  );
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState<string | null>(null);

  async function generate() {
    setGenerating(true);
    try {
      const res = await fetch(`/api/market-map/${mapId}/generate-outreach`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidate_ids: candidates.map((c) => c.id),
          tone,
          selling_points: sellingPoints
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean),
          custom_instructions: customInstructions || undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
        setStep("review");
        if (data.messages?.length > 0) {
          setSelectedCandidateId(data.messages[0].candidateId);
        }
      }
    } finally {
      setGenerating(false);
    }
  }

  async function regenerateOne(candidateId: string) {
    setRegenerating(candidateId);
    try {
      const res = await fetch(`/api/market-map/${mapId}/generate-outreach`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidate_ids: [candidateId],
          tone,
          selling_points: sellingPoints
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean),
          custom_instructions:
            (customInstructions || "") + "\nTry a different angle than before.",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.messages?.length > 0) {
          const newMsg = data.messages[0];
          setMessages((prev) =>
            prev.map((m) =>
              m.candidateId === candidateId
                ? { ...m, ...newMsg }
                : m
            )
          );
        }
      }
    } finally {
      setRegenerating(null);
    }
  }

  function exportCsv() {
    const BOM = "\uFEFF";
    const header = "first_name,last_name,email,company,title,subject,body";
    const rows = messages
      .map((msg) => {
        const candidate = candidates.find((c) => c.id === msg.candidateId);
        if (!candidate) return null;
        const nameParts = candidate.name.split(" ");
        const firstName = nameParts[0] || "";
        const lastName = nameParts.slice(1).join(" ") || "";
        const fullBody = `${msg.firstLine}\n\n${msg.body}`;
        return [
          csvEscape(firstName),
          csvEscape(lastName),
          csvEscape(candidate.email || ""),
          csvEscape(candidate.company),
          csvEscape(candidate.title || ""),
          csvEscape(msg.subjectLine),
          csvEscape(fullBody),
        ].join(",");
      })
      .filter(Boolean);

    const csv = BOM + header + "\n" + rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "outreach_messages.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function copyAll() {
    const text = messages
      .map((msg) => {
        const candidate = candidates.find((c) => c.id === msg.candidateId);
        return `To: ${candidate?.name || "Unknown"} (${candidate?.email || "no email"})\nSubject: ${msg.subjectLine}\n\n${msg.firstLine}\n\n${msg.body}`;
      })
      .join("\n\n---\n\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const selectedMsg = messages.find(
    (m) => m.candidateId === selectedCandidateId
  );

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="fixed inset-4 z-50 rounded-xl border border-neutral-700/50 bg-neutral-900 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800/50 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-white">
              {step === "config"
                ? "Generate Outreach"
                : "Review Messages"}
            </h2>
            <p className="text-sm text-neutral-400">
              {candidates.length} candidates · {roleTitle}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {step === "config" ? (
          /* Configuration step */
          <div className="flex-1 overflow-y-auto p-6 max-w-2xl mx-auto w-full">
            <div className="space-y-5">
              {/* Template selector */}
              <TemplateSelector
                onLoad={({ tone: t, sellingPoints: sp, customInstructions: ci }) => {
                  setTone(t);
                  setSellingPoints(sp);
                  setCustomInstructions(ci);
                }}
                currentTone={tone}
                currentSellingPoints={sellingPoints}
                currentCustomInstructions={customInstructions}
              />

              {/* Tone */}
              <div>
                <label className="text-sm font-medium text-neutral-300 mb-2 block">
                  Tone
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    {
                      value: "professional",
                      label: "Professional",
                      desc: "Polished but warm",
                    },
                    {
                      value: "casual",
                      label: "Casual",
                      desc: "Friendly, peer-like",
                    },
                    {
                      value: "technical_peer",
                      label: "Technical",
                      desc: "Engineer-to-engineer",
                    },
                  ].map((t) => (
                    <button
                      key={t.value}
                      onClick={() => setTone(t.value)}
                      className={`rounded-lg border p-3 text-left transition-colors ${
                        tone === t.value
                          ? "border-gold bg-gold-bg"
                          : "border-neutral-700/50 hover:border-neutral-600"
                      }`}
                    >
                      <div className="text-sm font-medium text-white">
                        {t.label}
                      </div>
                      <div className="text-xs text-neutral-400 mt-0.5">
                        {t.desc}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Selling points */}
              <div>
                <label className="text-sm font-medium text-neutral-300 mb-2 block">
                  Selling points (one per line)
                </label>
                <textarea
                  value={sellingPoints}
                  onChange={(e) => setSellingPoints(e.target.value)}
                  placeholder={"Series B, just raised $50M\nFounding platform team\nRemote-friendly"}
                  rows={4}
                  className="w-full rounded-lg border border-neutral-700/50 bg-neutral-800 px-3 py-2.5 text-sm text-white placeholder-neutral-500 focus:border-gold focus:outline-none resize-none"
                />
              </div>

              {/* Custom instructions */}
              <div>
                <label className="text-sm font-medium text-neutral-300 mb-2 block">
                  Custom instructions (optional)
                </label>
                <textarea
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                  placeholder="Any additional context or style notes..."
                  rows={2}
                  className="w-full rounded-lg border border-neutral-700/50 bg-neutral-800 px-3 py-2.5 text-sm text-white placeholder-neutral-500 focus:border-gold focus:outline-none resize-none"
                />
              </div>

              {/* Candidates preview */}
              <div>
                <label className="text-sm font-medium text-neutral-300 mb-2 block">
                  Candidates ({candidates.length})
                </label>
                <div className="rounded-lg border border-neutral-700/50 bg-neutral-800/50 divide-y divide-neutral-800">
                  {candidates.slice(0, 10).map((c) => (
                    <div key={c.id} className="px-3 py-2 flex items-center gap-2">
                      <span className="text-sm text-white">{c.name}</span>
                      <span className="text-xs text-neutral-500">
                        {c.title} at {c.company}
                      </span>
                      {!c.email && (
                        <span className="text-[10px] text-amber-400 ml-auto">
                          No email
                        </span>
                      )}
                    </div>
                  ))}
                  {candidates.length > 10 && (
                    <div className="px-3 py-2 text-xs text-neutral-500">
                      + {candidates.length - 10} more
                    </div>
                  )}
                </div>
              </div>

              {/* Generate button */}
              <button
                onClick={generate}
                disabled={generating}
                className="w-full rounded-lg bg-gold px-4 py-3 text-sm font-semibold text-white hover:bg-gold-hover disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating messages...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Generate {candidates.length} messages
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          /* Review step */
          <div className="flex-1 flex overflow-hidden">
            {/* Sidebar */}
            <div className="w-64 border-r border-neutral-800/50 overflow-y-auto">
              {messages.map((msg) => {
                const candidate = candidates.find(
                  (c) => c.id === msg.candidateId
                );
                const isSelected = msg.candidateId === selectedCandidateId;
                return (
                  <button
                    key={msg.candidateId}
                    onClick={() => setSelectedCandidateId(msg.candidateId)}
                    className={`w-full px-4 py-3 text-left border-b border-neutral-800/30 transition-colors ${
                      isSelected
                        ? "bg-gold-bg border-l-2 border-l-gold"
                        : "hover:bg-neutral-800/30"
                    }`}
                  >
                    <div className="text-sm font-medium text-white truncate">
                      {candidate?.name || "Unknown"}
                    </div>
                    <div className="text-xs text-neutral-400 truncate mt-0.5">
                      {candidate?.company}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Main editor */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {selectedMsg ? (
                <div className="flex-1 overflow-y-auto p-6">
                  {/* Subject */}
                  <div className="mb-4">
                    <label className="text-xs text-neutral-400 mb-1 block">
                      Subject line
                    </label>
                    <input
                      value={selectedMsg.subjectLine}
                      onChange={(e) =>
                        setMessages((prev) =>
                          prev.map((m) =>
                            m.candidateId === selectedCandidateId
                              ? { ...m, subjectLine: e.target.value }
                              : m
                          )
                        )
                      }
                      className="w-full rounded-lg border border-neutral-700/50 bg-neutral-800 px-3 py-2 text-sm text-white focus:border-gold focus:outline-none"
                    />
                  </div>

                  {/* First line (highlighted) */}
                  <div className="mb-4">
                    <label className="text-xs text-neutral-400 mb-1 block">
                      Personalized opening
                    </label>
                    <textarea
                      value={selectedMsg.firstLine}
                      onChange={(e) =>
                        setMessages((prev) =>
                          prev.map((m) =>
                            m.candidateId === selectedCandidateId
                              ? { ...m, firstLine: e.target.value }
                              : m
                          )
                        )
                      }
                      rows={3}
                      className="w-full rounded-lg border border-gold/30 bg-gold/5 px-3 py-2 text-sm text-white focus:border-gold focus:outline-none resize-none"
                    />
                  </div>

                  {/* Body */}
                  <div className="mb-4">
                    <label className="text-xs text-neutral-400 mb-1 block">
                      Body
                    </label>
                    <textarea
                      value={selectedMsg.body}
                      onChange={(e) =>
                        setMessages((prev) =>
                          prev.map((m) =>
                            m.candidateId === selectedCandidateId
                              ? { ...m, body: e.target.value }
                              : m
                          )
                        )
                      }
                      rows={6}
                      className="w-full rounded-lg border border-neutral-700/50 bg-neutral-800 px-3 py-2 text-sm text-white focus:border-gold focus:outline-none resize-none"
                    />
                  </div>

                  {/* Regenerate */}
                  <button
                    onClick={() => regenerateOne(selectedCandidateId!)}
                    disabled={regenerating === selectedCandidateId}
                    className="flex items-center gap-1.5 rounded-lg border border-neutral-700/50 px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-800/50 transition-colors"
                  >
                    {regenerating === selectedCandidateId ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5" />
                    )}
                    Regenerate this message
                  </button>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-neutral-500">
                  Select a candidate to review their message
                </div>
              )}
            </div>
          </div>
        )}

        {/* Bottom actions (review step only) */}
        {step === "review" && (
          <div className="border-t border-neutral-800/50 px-6 py-4 flex items-center gap-3">
            <button
              onClick={exportCsv}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </button>
            <button
              onClick={copyAll}
              className="flex items-center gap-1.5 rounded-lg border border-neutral-700/50 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800/50 transition-colors"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copied ? "Copied!" : "Copy all"}
            </button>
            <button
              onClick={() => {
                onComplete();
                onClose();
              }}
              className="ml-auto flex items-center gap-1.5 rounded-lg border border-neutral-700/50 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800/50 transition-colors"
            >
              <Save className="h-3.5 w-3.5" />
              Save as drafts & close
            </button>
          </div>
        )}
      </div>
    </>
  );
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
