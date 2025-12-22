// file: apps/clinician-app/app/settings/schedule/page.tsx
'use client';
import { SettingsTabs } from '@/components/SettingsTabs';
import { useEffect, useState } from 'react';
import CalendarPreview from '../../../components/CalendarPreview';

const GATEWAY = process.env.NEXT_PUBLIC_GATEWAY_ORIGIN ?? '';
type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
const DAYS: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DAY_LABEL: Record<DayKey, string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
};

type SlotRange = { start: string; end: string };
type DayTemplate = { enabled: boolean; ranges: SlotRange[] };
type Exception = { date: string; reason?: string };
type ScheduleConfig = {
  country: string;
  timezone: string;
  template: Record<DayKey, DayTemplate>;
  exceptions: Exception[];
  slotMin?: string;
  slotMax?: string;
};
type ConsultSettings = {
  defaultMinutes: number;
  bufferMinutes: number;
  minAdvanceMinutes: number;
  maxAdvanceDays: number;
};

const DEFAULT: ScheduleConfig = {
  country: 'ZA',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Johannesburg',
  template: {
    mon: { enabled: true, ranges: [{ start: '09:00', end: '12:00' }, { start: '13:00', end: '17:00' }] },
    tue: { enabled: true, ranges: [{ start: '09:00', end: '12:00' }, { start: '13:00', end: '17:00' }] },
    wed: { enabled: true, ranges: [{ start: '09:00', end: '12:00' }, { start: '13:00', end: '17:00' }] },
    thu: { enabled: true, ranges: [{ start: '09:00', end: '12:00' }, { start: '13:00', end: '17:00' }] },
    fri: { enabled: true, ranges: [{ start: '09:00', end: '12:00' }, { start: '13:00', end: '17:00' }] },
    sat: { enabled: false, ranges: [{ start: '09:00', end: '12:00' }] },
    sun: { enabled: false, ranges: [] },
  },
  exceptions: [],
};

function showToast(msg: string, opts?: { type?: 'ok' | 'err'; duration?: number }) {
  const el = document.createElement('div');
  el.className = `fixed top-6 right-6 z-50 px-4 py-2 rounded shadow ${
    opts?.type === 'err' ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'
  } transition-transform`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), opts?.duration ?? 3500);
}

export default function SchedulePage() {
  const [cfg, setCfg] = useState<ScheduleConfig>(DEFAULT);
  const [consult, setConsult] = useState<ConsultSettings | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // onboarding flag (first-run callout)
  const ONBOARD_KEY = 'clinician:seenScheduleOnboard';
  const [showOnboard, setShowOnboard] = useState(false);

  // UI-only time window (kept in sync with cfg)
  const [slotMin, setSlotMin] = useState<string>('08:00');
  const [slotMax, setSlotMax] = useState<string>('23:00');

  // preview mode: clinician vs patient view
  const [patientView, setPatientView] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [r1, r2] = await Promise.all([
          fetch(`${GATEWAY}/api/settings/schedule`, {
            cache: 'no-store',
            headers: { 'x-uid': 'clinician-local-001', 'x-role': 'clinician' },
          }),
          fetch(`${GATEWAY}/api/settings/consult`, {
            cache: 'no-store',
            headers: { 'x-uid': 'clinician-local-001', 'x-role': 'clinician' },
          }),
        ]);
        const s = r1.ok ? await r1.json() : DEFAULT;
        const c = r2.ok
          ? await r2.json()
          : { defaultMinutes: 25, bufferMinutes: 5, minAdvanceMinutes: 30, maxAdvanceDays: 30 };
        const merged = { ...DEFAULT, ...s, template: { ...DEFAULT.template, ...(s?.template || {}) } } as ScheduleConfig;
        setCfg(merged);
        setSlotMin(s?.slotMin ?? merged.slotMin ?? '08:00');
        setSlotMax(s?.slotMax ?? merged.slotMax ?? '23:00');
        setConsult(c);
        const seen = typeof window !== 'undefined' && !!localStorage.getItem(ONBOARD_KEY);
        setShowOnboard(!seen);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function addRange(d: DayKey) {
    const next = structuredClone(cfg);
    next.template[d].ranges.push({ start: '09:00', end: '12:00' });
    setCfg(next);
  }
  function setRange(d: DayKey, i: number, key: 'start' | 'end', val: string) {
    const next = structuredClone(cfg);
    next.template[d].ranges[i][key] = val;
    setCfg(next);
  }
  function delRange(d: DayKey, i: number) {
    const next = structuredClone(cfg);
    next.template[d].ranges.splice(i, 1);
    setCfg(next);
  }
  function copyMonToWeekdays() {
    const next = structuredClone(cfg);
    for (const d of ['tue', 'wed', 'thu', 'fri'] as DayKey[]) next.template[d] = structuredClone(next.template.mon);
    setCfg(next);
    showToast('Copied Monday → Tue–Fri', { type: 'ok' });
  }
  function addException() {
    const date = new Date().toISOString().slice(0, 10);
    setCfg((prev) => ({ ...prev, exceptions: [...prev.exceptions, { date }] }));
  }
  function setException(i: number, date: string) {
    const next = structuredClone(cfg);
    next.exceptions[i].date = date;
    setCfg(next);
  }
  function delException(i: number) {
    const next = structuredClone(cfg);
    next.exceptions.splice(i, 1);
    setCfg(next);
  }

  // Save both schedule and consult settings (slotMin/slotMax included in schedule payload)
  async function save() {
    // validation
    const timeRe = /^\d{2}:\d{2}$/;
    if (!timeRe.test(slotMin) || !timeRe.test(slotMax)) {
      showToast('Please enter valid times (HH:mm)', { type: 'err' });
      return;
    }

    setSaving(true);
    try {
      const schedulePayload = { ...cfg, slotMin: slotMin, slotMax: slotMax };
      const r = await fetch(`${GATEWAY}/api/settings/schedule`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json', 'x-uid': 'clinician-local-001', 'x-role': 'clinician' },
        body: JSON.stringify(schedulePayload),
      });

      let r2 = { ok: true } as Response;
      if (consult) {
        r2 = await fetch(`${GATEWAY}/api/settings/consult`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json', 'x-uid': 'clinician-local-001', 'x-role': 'clinician' },
          body: JSON.stringify(consult),
        });
      }

      if (r.ok && r2.ok) {
        setSaved(true);
        setCfg((prev) => ({ ...prev, slotMin, slotMax }));
        showToast('Schedule & consult saved', { type: 'ok' });
        // subtle saved animation
        setTimeout(() => setSaved(false), 3000);
      } else {
        console.error('save error', await r.text().catch(() => ''), await r2.text().catch(() => ''));
        showToast('Failed to save schedule', { type: 'err' });
      }
    } catch (e) {
      console.error('save exception', e);
      showToast('Save error: network or server problem', { type: 'err' });
    } finally {
      setSaving(false);
    }
  }

  // Called when a clinician clicks a slot in CalendarPreview
  async function handleSlotClick(slotStartIso: string, slotEndIso?: string) {
    const date = slotStartIso.slice(0, 10);
    if (cfg.exceptions.some((ex) => ex.date === date)) {
      showToast(`Day already blocked: ${date}`, { type: 'err' });
      return;
    }
    setCfg((prev) => ({
      ...prev,
      exceptions: [...prev.exceptions, { date, reason: 'Blocked (clinician clicked slot)' }],
    }));
    showToast(`Blocking ${date} — saving…`, { type: 'ok' });
    try {
      await save();
      showToast(`Blocked ${date}`, { type: 'ok' });
    } catch {
      // save already shows failure toast
    }
  }

  // onboarding dismiss
  const dismissOnboard = () => {
    try {
      localStorage.setItem(ONBOARD_KEY, '1');
    } catch {}
    setShowOnboard(false);
  };

  if (loading) return <main className="p-6">Loading…</main>;

  return (
    <main className="p-6 space-y-6">
      <SettingsTabs />

      {/* onboarding callout */}
      {showOnboard && (
        <div className="rounded-lg p-4 bg-indigo-50 border border-indigo-100 flex items-start gap-4 animate-fade-in">
          <div className="flex-1">
            <div className="font-semibold">Welcome — set your availability</div>
            <div className="text-sm text-gray-600">
              Configure weekly templates, working windows, and exceptions. These settings control patient booking
              availability.
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <button onClick={dismissOnboard} className="px-3 py-1 bg-indigo-600 text-white rounded">
              Got it
            </button>
            <button onClick={() => setShowOnboard(false)} className="px-3 py-1 border rounded">
              Later
            </button>
          </div>
        </div>
      )}

      {/* existing header and schedule UI below this */}
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Clinician Schedule</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={copyMonToWeekdays}
            title="Copy Monday template to Tue–Fri"
            className="px-3 py-1 border rounded transition transform hover:scale-105"
          >
            Copy Mon → Weekdays
          </button>

          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-600 mr-1">Preview</label>
            <button
              onClick={() => setPatientView(false)}
              className={`px-2 py-1 rounded text-sm ${!patientView ? 'bg-indigo-600 text-white' : 'bg-gray-100'}`}
              aria-pressed={!patientView}
            >
              Clinician
            </button>
            <button
              onClick={() => setPatientView(true)}
              className={`px-2 py-1 rounded text-sm ${patientView ? 'bg-indigo-600 text-white' : 'bg-gray-100'}`}
              aria-pressed={patientView}
            >
              Patient view
            </button>
          </div>

          <button
            onClick={save}
            disabled={saving}
            className={`px-3 py-1 border rounded ${
              saving ? 'bg-gray-200 text-gray-600 cursor-wait' : 'bg-black text-white'
            } transition-transform ${saved ? 'transform scale-105 shadow-md' : ''}`}
            title="Save schedule & consult settings"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </header>

      <section className="grid lg:grid-cols-3 gap-4">
        <div className="border rounded p-4 bg-white lg:col-span-2">
          <div className="font-medium mb-3">Weekly Template</div>
          <div className="space-y-4">
            {DAYS.map((d) => (
              <div key={d} className="border rounded p-3">
                <div className="flex items-center gap-2 mb-2">
                  <label className="text-sm w-20">{DAY_LABEL[d]}</label>
                  <input
                    aria-label={`${DAY_LABEL[d]} enabled`}
                    type="checkbox"
                    checked={cfg.template[d].enabled}
                    onChange={(e) => {
                      const next = structuredClone(cfg);
                      next.template[d].enabled = e.target.checked;
                      setCfg(next);
                    }}
                  />{' '}
                  <span className="text-xs text-gray-500">Enabled</span>
                  <button
                    onClick={() => addRange(d)}
                    className="ml-auto px-2 py-1 border rounded text-xs transition hover:scale-105"
                  >
                    Add Range
                  </button>
                </div>
                {cfg.template[d].ranges.map((r, i) => (
                  <div key={i} className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-gray-500">From</span>
                    <input
                      aria-label={`Start time ${DAY_LABEL[d]} ${i + 1}`}
                      value={r.start}
                      onChange={(e) => setRange(d, i, 'start', e.target.value)}
                      className="border rounded px-2 py-1 w-24 text-sm"
                    />
                    <span className="text-xs text-gray-500">to</span>
                    <input
                      aria-label={`End time ${DAY_LABEL[d]} ${i + 1}`}
                      value={r.end}
                      onChange={(e) => setRange(d, i, 'end', e.target.value)}
                      className="border rounded px-2 py-1 w-24 text-sm"
                    />
                    <button onClick={() => delRange(d, i)} className="ml-auto px-2 py-1 border rounded text-xs">
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="border rounded p-4 bg-white">
          <div className="flex items-center justify-between mb-3">
            <div className="font-medium">Consult & Window</div>
            <div className="text-xs text-gray-500" title="These settings affect what patients see when booking">
              Help
            </div>
          </div>

          <div className="mb-3">
            <div className="text-sm text-gray-600 mb-2">Default visit duration</div>
            <div className="flex gap-2">
              {[15, 30, 60].map((m) => (
                <button
                  key={m}
                  onClick={() =>
                    setConsult((c) =>
                      c
                        ? { ...c, defaultMinutes: m }
                        : { defaultMinutes: m, bufferMinutes: 5, minAdvanceMinutes: 30, maxAdvanceDays: 30 },
                    )
                  }
                  className={`px-3 py-1 text-sm rounded ${
                    consult?.defaultMinutes === m ? 'bg-indigo-600 text-white shadow' : 'bg-gray-100 text-gray-700'
                  }`}
                  aria-pressed={consult?.defaultMinutes === m}
                >
                  {m}m
                </button>
              ))}
            </div>
          </div>

          <div className="mb-3">
            <div className="text-sm text-gray-600 mb-2">Working window (slot grid)</div>
            <div className="flex items-center gap-2 mb-2">
              <select
                aria-label="Window preset"
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === 'clinic') {
                    setSlotMin('08:00');
                    setSlotMax('17:00');
                  } else if (v === 'full') {
                    setSlotMin('00:00');
                    setSlotMax('23:59');
                  } else if (v === 'late') {
                    setSlotMin('18:00');
                    setSlotMax('03:00');
                  }
                }}
                defaultValue="custom"
                className="text-sm border rounded px-2 py-1"
              >
                <option value="custom">Custom</option>
                <option value="clinic">Clinic (08:00–17:00)</option>
                <option value="full">All day (00:00–23:59)</option>
                <option value="late">Late (18:00–03:00)</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">From</label>
              <input
                aria-label="From time"
                type="time"
                value={slotMin}
                onChange={(e) => setSlotMin(e.target.value)}
                className="border rounded px-2 py-1 text-sm"
              />
              <label className="text-xs text-gray-500">To</label>
              <input
                aria-label="To time"
                type="time"
                value={slotMax}
                onChange={(e) => setSlotMax(e.target.value)}
                className="border rounded px-2 py-1 text-sm"
              />
            </div>
            <div className="text-xs text-gray-500 mt-2">
              If <code>To</code> is earlier or equal to <code>From</code> this is interpreted as an overnight window
              (e.g. 18:00 → 03:00).
            </div>
          </div>

          <div className="font-medium mb-2">Exceptions & Holidays</div>
          <div className="flex items-center gap-2 mb-3">
            <label className="text-sm">Country</label>
            <input
              value={cfg.country}
              onChange={(e) => setCfg({ ...cfg, country: e.target.value.toUpperCase() })}
              className="border rounded px-2 py-1 w-24 text-sm"
            />
            <label className="text-sm ml-4">Timezone</label>
            <input
              value={cfg.timezone}
              onChange={(e) => setCfg({ ...cfg, timezone: e.target.value })}
              className="border rounded px-2 py-1 text-sm w-[220px]"
            />
          </div>

          <div className="space-y-2 mb-3">
            {cfg.exceptions.map((ex, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  aria-label={`Exception date ${i + 1}`}
                  type="date"
                  value={ex.date}
                  onChange={(e) => setException(i, e.target.value)}
                  className="border rounded px-2 py-1 text-sm"
                />
                <input
                  placeholder="reason (optional)"
                  value={ex.reason || ''}
                  onChange={(e) => {
                    const next = structuredClone(cfg);
                    next.exceptions[i].reason = e.target.value;
                    setCfg(next);
                  }}
                  className="border rounded px-2 py-1 text-sm w-64"
                />
                <button onClick={() => delException(i)} className="px-2 py-1 border rounded text-xs">
                  Remove
                </button>
              </div>
            ))}
            <button onClick={addException} className="px-2 py-1 border rounded text-xs">
              Add Exception
            </button>
          </div>
        </div>
      </section>

      {/* Calendar preview — pass window + default duration + preview mode */}
      <CalendarPreview
        clinicianId="clinician-local-001"
        initialView={patientView ? 'month' : 'week'}
        mode={patientView ? 'month' : 'week'}
        onSelectSlot={(startIso, endIso) => handleSlotClick(startIso, endIso)}
        slotMin={slotMin}
        slotMax={slotMax}
        defaultDuration={consult?.defaultMinutes ?? 30}
      />
    </main>
  );
}
