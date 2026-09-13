'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useActiveEncounter } from '../../components/context/ActiveEncounterContext';

type SessionLine = {
  id: string;
  state: 'INCLUDED' | 'DEFERRED_BY_PATIENT';
  name: string;
  strengthText?: string | null;
  formText?: string | null;
  prescribedQuantity?: { value?: number | null; unit?: string | null; text?: string | null };
  directions?: string | null;
};
type Session = {
  id: string;
  encounterId: string;
  status: string;
  searchLocation?: { address?: string | null };
  lines: SessionLine[];
};
type QuoteOption = {
  id: string;
  selectable: boolean;
  requiresPharmacistReview: boolean;
  displayName: string;
  brand?: string | null;
  strengthText?: string | null;
  dosageFormText?: string | null;
  packSize?: string | null;
  listedPriceCents: number;
  currency: string;
};
type Quote = {
  id: string;
  pharmacy: { id: string; name?: string | null; address?: string | null; city?: string | null };
  coverage: { status: string; ratio: number };
  availability: { state: string; reasonCode?: string | null };
  distanceKm?: number | null;
  lines: Array<{ procurementLineId: string; options: QuoteOption[] }>;
};
type Reservation = {
  id: string;
  orderId: string;
  status: string;
  pricing: {
    subtotalNetCents: number;
    taxCents: number;
    totalCents: number;
    sponsorAmountMinor: number;
    patientGapMinor: number;
    currency: string;
  };
};
type EncounterOption = { id: string; label: string };

function arr(v: any) { return Array.isArray(v) ? v : []; }
function money(cents: number, currency = 'ZAR') {
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format((Number(cents) || 0) / 100); }
  catch { return `${currency} ${((Number(cents) || 0) / 100).toFixed(2)}`; }
}
function human(v: any, fallback = 'Request failed.') {
  const raw = v?.message || v?.error || (typeof v === 'string' ? v : '') || fallback;
  return String(raw).replace(/_/g, ' ');
}
function tone(v: string) {
  const s = String(v || '').toUpperCase();
  if (['AVAILABLE', 'FULL', 'INCLUDED', 'SECURED', 'COMPLETED'].includes(s)) return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (['CONFIRMING', 'HELD', 'PAYMENT_PENDING', 'PHARMACIST_REVIEW'].includes(s)) return 'border-amber-200 bg-amber-50 text-amber-700';
  if (['CANCELLED', 'EXPIRED', 'REJECTED'].includes(s)) return 'border-rose-200 bg-rose-50 text-rose-700';
  return 'border-slate-200 bg-slate-50 text-slate-700';
}
function Pill({ value }: { value: string }) {
  return <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${tone(value)}`}>{String(value || '—').replace(/_/g, ' ')}</span>;
}

export default function CarePortPage() {
  const active = (useActiveEncounter() as any)?.activeEncounter;
  const activeEncounterId = String(active?.id || '').trim();

  const [encounters, setEncounters] = useState<EncounterOption[]>([]);
  const [encounterId, setEncounterId] = useState(activeEncounterId);
  const [session, setSession] = useState<Session | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [selectedQuoteId, setSelectedQuoteId] = useState('');
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [payment, setPayment] = useState<any>(null);
  const [searchAddress, setSearchAddress] = useState('');
  const [email, setEmail] = useState('');
  const [useSponsor, setUseSponsor] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<'CARD' | 'MEDICAL_AID'>('CARD');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const included = useMemo(() => (session?.lines || []).filter((line) => line.state === 'INCLUDED'), [session]);
  const selectedQuote = useMemo(() => quotes.find((q) => q.id === selectedQuoteId) || null, [quotes, selectedQuoteId]);

  const request = useCallback(async (url: string, init?: RequestInit) => {
    const res = await fetch(url, {
      cache: 'no-store',
      ...init,
      headers: { ...(init?.body ? { 'content-type': 'application/json' } : {}), ...(init?.headers || {}) },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.ok === false) {
      const error: any = new Error(data?.message || data?.error || `HTTP ${res.status}`);
      error.details = data?.details || data?.availability || null;
      throw error;
    }
    return data;
  }, []);

  useEffect(() => {
    Promise.all([
      fetch('/api/profile', { cache: 'no-store' }).then((r) => r.json()).catch(() => ({})),
      fetch('/api/encounters', { cache: 'no-store' }).then((r) => r.json()).catch(() => ({})),
    ]).then(([profile, payload]) => {
      setEmail(String(profile?.email || '').trim());
      const rows = (arr(payload?.encounters).length ? arr(payload?.encounters) : arr(payload?.cases).flatMap((c: any) => arr(c?.encounters)))
        .map((x: any) => {
          const id = String(x?.id || x?.encounterId || '').trim();
          if (!id) return null;
          const date = x?.startedAt || x?.createdAt;
          return { id, label: `${x?.clinician?.name || x?.clinicianName || 'Consultation'}${date ? ` • ${new Date(date).toLocaleDateString()}` : ''}` };
        }).filter(Boolean) as EncounterOption[];
      setEncounters(rows);
      if (!activeEncounterId && rows[0]?.id) setEncounterId(rows[0].id);
    });
  }, [activeEncounterId]);

  const loadSession = useCallback(async (encId: string) => {
    if (!encId) return;
    try {
      const data = await request(`/api/careport/rx-procurement?encId=${encodeURIComponent(encId)}`);
      if (data?.session) {
        setSession(data.session);
        setSearchAddress(data.session?.searchLocation?.address || '');
        localStorage.setItem('ambulant_careport_rx_session', data.session.id);
      } else {
        setSession(null);
      }
    } catch { setSession(null); }
  }, [request]);

  useEffect(() => { if (encounterId) void loadSession(encounterId); }, [encounterId, loadSession]);

  useEffect(() => {
    if (!session?.id) return;
    const timer = setInterval(async () => {
      try {
        const data = await request(`/api/careport/rx-procurement/${encodeURIComponent(session.id)}/reservation`);
        if (data?.reservation) setReservation(data.reservation);
      } catch { /* polling is best effort */ }
    }, 12000);
    return () => clearInterval(timer);
  }, [request, session?.id]);

  async function start() {
    if (!encounterId) return setError('Choose the consultation containing the prescription.');
    setBusy('start'); setError(null); setNotice(null);
    try {
      const data = await request('/api/careport/rx-procurement', {
        method: 'POST',
        body: JSON.stringify({
          encId: encounterId,
          searchLocation: searchAddress ? { label: 'Medicine search area', address: searchAddress, source: 'manual' } : null,
        }),
      });
      setSession(data.session); setQuotes([]); setReservation(null); setPayment(null);
      localStorage.setItem('ambulant_careport_rx_session', data.session.id);
      setNotice(data.reused ? 'Existing medicine basket restored.' : 'Prescription basket created.');
    } catch (e) { setError(human(e, 'Could not start CarePort.')); }
    finally { setBusy(''); }
  }

  async function toggleLine(line: SessionLine) {
    if (!session) return;
    setBusy(`line:${line.id}`); setError(null);
    const next = line.state === 'INCLUDED' ? 'DEFERRED_BY_PATIENT' : 'INCLUDED';
    try {
      const data = await request(`/api/careport/rx-procurement/${encodeURIComponent(session.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ lineStates: [{ lineId: line.id, state: next, deferReason: next === 'DEFERRED_BY_PATIENT' ? 'PATIENT_CHOICE' : null }] }),
      });
      setSession(data.session); setQuotes([]); setSelectedQuoteId(''); setSelectedOptions({});
    } catch (e) { setError(human(e, 'Could not update medicine selection.')); }
    finally { setBusy(''); }
  }

  async function saveLocation() {
    if (!session) return;
    setBusy('location'); setError(null);
    try {
      const data = await request(`/api/careport/rx-procurement/${encodeURIComponent(session.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ searchLocation: searchAddress ? { label: 'Medicine search area', address: searchAddress, source: 'manual' } : null }),
      });
      setSession(data.session); setNotice('Search area updated.');
    } catch (e) { setError(human(e)); }
    finally { setBusy(''); }
  }

  function selectQuote(q: Quote) {
    setSelectedQuoteId(q.id);
    const map: Record<string, string> = {};
    q.lines.forEach((line) => {
      const option = line.options.find((o) => o.selectable);
      if (option) map[line.procurementLineId] = option.id;
    });
    setSelectedOptions(map);
  }

  async function discover() {
    if (!session) return;
    setBusy('quotes'); setError(null); setNotice(null);
    try {
      const data = await request(`/api/careport/rx-procurement/${encodeURIComponent(session.id)}/quotes`, { method: 'POST', body: '{}' });
      const next = arr(data?.quotes) as Quote[];
      setQuotes(next);
      const full = next.find((q) => q.coverage?.status === 'FULL' && ['AVAILABLE', 'CONFIRMING'].includes(q.availability?.state));
      if (full) selectQuote(full);
      setNotice(next.length ? `${next.length} pharmacy option${next.length === 1 ? '' : 's'} found.` : 'No eligible pharmacy currently covers the selected medicines.');
    } catch (e) { setError(human(e, 'Pharmacy discovery failed.')); }
    finally { setBusy(''); }
  }

  async function reserve() {
    if (!session || !selectedQuote) return;
    const selections = included.map((line) => ({ procurementLineId: line.id, optionId: selectedOptions[line.id] })).filter((x) => Boolean(x.optionId));
    if (selections.length !== included.length) return setError('Choose one verified product for every included medicine.');
    setBusy('reserve'); setError(null);
    try {
      const data = await request(`/api/careport/rx-procurement/${encodeURIComponent(session.id)}/reservation`, {
        method: 'POST', body: JSON.stringify({ quoteId: selectedQuote.id, selections, fulfillment: 'PICKUP' }),
      });
      setReservation(data.reservation); setSession(data.session || session); setNotice('Live stock, quantity, tax and final price reserved.');
    } catch (e) { setError(human(e, 'Reservation failed.')); }
    finally { setBusy(''); }
  }

  async function beginPayment() {
    if (!session || !reservation) return;
    setBusy('payment'); setError(null);
    try {
      const data = await request(`/api/careport/rx-procurement/${encodeURIComponent(session.id)}/payment/init`, {
        method: 'POST',
        body: JSON.stringify({
          paymentMethod, useSponsor, email,
          idempotencyKey: `rx_${reservation.id}`,
          callbackUrl: `${window.location.origin}/careport?paymentReturn=1`,
        }),
      });
      setPayment(data);
      if (data?.paymentIntent?.id) localStorage.setItem('ambulant_careport_rx_payment_intent', data.paymentIntent.id);
      if (data?.reservation) setReservation(data.reservation);
      if (data?.checkout?.redirectUrl) return window.location.assign(data.checkout.redirectUrl);
      if (data?.alreadySecured || data?.paymentIntent?.status === 'AUTHORIZED') setNotice('Coverage/payment secured. Pharmacist review is next.');
    } catch (e) { setError(human(e, 'Checkout could not start.')); }
    finally { setBusy(''); }
  }

  async function verify(reference = '') {
    if (!session) return;
    setBusy('verify'); setError(null);
    try {
      const paymentIntentId = localStorage.getItem('ambulant_careport_rx_payment_intent') || payment?.paymentIntent?.id;
      const data = await request(`/api/careport/rx-procurement/${encodeURIComponent(session.id)}/payment/verify`, {
        method: 'POST', body: JSON.stringify({ paymentIntentId, reference: reference || payment?.checkout?.reference }),
      });
      setPayment(data); if (data?.reservation) setReservation(data.reservation);
      setNotice(data?.pending ? 'Payment is still being confirmed.' : data?.captured || data?.alreadyCaptured ? 'Payment confirmed. Pharmacist review is next.' : 'Payment was not captured.');
    } catch (e) { setError(human(e, 'Payment verification failed.')); }
    finally { setBusy(''); }
  }

  useEffect(() => {
    if (!session?.id || typeof window === 'undefined') return;
    const p = new URLSearchParams(window.location.search);
    if (p.get('paymentReturn') === '1') void verify(p.get('reference') || p.get('trxref') || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id]);

  async function cancel() {
    if (!session || !reservation || !window.confirm('Cancel checkout and release reserved stock?')) return;
    setBusy('cancel'); setError(null);
    try {
      await request(`/api/careport/rx-procurement/${encodeURIComponent(session.id)}/cancel`, { method: 'POST', body: JSON.stringify({ reason: 'patient_cancelled' }) });
      setReservation(null); setPayment(null); setQuotes([]); setNotice('Checkout cancelled and reserved stock released.');
      await loadSession(encounterId);
    } catch (e) { setError(human(e, 'Could not cancel checkout.')); }
    finally { setBusy(''); }
  }

  return <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="bg-gradient-to-br from-teal-700 via-teal-600 to-cyan-600 p-6 text-white md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-100">CarePort · Prescription medicines</p>
        <h1 className="mt-2 text-3xl font-semibold">Your prescription, compared transparently.</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-teal-50">Review every medicine, compare real pharmacy product and stock truth, then reserve at a revalidated final price. This release activates pharmacy pickup only; medication delivery remains locked until the dedicated CarePort Rider safety wave is certified.</p>
      </div>
      <div className="grid gap-3 p-5 md:grid-cols-[1fr_auto] md:items-end">
        <label className="text-sm font-medium">Prescription consultation<select value={encounterId} onChange={(e) => setEncounterId(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2.5"><option value="">Choose consultation</option>{encounters.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}</select></label>
        <button onClick={start} disabled={!encounterId || !!busy} className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy === 'start' ? 'Opening…' : 'Open prescription'}</button>
      </div>
    </section>

    {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}
    {notice && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{notice}</div>}

    {session ? <>
      <section className="rounded-3xl border bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-teal-700">1 · Prescription basket</p><h2 className="mt-1 text-xl font-semibold">Choose what to obtain today</h2></div><Pill value={session.status}/></div>
        <div className="mt-5 space-y-3">{session.lines.map((line) => <article key={line.id} className="rounded-2xl border p-4"><div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{line.name}</h3><Pill value={line.state}/></div><p className="mt-1 text-sm text-slate-600">{[line.strengthText, line.formText, line.prescribedQuantity?.text || [line.prescribedQuantity?.value, line.prescribedQuantity?.unit].filter(Boolean).join(' ')].filter(Boolean).join(' · ') || 'Prescription quantity as issued'}</p>{line.directions && <p className="mt-1 text-xs text-slate-500">{line.directions}</p>}</div><button onClick={() => void toggleLine(line)} disabled={busy === `line:${line.id}`} className="rounded-xl border px-3 py-2 text-xs font-semibold">{line.state === 'INCLUDED' ? 'Defer medicine' : 'Include medicine'}</button></div></article>)}</div>
      </section>

      <section className="rounded-3xl border bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">2 · Search area</p><h2 className="mt-1 text-xl font-semibold">Find pharmacies near you</h2><p className="mt-1 text-sm text-slate-500">Search location is independent of fulfilment and does not activate delivery.</p>
        <div className="mt-4 flex flex-col gap-2 md:flex-row"><input value={searchAddress} onChange={(e) => setSearchAddress(e.target.value)} placeholder="Suburb, town or address" className="flex-1 rounded-xl border px-3 py-2.5"/><button onClick={saveLocation} className="rounded-xl border px-4 py-2.5 text-sm font-semibold">Save</button><button onClick={discover} disabled={!included.length || busy === 'quotes'} className="rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy === 'quotes' ? 'Searching…' : 'Compare pharmacies'}</button></div>
      </section>

      {quotes.length > 0 && <section className="space-y-4"><div><p className="text-xs font-semibold uppercase tracking-wide text-teal-700">3 · Pharmacy comparison</p><h2 className="mt-1 text-xl font-semibold">Full coverage first</h2><p className="text-sm text-slate-500">Discovery prices are revalidated with live stock, pack quantity and tax when you reserve.</p></div>{quotes.map((q) => <article key={q.id} className={`rounded-3xl border bg-white p-5 shadow-sm ${selectedQuoteId === q.id ? 'border-teal-500 ring-2 ring-teal-100' : ''}`}><div className="flex flex-col gap-3 md:flex-row md:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-semibold">{q.pharmacy.name || 'Pharmacy'}</h3><Pill value={q.coverage.status}/><Pill value={q.availability.state}/></div><p className="mt-1 text-sm text-slate-500">{[q.pharmacy.address, q.pharmacy.city, typeof q.distanceKm === 'number' ? `${q.distanceKm.toFixed(1)} km` : null].filter(Boolean).join(' · ')}</p></div><button onClick={() => selectQuote(q)} disabled={q.coverage.status !== 'FULL'} className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">{selectedQuoteId === q.id ? 'Selected' : 'Choose'}</button></div>{selectedQuoteId === q.id && <div className="mt-5 space-y-3">{q.lines.map((ql) => <div key={ql.procurementLineId} className="rounded-2xl bg-slate-50 p-3"><p className="font-medium">{session.lines.find((x) => x.id === ql.procurementLineId)?.name || 'Prescription item'}</p><div className="mt-2 space-y-2">{ql.options.filter((o) => o.selectable).map((o) => <label key={o.id} className="flex cursor-pointer gap-3 rounded-xl border bg-white p-3"><input type="radio" name={`opt-${ql.procurementLineId}`} checked={selectedOptions[ql.procurementLineId] === o.id} onChange={() => setSelectedOptions((old) => ({ ...old, [ql.procurementLineId]: o.id }))}/><div className="flex-1"><div className="flex flex-wrap justify-between gap-2"><span className="font-semibold">{o.displayName}</span><span>{money(o.listedPriceCents, o.currency)}</span></div><p className="mt-1 text-xs text-slate-500">{[o.brand, o.strengthText, o.dosageFormText, o.packSize].filter(Boolean).join(' · ')}</p>{o.requiresPharmacistReview && <p className="mt-1 text-xs font-medium text-amber-700">Pharmacist review required.</p>}</div></label>)}</div></div>)}</div>}</article>)}{selectedQuote && <div className="flex justify-end"><button onClick={reserve} disabled={busy === 'reserve'} className="rounded-xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white">{busy === 'reserve' ? 'Revalidating…' : 'Reserve medicines'}</button></div>}</section>}

      {reservation && <section className="rounded-3xl border border-teal-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-wide text-teal-700">4 · Secure checkout</p><h2 className="mt-1 text-xl font-semibold">Final reservation</h2></div><Pill value={reservation.status}/></div><div className="mt-4 grid gap-3 md:grid-cols-3"><div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Medicine net</p><p className="font-semibold">{money(reservation.pricing.subtotalNetCents, reservation.pricing.currency)}</p></div><div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Tax</p><p className="font-semibold">{money(reservation.pricing.taxCents, reservation.pricing.currency)}</p></div><div className="rounded-2xl bg-teal-50 p-4"><p className="text-xs text-teal-700">Total</p><p className="text-lg font-semibold text-teal-900">{money(reservation.pricing.totalCents, reservation.pricing.currency)}</p></div></div><div className="mt-4 grid gap-3 md:grid-cols-2"><label className="text-sm font-medium">Payment method<select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as any)} className="mt-1 w-full rounded-xl border px-3 py-2.5"><option value="CARD">Card</option><option value="MEDICAL_AID">Medical aid / sponsor (zero gap only)</option></select></label><label className="text-sm font-medium">Email for card checkout<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2.5"/></label></div><label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={useSponsor} onChange={(e) => setUseSponsor(e.target.checked)}/>Check eligible medical-aid/sponsor contribution</label><div className="mt-5 flex flex-wrap gap-2"><button onClick={beginPayment} disabled={busy === 'payment'} className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white">Secure payment / coverage</button>{payment?.paymentIntent && <button onClick={() => void verify()} className="rounded-xl border px-4 py-2.5 text-sm font-semibold">Verify payment</button>}<button onClick={cancel} className="rounded-xl border border-rose-200 px-4 py-2.5 text-sm font-semibold text-rose-700">Cancel & release stock</button></div><p className="mt-4 text-xs leading-5 text-slate-500">Pickup only in Wave AB. Pharmacy preparation cannot begin until payment/coverage is secured and pharmacist review is released.</p></section>}
    </> : <section className="rounded-3xl border border-dashed bg-white p-10 text-center"><h2 className="text-lg font-semibold">No active medicine basket</h2><p className="mt-2 text-sm text-slate-500">Choose a consultation and open its dispense-ready prescription.</p></section>}
  </main>;
}
