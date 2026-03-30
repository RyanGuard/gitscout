// ─── Shared Types for Outreach Settings ───

export type Channel = "email" | "linkedin" | "text" | "multi_channel";
export type Tone = "professional" | "casual" | "technical_peer" | "executive" | "warm_intro";

export interface OutreachMessage {
  id?: string;
  stepNumber: number;
  delayDays: number;
  channel: string;
  subjectLine: string | null;
  body: string;
}

export interface AnalyticsData {
  hasEnoughData: boolean;
  totalDataPoints: number;
  bestChannel?: { channel: string; rate: number };
  bestTone?: { tone: string; rate: number };
  optimalLength?: { min: number; max: number };
  topSignal?: { signal: string; rate: number };
}

export interface TemplateItem {
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

export interface SuggestionsData {
  suggestions: string[];
  recommendedChannel?: string;
  recommendedTone?: string;
  recommendedLength?: number;
}
