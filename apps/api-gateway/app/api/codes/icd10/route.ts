// apps/api-gateway/app/api/codes/icd10/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { searchICD10, loadICD10FromGzip, getICD10Data } from '@ambulant/clinical-codes/icd10';
import { join } from 'node:path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

let loadPromise: Promise<number> | null = null;

async function ensureLoaded() {
  if (getICD10Data().length) return getICD10Data().length;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    const gzPath = join(process.cwd(), '../../packages/clinical-codes/data/icd10.min.json.gz');
    await loadICD10FromGzip(gzPath);
    return getICD10Data().length;
  })();
  try { return await loadPromise; } finally { loadPromise = null; }
}

export async function GET(req: NextRequest) {
  const startedAt = performance.now();
  try {
    const loaded = await ensureLoaded();
    if (process.env.NODE_ENV === 'production' && loaded < 50_000) {
      return NextResponse.json(
        { ok: false, error: 'icd10_catalogue_incomplete', loaded, results: [] },
        { status: 503, headers: { 'cache-control': 'no-store' } },
      );
    }
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get('q') || '').trim();
    const limit = Math.min(Number(searchParams.get('limit') || '25') || 25, 100);
    const results = q.length >= 2 ? searchICD10(q, { limit }) : [];
    const timingMs = Math.round((performance.now() - startedAt) * 10) / 10;
    return NextResponse.json(
      {
        ok: true,
        count: results.length,
        loaded,
        catalogue: { system: 'ICD-10-CM', source: 'CMS/CDC-NCHS', release: 'FY2026 April 1 2026', reportableOnly: true, minimumProductionRows: 50_000 },
        timingMs,
        results,
      },
      { headers: { 'cache-control': 'public, max-age=60, stale-while-revalidate=300', 'server-timing': `icd10;dur=${timingMs}` } },
    );
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: 'icd10_catalogue_unavailable', message: String(error?.message || error), results: [] },
      { status: 503, headers: { 'cache-control': 'no-store' } },
    );
  }
}
