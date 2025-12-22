import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const storeDir = path.resolve(process.cwd(), '../../.data/rtc');

function envBool(name: string, fallback: boolean) {
  const v = process.env[name];
  if (v == null) return fallback;
  return v === '1' || v.toLowerCase() === 'true' || v.toLowerCase() === 'yes';
}

function sanitizeId(id: string) {
  const s = String(id || '').trim();
  if (!s) return '';
  if (s.length > 120) return '';
  if (!/^[a-zA-Z0-9._-]+$/.test(s)) return '';
  return s;
}

function requireUid(req: NextRequest) {
  const allowAnon = envBool('RTC_STORE_ALLOW_ANON', false);
  if (allowAnon) return true;
  const uid = req.headers.get('x-uid') || req.headers.get('X-Uid');
  return Boolean(uid && uid.trim());
}

export async function GET(req: NextRequest) {
  if (!requireUid(req)) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const idRaw = new URL(req.url).searchParams.get('id') || '';
  const id = sanitizeId(idRaw);
  if (!id) return NextResponse.json({ ok: false, error: 'bad_request', message: 'Valid id required' }, { status: 400 });

  try {
    const raw = await fs.readFile(path.join(storeDir, id + '.json'), 'utf-8');
    return NextResponse.json(JSON.parse(raw), { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({}, { headers: { 'Cache-Control': 'no-store' } });
  }
}

export async function POST(req: NextRequest) {
  if (!requireUid(req)) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Record<string, any>;
  const id = sanitizeId(String(body?.id || ''));
  if (!id) return NextResponse.json({ ok: false, error: 'bad_request', message: 'Valid id required' }, { status: 400 });

  const { id: _drop, ...rest } = body;

  await fs.mkdir(storeDir, { recursive: true });

  const file = path.join(storeDir, id + '.json');

  let prev: any = {};
  try {
    prev = JSON.parse(await fs.readFile(file, 'utf-8'));
  } catch {
    prev = {};
  }

  const next = { ...prev, ...rest, updatedAt: new Date().toISOString() };
  await fs.writeFile(file, JSON.stringify(next, null, 2), 'utf-8');

  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
}
