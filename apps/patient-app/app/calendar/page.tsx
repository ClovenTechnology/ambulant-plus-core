'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import React, { useMemo, Suspense } from 'react';

type CalendarClientProps = { clinicianId: string };

const CalendarClient = dynamic<CalendarClientProps>(
  async () => {
    const mod = await import('@/components/calendar/CalendarClient');
    const Comp = (mod as any).default || (mod as any).CalendarClient;
    if (!Comp) {
      throw new Error('CalendarClient component not found — check export (default or named).');
    }
    return Comp;
  },
  {
    ssr: false,
    loading: () => (
      <div className="p-6 text-sm text-gray-600">Loading calendar…</div>
    ),
  }
);

function CalendarPageContent() {
  const searchParams = useSearchParams();
  const qs = useMemo(
    () => new URLSearchParams(searchParams?.toString() ?? ''),
    [searchParams]
  );

  const c = qs.get('c') ?? '';

  if (!c) {
    return (
      <main className="p-6 max-w-3xl mx-auto">
        <h1 className="text-xl font-semibold mb-2">Televisit Booking</h1>
        <p className="text-sm text-gray-600 mb-4">No clinician selected.</p>
        <Link href="/clinicians" className="text-sm text-indigo-600 underline">
          ← Back to clinicians
        </Link>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Televisit — Calendar</h1>
        <Link href="/clinicians" className="text-sm text-gray-600 underline">
          ← Back to clinicians
        </Link>
      </div>

      <SafeCalendar clinicianId={c} />
    </main>
  );
}

class CalendarErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: string | null }
> {
  state = { error: null as string | null };

  static getDerivedStateFromError(err: unknown) {
    return {
      error:
        err instanceof Error
          ? err.message
          : 'Unknown error rendering calendar',
    };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="p-4 border rounded bg-rose-50 text-rose-700 text-sm">
          <div className="font-semibold mb-1">Calendar failed to load</div>
          <div className="mb-2">{this.state.error}</div>
          <ul className="list-disc ml-5">
            <li>
              Ensure <code>CalendarClient</code> has <code>'use client'</code> at the top.
            </li>
            <li>
              Export it as <code>export default function CalendarClient()</code> or as a named export.
            </li>
            <li>
              Confirm the import path: <code>@/components/calendar/CalendarClient</code>.
            </li>
          </ul>
        </div>
      );
    }

    return this.props.children;
  }
}

function SafeCalendar(props: CalendarClientProps) {
  return (
    <CalendarErrorBoundary>
      <CalendarClient clinicianId={props.clinicianId} />
    </CalendarErrorBoundary>
  );
}

export default function CalendarPage() {
  return (
    <Suspense fallback={null}>
      <CalendarPageContent />
    </Suspense>
  );
}

