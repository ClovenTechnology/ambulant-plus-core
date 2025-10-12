// packages/clinical-codes/src/rxnorm.ts
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

export type RxNormEntry = {
  rxcui: string;
  name: string;
  tty: string;            // e.g., IN, SCD, SBD, BN
  generic?: boolean;      // true for generic items
  ingredients?: string[]; // human names or RxCUIs (depending on your source)
  strength?: string;
  doseForm?: string;
  atc?: string[];
  synonyms?: string[];
};

let RXNORM: RxNormEntry[] | null = null;

const TTY_WEIGHT: Record<string, number> = {
  IN: 1.0,   // Ingredient
  PIN: 0.95, // Precise Ingredient
  SCD: 0.9,  // Semantic Clinical Drug (generic product)
  GPCK: 0.85,
  SBD: 0.75, // Semantic Branded Drug (brand product)
  BN: 0.6,   // Brand Name
};

function norm(s: string) {
  return s.normalize('NFKD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}
function words(s: string) {
  return norm(s).split(/[^a-z0-9]+/).filter(Boolean);
}

function scoreEntry(e: RxNormEntry, q: string): number {
  // Base weights
  const ttyW = TTY_WEIGHT[e.tty] ?? 0.5;
  const genericW = e.generic === false ? 0.85 : 1.0; // prefer generics (true/undefined) over branded
  let score = 0.2 * ttyW * genericW;

  const qn = norm(q);
  const inName = norm(e.name);

  // Exact / prefix
  if (inName === qn) score += 3.0;
  if (inName.startsWith(qn)) score += 1.5;

  // Word overlap
  const qWords = words(q);
  const nWords = words(e.name);
  const hits = qWords.filter(w => nWords.includes(w)).length;
  score += hits * 0.6;

  // Synonyms, ingredients, dose form
  if (e.synonyms?.length) {
    for (const s of e.synonyms) {
      if (norm(s) === qn) score += 1.0;
      else if (norm(s).startsWith(qn)) score += 0.5;
    }
  }
  if (e.ingredients?.length) {
    const iHits = e.ingredients.map(norm).filter(w => qWords.includes(w)).length;
    score += iHits * 0.4;
  }
  if (e.doseForm && qWords.includes(norm(e.doseForm))) score += 0.2;

  // Strength mention
  if (e.strength) {
    const sn = norm(e.strength);
    if (qn.includes(sn) || sn.includes(qn)) score += 0.3;
  }

  return score;
}

/** Set dataset programmatically (tests or custom loaders). */
export function setRxNormData(rows: RxNormEntry[]) {
  RXNORM = rows ?? [];
}

/** Load gzipped JSON from packages/clinical-codes/data/rxnorm.min.json.gz */
export async function ensureRxNormLoaded(): Promise<number> {
  if (RXNORM) return RXNORM.length;
  const file = path.resolve(__dirname, '..', 'data', 'rxnorm.min.json.gz');
  try {
    const gz = fs.readFileSync(file);
    const raw = zlib.gunzipSync(gz).toString('utf8');
    RXNORM = JSON.parse(raw) as RxNormEntry[];
  } catch (e) {
    console.warn('[rxnorm] Failed to load bundled data:', e);
    RXNORM = [];
  }
  return RXNORM.length;
}

export type SearchRxNormOptions = {
  limit?: number;
  preferGeneric?: boolean; // default true
};

/** Generic-first search across IN/SCD/BN… */
export async function searchRxNorm(query: string, opts: SearchRxNormOptions = {}) {
  const { limit = 20, preferGeneric = true } = opts;
  if (!query?.trim()) return [];
  await ensureRxNormLoaded();
  const data = RXNORM ?? [];

  let rows = data
    .map(e => ({ ...e, score: scoreEntry(e, query) }))
    .filter(e => e.score > 0.2);

  // Small quality bump for generics if requested
  if (preferGeneric) {
    rows = rows.map(r => ({ ...r, score: r.score * (r.generic === false ? 0.92 : 1.0) }));
  }

  // Stable sort: score desc, tty weight desc, shorter names first
  rows.sort((a, b) => {
    const byScore = b.score - a.score;
    if (byScore) return byScore;
    const byTty = (TTY_WEIGHT[b.tty] ?? 0.5) - (TTY_WEIGHT[a.tty] ?? 0.5);
    if (byTty) return byTty;
    return a.name.length - b.name.length;
  });

  return rows.slice(0, limit);
}
