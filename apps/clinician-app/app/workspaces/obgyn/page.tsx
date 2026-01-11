/*
File: apps/clinician-app/app/workspaces/obgyn/page.tsx
Purpose: OB/GYN workspace — upgraded world-class UI aligned with Dental/Physio style.
Notes:
- Uses shared workspaces UI components and POST helpers.
- Still optimistic local state until GET endpoints exist.
- Includes Patient Context panel that can be wired to a future API:
    GET /api/workspaces/obgyn/context?patientId=...&encounterId=...
  (falls back gracefully if not available)
- Stores structured extras (triage, vitals, ICD10, visitMode) into Finding.meta to avoid losing data pre-DB-form models.
*/

'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Baby,
  CalendarDays,
  ClipboardCopy,
  HeartPulse,
  Info,
  Link2,
  Shield,
  Sparkles,
  Stethoscope,
  Timer,
  CheckCircle2,
  RefreshCw,
  Search,
  Plus,
  Wand2,
  Dot,
} from 'lucide-react';

import {
  TogglePills,
  BookmarkModal,
  EvidenceStrip as WorkspaceEvidenceStrip,
  FindingCard,
} from '@/src/components/workspaces/ui';

import type { Evidence, Finding, Location } from '@/src/lib/workspaces/types';
import { postAnnotation, postEvidence, postFinding } from '@/src/lib/workspaces/api';

const TRACKS = [
  { key: 'ob', label: 'Obstetrics (OB)' },
  { key: 'gyn', label: 'Gynaecology (GYN)' },
] as const;

type TrackKey = (typeof TRACKS)[number]['key'];

const VISIT_MODES = [
  { key: 'televisit', label: 'Televisit' },
  { key: 'in_person', label: 'In-person' },
  { key: 'hybrid', label: 'Hybrid' },
] as const;
type VisitMode = (typeof VISIT_MODES)[number]['key'];

const FINDING_TYPES = [
  { key: 'routine_check', label: 'Routine check' },
  { key: 'pelvic_pain', label: 'Pelvic pain' },
  { key: 'bleeding', label: 'Bleeding' },
  { key: 'discharge', label: 'Discharge / irritation' },
  { key: 'infection_suspected', label: 'Infection suspected' },
  { key: 'hypertension_suspected', label: 'Hypertension suspected' },
  { key: 'fetal_wellbeing', label: 'Fetal wellbeing (OB)' },
  { key: 'contractions', label: 'Contractions / labour symptoms (OB)' },
  { key: 'contraception', label: 'Contraception' },
  { key: 'fertility', label: 'Fertility / conception' },
  { key: 'menstrual_concerns', label: 'Menstrual concerns' },
  { key: 'cervical_screening', label: 'Cervical screening / Pap smear' },
  { key: 'sti_risk', label: 'STI risk / exposure' },
  { key: 'other', label: 'Other' },
] as const;

type FindingTypeKey = (typeof FINDING_TYPES)[number]['key'];

/** Minimal ICD-10 suggestions (expand later). */
const ICD10_SUGGESTIONS: Record<FindingTypeKey, { code: string; label: string }[]> = {
  routine_check: [
    { code: 'Z34.9', label: 'Supervision of normal pregnancy, unspecified' },
    { code: 'Z01.419', label: 'Gynecological exam without abnormal findings' },
  ],
  pelvic_pain: [{ code: 'R10.2', label: 'Pelvic and perineal pain' }],
  bleeding: [
    { code: 'N93.9', label: 'Abnormal uterine and vaginal bleeding, unspecified' },
    { code: 'O46.9', label: 'Antepartum hemorrhage, unspecified' },
  ],
  discharge: [{ code: 'N89.8', label: 'Other specified noninflammatory disorders of vagina' }],
  infection_suspected: [
    { code: 'N76.0', label: 'Acute vaginitis' },
    { code: 'N39.0', label: 'UTI, site not specified' },
  ],
  hypertension_suspected: [
    { code: 'I10', label: 'Essential (primary) hypertension' },
    { code: 'O13.9', label: 'Gestational [pregnancy-induced] hypertension without significant proteinuria' },
  ],
  fetal_wellbeing: [
    { code: 'O36.8190', label: 'Maternal care for other specified fetal problems, unspecified trimester' },
    { code: 'Z34.9', label: 'Supervision of normal pregnancy, unspecified' },
  ],
  contractions: [
    { code: 'O47.9', label: 'False labor, unspecified' },
    { code: 'O60.0', label: 'Preterm labor without delivery' },
  ],
  contraception: [{ code: 'Z30.9', label: 'Contraceptive management, unspecified' }],
  fertility: [{ code: 'N97.9', label: 'Female infertility, unspecified' }],
  menstrual_concerns: [{ code: 'N92.6', label: 'Irregular menstruation, unspecified' }],
  cervical_screening: [{ code: 'Z12.4', label: 'Encounter for screening for malignant neoplasm of cervix' }],
  sti_risk: [
    {
      code: 'Z20.2',
      label: 'Contact with and (suspected) exposure to infections with a predominantly sexual mode of transmission',
    },
  ],
  other: [{ code: 'Z01.89', label: 'Encounter for other specified special examinations' }],
};

type OBGYNWorkspaceProps = {
  patientId?: string;
  encounterId?: string;
  clinicianId?: string;
};

type PatientContext = {
  pregnancyStatus?: 'unknown' | 'not_pregnant' | 'pregnant' | 'postpartum';
  edd?: string; // YYYY-MM-DD
  lmp?: string; // YYYY-MM-DD
  gestAgeWeeks?: number;
  trimester?: 1 | 2 | 3 | null;

  ladyCenter?: {
    cycleDay?: string;
    fertileWindow?: string;
    predictedOvulation?: string;
    possiblePregnancy?: 'unlikely' | 'maybe' | 'likely' | 'confirmed';
  };

  antenatal?: {
    nextVisit?: string;
    riskFlags?: string[];
    recentLogs?: { date: string; fetalMovements?: number; notes?: string }[];
  };

  insurance?: {
    schemeName?: string;
    planName?: string;
    membershipNumberMasked?: string;
    paymentMethod?: 'card' | 'medical_aid' | 'voucher' | string;
  };

  latestVitals?: {
    hr?: number;
    tempC?: number;
    spo2?: number;
    sys?: number;
    dia?: number;
    glucose_mg_dl?: number;
    ecg?: 'normal' | 'abnormal' | 'unknown';
    capturedAt?: string;
    device?: 'Health Monitor' | 'NexRing' | 'Digital Stethoscope' | 'Other';
  };
};

function nowISO() {
  return new Date().toISOString();
}

function tmpId(prefix: string) {
  return `tmp_${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function errMsg(e: unknown) {
  if (e && typeof e === 'object') {
    const anyObj = e as Record<string, unknown>;
    const m = anyObj.message;
    if (typeof m === 'string') return m;
    const details = anyObj.details;
    if (details && typeof details === 'object') {
      const dm = (details as Record<string, unknown>).message;
      if (typeof dm === 'string') return dm;
    }
  }
  return 'Request failed';
}

function clampNum(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function safeNum(v: string) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function fmtDate(iso?: string | null) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return iso;
  }
}

function addDaysISO(dateStr: string, days: number) {
  try {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + days);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  } catch {
    return '';
  }
}

function diffDaysFromToday(dateStr: string) {
  try {
    const d = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const t1 = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const diff = Math.round((t0 - t1) / (1000 * 60 * 60 * 24));
    return diff;
  } catch {
    return null;
  }
}

function gaWeeksFromLMP(lmp?: string) {
  if (!lmp) return null;
  const days = diffDaysFromToday(lmp);
  if (days == null) return null;
  const w = Math.floor(days / 7);
  return w >= 0 ? w : null;
}

function trimesterFromGA(gaWeeks?: number | null): 1 | 2 | 3 | null {
  if (gaWeeks == null) return null;
  if (gaWeeks <= 13) return 1;
  if (gaWeeks <= 27) return 2;
  return 3;
}

function eddFromLMP(lmp?: string) {
  if (!lmp) return null;
  // Naegele (approx): 280 days
  return addDaysISO(lmp, 280);
}

function riskScoreFromRedFlags(flags: Record<string, boolean>) {
  // heuristic UX score; not medical advice
  const weights: Record<string, number> = {
    severePain: 3,
    heavyBleeding: 4,
    fever: 3,
    fainting: 4,
    reducedMovements: 4,
    severeHeadache: 3,
    visualChanges: 2,
    swelling: 2,
    leakingFluid: 4,
    contractionsRegular: 4,
  };
  let score = 0;
  for (const k of Object.keys(flags)) {
    if (flags[k]) score += weights[k] ?? 1;
  }
  if (score >= 10) return { score, tier: 'high' as const, label: 'High' };
  if (score >= 5) return { score, tier: 'medium' as const, label: 'Medium' };
  return { score, tier: 'low' as const, label: 'Low' };
}

function tierTone(tier: 'low' | 'medium' | 'high') {
  if (tier === 'high') return 'rose';
  if (tier === 'medium') return 'amber';
  return 'emerald';
}

function tonePillClass(tone: 'rose' | 'amber' | 'emerald' | 'slate') {
  return tone === 'rose'
    ? 'border-rose-200 bg-rose-50 text-rose-900'
    : tone === 'amber'
    ? 'border-amber-200 bg-amber-50 text-amber-900'
    : tone === 'emerald'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
    : 'border-slate-200 bg-slate-50 text-slate-900';
}

function recommendedActionFromRisk(args: {
  riskTier: 'low' | 'medium' | 'high';
  pregnancyStatus: string;
  track: TrackKey;
  bpBadge?: { tone: 'rose' | 'amber' | 'emerald'; label: string; hint: string } | null;
}) {
  const { riskTier, pregnancyStatus, track, bpBadge } = args;
  if (riskTier === 'high') {
    return {
      label: 'Urgent escalation',
      detail: 'High-risk screen flags present. Use clinical judgement + local protocols.',
      tone: 'rose' as const,
    };
  }
  if (bpBadge?.tone === 'rose') {
    return {
      label: 'Priority review',
      detail: 'Blood pressure screen suggests elevated readings. Confirm + consider follow-up.',
      tone: 'amber' as const,
    };
  }
  if (riskTier === 'medium') {
    return {
      label: 'Same-day / short-interval follow-up',
      detail: 'Moderate-risk screen. Consider targeted assessment + follow-up planning.',
      tone: 'amber' as const,
    };
  }
  if (track === 'ob' && pregnancyStatus === 'pregnant') {
    return {
      label: 'Routine antenatal pathway',
      detail: 'Low-risk screen. Capture structured findings + schedule appropriate follow-up.',
      tone: 'emerald' as const,
    };
  }
  return {
    label: 'Routine workflow',
    detail: 'Low-risk screen. Proceed with standard assessment + documentation.',
    tone: 'emerald' as const,
  };
}

export default function OBGYNWorkspacePage(props: OBGYNWorkspaceProps) {
  const patientId = props.patientId ?? 'pat_demo_001';
  const encounterId = props.encounterId ?? 'enc_demo_001';
  const clinicianId = props.clinicianId ?? 'clin_demo_001';

  const [track, setTrack] = useState<TrackKey>('ob');
  const [visitMode, setVisitMode] = useState<VisitMode>('televisit');

  // Optimistic local state (until GET exists)
  const [findings, setFindings] = useState<Finding[]>([]);
  const [evidence, setEvidence] = useState<Evidence[]>([]);

  // UI state
  const [bookmarkOpen, setBookmarkOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ kind: 'info' | 'success' | 'error'; text: string } | null>(null);

  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | null>(null);
  const selectedEvidence = useMemo(
    () => evidence.find((e) => e.id === selectedEvidenceId) ?? null,
    [evidence, selectedEvidenceId]
  );

  // Patient context (future API; graceful fallback)
  const [ctxLoading, setCtxLoading] = useState(false);
  const [ctx, setCtx] = useState<PatientContext | null>(null);

  const reloadContext = useCallback(async () => {
    setCtxLoading(true);
    setCtx(null);
    try {
      const url = new URL('/api/workspaces/obgyn/context', window.location.origin);
      url.searchParams.set('patientId', patientId);
      url.searchParams.set('encounterId', encounterId);

      const r = await fetch(url.toString(), { cache: 'no-store' });
      if (!r.ok) throw new Error(`context ${r.status}`);
      const data = (await r.json()) as PatientContext;
      setCtx(data);
    } catch {
      setCtx(null);
    } finally {
      setCtxLoading(false);
    }
  }, [patientId, encounterId]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        if (cancelled) return;
        await reloadContext();
      } catch {
        // no-op
      }
    }

    if (typeof window !== 'undefined') load();
    return () => {
      cancelled = true;
    };
  }, [reloadContext]);

  // Quick intake + vitals (manual / screening)
  const [chiefConcern, setChiefConcern] = useState<string>('');
  const [gestAgeWeeks, setGestAgeWeeks] = useState<string>(''); // OB
  const [lmp, setLmp] = useState<string>(''); // both
  const [edd, setEdd] = useState<string>(''); // OB (optional)

  const [bpSys, setBpSys] = useState<string>(''); // both
  const [bpDia, setBpDia] = useState<string>(''); // both
  const [tempC, setTempC] = useState<string>(''); // both
  const [hr, setHr] = useState<string>(''); // both
  const [spo2, setSpo2] = useState<string>(''); // both
  const [glucose, setGlucose] = useState<string>(''); // OB/GDM context

  const [autoCalcOB, setAutoCalcOB] = useState(true);

  // OB/GYN history quick capture
  const [gynHistory, setGynHistory] = useState({
    gravida: '',
    para: '',
    miscarriages: '',
    lastPap: '',
    contraception: '',
    allergies: '',
    meds: '',
    chronic: '',
    notes: '',
  });

  // Track-specific quick capture (kept light; stored into Finding.meta.triage.extras)
  const [obQuick, setObQuick] = useState({
    fetalMovements: '', // e.g. "normal"
    contractions: '', // e.g. "none"
    swelling: '', // e.g. "none"
    headache: '', // e.g. "none"
    vision: '', // e.g. "ok"
  });

  const [gynQuick, setGynQuick] = useState({
    symptomOnset: '',
    bleedingPattern: '',
    dischargeNote: '',
    painNote: '',
  });

  const [pregnancyStatus, setPregnancyStatus] = useState<'unknown' | 'not_pregnant' | 'pregnant' | 'postpartum'>(
    'unknown'
  );

  // Red flags (screening UX)
  const [redFlags, setRedFlags] = useState({
    severePain: false,
    heavyBleeding: false,
    fever: false,
    fainting: false,
    reducedMovements: false, // OB
    severeHeadache: false, // OB/HTN
    visualChanges: false,
    swelling: false,
    leakingFluid: false,
    contractionsRegular: false,
  });

  const toggleRedFlag = (k: keyof typeof redFlags) => setRedFlags((s) => ({ ...s, [k]: !s[k] }));

  const risk = useMemo(() => riskScoreFromRedFlags(redFlags), [redFlags]);

  const bpBadge = useMemo(() => {
    const s = safeNum(bpSys);
    const d = safeNum(bpDia);
    if (s == null || d == null) return null;

    const sys = clampNum(s, 40, 260);
    const dia = clampNum(d, 20, 160);
    const elevated = sys >= 140 || dia >= 90;
    const mildly = (sys >= 130 && sys < 140) || (dia >= 80 && dia < 90);

    return {
      label: `${sys}/${dia}`,
      tone: elevated ? 'rose' : mildly ? 'amber' : 'emerald',
      hint: elevated ? 'High (screening)' : mildly ? 'Borderline' : 'OK',
    };
  }, [bpSys, bpDia]);

  // Derived OB indicators
  const derivedEdd = useMemo(() => (track === 'ob' ? edd || (autoCalcOB ? eddFromLMP(lmp) : null) : null), [track, edd, lmp, autoCalcOB]);
  const derivedGA = useMemo(() => {
    const manual = safeNum(gestAgeWeeks);
    if (track !== 'ob') return null;
    if (manual != null) return clampNum(manual, 0, 50);
    if (!autoCalcOB) return null;
    const w = gaWeeksFromLMP(lmp);
    return w == null ? null : clampNum(w, 0, 50);
  }, [track, gestAgeWeeks, lmp, autoCalcOB]);

  const derivedTrimester = useMemo(() => (track === 'ob' ? trimesterFromGA(derivedGA) : null), [track, derivedGA]);

  // Keep pregnancy status loosely synced from context if present
  useEffect(() => {
    if (!ctx) return;
    if (ctx.pregnancyStatus) setPregnancyStatus(ctx.pregnancyStatus);
    if (ctx.lmp && !lmp) setLmp(ctx.lmp);
    if (ctx.edd && !edd) setEdd(ctx.edd);
    if (typeof ctx.gestAgeWeeks === 'number' && !gestAgeWeeks) setGestAgeWeeks(String(ctx.gestAgeWeeks));

    if (ctx.latestVitals) {
      if (ctx.latestVitals.sys != null && !bpSys) setBpSys(String(ctx.latestVitals.sys));
      if (ctx.latestVitals.dia != null && !bpDia) setBpDia(String(ctx.latestVitals.dia));
      if (ctx.latestVitals.tempC != null && !tempC) setTempC(String(ctx.latestVitals.tempC));
      if (ctx.latestVitals.hr != null && !hr) setHr(String(ctx.latestVitals.hr));
      if (ctx.latestVitals.spo2 != null && !spo2) setSpo2(String(ctx.latestVitals.spo2));
      if (ctx.latestVitals.glucose_mg_dl != null && !glucose) setGlucose(String(ctx.latestVitals.glucose_mg_dl));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx]);

  // If auto-calc is ON and we have LMP, softly fill EDD if empty (OB only).
  useEffect(() => {
    if (track !== 'ob') return;
    if (!autoCalcOB) return;
    if (edd) return;
    const calc = eddFromLMP(lmp);
    if (calc) setEdd(calc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track, autoCalcOB, lmp]);

  // Location helper (stored as JSON on server; TS typing depends on your shared union)
  const locationForTrack = (t: TrackKey): Location => {
    const loc = {
      kind: 'obgyn' as const,
      track: t,
      area: 'pelvis' as const,
      visitMode,
    };
    return loc as unknown as Location;
  };

  const findingsForTrack = useMemo(() => {
    return findings
      .filter((f) => {
        const loc = f.location as unknown as Record<string, unknown> | null;
        const kind = loc?.kind;
        const tr = loc?.track;
        if (typeof kind === 'string' && kind === 'obgyn' && (tr === 'ob' || tr === 'gyn')) return tr === track;
        return true;
      })
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }, [findings, track]);

  const evidenceForTrack = useMemo(() => {
    return evidence
      .filter((ev) => {
        const loc = ev.location as unknown as Record<string, unknown> | null;
        const kind = loc?.kind;
        const tr = loc?.track;
        if (typeof kind === 'string' && kind === 'obgyn' && (tr === 'ob' || tr === 'gyn')) return tr === track;
        return true;
      })
      .sort((a, b) => (a.capturedAt < b.capturedAt ? 1 : -1));
  }, [evidence, track]);

  const trackCounts = useMemo(() => {
    const c = { ob: 0, gyn: 0 } as Record<TrackKey, number>;
    for (const f of findings) {
      const loc = f.location as unknown as Record<string, unknown> | null;
      if (loc?.kind === 'obgyn' && (loc?.track === 'ob' || loc?.track === 'gyn')) c[loc.track] += 1;
    }
    return c;
  }, [findings]);

  const evidenceCountForFinding = (findingId: string) => evidence.filter((e) => e.findingId === findingId).length;

  // Search + filter (worldclass “find what you need”)
  const [q, setQ] = useState('');
  const filteredFindings = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return findingsForTrack;
    return findingsForTrack.filter((f) => {
      const s = `${f.title ?? ''} ${f.note ?? ''} ${String(f.severity ?? '')}`.toLowerCase();
      return s.includes(query);
    });
  }, [q, findingsForTrack]);

  const triageMeta = useMemo(() => {
    const meta = {
      visitMode,
      pregnancyStatus,
      chiefConcern: chiefConcern?.trim() ? chiefConcern.trim() : undefined,
      lmp: lmp || undefined,
      edd: (track === 'ob' ? (derivedEdd || edd || undefined) : undefined) ?? undefined,
      gestAgeWeeks: track === 'ob' ? (derivedGA ?? safeNum(gestAgeWeeks) ?? undefined) : undefined,
      trimester: track === 'ob' ? (derivedTrimester ?? undefined) : undefined,
      vitals: {
        sys: safeNum(bpSys) ?? undefined,
        dia: safeNum(bpDia) ?? undefined,
        tempC: safeNum(tempC) ?? undefined,
        hr: safeNum(hr) ?? undefined,
        spo2: safeNum(spo2) ?? undefined,
        glucose_mg_dl: safeNum(glucose) ?? undefined,
      },
      redFlags,
      riskScore: risk.score,
      riskTier: risk.tier,
      history: gynHistory,
      extras: track === 'ob' ? { ob: obQuick } : { gyn: gynQuick },
      ctxHint: ctx ? { hasAntenatal: !!ctx.antenatal, hasLadyCenter: !!ctx.ladyCenter } : undefined,
    };
    return meta;
  }, [
    visitMode,
    pregnancyStatus,
    chiefConcern,
    lmp,
    edd,
    derivedEdd,
    derivedGA,
    derivedTrimester,
    gestAgeWeeks,
    bpSys,
    bpDia,
    tempC,
    hr,
    spo2,
    glucose,
    redFlags,
    risk,
    gynHistory,
    track,
    obQuick,
    gynQuick,
    ctx,
  ]);

  const actionHint = useMemo(
    () =>
      recommendedActionFromRisk({
        riskTier: risk.tier,
        pregnancyStatus,
        track,
        bpBadge,
      }),
    [risk.tier, pregnancyStatus, track, bpBadge]
  );

  const createManualFinding = async (
    type: FindingTypeKey,
    severity?: Finding['severity'],
    note?: string,
    icd10?: { code: string; label: string } | null
  ) => {
    const title = FINDING_TYPES.find((x) => x.key === type)?.label ?? 'Finding';
    const location = locationForTrack(track);

    const optimisticId = tmpId('fd');
    const optimistic: Finding = {
      id: optimisticId,
      patientId,
      encounterId,
      specialty: 'obgyn',
      status: 'draft',
      title,
      note: note?.trim() ? note.trim() : undefined,
      severity,
      tags: ['obgyn', track],
      location,
      createdAt: nowISO(),
      updatedAt: nowISO(),
      createdBy: clinicianId,
      meta: {
        kind: 'obgyn_finding',
        findingType: type,
        icd10: icd10 ?? undefined,
        triage: triageMeta,
      } as any,
    };

    setBanner(null);
    setFindings((prev) => [optimistic, ...prev]);

    try {
      const created = await postFinding({
        patientId,
        encounterId,
        specialty: 'obgyn',
        title,
        status: 'draft',
        severity,
        note: note?.trim() ? note.trim() : undefined,
        tags: ['obgyn', track],
        location,
        createdBy: clinicianId,
        meta: {
          kind: 'obgyn_finding',
          findingType: type,
          icd10: icd10 ?? undefined,
          triage: triageMeta,
        },
      } as any);

      setFindings((prev) => prev.map((f) => (f.id === optimisticId ? created : f)));
      setBanner({ kind: 'success', text: 'Finding saved.' });
    } catch (e) {
      setFindings((prev) => prev.filter((f) => f.id !== optimisticId));
      setBanner({ kind: 'error', text: `Failed to save finding: ${errMsg(e)}` });
      throw e;
    }
  };

  const handleBookmark = async (payload: {
    findingTypeKey: string;
    severity?: Finding['severity'];
    note?: string;
    icd10Code?: string;
    icd10Label?: string;
  }) => {
    const type = payload.findingTypeKey as FindingTypeKey;
    const title = FINDING_TYPES.find((x) => x.key === type)?.label ?? 'Finding';
    const location = locationForTrack(track);

    const icd10 =
      payload.icd10Code && payload.icd10Label
        ? { code: payload.icd10Code, label: payload.icd10Label }
        : null;

    setBanner(null);
    setBusy(true);

    try {
      // 1) Create finding
      const createdFinding = await postFinding({
        patientId,
        encounterId,
        specialty: 'obgyn',
        title,
        status: 'draft',
        severity: payload.severity,
        note: payload.note,
        tags: ['obgyn', track, 'bookmark'],
        location,
        createdBy: clinicianId,
        meta: {
          kind: 'obgyn_finding',
          findingType: type,
          icd10: icd10 ?? undefined,
          triage: triageMeta,
        },
      } as any);
      setFindings((prev) => [createdFinding, ...prev]);

      // 2) Snapshot evidence (ready)
      const snapshot = await postEvidence({
        patientId,
        encounterId,
        specialty: 'obgyn',
        findingId: createdFinding.id,
        location,
        source: {
          type: 'live_capture',
          device: 'camera',
          roomId: undefined,
          trackId: undefined,
        },
        media: {
          kind: 'image',
          url: `https://placehold.co/1200x800?text=OBGYN+Snapshot+(${track.toUpperCase()})`,
          thumbnailUrl: `https://placehold.co/320x200?text=Snapshot+(${track.toUpperCase()})`,
          contentType: 'image/jpeg',
        },
        status: 'ready',
      });

      // 3) Clip evidence (processing)
      const t = Date.now();
      const clip = await postEvidence({
        patientId,
        encounterId,
        specialty: 'obgyn',
        findingId: createdFinding.id,
        location,
        source: {
          type: 'live_capture',
          device: 'camera',
          roomId: undefined,
          trackId: undefined,
          startTs: t - 4000,
          endTs: t + 7000,
        },
        media: {
          kind: 'video_clip',
          url: 'https://example.invalid/clip.mp4',
          thumbnailUrl: `https://placehold.co/320x200?text=Clip+(${track.toUpperCase()})`,
          contentType: 'video/mp4',
          startTs: t - 4000,
          endTs: t + 7000,
        },
        status: 'processing',
      });

      setEvidence((prev) => [snapshot, clip, ...prev]);
      setSelectedEvidenceId(snapshot.id);
      setBanner({ kind: 'success', text: 'Bookmark saved (finding + evidence created).' });
    } catch (e) {
      setBanner({ kind: 'error', text: `Failed to save bookmark: ${errMsg(e)}` });
      throw e;
    } finally {
      setBusy(false);
    }
  };

  const addDemoPinAnnotation = async () => {
    if (!selectedEvidence) {
      setBanner({ kind: 'info', text: 'Select an evidence item first.' });
      return;
    }

    setBanner(null);
    setBusy(true);
    try {
      await postAnnotation({
        patientId,
        encounterId,
        specialty: 'obgyn',
        evidenceId: selectedEvidence.id,
        findingId: selectedEvidence.findingId ?? null,
        location: selectedEvidence.location,
        type: 'pin',
        payload: {
          x: 0.54,
          y: 0.42,
          label: 'Note / area of concern',
        },
        createdBy: clinicianId,
      });

      setBanner({ kind: 'success', text: 'Annotation created (demo pin).' });
    } catch (e) {
      setBanner({ kind: 'error', text: `Failed to create annotation: ${errMsg(e)}` });
    } finally {
      setBusy(false);
    }
  };

  const summaryText = useMemo(() => {
    const lines: string[] = [];
    lines.push(`OB/GYN Session Summary`);
    lines.push(`Patient: ${patientId}`);
    lines.push(`Encounter: ${encounterId}`);
    lines.push(`Visit mode: ${VISIT_MODES.find((m) => m.key === visitMode)?.label ?? visitMode}`);
    lines.push(`Track: ${track.toUpperCase()}`);
    lines.push('');

    lines.push(`Intake`);
    lines.push(`- Chief concern: ${chiefConcern?.trim() ? chiefConcern.trim() : '—'}`);
    lines.push(`- Screening action hint: ${actionHint.label} (${risk.label}, score ${risk.score})`);
    lines.push('');

    lines.push(`Triage`);
    lines.push(`- Pregnancy status: ${pregnancyStatus}`);
    if (lmp) lines.push(`- LMP: ${lmp}`);
    if (track === 'ob') {
      const eddOut = derivedEdd || edd;
      if (eddOut) lines.push(`- EDD: ${eddOut}`);
      if (derivedGA != null) lines.push(`- GA (weeks): ${derivedGA}`);
      if (derivedTrimester) lines.push(`- Trimester: T${derivedTrimester}`);
    }
    if (bpBadge) lines.push(`- BP: ${bpBadge.label} (${bpBadge.hint})`);
    if (tempC) lines.push(`- Temp: ${tempC} °C`);
    if (hr) lines.push(`- HR: ${hr} bpm`);
    if (spo2) lines.push(`- SpO₂: ${spo2} %`);
    if (glucose) lines.push(`- Glucose: ${glucose} mg/dL`);

    const rf = Object.entries(redFlags)
      .filter(([, v]) => v)
      .map(([k]) => k);
    if (rf.length) lines.push(`- Red flags: ${rf.join(', ')}`);
    else lines.push(`- Red flags: none selected`);

    if (track === 'ob') {
      lines.push(`- OB quick: fetalMovements=${obQuick.fetalMovements || '—'}, contractions=${obQuick.contractions || '—'}`);
    } else {
      lines.push(`- GYN quick: onset=${gynQuick.symptomOnset || '—'}, bleeding=${gynQuick.bleedingPattern || '—'}`);
    }

    lines.push('');
    lines.push(`History (quick)`);
    const gh = gynHistory;
    if (gh.gravida || gh.para) lines.push(`- G/P: ${gh.gravida || '—'}/${gh.para || '—'}`);
    if (gh.miscarriages) lines.push(`- Losses: ${gh.miscarriages}`);
    if (gh.lastPap) lines.push(`- Last screening: ${gh.lastPap}`);
    if (gh.contraception) lines.push(`- Contraception: ${gh.contraception}`);
    if (gh.allergies) lines.push(`- Allergies: ${gh.allergies}`);
    if (gh.meds) lines.push(`- Meds: ${gh.meds}`);
    if (gh.chronic) lines.push(`- Chronic: ${gh.chronic}`);
    if (gh.notes) lines.push(`- Notes: ${gh.notes}`);

    if (ctx?.insurance) {
      lines.push('');
      lines.push(`Insurance / Payment`);
      if (ctx.insurance.schemeName) {
        lines.push(
          `- Scheme: ${ctx.insurance.schemeName}${ctx.insurance.planName ? ` (${ctx.insurance.planName})` : ''}`
        );
      }
      if (ctx.insurance.membershipNumberMasked) lines.push(`- Member #: ${ctx.insurance.membershipNumberMasked}`);
      if (ctx.insurance.paymentMethod) lines.push(`- Method: ${ctx.insurance.paymentMethod}`);
    }

    lines.push('');
    lines.push(`Findings`);
    if (!findingsForTrack.length) {
      lines.push(`- none captured`);
    } else {
      for (const f of findingsForTrack.slice(0, 10)) {
        const icd = (f.meta as any)?.icd10?.code
          ? `${(f.meta as any).icd10.code} ${(f.meta as any).icd10.label ?? ''}`
          : '';
        lines.push(`- ${f.title}${f.severity ? ` (${f.severity})` : ''}${icd ? ` | ICD-10: ${icd}` : ''}`);
        if (f.note) lines.push(`  Note: ${f.note}`);
        const evCount = evidenceCountForFinding(f.id);
        if (evCount) lines.push(`  Evidence attached: ${evCount}`);
      }
      if (findingsForTrack.length > 10) lines.push(`- …and ${findingsForTrack.length - 10} more`);
    }

    lines.push('');
    lines.push(`Disclaimer: Screening summary only. Final clinical judgement required.`);
    return lines.join('\n');
  }, [
    patientId,
    encounterId,
    visitMode,
    track,
    chiefConcern,
    pregnancyStatus,
    lmp,
    edd,
    derivedEdd,
    derivedGA,
    derivedTrimester,
    bpBadge,
    tempC,
    hr,
    spo2,
    glucose,
    risk,
    actionHint.label,
    redFlags,
    obQuick,
    gynQuick,
    gynHistory,
    ctx,
    findingsForTrack,
    evidenceCountForFinding,
  ]);

  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(summaryText);
      setBanner({ kind: 'success', text: 'Session summary copied.' });
    } catch {
      setBanner({ kind: 'error', text: 'Could not copy. Your browser blocked clipboard access.' });
    }
  };

  const riskTone = tierTone(risk.tier);
  const riskPillClass = tonePillClass(riskTone);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* TOP BAR */}
      <header className="sticky top-0 z-10 border-b bg-white/90 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-3 flex flex-col gap-2">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-xs text-gray-500 flex items-center gap-2">
                <Link href="/workspaces" className="hover:underline">
                  Workspaces
                </Link>
                <Dot className="w-4 h-4 text-gray-300" />
                <span className="text-gray-600">OB/GYN</span>
              </div>

              <h1 className="mt-1 text-lg font-semibold flex items-center gap-2">
                <Baby className="w-5 h-5 text-pink-600" />
                OB/GYN Workspace
                <span className="ml-1 text-xs font-medium px-2 py-0.5 rounded-full border bg-gray-50 text-gray-700">
                  World-class
                </span>
              </h1>

              <div className="mt-1 text-xs text-gray-500">
                Structured intake · Triage meta → findings · Evidence + annotations · ICD-10 hints · Copy-ready summary
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full border bg-white px-2 py-1 text-gray-700">
                Patient: <span className="font-mono">{patientId}</span>
              </span>
              <span className="rounded-full border bg-white px-2 py-1 text-gray-700">
                Encounter: <span className="font-mono">{encounterId}</span>
              </span>

              <span
                className={`rounded-full border px-2 py-1 ${riskPillClass}`}
                title="Heuristic UI score; not a diagnosis"
              >
                Risk: <span className="font-semibold">{risk.label}</span> · {risk.score}
              </span>

              {bpBadge ? (
                <span className={`rounded-full border px-2 py-1 ${tonePillClass(bpBadge.tone)}`} title="Screening hint only">
                  BP: <span className="font-mono font-semibold">{bpBadge.label}</span> · {bpBadge.hint}
                </span>
              ) : (
                <span className="rounded-full border bg-gray-50 px-2 py-1 text-gray-600">BP: —</span>
              )}

              <button
                className="rounded-full border bg-white hover:bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-800 inline-flex items-center gap-2"
                onClick={() => reloadContext()}
                type="button"
                disabled={ctxLoading}
                title="Reload patient context"
              >
                <RefreshCw className={'w-4 h-4 ' + (ctxLoading ? 'animate-spin' : '')} />
                Refresh context
              </button>

              <button
                className="rounded-full border bg-blue-50 hover:bg-blue-100 px-3 py-1.5 text-xs font-medium text-blue-800 disabled:opacity-50 inline-flex items-center gap-2"
                onClick={() => setBookmarkOpen(true)}
                disabled={busy}
                type="button"
              >
                <Plus className="w-4 h-4" />
                Bookmark
              </button>
            </div>
          </div>

          {/* MINI STATUS STRIP */}
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone="slate" label={VISIT_MODES.find((m) => m.key === visitMode)?.label ?? visitMode} />
            <Pill tone="slate" label={track === 'ob' ? 'OB track' : 'GYN track'} />
            <Pill
              tone={pregnancyStatus === 'pregnant' ? 'emerald' : pregnancyStatus === 'postpartum' ? 'amber' : 'slate'}
              label={
                pregnancyStatus === 'pregnant'
                  ? 'Pregnant'
                  : pregnancyStatus === 'postpartum'
                  ? 'Postpartum'
                  : pregnancyStatus === 'not_pregnant'
                  ? 'Not pregnant'
                  : 'Pregnancy unknown'
              }
            />
            {track === 'ob' ? (
              <>
                <Pill tone="slate" label={`GA: ${derivedGA != null ? `${derivedGA}w` : '—'}`} />
                <Pill tone="slate" label={`EDD: ${derivedEdd || edd || '—'}`} />
                <Pill tone="slate" label={`T: ${derivedTrimester ? `T${derivedTrimester}` : '—'}`} />
              </>
            ) : null}
            <span className="text-[11px] text-gray-500 ml-auto">
              Context: {ctxLoading ? 'Loading…' : ctx ? 'Connected' : 'Fallback'}
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-4">
        {banner ? (
          <div
            className={
              'mb-4 rounded-lg border px-3 py-2 text-sm ' +
              (banner.kind === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : banner.kind === 'error'
                ? 'border-rose-200 bg-rose-50 text-rose-900'
                : 'border-gray-200 bg-white text-gray-800')
            }
          >
            {banner.text}
          </div>
        ) : null}

        <div className="grid grid-cols-1 lg:grid-cols-[420px_minmax(0,1fr)_440px] gap-4">
          {/* LEFT */}
          <section className="rounded-xl border bg-white shadow-sm overflow-hidden">
            <SectionHeader
              icon={<Shield className="w-4 h-4 text-gray-700" />}
              title="Patient context & intake"
              subtitle="Everything here feeds triageMeta → stored into Finding.meta for continuity."
            />

            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-gray-600">
                  Visit mode
                  <select
                    className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
                    value={visitMode}
                    onChange={(e) => setVisitMode(e.target.value as VisitMode)}
                    disabled={busy}
                  >
                    {VISIT_MODES.map((m) => (
                      <option key={m.key} value={m.key}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-xs text-gray-600">
                  Pregnancy status
                  <select
                    className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
                    value={pregnancyStatus}
                    onChange={(e) => setPregnancyStatus(e.target.value as any)}
                    disabled={busy}
                  >
                    <option value="unknown">Unknown</option>
                    <option value="not_pregnant">Not pregnant</option>
                    <option value="pregnant">Pregnant</option>
                    <option value="postpartum">Postpartum</option>
                  </select>
                </label>
              </div>

              <TogglePills<TrackKey>
                value={track}
                onChange={(v) => {
                  setTrack(v);
                  setSelectedEvidenceId(null);
                  setQ('');
                }}
                items={TRACKS.map((t) => ({ key: t.key, label: t.label }))}
                counts={trackCounts}
              />

              {/* Chief concern */}
              <div className="rounded-lg border bg-white p-3">
                <div className="text-xs font-semibold text-gray-700 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Intake (fast)
                </div>
                <label className="block mt-2 text-xs text-gray-600">
                  Chief concern (one-liner)
                  <input
                    className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
                    value={chiefConcern}
                    onChange={(e) => setChiefConcern(e.target.value)}
                    placeholder={track === 'ob' ? 'e.g., Routine antenatal visit' : 'e.g., Bleeding / pain'}
                    disabled={busy}
                  />
                </label>

                <div className="mt-2 grid grid-cols-2 gap-2">
                  <MiniKpi label="Action hint" value={actionHint.label} />
                  <MiniKpi label="Risk tier" value={`${risk.label} (${risk.score})`} />
                </div>

                <Callout tone={actionHint.tone} title={actionHint.label}>
                  {actionHint.detail}
                </Callout>
              </div>

              {/* Patient context panel */}
              <div className="rounded-lg border bg-gray-50 p-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-gray-700 flex items-center gap-2">
                    <Info className="w-4 h-4" />
                    Patient context (feeds)
                  </div>
                  <span className="text-[11px] text-gray-500">{ctxLoading ? 'Loading…' : ctx ? 'Connected' : 'Fallback'}</span>
                </div>

                {ctx ? (
                  <div className="mt-2 space-y-2 text-sm text-gray-800">
                    <div className="grid grid-cols-2 gap-2">
                      <MiniKpi label="EDD" value={ctx.edd ?? derivedEdd ?? '—'} />
                      <MiniKpi label="LMP" value={ctx.lmp ?? lmp ?? '—'} />
                      <MiniKpi label="GA" value={ctx.gestAgeWeeks != null ? `${ctx.gestAgeWeeks}w` : derivedGA != null ? `${derivedGA}w` : '—'} />
                      <MiniKpi label="Trimester" value={ctx.trimester ? `T${ctx.trimester}` : derivedTrimester ? `T${derivedTrimester}` : '—'} />
                    </div>

                    <div className="rounded-md border bg-white p-2">
                      <div className="text-xs font-semibold text-gray-700">Lady Center</div>
                      <div className="text-xs text-gray-600 mt-1">
                        {ctx.ladyCenter ? (
                          <>
                            Cycle day: <b>{ctx.ladyCenter.cycleDay ?? '—'}</b> · Fertile: <b>{ctx.ladyCenter.fertileWindow ?? '—'}</b> · Ovulation:{' '}
                            <b>{ctx.ladyCenter.predictedOvulation ?? '—'}</b> · Pregnancy: <b>{ctx.ladyCenter.possiblePregnancy ?? '—'}</b>
                          </>
                        ) : (
                          <>Not available yet (wire patient → apigw sync).</>
                        )}
                      </div>
                    </div>

                    <div className="rounded-md border bg-white p-2">
                      <div className="text-xs font-semibold text-gray-700">Antenatal Center</div>
                      <div className="text-xs text-gray-600 mt-1">
                        {ctx.antenatal ? (
                          <>
                            Next visit: <b>{ctx.antenatal.nextVisit ?? '—'}</b>
                            {ctx.antenatal.riskFlags?.length ? (
                              <>
                                {' '}
                                · Flags: <b>{ctx.antenatal.riskFlags.join(', ')}</b>
                              </>
                            ) : null}
                          </>
                        ) : (
                          <>Not available yet (wire patient → apigw sync).</>
                        )}
                      </div>
                    </div>

                    {ctx.latestVitals ? (
                      <div className="rounded-md border bg-white p-2">
                        <div className="text-xs font-semibold text-gray-700">Latest vitals (IoMT)</div>
                        <div className="text-xs text-gray-600 mt-1">
                          {ctx.latestVitals.device ? <b>{ctx.latestVitals.device}</b> : 'Device'} · {ctx.latestVitals.capturedAt ? fmtDate(ctx.latestVitals.capturedAt) : '—'} · HR{' '}
                          <b>{ctx.latestVitals.hr ?? '—'}</b> · SpO₂ <b>{ctx.latestVitals.spo2 ?? '—'}</b> · BP <b>{ctx.latestVitals.sys ?? '—'}</b>/<b>{ctx.latestVitals.dia ?? '—'}</b> · Temp{' '}
                          <b>{ctx.latestVitals.tempC ?? '—'}</b>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="mt-2 text-xs text-gray-600">
                    APIs not wired yet. Ready to consume:
                    <div className="mt-1 font-mono text-[11px] text-gray-600">
                      GET /api/workspaces/obgyn/context?patientId=...&encounterId=...
                    </div>
                  </div>
                )}
              </div>

              {/* Vitals */}
              <div className="rounded-lg border bg-gray-50 p-3">
                <div className="text-xs font-semibold text-gray-700 flex items-center gap-2">
                  <HeartPulse className="w-4 h-4" />
                  Vitals (quick)
                </div>

                <div className="mt-2 grid grid-cols-2 gap-2">
                  <label className="text-xs text-gray-600">
                    BP SYS
                    <input className="mt-1 w-full rounded border px-2 py-1.5 text-sm" inputMode="numeric" value={bpSys} onChange={(e) => setBpSys(e.target.value)} placeholder="e.g., 120" />
                  </label>
                  <label className="text-xs text-gray-600">
                    BP DIA
                    <input className="mt-1 w-full rounded border px-2 py-1.5 text-sm" inputMode="numeric" value={bpDia} onChange={(e) => setBpDia(e.target.value)} placeholder="e.g., 80" />
                  </label>

                  <label className="text-xs text-gray-600">
                    Temp (°C)
                    <input className="mt-1 w-full rounded border px-2 py-1.5 text-sm" inputMode="decimal" value={tempC} onChange={(e) => setTempC(e.target.value)} placeholder="e.g., 36.8" />
                  </label>
                  <label className="text-xs text-gray-600">
                    HR (bpm)
                    <input className="mt-1 w-full rounded border px-2 py-1.5 text-sm" inputMode="numeric" value={hr} onChange={(e) => setHr(e.target.value)} placeholder="e.g., 78" />
                  </label>

                  <label className="text-xs text-gray-600">
                    SpO₂ (%)
                    <input className="mt-1 w-full rounded border px-2 py-1.5 text-sm" inputMode="numeric" value={spo2} onChange={(e) => setSpo2(e.target.value)} placeholder="e.g., 98" />
                  </label>
                  <label className="text-xs text-gray-600">
                    Glucose (mg/dL)
                    <input className="mt-1 w-full rounded border px-2 py-1.5 text-sm" inputMode="numeric" value={glucose} onChange={(e) => setGlucose(e.target.value)} placeholder="e.g., 95" />
                  </label>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-2">
                  <label className="text-xs text-gray-600">
                    LMP (optional)
                    <input className="mt-1 w-full rounded border px-2 py-1.5 text-sm" type="date" value={lmp} onChange={(e) => setLmp(e.target.value)} />
                  </label>

                  {track === 'ob' ? (
                    <>
                      <div className="flex items-center justify-between">
                        <label className="text-xs text-gray-600 inline-flex items-center gap-2">
                          <input type="checkbox" checked={autoCalcOB} onChange={() => setAutoCalcOB((s) => !s)} />
                          Auto-calc GA/EDD (from LMP)
                        </label>
                        <span className="text-[11px] text-gray-500">
                          GA: <b>{derivedGA != null ? `${derivedGA}w` : '—'}</b> · EDD: <b>{derivedEdd || edd || '—'}</b>
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <label className="text-xs text-gray-600">
                          GA (weeks)
                          <input
                            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
                            inputMode="numeric"
                            value={gestAgeWeeks}
                            onChange={(e) => setGestAgeWeeks(e.target.value)}
                            placeholder="e.g., 24"
                            disabled={autoCalcOB}
                            title={autoCalcOB ? 'Disable auto-calc to type GA manually' : undefined}
                          />
                        </label>
                        <label className="text-xs text-gray-600">
                          EDD
                          <input
                            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
                            type="date"
                            value={edd}
                            onChange={(e) => setEdd(e.target.value)}
                            placeholder="YYYY-MM-DD"
                          />
                        </label>
                      </div>
                    </>
                  ) : null}
                </div>

                <div className="mt-3 flex items-start gap-2 text-[11px] text-gray-600">
                  <Info className="w-4 h-4 mt-0.5" />
                  <div>When GET endpoints go live, this becomes server-truth and can auto-pull latest vitals from Health Monitor / NexRing.</div>
                </div>
              </div>

              {/* Track-specific quick capture */}
              {track === 'ob' ? (
                <div className="rounded-lg border p-3">
                  <div className="text-xs font-semibold text-gray-700">OB quick capture</div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <Field label="Fetal movements" value={obQuick.fetalMovements} onChange={(v) => setObQuick((s) => ({ ...s, fetalMovements: v }))} disabled={busy} placeholder="e.g., normal" />
                    <Field label="Contractions" value={obQuick.contractions} onChange={(v) => setObQuick((s) => ({ ...s, contractions: v }))} disabled={busy} placeholder="e.g., none" />
                    <Field label="Swelling" value={obQuick.swelling} onChange={(v) => setObQuick((s) => ({ ...s, swelling: v }))} disabled={busy} placeholder="e.g., none" />
                    <Field label="Headache" value={obQuick.headache} onChange={(v) => setObQuick((s) => ({ ...s, headache: v }))} disabled={busy} placeholder="e.g., none" />
                    <div className="col-span-2">
                      <Field label="Vision" value={obQuick.vision} onChange={(v) => setObQuick((s) => ({ ...s, vision: v }))} disabled={busy} placeholder="e.g., ok" />
                    </div>
                  </div>
                  <div className="mt-2 text-[11px] text-gray-500">Stored into triageMeta.extras.ob</div>
                </div>
              ) : (
                <div className="rounded-lg border p-3">
                  <div className="text-xs font-semibold text-gray-700">GYN quick capture</div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <Field label="Symptom onset" value={gynQuick.symptomOnset} onChange={(v) => setGynQuick((s) => ({ ...s, symptomOnset: v }))} disabled={busy} placeholder="e.g., 3 days" />
                    <Field label="Bleeding pattern" value={gynQuick.bleedingPattern} onChange={(v) => setGynQuick((s) => ({ ...s, bleedingPattern: v }))} disabled={busy} placeholder="e.g., light/spotting" />
                    <div className="col-span-2">
                      <Field label="Discharge note" value={gynQuick.dischargeNote} onChange={(v) => setGynQuick((s) => ({ ...s, dischargeNote: v }))} disabled={busy} placeholder="free note" />
                    </div>
                    <div className="col-span-2">
                      <Field label="Pain note" value={gynQuick.painNote} onChange={(v) => setGynQuick((s) => ({ ...s, painNote: v }))} disabled={busy} placeholder="free note" />
                    </div>
                  </div>
                  <div className="mt-2 text-[11px] text-gray-500">Stored into triageMeta.extras.gyn</div>
                </div>
              )}

              {/* Red flags */}
              <div className="rounded-lg border p-3">
                <div className="text-xs font-semibold text-gray-700 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  Red flags (screen)
                </div>

                <div className="mt-2 grid grid-cols-2 gap-2">
                  {(
                    [
                      ['severePain', 'Severe pain'],
                      ['heavyBleeding', 'Heavy bleeding'],
                      ['fever', 'Fever'],
                      ['fainting', 'Fainting'],
                      ['severeHeadache', 'Severe headache'],
                      ['visualChanges', 'Visual changes'],
                      ['swelling', 'Swelling'],
                      ['leakingFluid', 'Leaking fluid'],
                      ...(track === 'ob'
                        ? ([['reducedMovements', 'Reduced movements'], ['contractionsRegular', 'Regular contractions']] as const)
                        : []),
                    ] as const
                  ).map(([k, label]) => (
                    <label key={k} className="flex items-center gap-2 text-sm text-gray-700">
                      <input type="checkbox" checked={redFlags[k]} onChange={() => toggleRedFlag(k)} />
                      {label}
                    </label>
                  ))}
                </div>

                <div className="mt-2 text-[11px] text-gray-500">
                  UX screening only — escalation pathways can be wired to referrals/orders when those endpoints exist.
                </div>
              </div>

              {/* Findings list (compact) */}
              <div className="rounded-lg border bg-white p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-semibold text-gray-700">Findings ({track.toUpperCase()})</div>
                  <div className="relative">
                    <Search className="w-4 h-4 text-gray-400 absolute left-2 top-1/2 -translate-y-1/2" />
                    <input
                      className="pl-8 pr-2 py-1.5 text-xs rounded border bg-white w-44"
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="Search findings…"
                    />
                  </div>
                </div>

                <div className="mt-2">
                  {filteredFindings.length === 0 ? (
                    <div className="text-sm text-gray-600 italic">No findings match your filter.</div>
                  ) : (
                    <ul className="space-y-2">
                      {filteredFindings.slice(0, 6).map((f) => (
                        <li key={f.id}>
                          <FindingCard finding={f} evidenceCount={evidenceCountForFinding(f.id)} onToggleFinal={undefined} />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {filteredFindings.length > 6 ? (
                  <div className="mt-2 text-[11px] text-gray-500">Showing latest 6. Full list view can be a dedicated /workspaces/obgyn/findings page.</div>
                ) : null}
              </div>
            </div>
          </section>

          {/* CENTER */}
          <section className="rounded-xl border bg-white shadow-sm overflow-hidden">
            <SectionHeader
              icon={<Stethoscope className="w-4 h-4 text-gray-700" />}
              title="Evidence & annotations"
              subtitle="Select evidence to preview · Add pin annotations · Bookmark creates finding + snapshot + clip"
              right={
                <div className="flex items-center gap-2">
                  <button
                    className="rounded-full border bg-white hover:bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-800 disabled:opacity-50 inline-flex items-center gap-2"
                    onClick={addDemoPinAnnotation}
                    disabled={busy}
                    title="Creates a demo pin annotation for the selected evidence"
                    type="button"
                  >
                    <Plus className="w-4 h-4" />
                    Add pin
                  </button>
                </div>
              }
            />

            <div className="p-4 space-y-3">
              <div className="rounded-lg border bg-gray-100 h-80 overflow-hidden">
                {selectedEvidence ? (
                  selectedEvidence.kind === 'image' ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={selectedEvidence.url} alt="Selected evidence" className="h-full w-full object-contain" />
                  ) : (
                    <div className="h-full w-full grid place-items-center text-gray-700">
                      <div className="text-center px-6">
                        <div className="text-sm font-medium">Clip selected</div>
                        <div className="text-xs text-gray-500 mt-1">
                          Status: {selectedEvidence.status}
                          {selectedEvidence.jobId ? ` · job: ${selectedEvidence.jobId}` : ''}
                        </div>
                        <div className="mt-2 text-xs text-gray-500">
                          Playback becomes available when the evidence service returns real clip URLs/jobIds from SFU capture.
                        </div>
                      </div>
                    </div>
                  )
                ) : (
                  <div className="h-full grid place-items-center text-gray-600">
                    <div className="text-center px-6">
                      <div className="text-sm font-medium">Live View (placeholder)</div>
                      <div className="text-xs text-gray-500 mt-1">Select evidence below to preview</div>
                      <div className="mt-3 inline-flex items-center gap-2 text-[11px] text-gray-500">
                        <Wand2 className="w-4 h-4" />
                        Tip: Bookmark is the fastest way to attach evidence to a new finding.
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-gray-700">Evidence ({track.toUpperCase()})</div>
                <span className="text-[11px] text-gray-500">
                  {evidenceForTrack.length ? `${evidenceForTrack.length} items` : 'No evidence yet'}
                </span>
              </div>

              <WorkspaceEvidenceStrip evidence={evidenceForTrack} onSelect={(ev) => setSelectedEvidenceId(ev.id)} />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <FeatureCard
                  icon={<Timer className="w-4 h-4" />}
                  title="Compare (MVP-2)"
                  desc="Compare current vs prior evidence for this track."
                  cta="Open compare"
                  onClick={() => alert('Stub: open compare view')}
                />
                <FeatureCard
                  icon={<CalendarDays className="w-4 h-4" />}
                  title="Follow-up (MVP-2)"
                  desc="Create follow-up tasks + schedule suggestions from findings."
                  cta="Add follow-up"
                  onClick={() => alert('Stub: add follow-up')}
                />
              </div>

              <div className="rounded-lg border p-3">
                <div className="text-xs font-semibold text-gray-700 flex items-center gap-2">
                  <Link2 className="w-4 h-4" />
                  SFU integration note
                </div>
                <div className="mt-1 text-sm text-gray-700">
                  Best practice: keep LiveKit in SFU. Workspaces are “structured charting.” Evidence comes from SFU capture and is shown here via GET.
                </div>
              </div>
            </div>
          </section>

          {/* RIGHT */}
          <section className="rounded-xl border bg-white shadow-sm overflow-hidden">
            <SectionHeader
              icon={<Sparkles className="w-4 h-4 text-gray-700" />}
              title="Assessment, ICD-10, summary"
              subtitle="Fast capture → payer-ready summary pipeline (encounter-level aggregation next)"
            />

            <div className="p-4 space-y-4">
              <QuickGynHistory value={gynHistory} onChange={setGynHistory} disabled={busy} />

              <QuickFindingComposer onCreate={createManualFinding} disabled={busy} track={track} />

              <div className="rounded-lg border bg-gray-50 p-3">
                <div className="text-xs font-semibold text-gray-700 flex items-center gap-2">
                  <ClipboardCopy className="w-4 h-4" />
                  Session summary (copy)
                </div>
                <div className="mt-2">
                  <textarea className="w-full rounded border bg-white px-2 py-2 text-xs font-mono text-gray-800" rows={12} value={summaryText} readOnly />
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <button className="text-xs px-3 py-1.5 rounded border bg-white hover:bg-gray-50" onClick={copySummary} type="button">
                    Copy summary
                  </button>
                  <button className="text-xs px-3 py-1.5 rounded border bg-white hover:bg-gray-50" onClick={() => alert('Next: POST /api/encounters/:id/session-summary (finalize)')} type="button">
                    Finalize (next)
                  </button>
                </div>
                <div className="mt-2 text-[11px] text-gray-500">
                  Next step: per-workspace summary endpoint + encounter-level aggregator that adds insurance + payment + evidence links.
                </div>
              </div>

              <div className="rounded-lg border p-3">
                <div className="text-xs font-semibold text-gray-700 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                  World-class guardrails
                </div>
                <ul className="mt-2 space-y-1 text-sm text-gray-700 list-disc pl-5">
                  <li>Every finding saves triageMeta (visit mode, vitals, red flags, quick history) into Finding.meta.</li>
                  <li>Context panel gracefully falls back when the GET endpoint is not present.</li>
                  <li>Evidence preview supports images + “processing clips” until SFU capture returns real URLs.</li>
                </ul>
                <div className="mt-2 text-[11px] text-gray-500">
                  Next: GET endpoints for findings/evidence + PUT “workspace form data” so intake is server-truth per encounter.
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Bookmark modal */}
      <BookmarkModal
        open={bookmarkOpen}
        onClose={() => setBookmarkOpen(false)}
        title={`Bookmark (${track === 'ob' ? 'Obstetrics' : 'Gynaecology'})`}
        description="Creates a finding + captures snapshot + clip as evidence"
        findingTypes={FINDING_TYPES.map((x) => ({ key: x.key, label: x.label }))}
        defaultTypeKey={track === 'ob' ? 'fetal_wellbeing' : 'routine_check'}
        onSave={handleBookmark as any}
      />
    </div>
  );
}

/* -----------------------------
   Small UI helpers (local)
------------------------------*/

function SectionHeader(props: { icon: React.ReactNode; title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <div className="border-b px-4 py-3 flex items-start justify-between gap-3">
      <div>
        <div className="text-sm font-semibold flex items-center gap-2">
          {props.icon}
          {props.title}
        </div>
        {props.subtitle ? <div className="text-xs text-gray-500 mt-0.5">{props.subtitle}</div> : null}
      </div>
      {props.right ? <div className="shrink-0">{props.right}</div> : null}
    </div>
  );
}

function Pill(props: { tone: 'rose' | 'amber' | 'emerald' | 'slate'; label: string }) {
  const cls = tonePillClass(props.tone);
  return <span className={`rounded-full border px-2 py-1 text-xs ${cls}`}>{props.label}</span>;
}

function Callout(props: { tone: 'rose' | 'amber' | 'emerald'; title: string; children: React.ReactNode }) {
  const cls = tonePillClass(props.tone);
  return (
    <div className={`mt-2 rounded-lg border px-3 py-2 ${cls}`}>
      <div className="text-xs font-semibold">{props.title}</div>
      <div className="text-xs mt-0.5">{props.children}</div>
    </div>
  );
}

function Field(props: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; disabled?: boolean }) {
  return (
    <label className="text-xs text-gray-600">
      {props.label}
      <input
        className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        disabled={props.disabled}
        placeholder={props.placeholder}
      />
    </label>
  );
}

function FeatureCard(props: { icon: React.ReactNode; title: string; desc: string; cta: string; onClick: () => void }) {
  return (
    <div className="rounded-lg border bg-gray-50 p-3">
      <div className="text-xs font-semibold text-gray-700 flex items-center gap-2">
        {props.icon}
        {props.title}
      </div>
      <div className="mt-1 text-sm text-gray-700">{props.desc}</div>
      <button className="mt-2 text-xs px-3 py-1.5 rounded border bg-white hover:bg-gray-50" onClick={props.onClick} type="button">
        {props.cta}
      </button>
    </div>
  );
}

function MiniKpi(props: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-white px-2 py-2">
      <div className="text-[11px] uppercase tracking-wide text-gray-500">{props.label}</div>
      <div className="text-sm font-semibold text-gray-900 tabular-nums">{props.value}</div>
    </div>
  );
}

/* -----------------------------
   Right column components
------------------------------*/

function QuickGynHistory(props: {
  value: {
    gravida: string;
    para: string;
    miscarriages: string;
    lastPap: string;
    contraception: string;
    allergies: string;
    meds: string;
    chronic: string;
    notes: string;
  };
  onChange: (v: any) => void;
  disabled?: boolean;
}) {
  const { value, onChange, disabled } = props;

  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs font-semibold text-gray-700">History (quick)</div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <label className="text-xs text-gray-600">
          Gravida
          <input
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            value={value.gravida}
            onChange={(e) => onChange({ ...value, gravida: e.target.value })}
            disabled={disabled}
            placeholder="e.g., 2"
          />
        </label>
        <label className="text-xs text-gray-600">
          Para
          <input
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            value={value.para}
            onChange={(e) => onChange({ ...value, para: e.target.value })}
            disabled={disabled}
            placeholder="e.g., 1"
          />
        </label>

        <label className="text-xs text-gray-600 col-span-2">
          Miscarriages / losses (optional)
          <input
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            value={value.miscarriages}
            onChange={(e) => onChange({ ...value, miscarriages: e.target.value })}
            disabled={disabled}
            placeholder="e.g., 0"
          />
        </label>

        <label className="text-xs text-gray-600 col-span-2">
          Last Pap / cervical screening (optional)
          <input
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            value={value.lastPap}
            onChange={(e) => onChange({ ...value, lastPap: e.target.value })}
            disabled={disabled}
            placeholder="YYYY-MM-DD or notes"
          />
        </label>

        <label className="text-xs text-gray-600 col-span-2">
          Contraception (optional)
          <input
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            value={value.contraception}
            onChange={(e) => onChange({ ...value, contraception: e.target.value })}
            disabled={disabled}
            placeholder="method / preference"
          />
        </label>

        <label className="text-xs text-gray-600 col-span-2">
          Allergies (optional)
          <input
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            value={value.allergies}
            onChange={(e) => onChange({ ...value, allergies: e.target.value })}
            disabled={disabled}
            placeholder="e.g., penicillin"
          />
        </label>

        <label className="text-xs text-gray-600 col-span-2">
          Current meds (optional)
          <input
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            value={value.meds}
            onChange={(e) => onChange({ ...value, meds: e.target.value })}
            disabled={disabled}
            placeholder="list"
          />
        </label>

        <label className="text-xs text-gray-600 col-span-2">
          Chronic conditions (optional)
          <input
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            value={value.chronic}
            onChange={(e) => onChange({ ...value, chronic: e.target.value })}
            disabled={disabled}
            placeholder="e.g., HTN, diabetes"
          />
        </label>

        <label className="text-xs text-gray-600 col-span-2">
          Notes (optional)
          <textarea
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            rows={2}
            value={value.notes}
            onChange={(e) => onChange({ ...value, notes: e.target.value })}
            disabled={disabled}
            placeholder="free text"
          />
        </label>
      </div>

      <div className="mt-2 text-[11px] text-gray-500">
        Next: persist this as structured “workspace form data” tied to encounterId (GET/PUT).
      </div>
    </div>
  );
}

function QuickFindingComposer(props: {
  onCreate: (
    type: FindingTypeKey,
    severity?: 'mild' | 'moderate' | 'severe',
    note?: string,
    icd10?: { code: string; label: string } | null
  ) => Promise<void>;
  disabled?: boolean;
  track: TrackKey;
}) {
  const { onCreate, disabled, track } = props;

  const [type, setType] = useState<FindingTypeKey>(track === 'ob' ? 'fetal_wellbeing' : 'routine_check');
  const [severity, setSeverity] = useState<'mild' | 'moderate' | 'severe' | ''>('moderate');
  const [note, setNote] = useState('');
  const [icd10, setIcd10] = useState<{ code: string; label: string } | null>(null);
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    setType(track === 'ob' ? 'fetal_wellbeing' : 'routine_check');
    setIcd10(null);
  }, [track]);

  const icdOptions = ICD10_SUGGESTIONS[type] ?? [];

  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs font-semibold text-gray-700">New finding (manual)</div>

      <div className="mt-2 grid grid-cols-1 gap-2">
        <label className="text-xs text-gray-600">
          Type
          <select
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            value={type}
            onChange={(e) => {
              const t = e.target.value as FindingTypeKey;
              setType(t);
              setIcd10(null);
            }}
            disabled={disabled || saving}
          >
            {FINDING_TYPES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-gray-600">
            Severity
            <select
              className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
              value={severity}
              onChange={(e) => setSeverity(e.target.value as '' | 'mild' | 'moderate' | 'severe')}
              disabled={disabled || saving}
            >
              <option value="">—</option>
              <option value="mild">mild</option>
              <option value="moderate">moderate</option>
              <option value="severe">severe</option>
            </select>
          </label>

          <label className="text-xs text-gray-600">
            ICD-10 (suggested)
            <select
              className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
              value={icd10 ? icd10.code : ''}
              onChange={(e) => {
                const code = e.target.value;
                const hit = icdOptions.find((x) => x.code === code) ?? null;
                setIcd10(hit);
              }}
              disabled={disabled || saving}
            >
              <option value="">—</option>
              {icdOptions.map((o) => (
                <option key={o.code} value={o.code}>
                  {o.code} — {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="text-xs text-gray-600">
          Note
          <textarea
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Key details…"
            disabled={disabled || saving}
          />
        </label>

        <button
          className="mt-1 rounded border bg-white px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
          disabled={disabled || saving}
          onClick={async () => {
            setSaving(true);
            try {
              await onCreate(type, (severity || undefined) as any, note, icd10);
              setNote('');
              setIcd10(null);
            } finally {
              setSaving(false);
            }
          }}
          type="button"
        >
          {saving ? 'Saving…' : 'Create finding'}
        </button>

        <div className="flex items-start gap-2 text-[11px] text-gray-500">
          <Sparkles className="w-4 h-4 mt-0.5" />
          <div>
            Tip: use <b>Bookmark</b> to attach snapshot + clip evidence to a finding in one step.
          </div>
        </div>
      </div>
    </div>
  );
}
