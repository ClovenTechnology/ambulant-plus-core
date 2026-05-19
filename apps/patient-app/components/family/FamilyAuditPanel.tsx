// apps/patient-app/components/family/FamilyAuditPanel.tsx
import type { FamilyAuditItem } from './types';

function formatWhen(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString();
}

export default function FamilyAuditPanel({
  items,
  loading,
  error,
  onRefresh,
}: {
  items: FamilyAuditItem[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}) {
  return (
    <div className="mt-4 rounded-[24px] border border-white/72 bg-white/84 p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-slate-900">Recent family activity</div>
          <p className="mt-1 text-xs text-slate-500">
            Relationship and invitation events are shown here for traceability.
          </p>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="mt-4 text-sm text-slate-500">Loading history…</div>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50/70 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {!loading && !error && items.length === 0 ? (
        <div className="mt-4 text-sm text-slate-500">No family audit history yet.</div>
      ) : null}

      {!loading && !error && items.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {items.map((item) => (
            <li
              key={item.id}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-medium text-slate-900">{item.description}</div>
                <div className="text-[11px] text-slate-400">{formatWhen(item.createdAt)}</div>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-500">
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5">
                  {item.action}
                </span>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5">
                  {item.entityType}
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}