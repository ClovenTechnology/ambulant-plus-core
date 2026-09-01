// apps/clinician-app/components/SessionConclusions.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Card, Tabs, Collapse } from '@/components/ui';
import { CollapseBtn } from '@/components/ui/CollapseBtn';
import dynamic from 'next/dynamic';
import { useAutocomplete, icdSearch } from '@/src/hooks/useAutocomplete';
import type { ICD10Hit } from '@/src/hooks/useAutocomplete';

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

type RightTab = 'end' | 'follow' | 'ref' | 'notes';

type ConclusionDiagnosis = {
  id: string;
  code: string;
  text: string;
  kind: 'primary' | 'secondary' | 'differential';
  status: 'confirmed' | 'provisional' | 'differential';
};

type ConclusionDraft = {
  visitSynopsis: string;
  diagnoses: ConclusionDiagnosis[];
  disposition: string;
  carePlan: string;
  patientEducation: string;
  safetyNetting: string;
  referralNote: string;
  followUpNote: string;
  conclusionNote: string;
};

type LocalLabRow = { test: string; priority: '' | 'Routine' | 'Urgent' | 'Stat'; specimen: string; icd: string; instructions?: string };

type ClaimAutoSubmitOutcome =
  | 'not_applicable'
  | 'action_required'
  | 'draft_created'
  | 'ready_for_submission'
  | 'submitted';

type ClaimAutoSubmitResult = {
  ok?: boolean;
  outcome?: ClaimAutoSubmitOutcome;
  missingFields?: string[];
  claimNumber?: string | null;
  claimId?: string | null;
  error?: string;
  reason?: string;
  audit?: {
    externalSubmissionPerformed?: boolean;
  };
};

function formatClaimOutcomeMessage(result?: ClaimAutoSubmitResult | null): string {
  if (!result) return 'Claim package check completed.';

  const missing = Array.isArray(result.missingFields) && result.missingFields.length
    ? `: ${result.missingFields.join(', ')}`
    : '.';

  switch (result.outcome) {
    case 'not_applicable':
      return 'No medical-aid claim is required for this payer.';
    case 'action_required':
      return `Medical-aid claim draft created; action required${missing}`;
    case 'draft_created':
      return 'Medical-aid claim draft created for review.';
    case 'ready_for_submission':
      return result.claimNumber
        ? `Medical-aid claim package ${result.claimNumber} is ready for submission review.`
        : 'Medical-aid claim package is ready for submission review.';
    case 'submitted':
      return result.audit?.externalSubmissionPerformed
        ? 'Claim submitted to the payer.'
        : 'Claim package marked submitted internally; no external payer submission was confirmed.';
    default:
      return 'Claim package check completed.';
  }
}


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
  simulation = false,
  onAction,
}: {
  clinicianId: string;
  encounterId?: string;
  slotMinutes?: number;
  simulation?: boolean;
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
  type Lab = { id: string; name: string; orderedAt: string; etaDays: number | null; source?: 'live' | 'mock' };
  const [labs, setLabs] = useState<Lab[]>([]);
  const [labsSource, setLabsSource] = useState<'live' | 'mock' | 'none'>('none');

  // Load real encounter lab orders. Demo values are permitted only in simulation.
  useEffect(() => {
    let cancelled = false;

    async function loadLabs() {
      // Real consultations read live encounter orders. Simulation never touches production order state.
      if (!simulation && encounterId) {
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
                : null;
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
          console.warn('[FollowupSlotPicker] live labs load failed', err);
        }
      }

      if (cancelled) return;

      if (!simulation) {
        setLabs([]);
        setLabsSource('none');
        return;
      }

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
      setLabs(mock);
      setLabsSource('mock');
    }

    loadLabs();
    return () => {
      cancelled = true;
    };
  }, [encounterId, simulation]);

  const labsWithEta = useMemo(() => {
    return labs.map(l => {
      if (typeof l.etaDays !== 'number') return { ...l, etaAt: null as Date | null };
      const d = new Date(l.orderedAt);
      d.setDate(d.getDate() + l.etaDays);
      return { ...l, etaAt: d as Date | null };
    });
  }, [labs]);

  const knownLabEta = useMemo(
    () => labsWithEta.filter((l) => l.etaAt instanceof Date) as Array<(typeof labsWithEta)[number] & { etaAt: Date }>,
    [labsWithEta],
  );

  // Load the live clinician calendar. Demo slots are permitted only in simulation.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setBusy(true);
      try {
        if (simulation) {
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
          if (!cancelled) {
            setSlots(out);
            setSlotsSource('mock');
          }
          return;
        }

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
        console.warn('[FollowupSlotPicker] live slots fetch failed', err);
        if (cancelled) return;

        if (!simulation) {
          setSlots({});
          setSlotsSource('none');
          return;
        }

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
  }, [clinicianId, simulation, slotMinutes]);

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
              {knownLabEta.length ? (
                <div className="text-xs text-gray-600 my-2">
                  FYI: The <b>longest available ETA</b> below is{' '}
                  {knownLabEta.reduce((m, l) => (l.etaAt > m ? l.etaAt : m), knownLabEta[0].etaAt).toLocaleDateString()}.
                </div>
              ) : (
                <div className="text-xs text-gray-600 my-2">Turnaround estimate unavailable for the linked live lab orders.</div>
              )}
              <ul className="divide-y text-sm">
                {labsWithEta.map(l => (
                  <li key={l.id} className="py-1 flex items-center justify-between">
                    <div>
                      <div className="font-medium">{l.name}</div>
                      <div className="text-[11px] text-gray-500">
                        Ordered: {new Date(l.orderedAt).toLocaleDateString()} ·{' '}
                        {typeof l.etaDays === 'number' ? (<>ETA: {l.etaDays} day{l.etaDays !== 1 ? 's' : ''}</>) : 'Turnaround estimate unavailable'}
                      </div>
                    </div>
                    <div className="text-xs px-2 py-0.5 rounded border bg-white">
                      {l.etaAt ? <>ETA Date: <b>{l.etaAt.toLocaleDateString()}</b></> : 'ETA unavailable'}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div className="text-xs text-gray-500 mt-2">
              {simulation ? 'No lab tests linked to this simulation yet.' : 'No live lab orders linked to this encounter, or the live source is unavailable.'}
            </div>
          )}
        </Collapse>
      </div>

      {/* Calendar */}
      <div className="rounded border p-3">
        <div className="text-sm font-medium mb-1">Clinician Calendar</div>
        <div className="text-[11px] text-gray-500 mb-2">
          {slotsSource === 'live'
            ? 'Showing your live calendar.'
            : slotsSource === 'mock'
            ? 'Using simulation-only demo calendar slots.'
            : busy
            ? 'Loading live calendar...'
            : 'Live calendar unavailable. No demo availability is shown in a real consultation.'}
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
  clinicianName,
  encounterId,
  apptStartISO,
  slotMinutes = 15,
  onEnd,
  onReviewOrders,
  referralSlot,
  patientId,
  patientName,
  clinicName,
  clinicLogoUrl,
  clinicAddress,
  simulation = false,
  medicationDraftCount = 0,
  labDraftCount = 0,
}: {
  clinicianId: string;
  clinicianName?: string;
  encounterId?: string;
  apptStartISO?: string;
  slotMinutes?: number;
  onEnd?: () => void | Promise<void>;
  onReviewOrders?: () => void;
  referralSlot?: React.ReactNode;
  patientId?: string;
  patientName?: string;
  clinicName?: string;
  clinicLogoUrl?: string;
  clinicAddress?: string;
  simulation?: boolean;
  medicationDraftCount?: number;
  labDraftCount?: number;
}) {
  const [tab, setTab] = useState<RightTab>('end');

  const appointment = useMemo(() => {
    const start = apptStartISO ? new Date(apptStartISO) : new Date();
    const end = new Date(start.getTime() + slotMinutes * 60 * 1000);
    return { start: start.toISOString(), end: end.toISOString() };
  }, [apptStartISO, slotMinutes]);

  const [elapsed, setElapsed] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const totalMs = useMemo(() => {
    const t0 = Date.parse(appointment.start);
    const t1 = Date.parse(appointment.end);
    const delta = t1 - t0;
    return delta > 0 ? delta : slotMinutes * 60 * 1000;
  }, [appointment.start, appointment.end, slotMinutes]);

  useEffect(() => {
    const t0 = Date.parse(appointment.start);
    const tick = () => {
      const now = Date.now();
      setElapsed(now - t0);
      setRemaining(t0 + totalMs - now);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [appointment.start, totalMs]);

  const safeElapsed = Math.max(0, elapsed);
  const safeRemaining = Math.max(0, remaining);
  const progress = Math.min(1, Math.max(0, safeElapsed / totalMs));

  const emptyDraft: ConclusionDraft = useMemo(() => ({
    visitSynopsis: '', diagnoses: [], disposition: '', carePlan: '', patientEducation: '',
    safetyNetting: '', referralNote: '', followUpNote: '', conclusionNote: '',
  }), []);
  const [draft, setDraft] = useState<ConclusionDraft>(emptyDraft);
  const [draftHydrated, setDraftHydrated] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [closing, setClosing] = useState(false);
  const [endGuard, setEndGuard] = useState<{ medicationDraftCount: number; labDraftCount: number } | null>(null);

  const storageKey = useMemo(() => {
    const id = (encounterId && encounterId.trim()) || `ad-hoc-${clinicianId || 'clinician'}`;
    return `sfu-session-conclusions:${id}`;
  }, [clinicianId, encounterId]);

  // Full production ICD-10 catalogue; no hard-coded fallback list.
  const diagnosisAuto = useAutocomplete<ICD10Hit>(icdSearch);
  const [diagnosisOpen, setDiagnosisOpen] = useState(false);
  const [diagnosisActive, setDiagnosisActive] = useState(-1);
  const [diagnosisKind, setDiagnosisKind] = useState<ConclusionDiagnosis['kind']>('primary');
  const diagnosisOptions = diagnosisAuto.opts.map((hit) => ({
    code: hit.code,
    text: hit.title,
    label: `${hit.code} — ${hit.title}`,
  }));

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      let local: ConclusionDraft | null = null;
      try {
        const raw = localStorage.getItem(storageKey);
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<ConclusionDraft> & { synopsis?: string; dxQuery?: string; dxCode?: string; plan?: string; notes?: string };
          local = {
            ...emptyDraft,
            visitSynopsis: String(parsed.visitSynopsis ?? parsed.synopsis ?? ''),
            diagnoses: Array.isArray(parsed.diagnoses) ? parsed.diagnoses as ConclusionDiagnosis[] : (parsed.dxQuery || parsed.dxCode ? [{ id: 'legacy-1', code: String(parsed.dxCode || ''), text: String(parsed.dxQuery || ''), kind: 'primary', status: 'provisional' }] : []),
            disposition: String(parsed.disposition || ''),
            carePlan: String(parsed.carePlan ?? parsed.plan ?? ''),
            patientEducation: String(parsed.patientEducation || ''),
            safetyNetting: String(parsed.safetyNetting || ''),
            referralNote: String(parsed.referralNote || ''),
            followUpNote: String(parsed.followUpNote || ''),
            conclusionNote: String(parsed.conclusionNote ?? parsed.notes ?? ''),
          };
        }
      } catch {
        // local recovery cache is best effort only
      }

      if (!encounterId || simulation) {
        if (!cancelled && local) setDraft(local);
        if (!cancelled) setDraftHydrated(true);
        return;
      }

      try {
        const res = await fetch(`/api/encounters/${encodeURIComponent(encounterId)}/draft`, { cache: 'no-store', credentials: 'same-origin' });
        const json = await res.json().catch(() => null as any);
        if (!res.ok || !json?.ok) throw new Error(json?.error || `HTTP ${res.status}`);
        const server = json?.draft?.conclusions;
        if (!cancelled && server && typeof server === 'object') {
          setDraft({
            visitSynopsis: String(server.visitSynopsis || ''),
            diagnoses: Array.isArray(server.diagnoses) ? server.diagnoses.map((item: any, index: number) => ({
              id: String(item.id || `${item.code || 'dx'}-${index}`),
              code: String(item.code || ''),
              text: String(item.text || ''),
              kind: ['primary', 'secondary', 'differential'].includes(String(item.kind)) ? item.kind : index === 0 ? 'primary' : 'secondary',
              status: ['confirmed', 'provisional', 'differential'].includes(String(item.status)) ? item.status : 'provisional',
            })) : [],
            disposition: String(server.disposition || ''),
            carePlan: String(server.carePlan || ''),
            patientEducation: String(server.patientEducation || ''),
            safetyNetting: String(server.safetyNetting || ''),
            referralNote: String(server.referralNote || ''),
            followUpNote: String(server.followUpNote || ''),
            conclusionNote: String(server.conclusionNote || ''),
          });
        } else if (!cancelled && local) {
          setDraft(local);
        }
      } catch (error) {
        console.warn('[SessionConclusions] server draft hydration failed; local recovery remains available', error);
        if (!cancelled && local) setDraft(local);
      } finally {
        if (!cancelled) setDraftHydrated(true);
      }
    })();
    return () => { cancelled = true; };
  }, [encounterId, emptyDraft, simulation, storageKey]);

  useEffect(() => {
    if (!draftHydrated) return;
    try { localStorage.setItem(storageKey, JSON.stringify(draft)); } catch {}
    if (!encounterId || simulation) {
      setSaveState('saved');
      setSavedAt(Date.now());
      return;
    }
    setSaveState('saving');
    const id = window.setTimeout(() => {
      void fetch(`/api/encounters/${encodeURIComponent(encounterId)}/draft`, {
        method: 'PUT', headers: { 'content-type': 'application/json' }, credentials: 'same-origin',
        body: JSON.stringify({ mode: 'autosave', conclusions: draft }),
      }).then(async (res) => {
        const json = await res.json().catch(() => null as any);
        if (!res.ok || !json?.ok) throw new Error(json?.error || `HTTP ${res.status}`);
        setSaveState('saved');
        setSavedAt(Date.now());
      }).catch((error) => {
        console.warn('[SessionConclusions] autosave failed', error);
        setSaveState('error');
      });
    }, 1000);
    return () => window.clearTimeout(id);
  }, [draft, draftHydrated, encounterId, simulation, storageKey]);

  async function saveDraftNow() {
    try { localStorage.setItem(storageKey, JSON.stringify(draft)); } catch {}
    if (!encounterId || simulation) { setSaveState('saved'); setSavedAt(Date.now()); return true; }
    setSaveState('saving');
    try {
      const res = await fetch(`/api/encounters/${encodeURIComponent(encounterId)}/draft`, {
        method: 'PUT', headers: { 'content-type': 'application/json' }, credentials: 'same-origin',
        body: JSON.stringify({ mode: 'manual', conclusions: draft }),
      });
      const json = await res.json().catch(() => null as any);
      if (!res.ok || !json?.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      setSaveState('saved'); setSavedAt(Date.now()); return true;
    } catch (error) {
      console.warn('[SessionConclusions] manual save failed', error); setSaveState('error'); return false;
    }
  }

  function addDiagnosis(option: { code: string; text: string; label: string }) {
    if (!option.code) return;
    setDraft((current) => {
      if (current.diagnoses.some((dx) => dx.code.toLowerCase() === option.code.toLowerCase())) return current;
      const kind = current.diagnoses.length === 0 ? 'primary' : diagnosisKind === 'primary' ? 'secondary' : diagnosisKind;
      const next = [...current.diagnoses, {
        id: `${option.code}-${Date.now()}`,
        code: option.code,
        text: option.text,
        kind,
        status: kind === 'differential' ? 'differential' : 'confirmed',
      } as ConclusionDiagnosis];
      return { ...current, diagnoses: next };
    });
    diagnosisAuto.setQ('');
    setDiagnosisOpen(false);
    setDiagnosisActive(-1);
  }

  function updateDiagnosis(id: string, patch: Partial<ConclusionDiagnosis>) {
    setDraft((current) => ({ ...current, diagnoses: current.diagnoses.map((dx) => dx.id === id ? { ...dx, ...patch } : dx) }));
  }

  function removeDiagnosis(id: string) {
    setDraft((current) => ({ ...current, diagnoses: current.diagnoses.filter((dx) => dx.id !== id) }));
  }

  async function getOutstandingOrderDrafts() {
    if (simulation) return { medicationDraftCount, labDraftCount };
    if (!encounterId) return { medicationDraftCount: 0, labDraftCount: 0 };
    try {
      const res = await fetch(`/api/encounters/${encodeURIComponent(encounterId)}/erx`, { cache: 'no-store', credentials: 'same-origin' });
      const json = await res.json().catch(() => null as any);
      if (!res.ok || !json?.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      const medications = Array.isArray(json?.draft?.medications) ? json.draft.medications.length : 0;
      const labs = Array.isArray(json?.draft?.labs) ? json.draft.labs.length : 0;
      return { medicationDraftCount: medications, labDraftCount: labs };
    } catch (error) {
      console.warn('[SessionConclusions] order-draft pre-close check failed', error);
      // Fail closed: inability to verify outstanding orders requires review before closure.
      return { medicationDraftCount: -1, labDraftCount: -1 };
    }
  }

  async function finalizeEncounterAndClaim() {
    if (simulation) {
      setClosing(true);
      try {
        const saved = await saveDraftNow();
        if (!saved) throw new Error('simulation_conclusions_draft_save_failed');
        await onEnd?.();
        alert('Simulation consultation ended. Conclusions and Orders remained simulation-only; no production claim, eRx/lab issuance, follow-up booking, CarePort or MedReach workflow was invoked.');
        return { ok: true, outcome: 'not_applicable', reason: 'simulation_only' } as ClaimAutoSubmitResult;
      } finally {
        setClosing(false);
        setEndGuard(null);
      }
    }

    if (!encounterId) {
      await saveDraftNow();
      await onEnd?.();
      return null as ClaimAutoSubmitResult | null;
    }

    setClosing(true);
    try {
      const saved = await saveDraftNow();
      if (!saved) throw new Error('conclusions_draft_save_failed');
      const primary = draft.diagnoses.find((dx) => dx.kind === 'primary') || draft.diagnoses[0] || null;
      const payload = {
        encounterId, clinicianId, patientId, patientName,
        synopsis: draft.visitSynopsis,
        diagnosisText: primary?.text || undefined,
        diagnosisCode: primary?.code || undefined,
        diagnoses: draft.diagnoses,
        plan: draft.carePlan,
        notes: draft.conclusionNote,
        disposition: draft.disposition,
        safetyNetting: draft.safetyNetting,
        patientEducation: draft.patientEducation,
        referralNote: draft.referralNote,
        followUpNote: draft.followUpNote,
        startedAt: appointment.start,
        endedAt: new Date().toISOString(),
        elapsedMs: safeElapsed,
      };

      const endRes = await fetch(`/api/encounters/${encodeURIComponent(encounterId)}/end`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
      });
      const endJson = await endRes.json().catch(() => null as any);
      if (!endRes.ok || endJson?.ok === false) throw new Error(endJson?.error || `end_http_${endRes.status}`);

      let claimResult: ClaimAutoSubmitResult | null = null;
      try {
        const claimRes = await fetch('/api/claims/auto-submit', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ encounterId, clinicianId, patientId, patientName, diagnosisText: primary?.text || undefined, diagnosisCode: primary?.code || undefined, mode: 'end' }),
        });
        const claimJson = await claimRes.json().catch(() => null) as ClaimAutoSubmitResult | null;
        if (!claimRes.ok || claimJson?.ok === false) throw new Error(claimJson?.error || `claim_http_${claimRes.status}`);
        claimResult = claimJson;
      } catch (error) {
        console.warn('[SessionConclusions] claim package preparation failed after encounter closure', error);
      }

      await onEnd?.();
      alert(`Consultation ended. Unfinalized Orders, if retained, remain drafts and were not issued. ${formatClaimOutcomeMessage(claimResult)}`);
      return claimResult;
    } finally {
      setClosing(false);
      setEndGuard(null);
    }
  }

  async function requestEndSession() {
    const outstanding = await getOutstandingOrderDrafts();
    if (outstanding.medicationDraftCount !== 0 || outstanding.labDraftCount !== 0) {
      setEndGuard(outstanding);
      return;
    }
    await finalizeEncounterAndClaim();
  }

  const handleFollowupAction = async (mode: 'confirm' | 'recommend', slot: { start: string; end: string }) => {
    const statement = mode === 'confirm'
      ? `Follow-up selected for ${new Date(slot.start).toLocaleString()}.`
      : `Follow-up recommended for ${new Date(slot.start).toLocaleString()} with a 24-hour simulated hold.`;

    if (simulation) {
      setDraft((current) => ({ ...current, followUpNote: current.followUpNote ? `${current.followUpNote}\n\n${statement}` : statement }));
      alert(`${statement} Simulation only: no production follow-up booking or calendar hold was created. The consultation remains open until you explicitly end it.`);
      return;
    }

    if (!encounterId) {
      alert('Cannot create follow-up: no encounterId found.');
      return;
    }
    try {
      const payload: any = { encounterId, clinicianId, patientId, start: slot.start, end: slot.end, confirmed: mode === 'confirm' };
      if (mode === 'recommend') payload.holdMinutes = 24 * 60;
      const res = await fetch('/api/followups', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      const json = await res.json().catch(() => null as any);
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      const productionStatement = mode === 'confirm'
        ? `Follow-up booked for ${new Date(slot.start).toLocaleString()}.`
        : `Follow-up recommended for ${new Date(slot.start).toLocaleString()} with a 24-hour hold.`;
      setDraft((current) => ({ ...current, followUpNote: current.followUpNote ? `${current.followUpNote}\n\n${productionStatement}` : productionStatement }));
      alert(`${productionStatement} The consultation remains open until you explicitly end it.`);
    } catch (error) {
      console.error('[SessionConclusions] follow-up action failed', error);
      alert('Failed to create follow-up. The consultation remains open.');
    }
  };

  return (
    <Card title="Session & Conclusions" dense={false} gradient>
      <div className="mb-2">
        <Tabs
          active={tab}
          onChange={(key: RightTab) => setTab(key)}
          items={[
            { key: 'end', label: 'Conclusions / End' },
            { key: 'follow', label: 'Book Follow-up' },
            { key: 'ref', label: 'Referral' },
            { key: 'notes', label: 'Medical Notes' },
          ]}
        />
      </div>

      {tab === 'end' && (
        <div className="space-y-4">
          <div className="grid gap-2 md:grid-cols-2">
            <div className="rounded border p-2"><div className="text-xs text-gray-500">Elapsed</div><div className="font-mono">{formatDuration(safeElapsed)}</div></div>
            <div className="rounded border p-2"><div className="text-xs text-gray-500">Remaining</div><div className="font-mono">{formatDuration(safeRemaining)}</div></div>
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between text-xs text-gray-600"><span>Session progress</span><span className="font-mono">{formatDuration(safeElapsed)} / {formatDuration(totalMs)}</span></div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200"><div className="h-full bg-gradient-to-r from-emerald-400 via-sky-500 to-indigo-500 transition-[width] duration-1000" style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }} /></div>
          </div>

          <label className="grid gap-1 text-sm"><span className="font-medium">Visit Synopsis</span><textarea className="min-h-[80px] rounded border px-2 py-1" value={draft.visitSynopsis} onChange={(e) => setDraft((d) => ({ ...d, visitSynopsis: e.target.value }))} placeholder="Concise visit outcome and clinical summary…" /></label>

          <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div><div className="text-sm font-semibold text-slate-900">Final Diagnoses</div><div className="text-[11px] text-slate-500">Searches the full indexed ICD-10-CM catalogue. Add primary, secondary or differential diagnoses without duplicating symptom documentation.</div></div>
              <select className="rounded border bg-white px-2 py-1 text-xs" value={diagnosisKind} onChange={(e) => setDiagnosisKind(e.target.value as ConclusionDiagnosis['kind'])}><option value="primary">Primary</option><option value="secondary">Secondary</option><option value="differential">Differential</option></select>
            </div>
            <div className="relative">
              <input
                className="w-full rounded border px-2 py-2 text-sm"
                role="combobox" aria-expanded={diagnosisOpen} aria-controls="conclusions-icd10-listbox" aria-autocomplete="list"
                value={diagnosisAuto.q}
                onChange={(e) => { diagnosisAuto.setQ(e.target.value); setDiagnosisOpen(true); setDiagnosisActive(-1); }}
                onFocus={() => { if (diagnosisOptions.length) setDiagnosisOpen(true); }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') { e.preventDefault(); setDiagnosisOpen(true); setDiagnosisActive((a) => Math.min(diagnosisOptions.length - 1, a + 1)); }
                  else if (e.key === 'ArrowUp') { e.preventDefault(); setDiagnosisActive((a) => Math.max(0, a - 1)); }
                  else if (e.key === 'Enter' && diagnosisOpen && diagnosisActive >= 0 && diagnosisOptions[diagnosisActive]) { e.preventDefault(); addDiagnosis(diagnosisOptions[diagnosisActive]); }
                  else if (e.key === 'Escape') setDiagnosisOpen(false);
                }}
                onBlur={() => window.setTimeout(() => setDiagnosisOpen(false), 120)}
                placeholder="Type at least 2 characters to search ICD-10…"
                autoComplete="off"
              />
              {diagnosisOpen && diagnosisOptions.length > 0 ? (
                <ul id="conclusions-icd10-listbox" role="listbox" className="absolute z-40 mt-1 max-h-64 w-full overflow-auto rounded border bg-white shadow-lg">
                  {diagnosisOptions.map((option, index) => <li key={`${option.code}-${index}`}><button type="button" role="option" aria-selected={index === diagnosisActive} className={`w-full px-3 py-2 text-left text-sm ${index === diagnosisActive ? 'bg-blue-50' : 'hover:bg-slate-50'}`} onMouseDown={(e) => e.preventDefault()} onClick={() => addDiagnosis(option)}><span className="mr-2 font-mono text-xs">{option.code}</span>{option.text}</button></li>)}
                </ul>
              ) : null}
            </div>

            <div className="mt-3 space-y-2">
              {draft.diagnoses.length === 0 ? <div className="rounded border border-dashed bg-white px-3 py-3 text-xs text-slate-500">No final diagnosis added yet.</div> : draft.diagnoses.map((dx, index) => (
                <div key={dx.id} className="rounded-lg border bg-white p-2">
                  <div className="flex flex-wrap items-start gap-2">
                    <div className="min-w-0 flex-1"><div className="text-sm font-medium"><span className="mr-2 font-mono text-xs">{dx.code}</span>{dx.text}</div><div className="mt-1 text-[11px] text-slate-500">{index === 0 && dx.kind === 'primary' ? 'Primary diagnosis' : dx.kind}</div></div>
                    <select className="rounded border px-1.5 py-1 text-xs" value={dx.kind} onChange={(e) => updateDiagnosis(dx.id, { kind: e.target.value as ConclusionDiagnosis['kind'] })}><option value="primary">Primary</option><option value="secondary">Secondary</option><option value="differential">Differential</option></select>
                    <select className="rounded border px-1.5 py-1 text-xs" value={dx.status} onChange={(e) => updateDiagnosis(dx.id, { status: e.target.value as ConclusionDiagnosis['status'] })}><option value="confirmed">Confirmed</option><option value="provisional">Provisional</option><option value="differential">Differential</option></select>
                    <button type="button" className="rounded border px-2 py-1 text-xs text-rose-700" onClick={() => removeDiagnosis(dx.id)}>Remove</button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-sm"><span className="font-medium">Disposition</span><select className="rounded border px-2 py-1" value={draft.disposition} onChange={(e) => setDraft((d) => ({ ...d, disposition: e.target.value }))}><option value="">Select disposition</option><option value="discharge-home">Discharge home</option><option value="follow-up">Follow-up arranged</option><option value="referred">Referred</option><option value="urgent-escalation">Urgent escalation / ED</option><option value="admit">Admit / inpatient assessment</option><option value="other">Other</option></select></label>
            <label className="grid gap-1 text-sm"><span className="font-medium">Conclusion Note</span><textarea className="min-h-[72px] rounded border px-2 py-1" value={draft.conclusionNote} onChange={(e) => setDraft((d) => ({ ...d, conclusionNote: e.target.value }))} placeholder="Additional outcome context that does not belong elsewhere…" /></label>
          </div>
          <label className="grid gap-1 text-sm"><span className="font-medium">Care Plan / Recommendations</span><textarea className="min-h-[90px] rounded border px-2 py-1" value={draft.carePlan} onChange={(e) => setDraft((d) => ({ ...d, carePlan: e.target.value }))} placeholder="Treatment recommendations and care plan. Medication and lab order details remain in Orders." /></label>
          <label className="grid gap-1 text-sm"><span className="font-medium">Patient Education</span><textarea className="min-h-[72px] rounded border px-2 py-1" value={draft.patientEducation} onChange={(e) => setDraft((d) => ({ ...d, patientEducation: e.target.value }))} placeholder="Information discussed with the patient…" /></label>
          <label className="grid gap-1 text-sm"><span className="font-medium">Safety-netting</span><textarea className="min-h-[72px] rounded border px-2 py-1" value={draft.safetyNetting} onChange={(e) => setDraft((d) => ({ ...d, safetyNetting: e.target.value }))} placeholder="Red flags, escalation thresholds and when/where to seek urgent care…" /></label>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-sm"><span className="font-medium">Referral Summary</span><textarea className="min-h-[72px] rounded border px-2 py-1" value={draft.referralNote} onChange={(e) => setDraft((d) => ({ ...d, referralNote: e.target.value }))} placeholder="Referral outcome/summary; use Referral tab for the actual referral action." /></label>
            <label className="grid gap-1 text-sm"><span className="font-medium">Follow-up Summary</span><textarea className="min-h-[72px] rounded border px-2 py-1" value={draft.followUpNote} onChange={(e) => setDraft((d) => ({ ...d, followUpNote: e.target.value }))} placeholder="Follow-up outcome/summary; use Book Follow-up tab for scheduling." /></label>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t pt-3">
            <div className={`text-xs ${saveState === 'error' ? 'text-rose-700' : 'text-gray-600'}`}>{simulation ? (savedAt ? `Simulation draft saved locally ${new Date(savedAt).toLocaleTimeString()}` : 'Simulation draft stays local') : saveState === 'saving' ? 'Saving…' : saveState === 'error' ? 'Server draft save needs attention' : savedAt ? `Saved ${new Date(savedAt).toLocaleTimeString()}` : 'Draft ready'}</div>
            <div className="ml-auto flex gap-2">
              <button type="button" className="rounded border bg-white px-3 py-1.5 text-sm" onClick={() => void saveDraftNow()} disabled={closing}>Save Draft</button>
              <button type="button" className="rounded border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-900 hover:bg-emerald-100 disabled:opacity-50" onClick={() => void requestEndSession()} disabled={closing}>{closing ? 'Ending…' : 'End Consultation'}</button>
            </div>
          </div>
        </div>
      )}

      {tab === 'follow' && <FollowupSlotPicker clinicianId={clinicianId || ''} encounterId={encounterId} slotMinutes={slotMinutes} simulation={simulation} onAction={handleFollowupAction} />}
      {tab === 'ref' && (referralSlot ?? <div className="p-4">Referral panel (not configured)</div>)}
      {tab === 'notes' && (
        <div className="space-y-2">
          <div className="mb-2 text-xs text-gray-500">Generate <b>Sick Notes</b> or <b>Fitness Certificates</b>. Prescriptions and lab orders live in <b>Orders</b>.</div>
          <MedicalDocs encounterId={encounterId} clinicianName={clinicianName || clinicianId} clinicianReg={undefined} clinicName={clinicName} clinicLogoUrl={clinicLogoUrl} clinicAddress={clinicAddress} patientId={patientId} patientName={patientName} hideErx defaultNoteType="sick" initialSessionVitals={[]} onGenerated={() => {}} />
        </div>
      )}

      {endGuard ? (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/40 p-4" role="dialog" aria-modal="true" aria-label="Unfinalized Orders">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="text-base font-semibold text-slate-900">Unfinalized Orders need a decision</div>
            <div className="mt-2 text-sm leading-relaxed text-slate-600">
              {endGuard.medicationDraftCount < 0 || endGuard.labDraftCount < 0
                ? 'Ambulant+ could not verify the current Orders draft state. Review Orders before ending the consultation.'
                : `There ${endGuard.medicationDraftCount + endGuard.labDraftCount === 1 ? 'is' : 'are'} ${endGuard.medicationDraftCount + endGuard.labDraftCount} saved draft order${endGuard.medicationDraftCount + endGuard.labDraftCount === 1 ? '' : 's'} (${endGuard.medicationDraftCount} eRx, ${endGuard.labDraftCount} lab). Ending the consultation will not finalize or issue them.`}
            </div>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button type="button" className="rounded border px-3 py-2 text-sm" onClick={() => setEndGuard(null)}>Cancel</button>
              <button type="button" className="rounded border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-900" onClick={() => { setEndGuard(null); onReviewOrders?.(); }}>Review Orders</button>
              {endGuard.medicationDraftCount >= 0 && endGuard.labDraftCount >= 0 ? <button type="button" className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white" onClick={() => void finalizeEncounterAndClaim()}>End & keep Orders as drafts</button> : null}
            </div>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
