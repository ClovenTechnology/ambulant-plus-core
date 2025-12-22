// apps/clinician-app/app/api/_apigw.ts
export function apigwBase() {
  const base = process.env.NEXT_PUBLIC_APIGW_BASE || process.env.APIGW_BASE;
  if (!base) throw new Error('Missing NEXT_PUBLIC_APIGW_BASE (or APIGW_BASE)');
  return base.replace(/\/$/, '');
}
