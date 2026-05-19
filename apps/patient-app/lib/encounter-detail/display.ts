// apps/patient-app/lib/encounter-detail/display.ts

export type CanonStatus = 'Scheduled' | 'InProgress' | 'Completed' | 'Unknown';

export function normalizeEncounterStatus(raw?: string | null): CanonStatus {
  const s = String(raw ?? '').trim().toLowerCase();
  if (!s) return 'Unknown';

  if (s === 'scheduled' || s === 'booked' || s === 'pending') return 'Scheduled';
  if (s === 'inprogress' || s === 'in_progress' || s === 'in progress' || s === 'active' || s === 'open' || s === 'ongoing') {
    return 'InProgress';
  }
  if (s === 'completed' || s === 'complete' || s === 'closed' || s === 'ended' || s === 'done') {
    return 'Completed';
  }

  return 'Unknown';
}

export function encounterStatusClasses(raw?: string | null) {
  switch (normalizeEncounterStatus(raw)) {
    case 'Completed':
      return 'bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-600/20';
    case 'InProgress':
      return 'bg-cyan-500/10 text-cyan-700 ring-1 ring-cyan-600/20';
    case 'Scheduled':
      return 'bg-violet-500/10 text-violet-700 ring-1 ring-violet-600/20';
    default:
      return 'bg-slate-500/10 text-slate-700 ring-1 ring-slate-600/20';
  }
}

export function coverageTextFrom(coverage?: {
  type?: string;
  name?: string;
  scheme?: string;
  last4?: string;
  reference?: string;
} | null) {
  if (!coverage) return null;
  const label = coverage.name || coverage.type || 'Payment method';
  const bits: string[] = [];
  if (coverage.scheme) bits.push(coverage.scheme);
  if (coverage.last4) bits.push(`•••• ${coverage.last4}`);
  if (coverage.reference) bits.push(coverage.reference);
  const details = bits.join(' · ');
  return details ? `${label}: ${details}` : label;
}

export function formatAmount(amount?: number | null, currency?: string | null) {
  if (amount == null || Number.isNaN(Number(amount))) return '—';
  const cur = currency ?? '';
  return `${cur ? `${cur} ` : ''}${Number(amount).toFixed(2)}`;
}

export function initials(name?: string | null) {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '??';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

export function colorForId(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) {
    h = (h << 5) - h + id.charCodeAt(i);
  }
  const hue = Math.abs(h) % 360;
  return `hsl(${hue} 60% 70%)`;
}