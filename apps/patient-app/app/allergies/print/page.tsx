// apps/patient-app/app/allergies/print/page.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Printer, RefreshCw, ShieldAlert, XCircle } from 'lucide-react';

export const dynamic = 'force-dynamic';

type AllergySeverity = 'Mild' | 'Moderate' | 'Severe';
type AllergyStatus = 'Active' | 'Resolved';
type ReactionSeverity = 'mild' | 'moderate' | 'severe';

type Allergy = {
  id: string;
  substance: string;
  reaction: string;
  severity: AllergySeverity;
  status: AllergyStatus;
  notedAt: string;
  notes?: string | null;
};

type ReactionLogItem = {
  id: string;
  occurredAtISO: string;
  suspectedTrigger: string;
  symptoms: string[];
  severity: ReactionSeverity;
  medsTaken?: string;
  notes?: string;
  resolvedAtISO?: string;
};

function readArrayPayload<T>(payload: any, keys: string[]): T[] {
  if (Array.isArray(payload)) return payload;
  for (const key of keys) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }
  return [];
}

function normaliseAllergy(item: any): Allergy | null {
  if (!item || typeof item !== 'object') return null;
  const id = String(item.id ?? '').trim();
  const substance = String(item.substance ?? item.substanceText ?? item.allergen ?? item.name ?? '').trim();
  if (!id || !substance) return null;

  const severityRaw = String(item.severity ?? 'Mild').trim().toLowerCase();
  const statusRaw = String(item.status ?? item.clinicalStatus ?? 'Active').trim().toLowerCase();

  return {
    id,
    substance,
    reaction: String(item.reaction ?? item.reactionText ?? item.manifestation ?? '').trim(),
    severity: severityRaw === 'severe' ? 'Severe' : severityRaw === 'moderate' ? 'Moderate' : 'Mild',
    status: statusRaw === 'resolved' || statusRaw === 'inactive' ? 'Resolved' : 'Active',
    notedAt: String(item.notedAt ?? item.recordedAt ?? item.createdAt ?? new Date().toISOString()),
    notes: item.notes == null ? null : String(item.notes),
  };
}

function normaliseReaction(item: any): ReactionLogItem | null {
  if (!item || typeof item !== 'object') return null;
  const id = String(item.id ?? '').trim();
  const suspectedTrigger = String(item.suspectedTrigger ?? item.trigger ?? '').trim();
  if (!id || !suspectedTrigger) return null;

  const severityRaw = String(item.severity ?? 'mild').trim().toLowerCase();

  return {
    id,
    occurredAtISO: String(item.occurredAtISO ?? item.occurredAt ?? new Date().toISOString()),
    suspectedTrigger,
    symptoms: Array.isArray(item.symptoms)
      ? item.symptoms.map((x: any) => String(x).trim()).filter(Boolean).slice(0, 12)
      : [],
    severity: severityRaw === 'severe' ? 'severe' : severityRaw === 'moderate' ? 'moderate' : 'mild',
    medsTaken: item.medsTaken == null ? undefined : String(item.medsTaken),
    notes: item.notes == null ? undefined : String(item.notes),
    resolvedAtISO: item.resolvedAtISO == null && item.resolvedAt == null ? undefined : String(item.resolvedAtISO ?? item.resolvedAt),
  };
}

function safeDate(value?: string | null) {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not recorded';
  return date.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
}

function safeDateTime(value?: string | null) {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not recorded';
  return date.toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function severityClass(value: AllergySeverity | ReactionSeverity) {
  const raw = String(value).toLowerCase();
  if (raw === 'severe') return 'border-rose-300 bg-rose-50 text-rose-900';
  if (raw === 'moderate') return 'border-amber-300 bg-amber-50 text-amber-900';
  return 'border-emerald-300 bg-emerald-50 text-emerald-900';
}

function SeverityIcon({ severity }: { severity: AllergySeverity | ReactionSeverity }) {
  const raw = String(severity).toLowerCase();
  if (raw === 'severe') return <XCircle className="h-4 w-4" />;
  if (raw === 'moderate') return <AlertTriangle className="h-4 w-4" />;
  return <CheckCircle2 className="h-4 w-4" />;
}

export default function AllergiesPrintPage() {
  const [allergies, setAllergies] = useState<Allergy[]>([]);
  const [reactions, setReactions] = useState<ReactionLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const [allergyRes, reactionRes] = await Promise.allSettled([
        fetch('/api/allergies', { cache: 'no-store' }),
        fetch('/api/allergy-reactions', { cache: 'no-store' }),
      ]);

      if (allergyRes.status === 'fulfilled') {
        const payload = await allergyRes.value.json().catch(() => null);
        if (!allergyRes.value.ok || payload?.ok === false) {
          throw new Error(payload?.message || payload?.error || `Allergy profile failed (${allergyRes.value.status})`);
        }

        setAllergies(readArrayPayload<any>(payload, ['items', 'allergies', 'rows']).map(normaliseAllergy).filter(Boolean) as Allergy[]);
      } else {
        throw allergyRes.reason;
      }

      if (reactionRes.status === 'fulfilled') {
        const payload = await reactionRes.value.json().catch(() => null);
        if (reactionRes.value.ok && payload?.ok !== false) {
          setReactions(readArrayPayload<any>(payload, ['items', 'reactions', 'rows']).map(normaliseReaction).filter(Boolean) as ReactionLogItem[]);
        } else {
          setReactions([]);
        }
      } else {
        setReactions([]);
      }
    } catch (err: any) {
      setError(err?.message || 'Could not load allergy summary.');
      setAllergies([]);
      setReactions([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const stats = useMemo(() => {
    const active = allergies.filter((item) => item.status === 'Active');
    return {
      total: allergies.length,
      active: active.length,
      severe: active.filter((item) => item.severity === 'Severe').length,
      reactions: reactions.length,
    };
  }, [allergies, reactions]);

  const activeAllergies = useMemo(
    () =>
      allergies
        .filter((item) => item.status === 'Active')
        .sort((a, b) => {
          const order = { Severe: 0, Moderate: 1, Mild: 2 } as Record<AllergySeverity, number>;
          return order[a.severity] - order[b.severity] || a.substance.localeCompare(b.substance);
        }),
    [allergies],
  );

  const resolvedAllergies = useMemo(
    () => allergies.filter((item) => item.status === 'Resolved').sort((a, b) => a.substance.localeCompare(b.substance)),
    [allergies],
  );

  const generatedAt = safeDateTime(new Date().toISOString());

  return (
    <main data-p-ui="patient-allergies-print-page" className="min-w-0 overflow-x-clip min-h-screen bg-slate-100 px-4 py-6 print:bg-white print:px-0 print:py-0">
      <div className="mx-auto max-w-5xl rounded-[28px] bg-white p-6 shadow-xl print:rounded-none print:p-0 print:shadow-none">
        <header className="border-b border-slate-200 pb-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-cyan-800 print:border-slate-300 print:bg-white print:text-slate-700">
                <ShieldAlert className="h-3.5 w-3.5" />
                Ambulant+ allergy record
              </div>
              <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950">Allergy & reaction summary</h1>
              <p className="mt-2 text-sm text-slate-500">Generated {generatedAt}</p>
            </div>

            <div className="flex gap-2 print:hidden">
              <button
                type="button"
                onClick={() => void load()}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800"
              >
                <Printer className="h-4 w-4" />
                Print
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-4">
            <SummaryTile label="Active" value={stats.active} />
            <SummaryTile label="Severe active" value={stats.severe} />
            <SummaryTile label="Total allergies" value={stats.total} />
            <SummaryTile label="Reaction logs" value={stats.reactions} />
          </div>
        </header>

        {error ? (
          <section className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">
            {error}
          </section>
        ) : null}

        <section className="mt-6">
          <SectionTitle title="Active allergy profile" subtitle="Items currently marked active for clinical safety checks." />
          {loading ? (
            <LoadingRows />
          ) : activeAllergies.length ? (
            <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Substance</th>
                    <th className="px-4 py-3">Reaction</th>
                    <th className="px-4 py-3">Severity</th>
                    <th className="px-4 py-3">Noted</th>
                  </tr>
                </thead>
                <tbody>
                  {activeAllergies.map((item) => (
                    <tr key={item.id} className="border-t border-slate-200 align-top">
                      <td className="px-4 py-3 font-bold text-slate-950">{item.substance}</td>
                      <td className="px-4 py-3 text-slate-700">{item.reaction || 'Not recorded'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${severityClass(item.severity)}`}>
                          <SeverityIcon severity={item.severity} />
                          {item.severity}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{safeDate(item.notedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyPrint text="No active allergies recorded." />
          )}
        </section>

        <section className="mt-8">
          <SectionTitle title="Reaction log" subtitle="Patient-recorded allergy or sensitivity incidents." />
          {loading ? (
            <LoadingRows />
          ) : reactions.length ? (
            <div className="mt-3 space-y-3">
              {reactions.map((item) => (
                <article key={item.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${severityClass(item.severity)}`}>
                          <SeverityIcon severity={item.severity} />
                          {item.severity}
                        </span>
                        <span className="text-xs font-semibold text-slate-500">{safeDateTime(item.occurredAtISO)}</span>
                      </div>
                      <h3 className="mt-2 text-base font-black text-slate-950">{item.suspectedTrigger}</h3>
                    </div>
                    {item.resolvedAtISO ? (
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">
                        Resolved {safeDateTime(item.resolvedAtISO)}
                      </span>
                    ) : null}
                  </div>

                  {item.symptoms.length ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {item.symptoms.map((symptom) => (
                        <span key={symptom} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                          {symptom}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  {item.medsTaken || item.notes ? (
                    <div className="mt-3 space-y-1 text-sm leading-6 text-slate-700">
                      {item.medsTaken ? <div><span className="font-bold text-slate-900">Medication taken:</span> {item.medsTaken}</div> : null}
                      {item.notes ? <div>{item.notes}</div> : null}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <EmptyPrint text="No reaction logs recorded." />
          )}
        </section>

        {resolvedAllergies.length ? (
          <section className="mt-8">
            <SectionTitle title="Resolved allergy history" subtitle="Kept for longitudinal clinical context." />
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {resolvedAllergies.map((item) => (
                <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm">
                  <div className="font-bold text-slate-900">{item.substance}</div>
                  <div className="text-slate-600">{item.reaction || 'Reaction not recorded'} · {item.severity}</div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <footer className="mt-8 border-t border-slate-200 pt-4 text-xs leading-5 text-slate-500">
          This summary reflects patient-app allergy data available at generation time. Clinicians should reconcile this with the full clinical record before prescribing or administering treatment.
        </footer>
      </div>
    </main>
  );
}

function SummaryTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</div>
      <div className="mt-1 text-2xl font-black text-slate-950">{value}</div>
    </div>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h2 className="text-lg font-black text-slate-950">{title}</h2>
      <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
    </div>
  );
}

function LoadingRows() {
  return (
    <div className="mt-3 space-y-2">
      {[0, 1, 2].map((item) => (
        <div key={item} className="h-16 animate-pulse rounded-2xl bg-slate-100" />
      ))}
    </div>
  );
}

function EmptyPrint({ text }: { text: string }) {
  return (
    <div className="mt-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
      {text}
    </div>
  );
}
