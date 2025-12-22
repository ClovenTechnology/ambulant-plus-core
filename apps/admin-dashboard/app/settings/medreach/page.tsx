// apps/admin-dashboard/app/settings/medreach/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type MedreachSettings = {
  defaultPhlebPayoutPercent: number;
  defaultLabCommissionPercent: number;
  drawSlaHours: {
    standard: number;
    urgent: number;
  };
  autoAssign: {
    enableAutoAssign: boolean;
    maxRadiusKm: number;
    rebalanceEveryMinutes: number;
  };
  notifications: {
    smsToPatient: boolean;
    smsToPhleb: boolean;
    emailToLab: boolean;
  };
};

const FALLBACK_CFG: MedreachSettings = {
  defaultPhlebPayoutPercent: 70,
  defaultLabCommissionPercent: 15,
  drawSlaHours: { standard: 48, urgent: 24 },
  autoAssign: {
    enableAutoAssign: true,
    maxRadiusKm: 20,
    rebalanceEveryMinutes: 10,
  },
  notifications: {
    smsToPatient: true,
    smsToPhleb: true,
    emailToLab: true,
  },
};

export default function MedreachSettingsPage() {
  const [cfg, setCfg] = useState<MedreachSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch('/api/settings/medreach', {
          cache: 'no-store',
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as MedreachSettings;
        if (!mounted) return;
        setCfg(data);
      } catch (e: any) {
        if (!mounted) return;
        setErr(
          e?.message ||
            'Using local MedReach defaults until /api/settings/medreach is wired.',
        );
        setCfg(FALLBACK_CFG);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  function update(path: string, value: any) {
    if (!cfg) return;
    const next: any = structuredClone(cfg);
    const keys = path.split('.');
    let cur = next;
    for (let i = 0; i < keys.length - 1; i++) {
      cur = cur[keys[i]];
    }
    cur[keys[keys.length - 1]] = value;
    setCfg(next);
    setSaved(false);
  }

  async function save() {
    if (!cfg) return;
    setSaving(true);
    setSaved(false);
    setErr(null);
    try {
      const res = await fetch('/api/settings/medreach', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cfg),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSaved(true);
    } catch (e: any) {
      setErr(e?.message || 'Unable to save MedReach settings.');
    } finally {
      setSaving(false);
    }
  }

  if (loading || !cfg) {
    return (
      <main className="p-6 text-sm text-gray-500">
        Loading MedReach settings…
      </main>
    );
  }

  return (
    <main className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">MedReach — Settings</h1>
          <p className="text-sm text-gray-500 mt-1">
            Configure lab partner economics, SLAs and phlebotomy routing for
            MedReach.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <Link
            href="/medreach"
            className="px-3 py-1.5 border rounded bg-white hover:bg-gray-50"
          >
            MedReach dashboard
          </Link>
          <Link
            href="/medreach/orders"
            className="px-3 py-1.5 border rounded bg-white hover:bg-gray-50"
          >
            Lab orders
          </Link>
          <Link
            href="/labs"
            className="px-3 py-1.5 border rounded bg-white hover:bg-gray-50"
          >
            Manage labs
          </Link>
        </div>
      </header>

      {err && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 p-2 rounded">
          {err}
        </div>
      )}

      {/* Top grid */}
      <section className="grid md:grid-cols-2 gap-4">
        {/* Economics */}
        <Card title="MedReach Economics" subtitle="Default rev share when no per-partner override exists.">
          <Num
            label="Phleb payout %"
            value={cfg.defaultPhlebPayoutPercent}
            suffix="%"
            onChange={(v) =>
              update(
                'defaultPhlebPayoutPercent',
                clampPercent(v),
              )
            }
          />
          <Num
            label="Lab commission %"
            value={cfg.defaultLabCommissionPercent}
            suffix="%"
            onChange={(v) =>
              update(
                'defaultLabCommissionPercent',
                clampPercent(v),
              )
            }
          />
        </Card>

        {/* SLA */}
        <Card title="Turnaround Targets" subtitle="Used for analytics, alerts and SLA breach flags.">
          <Num
            label="Standard draws — SLA (h)"
            value={cfg.drawSlaHours.standard}
            onChange={(v) =>
              update('drawSlaHours.standard', Math.max(1, v))
            }
          />
          <Num
            label="Urgent draws — SLA (h)"
            value={cfg.drawSlaHours.urgent}
            onChange={(v) =>
              update('drawSlaHours.urgent', Math.max(1, v))
            }
          />
        </Card>

        {/* Auto-assignment */}
        <Card title="Auto-Assignment" subtitle="Controls how MedReach auto-routes new draws to phlebs.">
          <Toggle
            label="Enable auto-assignment"
            checked={cfg.autoAssign.enableAutoAssign}
            onChange={(checked) =>
              update('autoAssign.enableAutoAssign', checked)
            }
          />
          <Num
            label="Max radius (km)"
            value={cfg.autoAssign.maxRadiusKm}
            onChange={(v) =>
              update(
                'autoAssign.maxRadiusKm',
                v < 0 ? 0 : v,
              )
            }
          />
          <Num
            label="Rebalance every (min)"
            value={cfg.autoAssign.rebalanceEveryMinutes}
            onChange={(v) =>
              update(
                'autoAssign.rebalanceEveryMinutes',
                v < 1 ? 1 : v,
              )
            }
          />
        </Card>

        {/* Notifications */}
        <Card title="Notifications" subtitle="Who gets notified when MedReach draws change state.">
          <Toggle
            label="SMS patient for scheduling / updates"
            checked={cfg.notifications.smsToPatient}
            onChange={(c) =>
              update('notifications.smsToPatient', c)
            }
          />
          <Toggle
            label="SMS phleb on new / reassigned job"
            checked={cfg.notifications.smsToPhleb}
            onChange={(c) =>
              update('notifications.smsToPhleb', c)
            }
          />
          <Toggle
            label="Email lab when result is ready to ingest"
            checked={cfg.notifications.emailToLab}
            onChange={(c) =>
              update('notifications.emailToLab', c)
            }
          />
        </Card>
      </section>

      {/* Save bar */}
      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="px-4 py-2 border rounded bg-black text-white text-sm disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save MedReach settings'}
        </button>
        {saved && (
          <span className="text-sm text-emerald-700">
            Saved ✓
          </span>
        )}
      </div>
    </main>
  );
}

/* ---------- UI helpers ---------- */

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
    <section className="border rounded-lg bg-white p-4 space-y-3">
      <div>
        <div className="font-medium text-sm">{title}</div>
        {subtitle && (
          <p className="text-xs text-gray-500 mt-0.5">
            {subtitle}
          </p>
        )}
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Num({
  label,
  value,
  onChange,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span className="text-gray-600">{label}</span>
      <span className="inline-flex items-center gap-1">
        <input
          type="number"
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) =>
            onChange(parseFloat(e.target.value || '0'))
          }
          className="w-24 border rounded px-2 py-1 text-right text-sm"
        />
        {suffix && (
          <span className="text-xs text-gray-500">
            {suffix}
          </span>
        )}
      </span>
    </label>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span className="text-gray-600">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4"
      />
    </label>
  );
}

function clampPercent(v: number) {
  if (!Number.isFinite(v)) return 0;
  if (v < 0) return 0;
  if (v > 100) return 100;
  return v;
}
