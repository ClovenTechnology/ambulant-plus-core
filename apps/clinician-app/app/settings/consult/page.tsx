// apps/clinician-app/app/settings/consult/page.tsx
'use client';

import { SettingsTabs } from '@/components/SettingsTabs';
import { useEffect, useMemo, useState } from 'react';
import SchedulePreview from '@/components/SchedulePreview';

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

  // Preview state (avoid rendering HTML error dumps)
  const [previewData, setPreviewData] = useState<any | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

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

        const safe: ConsultSettings = {
          defaultMinutes: data1?.clinician?.defaultStandardMin ?? 30,
          followupMinutes: data1?.clinician?.defaultFollowupMin ?? 15,
          bufferMinutes: data1?.effective?.bufferAfterMinutes ?? 5,
          joinGracePatientMin: data1?.effective?.joinGracePatientMin ?? 5,
          joinGraceClinicianMin: data1?.effective?.joinGraceClinicianMin ?? 5,
          minAdvanceMinutes: data1?.clinician?.minAdvanceMinutes ?? 30,
          maxAdvanceDays: data1?.clinician?.maxAdvanceDays ?? 30,
          locked: data1?.admin
            ? {
                bufferMinutes: !!data1.admin.bufferAfterMinutes,
                joinGracePatientMin: !!data1.admin.joinGracePatientMin,
                joinGraceClinicianMin: !!data1.admin.joinGraceClinicianMin,
                defaultMinutesMin: data1.admin.minStandardMinutes ?? undefined,
                followupMinutesMin: data1.admin.minFollowupMinutes ?? undefined,
              }
            : {},
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

  // Fetch preview after cfg is available
  useEffect(() => {
    if (!cfg) return;
    (async () => {
      setPreviewLoading(true);
      setPreviewData(null);
      setPreviewError(null);

      try {
        // start date = today (YYYY-MM-DD)
        const start = new Date().toISOString().slice(0, 10);
        const url = `/api/schedule/slots/batch?start=${encodeURIComponent(start)}&days=42`;
        const res = await fetch(url, {
          cache: 'no-store',
          headers: {
            Accept: 'application/json',
          },
        });

        const ct = res.headers.get('content-type') || '';
        if (!res.ok) {
          // If server returned e.g. 404 with HTML, avoid rendering it — surface friendly message
          const text = await res.text().catch(() => '');
          console.warn('Preview fetch error', { status: res.status, contentType: ct, text });
          setPreviewError(`Preview unavailable (status ${res.status}). See console for details.`);
          setPreviewLoading(false);
          return;
        }

        if (ct.includes('application/json')) {
          const json = await res.json();
          setPreviewData(json);
        } else {
          // Non-JSON response (likely HTML error page). Don't render it.
          const text = await res.text().catch(() => '');
          console.warn('Preview returned non-JSON; suppressing HTML output', { contentType: ct, text });
          setPreviewError(
            'Preview endpoint returned an HTML error (not JSON). The preview is unavailable — check the API or open the endpoint in a new tab for debugging.',
          );
        }
      } catch (e: any) {
        console.error('Failed to fetch preview', e);
        setPreviewError('Failed to load preview. See console for details.');
      } finally {
        setPreviewLoading(false);
      }
    })();
  }, [cfg]);

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
            clinician: {
              defaultStandardMin: cfg.defaultMinutes,
              defaultFollowupMin: cfg.followupMinutes,
              minAdvanceMinutes: cfg.minAdvanceMinutes,
              maxAdvanceDays: cfg.maxAdvanceDays,
            },
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
              <strong>Admin-controlled</strong> cannot be changed here. Use <em>Calendar Preview</em> below to see how
              patient booking will look.
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

      <section className="border rounded p-4 bg-white">
        <div className="font-medium mb-2">Calendar Preview (read-only)</div>

        {previewLoading && <div className="text-sm text-gray-600">Loading preview…</div>}

        {!previewLoading && previewError && (
          <div className="text-sm text-rose-600 space-y-2">
            <div>{previewError}</div>
            <div className="text-xs text-gray-600">
              You can open the preview endpoint in a new tab to inspect the full response (developer only):
              <div className="mt-1">
                <a
                  href={`/api/schedule/slots/batch?start=${new Date().toISOString().slice(0, 10)}&days=42`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-700 underline"
                >
                  Open preview endpoint
                </a>
              </div>
            </div>
          </div>
        )}

        {!previewLoading && !previewError && previewData && (
          // If SchedulePreview supports a `slots` prop it will use the data we fetched
          // otherwise it should still render based on clinician/admin settings inside.
          <SchedulePreview days={42} patientView={patientView} slots={previewData} />
        )}

        {!previewLoading && !previewError && !previewData && (
          <div className="text-sm text-gray-600">Preview is not available.</div>
        )}

        <div className="text-xs text-gray-600 mt-2">
          Preview is generated via /api/schedule/slots/batch and reflects Admin + Clinician settings, exceptions, and
          holidays.
        </div>
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

  return (
    <label className="text-sm flex items-center gap-2" aria-live="polite">
      <span className="w-56 text-gray-700">{label}</span>
      <input
        aria-label={typeof label === 'string' ? label : 'number input'}
        type="number"
        value={local}
        onChange={(e) => {
          setLocal(e.target.value);
          setError(null);
        }}
        onBlur={() => {
          const parsed = Number(local || 0);
          if (Number.isNaN(parsed)) {
            setError('Invalid number');
            setLocal(String(v || 0));
            return;
          }
          const floored = Math.floor(parsed);
          const clamped = clamp(floored);
          setLocal(String(clamped));
          onChange(clamped);
        }}
        className="border rounded px-2 py-1 w-28 disabled:opacity-60 focus:ring-2 focus:ring-indigo-200"
        disabled={disabled}
        min={min}
        max={max}
        step={step}
        aria-valuemin={min}
        aria-valuemax={max}
      />
      {suffix ? <span className="text-gray-500">{suffix}</span> : null}
      {error && <span className="text-xs text-rose-600 ml-2">{error}</span>}
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
