// apps/api-gateway/app/api/codes/sigs/route.ts
import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function cors(res: NextResponse) {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'content-type');
  return res;
}
export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }));
}

/**
 * GET /api/codes/sigs?rxCui=<rxcui>&q=<optional free-text>
 *
 * Reads packages/clinical-codes/data/sigs.json and returns:
 * { ok: true, items: string[] }
 *
 * If file missing or no match, returns an empty array.
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const rxCui = (url.searchParams.get('rxCui') || '').trim();
    const q = (url.searchParams.get('q') || '').trim().toLowerCase();

    // resolve repo-root relative path (works from dev or production workspace root)
    const candidate = path.resolve(process.cwd(), 'packages', 'clinical-codes', 'data', 'sigs.json');

    let map: Record<string, string[]> = {};
    try {
      if (fs.existsSync(candidate)) {
        const raw = await fs.promises.readFile(candidate, 'utf8');
        map = JSON.parse(raw);
      }
    } catch (e) {
      // ignore, fall through to default map
      console.warn('[sigs] failed to read sigs.json', e);
    }

    // server-side fallback default suggestions (small)
    const FALLBACK: Record<string, string[]> = {
      'default': ['1 tab nocte', '1 tab bd', '5 ml bd x5d']
    };

    let items: string[] = [];

    if (rxCui && map && Array.isArray(map[rxCui])) {
      items = map[rxCui];
    } else if (rxCui && map) {
      // attempt fuzzy match on provided CUI variants (string keys)
      const keys = Object.keys(map);
      const found = keys.find(k => k === rxCui || k.toLowerCase() === rxCui.toLowerCase());
      if (found) items = map[found] ?? [];
    }

    // If q provided, do a tiny filter to prioritize matches containing q (helps UI)
    if (q && items.length > 0) {
      const qn = q.toLowerCase();
      const exact = items.filter(s => s.toLowerCase().includes(qn));
      // return exact-first with rest appended
      items = Array.from(new Set([...exact, ...items]));
    }

    if (!items.length) items = map['default'] ?? FALLBACK['default'];

    const res = NextResponse.json({ ok: true, items }, { status: 200 });
    return cors(res);
  } catch (e: any) {
    const res = NextResponse.json({ ok: false, error: e?.message || 'sigs-error' }, { status: 500 });
    return cors(res);
  }
}
