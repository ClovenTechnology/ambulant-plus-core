// apps/api-gateway/prisma/seed.icd10Syndrome.ts

export type Icd10SyndromeRow = {
  codeFrom: string;
  codeTo?: string;
  syndrome: string;
  comment?: string;
};

// IMPORTANT: helper imports { rows as ICD10_SYNDROME_ROWS }
export const rows: Icd10SyndromeRow[] = [
  { codeFrom: 'J', syndrome: 'respiratory', comment: 'Respiratory (chapter J)' },
  { codeFrom: 'I', syndrome: 'cardio', comment: 'Circulatory (chapter I)' },
  { codeFrom: 'E10', syndrome: 'diabetes', comment: 'Type 1 diabetes' },
  { codeFrom: 'E11', syndrome: 'diabetes', comment: 'Type 2 diabetes' },
  { codeFrom: 'N39.0', syndrome: 'uti', comment: 'UTI' },
  { codeFrom: 'B20', syndrome: 'hiv', comment: 'HIV disease' },
  { codeFrom: 'A15', syndrome: 'tb', comment: 'Tuberculosis' },
];

export function syndromeForIcd10(code: string): string | null {
  const c = (code || '').trim().toUpperCase();
  if (!c) return null;

  let best: Icd10SyndromeRow | null = null;

  for (const row of rows) {
    const from = row.codeFrom.toUpperCase();

    if (c.startsWith(from)) {
      if (!best || from.length > best.codeFrom.length) best = row;
      continue;
    }

    if (row.codeTo) {
      const to = row.codeTo.toUpperCase();
      if (from.length === to.length && c.length >= from.length) {
        const slice = c.slice(0, from.length);
        if (slice >= from && slice <= to) {
          if (!best || from.length > best.codeFrom.length) best = row;
        }
      }
    }
  }

  return best?.syndrome ?? null;
}
