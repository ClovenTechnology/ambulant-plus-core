// apps/patient-app/app/clinicians/[id]/calendar/page.tsx
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePlan } from '@/components/context/PlanContext';
import CalendarClient from '@/components/calendar/CalendarClient';
import RefundPolicyPanel from '@/components/RefundPolicyPanel';

export default function ClinicianCalendar({ params }: { params: { id: string } }) {
  const { isPremium } = usePlan();
  const router = useRouter();

  return (
    <main className="p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="text-sm text-teal-700 hover:underline"
        >
          ← Back
        </button>
        <h1 className="text-xl font-semibold">Televisit — Calendar</h1>

        <div className="flex items-center gap-2">
          <Link
            href={`/appointments/new?clinicianId=${encodeURIComponent(params.id)}&reason=${encodeURIComponent('Televisit consult')}`}
            className="text-sm rounded px-3 py-1 bg-emerald-600 text-white hover:bg-emerald-700"
          >
            Book this clinician
          </Link>
          <Link
            href="/clinicians"
            className="text-sm text-gray-600 hover:underline"
          >
            Clinicians
          </Link>
        </div>
      </div>

      <div className="grid lg:grid-cols-[2fr_1fr] gap-4">
        <CalendarClient clinicianId={params.id} />

        <aside className="bg-white border rounded-lg p-4 h-fit">
          <div className="font-medium mb-1">Refund policy</div>
          <p className="text-xs text-gray-600 mb-2">
            This clinician’s policy applies to this booking. Please read before confirming payment.
          </p>
          <RefundPolicyPanel clinicianId={params.id} />
        </aside>
      </div>

      <p className="text-xs text-gray-600">
        {isPremium
          ? 'Premium accounts can instant-book when a clinician is online.'
          : 'Select any available time to book your Televisit.'}
      </p>
    </main>
  );
}
