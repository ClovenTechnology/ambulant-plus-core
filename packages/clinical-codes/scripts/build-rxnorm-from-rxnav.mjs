// packages/clinical-codes/scripts/build-rxnorm-from-rxnav.mjs
// Build rxnorm.min.json.gz from RxNav JSON (produced by fetch-rxnorm-rxnav.mjs)
//
// Usage:
//   node ./scripts/build-rxnorm-from-rxnav.mjs --in ./sources/rxnav-allconcepts.json --out ./data/rxnorm.min.json.gz
// Options:
//   --with-atc        Include ATC class stubs if present in input (default: off)
//   --limit N         Limit number of rows (useful for quick runs)
//   --ttys=IN,MIN,... Restrict to these TTYs (default: IN,MIN,PIN,SCD)
// Notes:
//   - We keep generics (ingredients) first by ranking tty IN/MIN/PIN higher.
//   - Output shape: [{ rxcui, title, tty, isGeneric, synonyms?, atc? }, ...] gzipped JSON array.

import fs from 'node:fs/promises';
import zlib from 'node:zlib';
import { promisify } from 'node:util';
const gzip = promisify(zlib.gzip);

// ---- tiny arg parser ----
const args = process.argv.slice(2);
function getFlag(name) {
  return args.includes(`--${name}`);
}
function getArg(name, def = undefined) {
  const pref = `--${name}`;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === pref) {
      const v = args[i + 1];
      if (v && !v.startsWith('--')) return v;
      return true; // boolean flag present without value
    }
    if (a.startsWith(`${pref}=`)) return a.split('=').slice(1).join('=');
  }
  return def;
}

const inPath  = getArg('in');
const outPath = getArg('out', './data/rxnorm.min.json.gz');
const withATC = getFlag('with-atc');
const limitArg = getArg('limit');
const limit = limitArg ? Number(limitArg) : undefined;
const ttysArg = getArg('ttys', 'IN,MIN,PIN,SCD');
const keepTTYs = String(ttysArg).split(',').map(s => s.trim()).filter(Boolean);

// ---- helpers ----
const isFiniteNum = (n) => typeof n === 'number' && Number.isFinite(n);
const ttyRank = (tty) => {
  // Put ingredients first (IN > MIN > PIN), then SCD, then everything else
  switch ((tty || '').toUpperCase()) {
    case 'IN':  return 0;
    case 'MIN': return 1;
    case 'PIN': return 2;
    case 'SCD': return 3;
    default:    return 9;
  }
};
const normalizeRow = (c) => {
  // We expect each concept object to minimally have: rxcui, name/title, tty.
  // fetch-rxnorm-rxnav.mjs usually saves { rxcui, name, tty, synonyms?, atc? }.
  const rxcui = String(c.rxcui ?? c.rxCui ?? '').trim();
  const title = String(c.name ?? c.title ?? '').trim();
  const tty   = String(c.tty ?? '').trim().toUpperCase();
  const isGeneric = tty === 'IN' || tty === 'MIN' || tty === 'PIN';
  const out = { rxcui, title, tty, isGeneric };

  if (Array.isArray(c.synonyms) && c.synonyms.length) {
    out.synonyms = [...new Set(c.synonyms.map(s => String(s).trim()).filter(Boolean))];
  }
  if (withATC && c.atc) {
    // Allow either array or object; keep minimal structure
    out.atc = Array.isArray(c.atc) ? c.atc : [c.atc];
  }
  return out;
};

// ---- main ----
async function main() {
  if (!inPath) {
    console.error('[rxnorm] Missing --in path (expected RxNav JSON produced by fetch-rxnorm-rxnav.mjs).');
    process.exit(1);
  }
  let raw;
  try {
    raw = await fs.readFile(inPath, 'utf8');
  } catch (e) {
    console.error(`[rxnorm] Failed to read ${inPath}:`, e?.message || e);
    process.exit(1);
  }

  /** @type {Array<any>} */
  let concepts;
  try {
    concepts = JSON.parse(raw);
    if (!Array.isArray(concepts)) throw new Error('Input JSON is not an array.');
  } catch (e) {
    console.error('[rxnorm] Failed to parse JSON:', e?.message || e);
    process.exit(1);
  }

  // Filter by TTYs and dedupe by rxcui
  const filtered = concepts.filter(c => keepTTYs.includes(String(c.tty || '').toUpperCase()));
  const seen = new Set();
  const rows = [];
  for (const c of filtered) {
    const rxcui = String(c.rxcui ?? c.rxCui ?? '').trim();
    if (!rxcui) continue;
    if (seen.has(rxcui)) continue;
    seen.add(rxcui);
    rows.push(normalizeRow(c));
  }

  // Sort: generics first by tty rank, then by title
  rows.sort((a, b) => {
    const ar = ttyRank(a.tty), br = ttyRank(b.tty);
    if (ar !== br) return ar - br;
    return a.title.localeCompare(b.title);
  });

  const finalRows = isFiniteNum(limit) && limit > 0 ? rows.slice(0, limit) : rows;

  // Gzip and write
  const gz = await gzip(Buffer.from(JSON.stringify(finalRows)));
  await fs.mkdir(new URL('../data/', import.meta.url).pathname, { recursive: true }).catch(() => {});
  await fs.writeFile(outPath, gz);

  console.log(`[rxnav→rxnorm] rows=${finalRows.length} (from ${concepts.length} input, kept ${filtered.length} by TTY, dedup ${rows.length}) → ${outPath}`);
  console.log(`[rxnav→rxnorm] TTYs=${keepTTYs.join(', ')}  withATC=${withATC}  limit=${isFiniteNum(limit) ? limit : 'none'}`);
}

main().catch((e) => {
  console.error('[rxnorm] Fatal:', e?.stack || e?.message || e);
  process.exit(1);
});
