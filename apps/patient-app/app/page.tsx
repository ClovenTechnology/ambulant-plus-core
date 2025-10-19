// apps/patient-app/app/page.tsx
// Server component: fetches meds & encounters server-side, hydrates client wrappers for interactive pieces.

import React from 'react';
import Link from 'next/link';
import nextDynamic from 'next/dynamic'; // <--- rename to avoid conflict with export const dynamic
import cleanText from '@/lib/cleanText';
import { CLINICIANS } from '@/mock/clinicians';
import type { Pill, Allergy, Clinician, Vitals } from '@/types';
import BpChart, { type BpPoint } from '../components/charts/BpChart';
import MeterDonut from '../components/charts/MeterDonut';
import Sparkline from '../components/charts/Sparkline';

// Dynamic client components (hydrated on client)
const ResyncButton = nextDynamic(() => import('@/components/ResyncButton'), { ssr: false });
const Section = nextDynamic(() => import('@/components/Section'), { ssr: false });
const AllergiesBlockWrapper = nextDynamic(() => import('@/components/AllergiesBlockWrapper'), { ssr: false });
const PillRemindersWrapper = nextDynamic(() => import('@/components/PillRemindersWrapper'), { ssr: false });
const MedicationsBlockWrapper = nextDynamic(() => import('@/components/MedicationsBlockWrapper'), { ssr: false });
const ReportsBlockWrapper = nextDynamic(() => import('@/components/ReportsBlockWrapper'), { ssr: false });
// Client-only export button to avoid passing event handlers from server -> client
const ExportMedButton = nextDynamic(() => import('@/components/ExportMedButton'), { ssr: false });

export const dynamic = 'force-dynamic';

async function fetchMeds() {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ''}/api/medications`, { cache: 'no-store' });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

async function fetchCases() {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ''}/api/encounters?limit=3`, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.cases) ? data.cases : data?.cases ?? [];
  } catch {
    return [];
  }
}

export default async function Home() {
  const [meds, cases] = await Promise.all([fetchMeds(), fetchCases()]);

  const demoClin: Clinician[] = CLINICIANS.slice(0, 2).map((c) => ({
    ...c,
    name: cleanText(c.name),
    specialty: cleanText(c.specialty),
    location: cleanText(c.location),
  }));

  const mockVitals: Vitals & { bpSeries: BpPoint[] } = {
    hr: 72,
    bp: '120/80',
    temp: '36.8 °C',
    spo2: 98,
    lastSync: '2m ago',
    bpSeries: [
      { date: '2025-10-01', systolic: 120, diastolic: 80 },
      { date: '2025-10-02', systolic: 122, diastolic: 78 },
      { date: '2025-10-03', systolic: 118, diastolic: 82 },
    ],
  };

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

  return (
    <main className="p-6 space-y-6">
      {/* HERO */}
      <section className="bg-white border rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold">Good morning, Mila</h1>
          <p className="text-gray-600 mt-2 max-w-xl">
            Your connected health companion. Track vitals, join consultations, review reports, and share results with clinicians — securely.
          </p>
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
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="px-3 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
            Devices: Live
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500">Next appointment</div>
            <div className="font-medium">{nextAppointment.when}</div>
            <div className="text-xs text-gray-500">
              {nextAppointment.with} • {nextAppointment.status}
            </div>
            <div className="mt-2">
              <Link
                href="/appointments"
                className="inline-block px-3 py-1 rounded bg-emerald-600 text-white text-xs"
              >
                View appointments
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* MAIN GRID */}
      <section className="grid md:grid-cols-3 gap-4">
        {/* VITALS + PILL REMINDERS */}
        <div className="space-y-4">
          <Section title="Latest Vitals" subtitle={`Last sync: ${mockVitals.lastSync}`} defaultOpen>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span>Heart Rate</span><span className="font-semibold">{mockVitals.hr} bpm</span></div>
              <div className="flex justify-between"><span>Blood Pressure</span><span className="font-semibold">{mockVitals.bp}</span></div>
              <div className="flex justify-between"><span>Temperature</span><span className="font-semibold">{mockVitals.temp}</span></div>
              <div className="flex justify-between"><span>SpO₂</span><span className="font-semibold">{mockVitals.spo2}%</span></div>
            </div>

            <div className="mt-4 flex gap-2">
              <Link href="/vitals" className="flex-1 inline-block text-center py-2 rounded bg-sky-600 text-white text-sm">View trends</Link>
              <ResyncButton className="flex-1 inline-block text-center py-2 rounded border text-sm" />
            </div>

            <div className="mt-4"><BpChart data={mockVitals.bpSeries} /></div>
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

          <Section
            title="Current Medication"
            defaultOpen
            toolbar={<ExportMedButton />}
          >
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
                {aiInsights.map((ins, idx) => (<li key={idx}>• {ins}</li>))}
              </ul>
              <div className="mt-3">
                <Link href="/insights" className="inline-block px-3 py-1 rounded bg-white border text-sm">View full report</Link>
              </div>
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
                      <span className={`text-xs px-2 py-0.5 rounded ${c.status==='Open'?'bg-green-100 text-green-700': c.status==='Referred' ? 'bg-amber-100 text-amber-800':'bg-zinc-100 text-zinc-700'}`}>{c.status}</span>
                    </div>
                    <div className="text-xs text-zinc-500">Updated {new Date(c.updatedAt).toLocaleString()}</div>
                    {c.latestEncounter && (
                      <div className="text-[13px] mt-1 text-zinc-600">
                        Last encounter: {new Date(c.latestEncounter.start).toLocaleString()}
                      </div>
                    )}
                    <div className="mt-2">
                      <Link href="/encounters" className="text-indigo-700 underline text-sm">View</Link>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 border-t pt-3 text-xs text-gray-600">
              Demo clinicians:
              <ul className="mt-2 text-sm space-y-1">
                {demoClin.map((c, i) => (
                  <li key={i}><span className="font-medium">{c.name}</span> — <span className="text-gray-500">{c.specialty}</span></li>
                ))}
              </ul>
            </div>
          </Section>
        </div>
      </section>
    </main>
  );
}
