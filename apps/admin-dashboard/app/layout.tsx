// apps/admin-dashboard/app/layout.tsx
import './globals.css';
import Link from 'next/link';
import InboxBell from '@/components/InboxBell';
import AdminSidebar from '@/components/AdminSidebar';

export const metadata = { title: 'Ambulant+', description: 'Contactless Medicine' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50">
        {/* Top bar */}
        <header className="h-14 border-b bg-white/70 backdrop-blur">
          <div className="mx-auto max-w-[1400px] h-full px-4 flex items-center gap-4">
            <Link href="/" className="font-semibold tracking-tight">
              Ambulant+ Admin
            </Link>

            <nav className="hidden md:flex items-center gap-3 text-sm text-black/70">
              <Link className="hover:text-black" href="/">Dashboard</Link>
              <span className="text-black/20">•</span>
              <Link className="hover:text-black" href="/users">Users</Link>
              <span className="text-black/20">•</span>
              <Link className="hover:text-black" href="/orders">Orders</Link>
              <span className="text-black/20">•</span>
              <Link className="hover:text-black" href="/insightcore">InsightCore</Link>
            </nav>

            <div className="ml-auto">
              <InboxBell admin />
            </div>
          </div>
        </header>

        {/* Shell */}
        <div className="min-h-[calc(100vh-56px)]">
          <div className="mx-auto max-w-[1400px] flex min-h-[calc(100vh-56px)]">
            <AdminSidebar />
            <main className="flex-1 min-w-0 p-4 lg:p-6">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
