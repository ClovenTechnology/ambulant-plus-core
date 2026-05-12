// apps/api-gateway/src/insightcore/icd10SyndromeHelper.ts

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

type SyndromeRow = {
  from: string;
  to: string;
  syndrome: Syndrome;
};

/**
 * Runtime-safe ICD-10 syndrome buckets.
 * This avoids importing from Prisma seed files during Next/Vercel builds.
 */
const ICD10_SYNDROME_ROWS: SyndromeRow[] = [
  // Certain infectious and parasitic diseases.
  { from: 'A00', to: 'A09', syndrome: 'gi' },
  { from: 'A15', to: 'A19', syndrome: 'respiratory' },
  { from: 'A20', to: 'A49', syndrome: 'systemicSepsis' },
  { from: 'A50', to: 'A64', syndrome: 'obgyn' },
  { from: 'A65', to: 'A69', syndrome: 'systemicSepsis' },
  { from: 'A80', to: 'A89', syndrome: 'neuro' },
  { from: 'A90', to: 'A99', syndrome: 'feverRash' },
  { from: 'B00', to: 'B09', syndrome: 'feverRash' },
  { from: 'B15', to: 'B19', syndrome: 'gi' },
  { from: 'B20', to: 'B24', syndrome: 'systemicSepsis' },
  { from: 'B25', to: 'B34', syndrome: 'systemicSepsis' },
  { from: 'B35', to: 'B49', syndrome: 'derm' },
  { from: 'B50', to: 'B64', syndrome: 'systemicSepsis' },
  { from: 'B65', to: 'B83', syndrome: 'gi' },
  { from: 'B85', to: 'B89', syndrome: 'derm' },

  // Neoplasms and blood disorders.
  { from: 'C00', to: 'D49', syndrome: 'general' },
  { from: 'D50', to: 'D89', syndrome: 'general' },

  // Endocrine/metabolic.
  { from: 'E00', to: 'E90', syndrome: 'metabolic' },

  // Mental and behavioural.
  { from: 'F00', to: 'F99', syndrome: 'mental' },

  // Nervous system.
  { from: 'G00', to: 'G99', syndrome: 'neuro' },

  // Eye/ear usually general in this high-level bucket map.
  { from: 'H00', to: 'H59', syndrome: 'general' },
  { from: 'H60', to: 'H95', syndrome: 'general' },

  // Circulatory.
  { from: 'I00', to: 'I99', syndrome: 'cardio' },

  // Respiratory.
  { from: 'J00', to: 'J99', syndrome: 'respiratory' },

  // Digestive.
  { from: 'K00', to: 'K95', syndrome: 'gi' },

  // Skin.
  { from: 'L00', to: 'L99', syndrome: 'derm' },

  // Musculoskeletal.
  { from: 'M00', to: 'M99', syndrome: 'mskTrauma' },

  // Genitourinary.
  { from: 'N00', to: 'N39', syndrome: 'utiRenal' },
  { from: 'N40', to: 'N99', syndrome: 'obgyn' },

  // Pregnancy/childbirth.
  { from: 'O00', to: 'O99', syndrome: 'obgyn' },

  // Perinatal / congenital.
  { from: 'P00', to: 'P96', syndrome: 'general' },
  { from: 'Q00', to: 'Q99', syndrome: 'general' },

  // Symptoms/signs.
  { from: 'R00', to: 'R09', syndrome: 'cardio' },
  { from: 'R10', to: 'R19', syndrome: 'gi' },
  { from: 'R20', to: 'R29', syndrome: 'neuro' },
  { from: 'R30', to: 'R39', syndrome: 'utiRenal' },
  { from: 'R40', to: 'R49', syndrome: 'neuro' },
  { from: 'R50', to: 'R69', syndrome: 'systemicSepsis' },
  { from: 'R70', to: 'R99', syndrome: 'general' },

  // Injury/external causes.
  { from: 'S00', to: 'T98', syndrome: 'mskTrauma' },
  { from: 'V00', to: 'Y99', syndrome: 'mskTrauma' },

  // Factors influencing health status.
  { from: 'Z00', to: 'Z99', syndrome: 'general' },
];

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

  for (const row of ICD10_SYNDROME_ROWS) {
    const fromParts = extractPrefixParts(row.from);
    const toParts = extractPrefixParts(row.to);
    if (!fromParts || !toParts) continue;

    if (fromParts.letter !== parts.letter || toParts.letter !== parts.letter) continue;

    if (parts.num >= fromParts.num && parts.num <= toParts.num) {
      return row.syndrome;
    }
  }

  return 'other';
}