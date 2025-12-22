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

import React, { useEffect, useMemo, useState } from 'react';
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
  sti_risk: [{ code: 'Z20.2', label: 'Contact with and (suspected) exposure to infections with a predominantly sexual mode of transmission' }],
  other: [{ code: 'Z01.89', label: 'Encounter for other specified special examinations' }],
};

type OBGYNWorkspaceProps = {
  patientId?: string;
  encounterId?: string;
  clinicianId?: string;
};

type PatientContext = {
  // A merged snapshot you’ll later serve from APIGW.
  // Keep it lightweight to avoid overfitting early.
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

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setCtxLoading(true);
      setCtx(null);
      try {
        // Future: implement this in clinician-app or apigw.
        const url = new URL('/api/workspaces/obgyn/context', window.location.origin);
        url.searchParams.set('patientId', patientId);
        url.searchParams.set('encounterId', encounterId);

        const r = await fetch(url.toString(), { cache: 'no-store' });
        if (!r.ok) throw new Error(`context ${r.status}`);
        const data = (await r.json()) as PatientContext;
        if (!cancelled) setCtx(data);
      } catch {
        // no-op: remain null (fallback UI shows)
        if (!cancelled) setCtx(null);
      } finally {
        if (!cancelled) setCtxLoading(false);
      }
    }

    // Only attempt in browser
    if (typeof window !== 'undefined') load();
    return () => {
      cancelled = true;
    };
  }, [patientId, encounterId]);

  // Quick vitals (manual / screening)
  const [gestAgeWeeks, setGestAgeWeeks] = useState<string>(''); // OB
  const [lmp, setLmp] = useState<string>(''); // both
  const [edd, setEdd] = useState<string>(''); // OB (optional)
  const [bpSys, setBpSys] = useState<string>(''); // both
  const [bpDia, setBpDia] = useState<string>(''); // both
  const [tempC, setTempC] = useState<string>(''); // both
  const [hr, setHr] = useState<string>(''); // both
  const [spo2, setSpo2] = useState<string>(''); // both
  const [glucose, setGlucose] = useState<string>(''); // OB/GDM context

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

  const triageMeta = useMemo(() => {
    const meta = {
      visitMode,
      pregnancyStatus,
      lmp: lmp || undefined,
      edd: edd || undefined,
      gestAgeWeeks: safeNum(gestAgeWeeks) ?? undefined,
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
      gynHistory,
      ctxHint: ctx ? { hasAntenatal: !!ctx.antenatal, hasLadyCenter: !!ctx.ladyCenter } : undefined,
    };
    return meta;
  }, [visitMode, pregnancyStatus, lmp, edd, gestAgeWeeks, bpSys, bpDia, tempC, hr, spo2, glucose, redFlags, risk, gynHistory, ctx]);

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

    lines.push(`Triage`);
    lines.push(`- Pregnancy status: ${pregnancyStatus}`);
    if (lmp) lines.push(`- LMP: ${lmp}`);
    if (edd) lines.push(`- EDD: ${edd}`);
    if (gestAgeWeeks) lines.push(`- GA (weeks): ${gestAgeWeeks}`);
    if (bpBadge) lines.push(`- BP: ${bpBadge.label} (${bpBadge.hint})`);
    if (tempC) lines.push(`- Temp: ${tempC} °C`);
    if (hr) lines.push(`- HR: ${hr} bpm`);
    if (spo2) lines.push(`- SpO₂: ${spo2} %`);
    if (glucose) lines.push(`- Glucose: ${glucose} mg/dL`);
    lines.push(`- Risk tier (screen): ${risk.label} (score ${risk.score})`);

    const rf = Object.entries(redFlags)
      .filter(([, v]) => v)
      .map(([k]) => k);
    if (rf.length) lines.push(`- Red flags: ${rf.join(', ')}`);
    else lines.push(`- Red flags: none selected`);

    lines.push('');
    lines.push(`History (quick)`);
    const gh = gynHistory;
    if (gh.gravida || gh.para) lines.push(`- G/P: ${gh.gravida || '—'}/${gh.para || '—'}`);
    if (gh.miscarriages) lines.push(`- Miscarriages: ${gh.miscarriages}`);
    if (gh.lastPap) lines.push(`- Last Pap: ${gh.lastPap}`);
    if (gh.contraception) lines.push(`- Contraception: ${gh.contraception}`);
    if (gh.allergies) lines.push(`- Allergies: ${gh.allergies}`);
    if (gh.meds) lines.push(`- Meds: ${gh.meds}`);
    if (gh.chronic) lines.push(`- Chronic: ${gh.chronic}`);
    if (gh.notes) lines.push(`- Notes: ${gh.notes}`);

    if (ctx?.insurance) {
      lines.push('');
      lines.push(`Insurance / Payment`);
      if (ctx.insurance.schemeName) lines.push(`- Scheme: ${ctx.insurance.schemeName}${ctx.insurance.planName ? ` (${ctx.insurance.planName})` : ''}`);
      if (ctx.insurance.membershipNumberMasked) lines.push(`- Member #: ${ctx.insurance.membershipNumberMasked}`);
      if (ctx.insurance.paymentMethod) lines.push(`- Method: ${ctx.insurance.paymentMethod}`);
    }

    lines.push('');
    lines.push(`Findings`);
    if (!findingsForTrack.length) {
      lines.push(`- none captured`);
    } else {
      for (const f of findingsForTrack.slice(0, 10)) {
        const icd = (f.meta as any)?.icd10?.code ? `${(f.meta as any).icd10.code} ${(f.meta as any).icd10.label ?? ''}` : '';
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
    pregnancyStatus,
    lmp,
    edd,
    gestAgeWeeks,
    bpBadge,
    tempC,
    hr,
    spo2,
    glucose,
    risk,
    redFlags,
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

  const riskPillClass =
    risk.tier === 'high'
      ? 'border-rose-200 bg-rose-50 text-rose-900'
      : risk.tier === 'medium'
      ? 'border-amber-200 bg-amber-50 text-amber-900'
      : 'border-emerald-200 bg-emerald-50 text-emerald-900';

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 border-b bg-white/90 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm text-gray-500">Ambulant+ Workspace</div>
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <Baby className="w-5 h-5 text-pink-600" />
              OB/GYN Workspace
              <span className="ml-1 text-xs font-medium px-2 py-0.5 rounded-full border bg-gray-50 text-gray-700">
                Worldclass
              </span>
            </h1>
            <div className="mt-1 text-xs text-gray-500">
              Structured triage · Evidence + annotations · ICD-10 hints · Session summary (payer-ready pipeline next)
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full border bg-white px-2 py-1 text-gray-700">
              Patient: <span className="font-mono">{patientId}</span>
            </span>
            <span className="rounded-full border bg-white px-2 py-1 text-gray-700">
              Encounter: <span className="font-mono">{encounterId}</span>
            </span>

            <span className={`rounded-full border px-2 py-1 ${riskPillClass}`} title="Heuristic UI score; not a diagnosis">
              Risk: <span className="font-semibold">{risk.label}</span> · {risk.score}
            </span>

            {bpBadge ? (
              <span
                className={
                  'rounded-full border px-2 py-1 ' +
                  (bpBadge.tone === 'rose'
                    ? 'border-rose-200 bg-rose-50 text-rose-900'
                    : bpBadge.tone === 'amber'
                    ? 'border-amber-200 bg-amber-50 text-amber-900'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-900')
                }
                title="Screening hint only (not a diagnosis)"
              >
                BP: <span className="font-mono font-semibold">{bpBadge.label}</span> · {bpBadge.hint}
              </span>
            ) : (
              <span className="rounded-full border bg-gray-50 px-2 py-1 text-gray-600">BP: —</span>
            )}
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

        <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_1.6fr_1.25fr] gap-4">
          {/* LEFT */}
          <section className="rounded-xl border bg-white shadow-sm">
            <div className="border-b px-4 py-3">
              <div className="text-sm font-semibold flex items-center gap-2">
                <Shield className="w-4 h-4 text-gray-700" />
                Patient context & triage
              </div>
              <div className="text-xs text-gray-500">
                Pulls from patient profile + Lady Center + Antenatal Center when APIs are available.
              </div>
            </div>

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
                onChange={setTrack}
                items={TRACKS.map((t) => ({ key: t.key, label: t.label }))}
                counts={trackCounts}
              />

              {/* Patient context panel */}
              <div className="rounded-lg border bg-gray-50 p-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-gray-700 flex items-center gap-2">
                    <Info className="w-4 h-4" />
                    Patient context (feeds)
                  </div>
                  <span className="text-[11px] text-gray-500">
                    {ctxLoading ? 'Loading…' : ctx ? 'Connected' : 'Fallback'}
                  </span>
                </div>

                {ctx ? (
                  <div className="mt-2 space-y-2 text-sm text-gray-800">
                    <div className="grid grid-cols-2 gap-2">
                      <MiniKpi label="EDD" value={ctx.edd ?? '—'} />
                      <MiniKpi label="LMP" value={ctx.lmp ?? '—'} />
                      <MiniKpi label="GA" value={ctx.gestAgeWeeks != null ? `${ctx.gestAgeWeeks}w` : '—'} />
                      <MiniKpi label="Trimester" value={ctx.trimester ? `T${ctx.trimester}` : '—'} />
                    </div>

                    <div className="rounded-md border bg-white p-2">
                      <div className="text-xs font-semibold text-gray-700">Lady Center</div>
                      <div className="text-xs text-gray-600 mt-1">
                        {ctx.ladyCenter ? (
                          <>
                            Cycle day: <b>{ctx.ladyCenter.cycleDay ?? '—'}</b> · Fertile:{' '}
                            <b>{ctx.ladyCenter.fertileWindow ?? '—'}</b> · Ovulation:{' '}
                            <b>{ctx.ladyCenter.predictedOvulation ?? '—'}</b> · Pregnancy:{' '}
                            <b>{ctx.ladyCenter.possiblePregnancy ?? '—'}</b>
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
                          {ctx.latestVitals.device ? <b>{ctx.latestVitals.device}</b> : 'Device'} ·{' '}
                          {ctx.latestVitals.capturedAt ? fmtDate(ctx.latestVitals.capturedAt) : '—'} · HR{' '}
                          <b>{ctx.latestVitals.hr ?? '—'}</b> · SpO₂ <b>{ctx.latestVitals.spo2 ?? '—'}</b> · BP{' '}
                          <b>{ctx.latestVitals.sys ?? '—'}</b>/<b>{ctx.latestVitals.dia ?? '—'}</b> · Temp{' '}
                          <b>{ctx.latestVitals.tempC ?? '—'}</b>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="mt-2 text-xs text-gray-600">
                    APIs not wired yet. This panel is ready to consume:
                    <div className="mt-1 font-mono text-[11px] text-gray-600">
                      GET /api/workspaces/obgyn/context?patientId=...&encounterId=...
                    </div>
                  </div>
                )}
              </div>

              {/* Quick vitals */}
              <div className="rounded-lg border bg-gray-50 p-3">
                <div className="text-xs font-semibold text-gray-700 flex items-center gap-2">
                  <HeartPulse className="w-4 h-4" />
                  Vitals (quick)
                </div>

                <div className="mt-2 grid grid-cols-2 gap-2">
                  <label className="text-xs text-gray-600">
                    BP SYS
                    <input
                      className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
                      inputMode="numeric"
                      value={bpSys}
                      onChange={(e) => setBpSys(e.target.value)}
                      placeholder="e.g., 120"
                    />
                  </label>
                  <label className="text-xs text-gray-600">
                    BP DIA
                    <input
                      className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
                      inputMode="numeric"
                      value={bpDia}
                      onChange={(e) => setBpDia(e.target.value)}
                      placeholder="e.g., 80"
                    />
                  </label>

                  <label className="text-xs text-gray-600">
                    Temp (°C)
                    <input
                      className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
                      inputMode="decimal"
                      value={tempC}
                      onChange={(e) => setTempC(e.target.value)}
                      placeholder="e.g., 36.8"
                    />
                  </label>
                  <label className="text-xs text-gray-600">
                    HR (bpm)
                    <input
                      className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
                      inputMode="numeric"
                      value={hr}
                      onChange={(e) => setHr(e.target.value)}
                      placeholder="e.g., 78"
                    />
                  </label>

                  <label className="text-xs text-gray-600">
                    SpO₂ (%)
                    <input
                      className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
                      inputMode="numeric"
                      value={spo2}
                      onChange={(e) => setSpo2(e.target.value)}
                      placeholder="e.g., 98"
                    />
                  </label>
                  <label className="text-xs text-gray-600">
                    Glucose (mg/dL)
                    <input
                      className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
                      inputMode="numeric"
                      value={glucose}
                      onChange={(e) => setGlucose(e.target.value)}
                      placeholder="e.g., 95"
                    />
                  </label>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-2">
                  <label className="text-xs text-gray-600">
                    LMP (optional)
                    <input className="mt-1 w-full rounded border px-2 py-1.5 text-sm" type="date" value={lmp} onChange={(e) => setLmp(e.target.value)} />
                  </label>

                  {track === 'ob' ? (
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-xs text-gray-600">
                        GA (weeks)
                        <input
                          className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
                          inputMode="numeric"
                          value={gestAgeWeeks}
                          onChange={(e) => setGestAgeWeeks(e.target.value)}
                          placeholder="e.g., 24"
                        />
                      </label>
                      <label className="text-xs text-gray-600">
                        EDD
                        <input className="mt-1 w-full rounded border px-2 py-1.5 text-sm" type="date" value={edd} onChange={(e) => setEdd(e.target.value)} />
                      </label>
                    </div>
                  ) : null}
                </div>

                <div className="mt-3 flex items-start gap-2 text-[11px] text-gray-600">
                  <Info className="w-4 h-4 mt-0.5" />
                  <div>
                    Tip: when GET endpoints are live, this becomes server-truth and can auto-pull “latest vitals” from Health Monitor / NexRing.
                  </div>
                </div>
              </div>

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
                        ? ([
                            ['reducedMovements', 'Reduced movements'],
                            ['contractionsRegular', 'Regular contractions'],
                          ] as const)
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
                  UX screening only — protocols + escalation pathways are added when we wire plan/referral/orders.
                </div>
              </div>

              {/* Findings list */}
              <div className="rounded-lg border bg-white p-3">
                <div className="text-xs font-semibold text-gray-700">Findings ({track.toUpperCase()})</div>
                <div className="mt-2">
                  {findingsForTrack.length === 0 ? (
                    <div className="text-sm text-gray-600 italic">No findings captured yet.</div>
                  ) : (
                    <ul className="space-y-2">
                      {findingsForTrack.slice(0, 6).map((f) => (
                        <li key={f.id}>
                          <FindingCard finding={f} evidenceCount={evidenceCountForFinding(f.id)} onToggleFinal={undefined} />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {findingsForTrack.length > 6 ? (
                  <div className="mt-2 text-[11px] text-gray-500">Showing latest 6. List view enhancements come next.</div>
                ) : null}
              </div>
            </div>
          </section>

          {/* CENTER */}
          <section className="rounded-xl border bg-white shadow-sm">
            <div className="border-b px-4 py-3 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold flex items-center gap-2">
                  <Stethoscope className="w-4 h-4 text-gray-700" />
                  Evidence & annotations
                </div>
                <div className="text-xs text-gray-500">Bookmark creates a finding + snapshot + clip (SFU live_capture wiring next)</div>
              </div>

              <button
                className="rounded-full border bg-blue-50 hover:bg-blue-100 px-3 py-1.5 text-xs font-medium text-blue-800 disabled:opacity-50"
                onClick={() => setBookmarkOpen(true)}
                disabled={busy}
                type="button"
              >
                Bookmark
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="rounded-lg border bg-gray-100 h-72 overflow-hidden">
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
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-gray-700">Evidence ({track.toUpperCase()})</div>
                <button
                  className="text-xs px-3 py-1.5 rounded border bg-white hover:bg-gray-50 disabled:opacity-50"
                  onClick={addDemoPinAnnotation}
                  disabled={busy}
                  title="Creates a demo pin annotation for the selected evidence"
                  type="button"
                >
                  + Add pin
                </button>
              </div>

              <WorkspaceEvidenceStrip evidence={evidenceForTrack} onSelect={(ev) => setSelectedEvidenceId(ev.id)} />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-lg border bg-gray-50 p-3">
                  <div className="text-xs font-semibold text-gray-700 flex items-center gap-2">
                    <Timer className="w-4 h-4" />
                    Compare (MVP-2)
                  </div>
                  <div className="mt-1 text-sm text-gray-700">Compare current vs prior evidence for this track.</div>
                  <button
                    className="mt-2 text-xs px-3 py-1.5 rounded border bg-white hover:bg-gray-50"
                    onClick={() => alert('Stub: open compare view')}
                    type="button"
                  >
                    Open compare
                  </button>
                </div>

                <div className="rounded-lg border bg-gray-50 p-3">
                  <div className="text-xs font-semibold text-gray-700 flex items-center gap-2">
                    <CalendarDays className="w-4 h-4" />
                    Follow-up (MVP-2)
                  </div>
                  <div className="mt-1 text-sm text-gray-700">Create follow-up tasks + schedule suggestions from findings.</div>
                  <button
                    className="mt-2 text-xs px-3 py-1.5 rounded border bg-white hover:bg-gray-50"
                    onClick={() => alert('Stub: add follow-up')}
                    type="button"
                  >
                    Add follow-up
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* RIGHT */}
          <section className="rounded-xl border bg-white shadow-sm">
            <div className="border-b px-4 py-3">
              <div className="text-sm font-semibold flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-gray-700" />
                Assessment, ICD-10, summary
              </div>
              <div className="text-xs text-gray-500">Fast capture → payer-ready summary pipeline (APIs next)</div>
            </div>

            <div className="p-4 space-y-4">
              <QuickGynHistory value={gynHistory} onChange={setGynHistory} disabled={busy} />

              <QuickFindingComposer
                onCreate={createManualFinding}
                disabled={busy}
                track={track}
              />

              <div className="rounded-lg border bg-gray-50 p-3">
                <div className="text-xs font-semibold text-gray-700 flex items-center gap-2">
                  <ClipboardCopy className="w-4 h-4" />
                  Session summary (copy)
                </div>
                <div className="mt-2">
                  <textarea
                    className="w-full rounded border bg-white px-2 py-2 text-xs font-mono text-gray-800"
                    rows={12}
                    value={summaryText}
                    readOnly
                  />
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    className="text-xs px-3 py-1.5 rounded border bg-white hover:bg-gray-50"
                    onClick={copySummary}
                    type="button"
                  >
                    Copy summary
                  </button>
                  <button
                    className="text-xs px-3 py-1.5 rounded border bg-white hover:bg-gray-50"
                    onClick={() => alert('Next: POST /api/encounters/:id/session-summary (finalize)')}
                    type="button"
                  >
                    Finalize (next)
                  </button>
                </div>
                <div className="mt-2 text-[11px] text-gray-500">
                  Next step: per-workspace summary endpoint + encounter-level aggregator that adds insurance + payment + evidence links.
                </div>
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

function MiniKpi(props: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-white px-2 py-2">
      <div className="text-[11px] uppercase tracking-wide text-gray-500">{props.label}</div>
      <div className="text-sm font-semibold text-gray-900 tabular-nums">{props.value}</div>
    </div>
  );
}

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

  // keep type sensible when switching track
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
