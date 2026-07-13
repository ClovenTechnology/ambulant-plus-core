// apps/patient-app/app/encounters/[id]/page.tsx
'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  CalendarPlus,
  CheckCircle2,
  ClipboardList,
  Download,
  FileText,
  HeartPulse,
  Loader2,
  Pill,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  Star,
  Stethoscope,
  UserRound,
  Video,
} from 'lucide-react';
import {
  caseStatusClasses,
  displayMoney,
  formatDateTime,
  modeLabel,
  statusLabel,
} from '@/lib/encounters/display';

type Encounter = {
  id: string;
  caseId?: string | null;
  status?: string | null;
  visitMode?: string | null;
  mode?: string | null;
  startedAt?: string | number | null;
  endedAt?: string | number | null;
  start?: string | number | null;
  stop?: string | number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  primaryTime?: string | null;
  clinicianId?: string | null;
  clinician?: {
    id?: string | null;
    userId?: string | null;
    name?: string | null;
    displayName?: string | null;
    specialty?: string | null;
    photoUrl?: string | null;
    ratingAvg?: number | null;
    ratingCount?: number | null;
  } | null;
  appointment?: any;
  payment?: any;
  documents?: any[];
  erxOrders?: any[];
  labOrders?: any[];
  counts?: Record<string, number>;
  summaryPayload?: any;
  settlementSnapshot?: any;
  sponsorSnapshot?: any;
  patientRating?: number | null;
  patientRatingComment?: string | null;
  rating?: { score?: number; comment?: string | null; createdAt?: string | null } | null;
};

type VitalsPoint = {
  t?: number | string | null;
  ts?: number | string | null;
  hr?: number | null;
  spo2?: number | null;
  temp?: number | null;
  temp_c?: number | null;
  sys?: number | null;
  dia?: number | null;
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

async function readJsonSafe(res: Response) {
  return res.json().catch(() => null);
}

async function fetchEncounter(id: string): Promise<Encounter> {
  const res = await fetch(`/api/encounters/${encodeURIComponent(id)}`, { cache: 'no-store' });
  const payload = await readJsonSafe(res);
  if (!res.ok || payload?.ok === false) {
    throw new Error(payload?.message || payload?.error || `Encounter service failed (${res.status})`);
  }
  const encounter = payload?.encounter ?? payload?.item ?? payload;
  if (!encounter?.id) throw new Error('Encounter response was empty.');
  return encounter;
}

function clinicianName(encounter?: Encounter | null) {
  return encounter?.clinician?.displayName || encounter?.clinician?.name || 'Clinician';
}

function titleFor(encounter?: Encounter | null) {
  const summary = encounter?.summaryPayload && typeof encounter.summaryPayload === 'object' ? encounter.summaryPayload : null;
  return summary?.reason || summary?.diagnosisText || summary?.chiefComplaint || 'Clinical encounter';
}

function clinicalSummary(encounter?: Encounter | null) {
  const s = encounter?.summaryPayload && typeof encounter.summaryPayload === 'object' ? encounter.summaryPayload : null;
  return {
    reason: s?.reason || s?.chiefComplaint || s?.synopsis || null,
    diagnosis: s?.diagnosisText || s?.assessment || s?.primaryDiagnosis || null,
    plan: s?.plan || s?.managementPlan || s?.treatmentPlan || null,
    notes: s?.notes || s?.clinicalNotes || null,
  };
}

function startTime(encounter?: Encounter | null) {
  return encounter?.startedAt || encounter?.start || encounter?.createdAt || encounter?.primaryTime || null;
}

function endTime(encounter?: Encounter | null) {
  return encounter?.endedAt || encounter?.stop || encounter?.primaryTime || encounter?.updatedAt || null;
}

function latestVitals(encounter?: Encounter | null): VitalsPoint | null {
  const s = encounter?.summaryPayload && typeof encounter.summaryPayload === 'object' ? encounter.summaryPayload : null;
  const rows = Array.isArray((encounter as any)?.vitals)
    ? (encounter as any).vitals
    : Array.isArray(s?.vitals)
      ? s.vitals
      : [];
  return [...rows].sort((a, b) => Date.parse(String(b.t || b.ts || '')) - Date.parse(String(a.t || a.ts || '')))[0] || null;
}

async function fetchEncounterRating(id: string) {
  const res = await fetch(`/api/encounters/${encodeURIComponent(id)}/rating`, {
    cache: 'no-store',
  });

  const payload = await readJsonSafe(res);

  if (!res.ok || payload?.ok === false) return null;

  const rating = payload?.rating ?? null;
  if (!rating) return null;

  const score = Number(rating.score ?? rating.stars ?? rating.rating ?? 0);

  return {
    score: Number.isFinite(score) ? score : 0,
    stars: Number.isFinite(score) ? score : 0,
    comment: typeof rating.comment === 'string' ? rating.comment : null,
    createdAt: rating.createdAt ?? null,
    updatedAt: rating.updatedAt ?? null,
  };
}

function statusIsCompleted(value?: string | null) {
  return /completed|complete|closed|done|ended/i.test(String(value || ''));
}

function StarRating({ value, onChange, disabled }: { value: number; onChange: (value: number) => void; disabled?: boolean }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          onClick={() => onChange(n)}
          className="grid h-10 w-10 place-items-center rounded-2xl border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={`Rate ${n} out of 5`}
        >
          <Star className={cn('h-5 w-5', n <= value ? 'fill-amber-400 text-amber-400' : 'text-slate-300')} />
        </button>
      ))}
    </div>
  );
}

function MetricCard({ label, value, detail, icon: Icon }: { label: string; value: string; detail?: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="rounded-[24px] border border-white/70 bg-white/85 p-4 shadow-[0_18px_50px_rgba(15,23,42,0.06)] backdrop-blur-xl">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-cyan-100 bg-cyan-50 text-cyan-700">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</div>
          <div className="mt-1 text-xl font-black text-slate-950">{value}</div>
          {detail ? <div className="mt-1 text-xs leading-5 text-slate-500">{detail}</div> : null}
        </div>
      </div>
    </div>
  );
}

function Section({ id, title, subtitle, children, right }: { id?: string; title: string; subtitle?: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section id={id} className="rounded-[30px] border border-white/70 bg-white/86 p-5 shadow-[0_20px_70px_rgba(15,23,42,0.06)] backdrop-blur-xl">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-slate-950">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm leading-6 text-slate-500">{subtitle}</p> : null}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

function EncounterContent() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = String(params?.id || '');

  const [encounter, setEncounter] = useState<Encounter | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [savingRating, setSavingRating] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  async function load() {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const next = await fetchEncounter(id);
      const ratingPayload = await fetchEncounterRating(id);

      const existingValue =
        ratingPayload?.score ??
        ratingPayload?.stars ??
        next.patientRating ??
        next.rating?.score ??
        0;

      const existing = Number(existingValue);
      const normalizedExisting = Number.isFinite(existing) && existing > 0 ? existing : null;
      const normalizedComment =
        ratingPayload?.comment ??
        next.patientRatingComment ??
        next.rating?.comment ??
        '';

      setEncounter({
        ...next,
        patientRating: normalizedExisting ?? next.patientRating ?? null,
        patientRatingComment: normalizedComment || null,
        rating: ratingPayload
          ? {
              score: normalizedExisting ?? 0,
              comment: normalizedComment || null,
              createdAt: ratingPayload.createdAt ?? null,
            }
          : next.rating,
      });

      setRating(normalizedExisting ?? 0);
      setComment(String(normalizedComment || ''));
    } catch (err: any) {
      setEncounter(null);
      setError(err?.message || 'Could not load encounter.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (searchParams?.get('rate') === '1') {
      window.setTimeout(() => document.getElementById('rate-encounter')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 350);
    }
  }, [searchParams]);

  async function saveRating() {
    if (!encounter) return;
    if (!rating) {
      setToast('Please select a star rating.');
      return;
    }
    if (!statusIsCompleted(encounter.status)) {
      setToast('Rating is available once the encounter is completed.');
      return;
    }

    setSavingRating(true);
    try {
      const res = await fetch(`/api/encounters/${encodeURIComponent(encounter.id)}/rating`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ score: rating, comment: comment.trim() || null, source: 'patient.encounter' }),
      });
      const payload = await readJsonSafe(res);
      if (!res.ok || payload?.ok === false) throw new Error(payload?.message || payload?.error || `Rating failed (${res.status})`);
      setToast('Thank you. Your rating was saved.');
      await load();
      if (searchParams?.get('rate') === '1') router.push('/encounters');
    } catch (err: any) {
      setToast(err?.message || 'Could not save rating.');
    } finally {
      setSavingRating(false);
    }
  }

  if (loading) {
    return (
      <main data-p-ui="patient-encounter-detail-page" className="min-w-0 overflow-x-clip min-h-screen bg-gradient-to-br from-slate-50 via-cyan-50/30 to-indigo-50/40 px-4 py-8">
        <div className="mx-auto max-w-7xl space-y-4">
          <div className="h-72 animate-pulse rounded-[36px] bg-white/80" />
          <div className="grid gap-4 lg:grid-cols-3">
            {[0, 1, 2].map((i) => <div key={i} className="h-40 animate-pulse rounded-[30px] bg-white/80" />)}
          </div>
        </div>
      </main>
    );
  }

  if (error || !encounter) {
    return (
      <main data-p-ui="patient-encounter-detail-page" className="min-w-0 overflow-x-clip min-h-screen bg-gradient-to-br from-slate-50 via-cyan-50/30 to-indigo-50/40 px-4 py-8">
        <div className="mx-auto max-w-3xl rounded-[32px] border border-white/70 bg-white/90 p-8 text-center shadow-xl">
          <ClipboardList className="mx-auto h-10 w-10 text-slate-400" />
          <h1 className="mt-4 text-2xl font-black text-slate-950">Encounter unavailable</h1>
          <p className="mt-2 text-sm text-slate-600">{error || 'The encounter could not be loaded.'}</p>
          <div className="mt-6 flex justify-center gap-3">
            <button type="button" onClick={load} className="rounded-full bg-slate-950 px-5 py-2.5 text-sm font-black text-white">Try again</button>
            <Link href="/encounters" className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700">Back to encounters</Link>
          </div>
        </div>
      </main>
    );
  }

  const summary = clinicalSummary(encounter);
  const counts = encounter.counts || {};
  const vitals = latestVitals(encounter);
  const docs = Array.isArray(encounter.documents) ? encounter.documents : [];
  const erxOrders = Array.isArray(encounter.erxOrders) ? encounter.erxOrders : [];
  const labOrders = Array.isArray(encounter.labOrders) ? encounter.labOrders : [];
  const careOutputCount = docs.length + erxOrders.length + labOrders.length;
  const completed = statusIsCompleted(encounter.status);
  const payment = encounter.payment || null;

  return (
    <main data-p-ui="patient-encounter-detail-page" className="min-w-0 overflow-x-clip relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-cyan-50/30 to-indigo-50/40 px-4 py-6 text-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {toast ? (
          <div className="fixed right-4 top-4 z-50 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 shadow-xl">
            <button type="button" onClick={() => setToast(null)} className="ml-3 float-right text-slate-400">×</button>
            {toast}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/encounters" className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700">
            <ArrowLeft className="h-4 w-4" /> Back to encounters
          </Link>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={load} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700">
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
            <Link href={`/encounters/${encodeURIComponent(encounter.id)}/print`} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700">
              <Download className="h-4 w-4" /> Print summary
            </Link>
          </div>
        </div>

        <section className="relative overflow-hidden rounded-[36px] border border-white/70 bg-white/84 p-6 shadow-[0_24px_90px_rgba(15,23,42,0.08)] backdrop-blur-xl sm:p-8">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(34,211,238,0.15),transparent_34%),radial-gradient(circle_at_90%_0%,rgba(99,102,241,0.12),transparent_30%)]" />
          <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-4xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn('rounded-full border px-3 py-1 text-xs font-black', caseStatusClasses(encounter.status))}>{statusLabel(encounter.status)}</span>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-600">{modeLabel(encounter.visitMode || encounter.mode)}</span>
                <span className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-bold text-cyan-800">Case {encounter.caseId || 'not recorded'}</span>
              </div>
              <h1 className="mt-5 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">{titleFor(encounter)}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
                {summary.reason || 'This encounter record brings together the consultation, clinician actions, prescriptions, documents, billing and next-step care signals.'}
              </p>
            </div>
            <div className="grid min-w-[280px] gap-3 rounded-[28px] border border-white/70 bg-white/80 p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-950 text-white"><UserRound className="h-5 w-5" /></div>
                <div>
                  <div className="text-sm font-black text-slate-950">{clinicianName(encounter)}</div>
                  <div className="text-xs text-slate-500">{encounter.clinician?.specialty || 'Care team'}</div>
                </div>
              </div>
              <div className="text-xs leading-5 text-slate-500">Started {formatDateTime(startTime(encounter))}<br />Updated {formatDateTime(endTime(encounter))}</div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Visit mode" value={modeLabel(encounter.visitMode || encounter.mode)} detail="Consultation channel" icon={Video} />
          <MetricCard label="Prescriptions" value={String(erxOrders.length || Number(counts.erxOrders || 0))} detail="eRx orders linked" icon={Pill} />
          <MetricCard label="Documents" value={String(Number(counts.documents || docs.length || 0))} detail="Clinical outputs" icon={FileText} />
          <MetricCard label="Payment" value={payment?.status || 'Not recorded'} detail={payment ? displayMoney(payment.amountMinor, payment.currency) : 'No payment record linked'} icon={ShieldCheck} />
        </section>

        <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
          <div className="space-y-5">
            <Section title="Clinical summary" subtitle="Patient-facing interpretation of the consultation record.">
              <div className="grid gap-3">
                {[
                  ['Reason', summary.reason],
                  ['Assessment', summary.diagnosis],
                  ['Plan', summary.plan],
                  ['Notes', summary.notes],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
                    <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</div>
                    <div className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">{value || 'Not recorded yet.'}</div>
                  </div>
                ))}
              </div>
            </Section>

            <Section title="Care outputs" subtitle="Documents and orders generated from this encounter.">
              {careOutputCount ? (
                <div className="grid gap-3">
                  {erxOrders.slice(0, 8).map((rx: any) => {
                    const href = rx.downloadUrl || rx.pdfUrl || `/api/erx/${encodeURIComponent(rx.id)}/pdf`;

                    return (
                      <div key={rx.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4">
                        <div className="flex items-start gap-3">
                          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-emerald-100 text-emerald-800">
                            <Pill className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="font-bold text-slate-900">ePrescription</div>
                            <div className="mt-1 text-sm text-slate-700">{rx.drug || 'Medication'} · {rx.sig || 'Use as directed'}</div>
                            <div className="mt-1 text-xs text-slate-500">Status: {rx.status || 'Queued'}{rx.dispenseCode ? ` · Code: ${rx.dispenseCode}` : ''} · {formatDateTime(rx.createdAt)}</div>
                          </div>
                        </div>
                        <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-xs font-black text-emerald-800 hover:bg-emerald-50">
                          <Download className="h-3.5 w-3.5" /> Download PDF
                        </a>
                      </div>
                    );
                  })}

                  {labOrders.slice(0, 8).map((lab: any) => (
                    <div key={lab.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-cyan-100 bg-cyan-50/40 p-4">
                      <div className="flex items-start gap-3">
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-cyan-100 text-cyan-800">
                          <ClipboardList className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="font-bold text-slate-900">Laboratory order</div>
                          <div className="mt-1 text-sm text-slate-700">{lab.panel || lab.tests?.[0]?.testText || 'Lab request'}</div>
                          <div className="mt-1 text-xs text-slate-500">Status: {lab.status || 'Queued'} · {formatDateTime(lab.createdAt)}</div>
                        </div>
                      </div>
                      <span className="rounded-full border border-cyan-200 bg-white px-3 py-1 text-xs font-black text-cyan-800">MedReach ready</span>
                    </div>
                  ))}

                  {docs.slice(0, 8).map((doc: any) => (
                    <div key={doc.id || doc.fileName} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white p-4">
                      <div>
                        <div className="font-bold text-slate-900">{doc.title || doc.fileName || 'Document'}</div>
                        <div className="mt-1 text-xs text-slate-500">{doc.documentKind || doc.docType || 'Document'} · {formatDateTime(doc.createdAt)}</div>
                      </div>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-600">{doc.status || 'Available'}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-5 text-sm text-slate-500">No patient-facing documents or orders are linked to this encounter yet.</div>
              )}
            </Section>

            <Section title="Latest vitals" subtitle="Vitals captured during or around this encounter.">
              {vitals ? (
                <div className="grid gap-3 sm:grid-cols-4">
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4"><div className="text-xs text-slate-500">Heart rate</div><div className="mt-1 text-xl font-black">{vitals.hr ?? '—'} bpm</div></div>
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4"><div className="text-xs text-slate-500">SpO₂</div><div className="mt-1 text-xl font-black">{vitals.spo2 ?? '—'}%</div></div>
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4"><div className="text-xs text-slate-500">Temp</div><div className="mt-1 text-xl font-black">{vitals.temp ?? vitals.temp_c ?? '—'}°C</div></div>
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4"><div className="text-xs text-slate-500">BP</div><div className="mt-1 text-xl font-black">{vitals.sys && vitals.dia ? `${vitals.sys}/${vitals.dia}` : '—'}</div></div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-5 text-sm text-slate-500">No vitals are linked to this encounter yet.</div>
              )}
            </Section>
          </div>

          <div className="space-y-5">
            <Section title="Next actions" subtitle="Move from review to action.">
              <div className="grid gap-3">
                <Link href="/appointments/new" className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 font-bold text-slate-800 hover:bg-slate-50"><CalendarPlus className="h-5 w-5 text-cyan-700" /> Book follow-up</Link>
                <Link href="/medications" className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 font-bold text-slate-800 hover:bg-slate-50"><Pill className="h-5 w-5 text-emerald-700" /> Review medications</Link>
                <Link href="/careport" className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 font-bold text-slate-800 hover:bg-slate-50"><ShoppingBag className="h-5 w-5 text-indigo-700" /> CarePort orders</Link>
                <Link href="/reports" className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 font-bold text-slate-800 hover:bg-slate-50"><FileText className="h-5 w-5 text-slate-700" /> Reports</Link>
              </div>
            </Section>

            <Section title="Clinical integrity" subtitle="Safety checks around this record.">
              <div className="space-y-3 text-sm text-slate-600">
                <div className="flex gap-3"><CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" /> Encounter ID is present and auditable.</div>
                <div className="flex gap-3"><CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" /> Linked outputs are separated from patient-entered notes.</div>
                <div className="flex gap-3"><Stethoscope className="mt-0.5 h-4 w-4 text-cyan-700" /> Clinician-generated items are shown only when returned by the encounter service.</div>
              </div>
            </Section>

            <Section id="rate-encounter" title="Rate this encounter" subtitle={completed ? 'Your feedback helps improve the care experience.' : 'Rating opens after the encounter is completed.'}>
              <div className="space-y-3">
                <StarRating value={rating} onChange={setRating} disabled={!completed || savingRating} />
                <textarea
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  disabled={!completed || savingRating}
                  placeholder="Optional comment"
                  className="min-h-24 w-full rounded-2xl border border-slate-200 p-3 text-sm outline-none focus:border-cyan-300 focus:ring-4 focus:ring-cyan-500/20 disabled:bg-slate-50"
                />
                <button type="button" disabled={!completed || savingRating} onClick={saveRating} className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-2.5 text-sm font-black text-white disabled:opacity-50">
                  {savingRating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Star className="h-4 w-4" />} Save rating
                </button>
              </div>
            </Section>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function EncounterPage() {
  return (
    <Suspense fallback={null}>
      <EncounterContent />
    </Suspense>
  );
}
