#!/usr/bin/env node
/**
 * Build ICD-10 index → packages/clinical-codes/data/icd10.min.json.gz
 * Supports:
 *   - CSV with headers: code,title[,synonyms,category]
 *   - JSON / JSONL of {code,title,synonyms?,category?}
 *   - --seed : builds a tiny sample bundle (no input file needed)
 *
 * Usage examples:
 *   node scripts/build-icd10.mjs --in ./sources/icd10.csv --out ./data/icd10.min.json.gz
 *   node scripts/build-icd10.mjs --in ./sources/icd10.jsonl --out ./data/icd10.min.json.gz
 *   node scripts/build-icd10.mjs --seed --out ./data/icd10.min.json.gz
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';

function parseArgs() {
  const out = { in: null, out: './data/icd10.min.json.gz', seed: false, limit: 0 };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--in') out.in = argv[++i];
    else if (a === '--out') out.out = argv[++i];
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

// Simple CSV parser (handles quotes and commas)
function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { inQ = false; }
      } else field += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(field); rows.push(row); row = []; field = '';
      } else field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function normalizeRecord(r) {
  const code = String(r.code || r.Code || r.ICD10 || '').trim();
  const title = String(r.title || r.Description || r.LongDescription || r.Name || '').trim();
  const synonyms = toArray(r.synonyms || r.Synonyms || r.AKA || r.Aliases);
  const category = String(r.category || r.Block || r.Chapter || '').trim() || code.slice(0, 3);
  if (!code || !title) return null;

  // Heuristic: add parentheses content as synonym, e.g. "Migraine (without aura)"
  const paren = /\(([^)]+)\)/.exec(title)?.[1];
  if (paren) synonyms.push(paren);

  // De-dupe
  const seen = new Set(); const syn = [];
  for (const s of synonyms) {
    const t = s.trim().toLowerCase();
    if (!t || seen.has(t)) continue;
    seen.add(t); syn.push(s.trim());
  }

  return { code, title, synonyms: syn, category };
}

async function readJSONorJSONL(file) {
  const text = await fsp.readFile(file, 'utf8');
  if (file.endsWith('.jsonl') || file.endsWith('.ndjson')) {
    return text.split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(l => JSON.parse(l));
  }
  return JSON.parse(text);
}

async function loadInput(inputPath, limit = 0) {
  if (!inputPath) return [];
  if (/\.(json|jsonl|ndjson)$/i.test(inputPath)) {
    const raw = await readJSONorJSONL(inputPath);
    return raw.map(normalizeRecord).filter(Boolean).slice(0, limit || raw.length);
  }
  if (/\.csv$/i.test(inputPath)) {
    const text = await fsp.readFile(inputPath, 'utf8');
    const rows = parseCSV(text);
    const header = rows.shift()?.map(h => h.trim().toLowerCase()) || [];
    const idx = (name) => header.indexOf(name);
    const out = [];
    for (const r of rows) {
      const rec = {
        code: r[idx('code')] ?? r[0],
        title: r[idx('title')] ?? r[1],
        synonyms: r[idx('synonyms')],
        category: r[idx('category')],
      };
      const norm = normalizeRecord(rec);
      if (norm) out.push(norm);
    }
    return out.slice(0, limit || out.length);
  }
  throw new Error(`Unsupported input: ${inputPath}`);
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
      { code: 'A09', title: 'Infectious gastroenteritis and colitis, unspecified', synonyms: ['Gastroenteritis'], category: 'A09' },
      { code: 'E11', title: 'Type 2 diabetes mellitus', synonyms: ['Diabetes mellitus type 2','T2DM'], category: 'E11' },
      { code: 'I10', title: 'Essential (primary) hypertension', synonyms: ['Hypertension','High blood pressure'], category: 'I10' },
      { code: 'J20', title: 'Acute bronchitis', synonyms: ['Bronchitis (acute)'], category: 'J20' },
      { code: 'N39.0', title: 'Urinary tract infection, site not specified', synonyms: ['UTI'], category: 'N39' },
    ];
  } else {
    rows = await loadInput(args.in, args.limit);
  }

  // sort & dedupe by code
  const byCode = new Map();
  for (const r of rows) if (r) byCode.set(r.code, r);
  const sorted = [...byCode.values()].sort((a, b) => a.code.localeCompare(b.code));

  const { bytes, count } = gzipJSON(sorted, path.resolve(args.out));
  console.log(`[icd10] wrote ${count} rows → ${args.out} (${bytes} bytes gz)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
