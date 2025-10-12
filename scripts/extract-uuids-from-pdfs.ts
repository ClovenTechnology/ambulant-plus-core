import fs from 'node:fs';
import path from 'node:path';

const roots = process.argv.slice(2).length ? process.argv.slice(2) : ['./docs', './vendor', './apps'];
const UUID128 = /\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/gi;
const SHORT16 = /\b0x[0-9a-fA-F]{2,4}\b/g;

function* walk(d: string): Generator<string> {
  const st = fs.statSync(d);
  if (st.isFile()) { yield d; return; }
  for (const e of fs.readdirSync(d)) {
    const p = path.join(d, e);
    try { const s = fs.statSync(p); if (s.isDirectory()) yield* walk(p); else yield p; } catch {}
  }
}
function readText(p: string) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }

const out: Record<string, { uuid128: string[]; short16: string[] }> = {};
for (const root of roots) {
  if (!fs.existsSync(root)) continue;
  for (const file of walk(root)) {
    const low = file.toLowerCase();
    if (!/(pdf|md|txt|js|ts|java|kt|swift|m|mm|h|xml|json)$/.test(low)) continue;
    const t = readText(file); if (!t) continue;
    const uu = [...new Set(t.match(UUID128)?.map(s => s.toUpperCase()) || [])];
    const s16 = [...new Set(t.match(SHORT16)?.map(s => s.toUpperCase()) || [])];
    if (uu.length || s16.length) out[file] = { uuid128: uu, short16: s16 };
  }
}
fs.mkdirSync('scripts', { recursive: true });
fs.writeFileSync('scripts/uuid-extract.json', JSON.stringify(out, null, 2));
console.log(`Wrote scripts/uuid-extract.json (${Object.keys(out).length} files).`);
