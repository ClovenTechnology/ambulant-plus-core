// apps/patient-app/app/allergies/allergies-client.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileDown,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Trash2,
  XCircle,
} from 'lucide-react';
import { toast } from '../../components/toast';

type AllergySeverity = 'Mild' | 'Moderate' | 'Severe';
type AllergyStatus = 'Active' | 'Resolved';

export type Allergy = {
  id: string;
  substance: string;
  reaction: string;
  severity: AllergySeverity;
  status: AllergyStatus;
  notedAt: string;
};

type ReactionSeverity = 'mild' | 'moderate' | 'severe';

export type ReactionLogItem = {
  id: string;
  occurredAtISO: string;
  suspectedTrigger: string;
  symptoms: string[];
  severity: ReactionSeverity;
  medsTaken?: string;
  notes?: string;
  resolvedAtISO?: string;
};

type AllergyStats = {
  total: number;
  active: number;
  severeActive: number;
  resolved: number;
  reactions30d: number;
  severeReactions30d: number;
};

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

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

function toInputDateTime(value?: string) {
  const date = value ? new Date(value) : new Date();
  const clean = Number.isNaN(date.getTime()) ? new Date() : date;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${clean.getFullYear()}-${pad(clean.getMonth() + 1)}-${pad(clean.getDate())}T${pad(clean.getHours())}:${pad(clean.getMinutes())}`;
}

function severityClasses(value: AllergySeverity | ReactionSeverity) {
  const raw = String(value).toLowerCase();
  if (raw === 'severe') return 'border-rose-200 bg-rose-50 text-rose-800';
  if (raw === 'moderate') return 'border-amber-200 bg-amber-50 text-amber-900';
  return 'border-emerald-200 bg-emerald-50 text-emerald-800';
}

function statusClasses(value: AllergyStatus) {
  return value === 'Active'
    ? 'border-cyan-200 bg-cyan-50 text-cyan-800'
    : 'border-slate-200 bg-slate-50 text-slate-600';
}

function SeverityIcon({ severity }: { severity: AllergySeverity | ReactionSeverity }) {
  const raw = String(severity).toLowerCase();
  if (raw === 'severe') return <XCircle className="h-4 w-4" />;
  if (raw === 'moderate') return <AlertTriangle className="h-4 w-4" />;
  return <CheckCircle2 className="h-4 w-4" />;
}

function MetricCard({
  label,
  value,
  note,
  tone = 'slate',
}: {
  label: string;
  value: string | number;
  note: string;
  tone?: 'slate' | 'rose' | 'amber' | 'emerald' | 'cyan';
}) {
  const toneClass =
    tone === 'rose'
      ? 'from-rose-50 to-white border-rose-100'
      : tone === 'amber'
        ? 'from-amber-50 to-white border-amber-100'
        : tone === 'emerald'
          ? 'from-emerald-50 to-white border-emerald-100'
          : tone === 'cyan'
            ? 'from-cyan-50 to-white border-cyan-100'
            : 'from-slate-50 to-white border-slate-100';

  return (
    <div className={cx('rounded-[26px] border bg-gradient-to-br p-5 shadow-sm', toneClass)}>
      <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</div>
      <div className="mt-2 text-3xl font-black tracking-tight text-slate-950">{value}</div>
      <p className="mt-1 text-xs leading-5 text-slate-500">{note}</p>
    </div>
  );
}

function EmptyPanel({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[26px] border border-dashed border-slate-200 bg-slate-50/80 p-6 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-white text-slate-400 shadow-sm">
        <ShieldAlert className="h-6 w-6" />
      </div>
      <div className="mt-3 text-sm font-black text-slate-900">{title}</div>
      <p className="mx-auto mt-1 max-w-xl text-sm leading-6 text-slate-500">{body}</p>
    </div>
  );
}

export default function AllergiesClient({ initial }: { initial?: Allergy[] }) {
  const [allergies, setAllergies] = useState<Allergy[]>(Array.isArray(initial) ? initial : []);
  const [reactions, setReactions] = useState<ReactionLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingAllergy, setSavingAllergy] = useState(false);
  const [savingReaction, setSavingReaction] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<'profile' | 'reactions'>('profile');
  const [statusFilter, setStatusFilter] = useState<'all' | AllergyStatus>('all');
  const [severityFilter, setSeverityFilter] = useState<'all' | AllergySeverity | ReactionSeverity>('all');

  const [substance, setSubstance] = useState('');
  const [reaction, setReaction] = useState('');
  const [severity, setSeverity] = useState<AllergySeverity>('Mild');
  const [notes, setNotes] = useState('');

  const [occurredAtISO, setOccurredAtISO] = useState(() => toInputDateTime());
  const [suspectedTrigger, setSuspectedTrigger] = useState('');
  const [reactionSeverity, setReactionSeverity] = useState<ReactionSeverity>('mild');
  const [symptomsText, setSymptomsText] = useState('');
  const [medsTaken, setMedsTaken] = useState('');
  const [reactionNotes, setReactionNotes] = useState('');
  const [resolvedAtISO, setResolvedAtISO] = useState('');

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
      setError(err?.message || 'Could not load allergy information.');
      setAllergies([]);
      setReactions([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const stats: AllergyStats = useMemo(() => {
    const active = allergies.filter((a) => a.status === 'Active');
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const reactions30d = reactions.filter((r) => {
      const t = Date.parse(r.occurredAtISO);
      return Number.isFinite(t) && t >= thirtyDaysAgo;
    });

    return {
      total: allergies.length,
      active: active.length,
      severeActive: active.filter((a) => a.severity === 'Severe').length,
      resolved: allergies.filter((a) => a.status === 'Resolved').length,
      reactions30d: reactions30d.length,
      severeReactions30d: reactions30d.filter((r) => r.severity === 'severe').length,
    };
  }, [allergies, reactions]);

  const filteredAllergies = useMemo(() => {
    const q = query.trim().toLowerCase();

    return allergies
      .filter((item) => (statusFilter === 'all' ? true : item.status === statusFilter))
      .filter((item) =>
        severityFilter === 'all'
          ? true
          : ['Mild', 'Moderate', 'Severe'].includes(String(severityFilter))
            ? item.severity === severityFilter
            : true,
      )
      .filter((item) => {
        if (!q) return true;
        return [item.substance, item.reaction, item.severity, item.status].join(' ').toLowerCase().includes(q);
      })
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === 'Active' ? -1 : 1;
        if (a.severity !== b.severity) {
          const order = { Severe: 0, Moderate: 1, Mild: 2 } as Record<AllergySeverity, number>;
          return order[a.severity] - order[b.severity];
        }
        return Date.parse(b.notedAt) - Date.parse(a.notedAt);
      });
  }, [allergies, query, severityFilter, statusFilter]);

  const filteredReactions = useMemo(() => {
    const q = query.trim().toLowerCase();

    return reactions
      .filter((item) =>
        severityFilter === 'all'
          ? true
          : ['mild', 'moderate', 'severe'].includes(String(severityFilter))
            ? item.severity === severityFilter
            : true,
      )
      .filter((item) => {
        if (!q) return true;
        return [
          item.suspectedTrigger,
          item.severity,
          item.medsTaken || '',
          item.notes || '',
          ...(item.symptoms || []),
        ]
          .join(' ')
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => Date.parse(b.occurredAtISO) - Date.parse(a.occurredAtISO));
  }, [query, reactions, severityFilter]);

  async function addAllergy() {
    const cleanedSubstance = substance.trim();
    const cleanedReaction = reaction.trim();

    if (!cleanedSubstance || !cleanedReaction) {
      toast('Please enter the substance and reaction.', { type: 'error' });
      return;
    }

    setSavingAllergy(true);

    try {
      const res = await fetch('/api/allergies', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          substance: cleanedSubstance,
          reaction: cleanedReaction,
          severity,
          notes: notes.trim() || null,
        }),
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok || payload?.ok === false) {
        throw new Error(payload?.message || payload?.error || `Could not add allergy (${res.status})`);
      }

      const row = normaliseAllergy(payload?.row ?? payload?.item ?? payload);
      if (row) {
        setAllergies((prev) => [row, ...prev.filter((item) => item.id !== row.id)]);
      } else {
        await load();
      }

      setSubstance('');
      setReaction('');
      setSeverity('Mild');
      setNotes('');
      toast('Allergy added.', { type: 'success' });
    } catch (err: any) {
      toast(err?.message || 'Could not add allergy.', { type: 'error' });
    } finally {
      setSavingAllergy(false);
    }
  }

  async function updateAllergyStatus(item: Allergy, status: AllergyStatus) {
    try {
      const res = await fetch('/api/allergies', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ id: item.id, status }),
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok || payload?.ok === false) {
        throw new Error(payload?.message || payload?.error || `Could not update allergy (${res.status})`);
      }

      const row = normaliseAllergy(payload?.row ?? payload?.item ?? payload);
      setAllergies((prev) =>
        prev.map((allergy) => (allergy.id === item.id ? { ...allergy, ...(row ?? {}), status } : allergy)),
      );
      toast(status === 'Active' ? 'Allergy reactivated.' : 'Allergy marked resolved.', { type: 'success' });
    } catch (err: any) {
      toast(err?.message || 'Could not update allergy.', { type: 'error' });
    }
  }

  async function addReaction() {
    const trigger = suspectedTrigger.trim();

    if (!trigger) {
      toast('Enter the suspected trigger.', { type: 'error' });
      return;
    }

    const occurred = new Date(occurredAtISO);
    if (Number.isNaN(occurred.getTime())) {
      toast('Enter a valid reaction time.', { type: 'error' });
      return;
    }

    const resolved = resolvedAtISO ? new Date(resolvedAtISO) : null;
    if (resolved && Number.isNaN(resolved.getTime())) {
      toast('Enter a valid resolved time.', { type: 'error' });
      return;
    }

    setSavingReaction(true);

    try {
      const symptoms = symptomsText
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 12);

      const res = await fetch('/api/allergy-reactions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          occurredAtISO: occurred.toISOString(),
          suspectedTrigger: trigger,
          symptoms,
          severity: reactionSeverity,
          medsTaken: medsTaken.trim() || null,
          notes: reactionNotes.trim() || null,
          resolvedAtISO: resolved ? resolved.toISOString() : null,
        }),
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok || payload?.ok === false) {
        throw new Error(payload?.message || payload?.error || `Could not add reaction (${res.status})`);
      }

      const row = normaliseReaction(payload?.row ?? payload?.item ?? payload);
      if (row) {
        setReactions((prev) => [row, ...prev.filter((item) => item.id !== row.id)]);
      } else {
        await load();
      }

      setSuspectedTrigger('');
      setReactionSeverity('mild');
      setSymptomsText('');
      setMedsTaken('');
      setReactionNotes('');
      setResolvedAtISO('');
      setOccurredAtISO(toInputDateTime());
      toast('Reaction logged.', { type: 'success' });
    } catch (err: any) {
      toast(err?.message || 'Could not log reaction.', { type: 'error' });
    } finally {
      setSavingReaction(false);
    }
  }

  async function deleteReaction(item: ReactionLogItem) {
    if (!window.confirm('Delete this reaction log entry?')) return;

    try {
      const res = await fetch('/api/allergy-reactions', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ id: item.id }),
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok || payload?.ok === false) {
        throw new Error(payload?.message || payload?.error || `Could not delete reaction (${res.status})`);
      }

      setReactions((prev) => prev.filter((row) => row.id !== item.id));
      toast('Reaction removed.', { type: 'success' });
    } catch (err: any) {
      toast(err?.message || 'Could not delete reaction.', { type: 'error' });
    }
  }

  function exportAllergyJson() {
    const payload = {
      exportedAt: new Date().toISOString(),
      allergies,
      reactionLog: reactions,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `ambulant_allergy_record_${Date.now()}.json`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  const topTriggers = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of reactions) {
      const key = row.suspectedTrigger.trim().toLowerCase();
      if (!key) continue;
      counts.set(key, (counts.get(key) || 0) + 1);
    }

    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));
  }, [reactions]);

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Active allergies" value={stats.active} note="Used for safety checks." tone={stats.active ? 'cyan' : 'emerald'} />
        <MetricCard label="Severe active" value={stats.severeActive} note="Highest priority warnings." tone={stats.severeActive ? 'rose' : 'slate'} />
        <MetricCard label="Reaction logs" value={stats.reactions30d} note="Logged in the last 30 days." tone={stats.reactions30d ? 'amber' : 'slate'} />
        <MetricCard label="Resolved" value={stats.resolved} note="Kept for clinical history." />
      </section>

      <section className="rounded-[30px] border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-5 shadow-sm">
        <div className="flex gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-amber-100 text-amber-800">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-black text-amber-950">Safety note</div>
            <p className="mt-1 text-sm leading-6 text-amber-900">
              Keep known medicine, food, and environmental allergies accurate. If breathing difficulty, facial/tongue swelling, collapse, or severe wheeze occurs, seek urgent medical help immediately.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-[30px] border border-white/70 bg-white/90 p-4 shadow-[0_18px_55px_rgba(15,23,42,0.06)] backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
            {[
              ['profile', 'Allergy profile'],
              ['reactions', 'Reaction log'],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id as 'profile' | 'reactions')}
                className={cx(
                  'rounded-xl px-4 py-2 text-sm font-black transition',
                  tab === id ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-900',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Refresh
            </button>
            <button
              type="button"
              onClick={exportAllergyJson}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              <FileDown className="h-4 w-4" />
              Export JSON
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto_auto]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={tab === 'profile' ? 'Search substance, reaction, severity...' : 'Search trigger, symptoms, medication, notes...'}
              className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm outline-none transition focus:border-slate-300 focus:ring-4 focus:ring-slate-900/5"
            />
          </label>

          {tab === 'profile' ? (
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as any)}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none"
            >
              <option value="all">All statuses</option>
              <option value="Active">Active only</option>
              <option value="Resolved">Resolved only</option>
            </select>
          ) : null}

          <select
            value={severityFilter}
            onChange={(event) => setSeverityFilter(event.target.value as any)}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none"
          >
            <option value="all">All severities</option>
            {tab === 'profile' ? (
              <>
                <option value="Mild">Mild</option>
                <option value="Moderate">Moderate</option>
                <option value="Severe">Severe</option>
              </>
            ) : (
              <>
                <option value="mild">Mild</option>
                <option value="moderate">Moderate</option>
                <option value="severe">Severe</option>
              </>
            )}
          </select>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
          {error}
        </div>
      ) : null}

      {tab === 'profile' ? (
        <section className="grid gap-5 xl:grid-cols-[0.95fr_1.35fr]">
          <div className="rounded-[30px] border border-white/70 bg-white/90 p-5 shadow-[0_18px_55px_rgba(15,23,42,0.06)]">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-cyan-50 text-cyan-700">
                <Plus className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-950">Add allergy</h2>
                <p className="text-sm text-slate-500">Record known allergies, intolerances, or sensitivities.</p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <label className="block">
                <div className="mb-1.5 text-xs font-black uppercase tracking-[0.14em] text-slate-400">Substance</div>
                <input
                  value={substance}
                  onChange={(event) => setSubstance(event.target.value)}
                  placeholder="e.g. Penicillin, peanuts, latex"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-cyan-500/10"
                />
              </label>

              <label className="block">
                <div className="mb-1.5 text-xs font-black uppercase tracking-[0.14em] text-slate-400">Reaction</div>
                <input
                  value={reaction}
                  onChange={(event) => setReaction(event.target.value)}
                  placeholder="e.g. Rash, swelling, wheeze"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-cyan-500/10"
                />
              </label>

              <label className="block">
                <div className="mb-1.5 text-xs font-black uppercase tracking-[0.14em] text-slate-400">Severity</div>
                <select
                  value={severity}
                  onChange={(event) => setSeverity(event.target.value as AllergySeverity)}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-cyan-500/10"
                >
                  <option value="Mild">Mild</option>
                  <option value="Moderate">Moderate</option>
                  <option value="Severe">Severe</option>
                </select>
              </label>

              <label className="block">
                <div className="mb-1.5 text-xs font-black uppercase tracking-[0.14em] text-slate-400">Notes optional</div>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Context, previous treatment, clinician advice..."
                  className="min-h-[92px] w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-cyan-500/10"
                />
              </label>

              <button
                type="button"
                onClick={addAllergy}
                disabled={savingAllergy}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {savingAllergy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Save allergy
              </button>
            </div>
          </div>

          <div className="rounded-[30px] border border-white/70 bg-white/90 p-5 shadow-[0_18px_55px_rgba(15,23,42,0.06)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-slate-950">Known allergy profile</h2>
                <p className="mt-1 text-sm text-slate-500">Active items should be considered by clinicians, eRx checks, and care workflows.</p>
              </div>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-black text-slate-500">
                {filteredAllergies.length} shown
              </span>
            </div>

            <div className="mt-5 space-y-3">
              {loading ? (
                <div className="space-y-3">
                  {[0, 1, 2].map((item) => (
                    <div key={item} className="h-24 animate-pulse rounded-3xl bg-slate-100" />
                  ))}
                </div>
              ) : filteredAllergies.length ? (
                filteredAllergies.map((item) => (
                  <article key={item.id} className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={cx('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-black', severityClasses(item.severity))}>
                            <SeverityIcon severity={item.severity} />
                            {item.severity}
                          </span>
                          <span className={cx('rounded-full border px-2.5 py-1 text-xs font-black', statusClasses(item.status))}>
                            {item.status}
                          </span>
                        </div>
                        <h3 className="mt-3 text-lg font-black text-slate-950">{item.substance}</h3>
                        <p className="mt-1 text-sm leading-6 text-slate-600">{item.reaction || 'Reaction not recorded'}</p>
                        <div className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400">
                          <Clock3 className="h-3.5 w-3.5" />
                          Noted {safeDate(item.notedAt)}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => void updateAllergyStatus(item, item.status === 'Active' ? 'Resolved' : 'Active')}
                        className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50"
                      >
                        Mark {item.status === 'Active' ? 'resolved' : 'active'}
                      </button>
                    </div>
                  </article>
                ))
              ) : (
                <EmptyPanel
                  title="No allergies match this view"
                  body="Add known allergies or adjust the filters. A clear empty state is safer than showing sample clinical data."
                />
              )}
            </div>
          </div>
        </section>
      ) : (
        <section className="grid gap-5 xl:grid-cols-[0.95fr_1.35fr]">
          <div className="rounded-[30px] border border-white/70 bg-white/90 p-5 shadow-[0_18px_55px_rgba(15,23,42,0.06)]">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-amber-50 text-amber-700">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-950">Log a reaction</h2>
                <p className="text-sm text-slate-500">Record incidents so patterns can be reviewed clinically.</p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <label className="block">
                <div className="mb-1.5 text-xs font-black uppercase tracking-[0.14em] text-slate-400">When it happened</div>
                <input
                  type="datetime-local"
                  value={occurredAtISO}
                  onChange={(event) => setOccurredAtISO(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-amber-500/10"
                />
              </label>

              <label className="block">
                <div className="mb-1.5 text-xs font-black uppercase tracking-[0.14em] text-slate-400">Suspected trigger</div>
                <input
                  value={suspectedTrigger}
                  onChange={(event) => setSuspectedTrigger(event.target.value)}
                  placeholder="e.g. peanuts, penicillin, pollen"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-amber-500/10"
                />
              </label>

              <label className="block">
                <div className="mb-1.5 text-xs font-black uppercase tracking-[0.14em] text-slate-400">Severity</div>
                <select
                  value={reactionSeverity}
                  onChange={(event) => setReactionSeverity(event.target.value as ReactionSeverity)}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-amber-500/10"
                >
                  <option value="mild">Mild</option>
                  <option value="moderate">Moderate</option>
                  <option value="severe">Severe</option>
                </select>
              </label>

              <label className="block">
                <div className="mb-1.5 text-xs font-black uppercase tracking-[0.14em] text-slate-400">Symptoms</div>
                <input
                  value={symptomsText}
                  onChange={(event) => setSymptomsText(event.target.value)}
                  placeholder="Comma-separated: rash, itch, wheeze"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-amber-500/10"
                />
              </label>

              <label className="block">
                <div className="mb-1.5 text-xs font-black uppercase tracking-[0.14em] text-slate-400">Medication taken optional</div>
                <input
                  value={medsTaken}
                  onChange={(event) => setMedsTaken(event.target.value)}
                  placeholder="e.g. antihistamine, inhaler"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-amber-500/10"
                />
              </label>

              <label className="block">
                <div className="mb-1.5 text-xs font-black uppercase tracking-[0.14em] text-slate-400">Resolved optional</div>
                <input
                  type="datetime-local"
                  value={resolvedAtISO}
                  onChange={(event) => setResolvedAtISO(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-amber-500/10"
                />
              </label>

              <label className="block">
                <div className="mb-1.5 text-xs font-black uppercase tracking-[0.14em] text-slate-400">Notes optional</div>
                <textarea
                  value={reactionNotes}
                  onChange={(event) => setReactionNotes(event.target.value)}
                  placeholder="Exposure amount, what helped, how long it lasted..."
                  className="min-h-[92px] w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-amber-500/10"
                />
              </label>

              <button
                type="button"
                onClick={addReaction}
                disabled={savingReaction}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {savingReaction ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Save reaction log
              </button>
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-[30px] border border-white/70 bg-white/90 p-5 shadow-[0_18px_55px_rgba(15,23,42,0.06)]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black text-slate-950">Reaction trends</h2>
                  <p className="mt-1 text-sm text-slate-500">Pulled from saved reaction logs, not browser-only storage.</p>
                </div>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-black text-slate-500">
                  {filteredReactions.length} shown
                </span>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {(['mild', 'moderate', 'severe'] as ReactionSeverity[]).map((item) => (
                  <div key={item} className={cx('rounded-2xl border p-4', severityClasses(item))}>
                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em]">
                      <SeverityIcon severity={item} />
                      {item}
                    </div>
                    <div className="mt-2 text-2xl font-black">
                      {reactions.filter((row) => row.severity === item).length}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-black text-slate-900">Top suspected triggers</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {topTriggers.length ? (
                    topTriggers.map((item) => (
                      <span key={item.name} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700">
                        {item.name} <span className="text-slate-400">×{item.count}</span>
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-slate-500">No patterns yet.</span>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-[30px] border border-white/70 bg-white/90 p-5 shadow-[0_18px_55px_rgba(15,23,42,0.06)]">
              <h2 className="text-lg font-black text-slate-950">Saved reaction log</h2>

              <div className="mt-5 space-y-3">
                {loading ? (
                  <div className="space-y-3">
                    {[0, 1, 2].map((item) => (
                      <div key={item} className="h-24 animate-pulse rounded-3xl bg-slate-100" />
                    ))}
                  </div>
                ) : filteredReactions.length ? (
                  filteredReactions.map((item) => (
                    <article key={item.id} className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={cx('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-black', severityClasses(item.severity))}>
                              <SeverityIcon severity={item.severity} />
                              {item.severity}
                            </span>
                            <span className="text-xs font-semibold text-slate-400">{safeDateTime(item.occurredAtISO)}</span>
                          </div>

                          <h3 className="mt-3 text-lg font-black text-slate-950">{item.suspectedTrigger}</h3>
                          {item.symptoms.length ? (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {item.symptoms.map((symptom) => (
                                <span key={symptom} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                                  {symptom}
                                </span>
                              ))}
                            </div>
                          ) : null}

                          {item.medsTaken || item.notes || item.resolvedAtISO ? (
                            <div className="mt-3 space-y-1 text-sm leading-6 text-slate-600">
                              {item.medsTaken ? <div><span className="font-bold text-slate-800">Medication:</span> {item.medsTaken}</div> : null}
                              {item.resolvedAtISO ? <div><span className="font-bold text-slate-800">Resolved:</span> {safeDateTime(item.resolvedAtISO)}</div> : null}
                              {item.notes ? <div>{item.notes}</div> : null}
                            </div>
                          ) : null}
                        </div>

                        <button
                          type="button"
                          onClick={() => void deleteReaction(item)}
                          className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-black text-rose-700 hover:bg-rose-100"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      </div>
                    </article>
                  ))
                ) : (
                  <EmptyPanel
                    title="No reaction logs match this view"
                    body="Saved reaction logs will appear here once you record them."
                  />
                )}
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
