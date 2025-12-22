// apps/patient-app/app/layout.tsx
import type { ReactNode } from 'react';
import './globals.css';
import './print.css';

// Providers
import { ToastProvider } from '../components/ToastProvider';
import { ActiveEncounterProvider } from '../components/context/ActiveEncounterContext';
import { PlanProvider } from '../components/context/PlanContext';
import { PlanModalProvider } from '../components/plan/PlanModalProvider';

// Client shell
import AppShell from '../components/AppShell';

export const metadata = {
  title: 'Ambulant+',
  description: 'Contactless Medicine',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased text-slate-900">
        <ToastProvider>
          <PlanProvider>
            <PlanModalProvider>
              <ActiveEncounterProvider>
                <AppShell>{children}</AppShell>
              </ActiveEncounterProvider>
            </PlanModalProvider>
          </PlanProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
