"use client";

import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useCallback, useRef, Suspense } from "react";
import {
  Send, Mail, MessageSquare, Smartphone, Layers, Copy, Download,
  Bookmark, Loader2, ArrowUp, ArrowDown, Plus, X,
  Building2, MapPin, ChevronDown, ChevronLeft, ChevronRight,
  Minus, FileText, AlertCircle, CheckCircle2, Users, FlaskConical,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CandidateBrowser } from "@/components/outreach/CandidateBrowser";
import {
  ChannelSelector,
  ToneSelector,
  SequenceLengthSlider,
  ChannelSettingsLinkedin,
  ChannelSettingsEmail,
  ChannelSettingsText,
  RoleContextPanel,
  ActionsSection,
  TemplatesSection,
  IntelligenceSection,
  SuggestionsSection,
  LinkedInQueueButton,
  LinkedInPreview,
  EmailSendButton,
  AshbyLogSection,
} from "@/components/outreach/settings";
import type { RoleContext } from "@/components/outreach/settings";
import { fromMapCandidate, type CandidateData } from "@/lib/outreach/candidateNormalizer";
import { CandidateProfileCard, type OutreachHistoryItem } from "@/components/outreach/CandidateProfileCard";
import { CompactCandidateHeader } from "@/components/outreach/CompactCandidateHeader";
import { SequenceStatusCard } from "@/components/outreach/SequenceStatusCard";
import { trackEvent } from "@/lib/posthog";

// ─── Custom Icons ───

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

function LinkedinIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect width="4" height="12" x="2" y="9" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  );
}

// ─── Types ───

interface OutreachMessage {
  id?: string;
  stepNumber: number;
  delayDays: number;
  channel: string;
  subjectLine: string | null;
  body: string;
}

interface AnalyticsData {
  hasEnoughData: boolean;
  totalDataPoints: number;
  bestChannel?: { channel: string; rate: number };
  bestTone?: { tone: string; rate: number };
  optimalLength?: { min: number; max: number };
  topSignal?: { signal: string; rate: number };
}

interface TemplateItem {
  id: string;
  name: string;
  description: string | null;
  channel: string;
  tone: string;
  sequenceLength: number;
  sellingPoints: string[];
  templateMessages: OutreachMessage[] | null;
  responseRate: number | null;
  timesUsed: number;
}

type Channel = "email" | "linkedin" | "text" | "multi_channel";
type Tone = "professional" | "casual" | "technical_peer" | "executive" | "warm_intro";

// ─── Constants ───

const CHANNELS: { value: Channel; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "email", label: "Email", icon: Mail },
  { value: "linkedin", label: "LinkedIn", icon: LinkedinIcon },
  { value: "text", label: "Text", icon: Smartphone },
  { value: "multi_channel", label: "Multi", icon: Layers },
];

const CHANNEL_LIMITS: Record<string, { words?: number; chars?: number; label: string }> = {
  email: { words: 100, label: "100 words" },
  linkedin: { chars: 200, label: "200 chars" },
  text: { chars: 160, label: "160 chars" },
  multi_channel: { words: 100, label: "100 words" },
};

// ─── Helpers ───

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function charCount(text: string): number {
  return text.length;
}

function getLimitStatus(body: string, channel: string): { count: number; limit: number; unit: string; status: "green" | "yellow" | "red" } {
  const spec = CHANNEL_LIMITS[channel] || CHANNEL_LIMITS.email;
  if (spec.chars) {
    const count = charCount(body);
    const limit = spec.chars;
    return {
      count,
      limit,
      unit: "chars",
      status: count > limit ? "red" : count > limit * 0.85 ? "yellow" : "green",
    };
  }
  const count = wordCount(body);
  const limit = spec.words!;
  return {
    count,
    limit,
    unit: "words",
    status: count > limit ? "red" : count > limit * 0.85 ? "yellow" : "green",
  };
}

// ─── Main Page (wrapped in Suspense for useSearchParams) ───

export default function OutreachPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-text-dim" />
      </div>
    }>
      <OutreachStudio />
    </Suspense>
  );
}

function OutreachStudio() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  // ─── State ───
  const [candidate, setCandidate] = useState<CandidateData>({ name: "" });
  const [messages, setMessages] = useState<OutreachMessage[]>([]);
  const [activeStep, setActiveStep] = useState(0);
  const [strategy, setStrategy] = useState("");
  const [sequenceId, setSequenceId] = useState<string | null>(null);

  // Settings
  const [channel, setChannel] = useState<Channel>("email");
  const [tone, setTone] = useState<Tone>("professional");
  const [seqLength, setSeqLength] = useState(3);
  // Structured role context
  const [roleContext, setRoleContext] = useState<RoleContext>({
    roleTitle: '', company: '', payRange: null, workModel: null,
    techStack: [], teamSize: '', companyStage: '', recentNews: ''
  });
  const [sellingPoints, setSellingPoints] = useState<string[]>([""]);

  // LinkedIn-specific settings
  const [viewFirst, setViewFirst] = useState(true);
  const [likePost, setLikePost] = useState(false);
  const [firstTouch, setFirstTouch] = useState<'connect' | 'inmail'>('connect');

  // UI State
  const [generating, setGenerating] = useState(false);
  const [improving, setImproving] = useState(false);
  const [rewriting, setRewriting] = useState(false);
  const [generatingVariant, setGeneratingVariant] = useState(false);
  const [variants, setVariants] = useState<Record<number, string>>({});
  const [showVariant, setShowVariant] = useState<Record<number, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateDesc, setTemplateDesc] = useState("");
  const [savedSequences, setSavedSequences] = useState<{ id: string; candidateName: string; status: string; updatedAt: string }[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  // Outreach history for the selected candidate
  const [outreachHistory, setOutreachHistory] = useState<OutreachHistoryItem[]>([]);

  // Response tracking
  const [showResponseModal, setShowResponseModal] = useState(false);
  const [sequenceStatus, setSequenceStatus] = useState<string>("draft");

  // Suggestions
  const [suggestions, setSuggestions] = useState<{ suggestions: string[]; recommendedChannel?: string; recommendedTone?: string; recommendedLength?: number } | null>(null);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  // Batch queue
  interface BatchCandidate {
    id: string;
    name: string;
    title?: string | null;
    company?: string | null;
    location?: string | null;
    linkedinUrl?: string | null;
    email?: string | null;
    fitScore?: number | null;
    fitReasoning?: string | null;
    flightRisk?: string | null;
    flightRiskSignals?: string[];
    seniority?: string | null;
  }
  const [batchCandidates, setBatchCandidates] = useState<BatchCandidate[]>([]);
  const [batchIndex, setBatchIndex] = useState(0);
  const [batchMapId, setBatchMapId] = useState<string | null>(null);

  const bodyRef = useRef<HTMLTextAreaElement>(null);

  // ─── Auth check ───
  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.push("/api/auth/signin?callbackUrl=/outreach");
    }
  }, [authStatus, router]);

  // ─── Load batch from sessionStorage (map bulk action) ───
  useEffect(() => {
    if (searchParams.get("batch") !== "map") return;
    const raw = sessionStorage.getItem("gitscout_outreach_batch");
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as { mapId: string; candidates: BatchCandidate[] };
      if (parsed.candidates?.length > 0) {
        setBatchCandidates(parsed.candidates);
        setBatchIndex(0);
        setBatchMapId(parsed.mapId);
        const first = parsed.candidates[0];
        setCandidate(fromMapCandidate(first, parsed.mapId, first.company ?? undefined));
      }
    } catch { /* ignore malformed data */ }
    return () => {
      sessionStorage.removeItem("gitscout_outreach_batch");
    };
  }, [searchParams]);

  // ─── Load from URL params (integration entry points) ───
  useEffect(() => {
    const name = searchParams.get("name");
    if (name) {
      setCandidate({
        name,
        title: searchParams.get("title") || undefined,
        company: searchParams.get("company") || undefined,
        location: searchParams.get("location") || undefined,
        linkedinUrl: searchParams.get("linkedin") || undefined,
        email: searchParams.get("email") || undefined,
        githubUrl: searchParams.get("github") || undefined,
        sourceType: searchParams.get("source") || "manual",
        sourceDeveloperId: searchParams.get("devId") || undefined,
        sourceMapId: searchParams.get("mapId") || undefined,
        context: searchParams.get("ctx") ? JSON.parse(searchParams.get("ctx")!) : undefined,
      });

      // Auto-set warm intro tone if from connections
      if (searchParams.get("source") === "connection") {
        setTone("warm_intro");
      }
    }
  }, [searchParams]);

  // ─── Load analytics + templates + sequences ───
  const loadData = useCallback(async () => {
    if (!session?.user?.id) return;

    const [analyticsRes, templatesRes, seqRes] = await Promise.all([
      fetch("/api/outreach/analytics").then((r) => r.json()).catch(() => null),
      fetch("/api/outreach/templates").then((r) => r.json()).catch(() => ({ templates: [] })),
      fetch("/api/outreach/sequences").then((r) => r.json()).catch(() => ({ sequences: [] })),
    ]);

    if (analyticsRes) setAnalytics(analyticsRes);
    setTemplates(templatesRes.templates || []);
    const seqs = seqRes.sequences || [];
    setSavedSequences(seqs);
  }, [session?.user?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ─── Select candidate from browser ───
  function handleSelectCandidate(data: CandidateData) {
    setCandidate(data);
    setMessages([]);
    setActiveStep(0);
    setSequenceId(null);
    setStrategy("");
    setSuggestions(null);
    setOutreachHistory([]);

    // Fetch outreach history for this candidate
    if (data.linkedinUrl || data.email) {
      fetch(
        `/api/outreach/history?linkedin=${encodeURIComponent(data.linkedinUrl || "")}&email=${encodeURIComponent(data.email || "")}`,
      )
        .then((r) => r.json())
        .then((result) => setOutreachHistory(result.sequences || []))
        .catch(() => {});
    }
  }

  // ─── Batch navigation ───
  function goToBatchCandidate(index: number) {
    if (index < 0 || index >= batchCandidates.length || !batchMapId) return;
    setBatchIndex(index);
    const c = batchCandidates[index];
    setCandidate(fromMapCandidate(c, batchMapId, c.company ?? undefined));
    setMessages([]);
    setActiveStep(0);
    setSequenceId(null);
    setStrategy("");
    setSuggestions(null);
  }

  function clearBatch() {
    sessionStorage.removeItem("gitscout_outreach_batch");
    setBatchCandidates([]);
    setBatchIndex(0);
    setBatchMapId(null);
  }

  // ─── Generate sequence ───
  async function handleGenerate() {
    if (!candidate.name.trim()) return;
    setGenerating(true);
    setStrategy("");
    setError(null);

    try {
      const res = await fetch("/api/outreach/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateName: candidate.name,
          candidateTitle: candidate.title,
          candidateCompany: candidate.company,
          candidateLocation: candidate.location,
          candidateLinkedinUrl: candidate.linkedinUrl,
          candidateEmail: candidate.email,
          candidateGithubUrl: candidate.githubUrl,
          candidateContext: candidate.context,
          sourceType: candidate.sourceType,
          sourceDeveloperId: candidate.sourceDeveloperId,
          sourceMapId: candidate.sourceMapId,
          roleTitle: roleContext.roleTitle,
          roleCompany: roleContext.company,
          roleContext,
          sellingPoints: sellingPoints.filter(Boolean),
          channel,
          tone,
          sequenceLength: seqLength,
          firstTouch,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: `Server error (${res.status})` }));
        setError(data.error || "Failed to generate outreach");
        return;
      }

      const data = await res.json();
      setSequenceId(data.id);
      setStrategy(data.strategy || "");
      setMessages(data.messages || []);
      setActiveStep(0);
      setSequenceStatus("draft");
      trackEvent("outreach_generated", { channel, tone, sequenceLength: seqLength });
      loadData();
    } catch (err) {
      console.error("Generate error:", err);
      setError("Network error — check your connection and try again");
    } finally {
      setGenerating(false);
    }
  }

  // ─── Improve active message ───
  async function handleImprove() {
    const msg = messages[activeStep];
    if (!msg) return;
    setImproving(true);
    try {
      const res = await fetch("/api/outreach/improve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg.body,
          candidateContext: {
            name: candidate.name,
            title: candidate.title,
            company: candidate.company,
            ...candidate.context,
          },
          channel: msg.channel,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        updateMessage(activeStep, {
          body: data.body,
          subjectLine: data.subject_line ?? msg.subjectLine,
        });
        trackEvent("outreach_improved");
      }
    } catch (err) {
      console.error("Improve error:", err);
    } finally {
      setImproving(false);
    }
  }

  // ─── Rewrite active message ───
  async function handleRewrite() {
    const msg = messages[activeStep];
    if (!msg) return;
    setRewriting(true);
    try {
      const res = await fetch("/api/outreach/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg.body,
          subjectLine: msg.subjectLine,
          candidateContext: {
            name: candidate.name,
            title: candidate.title,
            company: candidate.company,
            ...candidate.context,
          },
          channel: msg.channel,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        updateMessage(activeStep, {
          body: data.body,
          subjectLine: data.subject_line ?? msg.subjectLine,
        });
        trackEvent("outreach_rewritten");
      }
    } catch (err) {
      console.error("Rewrite error:", err);
    } finally {
      setRewriting(false);
    }
  }

  // ─── Regenerate one step ───
  async function handleRegenerateStep(stepIdx: number) {
    const otherMessages = messages
      .filter((_, i) => i !== stepIdx)
      .map((m) => ({ step_number: m.stepNumber, body: m.body }));

    try {
      const res = await fetch("/api/outreach/regenerate-step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stepNumber: messages[stepIdx].stepNumber,
          otherMessages,
          candidateContext: {
            name: candidate.name,
            title: candidate.title,
            company: candidate.company,
            ...candidate.context,
          },
          channel: messages[stepIdx].channel,
          tone,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        updateMessage(stepIdx, {
          body: data.body,
          subjectLine: data.subject_line ?? messages[stepIdx].subjectLine,
        });
      }
    } catch (err) {
      console.error("Regenerate step error:", err);
    }
  }

  // ─── Generate variant for A/B testing ───
  async function handleGenerateVariant() {
    const msg = messages[activeStep];
    if (!msg || !sequenceId) return;
    setGeneratingVariant(true);
    try {
      const res = await fetch("/api/outreach/variant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sequenceId,
          stepNumber: msg.stepNumber,
          candidateContext: {
            name: candidate.name,
            title: candidate.title,
            company: candidate.company,
            ...candidate.context,
          },
          channel: msg.channel,
          tone,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setVariants((prev) => ({ ...prev, [activeStep]: data.body }));
        setShowVariant((prev) => ({ ...prev, [activeStep]: true }));
        trackEvent("outreach_variant_generated");
      }
    } catch (err) {
      console.error("Generate variant error:", err);
    } finally {
      setGeneratingVariant(false);
    }
  }

  // ─── Load suggestions ───
  async function handleGetSuggestions() {
    setLoadingSuggestions(true);
    try {
      const res = await fetch("/api/outreach/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateContext: {
            name: candidate.name,
            title: candidate.title,
            company: candidate.company,
            ...candidate.context,
          },
        }),
      });
      if (res.ok) {
        setSuggestions(await res.json());
      }
    } catch (err) {
      console.error("Suggestions error:", err);
    } finally {
      setLoadingSuggestions(false);
    }
  }

  // ─── Apply suggestions ───
  function applySuggestions() {
    if (!suggestions) return;
    if (suggestions.recommendedChannel) setChannel(suggestions.recommendedChannel as Channel);
    if (suggestions.recommendedTone) setTone(suggestions.recommendedTone as Tone);
    if (suggestions.recommendedLength) setSeqLength(suggestions.recommendedLength);
  }

  // ─── Message helpers ───
  function updateMessage(index: number, patch: Partial<OutreachMessage>) {
    setMessages((prev) => prev.map((m, i) => (i === index ? { ...m, ...patch } : m)));
  }

  function addStep() {
    const lastMsg = messages[messages.length - 1];
    const newStep: OutreachMessage = {
      stepNumber: (lastMsg?.stepNumber || 0) + 1,
      delayDays: 3,
      channel: channel === "multi_channel" ? "email" : channel,
      subjectLine: null,
      body: "",
    };
    setMessages((prev) => [...prev, newStep]);
    setActiveStep(messages.length);
  }

  function removeStep(index: number) {
    if (messages.length <= 1) return;
    setMessages((prev) => prev.filter((_, i) => i !== index).map((m, i) => ({ ...m, stepNumber: i + 1 })));
    if (activeStep >= messages.length - 1) setActiveStep(Math.max(0, messages.length - 2));
  }

  function moveStep(index: number, direction: "up" | "down") {
    const newIdx = direction === "up" ? index - 1 : index + 1;
    if (newIdx < 0 || newIdx >= messages.length) return;
    setMessages((prev) => {
      const next = [...prev];
      [next[index], next[newIdx]] = [next[newIdx], next[index]];
      return next.map((m, i) => ({ ...m, stepNumber: i + 1 }));
    });
    setActiveStep(newIdx);
  }

  // ─── Copy / Export ───
  function copyToClipboard() {
    const msg = messages[activeStep];
    if (!msg) return;
    const text = msg.subjectLine ? `Subject: ${msg.subjectLine}\n\n${msg.body}` : msg.body;
    navigator.clipboard.writeText(text);
    trackEvent("outreach_copied");
  }

  function exportCSV() {
    const rows = [["step", "delay_days", "channel", "subject", "body"]];
    messages.forEach((m) => {
      rows.push([
        String(m.stepNumber),
        String(m.delayDays),
        m.channel,
        m.subjectLine || "",
        m.body.replace(/"/g, '""'),
      ]);
    });
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `outreach-${candidate.name.replace(/\s+/g, "-").toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    trackEvent("outreach_exported_csv");
  }

  // ─── Save as template ───
  async function handleSaveTemplate() {
    if (!templateName.trim()) return;
    try {
      const templateMessages = messages.map((m) => ({
        step_number: m.stepNumber,
        delay_days: m.delayDays,
        channel: m.channel,
        subject_line: m.subjectLine
          ?.replace(candidate.name, "{candidate_name}")
          .replace(candidate.company || "", "{candidate_company}") || null,
        body: m.body
          .replace(new RegExp(candidate.name, "g"), "{candidate_name}")
          .replace(new RegExp(candidate.company || "___NOMATCH___", "g"), "{candidate_company}"),
      }));

      await fetch("/api/outreach/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: templateName,
          description: templateDesc,
          channel,
          tone,
          sequenceLength: seqLength,
          roleContext: roleContext.roleTitle,
          sellingPoints: sellingPoints.filter(Boolean),
          templateMessages,
        }),
      });

      setShowSaveTemplate(false);
      setTemplateName("");
      setTemplateDesc("");
      loadData();
    } catch (err) {
      console.error("Save template error:", err);
    }
  }

  // ─── Load template ───
  function loadTemplate(template: TemplateItem) {
    setChannel(template.channel as Channel);
    setTone(template.tone as Tone);
    setSeqLength(template.sequenceLength);
    if (template.sellingPoints?.length) setSellingPoints(template.sellingPoints);
    if (template.templateMessages?.length) {
      setMessages(
        (template.templateMessages as unknown as { step_number: number; delay_days: number; channel: string; subject_line: string | null; body: string }[]).map((m) => ({
          stepNumber: m.step_number,
          delayDays: m.delay_days,
          channel: m.channel,
          subjectLine: m.subject_line
            ?.replace("{candidate_name}", candidate.name)
            .replace("{candidate_company}", candidate.company || "") || null,
          body: m.body
            .replace(/{candidate_name}/g, candidate.name)
            .replace(/{candidate_company}/g, candidate.company || ""),
        }))
      );
      setActiveStep(0);
    }
    setShowTemplates(false);
  }

  // ─── Load saved sequence ───
  async function loadSequence(id: string) {
    try {
      const res = await fetch(`/api/outreach/sequences/${id}`);
      if (!res.ok) return;
      const data = await res.json();
      setSequenceId(data.id);
      setCandidate({
        name: data.candidateName,
        title: data.candidateTitle,
        company: data.candidateCompany,
        location: data.candidateLocation,
        linkedinUrl: data.candidateLinkedinUrl,
        email: data.candidateEmail,
        githubUrl: data.candidateGithubUrl,
        context: data.candidateContext,
        sourceType: data.sourceType,
      });
      setChannel(data.channel);
      setTone(data.tone);
      setSeqLength(data.sequenceLength);
      setSellingPoints(data.sellingPoints?.length ? data.sellingPoints : [""]);
      // Load structured roleContext if available, otherwise populate from flat fields
      if (data.roleContext && typeof data.roleContext === 'object') {
        setRoleContext(data.roleContext as RoleContext);
      } else {
        setRoleContext({
          roleTitle: data.roleTitle || '',
          company: data.roleCompany || '',
          payRange: null, workModel: null,
          techStack: [], teamSize: '', companyStage: '', recentNews: ''
        });
      }
      setSequenceStatus(data.status);
      setMessages(
        (data.messages || []).map((m: OutreachMessage) => ({
          id: m.id,
          stepNumber: m.stepNumber,
          delayDays: m.delayDays,
          channel: m.channel,
          subjectLine: m.subjectLine,
          body: m.body,
        }))
      );
      setActiveStep(0);
      setShowHistory(false);
    } catch (err) {
      console.error("Load sequence error:", err);
    }
  }

  // ─── Response tracking ───
  async function markAsSent() {
    if (!sequenceId) return;
    await fetch(`/api/outreach/sequences/${sequenceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "sending" }),
    });
    setSequenceStatus("sending");
  }

  async function recordResponse(sentiment: string) {
    if (!sequenceId) return;
    await fetch(`/api/outreach/sequences/${sequenceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "completed",
        responseReceived: true,
        responseSentiment: sentiment,
      }),
    });
    setSequenceStatus("completed");
    setShowResponseModal(false);
    loadData();
  }

  async function markNoResponse() {
    if (!sequenceId) return;
    await fetch(`/api/outreach/sequences/${sequenceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "completed",
        responseReceived: false,
      }),
    });
    setSequenceStatus("completed");
    loadData();
  }

  // ─── Active message ───
  const activeMsg = messages[activeStep] || null;
  const showSubject = activeMsg?.channel === "email";
  const limitStatus = activeMsg ? getLimitStatus(activeMsg.body, activeMsg.channel) : null;

  if (authStatus === "loading") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-text-dim" />
      </div>
    );
  }

  // ─── THREE-PANEL LAYOUT (always shown — no separate empty state) ───
  return (
    <div className="flex h-[calc(100vh-1px)] overflow-hidden">
      {/* ═══ LEFT PANEL — Candidate Browser ═══ */}
      <div className="w-[280px] shrink-0 border-r border-border flex flex-col bg-surface-secondary">
        {/* Candidate browser */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <CandidateBrowser
            onSelectCandidate={handleSelectCandidate}
            currentCandidate={candidate.name ? candidate : null}
            manualCandidate={candidate}
            onManualChange={(c) => setCandidate(c)}
          />
        </div>

        {/* Candidate summary card (below the browser, when selected) */}
        {candidate.name && (
          <div className="shrink-0 border-t border-border overflow-y-auto max-h-[40%] p-3">
            <div className="rounded-xl border border-border bg-surface p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gold-bg text-gold text-[9px] font-bold">
                  {candidate.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-text truncate">{candidate.name}</p>
                  {candidate.title && <p className="text-[10px] text-text-muted truncate">{candidate.title}</p>}
                </div>
              </div>
              {candidate.company && (
                <div className="flex items-center gap-1.5 text-[11px] text-text-secondary mt-1">
                  <Building2 className="h-3 w-3" />
                  <span>{candidate.company}</span>
                </div>
              )}
              {candidate.location && (
                <div className="flex items-center gap-1.5 text-[11px] text-text-secondary mt-1">
                  <MapPin className="h-3 w-3" />
                  <span>{candidate.location}</span>
                </div>
              )}
              {candidate.githubUrl && (
                <div className="flex items-center gap-1.5 text-[11px] text-text-secondary mt-1">
                  <GithubIcon className="h-3 w-3" />
                  <span className="truncate">{candidate.githubUrl}</span>
                </div>
              )}
              {candidate.linkedinUrl && (
                <div className="flex items-center gap-1.5 text-[11px] text-text-secondary mt-1">
                  <LinkedinIcon className="h-3 w-3" />
                  <span className="truncate">{candidate.linkedinUrl}</span>
                </div>
              )}
              {candidate.context && (
                <div className="mt-2 space-y-1.5 border-t border-border pt-2">
                  {!!(candidate.context as Record<string, unknown>).score && (
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-text-muted">Score</span>
                      <span className="font-semibold text-gold">{String((candidate.context as Record<string, unknown>).score)}</span>
                    </div>
                  )}
                  {!!(candidate.context as Record<string, unknown>).fitScore && (
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-text-muted">Fit</span>
                      <span className="font-semibold text-text">{String((candidate.context as Record<string, unknown>).fitScore)}/100</span>
                    </div>
                  )}
                  {!!(candidate.context as Record<string, unknown>).flightRisk && (
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-text-muted">Flight Risk</span>
                      <span className={cn(
                        "font-semibold capitalize",
                        (candidate.context as Record<string, unknown>).flightRisk === "high" ? "text-danger" :
                        (candidate.context as Record<string, unknown>).flightRisk === "medium" ? "text-warning" : "text-success"
                      )}>
                        {String((candidate.context as Record<string, unknown>).flightRisk)}
                      </span>
                    </div>
                  )}
                  {((candidate.context as Record<string, unknown>).connections as unknown[])?.length > 0 && (
                    <div className="rounded bg-gold-bg border border-gold-border px-2 py-1.5 mt-1">
                      <p className="text-[10px] font-semibold text-gold">
                        {((candidate.context as Record<string, unknown>).connections as unknown[]).length} warm connection{((candidate.context as Record<string, unknown>).connections as unknown[]).length !== 1 ? "s" : ""}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Recent sequences */}
            {savedSequences.length > 0 && (
              <div className="mt-3">
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className="flex w-full items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-text-muted mb-1.5"
                >
                  <span>Recent</span>
                  <ChevronDown className={cn("h-3 w-3 transition-transform", showHistory && "rotate-180")} />
                </button>
                {showHistory && (
                  <div className="space-y-1">
                    {savedSequences.slice(0, 5).map((s) => (
                      <button
                        key={s.id}
                        onClick={() => loadSequence(s.id)}
                        className="w-full rounded-lg border border-border px-2.5 py-1.5 text-left text-[11px] transition-colors hover:bg-surface"
                      >
                        <p className="font-medium text-text truncate">{s.candidateName}</p>
                        <p className="text-[10px] text-text-muted">{s.status}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══ CENTER PANEL — Message Editor ═══ */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Batch queue banner */}
        {batchCandidates.length > 1 && (
          <div className="border-b border-border bg-gold-bg px-5 py-2.5">
            <div className="flex items-center gap-3">
              <Users className="h-4 w-4 text-gold shrink-0" />
              <span className="text-xs font-semibold text-gold">
                Queue &mdash; candidate {batchIndex + 1} of {batchCandidates.length}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => goToBatchCandidate(batchIndex - 1)}
                  disabled={batchIndex === 0}
                  className="rounded p-1 text-gold hover:bg-gold/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => goToBatchCandidate(batchIndex + 1)}
                  disabled={batchIndex === batchCandidates.length - 1}
                  className="rounded p-1 text-gold hover:bg-gold/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="flex items-center gap-1 overflow-x-auto flex-1 min-w-0">
                {batchCandidates.map((bc, i) => (
                  <button
                    key={bc.id}
                    onClick={() => goToBatchCandidate(i)}
                    className={cn(
                      "shrink-0 rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors truncate max-w-[100px]",
                      i === batchIndex
                        ? "bg-gold text-white"
                        : "bg-surface border border-border text-text-muted hover:border-gold/30"
                    )}
                    title={bc.name}
                  >
                    {bc.name.split(" ")[0]}
                  </button>
                ))}
              </div>
              <button
                onClick={clearBatch}
                className="shrink-0 text-[10px] font-medium text-text-muted hover:text-danger transition-colors"
              >
                Clear queue
              </button>
            </div>
          </div>
        )}

        {/* Compact candidate header (visible after generation) */}
        {messages.length > 0 && candidate.name && (
          <CompactCandidateHeader candidate={candidate} />
        )}

        {/* Top bar: response tracking only */}
        {messages.length > 0 && (
        <div className="flex items-center gap-2 border-b border-border px-5 py-2">
          {sequenceId && sequenceStatus === "draft" && (
            <button
              onClick={markAsSent}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-secondary"
            >
              <Send className="h-3 w-3" />
              Mark as sent
            </button>
          )}
          {sequenceId && sequenceStatus === "sending" && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowResponseModal(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-success px-3 py-1.5 text-xs font-medium text-white"
              >
                <CheckCircle2 className="h-3 w-3" />
                Got a response!
              </button>
              <button
                onClick={markNoResponse}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-muted hover:bg-surface-secondary"
              >
                No response
              </button>
            </div>
          )}
        </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="mx-5 mt-3 rounded-lg border border-danger/30 bg-danger-bg px-4 py-2.5 text-sm text-danger flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-danger/60 hover:text-danger">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Editor area */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              {generating ? (
                <div className="space-y-4 w-full max-w-md">
                  <div className="h-4 rounded bg-surface-secondary animate-pulse" />
                  <div className="h-32 rounded-lg bg-surface-secondary animate-pulse" />
                  <div className="h-4 w-2/3 rounded bg-surface-secondary animate-pulse" />
                </div>
              ) : candidate.name ? (
                <div className="w-full h-full overflow-y-auto text-left">
                  <CandidateProfileCard candidate={candidate} outreachHistory={outreachHistory} />
                </div>
              ) : (
                <>
                  <FileText className="h-10 w-10 text-text-dim mb-3" />
                  <p className="text-sm text-text-muted">
                    Select a candidate from the left panel, then click &quot;Generate sequence&quot; to get started.
                  </p>
                </>
              )}
            </div>
          ) : (
            <>
              {/* Sequence status dashboard */}
              <div className="mb-4">
                <SequenceStatusCard
                  channel={channel}
                  tone={tone}
                  strategy={strategy}
                  roleContext={roleContext}
                  sequenceId={sequenceId}
                />
              </div>

              {/* Subject line (email only) */}
              {showSubject && (
                <div className="mb-3">
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                    Subject line
                  </label>
                  <input
                    value={activeMsg?.subjectLine || ""}
                    onChange={(e) => updateMessage(activeStep, { subjectLine: e.target.value })}
                    placeholder="5-8 words. No clickbait."
                    className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-medium outline-none focus:border-gold"
                  />
                  <p className="mt-1 text-[10px] text-text-dim">
                    5-8 words. Reference something specific: their company, a project, or a mutual connection.
                  </p>
                </div>
              )}

              {/* Body editor */}
              <div className="relative">
                <textarea
                  ref={bodyRef}
                  value={activeMsg?.body || ""}
                  onChange={(e) => updateMessage(activeStep, { body: e.target.value })}
                  placeholder="Write your message..."
                  rows={10}
                  className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-sm leading-relaxed outline-none focus:border-gold resize-none"
                />

                {/* Word/char count */}
                {limitStatus && (
                  <div className="mt-1 flex items-center justify-between">
                    <span className={cn(
                      "text-[11px] font-medium tabular-nums",
                      limitStatus.status === "green" ? "text-success" :
                      limitStatus.status === "yellow" ? "text-warning" : "text-danger"
                    )}>
                      {limitStatus.count} / {limitStatus.limit} {limitStatus.unit}
                    </span>
                    {limitStatus.status === "red" && (
                      <span className="text-[10px] text-text-muted">
                        Messages under 80 words get 40% more responses. Cut the pleasantries.
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* A/B Variant toggle */}
              {variants[activeStep] && (
                <div className="mt-3 rounded-lg border border-border bg-surface p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <FlaskConical className="h-3.5 w-3.5 text-text-muted" />
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">A/B Variant</span>
                  </div>
                  <div className="flex items-center gap-1 mb-2">
                    <button
                      onClick={() => setShowVariant((prev) => ({ ...prev, [activeStep]: false }))}
                      className={cn(
                        "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                        !showVariant[activeStep]
                          ? "bg-gold text-white"
                          : "border border-border text-text-secondary hover:bg-surface-secondary"
                      )}
                    >
                      Original
                    </button>
                    <button
                      onClick={() => setShowVariant((prev) => ({ ...prev, [activeStep]: true }))}
                      className={cn(
                        "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                        showVariant[activeStep]
                          ? "bg-gold text-white"
                          : "border border-border text-text-secondary hover:bg-surface-secondary"
                      )}
                    >
                      Variant B
                    </button>
                    {showVariant[activeStep] && (
                      <button
                        onClick={() => {
                          updateMessage(activeStep, { body: variants[activeStep] });
                          setVariants((prev) => {
                            const next = { ...prev };
                            delete next[activeStep];
                            return next;
                          });
                          setShowVariant((prev) => ({ ...prev, [activeStep]: false }));
                        }}
                        className="ml-auto text-[10px] font-semibold text-gold hover:text-gold-hover"
                      >
                        Use this variant
                      </button>
                    )}
                  </div>
                  {showVariant[activeStep] && (
                    <div className="rounded-lg border border-border bg-white dark:bg-neutral-800 p-3">
                      <p className="text-sm text-neutral-900 dark:text-neutral-100 leading-relaxed whitespace-pre-wrap">
                        {variants[activeStep]}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* LinkedIn preview */}
              {channel === "linkedin" && messages.length > 0 && activeMsg?.channel === "linkedin" && (
                <div className="mt-3">
                  <LinkedInPreview message={showVariant[activeStep] && variants[activeStep] ? variants[activeStep] : activeMsg.body} />
                </div>
              )}
            </>
          )}
        </div>

        {/* ─── Sequence Timeline ─── */}
        {messages.length > 0 && (
          <div className="border-t border-border px-5 py-3">
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {messages.map((msg, i) => {
                const ChannelIcon = CHANNELS.find((c) => c.value === msg.channel)?.icon || Mail;
                return (
                  <div key={i} className="flex items-center gap-1.5 shrink-0">
                    {i > 0 && <div className="w-6 h-px bg-border" />}
                    <button
                      onClick={() => setActiveStep(i)}
                      className={cn(
                        "group relative flex flex-col items-center gap-1 rounded-lg border px-3 py-2 text-xs transition-all min-w-[100px]",
                        i === activeStep
                          ? "border-gold bg-gold-bg shadow-sm"
                          : "border-border hover:border-gold/30 hover:bg-surface"
                      )}
                    >
                      <div className="flex items-center gap-1.5">
                        <ChannelIcon className={cn("h-3 w-3", i === activeStep ? "text-gold" : "text-text-muted")} />
                        <span className={cn("font-semibold", i === activeStep ? "text-gold" : "text-text-secondary")}>
                          Day {msg.delayDays}
                        </span>
                      </div>
                      <span className="text-[10px] text-text-muted truncate max-w-[80px]">
                        {msg.body.slice(0, 40)}{msg.body.length > 40 ? "..." : ""}
                      </span>

                      {/* Remove button */}
                      {messages.length > 1 && (
                        <button
                          onClick={(e) => { e.stopPropagation(); removeStep(i); }}
                          className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-danger text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      )}

                      {/* Reorder arrows */}
                      <div className="absolute -left-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-0.5">
                        {i > 0 && (
                          <button onClick={(e) => { e.stopPropagation(); moveStep(i, "up"); }} className="h-3 w-3 text-text-muted hover:text-gold">
                            <ArrowUp className="h-3 w-3" />
                          </button>
                        )}
                        {i < messages.length - 1 && (
                          <button onClick={(e) => { e.stopPropagation(); moveStep(i, "down"); }} className="h-3 w-3 text-text-muted hover:text-gold">
                            <ArrowDown className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </button>
                  </div>
                );
              })}

              {/* Add step */}
              <button
                onClick={addStep}
                className="shrink-0 flex items-center justify-center h-10 w-10 rounded-lg border border-dashed border-border text-text-muted hover:border-gold hover:text-gold transition-colors"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            {/* Each follow-up uses a different angle hint */}
            {messages.length > 1 && (
              <p className="mt-1.5 text-[10px] text-text-dim">
                Each follow-up uses a different angle. Click any step to edit it individually.
              </p>
            )}
          </div>
        )}

        {/* ─── Action buttons ─── */}
        {messages.length > 0 && (
          <div className="border-t border-border px-5 py-3 flex items-center gap-2">
            <button onClick={copyToClipboard} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-secondary">
              <Copy className="h-3 w-3" />
              Copy
            </button>
            <button onClick={exportCSV} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-secondary">
              <Download className="h-3 w-3" />
              Export CSV
            </button>
            <button onClick={() => setShowSaveTemplate(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-secondary">
              <Bookmark className="h-3 w-3" />
              Save as template
            </button>
            <p className="ml-auto text-[10px] text-text-dim">
              This CSV imports directly into Apollo, Outreach, or Salesloft sequences.
            </p>
          </div>
        )}
      </div>

      {/* ═══ RIGHT PANEL — AI Controls + Intelligence ═══ */}
      <div className="w-[300px] shrink-0 border-l border-border overflow-y-auto bg-surface-secondary p-4">
        <div className="mb-5">
          <h3 className="text-[10px] font-semibold uppercase tracking-wide text-text-muted mb-3">Settings</h3>
          <ChannelSelector channel={channel} onChange={setChannel} />
          <ToneSelector tone={tone} onChange={setTone} />

          {/* Channel-specific settings */}
          {channel === 'linkedin' && (
            <ChannelSettingsLinkedin
              seqLength={seqLength} onSeqLengthChange={setSeqLength}
              viewFirst={viewFirst} onViewFirstChange={setViewFirst}
              likePost={likePost} onLikePostChange={setLikePost}
              firstTouch={firstTouch} onFirstTouchChange={setFirstTouch}
            />
          )}
          {channel === 'email' && <ChannelSettingsEmail seqLength={seqLength} onSeqLengthChange={setSeqLength} />}
          {channel === 'text' && <ChannelSettingsText seqLength={seqLength} onSeqLengthChange={setSeqLength} />}
          {channel === 'multi_channel' && <SequenceLengthSlider value={seqLength} onChange={setSeqLength} />}

          <RoleContextPanel value={roleContext} onChange={setRoleContext} />

          {/* Selling points - kept inline */}
          <div className="mb-3">
            <label className="mb-1 block text-xs font-medium text-text-secondary">Selling points</label>
            {sellingPoints.map((sp, i) => (
              <div key={i} className="flex items-center gap-1 mb-1">
                <input
                  value={sp}
                  onChange={(e) => {
                    const next = [...sellingPoints];
                    next[i] = e.target.value;
                    setSellingPoints(next);
                  }}
                  placeholder="What's compelling?"
                  className="flex-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs outline-none focus:border-gold"
                />
                {sellingPoints.length > 1 && (
                  <button
                    onClick={() => setSellingPoints(sellingPoints.filter((_, j) => j !== i))}
                    className="text-text-dim hover:text-danger"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={() => setSellingPoints([...sellingPoints, ""])}
              className="text-[10px] font-medium text-gold hover:text-gold-hover"
            >
              + Add point
            </button>
            <p className="mt-1 text-[10px] text-text-dim">
              Lead with what&apos;s compelling for THEM, not what your company needs. Remote work? Founding team? Interesting technical challenge?
            </p>
          </div>
        </div>

        <ActionsSection
          onGenerate={handleGenerate}
          onRewrite={handleRewrite}
          onImprove={handleImprove}
          onRegenerateStep={handleRegenerateStep}
          onGenerateVariant={sequenceId ? handleGenerateVariant : undefined}
          generating={generating}
          rewriting={rewriting}
          improving={improving}
          generatingVariant={generatingVariant}
          hasMessages={messages.length > 0}
          canGenerate={!!candidate.name.trim()}
          activeStep={activeStep}
        />

        {/* LinkedIn Queue Button */}
        {(channel === 'linkedin' || channel === 'multi_channel') && sequenceId && candidate.linkedinUrl && (
          <LinkedInQueueButton sequenceId={sequenceId} viewFirst={viewFirst} likePost={likePost} />
        )}

        {/* Email Send Button */}
        {(channel === 'email' || channel === 'multi_channel') && sequenceId && candidate.email && (
          <EmailSendButton sequenceId={sequenceId} candidateName={candidate.name} candidateEmail={candidate.email} />
        )}

        {/* Ashby Log */}
        {sequenceId && (
          <AshbyLogSection sequenceId={sequenceId} candidateName={candidate.name} />
        )}

        <TemplatesSection
          templates={templates}
          showTemplates={showTemplates}
          onToggleTemplates={() => setShowTemplates(!showTemplates)}
          onLoadTemplate={loadTemplate}
        />

        <IntelligenceSection analytics={analytics} />

        <SuggestionsSection
          suggestions={suggestions}
          loadingSuggestions={loadingSuggestions}
          onGetSuggestions={handleGetSuggestions}
          onApplySuggestions={applySuggestions}
          showForCandidate={!!candidate.name}
        />
      </div>

      {/* ═══ MODALS ═══ */}

      {/* Save as template modal */}
      {showSaveTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-text mb-4">Save as template</h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-text-secondary">Template name *</label>
                <input
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="e.g. Sr. Engineer Cold Outreach"
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-gold"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-text-secondary">Description</label>
                <textarea
                  value={templateDesc}
                  onChange={(e) => setTemplateDesc(e.target.value)}
                  placeholder="What's this template for?"
                  rows={2}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-gold"
                />
              </div>
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                onClick={() => setShowSaveTemplate(false)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveTemplate}
                disabled={!templateName.trim()}
                className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-white hover:bg-gold-hover disabled:opacity-50"
              >
                Save template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Response sentiment modal */}
      {showResponseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-text mb-2">How was the response?</h3>
            <p className="text-sm text-text-muted mb-4">This helps Scout learn what works for you.</p>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => recordResponse("positive")}
                className="flex flex-col items-center gap-1 rounded-lg border border-border p-3 text-sm hover:bg-success-bg hover:border-success transition-colors"
              >
                <CheckCircle2 className="h-5 w-5 text-success" />
                <span className="text-xs font-medium">Positive</span>
              </button>
              <button
                onClick={() => recordResponse("neutral")}
                className="flex flex-col items-center gap-1 rounded-lg border border-border p-3 text-sm hover:bg-warning-bg hover:border-warning transition-colors"
              >
                <MessageSquare className="h-5 w-5 text-warning" />
                <span className="text-xs font-medium">Neutral</span>
              </button>
              <button
                onClick={() => recordResponse("negative")}
                className="flex flex-col items-center gap-1 rounded-lg border border-border p-3 text-sm hover:bg-danger-bg hover:border-danger transition-colors"
              >
                <AlertCircle className="h-5 w-5 text-danger" />
                <span className="text-xs font-medium">Negative</span>
              </button>
            </div>
            <button
              onClick={() => setShowResponseModal(false)}
              className="mt-3 w-full text-center text-xs text-text-muted hover:text-text"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
