// src/insightcore/icd10SyndromeHelper.ts
import type { SyndromeRow } from '../../prisma/seed.icd10Syndrome';
import { rows as ICD10_SYNDROME_ROWS } from '../../prisma/seed.icd10Syndrome';

// Keep in sync with your Prisma comment + seed type
export type Syndrome =
  | 'respiratory'
  | 'gi'
  | 'feverRash'
  | 'neuro'
  | 'cardio'
  | 'utiRenal'
  | 'metabolic'
  | 'obgyn'
  | 'derm'
  | 'mskTrauma'
  | 'mental'
  | 'systemicSepsis'
  | 'general'
  | 'other';

export function normalizeIcd10(code: string): string | null {
  if (!code) return null;
  const trimmed = code.trim().toUpperCase();

  const match = trimmed.match(/^([A-Z])(\d{1,2})(.*)$/);
  if (!match) return null;

  const [, letter, digits, rest] = match;
  const paddedDigits = digits.padStart(2, '0');
  return `${letter}${paddedDigits}${rest || ''}`;
}

function extractPrefixParts(code: string): { letter: string; num: number } | null {
  const norm = normalizeIcd10(code);
  if (!norm) return null;
  const m = norm.match(/^([A-Z])(\d{2})/);
  if (!m) return null;
  return { letter: m[1], num: parseInt(m[2], 10) };
}

/**
 * Given a single ICD-10 code, return the best-fit syndrome bucket.
 * Falls back to 'other' if nothing matches.
 */
export function inferSyndromeFromIcd10(code: string): Syndrome {
  const parts = extractPrefixParts(code);
  if (!parts) return 'other';

  for (const row of ICD10_SYNDROME_ROWS as SyndromeRow[]) {
    const fromParts = extractPrefixParts(row.from);
    const toParts = extractPrefixParts(row.to);
    if (!fromParts || !toParts) continue;

    if (fromParts.letter !== parts.letter || toParts.letter !== parts.letter) continue;

    if (parts.num >= fromParts.num && parts.num <= toParts.num) {
      return row.syndrome as Syndrome;
    }
  }

  return 'other';
}
