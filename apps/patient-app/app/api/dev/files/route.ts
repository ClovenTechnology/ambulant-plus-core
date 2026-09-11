import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'node:fs';
import path from 'node:path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const requested = String(req.nextUrl.searchParams.get('f') || '').trim();
  if (!requested || path.basename(requested) !== requested) {
    return NextResponse.json({ error: 'invalid_file' }, { status: 400 });
  }

  const dir = path.join(process.cwd(), '.tmp_uploads');
  const full = path.join(dir, requested);
  const data = await fs.readFile(full).catch(() => null);
  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const ext = (requested.split('.').pop() || 'bin').toLowerCase();
  const mime = ext === 'wav' ? 'audio/wav' : ext === 'mp3' ? 'audio/mpeg' : 'application/octet-stream';
  return new NextResponse(Uint8Array.from(data), { status: 200, headers: { 'content-type': mime, 'cache-control': 'no-store' } });
}
