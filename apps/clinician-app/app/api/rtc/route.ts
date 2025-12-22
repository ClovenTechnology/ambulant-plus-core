// apps/clinician-app/app/api/rtc/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const storeDir = path.join(process.cwd(), '../../.data/rtc');

export async function GET(req: NextRequest) {
  const id = new URL(req.url).searchParams.get('id') || '';
  if (!id) return NextResponse.json({}, { status: 200 });

  try {
    const raw = await fs.readFile(path.join(storeDir, `${id}.json`), 'utf8');
    return NextResponse.json(JSON.parse(raw));
  } catch {
    // Treat missing/invalid file as "no state yet"
    return NextResponse.json({}, { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { id, ...rest } = body || {};
    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'id_required' }, { status: 400 });
    }

    await fs.mkdir(storeDir, { recursive: true });
    const file = path.join(storeDir, `${id}.json`);

    let prev: any = {};
    try {
      const existing = await fs.readFile(file, 'utf8');
      prev = JSON.parse(existing);
    } catch {
      // ignore, start empty
    }

    const next = { ...prev, ...rest, id };
    await fs.writeFile(file, JSON.stringify(next, null, 2), 'utf8');

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('[rtc] POST error', e);
    return NextResponse.json(
      { error: 'rtc_store_error', detail: e?.message || String(e) },
      { status: 500 },
    );
  }
}
