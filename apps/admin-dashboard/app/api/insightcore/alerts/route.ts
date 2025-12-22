// apps/admin-dashboard/app/api/insightcore/alerts/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const alertsPath = path.join(process.cwd(), '../../packages/insightcore/alerts.json');

const GW =
  process.env.NEXT_PUBLIC_GATEWAY_ORIGIN ||
  process.env.NEXT_PUBLIC_GATEWAY_BASE ||
  process.env.AMBULANT_API_URL ||
  '';

async function readJsonSafe(file: string) {
  const txt = await fs.readFile(file, 'utf-8').then((t) => t.replace(/^\uFEFF/, ''));
  return JSON.parse(txt);
}

// GET — admin view of recent alerts (for simulator + consoles)
export async function GET(req: NextRequest) {
  if (GW) {
    const url = new URL(
      `${GW.replace(/\/+$/, '')}/api/insightcore/alerts`,
    );
    // Let gateway decide scope; admin dashboard generally wants latest N
    url.searchParams.set('limit', req.nextUrl.searchParams.get('limit') || '50');

    const res = await fetch(url.toString(), {
      headers: {
        ...(req.headers.get('cookie') ? { cookie: req.headers.get('cookie') as string } : {}),
        'x-role': 'admin',
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      // fallback to flat file if present
      try {
        const data = await readJsonSafe(alertsPath).catch(() => ({ alerts: [] }));
        return NextResponse.json({ alerts: data.alerts || [] });
      } catch {
        return NextResponse.json({ alerts: [] });
      }
    }

    const data = await res.json().catch(() => ({ alerts: [] }));
    return NextResponse.json({ alerts: data.alerts || [] });
  }

  // No gateway – dev mode file
  const data = await readJsonSafe(alertsPath).catch(() => ({ alerts: [] }));
  return NextResponse.json({ alerts: data.alerts || [] });
}

// POST — create synthetic alert (simulator) or manual test
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  if (GW) {
    const url = `${GW.replace(/\/+$/, '')}/api/insightcore/alerts`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(req.headers.get('cookie') ? { cookie: req.headers.get('cookie') as string } : {}),
        'x-role': 'admin',
      },
      body: JSON.stringify({
        source: 'simulator',
        title: body.type || 'InsightCore Alert',
        message: body.note || 'Synthetic alert from admin simulator',
        patientName: body.patient,
        type: body.type || 'multifactor',
        riskScore: typeof body.score === 'number' ? body.score : undefined,
        factors: body.factors || {},
      }),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      return NextResponse.json(
        { ok: false, error: 'gateway_alert_write_failed', detail: txt || res.statusText },
        { status: 500 },
      );
    }

    const data = await res.json().catch(() => ({ ok: true }));
    return NextResponse.json(data);
  }

  // Dev-only file append
  const data = await readJsonSafe(alertsPath).catch(() => ({ alerts: [] as any[] }));
  data.alerts.push({
    id: crypto.randomUUID(),
    patient: body.patient || '',
    type: body.type || 'Alert',
    score: Number(body.score || 0),
    ts: new Date().toISOString(),
    note: body.note || '',
  });
  await fs.writeFile(alertsPath, JSON.stringify(data, null, 2), 'utf-8');
  return NextResponse.json({ ok: true, source: 'file' });
}
