import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "CarePort | Ambulant+",
  description: "CarePort pharmacy fulfilment and delivery operations workspace.",
};

const navItems = [
  { href: "/", label: "Home" },
  { href: "/overview", label: "Overview" },
];

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-900 antialiased">
        <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-100">
          <header className="border-b border-white/10 bg-slate-950/95 text-white shadow-sm">
            <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
              <Link href="/" className="group inline-flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-400 text-lg font-black text-slate-950 shadow-sm shadow-emerald-900/30">
                  C
                </span>
                <span>
                  <span className="block text-base font-black tracking-tight">CarePort</span>
                  <span className="block text-xs font-medium text-emerald-100">
                    Pharmacy fulfilment and rider delivery
                  </span>
                </span>
              </Link>

              <nav className="flex flex-wrap gap-2 text-sm">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="rounded-full border border-white/10 px-3 py-2 font-semibold text-slate-100 transition hover:border-emerald-300 hover:bg-emerald-300 hover:text-slate-950"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
          </header>

          <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
