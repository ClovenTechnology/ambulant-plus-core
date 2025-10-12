// ============================================================================
// apps/patient-app/src/analytics/antenatal.ts
// Antenatal utilities, checklist, eRx, local persistence.
// ----------------------------------------------------------------------------
// This file is safe to replace the existing antenatal.ts. It retains the same
// storage keys and function names used elsewhere (no breaking changes).
// ============================================================================

export type AntenatalPrefs = {
  edd?: string;
  lmp?: string;
  cycleDays?: number;
  gravida?: number;
  para?: number;
  // new fields persisted in prefs
  address?: string; // clinic address, multi-line
  geo?: { lat: number; lon: number } | null;
  telehealth?: string; // telehealth join URL (optional)
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

export type VisitItem = { date: string; label: string; purpose: string };

// Date helpers
export function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
export function diffDays(aISO: string, bISO: string): number {
  const a = new Date(aISO);
  const b = new Date(bISO);
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}
export function calcEDD(lmp: string, cycleDays = 28): string {
  // Naegele's rule + cycle length adjustment
  return addDaysISO(lmp, 280 + (cycleDays - 28));
}
export function gestationalAge(todayISO: string, eddISO: string) {
  const d = diffDays(eddISO, todayISO);
  const total = 280 - d;
  return { weeks: Math.max(0, Math.floor(total / 7)), days: Math.max(0, total % 7) };
}
export function trimester(gaWeeks: number): 1 | 2 | 3 {
  return gaWeeks < 14 ? 1 : gaWeeks < 28 ? 2 : 3;
}

/**
 * Build a pragmatic visit schedule (weekly seed, then filtered to standard cadence).
 * Returns visits from LMP → EDD inclusive.
 */
export function buildVisitSchedule(eddISO: string): VisitItem[] {
  const start = addDaysISO(eddISO, -280);
  const items: VisitItem[] = [];
  for (let d = 0; d <= 280; d += 7) {
    const cur = addDaysISO(start, d);
    const w = gestationalAge(cur, eddISO).weeks;
    const include =
      (w <= 28 && w % 4 === 0) || // monthly until 28w
      (w > 28 && w < 36 && w % 2 === 0) || // biweekly 28–36w
      (w >= 36); // weekly 36+
    if (include) {
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
  }
  // keep only dates on-or-before EDD
  return items.filter((v) => v.date <= eddISO);
}
export function nextVisit(schedule: VisitItem[], todayISO: string) {
  return schedule.find((v) => v.date >= todayISO) ?? null;
}

/**
 * Quick risk flags from most recent log (client-side heuristic)
 */
export function riskFlags(logs: AntenatalLog[]) {
  const critical: string[] = [];
  const caution: string[] = [];
  const last = logs.at(-1);
  if (last) {
    if ((last.bpSys ?? 0) >= 160 || (last.bpDia ?? 0) >= 110)
      critical.push('Severely elevated BP — seek urgent care');
    else if ((last.bpSys ?? 0) >= 140 || (last.bpDia ?? 0) >= 90)
      caution.push('Elevated BP — monitor closely');
    if (last.symptoms?.includes('bleeding')) critical.push('Vaginal bleeding');
    if (last.symptoms?.includes('severe-headache') || last.symptoms?.includes('vision'))
      caution.push('Possible preeclampsia symptoms (headache/vision)');
    if ((last.fetalMovements ?? 10) <= 5) caution.push('Low fetal movement');
  }
  return { critical, caution };
}

// ---------- Local storage (browser only) ----------
const PREFS_KEY = 'antenatal:prefs';
export function loadAntenatalPrefs(): AntenatalPrefs | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
export function saveAntenatalPrefs(p: AntenatalPrefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {}
}

const LOGS_KEY = 'antenatal:logs';
export function loadAntenatalLogs(): AntenatalLog[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(LOGS_KEY) || '[]');
  } catch {
    return [];
  }
}
export function saveAntenatalLog(entry: AntenatalLog) {
  const all = loadAntenatalLogs().filter((x) => x.date !== entry.date);
  all.push(entry);
  all.sort((a, b) => a.date.localeCompare(b.date));
  try {
    localStorage.setItem(LOGS_KEY, JSON.stringify(all));
  } catch {}
}

// ---------- Labs & Vaccines ----------
export type ChecklistItem = {
  code: string;
  kind: 'lab' | 'vaccine';
  name: string;
  startWeeks: number;
  endWeeks: number;
  notes?: string;
};
export type ChecklistWithDates = ChecklistItem & { startDate: string; endDate: string; dueDate: string };
export type ChecklistStatus = 'upcoming' | 'due' | 'overdue' | 'completed';
export type ChecklistDoneMap = Record<string, { doneDate: string }>;

export const CHECKLIST: ChecklistItem[] = [
  { code: 'US1', kind: 'lab', name: 'Dating ultrasound', startWeeks: 8, endWeeks: 12 },
  { code: 'ANOM', kind: 'lab', name: 'Morphology (anomaly) scan', startWeeks: 18, endWeeks: 22 },
  { code: 'OGTT', kind: 'lab', name: 'Glucose screening (OGTT)', startWeeks: 24, endWeeks: 28 },
  { code: 'RHIG', kind: 'lab', name: 'Anti-D (if Rh-negative)', startWeeks: 28, endWeeks: 28, notes: 'If Rh-negative' },
  { code: 'GBS', kind: 'lab', name: 'GBS screening', startWeeks: 36, endWeeks: 37 },
  { code: 'FLU', kind: 'vaccine', name: 'Influenza vaccine', startWeeks: 1, endWeeks: 42, notes: 'Seasonal' },
  { code: 'TDAP', kind: 'vaccine', name: 'Tdap', startWeeks: 27, endWeeks: 36 },
];

function fromWeeks(edd: string, weeks: number) {
  // convert gestational weeks to calendar date (approx)
  return addDaysISO(edd, -(280 - weeks * 7));
}
export function buildChecklist(edd: string): ChecklistWithDates[] {
  return CHECKLIST.map((it) => {
    const startDate = fromWeeks(edd, it.startWeeks);
    const endDate = fromWeeks(edd, it.endWeeks);
    const dueDate = fromWeeks(edd, Math.floor((it.startWeeks + it.endWeeks) / 2));
    return { ...it, startDate, endDate, dueDate };
  });
}
export function getChecklistItem(code: string) {
  return CHECKLIST.find((c) => c.code.toUpperCase() === code.toUpperCase());
}

const LABS_KEY = 'antenatal:labs';
export function loadChecklistDone(): ChecklistDoneMap {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(LABS_KEY) || '{}');
  } catch {
    return {};
  }
}
export function saveChecklistDone(map: ChecklistDoneMap) {
  try {
    localStorage.setItem(LABS_KEY, JSON.stringify(map));
  } catch {}
}
export function statusFor(item: ChecklistWithDates, done: ChecklistDoneMap, todayISO: string): ChecklistStatus {
  if (done[item.code]?.doneDate) return 'completed';
  if (todayISO > item.endDate) return 'overdue';
  if (todayISO >= item.startDate) return 'due';
  return 'upcoming';
}

// ---------- Drug safety (info only) ----------
export type DrugSafety = { category: 'avoid' | 'caution' | 'generally-safe' | 'unknown'; message: string };

const RULES = [
  { re: /^(acetaminophen|paracetamol)$/i, any: { category: 'generally-safe', message: 'Use lowest effective dose; avoid chronic use.' } },
  {
    re: /^(ibuprofen|naproxen|nsaid)$/i,
    t1: { category: 'caution', message: 'Avoid routine use in T1.' },
    t2: { category: 'caution', message: 'Provider-guided.' },
    t3: { category: 'avoid', message: 'Avoid in T3 (ductus risk).' },
  },
  { re: /^(amoxicillin|penicillin)$/i, any: { category: 'generally-safe', message: 'Common when indicated.' } },
  { re: /^(tetracycline|doxycycline)$/i, any: { category: 'avoid', message: 'Tooth/bone effects.' } },
  { re: /^(isotretinoin|accutane)$/i, any: { category: 'avoid', message: 'Teratogenic.' } },
  {
    re: /^pseudoephedrine$/i,
    t1: { category: 'caution', message: 'Avoid in T1 unless directed.' },
    t2: { category: 'caution', message: 'Use with caution.' },
    t3: { category: 'caution', message: 'Monitor BP.' },
  },
  { re: /^aspirin( low dose)?$/i, any: { category: 'generally-safe', message: 'Low-dose often used for preeclampsia prevention (per provider).' } },
] as const;

export function checkDrugSafety(drug: string, gaWeeks: number): DrugSafety {
  const tri = trimester(gaWeeks);
  const row = (RULES as any[]).find((r) => r.re.test(drug.trim()));
  if (!row) return { category: 'unknown', message: 'Not in quick table. Consult provider.' };
  const rule = tri === 1 ? row.t1 ?? row.any : tri === 2 ? row.t2 ?? row.any : row.t3 ?? row.any;
  return rule || { category: 'unknown', message: 'No quick guidance.' };
}

// ---------- eRx (OB/GYN) ----------
export type ERx = { id: string; date: string; drug: string; dose: string; sig: string; prescriber: string; notes?: string };
const ERX_KEY = 'antenatal:erx';
export function loadERx(): ERx[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(ERX_KEY) || '[]');
  } catch {
    return [];
  }
}
export function saveERx(rx: ERx) {
  const all = loadERx().filter((r) => r.id !== rx.id);
  all.push(rx);
  persistERx(all);
}
export function removeERx(id: string) {
  persistERx(loadERx().filter((r) => r.id !== id));
}
function persistERx(all: ERx[]) {
  try {
    localStorage.setItem(ERX_KEY, JSON.stringify(all));
  } catch {}
}
