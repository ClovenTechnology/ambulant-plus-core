// apps/patient-app/app/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import cleanText from '@/lib/cleanText';
import { CLINICIANS } from '@/mock/clinicians';
import type { Pill, Allergy, Clinician, Vitals } from '@/types';
import BpChart, { type BpPoint } from '../components/charts/BpChart';
import MeterDonut from '../components/charts/AnimatedMeterDonut';
import VitalsTrendChart from '../components/charts/VitalsTrendChart';
import MiniMeterDonut from '../components/charts/MiniMeterDonut';
import Sparkline from '../components/charts/Sparkline';
import RecentActivityStrip from '../components/RecentActivityStrip';
import SuggestionChips from '@/components/ui/SuggestionChips';
import ResyncButton from '@/components/ResyncButton';
import Section from '@/components/Section';
import AllergiesBlockWrapper from '@/components/AllergiesBlockWrapper';
import PillRemindersWrapper from '@/components/PillRemindersWrapper';
import MedicationsBlockWrapper from '@/components/MedicationsBlockWrapper';
import ReportsBlockWrapper from '@/components/ReportsBlockWrapper';
import ExportMedButton from '@/components/ExportMedButton';

type AlertSeverity = 'low' | 'moderate' | 'high' | 'critical';

type InsightAlert = {
  id: string;
  title: string;
  message: string;
  severity: AlertSeverity;
  ts: string;
};

export default function HomePage({ meds, cases }: { meds: any[]; cases: any[] }) {
  const patientName = 'Ndileka'; // TODO: replace with authenticated user's name

  const [mockVitals] = useState<Vitals & { bpSeries: BpPoint[] }>({
    hr: 72,
    bp: '120/80',
    temp: 36.8,
    spo2: 98,
    lastSync: '2m ago',
    bpSeries: [
      { date: '2025-10-01', systolic: 120, diastolic: 80 },
      { date: '2025-10-02', systolic: 122, diastolic: 78 },
      { date: '2025-10-03', systolic: 118, diastolic: 82 },
    ],
  });

  const nextAppointment = {
    when: 'Oct 20, 2025 • 09:30',
    with: 'Dr. Mbatha',
    status: 'Upcoming',
  };

  const aiInsights = [
    'Stress reduced by 10% vs last week',
    'Sleep quality: Improving: +2hrs (daily avg.)',
    'Suggested: Refill antihypertensive in 5 days',
  ];

  const allergies: Allergy[] = [
    { name: 'Penicillin', status: 'Active', severity: 'severe', note: 'Avoid all forms' } as any,
    { name: 'Dust', status: 'Resolved', severity: 'moderate' } as any,
  ];

  const currentMeds = Array.isArray(meds) ? meds.map((m: any) => `${m.name} ${m.dose ?? ''}`) : [];
  const adherencePct = (() => {
    if (!Array.isArray(meds) || meds.length === 0) return 100;
    const taken = meds.filter((m: any) => m.status === 'Completed').length;
    return Math.round((taken / meds.length) * 100);
  })();
  const adherenceSeries = [80, 85, 90, 70, 95, 100, adherencePct];

  const todaysPills: Pill[] = (Array.isArray(meds) ? meds : []).slice(0, 3).map((m: any) => ({
    id: m.id ?? (m.orderId ?? m.name),
    name: m.name,
    dose: m.dose ?? '',
    time: (m.time ?? '') as string,
    status: (m.status === 'Completed' ? 'Taken' : 'Pending') as Pill['status'],
  }));

  const recentCases = Array.isArray(cases) ? cases.slice(0, 3) : [];
  const demoClin: Clinician[] = CLINICIANS.slice(0, 2).map((c) => ({
    ...c,
    name: cleanText(c.name),
    specialty: cleanText(c.specialty),
    location: cleanText(c.location),
  }));

  // Health score calculation — uses numeric temp now
  const healthScore = Math.round(
    ((mockVitals.hr / 100 + mockVitals.spo2 / 100 + 1 - (mockVitals.temp as number) / 40) * 100) / 3,
  );

  const getHealthStatus = () => {
    if (mockVitals.spo2 < 92 || parseInt(mockVitals.bp.split('/')[0]) > 140) {
      return 'Consider checking your vitals!';
    }
    return 'You’re doing great! Your vitals are stable today.';
  };

  const suggestions = ['Check Vitals Now', 'Book Follow-up', 'Take Medication', 'Schedule Self-Check'];

  // 🔔 InsightCore alerts for this patient
  const [alerts, setAlerts] = useState<InsightAlert[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [alertsError, setAlertsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadAlerts() {
      try {
        setAlertsLoading(true);
        setAlertsError(null);

        // Patient app proxy → GW → /api/insightcore/alerts (scoped to current patient by backend)
        const res = await fetch('/api/insightcore/alerts?limit=3', { cache: 'no-store' });
        const data = await res.json().catch(() => ({ alerts: [] }));
        if (cancelled) return;

        const incoming = (data.alerts || []) as any[];

        const mapped: InsightAlert[] = incoming.slice(0, 3).map((a, idx) => ({
          id: String(a.id || idx),
          title: a.title || 'InsightCore alert',
          message: a.message || a.note || 'You have a new health alert.',
          severity: (a.severity as AlertSeverity) || 'moderate',
          ts: a.ts || a.timestamp || new Date().toISOString(),
        }));

        setAlerts(mapped);
      } catch (e: any) {
        if (cancelled) return;
        console.error('Failed to load patient alerts', e);
        setAlertsError('Unable to load InsightCore alerts right now.');
        setAlerts([]);
      } finally {
        if (!cancelled) setAlertsLoading(false);
      }
    }

    loadAlerts();

    // Optional: refresh every few minutes if you want live-ish alerts
    // const timer = setInterval(loadAlerts, 180_000);
    // return () => { cancelled = true; clearInterval(timer); };

    return () => {
      cancelled = true;
    };
  }, []);

  function severityChip(severity: AlertSeverity) {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'high':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'moderate':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
      default:
        return 'bg-sky-100 text-sky-700 border-sky-200';
    }
  }

  function severityLabel(severity: AlertSeverity) {
    switch (severity) {
      case 'critical':
        return 'Critical';
      case 'high':
        return 'High';
      case 'moderate':
        return 'Medium';
      case 'low':
      default:
        return 'Low';
    }
  }

  return (
    <main className="p-6 space-y-6 bg-gradient-to-b from-teal-50 via-indigo-50 to-pink-50 min-h-screen">
      {/* Recent activity strip */}
      <RecentActivityStrip />

      {/* HERO */}
      <section className="backdrop-blur-lg bg-white/60 border border-gray-200 rounded-3xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg animate-fadeIn">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold">Welcome, {patientName} 👋</h1>
          <p className="text-gray-600 mt-2 max-w-xl">{getHealthStatus()}</p>
          <div className="mt-3 flex gap-2 flex-wrap">
            <Link href="/auto-triage" className="px-3 py-1.5 rounded bg-emerald-600 text-white shadow-sm">
              Auto Triage
            </Link>
            <Link href="/myCare" className="px-3 py-1.5 rounded bg-indigo-600 text-white shadow-sm">
              myCare
            </Link>
            <Link href="/myCare/devices" className="px-3 py-1.5 rounded bg-sky-50 text-sky-700 border">
              Manage Devices
            </Link>
            <Link href="/find-doctor" className="px-3 py-1.5 rounded bg-pink-600 text-white shadow-sm">
              Find a Doctor
            </Link>
          </div>
        </div>

        <div className="flex flex-col items-end gap-3">
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-xs text-gray-500">Health Score</div>
              <MeterDonut value={healthScore} max={100} label="Health Score" color="#6366F1" unit="%" />
            </div>
          </div>

          <div className="text-right">
            <div className="text-xs text-gray-500">Next appointment</div>
            <div className="font-medium">{nextAppointment.when}</div>
            <div className="text-xs text-gray-500">
              {nextAppointment.with} • {nextAppointment.status}
            </div>
            <Link href="/appointments" className="mt-2 inline-block px-3 py-1 rounded bg-emerald-600 text-white text-xs">
              View appointments
            </Link>
          </div>
        </div>
      </section>

      {/* 🔔 InsightCore Alerts for this patient */}
      {(alertsLoading || alerts.length > 0 || alertsError) && (
        <section className="rounded-2xl border border-indigo-100 bg-white/70 p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-medium text-slate-900">My Alerts (InsightCore)</h2>
              <p className="text-[11px] text-gray-500">
                Smart alerts based on your vitals, history and lifestyle.
              </p>
            </div>
            {alertsError && (
              <span className="text-[11px] text-rose-600">{alertsError}</span>
            )}
          </div>

          {alertsLoading && alerts.length === 0 ? (
            <div className="text-xs text-gray-500">Loading your alerts…</div>
          ) : alerts.length === 0 ? (
            <div className="text-xs text-gray-500">
              No active health alerts. Keep up the good work ✨
            </div>
          ) : (
            <ul className="space-y-2">
              {alerts.map((a) => (
                <li
                  key={a.id}
                  className="flex items-start justify-between gap-3 rounded-xl border bg-white px-3 py-2"
                >
                  <div>
                    <div className="text-sm font-medium text-slate-900">
                      {a.title}
                    </div>
                    <div className="text-xs text-gray-600 mt-0.5">{a.message}</div>
                    <div className="text-[11px] text-gray-400 mt-1">
                      {new Date(a.ts).toLocaleString()}
                    </div>
                  </div>
                  <span
                    className={`text-[11px] rounded-full border px-2 py-0.5 whitespace-nowrap ${severityChip(
                      a.severity,
                    )}`}
                  >
                    {severityLabel(a.severity)}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="text-[11px] text-gray-400">
            Alert thresholds are managed by your care team and may update over time.
          </div>
        </section>
      )}

      {/* SMART SUGGESTION CHIPS */}
      <SuggestionChips suggestions={suggestions} />

      {/* MAIN GRID */}
      <section className="grid md:grid-cols-3 gap-4">
        {/* VITALS + PILL REMINDERS */}
        <div className="space-y-4">
          <Section title="Latest Vitals" subtitle={`Last sync: ${mockVitals.lastSync}`} defaultOpen>
            {/* Mini Donut Meters */}
            <div className="grid grid-cols-3 gap-4 mb-4">
              <MiniMeterDonut value={mockVitals.hr} max={200} unit="bpm" label="HR" />
              <MiniMeterDonut value={mockVitals.temp as number} max={45} unit="°C" label="Temp" />
              <MiniMeterDonut value={mockVitals.spo2} max={100} unit="%" label="SpO₂" />
            </div>

            {/* Raw numbers */}
            <div className="space-y-2 text-sm mb-3">
              <div className="flex justify-between">
                <span>Heart Rate</span>
                <span className="font-semibold">{mockVitals.hr} bpm</span>
              </div>
              <div className="flex justify-between">
                <span>Blood Pressure</span>
                <span className="font-semibold">{mockVitals.bp}</span>
              </div>
              <div className="flex justify-between">
                <span>Temperature</span>
                <span className="font-semibold">{mockVitals.temp} °C</span>
              </div>
              <div className="flex justify-between">
                <span>SpO₂</span>
                <span className="font-semibold">{mockVitals.spo2}%</span>
              </div>
            </div>

            <VitalsTrendChart vitals={mockVitals} />

            <div className="mt-4 flex gap-2">
              <Link href="/vitals" className="flex-1 inline-block text-center py-2 rounded bg-sky-600 text-white text-sm">
                View trends
              </Link>
              <ResyncButton className="flex-1 inline-block text-center py-2 rounded border text-sm" />
            </div>
          </Section>

          <Section title="Pill Reminders" subtitle="Today's medications" defaultOpen>
            <PillRemindersWrapper pills={todaysPills} />
          </Section>
        </div>

        {/* ALLERGIES + MEDICATION ADHERENCE */}
        <div className="space-y-4">
          <Section title="Allergies" defaultOpen>
            <AllergiesBlockWrapper allergies={allergies} />
          </Section>

          <Section title="Current Medication" defaultOpen toolbar={<ExportMedButton />}>
            <MedicationsBlockWrapper initialMeds={meds} />
            <div className="mt-2 grid grid-cols-3 gap-2">
              <MeterDonut value={adherencePct} max={100} label="Adherence" color="#10B981" unit="%" />
              <div className="col-span-2 rounded-xl border bg-white p-2">
                <div className="text-xs text-slate-500 mb-1">Adherence trend</div>
                <Sparkline data={adherenceSeries} height={64} />
              </div>
            </div>
          </Section>
        </div>

        {/* RECENT REPORTS + AI INSIGHTS */}
        <div className="space-y-4">
          <Section title="Recent Reports" subtitle="AI Insights" defaultOpen={false}>
            <ReportsBlockWrapper />
            <div className="border-t pt-3">
              <div className="font-medium">AI Insights</div>
              <ul className="mt-2 text-sm space-y-1 text-gray-700">
                {aiInsights.map((ins, idx) => (
                  <li key={idx}>• {ins}</li>
                ))}
              </ul>
              <Link href="/insights" className="mt-3 inline-block px-3 py-1 rounded bg-white border text-sm">
                View full report
              </Link>
            </div>
          </Section>

          <Section title="Recent Encounters" defaultOpen>
            <div className="text-sm space-y-2">
              {recentCases.length === 0 ? (
                <div className="text-gray-500">No recent cases.</div>
              ) : (
                recentCases.map((c: any, idx: number) => (
                  <div key={c.id || idx} className="border rounded p-2">
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{c.title ?? `Case ${c.id}`}</div>
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${
                          c.status === 'Open'
                            ? 'bg-green-100 text-green-700'
                            : c.status === 'Referred'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-zinc-100 text-zinc-700'
                        }`}
                      >
                        {c.status}
                      </span>
                    </div>
                    <div className="text-xs text-zinc-500">
                      Updated {new Date(c.updatedAt).toLocaleString()}
                    </div>
                    {c.latestEncounter && (
                      <div className="text-[13px] mt-1 text-zinc-600">
                        Last encounter: {new Date(c.latestEncounter.start).toLocaleString()}
                      </div>
                    )}
                    <div className="mt-2">
                      <Link href="/encounters" className="text-indigo-700 underline text-sm">
                        View
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 border-t pt-3 text-xs text-gray-600">
              Recent Clinicians:
              <ul className="mt-2 text-sm space-y-1">
                {demoClin.map((c, i) => (
                  <li key={i}>
                    <span className="font-medium">{c.name}</span> —{' '}
                    <span className="text-gray-500">{c.specialty}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Section>
        </div>
      </section>
    </main>
  );
}
