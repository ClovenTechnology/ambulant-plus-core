// apps/patient-app/app/raffles/page.tsx
'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

type Giveaway = {
  id: string;
  title: string;
  prize: string;
  drawAtISO?: string | null;
  rulesUrl?: string | null;
  heroImg?: string | null;
  status?: 'open' | 'closed' | 'announced';
};

type EntriesResp = {
  ok: boolean;
  items?: Array<{
    id: string;
    giveawayId: string;
    createdAt?: string | null;
    tickets?: number | null; // for future (non-paid “bonus entries”, referrals, etc.)
    status?: string | null; // entered | verified | winner | ...
  }>;
  error?: string;
};

const LS_UID = 'ambulant_uid';

function getUid() {
  if (typeof window === 'undefined') return 'server-user';
  let v = localStorage.getItem(LS_UID);
  if (!v) {
    v = (crypto?.randomUUID?.() || Math.random().toString(36).slice(2)) + '-u';
    localStorage.setItem(LS_UID, v);
  }
  return v;
}

function niceDate(iso?: string | null) {
  if (!iso) return 'TBA';
  const t = new Date(iso);
  if (!Number.isFinite(t.getTime())) return 'TBA';
  return t.toLocaleString();
}

function daysLeft(iso?: string | null) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  const now = Date.now();
  if (!Number.isFinite(t) || t <= now) return 0;
  return Math.ceil((t - now) / (1000 * 60 * 60 * 24));
}

const FALLBACK_GIVEAWAYS: Giveaway[] = [
  {
    id: 'promo-duecare-kit',
    title: 'Holiday Giveaway',
    prize: 'DueCare 6-in-1 Health Monitor (Standard Kit)',
    drawAtISO: null, // set later from backend
    rulesUrl: '/policy/giveaway-rules.pdf',
    heroImg: '/shop/fallback/duecare.png',
    status: 'open',
  },
  {
    id: 'promo-nexring',
    title: 'New Year Drop',
    prize: 'NexRing (Wellness Ring)',
    drawAtISO: null,
    rulesUrl: '/policy/giveaway-rules.pdf',
    heroImg: '/shop/fallback/tech.png',
    status: 'open',
  },
];

export default function RafflesLandingPage() {
  const sp = useSearchParams();
  const statusParam = (sp.get('status') || '').toLowerCase(); // cancelled / success for future
  const [uid] = useState(() => getUid());

  const [giveaways, setGiveaways] = useState<Giveaway[]>(FALLBACK_GIVEAWAYS);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // “My entries” (graceful if endpoint not ready)
  const [entriesBusy, setEntriesBusy] = useState(false);
  const [entriesResp, setEntriesResp] = useState<EntriesResp | null>(null);

  useEffect(() => {
    // Optional: if you later add a real endpoint, this will automatically start using it.
    // GET /api/giveaways?active=1
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/giveaways?active=1', { cache: 'no-store' });
        const js = await res.json().catch(() => ({}));
        if (!res.ok) return; // keep fallback silently
        const list = Array.isArray(js?.items) ? (js.items as Giveaway[]) : [];
        if (!cancelled && list.length) setGiveaways(list);
      } catch {
        // keep fallback
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      setEntriesBusy(true);
      try {
        const res = await fetch(`/api/giveaways/entries?uid=${encodeURIComponent(uid)}`, {
          cache: 'no-store',
          signal: ac.signal,
          headers: { 'x-uid': uid },
        });
        const js = (await res.json().catch(() => ({}))) as EntriesResp;
        if (!res.ok) {
          // endpoint not ready is fine; we’ll show a friendly state
          setEntriesResp(null);
          return;
        }
        if (!js.ok) {
          setEntriesResp(null);
          return;
        }
        setEntriesResp(js);
      } catch (e: any) {
        if (e?.name === 'AbortError') return;
        setEntriesResp(null);
      } finally {
        setEntriesBusy(false);
      }
    })();
    return () => ac.abort();
  }, [uid]);

  const entries = useMemo(() => entriesResp?.items || [], [entriesResp]);

  async function enterGiveaway(g: Giveaway) {
    try {
      setBusyId(g.id);
      setErr(null);

      // IMPORTANT:
      // This is a FREE giveaway entry flow — no payment, no ticket purchase.
      // POST /api/giveaways/enter should create an Entry record keyed by uid + giveawayId.
      const res = await fetch('/api/giveaways/enter', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-uid': uid },
        body: JSON.stringify({
          giveawayId: g.id,
          uid,
          metadata: {
            channel: 'giveaway',
            buyerUid: uid,
          },
        }),
      });

      const js = await res.json().catch(() => ({}));
      if (!res.ok || js?.ok === false) throw new Error(js?.error || 'Could not enter giveaway');

      // refresh entries best-effort
      try {
        const r2 = await fetch(`/api/giveaways/entries?uid=${encodeURIComponent(uid)}`, {
          cache: 'no-store',
          headers: { 'x-uid': uid },
        });
        const j2 = (await r2.json().catch(() => ({}))) as EntriesResp;
        if (r2.ok && j2.ok) setEntriesResp(j2);
      } catch {}

    } catch (e: any) {
      setErr(e?.message || 'Entry failed');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Giveaways</h1>
          <p className="text-sm text-gray-600">
            Free promotional giveaways — enter to win. (No purchase required.)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href="/premium" className="inline-flex items-center justify-center rounded-full border px-3 py-2 text-xs hover:bg-gray-50">
            Premium
          </Link>
          <Link href="/shop" className="inline-flex items-center justify-center rounded-full border px-3 py-2 text-xs hover:bg-gray-50">
            Shop
          </Link>
          <Link href="/1stop" className="inline-flex items-center justify-center rounded-full border px-3 py-2 text-xs hover:bg-gray-50">
            My 1Stop Orders
          </Link>
        </div>
      </header>

      {statusParam === 'cancelled' ? (
        <div className="text-sm rounded-lg border border-amber-200 bg-amber-50 text-amber-800 px-3 py-2">
          Action cancelled.
        </div>
      ) : null}

      {err ? (
        <div className="text-sm rounded-lg border border-rose-200 bg-rose-50 text-rose-800 px-3 py-2">{err}</div>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
        {/* Giveaway list */}
        <div className="rounded-2xl border bg-white overflow-hidden">
          <div className="p-5 border-b bg-gradient-to-br from-emerald-50 to-white">
            <div className="text-sm font-semibold">Open giveaways</div>
            <div className="text-sm text-gray-600 mt-1">Enter once per giveaway (unless rules specify otherwise).</div>
          </div>

          <div className="p-5 grid gap-4 sm:grid-cols-2">
            {giveaways.map((g) => {
              const dLeft = daysLeft(g.drawAtISO);
              const isOpen = (g.status || 'open') === 'open';
              return (
                <div key={g.id} className="rounded-2xl border bg-white overflow-hidden flex flex-col">
                  <div className="h-40 bg-gray-100 flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={g.heroImg || '/shop/fallback/other.png'}
                      alt={g.title}
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>

                  <div className="p-4 space-y-2 flex-1 flex flex-col">
                    <div className="text-sm font-semibold">{g.title}</div>
                    <div className="text-xs text-gray-600">{g.prize}</div>

                    <div className="flex items-center justify-between pt-1">
                      <div className="text-[11px] text-gray-600">
                        Draw: <span className="font-mono">{niceDate(g.drawAtISO)}</span>
                      </div>
                      {dLeft != null ? (
                        <span className="text-[11px] px-2 py-0.5 rounded-full border bg-gray-50 text-gray-700">
                          {dLeft === 0 ? 'Soon' : `${dLeft} day(s)`}
                        </span>
                      ) : (
                        <span className="text-[11px] px-2 py-0.5 rounded-full border bg-gray-50 text-gray-700">TBA</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                      <button
                        type="button"
                        disabled={!isOpen || busyId === g.id}
                        onClick={() => enterGiveaway(g)}
                        className="flex-1 rounded-full px-3 py-2 text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {busyId === g.id ? 'Entering…' : isOpen ? 'Enter for free' : 'Closed'}
                      </button>

                      {g.rulesUrl ? (
                        <a
                          href={g.rulesUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-full border px-3 py-2 text-xs hover:bg-gray-50"
                        >
                          Rules
                        </a>
                      ) : null}
                    </div>

                    <div className="text-[11px] text-gray-500 mt-auto leading-relaxed">
                      Free entry. Eligibility requirements may apply (see rules). Winners are announced here later.
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* My entries */}
        <aside className="rounded-2xl border bg-white overflow-hidden">
          <div className="p-5 border-b">
            <div className="text-sm font-semibold">My entries</div>
            <div className="text-xs text-gray-600 mt-1">Saved to your local session id for now.</div>
          </div>

          <div className="p-5 space-y-3">
            {entriesBusy ? (
              <div className="text-sm text-gray-600">Loading entries…</div>
            ) : entries.length ? (
              <div className="space-y-2">
                {entries.slice(0, 10).map((e) => (
                  <div key={e.id} className="rounded-xl border p-3">
                    <div className="text-xs text-gray-500">Giveaway</div>
                    <div className="text-sm font-medium">{e.giveawayId}</div>
                    <div className="mt-1 text-[11px] text-gray-600">
                      Entered: <span className="font-mono">{e.createdAt ? new Date(e.createdAt).toLocaleString() : '—'}</span>
                      {typeof e.tickets === 'number' ? (
                        <>
                          {' '}
                          • Tickets: <span className="font-mono">{e.tickets}</span>
                        </>
                      ) : null}
                    </div>
                    <div className="mt-1 text-[11px] text-gray-500">Status: {e.status || 'entered'}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border bg-gray-50 p-4">
                <div className="text-sm font-medium">No entries yet</div>
                <div className="text-xs text-gray-600 mt-1">
                  Enter an open giveaway to see it listed here.
                </div>
              </div>
            )}

            <div className="text-[11px] text-gray-500 leading-relaxed">
              Note: this page is intentionally built for free giveaways. If you later add entries via referrals or verified
              actions (e.g., completing onboarding), you can track them here without introducing paid ticketing.
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
