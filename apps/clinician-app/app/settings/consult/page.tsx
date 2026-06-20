// apps/clinician-app/app/settings/consult/page.tsx
'use client';

import { SettingsTabs } from '@/components/SettingsTabs';
import { useEffect, useMemo, useState } from 'react';
import CalendarPreview from '@/components/CalendarPreview';

type Refunds = {
  within24hPercent: number;
  noShowPercent: number;
  clinicianMissPercent: number;
  networkProrate: boolean;
};

type ConsultSettings = {
  defaultMinutes: number;
  followupMinutes: number;
  bufferMinutes: number;
  joinGracePatientMin: number;
  joinGraceClinicianMin: number;
  minAdvanceMinutes: number;
  maxAdvanceDays: number;
  locked: {
    bufferMinutes?: boolean;
    joinGracePatientMin?: boolean;
    joinGraceClinicianMin?: boolean;
    defaultMinutesMin?: number;
    followupMinutesMin?: number;
  };
};

function Badge() {
  return (
    <span
      className="ml-2 text-[10px] tracking-wide uppercase rounded-full border px-2 py-0.5 text-gray-700 bg-gray-50"
      aria-hidden
    >
      Admin-controlled
    </span>
  );
}

function clampPct(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export default function ConsultSettingsPage() {
  const [cfg, setCfg] = useState<ConsultSettings | null>(null);
  const [refunds, setRefunds] = useState<Refunds | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // --- Onboarding callout
  const ONBOARD_KEY = 'clinician:onboard:consult';
  const [showOnboard, setShowOnboard] = useState(() => {
    try {
      return localStorage.getItem(ONBOARD_KEY) !== 'dismissed';
    } catch {
      return true;
    }
  });
  function dismissOnboard() {
    try {
      localStorage.setItem(ONBOARD_KEY, 'dismissed');
    } catch {}
    setShowOnboard(false);
  }

  const [patientView, setPatientView] = useState(false);
  useEffect(() => {
    (async () => {
      try {
        const [r1, r2] = await Promise.all([
          fetch('/api/settings/consult', { cache: 'no-store' }),
          fetch('/api/settings/refunds', { cache: 'no-store' }),
        ]);

        if (!r1.ok || !r2.ok) {
          // throw to fallback block and set sensible defaults
          throw new Error(`Failed to fetch settings: ${r1.status}/${r2.status}`);
        }

        const data1 = (await r1.json()) || {};
        const data2 = (await r2.json()) || {};

        const clinicianCfg = data1?.clinician || data1 || {};
        const effectiveCfg = data1?.effective || data1 || {};
        const adminCfg = data1?.admin || data1?.adminMinimums || {};

        const safe: ConsultSettings = {
          defaultMinutes:
            clinicianCfg.defaultStandardMin ??
            data1?.defaultStandardMin ??
            data1?.defaultMinutes ??
            30,
          followupMinutes:
            clinicianCfg.defaultFollowupMin ??
            data1?.defaultFollowupMin ??
            data1?.followupMinutes ??
            15,
          bufferMinutes:
            effectiveCfg.bufferAfterMinutes ??
            data1?.bufferMinutes ??
            5,
          joinGracePatientMin:
            effectiveCfg.joinGracePatientMin ??
            adminCfg.joinGracePatientMin ??
            data1?.joinGracePatientMin ??
            5,
          joinGraceClinicianMin:
            effectiveCfg.joinGraceClinicianMin ??
            adminCfg.joinGraceClinicianMin ??
            data1?.joinGraceClinicianMin ??
            5,
          minAdvanceMinutes:
            clinicianCfg.minAdvanceMinutes ??
            data1?.minAdvanceMinutes ??
            30,
          maxAdvanceDays:
            clinicianCfg.maxAdvanceDays ??
            data1?.maxAdvanceDays ??
            30,
          locked: {
            bufferMinutes: false,
            joinGracePatientMin: true,
            joinGraceClinicianMin: true,
            defaultMinutesMin: adminCfg.minStandardMinutes ?? undefined,
            followupMinutesMin: adminCfg.minFollowupMinutes ?? undefined,
          },
        };
        setCfg(safe);

        setRefunds({
          within24hPercent: data2?.within24hPercent ?? 50,
          noShowPercent: data2?.noShowPercent ?? 0,
          clinicianMissPercent: data2?.clinicianMissPercent ?? 100,
          networkProrate: !!data2?.networkProrate,
        });
      } catch (e: any) {
        console.error('Failed to load consult/refund settings', e);
        setErr(e?.message || 'Failed to load settings');
        // fallback values so the page renders
        setCfg({
          defaultMinutes: 30,
          followupMinutes: 15,
          bufferMinutes: 5,
          joinGracePatientMin: 5,
          joinGraceClinicianMin: 5,
          minAdvanceMinutes: 30,
          maxAdvanceDays: 30,
          locked: {},
        });
        setRefunds({
          within24hPercent: 50,
          noShowPercent: 0,
          clinicianMissPercent: 100,
          networkProrate: false,
        });
      }
    })();
  }, []);

  const canEdit = useMemo(
    () => ({
      buffer: !(cfg?.locked.bufferMinutes),
      // per your request: join grace windows are strictly admin controlled and should be readonly to clinicians
      graceP: false,
      graceC: false,
    }),
    [cfg],
  );

  async function save() {
    if (!cfg || !refunds) return;
    // simple client-side sanity checks
    if (cfg.defaultMinutes < 1 || cfg.followupMinutes < 1) {
      setErr('Durations must be at least 1 minute.');
      return;
    }
    setSaving(true);
    setSaved(false);
    setErr(null);
    try {
      const [r1, r2] = await Promise.all([
        fetch('/api/settings/consult', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            defaultStandardMin: cfg.defaultMinutes,
            defaultFollowupMin: cfg.followupMinutes,
            defaultMinutes: cfg.defaultMinutes,
            followupMinutes: cfg.followupMinutes,
            bufferMinutes: cfg.bufferMinutes,
            minAdvanceMinutes: cfg.minAdvanceMinutes,
            maxAdvanceDays: cfg.maxAdvanceDays,
          }),
        }),
        fetch('/api/settings/refunds', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(refunds),
        }),
      ]);
      if (!r1.ok || !r2.ok) {
        // try to get server message
        let srvMsg = '';
        try {
          const jr1 = await r1.json().catch(() => null);
          const jr2 = await r2.json().catch(() => null);
          srvMsg = (jr1?.message || jr2?.message) ?? '';
        } catch {}
        throw new Error(`Save failed ${r1.status}/${r2.status} ${srvMsg}`);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      console.error('Save failed', e);
      setErr(e?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (!cfg || !refunds) return <main className="p-6">Loading…</main>;

  return (
    <main className="p-6 space-y-6">
      <SettingsTabs />

      {/* existing Consult Settings layout */}
      <h1 className="text-lg font-semibold">Consult Settings</h1>

      {err && (
        <div role="alert" className="text-sm text-rose-600">
          {err}
        </div>
      )}

      {showOnboard && (
        <div
          className="border-l-4 border-indigo-600 bg-indigo-50 p-3 rounded flex items-start gap-3"
          role="note"
        >
          <div className="flex-1 text-sm">
            <div className="font-medium">Welcome — quick tips</div>
            <div className="text-xs text-gray-700 mt-1">
              This panel sets default durations, buffer time, and booking windows. Fields marked{' '}
              <strong>Admin-controlled</strong> cannot be changed here. Use the availability preview below to see how patient booking will look.
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <button onClick={dismissOnboard} className="px-2 py-1 text-xs rounded border bg-white">
              Dismiss
            </button>
            <button onClick={() => setShowOnboard(false)} className="px-2 py-1 text-xs text-indigo-700">
              Close temporarily
            </button>
          </div>
        </div>
      )}

      <section className="grid md:grid-cols-2 gap-4">
        <Card title="Durations">
          <Num
            label={
              `Standard Session (min)` +
              (cfg.locked.defaultMinutesMin ? ` — min ${cfg.locked.defaultMinutesMin}` : '')
            }
            v={cfg.defaultMinutes}
            onChange={(n) =>
              setCfg({
                ...cfg,
                defaultMinutes: Math.max(cfg.locked.defaultMinutesMin ?? 0, Math.floor(n || 0)),
              })
            }
            min={cfg.locked.defaultMinutesMin ?? 0}
          />
          <Num
            label={
              `Follow-up Session (min)` +
              (cfg.locked.followupMinutesMin ? ` — min ${cfg.locked.followupMinutesMin}` : '')
            }
            v={cfg.followupMinutes}
            onChange={(n) =>
              setCfg({
                ...cfg,
                followupMinutes: Math.max(cfg.locked.followupMinutesMin ?? 0, Math.floor(n || 0)),
              })
            }
            min={cfg.locked.followupMinutesMin ?? 0}
          />
          <div className="col-span-2 flex items-center">
            <Num
              label="Buffer After Session (min)"
              v={cfg.bufferMinutes}
              onChange={(n) => setCfg({ ...cfg, bufferMinutes: Math.max(0, Math.floor(n || 0)) })}
              disabled={!canEdit.buffer}
              min={0}
            />
            {!canEdit.buffer && <Badge />}
          </div>
        </Card>

        <Card title="Join Grace Windows">
          {/* Per your request these are strictly admin-controlled — readonly for clinicians */}
          <div className="col-span-2 flex items-center">
            <Num
              label={
                <span>
                  Join Grace (Patient, min)
                  <span title="Set by Admin — clinicians see this as read-only."> ⓘ</span>
                </span>
              }
              v={cfg.joinGracePatientMin}
              onChange={(n) => setCfg({ ...cfg, joinGracePatientMin: Math.max(0, Math.floor(n || 0)) })}
              disabled={true}
              min={0}
            />
            <Badge />
          </div>
          <div className="col-span-2 flex items-center">
            <Num
              label={
                <span>
                  Join Grace (Clinician, min)
                  <span title="Set by Admin — clinicians see this as read-only."> ⓘ</span>
                </span>
              }
              v={cfg.joinGraceClinicianMin}
              onChange={(n) => setCfg({ ...cfg, joinGraceClinicianMin: Math.max(0, Math.floor(n || 0)) })}
              disabled={true}
              min={0}
            />
            <Badge />
          </div>
        </Card>

        <Card title="Booking Window">
          <Num
            label={
              <span>
                Minimum Advance (min)
                <span title="How many minutes before an appointment a patient may book."> ⓘ</span>
              </span>
            }
            v={cfg.minAdvanceMinutes}
            onChange={(n) => setCfg({ ...cfg, minAdvanceMinutes: Math.max(0, Math.floor(n || 0)) })}
            min={0}
          />
          <Num
            label={
              <span>
                Maximum Advance (days)
                <span title="How many days in advance a patient can book."> ⓘ</span>
              </span>
            }
            v={cfg.maxAdvanceDays}
            onChange={(n) => setCfg({ ...cfg, maxAdvanceDays: Math.max(0, Math.floor(n || 0)) })}
            min={0}
          />
        </Card>

        <Card title="Cancellation / Refunds">
          <Num
            label="< 24h Cancel Refund"
            v={refunds.within24hPercent}
            onChange={(n) => setRefunds({ ...refunds, within24hPercent: clampPct(n) })}
            suffix="%"
            min={0}
            max={100}
          />
          <Num
            label="No-show Refund"
            v={refunds.noShowPercent}
            onChange={(n) => setRefunds({ ...refunds, noShowPercent: clampPct(n) })}
            suffix="%"
            min={0}
            max={100}
          />
          <Num
            label="Clinician Miss Refund"
            v={refunds.clinicianMissPercent}
            onChange={(n) => setRefunds({ ...refunds, clinicianMissPercent: clampPct(n) })}
            suffix="%"
            min={0}
            max={100}
          />
          <Toggle
            label="Network Interrupted → Prorate by time"
            v={refunds.networkProrate}
            onChange={(b) => setRefunds({ ...refunds, networkProrate: b })}
          />
        </Card>
      </section>

      <div className="flex items-center gap-2">
        <button
          onClick={save}
          disabled={saving}
          className="px-4 py-2 border rounded bg-black text-white relative focus:outline-none focus:ring-2 focus:ring-indigo-300"
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
        {saved && (
          <span className="text-green-700 text-sm mt-2 flex items-center gap-1" aria-live="polite">
            <svg className="w-4 h-4 animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
              <path d="M20 6L9 17l-5-5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Saved ✓
          </span>
        )}

        <label className="flex items-center gap-2 text-sm ml-4">
          <input
            type="checkbox"
            checked={patientView}
            onChange={(e) => setPatientView(e.target.checked)}
            className="focus:ring-2 focus:ring-indigo-200"
            aria-checked={patientView}
          />
          <span>Patient view</span>
        </label>
      </div>

      <section className="space-y-2">
        <div className="font-medium">Availability preview</div>
        <p className="text-xs text-gray-600">
          These are the booking slots patients will see, based on your saved schedule, consult duration, buffer, and booking window.
        </p>
        <CalendarPreview
          clinicianId="me"
          initialView={patientView ? 'month' : 'week'}
          useBatchForWeek={!patientView}
        />
      </section>
    </main>
  );
}

function Card({ title, children }: { title: string; children: any }) {
  return (
    <div className="border rounded p-4 bg-white">
      <div className="font-medium mb-2">{title}</div>
      <div className="grid grid-cols-2 gap-2">{children}</div>
    </div>
  );
}

function Num({
  label,
  v,
  onChange,
  disabled,
  suffix,
  min,
  max,
  step = 1,
}: {
  label: string | JSX.Element;
  v: number;
  onChange: (n: number) => void;
  disabled?: boolean;
  suffix?: string;
  min?: number;
  max?: number;
  step?: number;
}) {
  const [local, setLocal] = useState(String(v ?? ''));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLocal(String(v ?? ''));
    setError(null);
  }, [v]);

  const clamp = (n: number) => {
    let out = n;
    if (min !== undefined) out = Math.max(min, out);
    if (max !== undefined) out = Math.min(max, out);
    return out;
  };

  function commit(raw: string, mode: 'live' | 'blur') {
    const trimmed = String(raw ?? '').trim();

    if (!trimmed) {
      if (mode === 'blur') {
        const next = clamp(0);
        setLocal(String(next));
        onChange(next);
      }
      return;
    }

    const parsed = Number(trimmed);

    if (!Number.isFinite(parsed)) {
      if (mode === 'blur') {
        setError('Enter a valid number.');
      }
      return;
    }

    const next = mode === 'blur'
      ? clamp(Math.floor(parsed))
      : Math.floor(parsed);

    onChange(next);

    if (mode === 'blur') {
      setLocal(String(next));
      setError(null);
    }
  }

  return (
    <label className="text-sm flex items-center gap-2" aria-live="polite">
      <span className="w-56 text-gray-700">{label}</span>
      <input
        aria-label={typeof label === 'string' ? label : 'number input'}
        type="number"
        value={local}
        onChange={(e) => {
          const next = e.target.value;
          setLocal(next);
          setError(null);
          commit(next, 'live');
        }}
        onBlur={() => commit(local, 'blur')}
        disabled={disabled}
        min={min}
        max={max}
        step={step}
        className="border rounded px-2 py-1 w-28 disabled:bg-gray-50"
      />
      {suffix && <span className="text-gray-600">{suffix}</span>}
      {error && <span className="text-xs text-rose-600">{error}</span>}
    </label>
  );
}

function Toggle({ label, v, onChange }: { label: string; v: boolean; onChange: (b: boolean) => void }) {
  return (
    <label className="text-sm flex items-center gap-2">
      <span className="w-56 text-gray-700">{label}</span>
      <input
        type="checkbox"
        checked={v}
        onChange={(e) => onChange(e.target.checked)}
        className="focus:ring-2 focus:ring-indigo-200"
        aria-checked={v}
      />
    </label>
  );
}
