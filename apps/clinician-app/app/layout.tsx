// apps/clinician-app/app/layout.tsx
import type { Metadata } from 'next';
import React from 'react';
import Link from 'next/link';
import '@livekit/components-styles';
import './globals.css';

import InboxBell from '@/components/InboxBell';
import ClinicianSidebar from '@/components/ClinicianSidebar';

export const metadata: Metadata = {
  title: 'Ambulant+',
  description: 'Contactless Medicine',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full bg-surface" suppressHydrationWarning>
      <body className="h-full antialiased holo-grid">
        <header className="h-14 border-b bg-white/70 backdrop-blur">
          <div className="mx-auto max-w-[1400px] h-full px-4 flex items-center gap-4">
            <Link href="/today" className="font-semibold tracking-tight">
              Ambulant+
            </Link>

            <nav className="hidden md:flex items-center gap-3 text-sm text-black/70">
              <Link className="hover:text-black" href="/today">Today</Link>
              <span className="text-black/20">•</span>
              <Link className="hover:text-black" href="/appointments">Appointments</Link>
              <span className="text-black/20">•</span>
              <Link className="hover:text-black" href="/calendar">Calendar</Link>
              <span className="text-black/20">•</span>
              <Link className="hover:text-black" href="/patients">Patients</Link>
            </nav>

            <div className="ml-auto flex items-center gap-2">
              <InboxBell clinicianId="clin-za-001" />
            </div>
          </div>
        </header>

        <div className="min-h-[calc(100vh-56px)]">
          <div className="mx-auto max-w-[1400px] flex min-h-[calc(100vh-56px)]">
            {/* If you still don't see anything, it's almost certainly the import path (#1) */}
            <ClinicianSidebar />

            <main className="flex-1 min-w-0 p-4 lg:p-6">{children}</main>
          </div>
        </div>

        <div className="scanline pointer-events-none" />
      </body>
    </html>
  );
}
