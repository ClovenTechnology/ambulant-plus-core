// apps/patient-app/components/charts/Stat.tsx
'use client';

type Props = {
  label: string;
  value?: number | string | null;
  unit?: string;
  ts?: string | number | Date | null;
  source?: string;
  decimals?: number; // e.g. 2 for temperature
};

function fmtTs(ts?: Props['ts']) {
  if (!ts) return '—';
  try { return new Date(ts).toLocaleString(); } catch { return '—'; }
}

export default function Stat({ label, value, unit, ts, source, decimals }: Props) {
  let display: string | number = '—';
  if (value !== null && value !== undefined && value !== '') {
    display = typeof value === 'number' && typeof decimals === 'number'
      ? value.toFixed(decimals)
      : value;
  }

  return (
    <div className="rounded-xl border p-3 bg-white/60 dark:bg-zinc-900/40">
      <div className="text-[11px] text-zinc-500 leading-none mb-2">{fmtTs(ts)}</div>
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="text-2xl font-semibold">{display}{unit ? ` ${unit}` : ''}</div>
      <div className="text-[11px] text-zinc-500 leading-none mt-1">{source ?? '—'}</div>
    </div>
  );
}
