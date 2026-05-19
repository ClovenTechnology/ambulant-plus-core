// apps/patient-app/lib/encounters/display.ts

export type EncounterCanonStatus = 'completed' | 'in_progress' | 'scheduled' | 'unknown';
export type EncounterCanonMode = 'video' | 'chat' | 'audio' | 'in_person' | 'unknown';

export function normalizeEncounterStatus(s?: string | null): EncounterCanonStatus {
  const v = String(s ?? '').trim().toLowerCase();
  if (!v) return 'unknown';

  if (v === 'completed' || v === 'done' || v === 'closed' || v === 'ended') return 'completed';
  if (v === 'inprogress' || v === 'in_progress' || v === 'in progress' || v === 'active' || v === 'open' || v === 'ongoing') {
    return 'in_progress';
  }
  if (v === 'scheduled' || v === 'booked' || v === 'pending') return 'scheduled';

  return 'unknown';
}

export function normalizeMode(m?: string | null): EncounterCanonMode {
  const v = String(m ?? '').trim().toLowerCase();
  if (!v) return 'unknown';
  if (v === 'video' || v === 'virtual') return 'video';
  if (v === 'chat') return 'chat';
  if (v === 'audio' || v === 'call' || v === 'phone') return 'audio';
  if (v === 'inperson' || v === 'in_person' || v === 'physical') return 'in_person';
  return 'unknown';
}

export function labelForEncounterStatus(status?: string | null) {
  const canon = normalizeEncounterStatus(status);
  switch (canon) {
    case 'completed':
      return 'Completed';
    case 'in_progress':
      return 'In progress';
    case 'scheduled':
      return 'Scheduled';
    default:
      return status?.trim() || 'Unknown';
  }
}

export function caseStatusClasses(status?: string | null) {
  switch (String(status ?? '').trim()) {
    case 'Open':
      return 'bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-600/20';
    case 'Closed':
      return 'bg-slate-500/10 text-slate-700 ring-1 ring-slate-600/20';
    case 'Referred':
      return 'bg-amber-500/10 text-amber-800 ring-1 ring-amber-600/20';
    default:
      return 'bg-slate-500/10 text-slate-700 ring-1 ring-slate-600/20';
  }
}

export function encounterStatusClasses(status?: string | null) {
  switch (normalizeEncounterStatus(status)) {
    case 'completed':
      return 'bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-600/20';
    case 'in_progress':
      return 'bg-cyan-500/10 text-cyan-700 ring-1 ring-cyan-600/20';
    case 'scheduled':
      return 'bg-violet-500/10 text-violet-700 ring-1 ring-violet-600/20';
    default:
      return 'bg-slate-500/10 text-slate-700 ring-1 ring-slate-600/20';
  }
}

export function modeLabel(mode?: string | null) {
  switch (normalizeMode(mode)) {
    case 'video':
      return 'Video';
    case 'chat':
      return 'Chat';
    case 'audio':
      return 'Audio';
    case 'in_person':
      return 'In person';
    default:
      return mode?.trim() || 'Unknown';
  }
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
  return `hsl(${hue} 60% 75%)`;
}