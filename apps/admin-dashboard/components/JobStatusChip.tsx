// apps/admin-dashboard/components/JobStatusChip.tsx
// Local fallback implementation. Do not import @shared/fsm here because that alias
// is not configured in admin-dashboard during standalone type-check/build.

export type JobStatus =
  | 'queued'
  | 'pending'
  | 'running'
  | 'processing'
  | 'completed'
  | 'complete'
  | 'succeeded'
  | 'success'
  | 'failed'
  | 'error'
  | 'cancelled'
  | 'canceled'
  | 'paused'
  | string;

function normaliseStatus(status?: JobStatus | null) {
  return String(status || 'pending').trim().toLowerCase();
}

export function getStatusLabel(status?: JobStatus | null) {
  const s = normaliseStatus(status);
  if (s === 'queued') return 'Queued';
  if (s === 'pending') return 'Pending';
  if (s === 'running' || s === 'processing') return 'Processing';
  if (s === 'completed' || s === 'complete' || s === 'succeeded' || s === 'success') return 'Completed';
  if (s === 'failed' || s === 'error') return 'Failed';
  if (s === 'cancelled' || s === 'canceled') return 'Cancelled';
  if (s === 'paused') return 'Paused';
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Pending';
}

export function getStatusClasses(status?: JobStatus | null) {
  const s = normaliseStatus(status);
  if (s === 'completed' || s === 'complete' || s === 'succeeded' || s === 'success') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }
  if (s === 'failed' || s === 'error') return 'border-rose-200 bg-rose-50 text-rose-700';
  if (s === 'running' || s === 'processing') return 'border-blue-200 bg-blue-50 text-blue-700';
  if (s === 'cancelled' || s === 'canceled') return 'border-slate-200 bg-slate-50 text-slate-600';
  if (s === 'paused') return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-slate-200 bg-white text-slate-700';
}

export default function JobStatusChip({
  status,
  className = '',
}: {
  status?: JobStatus | null;
  className?: string;
}) {
  return (
    <span
      className={[
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
        getStatusClasses(status),
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {getStatusLabel(status)}
    </span>
  );
}
