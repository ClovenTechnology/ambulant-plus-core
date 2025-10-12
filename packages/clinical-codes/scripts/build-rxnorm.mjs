#!/usr/bin/env node
/**
 * Build RxNorm index → packages/clinical-codes/data/rxnorm.min.json.gz
 * Supports:
 *   - Official RXNCONSO.RRF (pipe-delimited)  [recommended]
 *   - Simple CSV with headers: rxcui,name,tty[,generic,ingredients,doseForm,strength,atc,synonyms]
 *   - Optional --atc CSV mapping: rxcui,atc1;atc2
 *   - --seed : builds a tiny sample bundle
 *
 * Usage:
 *   node scripts/build-rxnorm.mjs --in ./sources/RXNCONSO.RRF --out ./data/rxnorm.min.json.gz
 *   node scripts/build-rxnorm.mjs --in ./sources/rxnorm.csv --out ./data/rxnorm.min.json.gz --atc ./sources/rxcui_atc.csv
 *   node scripts/build-rxnorm.mjs --seed --out ./data/rxnorm.min.json.gz
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import readline from 'node:readline';

function parseArgs() {
  const out = { in: null, out: './data/rxnorm.min.json.gz', atc: null, seed: false, limit: 0 };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--in') out.in = argv[++i];
    else if (a === '--out') out.out = argv[++i];
    else if (a === '--atc') out.atc = argv[++i];
    else if (a === '--seed') out.seed = true;
    else if (a === '--limit') out.limit = Number(argv[++i] || '0');
  }
  return out;
}

function ensureDir(p) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
}
function toArray(x) {
  if (!x) return [];
  return Array.isArray(x) ? x : String(x).split(/[;|,]/).map(s => s.trim()).filter(Boolean);
}
function norm(s) {
  return s.normalize('NFKD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

// Heuristics
const BRAND_TTYS = new Set(['BN','SBD','BPCK']);
const GENERIC_TTYS = new Set(['IN','PIN','SCD','GPCK']);

function inferGeneric(tty) {
  if (BRAND_TTYS.has(tty)) return false;
  if (GENERIC_TTYS.has(tty)) return true;
  return true; // default prefer generic
}

// parse strength/doseForm from SCD/SBD STR like "ibuprofen 200 MG Oral Tablet"
const DOSE_FORMS = ['Tablet','Capsule','Oral Solution','Oral Suspension','Injection','Cream','Ointment','Syrup','Patch','Suppository','Drops','Spray','Gel','Lotion','Powder','Elixir','Lozenge','Solution','Suspension'];
function parseStrengthDoseForm(str) {
  const strengthMatch = str.match(/\b(\d+(?:\.\d+)?)\s?(MCG|MG|G|KG|ML|L|%)(?:\s*\/\s*(\d+(?:\.\d+)?)\s?(MCG|MG|G|KG|ML|L))?/i);
  const doseForm = DOSE_FORMS.find(df => new RegExp(`\\b${df}\\b`, 'i').test(str)) || undefined;
  let strength;
  if (strengthMatch) {
    const [, n1, u1, n2, u2] = strengthMatch;
    strength = n2 ? `${n1} ${u1} / ${n2} ${u2}` : `${n1} ${u1}`;
  }
  return { strength, doseForm };
}

async function loadATCMap(csvPath) {
  if (!csvPath) return new Map();
  const text = await fsp.readFile(csvPath, 'utf8');
  const lines = text.split(/\r?\n/).filter(Boolean);
  const header = lines.shift().split(',').map(s => s.trim().toLowerCase());
  const idx = (name) => header.indexOf(name);
  const map = new Map();
  for (const line of lines) {
    const cols = line.split(',');
    const rxcui = (cols[idx('rxcui')] ?? '').trim();
    const atc = (cols[idx('atc')] ?? cols[idx('codes')] ?? '').trim();
    if (!rxcui || !atc) continue;
    map.set(rxcui, atc.split(/[;|]/).map(s => s.trim()).filter(Boolean));
  }
  return map;
}

async function loadCSV(csvPath, limit=0) {
  const text = await fsp.readFile(csvPath, 'utf8');
  const [headerLine, ...lines] = text.split(/\r?\n/).filter(Boolean);
  const header = headerLine.split(',').map(s => s.trim().toLowerCase());
  const idx = (name) => header.indexOf(name);
  const byId = new Map();

  for (const line of lines) {
    const cols = line.split(',');
    const rxcui = (cols[idx('rxcui')] ?? '').trim();
    const name = (cols[idx('name')] ?? cols[idx('str')] ?? '').trim();
    const tty = (cols[idx('tty')] ?? '').trim().toUpperCase();
    if (!rxcui || !name || !tty) continue;

    const existing = byId.get(rxcui);
    const entry = existing ?? {
      rxcui, name, tty,
      generic: inferGeneric(tty),
      ingredients: toArray(cols[idx('ingredients')]),
      strength: cols[idx('strength')] || undefined,
      doseForm: cols[idx('doseform')] || undefined,
      atc: toArray(cols[idx('atc')] || cols[idx('codes')]),
      synonyms: [],
    };

    if (!existing) {
      byId.set(rxcui, entry);
    } else {
      // prefer IN/SCD name if present
      if (existing && GENERIC_TTYS.has(tty) && existing.name.length > name.length) {
        existing.name = name;
      }
    }
    const syns = toArray(cols[idx('synonyms')]).concat(name);
    for (const s of syns) if (s && !entry.synonyms.includes(s)) entry.synonyms.push(s);
    if (limit && byId.size >= limit) break;
  }
  return [...byId.values()];
}

async function loadRRF(rrfPath, limit=0) {
  // RXNCONSO.RRF field order (pipe-delimited, trailing '|'):
  // 0 RXCUI | 1 LAT | 2 TS | 3 LUI | 4 STT | 5 SUI | 6 ISPREF | 7 RXAUI | 8 SAUI | 9 SCUI |
  // 10 SDUI | 11 SAB | 12 TTY | 13 CODE | 14 STR | 15 SRL | 16 SUPPRESS | 17 CVF |
  const rl = readline.createInterface({ input: fs.createReadStream(rrfPath, { encoding: 'utf8' }) });
  const byId = new Map();

  for await (const rawLine of rl) {
    const line = rawLine.trim();
    if (!line) continue;
    const cols = line.split('|');
    if (cols.length < 18) continue;
    const rxcui = cols[0]?.trim();
    const lat = cols[1]?.trim();
    const isPref = cols[6]?.trim() === 'Y';
    const tty = (cols[12] || '').trim().toUpperCase();
    const str = (cols[14] || '').trim();
    if (!rxcui || lat !== 'ENG' || !tty || !str) continue;

    const existing = byId.get(rxcui);
    if (!existing) {
      const base = {
        rxcui,
        name: str,
        tty,
        generic: inferGeneric(tty),
        ingredients: [],
        strength: undefined,
        doseForm: undefined,
        atc: [],
        synonyms: [],
      };
      // parse strength/doseForm from STR for SCD/SBD
      if (tty === 'SCD' || tty === 'SBD') {
        const { strength, doseForm } = parseStrengthDoseForm(str);
        base.strength = strength; base.doseForm = doseForm;
      }
      base.synonyms.push(str);
      byId.set(rxcui, base);
    } else {
      // Prefer a generic TTY as canonical name
      if (GENERIC_TTYS.has(tty) && existing.name.length > str.length) {
        existing.name = str;
        existing.tty = tty;
        existing.generic = inferGeneric(tty);
        if (tty === 'SCD' || tty === 'SBD') {
          const { strength, doseForm } = parseStrengthDoseForm(str);
          existing.strength = existing.strength || strength;
          existing.doseForm = existing.doseForm || doseForm;
        }
      }
      if (!existing.synonyms.includes(str)) existing.synonyms.push(str);
    }

    if (limit && byId.size >= limit) break;
  }

  // naive ingredient extraction from canonical name (best-effort, OK for seed)
  for (const e of byId.values()) {
    if (!e.ingredients?.length && /[0-9]/.test(e.name)) {
      // Split on " / " patterns to capture combos
      const head = e.name.split(/\s+\d/)[0]; // before first number
      const parts = head.split(/\s*\/\s*/).map(s => s.trim()).filter(Boolean);
      const uniq = new Set(parts.map(p => p.replace(/\bmg\b|\bmcg\b|\bg\b/ig, '').trim()).filter(Boolean));
      if (uniq.size) e.ingredients = [...uniq];
    }
  }

  return [...byId.values()];
}

function gzipJSON(rows, outFile) {
  ensureDir(outFile);
  const json = JSON.stringify(rows);
  const gz = zlib.gzipSync(Buffer.from(json));
  fs.writeFileSync(outFile, gz);
  return { bytes: gz.length, count: rows.length };
}

async function main() {
  const args = parseArgs();

  let rows = [];
  if (args.seed) {
    rows = [
      { rxcui: '198211', name: 'paracetamol', tty: 'IN', generic: true, ingredients: ['paracetamol'], synonyms: ['acetaminophen'] },
      { rxcui: '855332', name: 'ibuprofen 200 MG Oral Tablet', tty: 'SCD', generic: true, strength: '200 MG', doseForm: 'Tablet', ingredients: ['ibuprofen'], synonyms: ['ibuprofen 200 mg tablet'] },
      { rxcui: '83367',  name: 'amoxicillin', tty: 'IN', generic: true, ingredients: ['amoxicillin'], synonyms: [] },
      { rxcui: '202433', name: 'amoxicillin 500 MG Oral Capsule', tty: 'SCD', generic: true, strength: '500 MG', doseForm: 'Capsule', ingredients: ['amoxicillin'], synonyms: [] },
      { rxcui: '617314', name: 'co-trimoxazole 800 MG / 160 MG Oral Tablet', tty: 'SCD', generic: true, strength: '800 MG / 160 MG', doseForm: 'Tablet', ingredients: ['sulfamethoxazole','trimethoprim'], synonyms: ['trimethoprim-sulfamethoxazole 160/800'] },
      { rxcui: '20610',  name: 'ibuprofen', tty: 'IN', generic: true, ingredients: ['ibuprofen'], synonyms: [] },
      { rxcui: '1116639', name: 'Augmentin 875 MG / 125 MG Oral Tablet', tty: 'SBD', generic: false, strength: '875 MG / 125 MG', doseForm: 'Tablet', ingredients: ['amoxicillin','clavulanate'], synonyms: ['amoxicillin-clavulanate brand'] },
      { rxcui: '351452', name: 'metformin', tty: 'IN', generic: true, ingredients: ['metformin'], synonyms: [] },
      { rxcui: '860975', name: 'metformin 500 MG Oral Tablet', tty: 'SCD', generic: true, strength: '500 MG', doseForm: 'Tablet', ingredients: ['metformin'], synonyms: ['metformin 500 mg tablet'] }
    ];
  } else {
    if (!args.in) throw new Error('Missing --in path to RXNCONSO.RRF or CSV');
    if (/\.rrf$/i.test(args.in)) rows = await loadRRF(args.in, args.limit);
    else if (/\.csv$/i.test(args.in)) rows = await loadCSV(args.in, args.limit);
    else throw new Error('Unsupported input: expected .RRF or .csv');
  }

  // Attach ATC mapping if provided
  if (args.atc) {
    const atcMap = await loadATCMap(args.atc);
    for (const e of rows) {
      const codes = atcMap.get(e.rxcui);
      if (codes?.length) e.atc = codes;
    }
  }

  // Dedup & sort: generics first, then IN/SCD, then name length
  const byId = new Map(rows.map(r => [r.rxcui, r]));
  const list = [...byId.values()].sort((a, b) => {
    const g = (a.generic === false ? 1 : 0) - (b.generic === false ? 1 : 0);
    if (g) return g;
    const ttyRank = (t) => ({ IN: 0, PIN: 1, SCD: 2, GPCK: 3, BN: 4, SBD: 5, BPCK: 6 }[t] ?? 9);
    const t = ttyRank(a.tty) - ttyRank(b.tty);
    if (t) return t;
    return a.name.length - b.name.length;
  });

  const outFile = path.resolve(args.out);
  const { bytes, count } = gzipJSON(list, outFile);
  console.log(`[rxnorm] wrote ${count} rows → ${args.out} (${bytes} bytes gz)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
