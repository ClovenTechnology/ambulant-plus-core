// apps/patient-app/app/api/dev/files/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const f = url.searchParams.get('f');
    if (!f) return NextResponse.json({ error: 'missing f' }, { status: 400 });

    const fs = require('fs');
    const p = require('path');
    const dir = p.join(process.cwd(), '.tmp_uploads');
    const full = p.join(dir, f);

    if (!fs.existsSync(full)) return NextResponse.json({ error: 'not_found' }, { status: 404 });

    const data = fs.readFileSync(full);
    const ext = (f.split('.').pop() || 'bin').toLowerCase();
    const mime =
      ext === 'wav' ? 'audio/wav' :
      ext === 'mp3' ? 'audio/mpeg' :
      'application/octet-stream';

    return new NextResponse(data, { status: 200, headers: { 'Content-Type': mime } });
  } catch (e: any) {
    return NextResponse.json({ error: 'read_failed', detail: String(e?.message ?? e) }, { status: 500 });
  }
}
