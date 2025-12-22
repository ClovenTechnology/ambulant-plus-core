// apps/patient-app/app/api/careport/history/route.ts
import { NextRequest, NextResponse } from 'next/server';

type HistoryItem = {
  id: string;
  encId?: string;
  orderNo?: string;
  status: string;
  createdAt?: string;
  deliveredAt?: string | null;
  pharmacyName?: string;
  riderName?: string;
  total?: number;
  paymentMethod?: string;
};

const MOCK_HISTORY: HistoryItem[] = [
  {
    id: 'H-1',
    encId: 'E-2000',
    orderNo: 'ORD-1001',
    status: 'Delivered',
    createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    deliveredAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    pharmacyName: 'MedCare Sandton',
    riderName: 'Sipho R.',
    total: 120.0,
    paymentMethod: 'Medical Aid',
  },
  {
    id: 'H-2',
    encId: 'E-2001',
    orderNo: 'ORD-1002',
    status: 'Out for delivery',
    createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    deliveredAt: null,
    pharmacyName: 'HealthPlus Rosebank',
    riderName: 'Thandi M.',
    total: 85.5,
    paymentMethod: 'Card',
  },
];

const GATEWAY_BASE =
  process.env.CAREPORT_GATEWAY_BASE ||
  process.env.CLINICIAN_BASE_URL ||
  '';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const encId = url.searchParams.get('encId') || undefined;

  if (!GATEWAY_BASE) {
    return NextResponse.json({
      items: MOCK_HISTORY,
      source: 'mock-no-gateway',
    });
  }

  const qs = new URLSearchParams();
  if (encId) qs.set('encId', encId);

  const upstream = `${GATEWAY_BASE.replace(
    /\/+$/,
    '',
  )}/api/careport/history${qs.toString() ? `?${qs.toString()}` : ''}`;

  try {
    const res = await fetch(upstream, {
      cache: 'no-store',
      headers: { accept: 'application/json' },
    });

    if (!res.ok) {
      console.warn(
        '[careport/history] upstream non-OK, using mock',
        res.status,
      );
      return NextResponse.json({
        items: MOCK_HISTORY,
        source: 'mock-upstream-error',
      });
    }

    const json = await res.json().catch(() => null as any);

    let items: HistoryItem[] = [];
    if (Array.isArray(json?.items)) items = json.items;
    else if (Array.isArray(json?.history)) items = json.history;
    else if (Array.isArray(json)) items = json;

    if (!items.length) {
      return NextResponse.json({ items: [], source: 'live-empty' });
    }

    return NextResponse.json({ items, source: 'live' });
  } catch (err) {
    console.error('[careport/history] upstream error, using mock', err);
    return NextResponse.json({
      items: MOCK_HISTORY,
      source: 'mock-exception',
    });
  }
}
