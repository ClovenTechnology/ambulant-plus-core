// packages/clinical-codes/src/rxnorm.ts
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

export type RxNormEntry = {
  rxcui: string;
  name?: string;
  title?: string;
  tty: string;
  generic?: boolean;
  isGeneric?: boolean;
  ingredients?: string[];
  strength?: string;
  doseForm?: string;
  atc?: string[];
  synonyms?: string[];
  score?: number;
};

type IndexedRxNorm = {
  entry: RxNormEntry;
  display: string;
  name: string;
  synonyms: string[];
  ingredients: string[];
};

let RXNORM: RxNormEntry[] | null = null;
let INDEX: IndexedRxNorm[] | null = null;
let PREFIX = new Map<string, number[]>();

const TTY_WEIGHT: Record<string, number> = {
  IN: 1.0,
  PIN: 0.95,
  SCD: 0.9,
  GPCK: 0.85,
  MIN: 0.8,
  SBD: 0.75,
  BN: 0.6,
};

function displayName(e: RxNormEntry) {
  return String(e.name || e.title || e.rxcui || '').trim();
}

function isGenericEntry(e: RxNormEntry) {
  if (typeof e.generic === 'boolean') return e.generic;
  if (typeof e.isGeneric === 'boolean') return e.isGeneric;
  return e.tty !== 'BN' && e.tty !== 'SBD';
}

function norm(value: unknown) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function tokenise(value: unknown) {
  return norm(value).split(' ').filter(Boolean);
}

function rebuildIndex() {
  const rows = RXNORM || [];
  INDEX = rows.map((entry) => {
    const display = displayName(entry);
    return {
      entry,
      display,
      name: norm(display),
      synonyms: (entry.synonyms || []).map(norm).filter(Boolean),
      ingredients: (entry.ingredients || []).map(norm).filter(Boolean),
    };
  });

  const prefix = new Map<string, number[]>();
  INDEX.forEach((row, index) => {
    const keys = new Set<string>();
    [row.name, ...row.synonyms, ...row.ingredients].forEach((text) => {
      tokenise(text).forEach((word) => {
        if (word.length >= 2) keys.add(word.slice(0, 2));
        if (word.length >= 3) keys.add(word.slice(0, 3));
      });
    });
    keys.forEach((key) => {
      const current = prefix.get(key);
      if (current) current.push(index);
      else prefix.set(key, [index]);
    });
  });
  PREFIX = prefix;
}

function candidateDataPaths() {
  const envDir = process.env.CLINICAL_CODES_DATA_DIR;
  return [
    envDir ? path.join(envDir, 'rxnorm.min.json.gz') : '',
    path.resolve(process.cwd(), '../../packages/clinical-codes/data/rxnorm.min.json.gz'),
    path.resolve(process.cwd(), 'packages/clinical-codes/data/rxnorm.min.json.gz'),
    path.resolve(process.cwd(), 'data/rxnorm.min.json.gz'),
  ].filter(Boolean);
}

export function setRxNormData(rows: RxNormEntry[]) {
  RXNORM = Array.isArray(rows) ? rows : [];
  rebuildIndex();
}

export async function ensureRxNormLoaded(): Promise<number> {
  if (RXNORM) return RXNORM.length;

  for (const candidate of candidateDataPaths()) {
    try {
      if (!fs.existsSync(candidate)) continue;
      const gz = await fs.promises.readFile(candidate);
      const rows = JSON.parse(zlib.gunzipSync(gz).toString('utf8')) as RxNormEntry[];
      setRxNormData(rows);
      return rows.length;
    } catch {
      // Try the next candidate.
    }
  }

  setRxNormData([]);
  return 0;
}

export type SearchRxNormOptions = {
  limit?: number;
  preferGeneric?: boolean;
};

function scoreRow(row: IndexedRxNorm, query: string, preferGeneric: boolean) {
  const q = norm(query);
  const qWords = tokenise(q);
  const e = row.entry;
  const ttyW = TTY_WEIGHT[e.tty] ?? 0.5;
  const genericW = preferGeneric && isGenericEntry(e) ? 1.3 : 1;

  let score = ttyW * genericW;
  if (row.name === q) score += 100;
  else if (row.name.startsWith(q)) score += 60;
  else if (q.length >= 3 && row.name.includes(q)) score += 35;

  for (const token of qWords) {
    if (row.name.split(' ').includes(token)) score += 12;
    else if (row.name.includes(token)) score += 5;
  }

  for (const synonym of row.synonyms) {
    if (synonym === q) score += 45;
    else if (synonym.startsWith(q)) score += 25;
    else if (q.length >= 3 && synonym.includes(q)) score += 12;
  }

  for (const ingredient of row.ingredients) {
    if (ingredient === q) score += 25;
    else if (ingredient.startsWith(q)) score += 15;
    else if (qWords.some((word) => ingredient.includes(word))) score += 7;
  }

  if (e.strength && q.includes(norm(e.strength))) score += 5;
  if (e.doseForm && q.includes(norm(e.doseForm))) score += 3;
  return score;
}

export async function searchRxNorm(query: string, opts: SearchRxNormOptions = {}) {
  await ensureRxNormLoaded();
  const q = norm(query);
  if (q.length < 2 || !INDEX?.length) return [];

  const { limit = 20, preferGeneric = true } = opts;
  const compact = q.replace(/[^a-z0-9]/g, '');
  const prefixKey = compact.slice(0, compact.length >= 3 ? 3 : 2);
  const candidateIndexes =
    prefixKey.length >= 2 && (PREFIX.get(prefixKey)?.length || 0) >= 5
      ? PREFIX.get(prefixKey)!
      : INDEX.map((_, index) => index);

  return candidateIndexes
    .map((index) => {
      const row = INDEX![index];
      return { ...row.entry, name: row.display, score: scoreRow(row, q, preferGeneric) };
    })
    .filter((row) => Number(row.score || 0) > 0)
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
    .slice(0, Math.max(1, Math.min(limit, 100)));
}
