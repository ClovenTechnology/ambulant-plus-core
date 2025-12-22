// apps/patient-app/app/api/medreach/reports/file/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const STORE = path.resolve(process.cwd(), '../../.data/reports');
const SAMPLE = path.resolve(process.cwd(), '../../apps/patient-app/public'); // fallback

function inferContentType(name: string) {
  const ext = (name.split('.').pop() || '').toLowerCase();
  if (ext === 'pdf') return 'application/pdf';
  if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) {
    return ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
  }
  return 'application/octet-stream';
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const rawName = url.searchParams.get('name') || 'sample.pdf';

  // Basic sanitisation: strip path separators and disallow traversal
  const safeName = rawName.replace(/[/\\]/g, '');
  if (safeName.includes('..')) {
    return NextResponse.json(
      { error: 'invalid name' },
      { status: 400 },
    );
  }

  const filePath = path.join(STORE, safeName);
  const altPath = path.join(SAMPLE, safeName);

  try {
    const pick = await fs.readFile(filePath).catch(() =>
      fs.readFile(altPath),
    );
    const type = inferContentType(safeName);

    return new NextResponse(pick, {
      status: 200,
      headers: {
        'Content-Type': type,
        'Cache-Control': 'private, max-age=60',
        'Content-Disposition': `inline; filename="${encodeURIComponent(
          safeName,
        )}"`,
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: 'not found', detail: String(e) },
      { status: 404 },
    );
  }
}
