import Link from "next/link";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

type Row = Record<string, any>;

export type ProcurementColumn = {
  key: string;
  label: string;
  money?: boolean;
  date?: boolean;
  bool?: boolean;
};

type ReadPageProps = {
  title: string;
  description: string;
  endpoint: string;
  responseKey: string;
  columns: ProcurementColumn[];
  emptyText: string;
  primaryActionLabel?: string;
  primaryActionHref?: string;
};

function apiBase() {
  return (
    process.env.API_GATEWAY_URL ||
    process.env.NEXT_PUBLIC_API_GATEWAY_URL ||
    process.env.API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    ""
  ).replace(/\/$/, "");
}

function valueAt(row: Row, key: string) {
  return key.split(".").reduce((acc: any, part: string) => {
    if (acc === null || acc === undefined) return undefined;
    return acc[part];
  }, row);
}

function formatMoney(value: any) {
  const cents = Number(value || 0);
  if (!Number.isFinite(cents)) return "R0.00";
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
  }).format(cents / 100);
}

function formatDate(value: any) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function formatValue(value: any, column: ProcurementColumn) {
  if (column.money) return formatMoney(value);
  if (column.date) return formatDate(value);
  if (column.bool) return value ? "Yes" : "No";
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

async function loadRows(endpoint: string, responseKey: string) {
  const base = apiBase();

  if (!base) {
    return {
      rows: [] as Row[],
      error: "API gateway base URL is not configured for the admin dashboard.",
      meta: null as any,
    };
  }

  const incomingHeaders = headers();
  const requestHeaders: HeadersInit = {};

  const cookie = incomingHeaders.get("cookie");
  const authorization = incomingHeaders.get("authorization");

  if (cookie) requestHeaders.cookie = cookie;
  if (authorization) requestHeaders.authorization = authorization;

  const url = base + "/api/enterprise-finance/" + endpoint;

  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: requestHeaders,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || data?.ok === false) {
      return {
        rows: [] as Row[],
        error: data?.error || "Request failed while loading " + endpoint + ".",
        meta: data?.meta || null,
      };
    }

    const rows = Array.isArray(data?.[responseKey]) ? data[responseKey] : [];

    return {
      rows,
      error: null as string | null,
      meta: data?.meta || null,
    };
  } catch (error: any) {
    return {
      rows: [] as Row[],
      error: error?.message || "Unable to load " + endpoint + ".",
      meta: null as any,
    };
  }
}

export async function EnterpriseFinanceProcurementReadPage(props: ReadPageProps) {
  const result = await loadRows(props.endpoint, props.responseKey);

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-slate-100">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <div className="flex flex-col gap-4 rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/40 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">
              Enterprise Finance
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
              {props.title}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
              {props.description}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin/enterprise-finance"
              className="rounded-2xl border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-cyan-400 hover:text-cyan-200"
            >
              Finance command centre
            </Link>

            {props.primaryActionHref ? (
              <Link
                href={props.primaryActionHref}
                className="rounded-2xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
              >
                {props.primaryActionLabel || "Open action"}
              </Link>
            ) : null}
          </div>
        </div>

        {result.error ? (
          <section className="rounded-3xl border border-amber-500/30 bg-amber-500/10 p-5 text-sm text-amber-100">
            <p className="font-semibold">Data source not available</p>
            <p className="mt-2 text-amber-100/80">{result.error}</p>
          </section>
        ) : null}

        <section className="rounded-3xl border border-slate-800 bg-slate-900/70 shadow-2xl shadow-slate-950/30">
          <div className="flex flex-col gap-2 border-b border-slate-800 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-white">Records</h2>
              <p className="text-sm text-slate-400">
                {result.rows.length} record{result.rows.length === 1 ? "" : "s"} loaded from /api/enterprise-finance/{props.endpoint}
              </p>
            </div>

            <p className="rounded-full border border-slate-700 px-3 py-1 text-xs font-medium text-slate-300">
              Read-only launch view
            </p>
          </div>

          {result.rows.length === 0 ? (
            <div className="px-5 py-10 text-sm text-slate-400">
              {props.emptyText}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-800 text-sm">
                <thead className="bg-slate-950/50">
                  <tr>
                    {props.columns.map((column) => (
                      <th
                        key={column.key}
                        scope="col"
                        className="whitespace-nowrap px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400"
                      >
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {result.rows.map((row, index) => (
                    <tr key={row.id || index} className="transition hover:bg-slate-800/40">
                      {props.columns.map((column) => (
                        <td key={column.key} className="max-w-xs whitespace-nowrap px-5 py-4 text-slate-200">
                          <span className="block truncate">
                            {formatValue(valueAt(row, column.key), column)}
                          </span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
