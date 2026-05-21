export type InsightSource = 'insightcore';

export type PatientInsightResponse = {
  requestId: string;
  generatedAt: string;
  degradedMode: boolean;
  source: InsightSource;

  summary: {
    riskLabel: string;
    riskLevel: 'low' | 'watch' | 'moderate' | 'high' | 'critical';
    healthScore?: number | null;
    confidence?: number | null;
    requiresClinicianReview?: boolean;
  };

  concerns: Array<{
    name: string;
    prob?: number | null;
  }>;

  recommendations: string[];
  explanations: Array<{
    feature: string;
    impact?: number | null;
    note?: string | null;
  }>;

  trendSummary?: {
    label: string;
    note?: string;
  } | null;

  baselineSummary?: {
    label: string;
    note?: string;
  } | null;

  nextBestActions: Array<{
    id: string;
    label: string;
    href?: string;
    kind: 'self_care' | 'book_visit' | 'repeat_check' | 'urgent_help';
  }>;

  whenToSeekCare?: {
    urgency: 'routine' | 'soon' | 'urgent';
    message: string;
  } | null;

  handoffAvailable?: boolean;
};

/* =========================================================
   Lady Center InsightCore Contract (Patient App Layer)
========================================================= */

export type LadyCenterInsightResponse = {
  requestId: string;
  generatedAt: string;
  degradedMode: boolean;
  source: 'insightcore';

  todaySummary?: {
    subtitle?: string;
    primary?: { k: string; v: string };
    secondary?: Array<{ k: string; v: string }>;
    badge?: string;
  } | null;

  insights: Array<{
    id: string;
    tone: 'info' | 'good' | 'attention';
    title: string;
    summary: string;
    why?: string;
    next?: string;
    source?: string;
  }>;

  prioritizedScreeningKeys: string[];

  screeningNote?: string | null;

  documentSuggestion?: string | null;

  carePathGuidance?: Record<string, string>;

  reportNote?: string | null;

  whenToSeekCare?: {
    urgency: 'routine' | 'soon' | 'urgent';
    message: string;
  } | null;
};