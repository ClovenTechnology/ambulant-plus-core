// apps/clinician-app/app/layout.tsx
import type { Metadata } from 'next';
import React from 'react';
import '@livekit/components-styles';
import './globals.css';

import ClinicianChrome from '@/components/ClinicianChrome';

export const metadata: Metadata = {
  title: 'Ambulant+',
  description: 'Contactless Medicine',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full bg-surface" suppressHydrationWarning>
      <body className="h-full antialiased holo-grid">
        <ClinicianChrome>{children}</ClinicianChrome>
      </body>
    </html>
  );
}
