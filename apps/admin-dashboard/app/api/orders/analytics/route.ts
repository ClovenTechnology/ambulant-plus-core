// apps/admin-dashboard/app/api/orders/analytics/route.ts
import { NextRequest, NextResponse } from 'next/server';

type OrderRow = {
  id: string;
  kind: 'pharmacy' | 'lab';
  encounterId: string;
  sessionId: string;
  caseId: string;
  createdAt?: string;
  title?: string;
  details?: string;
  priceZAR?: number;
  status?: 'pending' | 'in-progress' | 'done' | 'failed';
  site?: string;
  // Optional lifecycle timestamps (use when available)
  dispatchedAt?: string;
  deliveredAt?: string; // for pharmacy
  resultAt?: string;    // for lab
};

function pctile(nums: number[], p: number): number {
  if (!nums.length) return 0;
  const a = nums.slice().sort((x,y)=>x-y);
  const idx = Math.min(a.length-1, Math.max(0, Math.round((p/100) * (a.length-1))));
  return a[idx];
}

function hoursBetween(a?: string, b?: string): number | null {
  if (!a || !b) return null;
  const ms = new Date(b).getTime() - new Date(a).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  return Math.round(ms / 36e5); // hours
}

function toDayKey(d: Date) { return d.toISOString().slice(0, 10); }

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get('q') || '').toLowerCase();
    const status = (url.searchParams.get('status') || 'all') as 'all'|'pending'|'in-progress'|'done'|'failed';
    const kind = (url.searchParams.get('kind') || 'all') as 'all'|'pharmacy'|'lab';
    const from = url.searchParams.get('from');
    const to   = url.searchParams.get('to');
    const phSLA = Math.max(1, parseInt(url.searchParams.get('phSLA') || '4', 10));   // default 4h
    const lbSLA = Math.max(1, parseInt(url.searchParams.get('lbSLA') || '48', 10));  // default 48h

    // Pull raw orders (merged)
    const res = await fetch(`${url.origin}/api/orders/index?scope=all`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Source /api/orders/index returned ${res.status}`);
    const raw = await res.json().catch(() => []);
    const rows: OrderRow[] = Array.isArray(raw) ? raw : [];

    // Filter
    let list = rows.slice();
    if (status !== 'all') list = list.filter(r => (r.status ?? 'pending') === status);
    if (kind   !== 'all') list = list.filter(r => r.kind === kind);
    if (q.trim()) {
      list = list.filter(r => (
        r.id.toLowerCase().includes(q) ||
        (r.title||'').toLowerCase().includes(q) ||
        (r.details||'').toLowerCase().includes(q) ||
        (r.site||'').toLowerCase().includes(q) ||
        r.encounterId.toLowerCase().includes(q)
      ));
    }
    if (from) list = list.filter(r => !r.createdAt || new Date(r.createdAt) >= new Date(from));
    if (to)   list = list.filter(r => !r.createdAt || new Date(r.createdAt) <= new Date(to + 'T23:59:59'));

    // KPIs
    const total = list.length;
    const done = list.filter(r => r.status === 'done').length;
    const completionPct = total ? Math.round((done / total) * 100) : 0;
    const revenueZAR = list.reduce((s, r) => s + (r.priceZAR || 0), 0);
    const counts = { pharm: list.filter(r=>r.kind==='pharmacy').length, labs: list.filter(r=>r.kind==='lab').length };
    const statusCounts = ['pending','in-progress','done','failed'].map(s => ({ s: s as any, n: list.filter(r => (r.status ?? 'pending') === s).length }));

    // Trend (last 30 days)
    const since = new Date(); since.setDate(since.getDate() - 29);
    const byDay = new Map<string, number>();
    list.forEach(r => {
      const d = r.createdAt ? new Date(r.createdAt) : null;
      if (!d || d < since) return;
      const k = toDayKey(d);
      byDay.set(k, (byDay.get(k) || 0) + 1);
    });
    const trendLabels: string[] = Array.from({length: 30}, (_,i) => {
      const d = new Date(since); d.setDate(since.getDate() + i);
      return toDayKey(d);
    });
    const trend = trendLabels.map(k => byDay.get(k) || 0);

    // Top entities
    function topCounts(xs: OrderRow[], labeler: (r: OrderRow) => string) {
      const map = new Map<string, number>();
      xs.forEach(r => {
        const key = (labeler(r) || '—').trim();
        if (!key) return;
        map.set(key, (map.get(key) || 0) + 1);
      });
      return Array.from(map.entries()).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([label,value])=>({label, value}));
    }
    const topPharmacies = topCounts(list.filter(r=>r.kind==='pharmacy'), r => (r.title || 'Pharmacy').split(' ')[0]);
    const topLabs       = topCounts(list.filter(r=>r.kind==='lab'),       r => r.site || (r.title || 'Lab').split(' ')[0]);

    // Heatmap (7 x 24)
    const heat = Array.from({length:7},()=>Array.from({length:24},()=>0));
    list.forEach(r => {
      if (!r.createdAt) return;
      const d = new Date(r.createdAt);
      const dow = d.getDay(), hr = d.getHours();
      heat[dow][hr] += 1;
    });

    // TAT (hours)
    const pharmTats: number[] = [];
    const labTats: number[] = [];
    list.forEach(r => {
      if (r.kind === 'pharmacy') {
        const end = r.deliveredAt || r.dispatchedAt || null; // prefer deliveredAt, fallback to dispatchedAt if that’s all we have
        const h = hoursBetween(r.createdAt, end || undefined);
        if (h != null) pharmTats.push(h);
      } else if (r.kind === 'lab') {
        const end = r.resultAt || r.deliveredAt || null;     // prefer resultAt for labs
        const h = hoursBetween(r.createdAt, end || undefined);
        if (h != null) labTats.push(h);
      }
    });

    const tat = {
      pharmacyHours: {
        p50: Math.round(pctile(pharmTats, 50)),
        p90: Math.round(pctile(pharmTats, 90)),
        p95: Math.round(pctile(pharmTats, 95)),
        n: pharmTats.length,
      },
      labHours: {
        p50: Math.round(pctile(labTats, 50)),
        p90: Math.round(pctile(labTats, 90)),
        p95: Math.round(pctile(labTats, 95)),
        n: labTats.length,
      },
      sla: {
        pharmBreaches: pharmTats.filter(h => h > phSLA).length,
        labBreaches:   labTats.filter(h => h > lbSLA).length,
        pharmSlaH: phSLA,
        labSlaH: lbSLA,
      }
    };

    return NextResponse.json({
      total, revenueZAR, completionPct, counts, statusCounts,
      trend, trendLabels, topPharmacies, topLabs, heat, tat
    });
  } catch (err: any) {
    console.error('orders/analytics error', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
