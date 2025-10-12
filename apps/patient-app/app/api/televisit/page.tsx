// apps/patient-app/app/tele-visit/page.tsx
export const dynamic = 'force-dynamic';

import Link from 'next/link';

type Appt = {
  id: string;
  clinicianName: string;
  specialty: string;
  startsAt: string;
  endsAt: string;
  location?: string;
};

function fmt(dt: string) {
  return new Date(dt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
}

function windowState(a: Appt, nowMs: number, openMin = Number(process.env.JOIN_WINDOW_START_MIN ?? -10), closeMin = Number(process.env.JOIN_WINDOW_END_MIN ?? 15)) {
  const s = new Date(a.startsAt).getTime();
  const e = new Date(a.endsAt).getTime();
  const open = s + openMin * 60_000;
  const close = e + closeMin * 60_000;
  if (nowMs < open) return { state: 'before', title: `Opens at ${fmt(new Date(open).toISOString())}` };
  if (nowMs > close) return { state: 'after', title: `Closed at ${fmt(new Date(close).toISOString())}` };
  return { state: 'inside', title: 'Join now' };
}

export default async function TeleVisitPage() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ''}/api/televisit/list`, { cache: 'no-store' });
  const { items, serverNow } = (await res.json()) as { items: Appt[]; serverNow: string };
  const nowMs = new Date(serverNow ?? new Date().toISOString()).getTime();

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tele-visit</h1>
        <Link href="/clinicians" className="text-sm underline">Find clinicians</Link>
      </header>

      <section className="grid gap-3">
        {items.map(a => {
          const ws = windowState(a, nowMs);
          const disabled = ws.state !== 'inside';
          return (
            <div key={a.id} className="flex flex-col sm:flex-row sm:items-center justify-between border rounded-lg p-4 bg-white">
              <div className="mb-2 sm:mb-0">
                <div className="font-semibold">{a.clinicianName} <span className="text-gray-500">â€” {a.specialty}</span></div>
                <div className="text-sm text-gray-600">
                  {fmt(a.startsAt)} â€“ {fmt(a.endsAt)} Â· {a.location ?? 'Virtual'}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  title={ws.title}
                  onClick={async () => {
                    if (disabled) return;
                    const r = await fetch('/api/televisit/token', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ appointmentId: a.id, startsAt: a.startsAt, endsAt: a.endsAt }),
                    });
                    if (r.ok) {
                      const { token } = await r.json();
                      window.location.href = `/tele-visit/${a.id}?token=${encodeURIComponent(token)}`;
                    } else {
                      const { error } = await r.json().catch(() => ({ error: 'Unable to join' }));
                      alert(error || 'Unable to join');
                    }
                  }}
                  className={[
                    'px-3 py-2 rounded-md text-sm border',
                    disabled ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-emerald-600 text-white hover:bg-emerald-700'
                  ].join(' ')}
                  disabled={disabled}
                >
                  Start
                </button>
                <Link href={`/tele-visit/${a.id}`} className="text-sm px-3 py-2 border rounded-md hover:bg-gray-50">Details</Link>
              </div>
            </div>
          );
        })}
      </section>
    </main>
  );
}
