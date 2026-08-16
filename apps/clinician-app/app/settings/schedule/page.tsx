// file: apps/clinician-app/app/settings/schedule/page.tsx
'use client';
import Link from 'next/link';
import { SettingsTabs } from '@/components/SettingsTabs';
import { useEffect, useState } from 'react';
import CalendarPreview from '../../../components/CalendarPreview';

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
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewRevision, setPreviewRevision] = useState(0);


  // onboarding flag (first-run callout)
  const ONBOARD_KEY = 'clinician:seenScheduleOnboard';
  const [showOnboard, setShowOnboard] = useState(false);



  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/settings/schedule', {
          cache: 'no-store',
        });
        const savedSchedule = response.ok
          ? await response.json()
          : DEFAULT;
        const merged = {
          ...DEFAULT,
          ...savedSchedule,
          template: {
            ...DEFAULT.template,
            ...(savedSchedule?.template || {}),
          },
          exceptions: Array.isArray(savedSchedule?.exceptions)
            ? savedSchedule.exceptions
            : [],
        } as ScheduleConfig;
        setCfg(merged);
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

  async function save() {
    const timeRe = /^\d{2}:\d{2}$/;

    for (const day of DAYS) {
      const dayTemplate = cfg.template[day];

      if (!dayTemplate.enabled) continue;

      for (const range of dayTemplate.ranges) {
        if (
          !timeRe.test(range.start) ||
          !timeRe.test(range.end)
        ) {
          showToast(
            `Please enter valid ${DAY_LABEL[day]} times (HH:mm).`,
            { type: 'err' },
          );
          return;
        }
      }
    }

    if (!cfg.timezone.trim()) {
      showToast('Timezone is required.', { type: 'err' });
      return;
    }

    setSaving(true);

    try {
      const response = await fetch('/api/settings/schedule', {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          country: cfg.country,
          timezone: cfg.timezone,
          template: cfg.template,
          exceptions: cfg.exceptions,
        }),
      });

      if (!response.ok) {
        const detail = await response
          .text()
          .catch(() => '');

        console.error(
          'schedule save error',
          response.status,
          detail,
        );

        showToast(
          'Failed to save availability schedule.',
          { type: 'err' },
        );

        return;
      }

      setSaved(true);
      setPreviewRevision((value) => value + 1);
      showToast('Availability schedule saved.', {
        type: 'ok',
      });

      setTimeout(
        () => setSaved(false),
        3000,
      );
    } catch (error) {
      console.error(
        'schedule save exception',
        error,
      );

      showToast(
        'Save error: network or server problem.',
        { type: 'err' },
      );
    } finally {
      setSaving(false);
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
              Configure weekly availability, timezone, and exceptions here. Consultation durations, buffer, and booking
              windows are managed separately in Consult Settings.
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

          <button
            onClick={save}
            disabled={saving}
            className={`px-3 py-1 border rounded ${
              saving ? 'bg-gray-200 text-gray-600 cursor-wait' : 'bg-black text-white'
            } transition-transform ${saved ? 'transform scale-105 shadow-md' : ''}`}
            title="Save availability schedule"
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
          <div className="mb-4">
            <div className="font-medium">Schedule scope</div>
            <p className="mt-2 text-sm text-gray-600">
              This page controls recurring availability, timezone, and date exceptions only.
              Consultation duration, follow-up duration, buffer, and booking-window rules are owned by Consult Settings.
            </p>
            <Link
              href="/settings/consult"
              className="mt-3 inline-flex rounded border px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-50"
            >
              Open Consult Settings
            </Link>
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

      <section className="space-y-2">
        <div className="font-medium">Canonical availability preview</div>
        <p className="text-xs text-gray-600">
          This preview is generated by the server from your saved schedule and Consult Settings.
          Unsaved edits appear after you save.
        </p>
        <CalendarPreview
          clinicianId="me"
          initialView="week"
          useBatchForWeek
          refreshKey={previewRevision}
        />
      </section>
    </main>
  );
}
