// apps/api-gateway/src/app/api/codes/sigs/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { ensureRxNormLoaded, searchRxNorm } from '../../../../../packages/clinical-codes/src/rxnorm';
import path from 'node:path';
import fs from 'node:fs';

const FALLBACK: Record<string, string[]> = {
  '1049630': ['Atorvastatin 20 mg once daily', '20 mg nocte', 'Start 20 mg nocte'],
  '723': ['500 mg PO TID x5d', '500 mg PO BD x7d'],
  '161': ['500 mg PRN q4-6h max 4g/24h', '500 mg PO q6h prn'],
};

/** Attempt to read curated sigs map from packages/clinical-codes/data/sigs.json (server only) */
function loadCuratedMap(): Record<string, string[]> | null {
  try {
    const p = path.resolve(process.cwd(), 'packages', 'clinical-codes', 'data', 'sigs.json');
    if (fs.existsSync(p)) {
      const raw = fs.readFileSync(p, 'utf8');
      const js = JSON.parse(raw);
      if (js && typeof js === 'object') return js as Record<string, string[]>;
    }
  } catch (e) {
    // ignore
    console.warn('sigs: curated load failed', e?.message ?? e);
  }
  return null;
}

const CURATED = loadCuratedMap() ?? FALLBACK;

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const rxCui = (url.searchParams.get('rxCui') || '').trim();
  const limit = Math.min(Number(url.searchParams.get('limit') || '8'), 30);

  if (rxCui && CURATED[rxCui]) {
    return NextResponse.json({ ok: true, items: CURATED[rxCui].slice(0, limit) });
  }

  // Try inference from rxnorm dataset
  try {
    await ensureRxNormLoaded();
    if (rxCui) {
      const hits = await searchRxNorm(rxCui, { limit: 10, preferGeneric: true });
      const exact = hits.find((h: any) => String(h.rxcui) === String(rxCui)) || hits[0];
      if (exact) {
        const strength = (exact.strength || '').trim();
        const doseForm = (exact.doseForm || '').trim();
        const suggestions: string[] = [];
        if (strength) {
          suggestions.push(`${strength} once daily`);
          suggestions.push(`${strength} twice daily`);
          suggestions.push(`${strength} PO BD x5d`);
        }
        if (doseForm) {
          suggestions.push(`Apply ${doseForm} BID`);
        }
        suggestions.push('1 tab nocte', '1 tab bd', '5 ml bd x5d');
        const uniq = Array.from(new Set(suggestions)).slice(0, limit);
        return NextResponse.json({ ok: true, items: uniq });
      }
    }
  } catch (e) {
    // ignore
  }

  // final fallback
  return NextResponse.json({ ok: true, items: (CURATED[rxCui] || ['1 tab nocte', '1 tab bd', '5 ml bd x5d']).slice(0, limit) });
}
