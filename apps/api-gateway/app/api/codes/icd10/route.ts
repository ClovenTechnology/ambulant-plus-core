import { NextRequest, NextResponse } from 'next/server';
import { searchICD10, loadICD10FromGzip, getICD10Data } from '@packages/clinical-codes/src/icd10';
import { join } from 'node:path';

let loaded = false;

async function ensureLoaded() {
  if (loaded || typeof process === 'undefined') return;
  await loadICD10FromGzip(join(process.cwd(), 'packages/clinical-codes/data/icd10.min.json.gz'));
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
