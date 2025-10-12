// apps/clinician-app/app/settings/consult/page.tsx
'use client';

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
    <span className="ml-2 text-[10px] tracking-wide uppercase rounded-full border px-2 py-0.5 text-gray-700 bg-gray-50">
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

  useEffect(() => {
    (async () => {
      try {
        const [r1, r2] = await Promise.all([
          fetch('/api/settings/consult', { cache: 'no-store' }),
          fetch('/api/settings/refunds', { cache: 'no-store' }),
        ]);
        const data1 = await r1.json();
        const data2 = await r2.json();

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
        setErr(e?.message || 'Failed to load');
      }
    })();
  }, []);

  const canEdit = useMemo(
    () => ({
      buffer: !(cfg?.locked.bufferMinutes),
      graceP: !(cfg?.locked.joinGracePatientMin),
      graceC: !(cfg?.locked.joinGraceClinicianMin),
    }),
    [cfg]
  );

  async function save() {
    if (!cfg || !refunds) return;
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
      if (!r1.ok || !r2.ok) throw new Error('Save failed');
      setSaved(true);
    } catch (e: any) {
      setErr(e?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (!cfg || !refunds) return <main className="p-6">Loading…</main>;

  return (
    <main className="p-6 space-y-6">
      <h1 className="text-lg font-semibold">Consult Settings</h1>
      {err && <div className="text-sm text-rose-600">{err}</div>}

      <section className="grid md:grid-cols-2 gap-4">
        <Card title="Durations">
          <Num
            label={`Standard Session (min)` + (cfg.locked.defaultMinutesMin ? ` — min ${cfg.locked.defaultMinutesMin}` : '')}
            v={cfg.defaultMinutes}
            onChange={(n) =>
              setCfg({ ...cfg, defaultMinutes: Math.max(cfg.locked.defaultMinutesMin ?? 0, Math.floor(n || 0)) })
            }
          />
          <Num
            label={`Follow-up Session (min)` + (cfg.locked.followupMinutesMin ? ` — min ${cfg.locked.followupMinutesMin}` : '')}
            v={cfg.followupMinutes}
            onChange={(n) =>
              setCfg({ ...cfg, followupMinutes: Math.max(cfg.locked.followupMinutesMin ?? 0, Math.floor(n || 0)) })
            }
          />
          <div className="col-span-2 flex items-center">
            <Num
              label="Buffer After Session (min)"
              v={cfg.bufferMinutes}
              onChange={(n) => setCfg({ ...cfg, bufferMinutes: Math.max(0, Math.floor(n || 0)) })}
              disabled={!canEdit.buffer}
            />
            {!canEdit.buffer && <Badge />}
          </div>
        </Card>

        <Card title="Join Grace Windows">
          <div className="col-span-2 flex items-center">
            <Num
              label="Join Grace (Patient, min)"
              v={cfg.joinGracePatientMin}
              onChange={(n) => setCfg({ ...cfg, joinGracePatientMin: Math.max(0, Math.floor(n || 0)) })}
              disabled={!canEdit.graceP}
            />
            {!canEdit.graceP && <Badge />}
          </div>
          <div className="col-span-2 flex items-center">
            <Num
              label="Join Grace (Clinician, min)"
              v={cfg.joinGraceClinicianMin}
              onChange={(n) => setCfg({ ...cfg, joinGraceClinicianMin: Math.max(0, Math.floor(n || 0)) })}
              disabled={!canEdit.graceC}
            />
            {!canEdit.graceC && <Badge />}
          </div>
        </Card>

        <Card title="Booking Window">
          <Num
            label="Minimum Advance (min)"
            v={cfg.minAdvanceMinutes}
            onChange={(n) => setCfg({ ...cfg, minAdvanceMinutes: Math.max(0, Math.floor(n || 0)) })}
          />
          <Num
            label="Maximum Advance (days)"
            v={cfg.maxAdvanceDays}
            onChange={(n) => setCfg({ ...cfg, maxAdvanceDays: Math.max(0, Math.floor(n || 0)) })}
          />
        </Card>

        <Card title="Cancellation / Refunds">
          <Num
            label="< 24h Cancel Refund"
            v={refunds.within24hPercent}
            onChange={(n) => setRefunds({ ...refunds, within24hPercent: clampPct(n) })}
            suffix="%"
          />
          <Num
            label="No-show Refund"
            v={refunds.noShowPercent}
            onChange={(n) => setRefunds({ ...refunds, noShowPercent: clampPct(n) })}
            suffix="%"
          />
          <Num
            label="Clinician Miss Refund"
            v={refunds.clinicianMissPercent}
            onChange={(n) => setRefunds({ ...refunds, clinicianMissPercent: clampPct(n) })}
            suffix="%"
          />
          <Toggle
            label="Network Interrupted → Prorate by time"
            v={refunds.networkProrate}
            onChange={(b) => setRefunds({ ...refunds, networkProrate: b })}
          />
        </Card>
      </section>

      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={saving}
          className="px-4 py-2 border rounded bg-black text-white"
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
        {saved && <span className="text-green-700 text-sm mt-2">Saved ✓</span>}
      </div>

      <section className="border rounded p-4 bg-white">
        <div className="font-medium mb-2">Calendar Preview (read-only)</div>
        <SchedulePreview days={42} />
        <div className="text-xs text-gray-600 mt-2">
          Preview is generated via /api/schedule/slots/batch and reflects Admin + Clinician settings, exceptions, and holidays.
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
}: {
  label: string;
  v: number;
  onChange: (n: number) => void;
  disabled?: boolean;
  suffix?: string;
}) {
  return (
    <label className="text-sm flex items-center gap-2">
      <span className="w-56 text-gray-600">{label}</span>
      <input
        type="number"
        value={v}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="border rounded px-2 py-1 w-28 disabled:opacity-60"
        disabled={disabled}
      />
      {suffix ? <span className="text-gray-500">{suffix}</span> : null}
    </label>
  );
}

function Toggle({
  label,
  v,
  onChange,
}: {
  label: string;
  v: boolean;
  onChange: (b: boolean) => void;
}) {
  return (
    <label className="text-sm flex items-center gap-2">
      <span className="w-56 text-gray-600">{label}</span>
      <input type="checkbox" checked={v} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}
