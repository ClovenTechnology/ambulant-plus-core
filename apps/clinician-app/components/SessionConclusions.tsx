// apps/clinician-app/components/SessionConclusions.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Card, Tabs, Collapse } from '@/components/ui';
import { CollapseBtn } from '@/components/ui/CollapseBtn';
import SessionCountdown from '@/src/components/SessionCountdown';
import { PDFViewer } from '@react-pdf/renderer';
import MedicalDocPDF, { generatePdfBlob, DocType, FitnessVitals, LabRow } from './MedicalDocs';
import { useAutocomplete, icdSearch } from '@/src/hooks/useAutocomplete';
import type { ICD10Hit } from '@/src/hooks/useAutocomplete';

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

type RightTab = 'end' | 'follow' | 'ref' | 'notes';

type Draft = {
  synopsis: string;
  dxQuery: string; // raw text in input
  dxCode: string;  // selected code (e.g. "J20.9")
  plan: string;
  notes: string;
};

type LocalLabRow = LabRow & {};

// ----------------- Component: FollowupSlotPicker (restored) -----------------
function FollowupSlotPicker({ clinicianId }: { clinicianId: string }) {
  const [busy, setBusy] = useState(false);
  const [slots, setSlots] = useState<Record<string, { start: string; end: string }[]>>({});
  const [sel, setSel] = useState<string | null>(null);

  // Labs collapsible state & mock data (restored)
  const [labsOpen, setLabsOpen] = useState(true);

  type Lab = { id: string; name: string; orderedAt: string; etaDays: number };
  const labs: Lab[] = useMemo(() => {
    const today = new Date(); today.setHours(0,0,0,0);
    const isoToday = today.toISOString();
    return [
      { id: 'lab-1', name: 'CBC',            orderedAt: isoToday, etaDays: 2 },
      { id: 'lab-2', name: 'CRP',            orderedAt: isoToday, etaDays: 3 },
      { id: 'lab-3', name: 'HbA1c',          orderedAt: isoToday, etaDays: 5 },
      { id: 'lab-4', name: 'Lipid Panel',    orderedAt: isoToday, etaDays: 4 },
      { id: 'lab-5', name: 'Thyroid Panel',  orderedAt: isoToday, etaDays: 6 },
    ];
  }, []);

  const labsWithEta = useMemo(() => {
    return labs.map(l => {
      const d = new Date(l.orderedAt);
      d.setDate(d.getDate() + l.etaDays);
      return { ...l, etaAt: d };
    });
  }, [labs]);

  useEffect(() => {
    (async () => {
      setBusy(true);
      try {
        // Simple mock: today + next 13 days, two slots/day, except Sundays
        const out: Record<string, { start: string; end: string }[]> = {};
        const d0 = new Date(); d0.setHours(0,0,0,0);
        for (let i = 0; i < 14; i++) {
          const d = new Date(d0); d.setDate(d0.getDate() + i);
          const key = d.toISOString().slice(0, 10);
          const mk = (h: number) => {
            const s = new Date(d); s.setHours(h, 0, 0, 0);
            const e = new Date(s.getTime() + 25 * 60000);
            return { start: s.toISOString(), end: e.toISOString() };
          };
          out[key] = d.getDay() === 0 ? [] : [mk(9), mk(14)];
        }
        setSlots(out);
      } finally {
        setBusy(false);
      }
    })();
  }, [clinicianId]);

  const days = useMemo(() => {
    const d0 = new Date(); d0.setHours(0,0,0,0);
    return Array.from({ length: 14 }).map((_, i) => {
      const d = new Date(d0); d.setDate(d0.getDate() + i); return d;
    });
  }, []);

  return (
    <div className="space-y-3">
      {/* Labs panel (restored) */}
      <div className="rounded border p-3 bg-white">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">Upcoming Lab Tests (mock)</div>
          <CollapseBtn open={labsOpen} onClick={() => setLabsOpen(v => !v)} />
        </div>
        <Collapse open={labsOpen}>
          <div className="text-xs text-gray-600 my-2">
            FYI: The <b>longest ETA</b> below is {labsWithEta.length ? labsWithEta.reduce((m, l) => (l.etaAt > m ? l.etaAt : m), labsWithEta[0].etaAt).toLocaleDateString() : '—'}.
          </div>
          <ul className="divide-y text-sm">
            {labsWithEta.map(l => (
              <li key={l.id} className="py-1 flex items-center justify-between">
                <div>
                  <div className="font-medium">{l.name}</div>
                  <div className="text-[11px] text-gray-500">
                    Ordered: {new Date(l.orderedAt).toLocaleDateString()} · ETA: {l.etaDays} day{l.etaDays!==1?'s':''}
                  </div>
                </div>
                <div className="text-xs px-2 py-0.5 rounded border bg-white">
                  ETA Date: <b>{l.etaAt.toLocaleDateString()}</b>
                </div>
              </li>
            ))}
          </ul>
        </Collapse>
      </div>

      {/* Calendar */}
      <div className="rounded border p-3">
        <div className="text-sm font-medium mb-2">Clinician Calendar</div>
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
                        return (
                          <button
                            key={i}
                            onClick={() => setSel(id)}
                            className={`border rounded px-2 py-1 hover:bg-gray-50 ${active ? 'bg-gray-900 text-white' : ''}`}
                          >
                            {t}
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

      <div className="flex justify-end">
        <button
          disabled={!sel}
          className="px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          onClick={() => {
            if (!sel) return;
            alert(`Selected slot: ${sel}`);
          }}
        >
          Confirm
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main SessionConclusions component                                   */
/* ------------------------------------------------------------------ */

export default function SessionConclusions({
  clinicianId,
  encounterId,
  apptStartISO,
  slotMinutes = 15,
  onEnd,
  referralSlot,
}: {
  clinicianId: string;
  encounterId?: string;
  apptStartISO?: string;
  slotMinutes?: number;
  onEnd?: () => void;
  referralSlot?: React.ReactNode;
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
      patient: { name: '—' },
    } as any;
  }, [apptStartISO, slotMinutes]);

  const [elapsed, setElapsed] = useState(0);
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    if (!appointment?.start || !appointment?.end) return;
    const t0 = Date.parse(appointment.start);
    const t1 = Date.parse(appointment.end);
    const tick = () => {
      const now = Date.now();
      setElapsed(now - t0);
      setRemaining(t1 - now);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [appointment?.start, appointment?.end]);

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
    } catch {}
  }, [storageKey]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(draft));
        setSavedAt(Date.now());
      } catch {}
    }, 500);
    return () => window.clearTimeout(id);
  }, [draft, storageKey]);

  const handleSaveNow = () => {
    setSaving(true);
    try {
      localStorage.setItem(storageKey, JSON.stringify(draft));
      setSavedAt(Date.now());
    } catch {}
    setSaving(false);
  };

  const handleEnd = () => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(draft));
      setSavedAt(Date.now());
    } catch {}
    onEnd?.();
    alert('Session concluded. Draft saved locally.');
  };

  const savedMsg = savedAt ? `Saved ${new Date(savedAt).toLocaleTimeString()}` : 'Not saved yet';

  // ---------------- ICD-10 Autocomplete (Diagnosis) ----------------
  const icdDxAuto = useAutocomplete<ICD10Hit>(icdSearch);
  const icdDxOptions = icdDxAuto.opts.map(h => ({ code: h.code, text: `${h.code} — ${h.title}` }));
  const ICD10_SUGGESTIONS: string[] = [
    'J20.9 — Acute bronchitis, unspecified',
    'R50.9 — Fever, unspecified',
    'R05.9 — Cough, unspecified',
    'I10 — Essential (primary) hypertension',
    'E11.9 — Type 2 diabetes mellitus without complications',
  ];
  const icdDxOptionsFinal = icdDxOptions.length
    ? icdDxOptions
    : ICD10_SUGGESTIONS.map((t, i) => ({ code: t.split(' ')[0] || `SUG-${i}`, text: t }));

  // Custom suggestion dropdown state
  const [showIcdSuggestions, setShowIcdSuggestions] = useState(false);
  const [icdHighlight, setIcdHighlight] = useState(0);
  const icdInputRef = useRef<HTMLInputElement | null>(null);
  const suggestionListRef = useRef<HTMLDivElement | null>(null);

  // handle keyboard navigation for ICD suggestions
  const onIcdKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const list = icdDxOptionsFinal;
    if (!list || list.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setShowIcdSuggestions(true);
      setIcdHighlight((s) => Math.min(list.length - 1, s + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setShowIcdSuggestions(true);
      setIcdHighlight((s) => Math.max(0, s - 1));
    } else if (e.key === 'Enter') {
      if (showIcdSuggestions) {
        e.preventDefault();
        const sel = list[icdHighlight] || list[0];
        if (sel) {
          setDraft(d => ({ ...d, dxQuery: sel.text, dxCode: sel.code }));
          setShowIcdSuggestions(false);
        }
      }
    } else if (e.key === 'Escape') {
      setShowIcdSuggestions(false);
    }
  };

  // when icdDxAuto.opts changes, reset highlight
  useEffect(() => {
    setIcdHighlight(0);
  }, [icdDxAuto.opts]);

  // ---------------- Labs catalog & editor ----------------
  const LAB_CATALOG: LocalLabRow[] = [
    { test: 'CBC', priority: 'Routine', specimen: 'Whole blood', icd: 'R75', instructions: '' },
    { test: 'CRP', priority: 'Routine', specimen: 'Serum', icd: 'R50.9', instructions: '' },
    { test: 'HbA1c', priority: 'Routine', specimen: 'Whole blood', icd: 'E11.9', instructions: '' },
    { test: 'Lipid Panel', priority: 'Routine', specimen: 'Serum', icd: 'E78.5', instructions: '' },
    { test: 'Thyroid Panel', priority: 'Routine', specimen: 'Serum', icd: 'E03.9', instructions: '' },
  ];
  const [labRows, setLabRows] = useState<LocalLabRow[]>([{ test: '', priority: '', specimen: '', icd: '', instructions: '' }]);
  const addLabRow = () => setLabRows((r) => [...r, { test: '', priority: '', specimen: '', icd: '', instructions: '' }]);
  const removeLabRow = (i: number) => setLabRows((r) => r.filter((_, j) => j !== i));
  const updateLabRow = (i: number, patch: Partial<LocalLabRow>) => setLabRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));

  function suggestionsFor(prefix: string) {
    if (!prefix) return [];
    const q = prefix.trim().toLowerCase();
    return LAB_CATALOG.filter((t) => t.test.toLowerCase().includes(q));
  }

  // ---------------- Vitals editor ----------------
  const [vitals, setVitals] = useState<FitnessVitals[]>([]);
  const addVitalRow = () => setVitals(s => [...s, { date: new Date().toISOString(), bp: '', pulse: undefined, temp: undefined }]);
  const updateVital = (i: number, patch: Partial<FitnessVitals>) => setVitals((s) => s.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const removeVital = (i: number) => setVitals((s) => s.filter((_, idx) => idx !== i));

  // ---------------- clinician info & signature ----------------
  const [clinicianName, setClinicianName] = useState<string>(clinicianId || '');
  const [clinicianReg, setClinicianReg] = useState<string | undefined>(undefined);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!clinicianId) return;
      try {
        const r = await fetch(`/api/clinicians/${encodeURIComponent(clinicianId)}`, { cache: 'no-store' });
        if (!r.ok) return;
        const js = await r.json();
        if (js?.name) setClinicianName(js.name);
        if (js?.reg) setClinicianReg(js.reg);
        if (js?.signatureUrl) {
          try {
            const sigr = await fetch(js.signatureUrl);
            if (sigr.ok) {
              const b = await sigr.blob();
              const url = URL.createObjectURL(b);
              setSignatureDataUrl(url);
            }
          } catch {}
        }
      } catch (e) {
        // non-fatal
        // eslint-disable-next-line no-console
        console.warn('clinician fetch failed', e);
      }
    })();
  }, [clinicianId]);

  // ---------------- Notes / PDF state ----------------
  const [noteType, setNoteType] = useState<DocType>('sick');
  const [patientName, setPatientName] = useState('');
  const [patientId, setPatientId] = useState('');
  const [sickDays, setSickDays] = useState<number>(3);

  // Preview state for PDF viewer
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [previewProps, setPreviewProps] = useState<any | null>(null);

  // End Session -> End Session / Discharge label
  const handleEndSession = () => {
    // finalize and discharge logic (stub)
    alert('Session concluded and patient marked for discharge (stub).');
    onEnd?.();
  };

  // signature file read helper
  const onSignatureUpload = async (file?: File) => {
    if (!file) return;
    try {
      const reader = new FileReader();
      reader.onload = () => {
        setSignatureDataUrl(String(reader.result));
      };
      reader.readAsDataURL(file);
    } catch (e) {
      console.error('signature read', e);
    }
  };

  // Preview and optionally attach to patient
  const handlePreview = async (attachToPatient = false) => {
    if (!patientName) return alert('Enter patient name');
    const tests = labRows.filter(r => r.test.trim()).map(r => ({ ...r }));
    const data: any = {
      type: noteType,
      patientName,
      patientId: patientId || undefined,
      clinicianName: clinicianName || clinicianId || 'Clinician',
      clinicianReg,
      clinicName: 'Ambulant+ Center',
      clinicLogoUrl: '/logo.png',
      clinicAddress: 'Ambulant+ Healthcare Network, Europe',
      date: new Date().toISOString(),
      notes: draft.notes || undefined,
      plan: draft.plan || undefined,
      durationDays: noteType === 'sick' ? Math.max(0, Math.round(sickDays || 0)) : undefined,
      testsPerformed: tests,
      vitals,
      consultations: 1,
      signatureDataUrl,
    };

    try {
      const blob = await generatePdfBlob(data);
      const url = URL.createObjectURL(blob);
      setPreviewBlobUrl(url);
      setPreviewProps(data);

      if (attachToPatient && patientId) {
        try {
          const fd = new FormData();
          fd.append('file', blob, `${noteType}-note-${patientName.replace(/\s+/g, '_')}.pdf`);
          fd.append('type', noteType);
          fd.append('title', `${noteType === 'sick' ? 'Sick Note' : 'Fitness Certificate'} - ${patientName}`);
          const res = await fetch(`/api/patients/${encodeURIComponent(patientId)}/documents`, { method: 'POST', body: fd });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const js = await res.json().catch(() => ({}));
          alert('PDF attached to patient record.' + (js?.id ? ` Document ID: ${js.id}` : ''));
        } catch (err) {
          console.error('Attach failed', err);
          alert('Failed to attach PDF to patient record.');
        }
      }
    } catch (err) {
      console.error('PDF generation failed', err);
      alert('Failed to generate PDF preview.');
    }
  };

  const handleDownloadFromPreview = () => {
    if (!previewBlobUrl || !previewProps) return;
    const a = document.createElement('a');
    a.href = previewBlobUrl;
    const cleanName = `${previewProps.type}-note-${(previewProps.patientName || '').replace(/\s+/g, '_')}`;
    a.download = `${cleanName}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const closePreview = () => {
    if (previewBlobUrl) URL.revokeObjectURL(previewBlobUrl);
    setPreviewBlobUrl(null);
    setPreviewProps(null);
  };

  // ICD input helpers: wire up useAutocomplete
  const onDiagnosisChange = (q: string) => {
    icdDxAuto.setQ(q);
    setDraft(d => ({ ...d, dxQuery: q }));
    setShowIcdSuggestions(true);
  };

  // Close suggestions on outside click
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!suggestionListRef.current) return;
      if (!suggestionListRef.current.contains(e.target as Node) && e.target !== icdInputRef.current) {
        setShowIcdSuggestions(false);
      }
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  // When user blur; small timeout to allow click selection
  const onIcdBlur = () => {
    setTimeout(() => setShowIcdSuggestions(false), 150);
  };

  return (
    <Card title="Session & Conclusions" dense={false} gradient>
      <div className="mb-2">
        <Tabs active={tab} onChange={(k: RightTab) => setTab(k)} items={[
          { key: 'end', label: 'End / Save Session' },
          { key: 'follow', label: 'Book Follow-up' },
          { key: 'ref', label: 'Referral' },
          { key: 'notes', label: 'Medical Notes' },
        ]} />
      </div>

      {/* Tab: End / Save */}
      {tab === 'end' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-600">Timer Tiles</div>
          </div>

          <div className="grid md:grid-cols-2 gap-2">
            <div className="rounded border p-2">
              <div className="text-xs text-gray-500 mb-0.5">Elapsed</div>
              <div className="font-mono">{Math.max(0, Math.floor(elapsed/1000))}s</div>
            </div>
            <div className="rounded border p-2">
              <div className="text-xs text-gray-500 mb-0.5">Remaining</div>
              <div className="font-mono">{Math.max(0, Math.floor(remaining/1000))}s</div>
            </div>
          </div>

          <div className="mt-2">
            <SessionCountdown appointment={appointment} loading={false} />
          </div>

          <div className="grid gap-3">
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Visit Synopsis</span>
              <textarea className="border rounded px-2 py-1 min-h-[80px]" value={draft.synopsis} onChange={(e) => setDraft(d => ({ ...d, synopsis: e.target.value }))} placeholder="Brief summary..." />
            </label>

            <div className="grid gap-1 text-sm relative">
              <span className="font-medium">Diagnosis (ICD-10)</span>
              <input
                ref={icdInputRef}
                className="w-full border rounded px-2 py-1"
                value={icdDxAuto.q || draft.dxQuery}
                onChange={(e) => onDiagnosisChange(e.target.value)}
                onFocus={(e) => { const v = e.currentTarget.value; if (v) icdDxAuto.setQ(v); setShowIcdSuggestions(true); }}
                onBlur={onIcdBlur}
                onKeyDown={onIcdKeyDown}
                placeholder="Type to search ICD-10 (free text allowed)"
                aria-label="Diagnosis (ICD-10)"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
              />

              {/* Custom suggestions panel */}
              {showIcdSuggestions && (icdDxAuto.opts.length > 0 || icdDxOptionsFinal.length > 0) && (
                <div
                  ref={suggestionListRef}
                  role="listbox"
                  aria-label="ICD-10 suggestions"
                  className="absolute left-0 right-0 mt-1 border rounded bg-white z-20 max-h-48 overflow-auto text-sm shadow"
                >
                  {(icdDxAuto.opts.length ? icdDxAuto.opts.map(h => ({ code: h.code, text: `${h.code} — ${h.title}` })) : icdDxOptionsFinal).map((o, idx) => (
                    <button
                      key={`${o.code}-${idx}`}
                      role="option"
                      aria-selected={icdHighlight === idx}
                      onMouseDown={(ev) => { ev.preventDefault(); /* prevent blur */ }}
                      onClick={() => {
                        setDraft(d => ({ ...d, dxQuery: o.text, dxCode: o.code }));
                        setShowIcdSuggestions(false);
                      }}
                      className={`w-full text-left px-3 py-2 hover:bg-gray-50 ${icdHighlight === idx ? 'bg-gray-100' : ''}`}
                    >
                      <div className="flex justify-between items-center">
                        <div className="truncate">{o.text}</div>
                        <div className="text-xs text-gray-400 font-mono ml-2">{o.code}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              <datalist id="icd10-suggest">
                {icdDxOptionsFinal.map(o => <option key={o.code} value={o.text} />)}
              </datalist>
              {draft.dxCode && <div className="text-[11px] text-gray-600">Selected code: <span className="font-mono">{draft.dxCode}</span></div>}
            </div>

            <label className="grid gap-1 text-sm">
              <span className="font-medium">Treatment Plan / Recommendations</span>
              <textarea className="border rounded px-2 py-1 min-h-[100px]" value={draft.plan} onChange={(e) => setDraft(d => ({ ...d, plan: e.target.value }))} placeholder="Plan, medications, follow-up..." />
            </label>

            <label className="grid gap-1 text-sm">
              <span className="font-medium">Additional Notes (optional)</span>
              <textarea className="border rounded px-2 py-1 min-h-[70px]" value={draft.notes} onChange={(e) => setDraft(d => ({ ...d, notes: e.target.value }))} placeholder="Extra context..." />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="text-xs text-gray-600">{savedMsg}</div>
            <div className="ml-auto flex gap-2">
              <button className="px-3 py-1.5 border rounded text-sm bg-white hover:bg-gray-50" onClick={handleSaveNow} disabled={saving}>{saving ? 'Saving…' : 'Save Draft'}</button>
              <button className="px-3 py-1.5 border rounded text-sm bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-900" onClick={handleEndSession} title="Finalize and discharge the patient">End Session / Discharge</button>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Follow-up */}
      {tab === 'follow' && <FollowupSlotPicker clinicianId={clinicianId || ''} />}

      {/* Tab: Referral */}
      {tab === 'ref' && (referralSlot ?? <div className="p-4">Referral panel (not configured)</div>)}

      {/* Tab: Notes / PDF */}
      {tab === 'notes' && (
        <div className="space-y-4">
          <div className="grid md:grid-cols-2 gap-2">
            <label className="flex flex-col text-sm"><span>Patient Name</span><input className="border rounded px-2 py-1" value={patientName} onChange={(e) => setPatientName(e.target.value)} /></label>
            <label className="flex flex-col text-sm"><span>Patient ID (optional)</span><input className="border rounded px-2 py-1" value={patientId} onChange={(e) => setPatientId(e.target.value)} /></label>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm"><input type="radio" checked={noteType === 'sick'} onChange={() => setNoteType('sick')} /> Sick Note</label>
            <label className="flex items-center gap-2 text-sm"><input type="radio" checked={noteType === 'fitness'} onChange={() => setNoteType('fitness')} /> Fitness Certificate</label>
          </div>

          {noteType === 'sick' && (
            <div className="grid md:grid-cols-2 gap-2">
              <label className="flex flex-col text-sm"><span>Number of days</span><input type="number" min={0} className="border rounded px-2 py-1 w-40" value={String(sickDays)} onChange={(e) => setSickDays(Math.max(0, Number(e.target.value) || 0))} /><div className="text-xs text-gray-500 mt-1">Enter clinician-appropriate duration</div></label>
              <label className="flex flex-col text-sm"><span>Notes (optional)</span><input className="border rounded px-2 py-1" value={draft.notes} onChange={(e) => setDraft(d => ({ ...d, notes: e.target.value }))} /></label>
            </div>
          )}

          {noteType === 'fitness' && (
            <>
              <div className="flex items-center gap-2">
                <button className="px-2 py-1 rounded border" onClick={() => addVitalRow()}>Add Vital Row</button>
                <div className="text-xs text-gray-500">Add vitals (e.g. last 7 days) for charting.</div>
              </div>

              <div className="space-y-2">
                {vitals.map((r, i) => (
                  <div key={i} className="grid md:grid-cols-5 gap-2 items-center">
                    <input type="date" className="border rounded px-2 py-1" value={new Date(r.date).toISOString().slice(0, 10)} onChange={(e) => updateVital(i, { date: new Date(e.target.value).toISOString() })} />
                    <input placeholder="BP e.g. 120/80" className="border rounded px-2 py-1" value={r.bp || ''} onChange={(e) => updateVital(i, { bp: e.target.value })} />
                    <input type="number" placeholder="Pulse" className="border rounded px-2 py-1" value={r.pulse == null ? '' : String(r.pulse)} onChange={(e) => updateVital(i, { pulse: e.target.value ? Number(e.target.value) : undefined })} />
                    <input type="number" step="0.1" placeholder="Temp °C" className="border rounded px-2 py-1" value={r.temp == null ? '' : String(r.temp)} onChange={(e) => updateVital(i, { temp: e.target.value ? Number(e.target.value) : undefined })} />
                    <div className="flex gap-2"><button className="px-2 py-1 text-xs rounded border" onClick={() => removeVital(i)}>Remove</button></div>
                  </div>
                ))}
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium">Lab Tests</div>
                  <button className="px-2 py-1 text-xs rounded border" onClick={() => setLabRows(r => [...r, { test: '', priority: '', specimen: '', icd: '', instructions: '' }])}>Add Test</button>
                </div>

                <div className="space-y-2">
                  {labRows.map((r, idx) => (
                    <div key={idx} className="grid md:grid-cols-6 gap-2 items-center relative">
                      <div className="col-span-2 relative">
                        <input className="border rounded px-2 py-1 w-full" placeholder="Test" value={r.test} onChange={(e) => updateLabRow(idx, { test: e.target.value })} />
                        {r.test && suggestionsFor(r.test).length > 0 && (
                          <div className="border rounded bg-white max-h-36 overflow-auto text-xs absolute z-10 w-full">
                            {suggestionsFor(r.test).map((s, i) => (
                              <button key={i} className="w-full text-left px-2 py-1 hover:bg-gray-50" onClick={() => updateLabRow(idx, s)}>
                                {s.test} — {s.specimen}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <select className="border rounded px-2 py-1" value={r.priority} onChange={(e) => updateLabRow(idx, { priority: e.target.value as any })}>
                        <option value=''>Priority</option>
                        <option value='Routine'>Routine</option>
                        <option value='Urgent'>Urgent</option>
                        <option value='Stat'>Stat</option>
                      </select>

                      <input placeholder="Specimen" className="border rounded px-2 py-1" value={r.specimen} onChange={(e) => updateLabRow(idx, { specimen: e.target.value })} />
                      <input placeholder="ICD (optional)" className="border rounded px-2 py-1" value={r.icd} onChange={(e) => updateLabRow(idx, { icd: e.target.value })} />
                      <div className="flex gap-2">
                        <input placeholder="Instructions" className="border rounded px-2 py-1" value={r.instructions} onChange={(e) => updateLabRow(idx, { instructions: e.target.value })} />
                        <button className="px-2 py-1 text-xs rounded border" onClick={() => removeLabRow(idx)}>Remove</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          <div className="grid md:grid-cols-3 gap-2">
            <label className="flex flex-col text-sm"><span>Clinician Name</span><input className="border rounded px-2 py-1" value={clinicianName} onChange={(e) => setClinicianName(e.target.value)} /></label>
            <label className="flex flex-col text-sm"><span>Registration / Practice No.</span><input className="border rounded px-2 py-1" value={clinicianReg || ''} onChange={(e) => setClinicianReg(e.target.value)} /></label>
            <label className="flex flex-col text-sm"><span>Upload Signature (optional)</span>
              <input type="file" accept="image/*" onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  const r = new FileReader();
                  r.onload = () => setSignatureDataUrl(String(r.result));
                  r.readAsDataURL(f);
                }
              }} />
            </label>
          </div>

          <div className="flex gap-2">
            <button className="px-3 py-1 rounded border" onClick={() => { setPatientName(''); setPatientId(''); setLabRows([{ test: '', priority: '', specimen: '', icd: '', instructions: '' }]); setVitals([]); }}>Reset</button>
            <button className="px-3 py-1 rounded bg-indigo-600 text-white" onClick={() => handlePreview(false)}>Preview PDF</button>
            <button className="px-3 py-1 rounded bg-green-600 text-white" onClick={() => handlePreview(true)} disabled={!patientId}>Preview & Attach to patient</button>
          </div>
        </div>
      )}

      {/* Preview modal */}
      {previewBlobUrl && previewProps && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded shadow-lg w-[95%] max-w-6xl h-[90%] overflow-hidden relative">
            <div className="p-3 border-b flex items-center justify-between">
              <div className="font-medium">Preview — {previewProps.type === 'sick' ? 'Sick Note' : 'Fitness Certificate'}</div>
              <div className="flex gap-2">
                <button className="px-3 py-1 rounded border" onClick={closePreview}>Close</button>
                <button className="px-3 py-1 rounded bg-blue-600 text-white" onClick={handleDownloadFromPreview}>Download</button>
              </div>
            </div>

            <div style={{ width: '100%', height: 'calc(100% - 56px)' }}>
              <PDFViewer style={{ width: '100%', height: '100%' }}>
                <MedicalDocPDF {...previewProps} />
              </PDFViewer>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
