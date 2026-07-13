import Link from "next/link";
import type { ReactNode } from "react";

type NavItem = {
  href?: string;
  label: string;
  description: string;
  status?: string;
};

type CarePortRoleShellProps = {
  role: "pharmacy" | "rider";
  eyebrow: string;
  title: string;
  description: string;
  accent: string;
  navItems: NavItem[];
  children: ReactNode;
};

export function CarePortRoleShell({
  role,
  eyebrow,
  title,
  description,
  accent,
  navItems,
  children,
}: CarePortRoleShellProps) {
  return (
    <div data-a4p2-role={role} className="grid gap-6 lg:grid-cols-[18rem_1fr]">
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-500">{eyebrow}</p>
          <h2 className="mt-2 text-xl font-black text-slate-950">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>

          <nav aria-label={title} className="mt-5 space-y-2">
            {navItems.map((item) =>
              item.href ? (
                <Link
                  key={item.label}
                  href={item.href}
                  className="block rounded-2xl border border-slate-200 bg-white px-4 py-3 transition hover:border-emerald-300 hover:bg-emerald-50"
                >
                  <span className="block text-sm font-black text-slate-950">{item.label}</span>
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
              )
            )}
          </nav>

          <div className={`mt-5 rounded-2xl border px-4 py-3 text-xs leading-5 ${accent}`}>
            Role-specific menu active. This workspace only exposes navigation relevant to this partner role.
          </div>
        </div>
      </aside>

      <div className="min-w-0">{children}</div>
    </div>
  );
}
