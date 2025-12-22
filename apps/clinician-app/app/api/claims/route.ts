// apps/clinician-app/app/api/claims/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STORE = path.join(process.cwd(), 'data-claims.json');

type PaymentMethod = 'self-pay-card' | 'medical-aid' | 'voucher-promo' | 'unknown';

type PerMethodCounts = {
  total: number;
  'self-pay-card': number;
  'medical-aid': number;
  'voucher-promo': number;
  unknown: number;
};

type ClaimsStats = {
  perMethod: PerMethodCounts;
  perMonth: Record<string, PerMethodCounts>; // key: "YYYY-MM"
};

type ClaimRecord = {
  id: string;
  createdAt?: string;
  updatedAt?: string;
  encounterId?: string;
  clinicianId?: string | null;
  patientId?: string | null;
  patientName?: string | null;
  status?: string | null;
  payment?: {
    method?: string;
    voucherCode?: string | null;
    voucherAmountCents?: number | null;
    displayLabel?: string | null;
    [key: string]: any;
  };
  [key: string]: any;
};

async function readClaims(): Promise<ClaimRecord[]> {
  try {
    const txt = await fs.readFile(STORE, 'utf8');
    const parsed = JSON.parse(txt);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeClaims(list: ClaimRecord[]) {
  await fs.writeFile(STORE, JSON.stringify(list, null, 2), 'utf8');
}

function lower(v: any) {
  return v == null ? '' : String(v).toLowerCase();
}

function normalizeMethod(m?: string): PaymentMethod {
  const s = (m || '').toLowerCase();
  if (s === 'medical-aid' || s === 'medical_aid' || s.includes('medical')) {
    return 'medical-aid';
  }
  if (s === 'self-pay-card' || s === 'card' || s.includes('card')) {
    return 'self-pay-card';
  }
  if (s === 'voucher-promo' || s.includes('voucher') || s.includes('promo')) {
    return 'voucher-promo';
  }
  if (!s) return 'unknown';
  return 'unknown';
}

function emptyCounts(): PerMethodCounts {
  return {
    total: 0,
    'self-pay-card': 0,
    'medical-aid': 0,
    'voucher-promo': 0,
    unknown: 0,
  };
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);

  const encounterId = url.searchParams.get('encounterId') || undefined;
  const patientId = url.searchParams.get('patientId') || undefined;
  const clinicianId = url.searchParams.get('clinicianId') || undefined;
  const methodFilter = url.searchParams.get('method') || undefined; // e.g. 'medical-aid'
  const fromStr = url.searchParams.get('from') || undefined; // ISO or yyyy-mm-dd
  const toStr = url.searchParams.get('to') || undefined;

  let list = await readClaims();

  // Basic filters
  if (encounterId) {
    list = list.filter(
      (c) => String(c.encounterId ?? '') === String(encounterId),
    );
  }
  if (patientId) {
    list = list.filter(
      (c) => String(c.patientId ?? '') === String(patientId),
    );
  }
  if (clinicianId) {
    list = list.filter(
      (c) => String(c.clinicianId ?? '') === String(clinicianId),
    );
  }

  if (methodFilter) {
    const want = lower(methodFilter);
    list = list.filter((c) => lower(c.payment?.method) === want);
  }

  // Optional date range on createdAt
  const fromMs = fromStr ? new Date(fromStr).getTime() : NaN;
  const toMs = toStr ? new Date(toStr).getTime() : NaN;

  if (!Number.isNaN(fromMs) || !Number.isNaN(toMs)) {
    list = list.filter((c) => {
      const t = c.createdAt ? new Date(c.createdAt).getTime() : NaN;
      if (Number.isNaN(t)) return false;
      if (!Number.isNaN(fromMs) && t < fromMs) return false;
      if (!Number.isNaN(toMs) && t > toMs) return false;
      return true;
    });
  }

  // Sort newest first
  list.sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return tb - ta;
  });

  // Build aggregated stats over the (filtered) list
  const perMethod = emptyCounts();
  const perMonth: Record<string, PerMethodCounts> = {};

  for (const c of list) {
    const m = normalizeMethod(c.payment?.method);
    perMethod.total += 1;
    perMethod[m] += 1;

    // Monthly key: YYYY-MM (UTC)
    if (c.createdAt) {
      const d = new Date(c.createdAt);
      if (Number.isFinite(d.getTime())) {
        const key = `${d.getUTCFullYear()}-${String(
          d.getUTCMonth() + 1,
        ).padStart(2, '0')}`;
        if (!perMonth[key]) {
          perMonth[key] = emptyCounts();
        }
        perMonth[key].total += 1;
        perMonth[key][m] += 1;
      }
    }
  }

  const stats: ClaimsStats = {
    perMethod,
    perMonth,
  };

  return NextResponse.json({
    items: list,
    stats,
  });
}

// Simple status update endpoint so UI can toggle claim.state
export async function PATCH(req: NextRequest) {
  let body: { id?: string; status?: string };
  try {
    body = (await req.json()) as any;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const id = body.id?.trim();
  const status = body.status?.trim();

  if (!id || !status) {
    return NextResponse.json(
      { error: 'id and status are required' },
      { status: 400 },
    );
  }

  const list = await readClaims();
  const idx = list.findIndex((c) => String(c.id) === String(id));
  if (idx === -1) {
    return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
  }

  const now = new Date().toISOString();
  list[idx] = {
    ...list[idx],
    status,
    updatedAt: now,
  };

  await writeClaims(list);

  return NextResponse.json({
    ok: true,
    claim: list[idx],
  });
}
