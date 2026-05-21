// apps/patient-app/lib/encounters/display.ts
export type CanonEncounterStatus = 'scheduled' | 'open' | 'in_progress' | 'completed' | 'cancelled' | 'referred' | 'unknown';
export type CanonEncounterMode = 'video' | 'audio' | 'chat' | 'in_person' | 'unknown';

export function normalizeStatus(value?: string | null): CanonEncounterStatus {
  const raw = String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (!raw) return 'unknown';
  if (['scheduled', 'booked', 'pending'].includes(raw)) return 'scheduled';
  if (['open', 'active', 'triage', 'consult', 'ongoing'].includes(raw)) return 'open';
  if (['in_progress', 'inprogress', 'progress'].includes(raw)) return 'in_progress';
  if (['completed', 'complete', 'closed', 'done', 'ended'].includes(raw)) return 'completed';
  if (['cancelled', 'canceled', 'void'].includes(raw)) return 'cancelled';
  if (['referred', 'referral'].includes(raw)) return 'referred';
  return 'unknown';
}

export function statusLabel(value?: string | null) {
  switch (normalizeStatus(value)) {
    case 'scheduled':
      return 'Scheduled';
    case 'open':
      return 'Open';
    case 'in_progress':
      return 'In progress';
    case 'completed':
      return 'Completed';
    case 'cancelled':
      return 'Cancelled';
    case 'referred':
      return 'Referred';
    default:
      return String(value || '').trim() || 'Unknown';
  }
}

export function caseStatusClasses(value?: string | null) {
  switch (normalizeStatus(value)) {
    case 'scheduled':
      return 'border-blue-200 bg-blue-50 text-blue-800';
    case 'open':
    case 'in_progress':
      return 'border-amber-200 bg-amber-50 text-amber-800';
    case 'completed':
      return 'border-emerald-200 bg-emerald-50 text-emerald-800';
    case 'cancelled':
      return 'border-rose-200 bg-rose-50 text-rose-800';
    case 'referred':
      return 'border-indigo-200 bg-indigo-50 text-indigo-800';
    default:
      return 'border-slate-200 bg-slate-50 text-slate-700';
  }
}

export function normalizeMode(value?: string | null): CanonEncounterMode {
  const raw = String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (!raw) return 'unknown';
  if (['video', 'televisit', 'telemedicine', 'remote', 'virtual'].includes(raw)) return 'video';
  if (['audio', 'phone', 'telephone', 'voice'].includes(raw)) return 'audio';
  if (['chat', 'message', 'messaging'].includes(raw)) return 'chat';
  if (['in_person', 'inperson', 'physical', 'home_visit', 'clinic_visit', 'face_to_face'].includes(raw)) return 'in_person';
  return 'unknown';
}

export function modeLabel(value?: string | null) {
  switch (normalizeMode(value)) {
    case 'video':
      return 'Video visit';
    case 'audio':
      return 'Audio visit';
    case 'chat':
      return 'Chat';
    case 'in_person':
      return 'In person';
    default:
      return 'Encounter';
  }
}

export function formatDateTime(value?: string | number | Date | null, fallback = 'Not recorded') {
  if (value == null || value === '') return fallback;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDateOnly(value?: string | number | Date | null, fallback = 'Not recorded') {
  if (value == null || value === '') return fallback;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

export function relativeLabel(value?: string | number | Date | null) {
  if (value == null || value === '') return 'No timestamp';
  const date = value instanceof Date ? value : new Date(value);
  const t = date.getTime();
  if (!Number.isFinite(t)) return formatDateOnly(value);

  const diff = Date.now() - t;
  const abs = Math.abs(diff);
  const minutes = Math.round(abs / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ${diff >= 0 ? 'ago' : 'from now'}`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ${diff >= 0 ? 'ago' : 'from now'}`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ${diff >= 0 ? 'ago' : 'from now'}`;
  return formatDateOnly(value);
}

export function displayMoney(amountMinor?: number | null, currency?: string | null) {
  if (amountMinor == null || !Number.isFinite(Number(amountMinor))) return 'Not recorded';
  const code = currency || 'ZAR';
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: code }).format(Number(amountMinor) / 100);
  } catch {
    return `${code} ${(Number(amountMinor) / 100).toFixed(2)}`;
  }
}
