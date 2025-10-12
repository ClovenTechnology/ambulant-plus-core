// apps/patient-app/src/lib/number.ts

export function fmt2(n: unknown): string {
  const x = typeof n === 'string' ? Number(n) : (n as number);
  if (Number.isNaN(x) || x === undefined || x === null) return '—';
  return x.toFixed(2);
}


