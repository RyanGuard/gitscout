export interface DashboardSequence {
  id: string;
  candidateName: string;
  candidateTitle: string | null;
  candidateCompany: string | null;
  candidateLinkedinUrl: string | null;
  candidateGithubUrl: string | null;
  sourceDeveloperId: string | null;
  channel: string;
  tone: string;
  status: string;
  responseReceived: boolean;
  responseSentiment: string | null;
  linkedinQueuedAt: string | null;
  ashbyPushedAt: string | null;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AttentionItem {
  type: 'overdue' | 'stuck' | 'positive_response';
  count: number;
  label: string;
  sequenceIds: string[];
}

export interface ActivityItem {
  type: string;
  name: string;
  timestamp: string;
  status?: string;
}

export interface DashboardMetrics {
  responseRate: number;
  bestChannel: { channel: string; rate: number } | null;
  bestTone: { tone: string; rate: number } | null;
  avgResponseTime: number | null;
  totalDataPoints: number;
}

export interface AgentStatus {
  todayActions: Record<string, number>;
  lastActionAt: string | null;
  totalToday: number;
}

export interface FunnelData {
  drafted: number;
  sent: number;
  viewed: number;
  connected: number;
  messaged: number;
  responded: number;
}
