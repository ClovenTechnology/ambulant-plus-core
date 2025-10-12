/* eslint-disable @typescript-eslint/ban-ts-comment */
import type { Readable } from 'stream';

// ---------- Types ----------
export type ICD10Entry = {
  code: string;               // e.g. "J20.9"
  title: string;              // e.g. "Acute bronchitis, unspecified"
  synonyms?: string[];        // extra search terms
  includes?: string[];        // ICD-10 includes (optional)
  excludes?: string[];        // ICD-10 excludes (optional)
  chapter?: string;           // "Chapter X: Diseases of the respiratory system"
  parent?: string;            // parent category code
};

export type ICD10SearchOptions = {
  limit?: number;             // default 25
  fuzzy?: boolean;            // default true
  minScore?: number;          // default 2
  includeParents?: boolean;   // default true (returns parent categories too)
};

export type ICD10SearchHit = {
  code: string;
  title: string;
  score: number;
  matchIn: 'code' | 'title' | 'synonyms' | 'includes' | 'excludes';
  entry: ICD10Entry;
};

// ---------- In-memory store + configuration ----------
let _icd10Data: ICD10Entry[] = [];

/**
 * Inject/replace the full ICD-10 dataset in memory (server-only recommended).
 * Use this at API startup after loading from file or DB.
 */
export function setICD10Data(data: ICD10Entry[]) {
  if (!Array.isArray(data)) throw new Error('setICD10Data: data must be an array');
  _icd10Data = data;
}

/**
 * Returns the current dataset (mainly for testing).
 */
export function getICD10Data(): ICD10Entry[] {
  return _icd10Data;
}

// ---------- Robust loaders (server-side) ----------
/**
 * Load gzipped JSON array of ICD10Entry (e.g., packages/clinical-codes/data/icd10.min.json.gz).
 * Only works in Node (server). No-ops on the client.
 */
export async function loadICD10FromGzip(filePath: string): Promise<void> {
  if (typeof window !== 'undefined') return; // client: skip
  // Lazy import to avoid bundling 'fs'/'zlib' in client builds
  // @ts-ignore
  const fs = await import('node:fs');
  // @ts-ignore
  const zlib = await import('node:zlib');
  // @ts-ignore
  const { promisify } = await import('node:util');
  const gunzip = promisify(zlib.gunzip);

  const buf: Buffer = await fs.promises.readFile(filePath);
  const json = await gunzip(buf);
  const list = JSON.parse(json.toString('utf8')) as ICD10Entry[];
  setICD10Data(list);
}

/**
 * Load plain JSON (ungzipped). Server-side helper.
 */
export async function loadICD10FromJson(filePath: string): Promise<void> {
  if (typeof window !== 'undefined') return;
  // @ts-ignore
  const fs = await import('node:fs');
  const raw = await fs.promises.readFile(filePath, 'utf8');
  const list = JSON.parse(raw) as ICD10Entry[];
  setICD10Data(list);
}

// ---------- Search helpers ----------
const ABBREVIATIONS: Record<string, string[]> = {
  // common clinical abbreviations → expanded tokens
  'htn': ['hypertension'],
  'dm': ['diabetes'],
  't2dm': ['type 2 diabetes', 'type ii diabetes'],
  't1dm': ['type 1 diabetes', 'type i diabetes'],
  'copd': ['chronic obstructive pulmonary disease'],
  'ckd': ['chronic kidney disease'],
  'hf': ['heart failure'],
  'mi': ['myocardial infarction'],
  'uti': ['urinary tract infection'],
  'uri': ['upper respiratory infection', 'upper respiratory tract infection'],
  'lbp': ['low back pain'],
  'tb': ['tuberculosis'],
  'hiv': ['human immunodeficiency virus', 'hiv disease'],
  'pud': ['peptic ulcer disease'],
  'pna': ['pneumonia'],
};

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')    // strip diacritics
    .replace(/[^a-z0-9\s\.]/g, ' ')     // keep letters/numbers/dots
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(q: string): string[] {
  const n = normalize(q);
  const raw = n.split(' ').filter(Boolean);
  const expanded: string[] = [];
  for (const t of raw) {
    expanded.push(t);
    const add = ABBREVIATIONS[t];
    if (add) expanded.push(...add.map(normalize));
  }
  return Array.from(new Set(expanded)); // unique
}

function scoreAgainst(hay: string, phrase: string, tokens: string[]): number {
  let score = 0;

  // Exact code or phrase boosts
  if (hay === phrase) score += 50;
  if (hay.startsWith(phrase)) score += 40;
  if (hay.includes(phrase)) score += 30;

  // Token coverage
  let covered = 0;
  for (const t of tokens) {
    if (!t) continue;
    if (hay.includes(t)) covered++;
    // small prefix bias
    if (hay.startsWith(t)) score += 2;
  }
  score += covered * 4;

  // Shorter matches get a tiny bonus
  if (hay.length < 20 && phrase.length > 2 && hay.startsWith(phrase)) score += 4;

  return score;
}

function bestFieldScore(entry: ICD10Entry, qPhrase: string, qTokens: string[]) {
  const fields: Array<{ val?: string | string[]; key: ICD10SearchHit['matchIn'] }> = [
    { val: entry.code, key: 'code' },
    { val: entry.title, key: 'title' },
    { val: entry.synonyms, key: 'synonyms' },
    { val: entry.includes, key: 'includes' },
    { val: entry.excludes, key: 'excludes' },
  ];

  let best: { score: number; where: ICD10SearchHit['matchIn'] } = { score: 0, where: 'title' };

  for (const f of fields) {
    if (!f.val) continue;
    if (Array.isArray(f.val)) {
      for (const s of f.val) {
        const sc = scoreAgainst(normalize(s), qPhrase, qTokens);
        if (sc > best.score) best = { score: sc, where: f.key };
      }
    } else {
      const sc = scoreAgainst(normalize(f.val), qPhrase, qTokens);
      if (sc > best.score) best = { score: sc, where: f.key };
    }
  }
  return best;
}

// ---------- Public search ----------
export function searchICD10(query: string, opts: ICD10SearchOptions = {}): ICD10SearchHit[] {
  const { limit = 25, fuzzy = true, minScore = 2, includeParents = true } = opts;

  const phrase = normalize(query);
  const tokens = tokenize(query);
  const out: ICD10SearchHit[] = [];

  if (!phrase) return [];

  const data = includeParents ? _icd10Data : _icd10Data.filter(e => !e.code || !/^[A-Z]\d{2}$/.test(e.code)); // simple parent filter

  for (const entry of data) {
    // quick path: code exact or startsWith
    const codeN = normalize(entry.code);
    if (codeN === phrase) {
      out.push({ code: entry.code, title: entry.title, score: 999, matchIn: 'code', entry });
      continue;
    }
    if (codeN.startsWith(phrase)) {
      out.push({ code: entry.code, title: entry.title, score: 200, matchIn: 'code', entry });
      continue;
    }

    // weighted field scoring
    const { score, where } = bestFieldScore(entry, phrase, tokens);
    if (score >= minScore) {
      out.push({ code: entry.code, title: entry.title, score, matchIn: where, entry });
    }
  }

  // Optional: simple fuzzy (very light) — prefix drop of last char if long token
  if (fuzzy && out.length < limit && phrase.length >= 5) {
    const fuzzyPhrase = phrase.slice(0, -1);
    for (const entry of data) {
      const hay = normalize(`${entry.code} ${entry.title} ${(entry.synonyms || []).join(' ')}`);
      if (hay.includes(fuzzyPhrase)) {
        const base = bestFieldScore(entry, fuzzyPhrase, tokens);
        const bonus = Math.max(0, 10 - (phrase.length - fuzzyPhrase.length));
        const sc = base.score + bonus;
        if (sc >= minScore) out.push({ code: entry.code, title: entry.title, score: sc, matchIn: 'title', entry });
      }
    }
  }

  // Deduplicate by code (keep best score)
  const byCode = new Map<string, ICD10SearchHit>();
  for (const hit of out) {
    const prev = byCode.get(hit.code);
    if (!prev || hit.score > prev.score) byCode.set(hit.code, hit);
  }

  return Array.from(byCode.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// ---------- Embedded fallback seed (small; real use: load full dataset) ----------
if (_icd10Data.length === 0) {
  // A compact starter set; replace with full dataset via loadICD10FromGzip() or setICD10Data().
  setICD10Data([
    { code: 'J20.9', title: 'Acute bronchitis, unspecified', synonyms: ['bronchitis acute', 'acute tracheobronchitis'] },
    { code: 'J44.9', title: 'Chronic obstructive pulmonary disease, unspecified', synonyms: ['copd', 'chronic obstructive lung disease'] },
    { code: 'I10',   title: 'Essential (primary) hypertension', synonyms: ['hypertension', 'htn', 'high blood pressure'] },
    { code: 'E11.9', title: 'Type 2 diabetes mellitus without complications', synonyms: ['t2dm', 'diabetes type 2'] },
    { code: 'E10.9', title: 'Type 1 diabetes mellitus without complications', synonyms: ['t1dm', 'diabetes type 1'] },
    { code: 'N39.0', title: 'Urinary tract infection, site not specified', synonyms: ['uti'] },
    { code: 'J18.9', title: 'Pneumonia, unspecified organism', synonyms: ['pna', 'pneumonia'] },
    { code: 'M54.5', title: 'Low back pain', synonyms: ['lbp'] },
    { code: 'B20',   title: 'Human immunodeficiency virus [HIV] disease', synonyms: ['hiv'] },
    { code: 'A15.0', title: 'Tuberculosis of lung, confirmed by sputum microscopy with or without culture', synonyms: ['tb', 'pulmonary tuberculosis'] },
    { code: 'I21.9', title: 'Acute myocardial infarction, unspecified', synonyms: ['mi', 'heart attack'] },
    { code: 'K27.9', title: 'Peptic ulcer, site unspecified, unspecified as acute or chronic, without hemorrhage or perforation', synonyms: ['pud'] },
    { code: 'J06.9', title: 'Acute upper respiratory infection, unspecified', synonyms: ['uri', 'urti'] },
    { code: 'N18.9', title: 'Chronic kidney disease, unspecified', synonyms: ['ckd'] },
    { code: 'I50.9', title: 'Heart failure, unspecified', synonyms: ['hf', 'congestive heart failure'] },
  ]);
}
