'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import React from 'react';

// If your CalendarClient uses hooks or touches window, it must be a client component.
// We import it dynamically, disable SSR, and accept either a default or named export.
type CalendarClientProps = { clinicianId: string };

const CalendarClient = dynamic<CalendarClientProps>(
  async () => {
    const mod = await import('@/components/calendar/CalendarClient');
    const Comp = (mod as any).default || (mod as any).CalendarClient;
    if (!Comp) {
      // This makes the error obvious in dev, but we also show a nice fallback UI below.
      throw new Error('CalendarClient component not found â€” check export (default or named).');
    }
    return Comp;
  },
  {
    ssr: false,
    loading: () => (
      <div className="p-6 text-sm text-gray-600">Loading calendarâ€¦</div>
    ),
  }
);

export default function CalendarPage() {
  const sp = useSearchParams();
  const c = sp.get('c') ?? '';

  if (!c) {
    return (
      <main className="p-6 max-w-3xl mx-auto">
        <h1 className="text-xl font-semibold mb-2">Televisit Booking</h1>
        <p className="text-sm text-gray-600 mb-4">No clinician selected.</p>
        <Link href="/clinicians" className="text-sm text-indigo-600 underline">
          â† Back to clinicians
        </Link>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Televisit â€” Calendar</h1>
        <Link href="/clinicians" className="text-sm text-gray-600 underline">
          â† Back to clinicians
        </Link>
      </div>

      {/* Calendar rendered client-side only */}
      <SafeCalendar clinicianId={c} />
    </main>
  );
}

/**
 * Error boundary so a bad export in CalendarClient won't crash the entire page.
 * Youâ€™ll see a friendly message instead of a red overlay.
 */
class CalendarErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(err: any) {
    return { error: err?.message ?? 'Unknown error rendering calendar' };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="p-4 border rounded bg-rose-50 text-rose-700 text-sm">
          <div className="font-semibold mb-1">Calendar failed to load</div>
          <div className="mb-2">{this.state.error}</div>
          <ul className="list-disc ml-5">
            <li>Ensure <code>CalendarClient</code> has <code>'use client'</code> at the top.</li>
            <li>Export it as <code>export default function CalendarClient()â€¦</code> (or named export <code>export function CalendarClientâ€¦</code>).</li>
            <li>Confirm the import path: <code>@/components/calendar/CalendarClient</code>.</li>
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
      {/* If the module lacks default/named export as component, the boundary will catch it */}
      <CalendarClient clinicianId={props.clinicianId} />
    </CalendarErrorBoundary>
  );
}
