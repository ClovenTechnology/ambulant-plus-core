// apps/admin-dashboard/app/layout.tsx
import './globals.css';
import InboxBell from '@/components/InboxBell';

export const metadata = { title: 'Ambulant+', description: 'Contactless Medicine' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="fixed top-3 right-4 z-50"><InboxBell admin /></div>
        {children}
      </body>
    </html>
  );
}
