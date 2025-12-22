// apps/admin-dashboard/app/settings/insightcore/page.tsx
'use client';

import { useEffect, useState } from 'react';

/* ---------- Types ---------- */

type HeartRateCfg = { min: number; max: number };
type SpO2Cfg = { min: number };
type TemperatureCfg = { max: number };
type BpCfg = { systolicMax: number; diastolicMax: number };
type GlucoseInstabilityCfg = { threshold: number };
type RiskScoringCfg = { alertScoreMin: number };

export type InsightCoreConfig = {
  heartRate?: HeartRateCfg;
  spo2?: SpO2Cfg;
  temperature?: TemperatureCfg;
  bp?: BpCfg;
  glucoseInstability?: GlucoseInstabilityCfg;
  riskScoring?: RiskScoringCfg;
  // Allow future expansion without breaking
  [key: string]: unknown;
};

const DEFAULT_CFG: InsightCoreConfig = {
  heartRate: { min: 50, max: 110 },
  spo2: { min: 94 },
  temperature: { max: 38.0 },
  bp: { systolicMax: 140, diastolicMax: 90 },
  glucoseInstability: { threshold: 0.35 },
  riskScoring: { alertScoreMin: 0.65 },
};

/* ---------- Small UI primitives ---------- */

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-700">
      {children}
    </span>
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
    <div className="rounded-2xl border bg-white p-4 space-y-3 shadow-sm">
      <div>
        <div className="text-sm font-medium text-gray-900">{title}</div>
        {subtitle && (
          <div className="mt-0.5 text-[11px] text-gray-500">{subtitle}</div>
        )}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function NumberField({
  label,
  suffix,
  step = 1,
  value,
  onChange,
}: {
  label: string;
  suffix?: string;
  step?: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="text-gray-700">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="number"
          step={step}
          className="w-28 rounded border px-2 py-1 text-right text-xs"
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) => {
            const raw = parseFloat(e.target.value || '0');
            onChange(Number.isFinite(raw) ? raw : 0);
          }}
        />
        {suffix && (
          <span className="text-[11px] text-gray-500 whitespace-nowrap">
            {suffix}
          </span>
        )}
      </div>
    </label>
  );
}

/* ---------- Page ---------- */

export default function InsightCoreSettings() {
  const [cfg, setCfg] = useState<InsightCoreConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Load config from API
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoading(true);
        setErr(null);
        const res = await fetch('/api/insightcore/config', {
          cache: 'no-store',
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json().catch(() => ({}))) as InsightCoreConfig;
        if (!mounted) return;

        // Merge with defaults to avoid undefined access
        const merged: InsightCoreConfig = {
          ...DEFAULT_CFG,
          ...json,
          heartRate: { ...DEFAULT_CFG.heartRate, ...json.heartRate },
          spo2: { ...DEFAULT_CFG.spo2, ...json.spo2 },
          temperature: {
            ...DEFAULT_CFG.temperature,
            ...json.temperature,
          },
          bp: { ...DEFAULT_CFG.bp, ...json.bp },
          glucoseInstability: {
            ...DEFAULT_CFG.glucoseInstability,
            ...json.glucoseInstability,
          },
          riskScoring: {
            ...DEFAULT_CFG.riskScoring,
            ...json.riskScoring,
          },
        };

        setCfg(merged);
      } catch (e: any) {
        console.error('InsightCore config load error', e);
        if (!mounted) return;
        setErr(
          e?.message ||
            'Failed to load InsightCore configuration. Using safe defaults.',
        );
        setCfg(DEFAULT_CFG);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  async function save() {
    if (!cfg) return;
    setSaving(true);
    setSaved(false);
    setErr(null);
    try {
      const res = await fetch('/api/insightcore/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cfg),
      });
      if (!res.ok) throw new Error(`Save failed (${res.status})`);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      console.error('InsightCore config save error', e);
      setErr(e?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  function resetToDefaults() {
    setCfg(DEFAULT_CFG);
    setSaved(false);
  }

  if (!cfg || loading) {
    return (
      <div className="p-4 text-sm text-gray-500">
        Loading InsightCore thresholds…
      </div>
    );
  }

  const hr = cfg.heartRate ?? DEFAULT_CFG.heartRate!;
  const spo2 = cfg.spo2 ?? DEFAULT_CFG.spo2!;
  const temp = cfg.temperature ?? DEFAULT_CFG.temperature!;
  const bp = cfg.bp ?? DEFAULT_CFG.bp!;
  const gluc = cfg.glucoseInstability ?? DEFAULT_CFG.glucoseInstability!;
  const risk = cfg.riskScoring ?? DEFAULT_CFG.riskScoring!;

  return (
    <div className="space-y-5">
      {/* Header */}
      <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">
            InsightCore thresholds
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            Configure how IoMT vitals and risk scores turn into alerts across
            the platform. Changes take effect in real-time for new data.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 text-[11px]">
          <div className="inline-flex flex-wrap gap-1">
            <Badge>
              HR {hr.min}–{hr.max} bpm
            </Badge>
            <Badge>SpO₂ &ge; {spo2.min}%</Badge>
            <Badge>Temp &le; {temp.max.toFixed(1)} °C</Badge>
          </div>
          <div className="inline-flex flex-wrap gap-1">
            <Badge>
              BP &le; {bp.systolicMax}/{bp.diastolicMax} mmHg
            </Badge>
            <Badge>Glucose Δ &gt; {gluc.threshold.toFixed(2)}</Badge>
            <Badge>Risk score alert &ge; {risk.alertScoreMin.toFixed(2)}</Badge>
          </div>
        </div>
      </header>

      {err && (
        <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {err}
        </div>
      )}

      {/* Threshold groups */}
      <section className="grid gap-4 lg:grid-cols-3">
        {/* Card 1: Core vitals */}
        <Card
          title="Core vitals"
          subtitle="Baseline ranges for common continuous/spot vitals."
        >
          <NumberField
            label="Heart rate — minimum"
            suffix="bpm"
            value={hr.min}
            onChange={(v) =>
              setCfg((prev) =>
                !prev
                  ? prev
                  : {
                      ...prev,
                      heartRate: { ...(prev.heartRate ?? hr), min: v },
                    },
              )
            }
          />
          <NumberField
            label="Heart rate — maximum"
            suffix="bpm"
            value={hr.max}
            onChange={(v) =>
              setCfg((prev) =>
                !prev
                  ? prev
                  : {
                      ...prev,
                      heartRate: { ...(prev.heartRate ?? hr), max: v },
                    },
              )
            }
          />
          <NumberField
            label="SpO₂ — minimum"
            suffix="%"
            step={0.5}
            value={spo2.min}
            onChange={(v) =>
              setCfg((prev) =>
                !prev ? prev : { ...prev, spo2: { ...(prev.spo2 ?? spo2), min: v } },
              )
            }
          />
          <NumberField
            label="Temperature — maximum"
            suffix="°C"
            step={0.1}
            value={temp.max}
            onChange={(v) =>
              setCfg((prev) =>
                !prev
                  ? prev
                  : { ...prev, temperature: { ...(prev.temperature ?? temp), max: v } },
              )
            }
          />
        </Card>

        {/* Card 2: Blood pressure */}
        <Card
          title="Blood pressure"
          subtitle="Upper bounds used for hypertensive episode alerts."
        >
          <NumberField
            label="Systolic — maximum"
            suffix="mmHg"
            value={bp.systolicMax}
            onChange={(v) =>
              setCfg((prev) =>
                !prev
                  ? prev
                  : { ...prev, bp: { ...(prev.bp ?? bp), systolicMax: v } },
              )
            }
          />
          <NumberField
            label="Diastolic — maximum"
            suffix="mmHg"
            value={bp.diastolicMax}
            onChange={(v) =>
              setCfg((prev) =>
                !prev
                  ? prev
                  : { ...prev, bp: { ...(prev.bp ?? bp), diastolicMax: v } },
              )
            }
          />
        </Card>

        {/* Card 3: Risk / instability */}
        <Card
          title="Instability & risk scoring"
          subtitle="When composite scores should escalate to InsightCore alerts."
        >
          <NumberField
            label="Glucose instability threshold"
            suffix="Δ index"
            step={0.05}
            value={gluc.threshold}
            onChange={(v) =>
              setCfg((prev) =>
                !prev
                  ? prev
                  : {
                      ...prev,
                      glucoseInstability: {
                        ...(prev.glucoseInstability ?? gluc),
                        threshold: v,
                      },
                    },
              )
            }
          />
          <NumberField
            label="Risk score alert minimum"
            suffix="0–1 score"
            step={0.01}
            value={risk.alertScoreMin}
            onChange={(v) =>
              setCfg((prev) =>
                !prev
                  ? prev
                  : {
                      ...prev,
                      riskScoring: {
                        ...(prev.riskScoring ?? risk),
                        alertScoreMin: v,
                      },
                    },
              )
            }
          />
        </Card>
      </section>

      {/* Save actions */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center rounded-md border border-black bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save InsightCore thresholds'}
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
