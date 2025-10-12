"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export type NavItem = { href: string; label: string };
type Theme = "light" | "dark";

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "light"; // CHANGED: SSR fallback -> light
  try {
    const saved = localStorage.getItem("theme") as Theme | null;
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch {
    return "light"; // CHANGED: error fallback -> light
  }
}

export function ThemeSwitch() {
  const [theme, setTheme] = useState<Theme>("light"); // CHANGED: initial -> light
  useEffect(() => {
    const t = getInitialTheme();
    setTheme(t);
    document.documentElement.setAttribute("data-theme", t);
  }, []);
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem("theme", theme); } catch {}
  }, [theme]);

  return (
    <button
      onClick={() => setTheme(t => (t === "dark" ? "light" : "dark"))}
      className="rounded border px-2 py-1 text-xs hover:bg-white/5"
      title="Toggle color theme"
      aria-label="Toggle color theme"
    >
      {theme === "dark" ? "☀️ Light" : "🌙 Dark"}
    </button>
  );
}

export function Sidebar({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");
  return (
    <aside className="hidden md:block w-64 shrink-0">
      <div className="p-3 text-xs text-gray-500 uppercase">Navigation</div>
      <nav className="px-2 pb-3">
        <ul className="space-y-1">
          {items.map((it) => {
            const active = isActive(it.href);
            return (
              <li key={it.href}>
                <Link
                  href={it.href}
                  className={[
                    "block rounded px-3 py-2 text-sm",
                    active ? "bg-gray-100/10 font-medium text-white"
                           : "text-gray-300 hover:bg-white/5"
                  ].join(" ")}
                >
                  {it.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}

export function AppShell({
  brandHref = "/",
  brandLabel = "Ambulant+",
  topNav = [],
  sideNav = [],
  right,
  children,
}: {
  brandHref?: string;
  brandLabel?: string;
  topNav?: NavItem[];
  sideNav?: NavItem[];
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-white/10 bg-white/5 backdrop-blur-md glass">
        <nav className="mx-auto max-w-6xl px-4 py-3 flex flex-wrap items-center gap-3 text-sm">
          <a href={brandHref} className="font-semibold tracking-wide neon">
            {brandLabel}
          </a>

          {topNav.length > 0 && (
            <>
              <span className="opacity-30">|</span>
              <div className="flex flex-wrap items-center gap-3">
                {topNav.map((n) => (
                  <a key={n.href} href={n.href} className="hover:underline">
                    {n.label}
                  </a>
                ))}
              </div>
            </>
          )}

          <div className="ml-auto flex items-center gap-2">
            {right}
            <ThemeSwitch />
          </div>
        </nav>
      </header>

      <main className="min-h-[calc(100vh-56px)]">
        <div className="mx-auto max-w-6xl px-4 py-6 flex gap-6">
          {sideNav.length > 0 ? <Sidebar items={sideNav} /> : null}
          <section className="flex-1 space-y-6">{children}</section>
        </div>
      </main>
    </>
  );
}
