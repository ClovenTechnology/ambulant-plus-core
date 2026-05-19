export type InsightSource = 'insightcore' | 'local_fallback' | 'hybrid';

export type PatientRiskLevel = 'low' | 'watch' | 'moderate' | 'high' | 'critical';

export type PatientInsightResponse = {
  requestId: string;
  generatedAt: string;
  degradedMode: boolean;
  source: InsightSource;

  summary: {
    riskLabel: string;
    riskLevel: PatientRiskLevel;
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
   Lady Center InsightCore Contract
========================================================= */

export type LadyCenterInsightResponse = {
  requestId: string;
  generatedAt: string;
  degradedMode: boolean;
  source: InsightSource;

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

export type ClinicianInsightResponse = {
  requestId: string;
  generatedAt: string;
  degradedMode: boolean;

  patientSummary: {
    riskLabel: string;
    riskLevel: string;
    confidence?: number | null;
    baselineSummary?: any;
    trendSummary?: any;
  };

  deploymentInferences: any[];
  episodes: any[];
  alerts: any[];
  insights: any[];

  rationale?: {
    concerns: string[];
    drivers: string[];
    medicationImpact?: string[];
  };

  uncertainty?: any;
  traceRef?: string | null;
  lineageRef?: string | null;

  researchSection?: {
    available: boolean;
    items: any[];
    label: 'research_only';
  };
};

export type AdminInsightResponse = {
  requestId: string;
  generatedAt: string;

  runtimePlan?: any;
  runtimeAudit?: any;

  rolloutRecords: any[];
  experimentAssignments: any[];

  evaluation?: {
    modelScorecard?: any;
    familyScorecard?: any;
    runtimeDrift?: any;
    baselineDrift?: any;
    researchScorecard?: any;
    executionQuality?: any;
  };

  governance?: {
    compliance?: any;
    rolloutSafety?: any;
    policyDrift?: any;
  };

  cohort?: any;
};