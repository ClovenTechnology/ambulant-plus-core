export type InsightInteractionEvent = {
  id: string;
  ts: string;
  orgId?: string;
  patientId?: string;
  clinicianId?: string | null;

  app: 'patient-app' | 'clinician-app' | 'admin-dashboard';

  surface:
    | 'self-check'
    | 'lady-center'
    | 'antenatal-center'
    | 'gentlemens-health'
    | 'medications'
    | 'profile'
    | 'insights';

  requestId?: string | null;

  inputSnapshot: {
    vitals?: any;
    symptoms?: any;
    medications?: any;
    wearable?: any;
    domain?: any;
  };

  outputSnapshot: {
    riskLabel?: string;
    riskLevel?: string;
    healthScore?: number | null;
    concerns?: string[];
    recommendations?: string[];
    confidence?: number | null;
    degradedMode?: boolean;
    source?: string;
  };

  userAction?: {
    action:
      | 'viewed'
      | 'copied'
      | 'dismissed'
      | 'booked_visit'
      | 'repeated_check'
      | 'followed_recommendation';
    value?: string | null;
  };

  laterOutcome?: {
    clinicianConfirmed?: boolean | null;
    escalated?: boolean | null;
    appointmentBooked?: boolean | null;
  };
};