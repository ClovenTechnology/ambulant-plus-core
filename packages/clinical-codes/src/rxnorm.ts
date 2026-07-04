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

let RXNORM: RxNormEntry[] | null = null;

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
  return String(value || '').normalize('NFKD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

function words(value: unknown) {
  return norm(value).split(/[^a-z0-9]+/).filter(Boolean);
}

function scoreEntry(e: RxNormEntry, q: string): number {
  const name = displayName(e);
  if (!name) return 0;

  const ttyW = TTY_WEIGHT[e.tty] ?? 0.5;
  const genericW = isGenericEntry(e) ? 1.0 : 0.85;
  let score = 0.2 * ttyW * genericW;

  const qn = norm(q);
  const inName = norm(name);

  if (inName === qn) score += 3.0;
  if (inName.startsWith(qn)) score += 1.5;
  if (inName.includes(qn) && qn.length >= 3) score += 0.8;

  const qWords = words(q);
  const nWords = words(name);
  const hits = qWords.filter((w) => nWords.includes(w)).length;
  score += hits * 0.6;

  if (e.synonyms?.length) {
    for (const s of e.synonyms) {
      const sn = norm(s);
      if (sn === qn) score += 1.0;
      else if (sn.startsWith(qn)) score += 0.5;
      else if (sn.includes(qn) && qn.length >= 3) score += 0.25;
    }
  }

  if (e.ingredients?.length) {
    const iHits = e.ingredients.map(norm).filter((w) => qWords.includes(w)).length;
    score += iHits * 0.4;
  }

  if (e.doseForm && qWords.includes(norm(e.doseForm))) score += 0.2;

  if (e.strength) {
    const sn = norm(e.strength);
    if (qn.includes(sn) || sn.includes(qn)) score += 0.3;
  }

  return score;
}

function candidateDataPaths() {
  const envDir = process.env.CLINICAL_CODES_DATA_DIR;
  return [
    envDir ? path.resolve(envDir, 'rxnorm.min.json.gz') : null,
    path.resolve(__dirname, '..', 'data', 'rxnorm.min.json.gz'),
    path.resolve(process.cwd(), 'packages', 'clinical-codes', 'data', 'rxnorm.min.json.gz'),
    path.resolve(process.cwd(), '..', '..', 'packages', 'clinical-codes', 'data', 'rxnorm.min.json.gz'),
    path.resolve(process.cwd(), 'data', 'rxnorm.min.json.gz'),
  ].filter(Boolean) as string[];
}

export function setRxNormData(rows: RxNormEntry[]) {
  RXNORM = rows ?? [];
}

export async function ensureRxNormLoaded(): Promise<number> {
  if (RXNORM) return RXNORM.length;

  for (const file of candidateDataPaths()) {
    try {
      if (!fs.existsSync(file)) continue;
      const gz = fs.readFileSync(file);
      const raw = zlib.gunzipSync(gz).toString('utf8');
      const rows = JSON.parse(raw) as RxNormEntry[];
      RXNORM = Array.isArray(rows) ? rows : [];
      return RXNORM.length;
    } catch (err) {
      console.warn('[rxnorm] Failed candidate data load:', file, err);
    }
  }

  RXNORM = [];
  return RXNORM.length;
}

export type SearchRxNormOptions = {
  limit?: number;
  preferGeneric?: boolean;
};

export async function searchRxNorm(query: string, opts: SearchRxNormOptions = {}) {
  const { limit = 20, preferGeneric = true } = opts;
  if (!query?.trim()) return [];

  await ensureRxNormLoaded();
  const data = RXNORM ?? [];

  let rows = data
    .map((e) => ({
      ...e,
      name: displayName(e),
      generic: isGenericEntry(e),
      score: scoreEntry(e, query),
    }))
    .filter((e) => e.score > 0.2);

  if (preferGeneric) {
    rows = rows.map((r) => ({ ...r, score: r.score * (r.generic === false ? 0.92 : 1.0) }));
  }

  rows.sort((a, b) => {
    const byScore = b.score - a.score;
    if (byScore) return byScore;

    const byTty = (TTY_WEIGHT[b.tty] ?? 0.5) - (TTY_WEIGHT[a.tty] ?? 0.5);
    if (byTty) return byTty;

    return displayName(a).length - displayName(b).length;
  });

  return rows.slice(0, limit);
}
