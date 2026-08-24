// apps/admin-dashboard/app/layout.tsx
import './globals.css';
import Link from 'next/link';
import { Activity, BarChart3, CircleDollarSign, Package, Search } from 'lucide-react';
import InboxBell from '@/components/InboxBell';
import AdminSidebar from '@/components/AdminSidebar';
import { StaffCommunicationsProvider } from '@/components/StaffCommunicationsProvider';
import { StaffActivityTracker } from '@/components/StaffActivityTracker';

export const metadata = { title: 'Ambulant+ Admin', description: 'Contactless Medicine operations console' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-950 antialiased">
        <StaffCommunicationsProvider>
          <StaffActivityTracker />
          <header className="sticky top-0 z-40 h-16 border-b border-slate-200 bg-white/95 backdrop-blur-xl">
            <div className="flex h-full items-center gap-4 px-4 lg:px-5">
              <Link href="/" className="flex shrink-0 items-center gap-2.5 font-black tracking-tight text-slate-950">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-slate-950 text-white"><Activity className="h-4 w-4" /></span>
                <span className="hidden sm:inline">Ambulant+ Admin</span>
              </Link>

              <div className="hidden h-7 w-px bg-slate-200 md:block" />
              <nav className="hidden items-center gap-1 md:flex" aria-label="Primary admin shortcuts">
                <Link href="/" className="rounded-xl px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-950">Command Centre</Link>
                <Link href="/orders" className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-950"><Package className="h-3.5 w-3.5" />Orders</Link>
                <Link href="/admin/enterprise-finance" className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-950"><CircleDollarSign className="h-3.5 w-3.5" />Finance</Link>
                <Link href="/insightcore" className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-950"><BarChart3 className="h-3.5 w-3.5" />InsightCore</Link>
              </nav>

              <div className="ml-auto flex items-center gap-2">
                <Link href="/users" className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-white hover:text-slate-950 lg:inline-flex"><Search className="h-3.5 w-3.5" />People & users</Link>
                <InboxBell admin />
              </div>
            </div>
          </header>

          <div className="flex min-h-[calc(100vh-64px)]">
            <AdminSidebar />
            <main className="min-w-0 flex-1 p-4 lg:p-6 xl:p-7">{children}</main>
          </div>
        </StaffCommunicationsProvider>
      </body>
    </html>
  );
}
