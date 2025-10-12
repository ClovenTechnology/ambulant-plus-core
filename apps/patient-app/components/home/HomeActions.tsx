// apps/patient-app/components/home/HomeActions.tsx
'use client';
import Link from 'next/link';

export default function HomeActions() {
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      <Link href="/auto-triage" className="border rounded-xl p-4 hover:bg-zinc-50">
        <div className="text-lg font-semibold">Auto Triage</div>
        <div className="text-sm text-zinc-500">Input symptoms → shortlist clinicians</div>
      </Link>

      <Link href="/myCare" className="border rounded-xl p-4 hover:bg-zinc-50">
        <div className="text-lg font-semibold">myCare</div>
        <div className="text-sm text-zinc-500">Reminders & IoMT daily tools</div>
      </Link>
    </div>
  );
}
