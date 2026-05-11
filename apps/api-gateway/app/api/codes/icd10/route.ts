// apps/api-gateway/app/api/codes/icd10/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {
  searchICD10,
  loadICD10FromGzip,
} from '@ambulant/clinical-codes/src/icd10';
import { join } from 'node:path';

let loaded = false;

async function ensureLoaded() {
  if (loaded || typeof process === 'undefined') return;

  // In Vercel/Next serverless, file tracing can omit workspace data files.
  // So: try load, but never fail the request if the gz isn't available.
  try {
    const gzPath = join(
      process.cwd(),
      '../../packages/clinical-codes/data/icd10.min.json.gz',
    );
    await loadICD10FromGzip(gzPath);
  } catch (err) {
    // fallback: embedded seed dataset in icd10.ts
    console.warn('[icd10] gzip dataset not loaded, using embedded seed:', String(err));
  }

  loaded = true;
}

export async function GET(req: NextRequest) {
  await ensureLoaded();

  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q') || '';
  const limit = Number(searchParams.get('limit') || '25');

  if (!q.trim()) return NextResponse.json({ ok: true, results: [] });

  const results = searchICD10(q, { limit });
  return NextResponse.json({ ok: true, count: results.length, results });
}
