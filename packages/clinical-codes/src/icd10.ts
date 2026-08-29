/* eslint-disable @typescript-eslint/ban-ts-comment */
export type ICD10Entry = {
  code: string;
  title: string;
  synonyms?: string[];
  includes?: string[];
  excludes?: string[];
  chapter?: string;
  parent?: string;
};

export type ICD10SearchOptions = {
  limit?: number;
  fuzzy?: boolean;
  minScore?: number;
  includeParents?: boolean;
};

export type ICD10SearchHit = {
  code: string;
  title: string;
  score: number;
  matchIn: 'code' | 'title' | 'synonyms' | 'includes' | 'excludes';
  entry: ICD10Entry;
};

type IndexedEntry = {
  entry: ICD10Entry;
  code: string;
  title: string;
  synonyms: string[];
  includes: string[];
  excludes: string[];
};

let _icd10Data: ICD10Entry[] = [];
let _index: IndexedEntry[] = [];
let _prefix = new Map<string, number[]>();

const ABBREVIATIONS: Record<string, string[]> = {
  htn: ['hypertension'],
  dm: ['diabetes'],
  t2dm: ['type 2 diabetes', 'type ii diabetes'],
  t1dm: ['type 1 diabetes', 'type i diabetes'],
  copd: ['chronic obstructive pulmonary disease'],
  ckd: ['chronic kidney disease'],
  hf: ['heart failure'],
  mi: ['myocardial infarction'],
  uti: ['urinary tract infection'],
  uri: ['upper respiratory infection', 'upper respiratory tract infection'],
  lbp: ['low back pain'],
  tb: ['tuberculosis'],
  hiv: ['human immunodeficiency virus', 'hiv disease'],
  pud: ['peptic ulcer disease'],
  pna: ['pneumonia'],
};

function normalize(value: unknown) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function tokensFor(query: string) {
  const raw = normalize(query).split(' ').filter(Boolean);
  const expanded = [...raw];
  for (const token of raw) {
    const extra = ABBREVIATIONS[token];
    if (extra) expanded.push(...extra.map(normalize));
  }
  return unique(expanded);
}

function prefixKeys(value: string) {
  const words = normalize(value).split(/[\s.]+/).filter(Boolean);
  const keys = new Set<string>();
  for (const word of words) {
    if (word.length >= 2) keys.add(word.slice(0, 2));
    if (word.length >= 3) keys.add(word.slice(0, 3));
  }
  return keys;
}

function rebuildIndex() {
  _index = _icd10Data.map((entry) => ({
    entry,
    code: normalize(entry.code),
    title: normalize(entry.title),
    synonyms: (entry.synonyms || []).map(normalize).filter(Boolean),
    includes: (entry.includes || []).map(normalize).filter(Boolean),
    excludes: (entry.excludes || []).map(normalize).filter(Boolean),
  }));

  const prefix = new Map<string, number[]>();
  _index.forEach((row, index) => {
    const values = [
      row.entry.code,
      row.entry.title,
      ...(row.entry.synonyms || []),
      ...(row.entry.includes || []),
    ];
    const keys = new Set<string>();
    values.forEach((value) => prefixKeys(value).forEach((key) => keys.add(key)));
    keys.forEach((key) => {
      const current = prefix.get(key);
      if (current) current.push(index);
      else prefix.set(key, [index]);
    });
  });
  _prefix = prefix;
}

export function setICD10Data(data: ICD10Entry[]) {
  if (!Array.isArray(data)) throw new Error('setICD10Data: data must be an array');
  _icd10Data = data
    .filter((row) => row && String(row.code || '').trim() && String(row.title || '').trim())
    .map((row) => ({ ...row, code: String(row.code).trim(), title: String(row.title).trim() }));
  rebuildIndex();
}

export function getICD10Data(): ICD10Entry[] {
  return _icd10Data;
}

export async function loadICD10FromGzip(filePath: string): Promise<void> {
  if (typeof window !== 'undefined') return;
  const fs = await import('node:fs');
  const zlib = await import('node:zlib');
  const { promisify } = await import('node:util');
  const gunzip = promisify(zlib.gunzip);
  const buf: Buffer = await fs.promises.readFile(filePath);
  const json = await gunzip(buf);
  setICD10Data(JSON.parse(json.toString('utf8')) as ICD10Entry[]);
}

export async function loadICD10FromJson(filePath: string): Promise<void> {
  if (typeof window !== 'undefined') return;
  const fs = await import('node:fs');
  setICD10Data(JSON.parse(await fs.promises.readFile(filePath, 'utf8')) as ICD10Entry[]);
}

function fieldScore(hay: string, phrase: string, tokens: string[]) {
  if (!hay) return 0;
  let score = 0;
  if (hay === phrase) score += 100;
  else if (hay.startsWith(phrase)) score += 70;
  else if (phrase.length >= 3 && hay.includes(phrase)) score += 45;

  let tokenHits = 0;
  for (const token of tokens) {
    if (hay === token) score += 18;
    if (hay.startsWith(token)) score += 10;
    if (hay.includes(token)) tokenHits += 1;
  }
  score += tokenHits * 6;
  return score;
}

export function searchICD10(query: string, opts: ICD10SearchOptions = {}): ICD10SearchHit[] {
  const { limit = 25, minScore = 2, includeParents = true } = opts;
  const phrase = normalize(query);
  if (!phrase) return [];

  const qTokens = tokensFor(query);
  const compact = phrase.replace(/[^a-z0-9]/g, '');
  const prefixKey = compact.slice(0, compact.length >= 3 ? 3 : 2);
  const candidateIndexes =
    prefixKey.length >= 2 && (_prefix.get(prefixKey)?.length || 0) >= 5
      ? _prefix.get(prefixKey)!
      : _index.map((_, index) => index);

  const hits: ICD10SearchHit[] = [];
  for (const index of candidateIndexes) {
    const row = _index[index];
    if (!row) continue;

    const scored: Array<[ICD10SearchHit['matchIn'], number]> = [
      ['code', fieldScore(row.code, phrase, qTokens) + (row.code.startsWith(phrase) ? 30 : 0)],
      ['title', fieldScore(row.title, phrase, qTokens)],
      ['synonyms', Math.max(0, ...row.synonyms.map((v) => fieldScore(v, phrase, qTokens)))],
      ['includes', Math.max(0, ...row.includes.map((v) => fieldScore(v, phrase, qTokens)))],
      ['excludes', Math.max(0, ...row.excludes.map((v) => fieldScore(v, phrase, qTokens)))],
    ];

    scored.sort((a, b) => b[1] - a[1]);
    const [matchIn, score] = scored[0];
    if (score < minScore) continue;
    if (!includeParents && row.entry.parent == null && row.entry.code.length <= 3) continue;

    hits.push({
      code: row.entry.code,
      title: row.entry.title,
      score,
      matchIn,
      entry: row.entry,
    });
  }

  return hits
    .sort((a, b) => b.score - a.score || a.code.localeCompare(b.code))
    .slice(0, Math.max(1, Math.min(limit, 100)));
}
