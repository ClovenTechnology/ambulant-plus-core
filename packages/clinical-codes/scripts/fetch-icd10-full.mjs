#!/usr/bin/env node
/**
 * Fetch full ICD-10-CM “order file” from CDC and normalize to CSV (code,title,synonyms).
 * Works with:
 *   --out=./sources/icd10.csv        or  --out ./sources/icd10.csv
 *   --year=2025                      or  --year 2025
 * Node >= 18
 */
import { writeFile } from 'node:fs/promises';
import https from 'node:https';

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const eq = a.indexOf('=');
    if (eq !== -1) {
      const k = a.slice(2, eq);
      const v = a.slice(eq + 1);
      out[k] = v === '' ? true : v;
    } else {
      const k = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        out[k] = next;
        i++;
      } else {
        out[k] = true;
      }
    }
  }
  return out;
}

const argv = parseArgs(process.argv.slice(2));
const outPath = argv.out || './packages/clinical-codes/sources/icd10.csv';
const preferYear = argv.year ? Number(argv.year) : undefined;

// CDC hosts plain-text order files by year:
const years = preferYear ? [preferYear] : [2025, 2024, 2023, 2022];
const candidates = [];
for (const y of years) {
  candidates.push(`https://ftp.cdc.gov/pub/Health_Statistics/NCHS/Publications/ICD10CM/${y}/icd10cm_order_${y}.txt`);
  candidates.push(`https://ftp.cdc.gov/pub/Health_Statistics/NCHS/Publications/ICD10CM/${y}/icd10cm-order-${y}.txt`);
  candidates.push(`https://ftp.cdc.gov/pub/Health_Statistics/NCHS/Publications/ICD10CM/${y}/icd10cm_tabular_${y}.txt`);
}

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { data += c; });
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function looksLikeHeaderRow(cols) {
  const first = (cols[0] || '').toLowerCase();
  return first.includes('order') || first.includes('code') || first.includes('header') || first.includes('dx');
}

function clean(s) {
  return (s ?? '').toString().trim().replace(/\s+/g, ' ');
}
function csvEscape(s) {
  const v = (s ?? '').toString();
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function isValidCode(code) {
  if (!code) return false;
  if (!/^[A-Z0-9][A-Z0-9.]*$/.test(code)) return false;
  if (!/[A-Z]/.test(code) || !/\d/.test(code)) return false;
  return true;
}

function normalize(lines) {
  const rows = [];
  for (const line of lines) {
    if (!line || !line.trim()) continue;
    const cols = line.split('\t');
    if (cols.length < 2) continue;
    if (looksLikeHeaderRow(cols)) continue;

    let code = clean(cols[0]);
    let title = clean(cols[1]);

    if (!isValidCode(code) && isValidCode(clean(cols[1]))) {
      code = clean(cols[1]);
      title = clean(cols[2] ?? cols[0] ?? '');
    }

    if (!isValidCode(code)) {
      for (const c of cols) { if (isValidCode(clean(c))) { code = clean(c); break; } }
      const nonCodes = cols.filter(c => !isValidCode(clean(c))).map(clean).filter(Boolean);
      title = nonCodes.sort((a,b) => b.length - a.length)[0] || title;
    }

    const candidates = cols.map(clean).filter(Boolean);
    const descs = candidates.filter(c => !isValidCode(c) && c.length > 3);
    if (descs.length) {
      const sorted = [...descs].sort((a,b)=>b.length-a.length);
      title = sorted[0];
      const syns = Array.from(new Set(sorted.slice(1).filter(s => s.toLowerCase() !== title.toLowerCase())));
      rows.push({ code, title, synonyms: syns });
    } else {
      rows.push({ code, title, synonyms: [] });
    }
  }

  const byCode = new Map();
  for (const r of rows) {
    const prev = byCode.get(r.code);
    if (!prev || (r.title?.length || 0) > (prev.title?.length || 0)) {
      byCode.set(r.code, r);
    } else if (prev) {
      prev.synonyms = Array.from(new Set([...(prev.synonyms||[]), ...(r.synonyms||[])]));
    }
  }
  return Array.from(byCode.values());
}

async function main() {
  let txt = null;
  let used = null;
  for (const url of candidates) {
    try { txt = await fetchText(url); used = url; break; } catch {}
  }
  if (!txt) {
    console.error('[icd10] Failed to download from CDC. Specify --year or check connectivity.');
    process.exit(1);
  }
  const lines = txt.split(/\r?\n/);
  const rows = normalize(lines).filter(r => isValidCode(r.code) && r.title);
  rows.sort((a, b) => a.code.localeCompare(b.code, 'en'));
  const header = 'code,title,synonyms\n';
  const body = rows.map(r => {
    const syn = (r.synonyms || []).slice(0, 10).join('; ');
    return [csvEscape(r.code), csvEscape(r.title), csvEscape(syn)].join(',');
  }).join('\n') + '\n';

  await writeFile(outPath, header + body, 'utf8');
  console.log(`[icd10] rows=${rows.length} → ${outPath}\n[icd10] source: ${used}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
