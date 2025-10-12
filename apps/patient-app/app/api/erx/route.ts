// apps/patient-app/app/api/erx/route.ts
import { NextResponse } from 'next/server';
import { headers, cookies } from 'next/headers';

export type Rx = {
  id: string;
  createdAt: string; // ISO
  drug: string;
  sig: string;
  qty?: number;
  refills?: number;
  note?: string;
};

let ERX_LIST: Rx[] = [];

// helper to build absolute base URL (works behind proxies)
function baseUrl() {
  const h = headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3002';
  const proto = h.get('x-forwarded-proto') ?? 'http';
  return `${proto}://${host}`;
}

// British-style compact summary for encounter note
function rxSummary(rx: Rx) {
  const qty = rx.qty != null ? ` â€¢ Qty ${rx.qty}` : '';
  const ref = rx.refills != null ? ` â€¢ Refills ${rx.refills}` : '';
  const note = rx.note ? ` â€” ${rx.note}` : '';
  return `New eRx: ${rx.drug} â€” ${rx.sig}${qty}${ref}${note}`;
}

// GET: list all eRx (simple)
export async function GET() {
  return NextResponse.json(ERX_LIST);
}

// POST: create new eRx and attach a summary note to the active encounter if set
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const drug = String(body?.drug ?? '').trim();
    const sig = String(body?.sig ?? '').trim();
    const qty = Number.isFinite(Number(body?.qty)) ? Number(body.qty) : undefined;
    const refills = Number.isFinite(Number(body?.refills)) ? Number(body.refills) : undefined;
    const note = body?.note ? String(body.note).trim() : undefined;

    if (!drug || !sig) {
      return NextResponse.json({ ok: false, error: 'Missing drug or SIG' }, { status: 400 });
    }

    const rx: Rx = {
      id: (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)),
      createdAt: new Date().toISOString(),
      drug, sig, qty, refills, note,
    };
    ERX_LIST.unshift(rx);

    // If an active encounter is selected, drop a brief note into it
    const c = cookies();
    const activeEncounterId = c.get('activeEncounterId')?.value;

    if (activeEncounterId) {
      try {
        const res = await fetch(`${baseUrl()}/api/encounters`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            id: activeEncounterId,
            text: rxSummary(rx),
            source: 'erx',
          }),
        });
        // We ignore non-OK here on purpose (donâ€™t block the eRx flow)
        await res.text().catch(() => {});
      } catch {
        // swallow â€“ printing or UI will still proceed
      }
    }

    return NextResponse.json({ ok: true, rx });
  } catch (e) {
    return NextResponse.json({ ok: false, error: 'Unexpected error' }, { status: 500 });
  }
}
