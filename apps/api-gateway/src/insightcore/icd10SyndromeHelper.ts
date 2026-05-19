// src/insightcore/icd10SyndromeHelper.ts
import { rows as ICD10_SYNDROME_ROWS } from '../../prisma/seed.icd10Syndrome';

type SyndromeSeedRow = Record<string, unknown>;

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

function pickString(row: SyndromeSeedRow, keys: string[]): string | null {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }

  return null;
}

function rowFrom(row: SyndromeSeedRow): string | null {
  return pickString(row, ['from', 'start', 'startCode', 'codeFrom', 'rangeStart', 'min']);
}

function rowTo(row: SyndromeSeedRow): string | null {
  return pickString(row, ['to', 'end', 'endCode', 'codeTo', 'rangeEnd', 'max']);
}

function rowSyndrome(row: SyndromeSeedRow): Syndrome {
  const raw = pickString(row, ['syndrome', 'bucket', 'category', 'group']) || 'other';
  return raw as Syndrome;
}

/**
 * Given a single ICD-10 code, return the best-fit syndrome bucket.
 * Falls back to 'other' if nothing matches.
 */
export function inferSyndromeFromIcd10(code: string): Syndrome {
  const parts = extractPrefixParts(code);
  if (!parts) return 'other';

  for (const row of ICD10_SYNDROME_ROWS as unknown as SyndromeSeedRow[]) {
    const from = rowFrom(row);
    const to = rowTo(row);

    if (!from || !to) continue;

    const fromParts = extractPrefixParts(from);
    const toParts = extractPrefixParts(to);

    if (!fromParts || !toParts) continue;
    if (fromParts.letter !== parts.letter || toParts.letter !== parts.letter) continue;

    if (parts.num >= fromParts.num && parts.num <= toParts.num) {
      return rowSyndrome(row);
    }
  }

  return 'other';
}