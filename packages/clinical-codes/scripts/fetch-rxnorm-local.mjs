#!/usr/bin/env node
/**
 * Prepare RxNorm sources locally by ensuring RXNCONSO.RRF is present in ./sources.
 * Options:
 *   --zip=/path/to/RxNorm_full_YYYYMMDD.zip   (will extract RXNCONSO.RRF into ./sources)
 *   --in=/absolute/or/relative/RXNCONSO.RRF   (will copy into ./sources)
 * Usage examples:
 *   node ./scripts/fetch-rxnorm-local.mjs --zip "C:\Downloads\RxNorm_full_20240902.zip"
 *   node ./scripts/fetch-rxnorm-local.mjs --in  "./Downloads/RXNCONSO.RRF"
 */
import { stat, mkdir, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { execFile } from 'node:child_process';

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const eq = a.indexOf('=');
    if (eq !== -1) {
      out[a.slice(2, eq)] = a.slice(eq + 1);
    } else {
      const k = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) { out[k] = next; i++; }
      else { out[k] = true; }
    }
  }
  return out;
}
const args = parseArgs(process.argv.slice(2));

const root = resolve(process.cwd());
const sourcesDir = resolve(root, './sources');
const target = join(sourcesDir, 'RXNCONSO.RRF');

async function ensureDir(p) { await mkdir(p, { recursive: true }); }

function isWindows() { return process.platform === 'win32'; }
function runPowershellExpand(zipPath, destDir) {
  return new Promise((resolve, reject) => {
    const ps = isWindows() ? 'powershell.exe' : null;
    if (!ps) return reject(new Error('PowerShell not available on this OS; use --in to copy RXNCONSO.RRF or install unzip.'));
    const cmd = `Expand-Archive -Path "${zipPath}" -DestinationPath "${destDir}" -Force`;
    execFile(ps, ['-NoLogo', '-NoProfile', '-Command', cmd], (err, stdout, stderr) => {
      if (err) return reject(err);
      resolve(stdout || stderr || '');
    });
  });
}
function runUnzip(zipPath, destDir) {
  return new Promise((resolve, reject) => {
    execFile('unzip', ['-o', zipPath, 'RXNCONSO.RRF', '-d', destDir], (err, stdout, stderr) => {
      if (err) return reject(err);
      resolve(stdout || stderr || '');
    });
  });
}

async function main() {
  await ensureDir(sourcesDir);

  if (args.in) {
    const src = resolve(root, args.in);
    await stat(src);
    await copyFile(src, target);
    console.log(`[rxnorm] Copied ${src} → ${target}`);
    return;
  }

  if (args.zip) {
    const srcZip = resolve(root, args.zip);
    await stat(srcZip);
    console.log(`[rxnorm] Extracting RXNCONSO.RRF from ${srcZip} …`);
    try {
      if (isWindows()) {
        await runPowershellExpand(srcZip, sourcesDir);
      } else {
        await runUnzip(srcZip, sourcesDir);
      }
    } catch (e) {
      console.error('[rxnorm] Failed to extract. You can manually unzip and then run:');
      console.error('  node ./scripts/fetch-rxnorm-local.mjs --in /path/to/RXNCONSO.RRF');
      throw e;
    }
    if (!existsSync(target)) {
      // Some RxNorm zips place RXNCONSO.RRF under a subfolder; try a weak find
      console.warn('[rxnorm] RXNCONSO.RRF not found at root; attempting to locate within extracted tree…');
      // Fallback: instruct user explicitly (keep script simple/dep-free)
      console.warn(`→ Manually locate RXNCONSO.RRF and copy it into ${target}`);
      process.exit(2);
    }
    console.log(`[rxnorm] Ready: ${target}`);
    return;
  }

  if (existsSync(target)) {
    console.log(`[rxnorm] Found existing ${target}. Nothing to do.`);
  } else {
    console.error('[rxnorm] Missing RXNCONSO.RRF. Provide either --zip (full RxNorm ZIP) or --in (path to RXNCONSO.RRF).');
    process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
