//apps/admin-dashboard/app/roles/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  Info,
  Lock,
  RefreshCw,
  Save,
  Upload,
} from "lucide-react";

/**
 * Roles & Authorization Index
 * -------------------------------------------------------------
 * This page defines a lightweight, front-end friendly authorization index
 * that mirrors the current sidebar information architecture.
 *
 * Model
 * - Permission Scope: a simple string key like "dashboard.read" or
 *   "patients.write". You can wire these to your server-side access checks.
 * - Route Index: stable mapping from route-prefix → required scope(s).
 * - Role: named bundle of scopes (e.g. "Medical", "Finance").
 *
 * Notes
 * - This page ships with a robust default matrix for the roles you listed:
 *   Super Admin, Admin, Medical, Tech & IT, Finance, HR, Compliance,
 *   Reports & Research, R&D.
 * - Everything persists to localStorage for now; replace the persistence
 *   helpers with your API calls when ready.
 * - The matrix lines up with links from the Admin sidebar you shared.
 */

/* ---------------------------------------------
 * 1) Canonical Scope Catalog (grouped by product area)
 * --------------------------------------------- */

// Keep scope keys short, namespaced, and readable. Action suffixes are optional
// and can evolve (read, write, manage, admin). Start simple.
const SCOPE_CATALOG: Array<{ group: string; scopes: string[]; description?: string }>
  = [
  {
    group: "Core",
    scopes: [
      "dashboard.read",
      "analytics.read",
      "reports.read",
    ],
    description: "Top-level analytics and reporting surfaces.",
  },
  {
    group: "Directory",
    scopes: [
      "patients.read",
      "patients.write",
      "clinicians.read",
      "clinicians.write",
      "cases.read",
      "cases.write",
      "orders.read",
      "orders.write",
    ],
  },
  {
    group: "Care Ops",
    scopes: [
      "labs.read",
      "labs.write",
      "pharmacies.read",
      "pharmacies.write",
      "careport.read",
      "careport.write",
      "medreach.read",
      "medreach.write",
      "consult.use", // SFU/Consult tooling
    ],
    description: "Day-to-day care operations including labs, pharmacy and routing.",
  },
  {
    group: "Field Teams",
    scopes: [
      "riders.read",
      "riders.write",
      "phlebs.read",
      "phlebs.write",
    ],
  },
  {
    group: "Devices & SDK",
    scopes: [
      "devices.read",
      "devices.write",
      "sdk.read",
      "sdk.write",
      "sdkupload.use",
    ],
  },
  {
    group: "Insurance & Finance",
    scopes: [
      "insurance.read",
      "insurance.write",
      "payouts.manage",
      "plans.manage",
      "shop.manage",
    ],
  },
  {
    group: "Settings & Platform",
    scopes: [
      "settings.general",
      "settings.consult",
      "settings.insurance",
      "settings.insightcore",
      "settings.shop",
      // Admin areas
      "admin.patients",
      "admin.clinicians",
      "admin.shop",
    ],
  },
  {
    group: "Governance",
    scopes: [
      "compliance.read",
      "compliance.manage",
      "hr.read",
      "hr.manage",
    ],
  },
  {
    group: "Research & Innovation",
    scopes: [
      "research.read",
      "research.publish",
      "rnd.use",
    ],
  },
];

/* ---------------------------------------------
 * 2) Route → Scope Index (mirrors your sidebar IA)
 *    These are prefixes; first-match wins.
 * --------------------------------------------- */
const ROUTE_INDEX: Array<{ prefix: string; scope: string }>= [
  // TOP
  { prefix: "/", scope: "dashboard.read" },
  { prefix: "/patients", scope: "patients.read" },
  { prefix: "/clinicians", scope: "clinicians.read" },
  { prefix: "/cases", scope: "cases.read" },
  { prefix: "/orders", scope: "orders.read" },

  // SINGLE
  { prefix: "/analytics", scope: "analytics.read" },
  { prefix: "/reports", scope: "reports.read" },
  { prefix: "/insurance", scope: "insurance.read" },
  { prefix: "/promotions", scope: "shop.manage" },
  { prefix: "/consult", scope: "consult.use" },

  // GROUPS: Care Ops
  { prefix: "/labs", scope: "labs.read" },
  { prefix: "/pharmacies", scope: "pharmacies.read" },
  { prefix: "/careport", scope: "careport.read" },
  { prefix: "/medreach", scope: "medreach.read" },

  // GROUPS: Field Teams
  { prefix: "/rider", scope: "riders.read" },
  { prefix: "/phleb", scope: "phlebs.read" },

  // GROUPS: Devices & SDK
  { prefix: "/devices", scope: "devices.read" },
  { prefix: "/sdk", scope: "sdk.read" },
  { prefix: "/sdkupload", scope: "sdkupload.use" },

  // GROUPS: Admin
  { prefix: "/admin/patients", scope: "admin.patients" },
  { prefix: "/admin/clinicians", scope: "admin.clinicians" },
  { prefix: "/admin/shop", scope: "admin.shop" },

  // GROUPS: Settings
  { prefix: "/settings/general", scope: "settings.general" },
  { prefix: "/settings/roles", scope: "settings.general" }, // access to this page itself
  { prefix: "/settings/plans", scope: "plans.manage" },
  { prefix: "/settings/consult", scope: "settings.consult" },
  { prefix: "/settings/insurance", scope: "settings.insurance" },
  { prefix: "/settings/payouts", scope: "payouts.manage" },
  { prefix: "/settings/insightcore", scope: "settings.insightcore" },
  { prefix: "/settings/shop", scope: "settings.shop" },
];

/* ---------------------------------------------
 * 3) Role presets (seeded bundles of scopes)
 * --------------------------------------------- */
export type RoleKey =
  | "superadmin"
  | "admin"
  | "medical"
  | "techit"
  | "finance"
  | "hr"
  | "compliance"
  | "reports"
  | "rnd";

export type RoleDef = {
  key: RoleKey;
  name: string;
  description?: string;
  scopes: string[];
};

const ALL_SCOPES = Array.from(
  new Set(SCOPE_CATALOG.flatMap((g) => g.scopes))
).sort();

const union = (...lists: string[][]) =>
  Array.from(new Set(lists.flat())).sort();

const ROLE_PRESETS: RoleDef[] = [
  {
    key: "superadmin",
    name: "Super Admin",
    description: "Unrestricted access to the entire platform.",
    scopes: ALL_SCOPES,
  },
  {
    key: "admin",
    name: "Admin",
    description: "Manage people directories and general settings.",
    scopes: union([
      "dashboard.read",
      "analytics.read",
      "reports.read",
      "patients.read",
      "patients.write",
      "clinicians.read",
      "clinicians.write",
      "cases.read",
      "orders.read",
      "settings.general",
      "admin.patients",
      "admin.clinicians",
      "admin.shop",
    ]),
  },
  {
    key: "medical",
    name: "Medical",
    description: "Clinical operations: consult, labs, pharmacy, routing.",
    scopes: union([
      // Core read
      "dashboard.read",
      "reports.read",
      // Directory
      "patients.read",
      "clinicians.read",
      "cases.read",
      "orders.read",
      // Care Ops
      "consult.use",
      "labs.read",
      "labs.write",
      "pharmacies.read",
      "pharmacies.write",
      "careport.read",
      "medreach.read",
    ]),
  },
  {
    key: "techit",
    name: "Tech & IT",
    description: "Devices, SDK, InsightCore and platform plumbing.",
    scopes: union([
      "dashboard.read",
      "devices.read",
      "devices.write",
      "sdk.read",
      "sdk.write",
      "sdkupload.use",
      "settings.insightcore",
      "settings.general",
    ]),
  },
  {
    key: "finance",
    name: "Finance",
    description: "Payments, plans, payouts and shop management.",
    scopes: union([
      "dashboard.read",
      "analytics.read",
      "reports.read",
      "payouts.manage",
      "plans.manage",
      "shop.manage",
      "settings.shop",
    ]),
  },
  {
    key: "hr",
    name: "HR",
    description: "Human resources: clinician and staff records.",
    scopes: union([
      "clinicians.read",
      "clinicians.write",
      "admin.clinicians",
      "hr.read",
      "hr.manage",
      "reports.read",
    ]),
  },
  {
    key: "compliance",
    name: "Compliance",
    description: "Insurance, compliance and audit related settings.",
    scopes: union([
      "reports.read",
      "insurance.read",
      "insurance.write",
      "settings.insurance",
      "compliance.read",
      "compliance.manage",
    ]),
  },
  {
    key: "reports",
    name: "Reports & Research",
    description: "Access to analytics and reporting surfaces.",
    scopes: union([
      "analytics.read",
      "reports.read",
      "research.read",
    ]),
  },
  {
    key: "rnd",
    name: "R&D",
    description: "Exploratory features and internal research tooling.",
    scopes: union([
      "sdk.read",
      "settings.insightcore",
      "research.read",
      "research.publish",
      "rnd.use",
    ]),
  },
];

/* ---------------------------------------------
 * 4) Local persistence (swap out for your API later)
 * --------------------------------------------- */
const LS_KEY = "admin.roles.v1";

type RoleState = Record<RoleKey, string[]>; // key → scopes

function loadRoles(): RoleState {
  if (typeof window === "undefined") return seed();
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return seed();
    const parsed = JSON.parse(raw) as RoleState;
    // guard: ensure only valid scopes remain
    const clean: RoleState = { ...parsed } as RoleState;
    (Object.keys(clean) as RoleKey[]).forEach((k) => {
      clean[k] = (clean[k] || []).filter((s) => ALL_SCOPES.includes(s));
    });
    return clean;
  } catch {
    return seed();
  }
}

function saveRoles(state: RoleState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}

function seed(): RoleState {
  const obj = Object.fromEntries(
    ROLE_PRESETS.map((r) => [r.key, r.scopes])
  ) as RoleState;
  return obj;
}

/* ---------------------------------------------
 * 5) Helpers
 * --------------------------------------------- */
function byGroup(scopes: string[]) {
  const set = new Set(scopes);
  return SCOPE_CATALOG.map((g) => ({
    group: g.group,
    description: g.description,
    scopes: g.scopes.map((s) => ({ key: s, enabled: set.has(s) })),
  }));
}

function toggle(list: string[], key: string, on?: boolean) {
  const set = new Set(list);
  const willEnable = on ?? !set.has(key);
  if (willEnable) set.add(key); else set.delete(key);
  return Array.from(set).sort();
}

/* ---------------------------------------------
 * 6) UI Components
 * --------------------------------------------- */
function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] text-black/70">
      {children}
    </span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-black/80">{title}</h2>
      </div>
      {children}
    </section>
  );
}

/* ---------------------------------------------
 * 7) Page
 * --------------------------------------------- */
export default function RolesPage() {
  const router = useRouter();
  const [roles, setRoles] = useState<RoleState>(() => loadRoles());
  const [expanded, setExpanded] = useState<Record<RoleKey, boolean>>({
    superadmin: false,
    admin: true,
    medical: true,
    techit: true,
    finance: false,
    hr: false,
    compliance: false,
    reports: false,
    rnd: false,
  });

  // derived
  const roleDefs = useMemo(
    () => ROLE_PRESETS.map((r) => ({ ...r, scopes: roles[r.key] || [] })),
    [roles]
  );

  // persist on change
  useEffect(() => saveRoles(roles), [roles]);

  const resetToDefaults = () => setRoles(seed());

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(roles, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "roles-export.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJson = async (file: File) => {
    const text = await file.text();
    try {
      const parsed = JSON.parse(text) as RoleState;
      // shallow-validate keys
      const keys = Object.keys(parsed) as RoleKey[];
      const ok = keys.every((k) => ROLE_PRESETS.some((r) => r.key === k));
      if (!ok) throw new Error("Unknown role key in file");
      setRoles(parsed);
    } catch (e) {
      alert("Invalid roles JSON file");
    }
  };

  const [showMatrix, setShowMatrix] = useState(false);

  return (
    <div className="mx-auto max-w-6xl p-4">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Roles & Access</h1>
          <p className="text-sm text-black/60">
            Configure role-based access using scopes that mirror the sidebar structure.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="inline-flex items-center gap-1 rounded-lg border bg-white px-3 py-2 text-sm hover:bg-gray-50"
            onClick={() => setShowMatrix((v) => !v)}
          >
            <Lock className="h-4 w-4" /> {showMatrix ? "Hide" : "Show"} Route Matrix
          </button>
          <button
            className="inline-flex items-center gap-1 rounded-lg border bg-white px-3 py-2 text-sm hover:bg-gray-50"
            onClick={resetToDefaults}
            title="Reset to default role presets"
          >
            <RefreshCw className="h-4 w-4" /> Reset
          </button>
          <button
            className="inline-flex items-center gap-1 rounded-lg border bg-white px-3 py-2 text-sm hover:bg-gray-50"
            onClick={exportJson}
          >
            <Download className="h-4 w-4" /> Export
          </button>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm hover:bg-gray-50">
            <Upload className="h-4 w-4" /> Import
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importJson(f);
              }}
            />
          </label>
        </div>
      </header>

      {/* Summary */}
      <Section title="Role Summary">
        <div className="grid gap-3 md:grid-cols-2">
          {roleDefs.map((role) => (
            <div key={role.key} className="rounded-lg border bg-white p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    className="rounded p-1 hover:bg-gray-50"
                    onClick={() => setExpanded((s) => ({ ...s, [role.key]: !s[role.key] }))}
                    aria-expanded={!!expanded[role.key]}
                  >
                    {expanded[role.key] ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </button>
                  <div>
                    <div className="text-sm font-medium">{role.name}</div>
                    {role.description && (
                      <div className="text-xs text-black/60">{role.description}</div>
                    )}
                  </div>
                </div>
                <Tag>{role.scopes.length} scopes</Tag>
              </div>

              {/* Chips view */}
              {!expanded[role.key] && (
                <div className="flex flex-wrap gap-1">
                  {byGroup(role.scopes).map((g) => (
                    <Tag key={g.group}>{g.group}</Tag>
                  ))}
                </div>
              )}

              {/* Detailed group toggles */}
              {expanded[role.key] && (
                <div className="space-y-3">
                  {byGroup(role.scopes).map((g) => (
                    <div key={g.group} className="rounded-lg border bg-white p-2">
                      <div className="mb-1 flex items-center justify-between">
                        <div className="text-xs font-semibold">{g.group}</div>
                        {g.description && (
                          <div className="flex items-center gap-1 text-[11px] text-black/60">
                            <Info className="h-3.5 w-3.5" /> {g.description}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {g.scopes.map((s) => (
                          <button
                            key={s.key}
                            onClick={() =>
                              setRoles((state) => ({
                                ...state,
                                [role.key]: toggle(state[role.key] || [], s.key),
                              }))
                            }
                            className={[
                              "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[12px]",
                              s.enabled
                                ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                                : "border-gray-200 bg-white text-black/70 hover:bg-gray-50",
                            ].join(" ")}
                            title={s.key}
                          >
                            {s.enabled && <Check className="h-3.5 w-3.5" />}
                            {s.key}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </Section>

      {/* Optional: Route matrix shows which scope protects which area */}
      {showMatrix && (
        <div className="mt-4">
          <Section title="Route → Scope Matrix">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left">
                    <th className="whitespace-nowrap px-2 py-2 font-medium">Route prefix</th>
                    <th className="whitespace-nowrap px-2 py-2 font-medium">Required scope</th>
                  </tr>
                </thead>
                <tbody>
                  {ROUTE_INDEX.map((r) => (
                    <tr key={r.prefix} className="border-t">
                      <td className="px-2 py-1 font-mono text-[12px] text-black/80">
                        <Link href={r.prefix} className="hover:underline">
                          {r.prefix}
                        </Link>
                      </td>
                      <td className="px-2 py-1">
                        <Tag>{r.scope}</Tag>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        </div>
      )}

      {/* Implementation notes */}
      <div className="mt-6 text-xs text-black/60">
        <p className="mb-1 font-medium">Implementation Notes</p>
        <ul className="list-disc pl-5">
          <li>Replace localStorage with your API to save and fetch role scopes per tenant.</li>
          <li>
            Add a small server-side helper like <code>canAccess(user, scope)</code> to check
            scopes on page load and in server actions.
          </li>
          <li>
            In your sidebar component, disable or hide links where the current user lacks the
            required scope from the matrix above.
          </li>
        </ul>
      </div>
    </div>
  );
}

/* ---------------------------------------------
 * 8) Minimal, inline guard helper (example)
 * --------------------------------------------- */
export function requiredScopeForRoute(pathname: string): string | null {
  // First match wins, longest prefix first for safety.
  const sorted = [...ROUTE_INDEX].sort((a, b) => b.prefix.length - a.prefix.length);
  const found = sorted.find((r) => pathname === r.prefix || pathname.startsWith(r.prefix + "/"));
  return found?.scope ?? null;
}
