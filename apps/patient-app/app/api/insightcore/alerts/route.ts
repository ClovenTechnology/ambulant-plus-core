// apps/patient-app/app/api/insightcore/alerts/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GW =
  process.env.NEXT_PUBLIC_GATEWAY_ORIGIN ||
  process.env.NEXT_PUBLIC_GATEWAY_BASE ||
  '';

const filePath = path.join(process.cwd(), '../../packages/insightcore/alerts.json');

async function readJsonSafe(file: string) {
  const txt = await fs.readFile(file, 'utf-8').then((t) => t.replace(/^\uFEFF/, ''));
  return JSON.parse(txt);
}

export async function GET(req: NextRequest) {
  // Prefer gateway alerts (DB-backed)
  if (GW) {
    const url = new URL(`${GW.replace(/\/+$/, '')}/api/insightcore/alerts`);
    url.searchParams.set('limit', '5');

    // Optionally allow patientId override via query
    const patientId = req.nextUrl.searchParams.get('patientId');
    if (patientId) url.searchParams.set('patientId', patientId);

    const r = await fetch(url.toString(), {
      headers: {
        ...(req.headers.get('cookie') ? { cookie: req.headers.get('cookie') as string } : {}),
      },
      cache: 'no-store',
    });

    if (!r.ok) {
      // soft fallback to local file
      try {
        const data = await readJsonSafe(filePath).catch(() => ({ alerts: [] }));
        return NextResponse.json({ alerts: (data.alerts || []).slice(-5) });
      } catch {
        return NextResponse.json({ alerts: [] });
      }
    }

    const data = (await r.json().catch(() => ({ alerts: [] }))) as { alerts?: any[] };
    return NextResponse.json({ alerts: (data.alerts || []).slice(0, 5) });
  }

  // No gateway – dev: read from flat JSON
  try {
    const data = await readJsonSafe(filePath).catch(() => ({ alerts: [] }));
    return NextResponse.json({ alerts: (data.alerts || []).slice(-5) });
  } catch {
    return NextResponse.json({ alerts: [] });
  }
}
