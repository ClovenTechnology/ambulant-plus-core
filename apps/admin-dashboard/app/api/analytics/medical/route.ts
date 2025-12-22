type MedicalAnalyticsPayload = {
  kpis: {
    /** Total cases in the selected window after filters */
    totalCases: number;
    /** New cases (e.g. last 24h inside the window or last bucket) */
    newCases: number;
    /** Confirmed positive tests / total tests (%) for this cohort */
    testPositivityPct: number;
    /** Count of active outbreak signals for the current filter scope */
    suspectedOutbreaks: number;
    /** % of cases where age ∈ [0,17] */
    paedsSharePct: number;
    /** % of active patients with >= moderate risk InsightCore alerts in last 7d */
    highRiskPatientsPct7d: number;
    /** Avg time (hours) from symptom onset to first consult */
    avgTimeToFirstConsultHours: number;
  };

  /** High-level syndrome buckets for stacked views / legend */
  topSyndromes: {
    key: 'respiratory' | 'gi' | 'feverRash' | 'neuro' | 'other';
    label: string;
    cases: number;
    sharePct: number;
  }[];

  /** Time series; bucket granularity inferred from range (e.g. daily) */
  timeSeries: {
    bucket: string; // ISO date (YYYY-MM-DD) or month label
    totalCases: number;
    respiratory: number;
    gi: number;
    feverRash: number;
    neuro: number;
    other: number;
  }[];

  /** Top ICD-10 codes contributing to this cohort */
  topIcd10: {
    code: string;
    description: string;
    cases: number;
    patients: number;
    sharePct: number;
    ageBandBreakdown: {
      band: string; // "0–17" etc
      cases: number;
    }[];
  }[];

  /** Geospatial incidence summary for the chosen geoLevel */
  geoIncidence: {
    geoLevel: 'country' | 'province' | 'city' | 'postalCode';
    name: string;
    code: string;
    totalCases: number;
    incidencePer100k: number;
    /** % change vs previous comparable window (e.g. prior 7d) */
    growthRatePct: number;
    /** Flag for statistical clustering / anomaly */
    suspectedCluster: boolean;
    /** Dominant high-level syndrome in this bucket */
    dominantSyndrome?: 'respiratory' | 'gi' | 'feverRash' | 'neuro' | 'other';
  }[];

  /** Movement of patients between locations (for spread mapping) */
  movement: {
    fromName: string;
    fromCode: string;
    toName: string;
    toCode: string;
    patients: number;
    suspectedCases: number;
  }[];

  /** Demography matrix: age-band x gender segments */
  demography: {
    ageBand: string; // "0–17", "18–39" etc.
    gender: 'Male' | 'Female' | 'Other';
    patients: number;
    cases: number;
    incidencePer100k: number;
    sharePct: number;
    topIcd10: {
      code: string;
      description: string;
      cases: number;
    }[];
  }[];

  /** Medication usage broken down into slices */
  meds: {
    overall: {
      atcCode?: string | null;
      name: string;
      prescriptions: number;
      patients: number;
      sharePct: number;
      demographicSkew?: string;
    }[];
    paeds: {
      atcCode?: string | null;
      name: string;
      prescriptions: number;
      patients: number;
      sharePct: number;
      demographicSkew?: string;
    }[];
    adults: {
      atcCode?: string | null;
      name: string;
      prescriptions: number;
      patients: number;
      sharePct: number;
      demographicSkew?: string;
    }[];
    seniors: {
      atcCode?: string | null;
      name: string;
      prescriptions: number;
      patients: number;
      sharePct: number;
      demographicSkew?: string;
    }[];
  };

  /** Lab utilisation and positivity */
  labs: {
    loincCode?: string | null;
    name: string;
    orders: number;
    positives: number;
    positivityPct: number;
    topIcd10: {
      code: string;
      description: string;
      cases: number;
    }[];
  }[];

  /** Outbreak / cluster detection signals */
  outbreakSignals: {
    id: string;
    syndrome: 'respiratory' | 'gi' | 'feverRash' | 'neuro' | 'other';
    label: string;
    geoLevel: 'country' | 'province' | 'city' | 'postalCode';
    locationName: string;
    /** 0–1 anomaly score (higher = more unusual) */
    signalScore: number;
    /** Current rate vs baseline (e.g. 2.4 → 2.4x baseline) */
    baselineMultiplier: number;
    /** Optional reproduction estimate, if you compute it */
    rEstimate?: number | null;
    status: 'watch' | 'investigate' | 'incident';
    window: { from: string; to: string }; // ISO timestamps
  }[];

  /** Paediatric-specific snapshot */
  paediatrics: {
    totalCases: number;
    sharePct: number;
    hospitalisationRatePer1000: number;
    topDiagnoses: {
      code: string;
      description: string;
      cases: number;
    }[];
    topAgeBands: {
      band: string; // e.g. "0–4", "5–11"
      cases: number;
    }[];
  };
};
