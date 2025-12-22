// apps/admin-dashboard/app/settings/consult/page.tsx
'use client';

import { useEffect, useState } from 'react';

/* ---------- Types & defaults ---------- */

type AdminConsultConfig = {
  bufferAfterMinutes: number;
  joinGracePatientMin: number;
  joinGraceClinicianMin: number;
  minStandardMinutes: number;
  minFollowupMinutes: number;
};

type ConsultSettingsApi = {
  admin?: Partial<AdminConsultConfig>;
  clinician?: unknown; // reserved for future use
  effective?: Partial<AdminConsultConfig>;
};

const DEFAULT_ADMIN: AdminConsultConfig = {
  bufferAfterMinutes: 5,
  joinGracePatientMin: 5,
  joinGraceClinicianMin: 5,
  minStandardMinutes: 15,
  minFollowupMinutes: 5,
};

/* ---------- Small UI primitives ---------- */

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-700">
      {children}
    </span>
  );
}

function NumberRow({
  label,
  helper,
  min,
  value,
  onChange,
}: {
  label: string;
  helper?: string;
  min: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="text-gray-700">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={min}
          className="w-24 rounded border px-2 py-1 text-right text-xs"
          value={Number.isFinite(value) ? value : min}
          onChange={(e) => {
            const raw = Number(e.target.value || min);
            onChange(Math.max(min, raw));
          }}
        />
        <span className="text-gray-500 text-[11px]">minutes</span>
      </div>
      {helper && (
        <span className="text-[11px] text-gray-500">{helper}</span>
      )}
    </label>
  );
}

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border bg-gray-50 p-4 space-y-3">
      <div>
        <div className="text-sm font-medium text-gray-900">{title}</div>
        {subtitle && (
          <div className="mt-0.5 text-[11px] text-gray-500">
            {subtitle}
          </div>
        )}
      </div>
      <div className="grid gap-3 md:grid-cols-2">{children}</div>
    </div>
  );
}

/* ---------- Page ---------- */

export default function AdminConsultSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [admin, setAdmin] = useState<AdminConsultConfig>(DEFAULT_ADMIN);
  const [effective, setEffective] = useState<Partial<AdminConsultConfig> | null>(null);

  // Load from API
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoading(true);
        setErr(null);
        const res = await fetch('/api/settings/consult', { cache: 'no-store' });
        if (!res.ok) throw new Error('Failed to fetch current settings');
        const data: ConsultSettingsApi = await res.json().catch(() => ({} as ConsultSettingsApi));

        if (!mounted) return;

        const nextAdmin: AdminConsultConfig = {
          bufferAfterMinutes:
            data.admin?.bufferAfterMinutes ?? DEFAULT_ADMIN.bufferAfterMinutes,
          joinGracePatientMin:
            data.admin?.joinGracePatientMin ?? DEFAULT_ADMIN.joinGracePatientMin,
          joinGraceClinicianMin:
            data.admin?.joinGraceClinicianMin ?? DEFAULT_ADMIN.joinGraceClinicianMin,
          minStandardMinutes:
            data.admin?.minStandardMinutes ?? DEFAULT_ADMIN.minStandardMinutes,
          minFollowupMinutes:
            data.admin?.minFollowupMinutes ?? DEFAULT_ADMIN.minFollowupMinutes,
        };

        setAdmin(nextAdmin);
        setEffective(data.effective ?? null);
      } catch (e: any) {
        console.error(e);
        if (!mounted) return;
        setErr(String(e?.message ?? 'Failed to load consult settings'));
        // fall back to defaults but keep UI usable
        setAdmin(DEFAULT_ADMIN);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  async function save() {
    setSaving(true);
    setSaved(false);
    setErr(null);
    try {
      const res = await fetch('/api/settings/consult/admin', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ admin }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || `Save failed (${res.status})`);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      console.error('admin save failed', e);
      setErr(String(e?.message || 'Save failed'));
    } finally {
      setSaving(false);
    }
  }

  function resetToDefaults() {
    setAdmin(DEFAULT_ADMIN);
    setSaved(false);
  }

  if (loading && !admin) {
    return <div className="text-sm text-gray-500">Loading consult settings…</div>;
  }

  const slotLengthStandard =
    admin.minStandardMinutes + admin.bufferAfterMinutes;
  const slotLengthFollowup =
    admin.minFollowupMinutes + admin.bufferAfterMinutes;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">
            Consultation engine — admin defaults
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            Control the minimum duration, grace windows and buffers that power
            all virtual and in-person consultations.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 text-[11px]">
          <div className="inline-flex items-center gap-2">
            <Badge>Standard slot ≈ {slotLengthStandard} min</Badge>
            <Badge>Follow-up slot ≈ {slotLengthFollowup} min</Badge>
          </div>
          {effective && (
            <span className="text-gray-500">
              Effective rules are calculated per tenant &amp; clinician class.
            </span>
          )}
        </div>
      </div>

      {err && (
        <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {err}
        </div>
      )}

      {/* Timing cards */}
      <section className="space-y-4">
        <Card
          title="Session duration & buffers"
          subtitle="Baseline timing rules for standard and follow-up consultations."
        >
          <NumberRow
            label="Minimum standard consult length"
            helper="Used for first-time or full assessments. Calendar slots will be at least this long."
            min={5}
            value={admin.minStandardMinutes}
            onChange={(v) =>
              setAdmin((a) => ({ ...a, minStandardMinutes: v }))
            }
          />
          <NumberRow
            label="Minimum follow-up consult length"
            helper="Shorter check-ins, result reviews and quick follow-ups."
            min={3}
            value={admin.minFollowupMinutes}
            onChange={(v) =>
              setAdmin((a) => ({ ...a, minFollowupMinutes: v }))
            }
          />
          <NumberRow
            label="Buffer after each session"
            helper="Protected time for notes, eRx and referrals before the next patient can book."
            min={0}
            value={admin.bufferAfterMinutes}
            onChange={(v) =>
              setAdmin((a) => ({ ...a, bufferAfterMinutes: v }))
            }
          />
        </Card>

        <Card
          title="Join & no-show grace windows"
          subtitle="How long the system waits before treating someone as late or no-show."
        >
          <NumberRow
            label="Patient join grace window"
            helper="How long a patient can be late before the session can be marked as no-show."
            min={0}
            value={admin.joinGracePatientMin}
            onChange={(v) =>
              setAdmin((a) => ({ ...a, joinGracePatientMin: v }))
            }
          />
          <NumberRow
            label="Clinician join grace window"
            helper="Used for internal SLAs and alerting — patients can see when a clinician is running behind."
            min={0}
            value={admin.joinGraceClinicianMin}
            onChange={(v) =>
              setAdmin((a) => ({ ...a, joinGraceClinicianMin: v }))
            }
          />
        </Card>
      </section>

      {/* Effective summary (if backend provides it) */}
      {effective && (
        <section className="rounded-2xl border bg-gray-50 px-4 py-3 text-[11px] text-gray-600 space-y-1">
          <div className="font-medium text-gray-800">
            Effective tenant-level rules (read-only)
          </div>
          <div>
            Standard consults are at least{' '}
            <span className="font-semibold">
              {effective.minStandardMinutes ?? admin.minStandardMinutes} minutes
            </span>{' '}
            with a{' '}
            <span className="font-semibold">
              {effective.bufferAfterMinutes ?? admin.bufferAfterMinutes}{' '}
              minute buffer
            </span>
            , and follow-ups are at least{' '}
            <span className="font-semibold">
              {effective.minFollowupMinutes ?? admin.minFollowupMinutes} minutes
            </span>
            . Patients have{' '}
            <span className="font-semibold">
              {effective.joinGracePatientMin ?? admin.joinGracePatientMin} min
            </span>{' '}
            to join before a potential no-show, and clinicians have{' '}
            <span className="font-semibold">
              {effective.joinGraceClinicianMin ??
                admin.joinGraceClinicianMin}{' '}
              min
            </span>{' '}
            before internal alerts may trigger.
          </div>
        </section>
      )}

      {/* Save actions */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center rounded-md border border-black bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save consult rules'}
        </button>
        <button
          type="button"
          onClick={resetToDefaults}
          className="text-xs text-gray-600 underline-offset-2 hover:underline"
        >
          Reset to platform defaults
        </button>
        {saved && (
          <span className="text-xs text-emerald-700">
            Saved ✓
          </span>
        )}
      </div>
    </div>
  );
}
