// apps/clinician-app/app/api/insightcore/query/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST body (flexible): { metric, from, to, patientId, caseId, deid, payload? }
export async function POST(req: NextRequest) {
  const url = (process.env.INSIGHTCORE_URL || '').replace(/\/+$/, '');
  const key = process.env.INSIGHTCORE_KEY || '';

  try {
    const body = await req.json().catch(() => ({}));
    const {
      metric = 'utilization',
      from,
      to,
      patientId,
      caseId,
      deid = true,
      payload, // extra filters or data bag
    } = body || {};

    if (!url || !key) {
      // Dev fallback so charts still render locally
      const now = Date.now();
      const pts = Array.from({ length: 12 }, (_, i) => ({
        t: new Date(now - (11 - i) * 5 * 60 * 1000).toISOString(),
        v: Math.round(50 + 30 * Math.sin(i / 2)),
      }));
      return NextResponse.json({ metric, series: pts, mock: true });
    }

    // Pass-through payload with a minimal envelope of who/what/why (no PHI if deid=true)
    const envelope = {
      metric,
      from,
      to,
      deidentified: !!deid,
      context: {
        source: 'clinician-app',
        patientId: patientId ?? null,
        caseId: caseId ?? null,
      },
      payload: payload ?? {},
    };

    // Timeout guard (12s)
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12_000);

    const started = Date.now();
    const res = await fetch(`${url}/query`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${key}`,
        'x-ambulant-source': 'clinician-app',
        ...(patientId ? { 'x-ambulant-patient-id': String(patientId) } : {}),
        ...(caseId ? { 'x-ambulant-case-id': String(caseId) } : {}),
        'x-ambulant-deid': deid ? '1' : '0',
      },
      body: JSON.stringify(envelope),
      signal: ctrl.signal,
      cache: 'no-store',
    }).finally(() => clearTimeout(timer));
    const elapsed = Date.now() - started;

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      const detail = text || res.statusText;
      const code =
        res.status === 401 || res.status === 403 ? 502 /* upstream auth error → 502 */ : 502;
      return NextResponse.json(
        { error: 'insightcore-upstream', status: res.status, detail, upstreamMs: elapsed },
        { status: code },
      );
    }

    const data = await res.json().catch(() => ({}));
    return NextResponse.json({ ...data, upstreamMs: elapsed });
  } catch (e: any) {
    const aborted = e?.name === 'AbortError';
    return NextResponse.json(
      { error: aborted ? 'timeout' : 'proxy-error', detail: e?.message || String(e) },
      { status: aborted ? 504 : 500 },
    );
  }
}
