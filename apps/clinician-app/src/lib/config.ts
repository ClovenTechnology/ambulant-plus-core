function cleanOrigin(value: string | undefined) {
  const v = String(value || '').trim().replace(/\/+$/, '');
  if (!v) return '';
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(v)) return '';
  return v;
}

export const CLIN = cleanOrigin(process.env.NEXT_PUBLIC_CLINICIAN_BASE_URL);
