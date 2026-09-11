'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type NavItem = {
  href?: string;
  label: string;
  description: string;
  status?: string;
};

type MedReachRoleShellProps = {
  role: "lab" | "phleb";
  eyebrow: string;
  title: string;
  description: string;
  accent: string;
  navItems: NavItem[];
  children: ReactNode;
};

function isActivePath(pathname: string, href?: string) {
  if (!href) return false;
  if (pathname === href) return true;
  return pathname.startsWith(`${href}/`);
}

export function MedReachRoleShell({
  role,
  eyebrow,
  title,
  description,
  accent,
  navItems,
  children,
}: MedReachRoleShellProps) {
  const pathname = usePathname() || "/";
  const activeClass =
    role === "lab"
      ? "border-sky-300 bg-sky-50 ring-1 ring-sky-100"
      : "border-violet-300 bg-violet-50 ring-1 ring-violet-100";

  return (
    <div data-medreach-role={role} className="grid gap-6 lg:grid-cols-[19rem_minmax(0,1fr)]">
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-500">{eyebrow}</p>
            <h2 className="mt-2 text-xl font-black text-slate-950">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
          </div>

          <nav aria-label={title} className="max-h-[68vh] space-y-2 overflow-y-auto p-3">
            {navItems.map((item) => {
              const active = isActivePath(pathname, item.href);

              return item.href ? (
                <Link
                  key={item.label}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={[
                    "block rounded-2xl border px-4 py-3 transition",
                    active
                      ? activeClass
                      : "border-transparent bg-white hover:border-slate-200 hover:bg-slate-50",
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="block text-sm font-black text-slate-950">{item.label}</span>
                    {active ? (
                      <span className="rounded-full bg-white px-2 py-1 text-[10px] font-black uppercase tracking-wide text-slate-600 shadow-sm">
                        Active
                      </span>
                    ) : null}
                  </div>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">{item.description}</span>
                </Link>
              ) : (
                <div
                  key={item.label}
                  className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-black text-slate-500">{item.label}</span>
                    <span className="rounded-full bg-slate-200 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-slate-600">
                      {item.status || "Soon"}
                    </span>
                  </div>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">{item.description}</span>
                </div>
              );
            })}
          </nav>

          <div className={`m-3 rounded-2xl border px-4 py-3 text-xs leading-5 ${accent}`}>
            Role-specific MedReach workspace active. Navigation is limited to this operational role.
          </div>
        </div>
      </aside>

      <div className="min-w-0">{children}</div>
    </div>
  );
}
