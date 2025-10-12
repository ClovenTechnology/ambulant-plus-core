// apps/clinician-app/app/layout.tsx
import type { Metadata } from "next";
import '@livekit/components-styles';
import "./globals.css";
import { AppShell, type NavItem } from "@ambulant/ui-shell";
import InboxBell from "@/components/InboxBell";

export const metadata: Metadata = {
  title: "Ambulant+",
  description: "Contactless Medicine"
};

// Top navigation (compact)
const TOP: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/today", label: "Today" },
  { href: "/appointments", label: "Appointments" },
  { href: "/televisit", label: "Televisit" },
  { href: "/reports", label: "Reports" },
  { href: "/settings", label: "Settings" }
];

// Side navigation (primary clinician routes)
const SIDE: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/today", label: "Today" },
  { href: "/appointments", label: "Appointments" },
  { href: "/encounters", label: "Encounters" },
  { href: "/orders", label: "Orders" },
  { href: "/erx", label: "eRx" },
  { href: "/televisit", label: "Televisit" },
  { href: "/devices", label: "Devices" },
  { href: "/careport", label: "CarePort" },
  { href: "/medreach", label: "MedReach" },
  { href: "/call-links", label: "Call Links" },
  { href: "/lobby", label: "Lobby" },
  { href: "/settings", label: "Settings" }
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full bg-surface" suppressHydrationWarning>
      <body className="h-full antialiased holo-grid">
        <AppShell
          brandHref="/"
          brandLabel="Ambulant+"
          topNav={TOP}
          sideNav={SIDE}
          right={
            <>
              {/* InboxBell handles its own clinicianId. Change id to match your auth flow */}
              <InboxBell clinicianId="clin-za-001" />
            </>
          }
        >
          {children}
        </AppShell>
        <div className="scanline pointer-events-none" />
      </body>
    </html>
  );
}
