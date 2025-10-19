// apps/patient-app/app/layout.tsx
import './globals.css';
import './print.css';
import Link from 'next/link';
import nextDynamic from 'next/dynamic';
import Sidebar from '../components/Sidebar';

// Providers / pickers
import { ToastProvider } from '../components/ToastProvider';
import { ActiveEncounterProvider } from '../components/context/ActiveEncounterContext';
import { PlanProvider } from '../components/context/PlanContext';
import PlanToggle from '../components/PlanToggle';

// Client-only bits
const ActiveEncounterPicker = nextDynamic(() => import('../components/ActiveEncounterPicker'), { ssr: false });

export const metadata = { title: 'Ambulant+', description: 'Contactless Medicine' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>
          <PlanProvider>
            <ActiveEncounterProvider>
              <header className="border-b bg-white">
                <nav className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4">
                  <Link href="/" className="font-semibold">Ambulant+</Link>
                  <div className="text-sm text-gray-400">|</div>

                  <div className="flex flex-wrap gap-3 text-sm items-center">
                    <Link href="/" className="hover:underline">Home</Link>
                    <Link href="/clinicians" className="hover:underline">Clinicians</Link>
                    <Link href="/vitals" className="hover:underline">Vitals</Link>
                    <Link href="/charts" className="hover:underline">Charts</Link>
                    <Link href="/encounters" className="hover:underline">Encounters</Link>
                    <Link href="/orders" className="hover:underline">Orders</Link>
                    <Link href="/careport" className="hover:underline">CarePort</Link>
                    <Link href="/medreach" className="hover:underline">MedReach</Link>
                    <Link href="/televisit/demo-123" className="hover:underline">Televisit</Link>
                    <Link href="/reports" className="hover:underline">Reports</Link>
                    <Link href="/settings" className="hover:underline">Settings</Link>

                    {/* Always-visible encounter selector + plan toggle */}
                    <ActiveEncounterPicker />
                    <PlanToggle />
                  </div>
                </nav>
              </header>

              <div className="min-h-[calc(100vh-52px)] bg-gray-50">
                <div className="mx-auto max-w-6xl flex gap-6">
                  <Sidebar />
                  <div className="flex-1">{children}</div>
                </div>
              </div>
            </ActiveEncounterProvider>
          </PlanProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
