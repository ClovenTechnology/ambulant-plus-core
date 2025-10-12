// apps/patient-app/src/lib/date.ts
// British style: DD Mon YYYY, 24-hour times

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export function formatDate(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(d.getTime())) return 'Invalid Date';
  const dd = String(d.getDate()).padStart(2, '0');
  const mon = MONTHS[d.getMonth()];
  const yyyy = d.getFullYear();
  return `${dd} ${mon} ${yyyy}`;
}

export function formatDateTime(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(d.getTime())) return 'Invalid DateTime';
  const dd = String(d.getDate()).padStart(2, '0');
  const mon = MONTHS[d.getMonth()];
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${dd} ${mon} ${yyyy} ${hh}:${mm}:${ss}`;
}
