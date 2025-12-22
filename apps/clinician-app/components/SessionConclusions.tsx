// apps/clinician-app/components/SessionConclusions.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Card, Tabs, Collapse } from '@/components/ui';
import { CollapseBtn } from '@/components/ui/CollapseBtn';
import dynamic from 'next/dynamic';

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

type RightTab = 'end' | 'follow' | 'ref' | 'notes';

type Draft = {
  synopsis: string;
  dxQuery: string; // raw text in input
  dxCode: string;  // selected code (e.g. "J20.9")
  plan: string;
  notes: string;
};

type LocalLabRow = { test: string; priority: '' | 'Routine' | 'Urgent' | 'Stat'; specimen: string; icd: string; instructions?: string };

/* Lazy-import shared MedicalDocs so Notes uses the same engine as old “Docs” */
const MedicalDocs = dynamic(() => import('./MedicalDocs'), { ssr: false });

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

// ----------------- Component: FollowupSlotPicker -----------------
function FollowupSlotPicker({
  clinicianId,
  encounterId,
  slotMinutes = 15,
  onAction,
}: {
  clinicianId: string;
  encounterId?: string;
  slotMinutes?: number;
  /**
   * Called when clinician chooses an action on a selected slot.
   * mode = 'confirm' → confirmed follow-up
   * mode = 'recommend' → 24h hold recommendation
   */
  onAction?: (
    mode: 'confirm' | 'recommend',
    slot: { start: string; end: string }
  ) => Promise<void> | void;
}) {
  const [busy, setBusy] = useState(false);
  type Slot = { start: string; end: string; status?: string; source?: 'live' | 'mock' };
  const [slots, setSlots] = useState<Record<string, Slot[]>>({});
  const [slotsSource, setSlotsSource] = useState<'live' | 'mock' | 'none'>('none');
  const [sel, setSel] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  // Labs collapsible state & live/mock switch
  const [labsOpen, setLabsOpen] = useState(true);
  type Lab = { id: string; name: string; orderedAt: string; etaDays: number; source?: 'live' | 'mock' };
  const [labs, setLabs] = useState<Lab[]>([]);
  const [labsSource, setLabsSource] = useState<'live' | 'mock' | 'none'>('none');

  // Load labs from encounter eRx (fallback to mock)
  useEffect(() => {
    let cancelled = false;

    async function loadLabs() {
      // Try live from encounter → eRx
      if (encounterId) {
        try {
          const res = await fetch(`/api/encounters/${encodeURIComponent(encounterId)}/erx`, { cache: 'no-store' });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const js = await res.json();
          const rawLabs: any[] = Array.isArray((js as any)?.labs)
            ? (js as any).labs
            : Array.isArray((js as any)?.labTests)
            ? (js as any).labTests
            : Array.isArray((js as any)?.items)
            ? (js as any).items.filter((it: any) => (it.type || it.kind) === 'lab')
            : [];

          const todayISO = new Date().toISOString();
          const mapped: Lab[] = rawLabs.map((l: any, idx: number) => {
            const ordered = l.orderedAt || l.orderedOn || l.createdAt || todayISO;
            const eta =
              typeof l.etaDays === 'number'
                ? l.etaDays
                : typeof l.turnaroundDays === 'number'
                ? l.turnaroundDays
                : 3;
            return {
              id: String(l.id ?? l.code ?? `lab-${idx}`),
              name: l.name || l.test || l.display || 'Lab test',
              orderedAt: ordered,
              etaDays: eta,
              source: 'live',
            };
          });

          if (!cancelled && mapped.length) {
            setLabs(mapped);
            setLabsSource('live');
            return;
          }
        } catch (err) {
          console.warn('[FollowupSlotPicker] live labs load failed, falling back to mock', err);
        }
      }

      // Fallback: mock labs
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const isoToday = today.toISOString();
      const mock: Lab[] = [
        { id: 'lab-1', name: 'CBC',           orderedAt: isoToday, etaDays: 2, source: 'mock' },
        { id: 'lab-2', name: 'CRP',           orderedAt: isoToday, etaDays: 3, source: 'mock' },
        { id: 'lab-3', name: 'HbA1c',         orderedAt: isoToday, etaDays: 5, source: 'mock' },
        { id: 'lab-4', name: 'Lipid Panel',   orderedAt: isoToday, etaDays: 4, source: 'mock' },
        { id: 'lab-5', name: 'Thyroid Panel', orderedAt: isoToday, etaDays: 6, source: 'mock' },
      ];
      if (!cancelled) {
        setLabs(mock);
        setLabsSource('mock');
      }
    }

    loadLabs();
    return () => {
      cancelled = true;
    };
  }, [encounterId]);

  const labsWithEta = useMemo(() => {
    return labs.map(l => {
      const d = new Date(l.orderedAt);
      d.setDate(d.getDate() + (l.etaDays || 0));
      return { ...l, etaAt: d };
    });
  }, [labs]);

  // Load clinician calendar (live → fallback to mock)
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setBusy(true);
      try {
        const d0 = new Date();
        d0.setHours(0, 0, 0, 0);
        const dEnd = new Date(d0);
        dEnd.setDate(dEnd.getDate() + 13);
        const from = d0.toISOString().slice(0, 10);
        const to = dEnd.toISOString().slice(0, 10);

        const url = clinicianId
          ? `/api/clinicians/${encodeURIComponent(clinicianId)}/slots?from=${from}&to=${to}`
          : `/api/clinicians/slots?from=${from}&to=${to}`;

        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const js = await res.json();
        const raw: any[] = Array.isArray(js)
          ? js
          : Array.isArray((js as any)?.slots)
          ? (js as any).slots
          : Array.isArray((js as any)?.items)
          ? (js as any).items
          : [];

        const out: Record<string, Slot[]> = {};
        const durMs = (slotMinutes || 15) * 60 * 1000;

        raw.forEach((r: any) => {
          const startISO = r.start || r.startTime || r.begin;
          if (!startISO) return;
          const s = new Date(startISO);
          const eISO = r.end || r.endTime || r.finish || new Date(s.getTime() + durMs).toISOString();
          const dayKey = s.toISOString().slice(0, 10);
          if (!out[dayKey]) out[dayKey] = [];
          out[dayKey].push({
            start: s.toISOString(),
            end: eISO,
            status: r.status || r.state || 'free',
            source: 'live',
          });
        });

        if (!cancelled && Object.keys(out).length) {
          setSlots(out);
          setSlotsSource('live');
          return;
        }

        throw new Error('no slots');
      } catch (err) {
        console.warn('[FollowupSlotPicker] live slots fetch failed, falling back to mock', err);
        if (cancelled) return;

        const out: Record<string, Slot[]> = {};
        const d0 = new Date();
        d0.setHours(0, 0, 0, 0);
        const durMs = (slotMinutes || 15) * 60 * 1000;

        for (let i = 0; i < 14; i++) {
          const d = new Date(d0);
          d.setDate(d0.getDate() + i);
          const key = d.toISOString().slice(0, 10);
          if (d.getDay() === 0) {
            out[key] = [];
            continue;
          }
          const mk = (h: number): Slot => {
            const s = new Date(d);
            s.setHours(h, 0, 0, 0);
            const e = new Date(s.getTime() + durMs);
            return { start: s.toISOString(), end: e.toISOString(), status: 'free', source: 'mock' };
          };
          out[key] = [mk(9), mk(14)];
        }

        setSlots(out);
        setSlotsSource('mock');
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [clinicianId, slotMinutes]);

  const days = useMemo(() => {
    const d0 = new Date();
    d0.setHours(0, 0, 0, 0);
    return Array.from({ length: 14 }).map((_, i) => {
      const d = new Date(d0);
      d.setDate(d0.getDate() + i);
      return d;
    });
  }, []);

  const runAction = async (mode: 'confirm' | 'recommend') => {
    if (!onAction || !sel || actionBusy) return;
    const [start, end] = sel.split('|');
    if (!start || !end) return;
    setActionBusy(true);
    try {
      await onAction(mode, { start, end });
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Labs panel */}
      <div className="rounded border p-3 bg-white">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">
            Upcoming Lab Tests{' '}
            {labsSource === 'live' ? '(from eRx)' : labsSource === 'mock' ? '(demo fallback)' : ''}
          </div>
          <CollapseBtn open={labsOpen} onClick={() => setLabsOpen(v => !v)} />
        </div>
        <Collapse open={labsOpen}>
          {labsWithEta.length ? (
            <>
              <div className="text-xs text-gray-600 my-2">
                FYI: The <b>longest ETA</b> below is{' '}
                {labsWithEta.reduce((m, l) => (l.etaAt > m ? l.etaAt : m), labsWithEta[0].etaAt).toLocaleDateString()}.
              </div>
              <ul className="divide-y text-sm">
                {labsWithEta.map(l => (
                  <li key={l.id} className="py-1 flex items-center justify-between">
                    <div>
                      <div className="font-medium">{l.name}</div>
                      <div className="text-[11px] text-gray-500">
                        Ordered: {new Date(l.orderedAt).toLocaleDateString()} · ETA: {l.etaDays} day
                        {l.etaDays !== 1 ? 's' : ''}
                      </div>
                    </div>
                    <div className="text-xs px-2 py-0.5 rounded border bg-white">
                      ETA Date: <b>{l.etaAt.toLocaleDateString()}</b>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div className="text-xs text-gray-500 mt-2">
              No lab tests linked to this encounter yet.
            </div>
          )}
        </Collapse>
      </div>

      {/* Calendar */}
      <div className="rounded border p-3">
        <div className="text-sm font-medium mb-1">Clinician Calendar</div>
        <div className="text-[11px] text-gray-500 mb-2">
          {slotsSource === 'live'
            ? 'Showing your live calendar (fallbacks to demo data if unavailable).'
            : slotsSource === 'mock'
            ? 'Using demo calendar slots (no live calendar connected).'
            : 'Loading calendar...'}
        </div>
        {busy ? (
          <div className="text-sm text-gray-600">Loading…</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-7 gap-2 text-xs">
            {days.map((d) => {
              const key = d.toISOString().slice(0, 10);
              const ds = slots[key] || [];
              return (
                <div key={key} className="border rounded p-2">
                  <div className="font-medium mb-1">
                    {d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                  </div>
                  <div className="flex flex-col gap-1">
                    {ds.length === 0 ? (
                      <span className="text-gray-400">—</span>
                    ) : (
                      ds.map((s, i) => {
                        const t = new Date(s.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        const id = `${s.start}|${s.end}`;
                        const active = sel === id;
                        const status = (s.status || 'free').toString().toLowerCase();
                        const isBusy =
                          status.startsWith('busy') ||
                          status.startsWith('taken') ||
                          status.startsWith('booked') ||
                          status === 'occupied';

                        return (
                          <button
                            key={i}
                            type="button"
                            onClick={() => {
                              if (isBusy) return;
                              setSel(id);
                            }}
                            className={[
                              'border rounded px-2 py-1 text-left',
                              isBusy ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'hover:bg-gray-50',
                              active && !isBusy ? 'bg-gray-900 text-white hover:bg-gray-900' : '',
                            ].join(' ')}
                          >
                            {t}{isBusy ? ' (busy)' : ''}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <button
          disabled={!sel || actionBusy}
          className="px-3 py-1.5 rounded border border-blue-200 bg-blue-50 text-blue-900 hover:bg-blue-100 disabled:opacity-50 text-sm"
          onClick={() => runAction('recommend')}
        >
          Recommend Follow-up (24h hold)
        </button>
        <button
          disabled={!sel || actionBusy}
          className="px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 text-sm"
          onClick={() => runAction('confirm')}
        >
          Confirm Follow-up
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main SessionConclusions component                                  */
/* ------------------------------------------------------------------ */

export default function SessionConclusions({
  clinicianId,
  clinicianName, // NEW optional, for nicer docs
  encounterId,
  apptStartISO,
  slotMinutes = 15,
  onEnd,
  referralSlot,

  /** NEW: pass patient identity so Medical Notes can attach PDFs */
  patientId,
  patientName,
  clinicName,
  clinicLogoUrl,
  clinicAddress,
}: {
  clinicianId: string;
  clinicianName?: string;
  encounterId?: string;
  apptStartISO?: string;
  slotMinutes?: number;
  onEnd?: () => void;
  referralSlot?: React.ReactNode;

  patientId?: string;
  patientName?: string;
  clinicName?: string;
  clinicLogoUrl?: string;
  clinicAddress?: string;
}) {
  const [tab, setTab] = useState<RightTab>('end');

  // countdown context (elapsed + remaining)
  const appointment = useMemo(() => {
    const start = apptStartISO ? new Date(apptStartISO) : new Date();
    const end = new Date(start.getTime() + slotMinutes * 60 * 1000);
    return {
      id: 'appt-local',
      start: start.toISOString(),
      end: end.toISOString(),
      patient: { name: patientName || '—' },
    } as any;
  }, [apptStartISO, slotMinutes, patientName]);

  const [elapsed, setElapsed] = useState(0);
  const [remaining, setRemaining] = useState(0);

  const totalMs = useMemo(() => {
    if (!appointment?.start || !appointment?.end) return slotMinutes * 60 * 1000;
    const t0 = Date.parse(appointment.start);
    const t1 = Date.parse(appointment.end);
    const delta = t1 - t0;
    return delta > 0 ? delta : slotMinutes * 60 * 1000;
  }, [appointment?.start, appointment?.end, slotMinutes]);

  useEffect(() => {
    if (!appointment?.start || !appointment?.end) return;
    const t0 = Date.parse(appointment.start);
    const tick = () => {
      const now = Date.now();
      setElapsed(now - t0);
      setRemaining(t0 + totalMs - now);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [appointment?.start, totalMs]);

  const safeElapsed = Math.max(0, elapsed);
  const safeRemaining = Math.max(0, remaining);
  const progress = Math.min(1, Math.max(0, safeElapsed / totalMs));

  // autosaved draft
  const storageKey = useMemo(() => {
    const id = (encounterId && encounterId.trim()) || `ad-hoc-${clinicianId || 'clinician'}`;
    return `sfu-session-conclusions:${id}`;
  }, [clinicianId, encounterId]);

  const [draft, setDraft] = useState<Draft>({ synopsis: '', dxQuery: '', dxCode: '', plan: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Draft>;
        setDraft({
          synopsis: parsed.synopsis ?? '',
          dxQuery: parsed.dxQuery ?? '',
          dxCode: parsed.dxCode ?? '',
          plan: parsed.plan ?? '',
          notes: parsed.notes ?? '',
        });
      }
    } catch {
      // ignore
    }
  }, [storageKey]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(draft));
        setSavedAt(Date.now());
      } catch {
        // ignore
      }
    }, 500);
    return () => window.clearTimeout(id);
  }, [draft, storageKey]);

  const handleSaveNow = () => {
    setSaving(true);
    try {
      localStorage.setItem(storageKey, JSON.stringify(draft));
      setSavedAt(Date.now());
      // NOTE: this is where you could also POST/PUT to /api/encounters/:id/summary
    } catch {
      // ignore
    }
    setSaving(false);
  };

  /**
   * Finalizes the encounter on the server AND auto-submits a claim to the payer.
   * Used by:
   *  - End / Save Session
   *  - Book Follow-up (confirm / recommend)
   *  - (Later) Referral “Prefer referral, close session & send claim”
   */
  const finalizeEncounterAndClaim = async (ctx?: {
    mode?: 'end' | 'followup-confirm' | 'followup-recommend' | 'referral';
    followupId?: string;
    slot?: { start: string; end: string };
  }) => {
    // Always persist to localStorage one last time
    try {
      localStorage.setItem(storageKey, JSON.stringify(draft));
      setSavedAt(Date.now());
    } catch {
      // ignore
    }

    if (encounterId) {
      const summaryPayload = {
        encounterId,
        clinicianId,
        patientId,
        patientName,
        synopsis: draft.synopsis,
        diagnosisText: draft.dxQuery,
        diagnosisCode: draft.dxCode || undefined,
        plan: draft.plan,
        notes: draft.notes,
        startedAt: appointment.start,
        endedAt: new Date().toISOString(),
        elapsedMs: safeElapsed,
      };

      // 1) Mark encounter ended / discharged
      try {
        await fetch(`/api/encounters/${encodeURIComponent(encounterId)}/end`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(summaryPayload),
        });
      } catch (err) {
        console.warn('[SessionConclusions] end-session POST failed', err);
      }

      // 2) Auto-submit claim to payer for this encounter
      try {
        const claimPayload: any = {
          encounterId,
          clinicianId,
          patientId,
          patientName,
          diagnosisText: draft.dxQuery || undefined,
          diagnosisCode: draft.dxCode || undefined,
          mode: ctx?.mode || 'end',
        };
        if (ctx?.followupId) claimPayload.followupId = ctx.followupId;
        if (ctx?.slot) claimPayload.followupSlot = ctx.slot;

        await fetch('/api/claims/auto-submit', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(claimPayload),
        });
      } catch (err) {
        console.warn('[SessionConclusions] auto-submit claim failed', err);
      }
    }

    // Let parent know the session has ended (for toasts, audit, etc.)
    onEnd?.();
  };

  const handleEndSession = async () => {
    await finalizeEncounterAndClaim({ mode: 'end' });
    alert('Session concluded. Encounter closed and claim submitted to the payer.');
  };

  const handleFollowupAction = async (
    mode: 'confirm' | 'recommend',
    slot: { start: string; end: string }
  ) => {
    if (!encounterId) {
      alert('Cannot create follow-up: no encounterId found. Please try again from the appointments screen.');
      return;
    }

    try {
      const payload: any = {
        encounterId,
        clinicianId,
        patientId,
        start: slot.start,
        end: slot.end,
        confirmed: mode === 'confirm',
      };
      if (mode === 'recommend') {
        // 24h hold
        payload.holdMinutes = 24 * 60;
      }

      const res = await fetch('/api/followups', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const js = await res.json().catch(() => null);
      const followupId = js?.id ?? js?.followupId;

      // Close encounter + auto-submit claim
      await finalizeEncounterAndClaim({
        mode: mode === 'confirm' ? 'followup-confirm' : 'followup-recommend',
        followupId,
        slot,
      });

      if (mode === 'confirm') {
        alert('Follow-up booked, encounter closed, and claim submitted to the payer.');
      } else {
        alert('Follow-up slot recommended (24h hold), encounter closed, and claim submitted to the payer.');
      }
    } catch (err) {
      console.error('[SessionConclusions] handleFollowupAction failed', err);
      alert('Failed to create follow-up or submit claim. Please try again or contact support.');
    }
  };

  // ---------------- simple ICD-10 input (free text allowed) ----------------
  const ICD10_SUGGESTIONS: string[] = [
    'J20.9 — Acute bronchitis, unspecified',
    'R50.9 — Fever, unspecified',
    'R05.9 — Cough, unspecified',
    'I10 — Essential (primary) hypertension',
    'E11.9 — Type 2 diabetes mellitus without complications',
  ];

  return (
    <Card title="Session & Conclusions" dense={false} gradient>
      <div className="mb-2">
        <Tabs
          active={tab}
          onChange={(k: RightTab) => setTab(k)}
          items={[
            { key: 'end', label: 'End / Save Session' },
            { key: 'follow', label: 'Book Follow-up' },
            { key: 'ref', label: 'Referral' },
            { key: 'notes', label: 'Medical Notes' },
          ]}
        />
      </div>

      {/* Tab: End / Save */}
      {tab === 'end' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-600">Timer</div>
          </div>

          <div className="grid md:grid-cols-2 gap-2">
            <div className="rounded border p-2">
              <div className="text-xs text-gray-500 mb-0.5">Elapsed</div>
              <div className="font-mono">{formatDuration(safeElapsed)}</div>
            </div>
            <div className="rounded border p-2">
              <div className="text-xs text-gray-500 mb-0.5">Remaining</div>
              <div className="font-mono">{formatDuration(safeRemaining)}</div>
            </div>
          </div>

          {/* Progress bar synced with timer */}
          <div className="mt-2">
            <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
              <span>Session progress</span>
              <span className="font-mono">
                {formatDuration(safeElapsed)} / {formatDuration(totalMs)}
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-gray-200 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-400 via-sky-500 to-indigo-500 transition-[width] duration-1000"
                style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }}
                aria-hidden="true"
              />
            </div>
            <div className="mt-1 text-[11px] text-gray-500">
              Remaining: <span className="font-mono">{formatDuration(safeRemaining)}</span>
            </div>
          </div>

          <div className="grid gap-3">
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Visit Synopsis</span>
              <textarea
                className="border rounded px-2 py-1 min-h-[80px]"
                value={draft.synopsis}
                onChange={(e) => setDraft(d => ({ ...d, synopsis: e.target.value }))}
                placeholder="Brief summary..."
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span className="font-medium">Diagnosis (ICD-10 — free text allowed)</span>
              <input
                className="w-full border rounded px-2 py-1"
                value={draft.dxQuery}
                onChange={(e) => setDraft(d => ({ ...d, dxQuery: e.target.value }))}
                list="icd10-suggest-simple"
                placeholder="Type ICD-10 or free text"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
              />
              <datalist id="icd10-suggest-simple">
                {ICD10_SUGGESTIONS.map(s => <option key={s} value={s} />)}
              </datalist>
            </label>

            <label className="grid gap-1 text-sm">
              <span className="font-medium">Treatment Plan / Recommendations</span>
              <textarea
                className="border rounded px-2 py-1 min-h-[100px]"
                value={draft.plan}
                onChange={(e) => setDraft(d => ({ ...d, plan: e.target.value }))}
                placeholder="Plan, medications, follow-up..."
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span className="font-medium">Additional Notes (optional)</span>
              <textarea
                className="border rounded px-2 py-1 min-h-[70px]"
                value={draft.notes}
                onChange={(e) => setDraft(d => ({ ...d, notes: e.target.value }))}
                placeholder="Extra context..."
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="text-xs text-gray-600">
              {savedAt ? `Saved ${new Date(savedAt).toLocaleTimeString()}` : 'Not saved yet'}
            </div>
            <div className="ml-auto flex gap-2">
              <button
                className="px-3 py-1.5 border rounded text-sm bg-white hover:bg-gray-50"
                onClick={handleSaveNow}
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Save Draft'}
              </button>
              <button
                className="px-3 py-1.5 border rounded text-sm bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-900"
                onClick={handleEndSession}
                title="Finalize, discharge, and auto-submit claim"
              >
                End Session / Discharge
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Follow-up */}
      {tab === 'follow' && (
        <FollowupSlotPicker
          clinicianId={clinicianId || ''}
          encounterId={encounterId}
          slotMinutes={slotMinutes}
          onAction={handleFollowupAction}
        />
      )}

      {/* Tab: Referral */}
      {tab === 'ref' && (referralSlot ?? <div className="p-4">Referral panel (not configured)</div>)}

      {/* Tab: Notes → embed shared MedicalDocs (Sick/Fitness only) */}
      {tab === 'notes' && (
        <div className="space-y-2">
          <div className="text-xs text-gray-500 mb-2">
            Use this to generate <b>Sick Notes</b> or <b>Fitness Certificates</b>. eRx lives in the <b>eRx</b> tab.
          </div>
          <MedicalDocs
            encounterId={encounterId}
            clinicianName={clinicianName || clinicianId}
            clinicianReg={undefined}
            clinicName={clinicName}
            clinicLogoUrl={clinicLogoUrl}
            clinicAddress={clinicAddress}
            patientId={patientId}
            patientName={patientName}
            hideErx
            defaultNoteType="sick"
            initialSessionVitals={[]}
            onGenerated={() => {}}
          />
        </div>
      )}
    </Card>
  );
}
