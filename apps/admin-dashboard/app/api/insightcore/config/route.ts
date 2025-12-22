// apps/admin-dashboard/app/api/insightcore/config/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const cfgPath = path.join(process.cwd(), '../../packages/insightcore/config.json');

// Prefer gateway; fall back to local JSON file for dev.
const GW =
  process.env.NEXT_PUBLIC_GATEWAY_ORIGIN ||
  process.env.NEXT_PUBLIC_GATEWAY_BASE ||
  process.env.AMBULANT_API_URL ||
  '';

async function readJsonSafe(file: string) {
  const txt = await fs.readFile(file, 'utf-8');
  return JSON.parse(txt.replace(/^\uFEFF/, ''));
}

export async function GET(req: NextRequest) {
  // If gateway configured, proxy there
  if (GW) {
    const url = `${GW.replace(/\/+$/, '')}/api/insightcore/config`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        // forward cookies so gateway can resolve tenant/user
        ...(req.headers.get('cookie') ? { cookie: req.headers.get('cookie') as string } : {}),
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      // Soft-fallback to local file on error
      try {
        const cfg = await readJsonSafe(cfgPath);
        return NextResponse.json(cfg, { status: 200 });
      } catch {
        return NextResponse.json({ error: 'gateway_config_error' }, { status: 500 });
      }
    }

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data);
  }

  // No gateway set – local JSON dev mode
  const cfg = await readJsonSafe(cfgPath).catch(() => null);
  if (!cfg) {
    return NextResponse.json(
      {
        heartRate: { min: 50, max: 120 },
        spo2: { min: 92 },
        temperature: { max: 38 },
        glucoseInstability: { threshold: 0.7 },
        bp: { systolicMax: 140, diastolicMax: 90 },
        riskScoring: { alertScoreMin: 0.65 },
      },
      { status: 200 },
    );
  }
  return NextResponse.json(cfg);
}

export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  // If gateway configured, proxy write there
  if (GW) {
    const url = `${GW.replace(/\/+$/, '')}/api/insightcore/config`;
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        ...(req.headers.get('cookie') ? { cookie: req.headers.get('cookie') as string } : {}),
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      return NextResponse.json(
        { ok: false, error: 'gateway_config_write_failed', detail: txt || res.statusText },
        { status: 500 },
      );
    }

    const data = await res.json().catch(() => ({ ok: true }));
    return NextResponse.json(data);
  }

  // No gateway – persist to local JSON file (dev only)
  await fs.writeFile(cfgPath, JSON.stringify(body, null, 2), 'utf-8');
  return NextResponse.json({ ok: true, source: 'file' });
}
