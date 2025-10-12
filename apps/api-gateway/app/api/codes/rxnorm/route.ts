// apps/api-gateway/app/api/codes/rxnorm/route.ts
import { NextRequest, NextResponse } from 'next/server';
// If you have a tsconfig path alias, prefer: import { searchRxNorm, ensureRxNormLoaded } from 'clinical-codes/src/rxnorm';
import { searchRxNorm, ensureRxNormLoaded } from '../../../../../packages/clinical-codes/src/rxnorm';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') || '').trim();
  const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10) || 20, 50);
  const preferGeneric = (searchParams.get('preferGeneric') ?? '1') !== '0';

  await ensureRxNormLoaded();
  if (!q) return NextResponse.json({ ok: true, items: [] });

  const items = await searchRxNorm(q, { limit, preferGeneric });
  return NextResponse.json({ ok: true, items });
}
