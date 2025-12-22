// apps/api-gateway/app/api/shop/orders/[id]/receipt/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function moneyZar(n: number) {
  try {
    return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(n);
  } catch {
    return `R ${n.toFixed(2)}`;
  }
}

function num(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function computeOrderTotalZar(order: any) {
  if (typeof order?.totalZar === 'number') return order.totalZar;
  if (typeof order?.totalAmountZar === 'number') return order.totalAmountZar;
  if (typeof order?.totalCents === 'number') return Math.round(order.totalCents) / 100;

  const items = Array.isArray(order?.items) ? order.items : [];
  let sum = 0;
  for (const it of items) {
    const qty = Math.max(1, Math.round(num(it?.quantity)));
    const unitZar =
      typeof it?.unitAmountZar === 'number'
        ? it.unitAmountZar
        : typeof it?.unitPriceZar === 'number'
        ? it.unitPriceZar
        : 0;

    sum += unitZar * qty;
  }
  return sum;
}

export async function GET(req: NextRequest, ctx: { params: { id: string } }) {
  const id = String(ctx?.params?.id || '').trim();
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const url = new URL(req.url);
  const inline = url.searchParams.get('inline') === '1';

  const order = (await prisma.shopOrder.findUnique({
    where: { id },
    include: {
      items: true,
    },
  })) as any;

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

  // Best-effort decorate items with variant/product names if your schema supports it.
  // If your ShopOrderItem already stores displayName/sku/unitAmountZar, this still works.
  const items = Array.isArray(order.items) ? order.items : [];
  const totalZar = computeOrderTotalZar(order);

  const createdAt = order.createdAt ? new Date(order.createdAt).toLocaleString() : '—';
  const paidAt = order.paidAt ? new Date(order.paidAt).toLocaleString() : '—';

  const rowsHtml = items
    .map((it: any) => {
      const qty = Math.max(1, Math.round(num(it?.quantity)));
      const name = it?.name || it?.label || it?.title || 'Item';
      const sku = it?.sku || it?.variantSku || it?.variantId || '';
      const unitZar = typeof it?.unitAmountZar === 'number' ? it.unitAmountZar : 0;
      const lineZar = unitZar * qty;

      return `
        <tr>
          <td>
            <div class="name">${String(name)}</div>
            <div class="sub">${sku ? `SKU: ${String(sku)}` : ''}</div>
          </td>
          <td class="num">${qty}</td>
          <td class="num">${moneyZar(unitZar)}</td>
          <td class="num">${moneyZar(lineZar)}</td>
        </tr>
      `;
    })
    .join('');

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>1Stop Receipt — ${order.id}</title>
  <style>
    body{font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial; background:#f6f7f9; margin:0; padding:24px;}
    .card{max-width:900px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;}
    .top{padding:20px 20px 12px;border-bottom:1px solid #e5e7eb;display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap}
    h1{font-size:18px;margin:0}
    .meta{font-size:12px;color:#6b7280;margin-top:6px;line-height:1.5}
    .badge{display:inline-block;font-size:12px;padding:4px 10px;border-radius:999px;border:1px solid #e5e7eb;background:#f9fafb;color:#111827}
    .main{padding:16px 20px 20px;}
    table{width:100%;border-collapse:collapse;margin-top:12px}
    th,td{border-bottom:1px solid #eef2f7;padding:10px 8px;text-align:left;vertical-align:top}
    th{font-size:12px;color:#6b7280;font-weight:600}
    td .name{font-size:13px;font-weight:600;color:#111827}
    td .sub{font-size:12px;color:#6b7280;margin-top:4px}
    .num{text-align:right;white-space:nowrap}
    .totals{display:flex;justify-content:flex-end;margin-top:12px}
    .totals .box{min-width:260px;border:1px solid #e5e7eb;border-radius:12px;padding:12px}
    .totals .row{display:flex;justify-content:space-between;font-size:13px;margin:6px 0}
    .totals .row strong{font-size:14px}
    .footer{padding:12px 20px;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}
    @media print {
      body{background:#fff;padding:0}
      .card{border:none}
      .footer{display:none}
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="top">
      <div>
        <h1>1Stop Receipt</h1>
        <div class="meta">
          <div><strong>Order:</strong> ${String(order.id)}</div>
          <div><strong>Status:</strong> ${String(order.status || '')}</div>
          <div><strong>Channel:</strong> ${String(order.channel || '—')}</div>
          <div><strong>Created:</strong> ${createdAt}</div>
          <div><strong>Paid:</strong> ${paidAt}</div>
        </div>
      </div>
      <div>
        <span class="badge">Ambulant+ • 1Stop</span>
      </div>
    </div>

    <div class="main">
      <table>
        <thead>
          <tr>
            <th style="width:55%">Item</th>
            <th class="num" style="width:10%">Qty</th>
            <th class="num" style="width:15%">Unit</th>
            <th class="num" style="width:20%">Line</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml || `<tr><td colspan="4" style="color:#6b7280">No items recorded.</td></tr>`}
        </tbody>
      </table>

      <div class="totals">
        <div class="box">
          <div class="row"><span>Total</span> <strong>${moneyZar(totalZar)}</strong></div>
          <div class="row"><span>Currency</span> <span>${String(order.currency || 'ZAR')}</span></div>
        </div>
      </div>
    </div>

    <div class="footer">
      <div>Generated by Ambulant+ API Gateway</div>
      <div>${inline ? 'Print this page for a PDF' : ''}</div>
    </div>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'content-disposition': inline
        ? `inline; filename="receipt-${order.id}.html"`
        : `attachment; filename="receipt-${order.id}.html"`,
      'cache-control': 'no-store',
    },
  });
}
