// packages/clinical-codes/scripts/fetch-rxnorm-rxnav.mjs
// Fetch RxNorm concepts from RxNav (public; no UMLS login).
// Writes ./sources/rxnav-allconcepts.json (array of { rxcui, name, tty }).
//
// Usage:
//   node ./scripts/fetch-rxnorm-rxnav.mjs                # default TTYs (IN,MIN,PIN,SCD)
//   node ./scripts/fetch-rxnorm-rxnav.mjs --out ./sources/rxnav-allconcepts.json --tty IN,MIN,PIN,SCD,SBD,BN
//
// Docs (NLM / RxNav):
// - getAllConceptsByTTY: https://lhncbc.nlm.nih.gov/RxNav/APIs/api-RxNorm.getAllConceptsByTTY.html

import fs from 'node:fs/promises';
import path from 'node:path';

const argv = (() => {
  const outIdx = process.argv.findIndex((x) => x === '--out' || x.startsWith('--out='));
  const ttyIdx = process.argv.findIndex((x) => x === '--tty' || x.startsWith('--tty='));
  const out =
    outIdx >= 0
      ? (process.argv[outIdx].includes('=') ? process.argv[outIdx].split('=')[1] : process.argv[outIdx + 1])
      : './sources/rxnav-allconcepts.json';
  const ttyCsv =
    ttyIdx >= 0
      ? (process.argv[ttyIdx].includes('=') ? process.argv[ttyIdx].split('=')[1] : process.argv[ttyIdx + 1])
      : 'IN,MIN,PIN,SCD'; // default: ingredient + (multi/pref) ingredient + generic clinical drug

  const ttys = ttyCsv
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  return { out, ttys };
})();

async function fetchAllConceptsByTTY(ttys) {
  const set = new Set();
  const out = [];

  for (const tty of ttys) {
    const url = `https://rxnav.nlm.nih.gov/REST/allconcepts.json?tty=${encodeURIComponent(tty)}`;
    const res = await fetch(url, { headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`RxNav HTTP ${res.status} for ${url}`);
    const js = await res.json();

    // Shape: { minConceptGroup: { minConcept: [{ rxcui, name, tty }, ...] } }
    const arr = js?.minConceptGroup?.minConcept;
    if (Array.isArray(arr)) {
      for (const m of arr) {
        const key = `${m?.rxcui}|${m?.tty}`;
        if (!m?.rxcui || !m?.name || !m?.tty) continue;
        if (set.has(key)) continue;
        set.add(key);
        out.push({ rxcui: String(m.rxcui), name: String(m.name), tty: String(m.tty) });
      }
    }
  }
  return out;
}

async function main() {
  const concepts = await fetchAllConceptsByTTY(argv.ttys);
  await fs.mkdir(path.dirname(argv.out), { recursive: true });
  await fs.writeFile(argv.out, JSON.stringify(concepts));
  console.log(`[rxnav] concepts=${concepts.length} → ${argv.out}`);
  console.log(`[rxnav] TTYs: ${argv.ttys.join(', ')}`);
}

main().catch((e) => {
  console.error('[rxnav] fetch failed:', e);
  process.exit(1);
});
