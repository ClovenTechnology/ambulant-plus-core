// apps/clinician-app/app/api/audit-log/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GW =
  process.env.APIGW_BASE?.replace(/\/+$/, '') ||
  process.env.NEXT_PUBLIC_GATEWAY_ORIGIN?.replace(/\/+$/, '') ||
  process.env.NEXT_PUBLIC_GATEWAY_BASE?.replace(/\/+$/, '') ||
  '';

type AuditRow = {
  id: string;
  ts: string;
  [key: string]: any;
};

// Local in-memory buffer (dev / fallback)
const g = globalThis as any;
g.__CLIN_AUDIT__ = g.__CLIN_AUDIT__ || [];
const localRows: AuditRow[] = g.__CLIN_AUDIT__;

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) ?? {};
  const row: AuditRow = {
    id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
    ts: new Date().toISOString(),
    source: 'clinician-app',
    ...body,
  };

  // Always keep a small local buffer (useful for dev + debugging)
  localRows.push(row);
  if (localRows.length > 1000) {
    localRows.splice(0, localRows.length - 1000);
  }

  // If we have a gateway, try to forward there as the system-of-record
  if (GW) {
    try {
      const r = await fetch(`${GW}/api/audit`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(row),
      });
      if (!r.ok) {
        // non-fatal; we already buffered locally
        console.warn('[audit-log] gateway POST non-OK', r.status);
      }
    } catch (err) {
      console.warn('[audit-log] gateway POST error', err);
    }
  }

  return NextResponse.json({ ok: true });
}

export async function GET() {
  // If we have a gateway, try to read from there first (patient-app /api/audit)
  if (GW) {
    try {
      const r = await fetch(`${GW}/api/audit`, { cache: 'no-store' });
      if (r.ok) {
        const js = await r.json().catch(() => ({}));
        return NextResponse.json(js);
      }
    } catch (err) {
      console.warn('[audit-log] gateway GET error, falling back to local', err);
    }
  }

  // Fallback: local in-memory buffer
  return NextResponse.json({
    items: localRows.slice(-200).reverse(),
  });
}
