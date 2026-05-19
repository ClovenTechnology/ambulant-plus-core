// ============================================================================
// apps/patient-app/src/analytics/antenatal.ts
// Antenatal utilities, checklist, eRx, local persistence.
// ----------------------------------------------------------------------------
// Safe to replace existing antenatal.ts.
// Retains existing storage keys and exported function names.
// ============================================================================

export type AntenatalPrefs = {
  edd?: string;
  lmp?: string;
  cycleDays?: number;
  gravida?: number;
  para?: number;
  address?: string;
  geo?: { lat: number; lon: number } | null;
  telehealth?: string;
};

export type AntenatalLog = {
  date: string;
  bpSys?: number;
  bpDia?: number;
  weightKg?: number;
  fetalMovements?: number;
  symptoms?: string[];
  meds?: string[];
  notes?: string;
};

export type VisitItem = {
  date: string;
  label: string;
  purpose: string;
};

export type DrugSafetyCategory =
  | 'avoid'
  | 'caution'
  | 'generally-safe'
  | 'unknown';

export type DrugSafety = {
  category: DrugSafetyCategory;
  message: string;
};

type DrugSafetyRule = {
  re: RegExp;
  any?: DrugSafety;
  t1?: DrugSafety;
  t2?: DrugSafety;
  t3?: DrugSafety;
};

// -----------------------------------------------------------------------------
// Date helpers
// -----------------------------------------------------------------------------

export function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function diffDays(aISO: string, bISO: string): number {
  const a = new Date(aISO);
  const b = new Date(bISO);
  return Math.round((a.getTime() - b.getTime()) / 86_400_000);
}

export function calcEDD(lmp: string, cycleDays = 28): string {
  return addDaysISO(lmp, 280 + (cycleDays - 28));
}

export function gestationalAge(
  todayISO: string,
  eddISO: string
): { weeks: number; days: number } {
  const daysUntilEdd = diffDays(eddISO, todayISO);
  const totalGestationalDays = 280 - daysUntilEdd;

  return {
    weeks: Math.max(0, Math.floor(totalGestationalDays / 7)),
    days: Math.max(0, totalGestationalDays % 7),
  };
}

export function trimester(gaWeeks: number): 1 | 2 | 3 {
  return gaWeeks < 14 ? 1 : gaWeeks < 28 ? 2 : 3;
}

// -----------------------------------------------------------------------------
// Antenatal visit schedule
// -----------------------------------------------------------------------------

export function buildVisitSchedule(eddISO: string): VisitItem[] {
  const start = addDaysISO(eddISO, -280);
  const items: VisitItem[] = [];

  for (let d = 0; d <= 280; d += 7) {
    const cur = addDaysISO(start, d);
    const w = gestationalAge(cur, eddISO).weeks;

    const include =
      (w <= 28 && w % 4 === 0) ||
      (w > 28 && w < 36 && w % 2 === 0) ||
      w >= 36;

    if (!include) continue;

    items.push({
      date: cur,
      label: `Antenatal visit (≈${w}w)`,
      purpose:
        w < 12
          ? 'Booking visit, labs, counseling'
          : w < 28
            ? 'Routine check, anomaly follow-up'
            : w < 36
              ? 'Glucose/BP monitoring, fundal height'
              : 'Position, GBS, birth plan',
    });
  }

  return items.filter((v) => v.date <= eddISO);
}

export function nextVisit(
  schedule: VisitItem[],
  todayISO: string
): VisitItem | null {
  return schedule.find((v) => v.date >= todayISO) ?? null;
}

// -----------------------------------------------------------------------------
// Risk flags
// -----------------------------------------------------------------------------

export function riskFlags(logs: AntenatalLog[]): {
  critical: string[];
  caution: string[];
} {
  const critical: string[] = [];
  const caution: string[] = [];

  const last = logs.at(-1);
  if (!last) return { critical, caution };

  if ((last.bpSys ?? 0) >= 160 || (last.bpDia ?? 0) >= 110) {
    critical.push('Severely elevated BP — seek urgent care');
  } else if ((last.bpSys ?? 0) >= 140 || (last.bpDia ?? 0) >= 90) {
    caution.push('Elevated BP — monitor closely');
  }

  if (last.symptoms?.includes('bleeding')) {
    critical.push('Vaginal bleeding');
  }

  if (
    last.symptoms?.includes('severe-headache') ||
    last.symptoms?.includes('vision')
  ) {
    caution.push('Possible preeclampsia symptoms (headache/vision)');
  }

  if ((last.fetalMovements ?? 10) <= 5) {
    caution.push('Low fetal movement');
  }

  return { critical, caution };
}

// -----------------------------------------------------------------------------
// Local storage
// -----------------------------------------------------------------------------

const PREFS_KEY = 'antenatal:prefs';

export function loadAntenatalPrefs(): AntenatalPrefs | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    return raw ? (JSON.parse(raw) as AntenatalPrefs) : null;
  } catch {
    return null;
  }
}

export function saveAntenatalPrefs(prefs: AntenatalPrefs): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore storage failures.
  }
}

const LOGS_KEY = 'antenatal:logs';

export function loadAntenatalLogs(): AntenatalLog[] {
  if (typeof window === 'undefined') return [];

  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(LOGS_KEY) || '[]'
    ) as unknown;

    return Array.isArray(parsed) ? (parsed as AntenatalLog[]) : [];
  } catch {
    return [];
  }
}

export function saveAntenatalLog(entry: AntenatalLog): void {
  if (typeof window === 'undefined') return;

  const all = loadAntenatalLogs().filter((x) => x.date !== entry.date);
  all.push(entry);
  all.sort((a, b) => a.date.localeCompare(b.date));

  try {
    window.localStorage.setItem(LOGS_KEY, JSON.stringify(all));
  } catch {
    // Ignore storage failures.
  }
}

// -----------------------------------------------------------------------------
// Labs and vaccines
// -----------------------------------------------------------------------------

export type ChecklistItem = {
  code: string;
  kind: 'lab' | 'vaccine';
  name: string;
  startWeeks: number;
  endWeeks: number;
  notes?: string;
};

export type ChecklistWithDates = ChecklistItem & {
  startDate: string;
  endDate: string;
  dueDate: string;
};

export type ChecklistStatus = 'upcoming' | 'due' | 'overdue' | 'completed';

export type ChecklistDoneMap = Record<string, { doneDate: string }>;

export const CHECKLIST: ChecklistItem[] = [
  {
    code: 'US1',
    kind: 'lab',
    name: 'Dating ultrasound',
    startWeeks: 8,
    endWeeks: 12,
  },
  {
    code: 'ANOM',
    kind: 'lab',
    name: 'Morphology (anomaly) scan',
    startWeeks: 18,
    endWeeks: 22,
  },
  {
    code: 'OGTT',
    kind: 'lab',
    name: 'Glucose screening (OGTT)',
    startWeeks: 24,
    endWeeks: 28,
  },
  {
    code: 'RHIG',
    kind: 'lab',
    name: 'Anti-D (if Rh-negative)',
    startWeeks: 28,
    endWeeks: 28,
    notes: 'If Rh-negative',
  },
  {
    code: 'GBS',
    kind: 'lab',
    name: 'GBS screening',
    startWeeks: 36,
    endWeeks: 37,
  },
  {
    code: 'FLU',
    kind: 'vaccine',
    name: 'Influenza vaccine',
    startWeeks: 1,
    endWeeks: 42,
    notes: 'Seasonal',
  },
  {
    code: 'TDAP',
    kind: 'vaccine',
    name: 'Tdap',
    startWeeks: 27,
    endWeeks: 36,
  },
];

function fromWeeks(edd: string, weeks: number): string {
  return addDaysISO(edd, -(280 - weeks * 7));
}

export function buildChecklist(edd: string): ChecklistWithDates[] {
  return CHECKLIST.map((item) => {
    const startDate = fromWeeks(edd, item.startWeeks);
    const endDate = fromWeeks(edd, item.endWeeks);
    const dueDate = fromWeeks(
      edd,
      Math.floor((item.startWeeks + item.endWeeks) / 2)
    );

    return {
      ...item,
      startDate,
      endDate,
      dueDate,
    };
  });
}

export function getChecklistItem(code: string): ChecklistItem | undefined {
  const normalizedCode = code.toUpperCase();
  return CHECKLIST.find((item) => item.code.toUpperCase() === normalizedCode);
}

const LABS_KEY = 'antenatal:labs';

export function loadChecklistDone(): ChecklistDoneMap {
  if (typeof window === 'undefined') return {};

  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(LABS_KEY) || '{}'
    ) as unknown;

    return parsed && typeof parsed === 'object'
      ? (parsed as ChecklistDoneMap)
      : {};
  } catch {
    return {};
  }
}

export function saveChecklistDone(map: ChecklistDoneMap): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(LABS_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage failures.
  }
}

export function statusFor(
  item: ChecklistWithDates,
  done: ChecklistDoneMap,
  todayISO: string
): ChecklistStatus {
  if (done[item.code]?.doneDate) return 'completed';
  if (todayISO > item.endDate) return 'overdue';
  if (todayISO >= item.startDate) return 'due';
  return 'upcoming';
}

// -----------------------------------------------------------------------------
// Drug safety quick table
// -----------------------------------------------------------------------------

const UNKNOWN_DRUG_SAFETY: DrugSafety = {
  category: 'unknown',
  message: 'Not in quick table. Consult provider.',
};

const NO_TRIMESTER_GUIDANCE: DrugSafety = {
  category: 'unknown',
  message: 'No quick guidance.',
};

const RULES: readonly DrugSafetyRule[] = [
  {
    re: /^(acetaminophen|paracetamol)$/i,
    any: {
      category: 'generally-safe',
      message: 'Use lowest effective dose; avoid chronic use.',
    },
  },
  {
    re: /^(ibuprofen|naproxen|nsaid)$/i,
    t1: {
      category: 'caution',
      message: 'Avoid routine use in T1.',
    },
    t2: {
      category: 'caution',
      message: 'Provider-guided.',
    },
    t3: {
      category: 'avoid',
      message: 'Avoid in T3 (ductus risk).',
    },
  },
  {
    re: /^(amoxicillin|penicillin)$/i,
    any: {
      category: 'generally-safe',
      message: 'Common when indicated.',
    },
  },
  {
    re: /^(tetracycline|doxycycline)$/i,
    any: {
      category: 'avoid',
      message: 'Tooth/bone effects.',
    },
  },
  {
    re: /^(isotretinoin|accutane)$/i,
    any: {
      category: 'avoid',
      message: 'Teratogenic.',
    },
  },
  {
    re: /^pseudoephedrine$/i,
    t1: {
      category: 'caution',
      message: 'Avoid in T1 unless directed.',
    },
    t2: {
      category: 'caution',
      message: 'Use with caution.',
    },
    t3: {
      category: 'caution',
      message: 'Monitor BP.',
    },
  },
  {
    re: /^aspirin( low dose)?$/i,
    any: {
      category: 'generally-safe',
      message: 'Low-dose often used for preeclampsia prevention (per provider).',
    },
  },
];

export function checkDrugSafety(drug: string, gaWeeks: number): DrugSafety {
  const normalizedDrug = drug.trim();

  if (!normalizedDrug) {
    return UNKNOWN_DRUG_SAFETY;
  }

  const row = RULES.find((rule) => rule.re.test(normalizedDrug));

  if (!row) {
    return UNKNOWN_DRUG_SAFETY;
  }

  const tri = trimester(gaWeeks);

  if (tri === 1) {
    return row.t1 ?? row.any ?? NO_TRIMESTER_GUIDANCE;
  }

  if (tri === 2) {
    return row.t2 ?? row.any ?? NO_TRIMESTER_GUIDANCE;
  }

  return row.t3 ?? row.any ?? NO_TRIMESTER_GUIDANCE;
}

// -----------------------------------------------------------------------------
// eRx
// -----------------------------------------------------------------------------

export type ERx = {
  id: string;
  date: string;
  drug: string;
  dose: string;
  sig: string;
  prescriber: string;
  notes?: string;
};

const ERX_KEY = 'antenatal:erx';

export function loadERx(): ERx[] {
  if (typeof window === 'undefined') return [];

  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(ERX_KEY) || '[]'
    ) as unknown;

    return Array.isArray(parsed) ? (parsed as ERx[]) : [];
  } catch {
    return [];
  }
}

export function saveERx(rx: ERx): void {
  const all = loadERx().filter((item) => item.id !== rx.id);
  all.push(rx);
  persistERx(all);
}

export function removeERx(id: string): void {
  persistERx(loadERx().filter((item) => item.id !== id));
}

function persistERx(all: ERx[]): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(ERX_KEY, JSON.stringify(all));
  } catch {
    // Ignore storage failures.
  }
}