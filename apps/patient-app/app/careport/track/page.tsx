// apps/patient-app/app/careport/track/page.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

import RiderMap from '@/components/RiderMap';
import TimelineItem from '@/components/TimelineItem';
import DeliveryDetails, { DeliveryDetailsProps } from '@/components/DeliveryDetails';
import ContactSheet from '@/components/ContactSheet';
import { useGeocode } from '@/hooks/useGeocode';

type Coord = { lat: number; lng: number; ts?: number };
type EntityType = 'rider' | 'pharmacy' | 'system';

type TimelineItemType = {
  t: string;
  msg: string;
  lat?: number;
  lng?: number;
  entity?: EntityType;
  place?: string;
};

export type RiderProfile = {
  id?: string;
  name?: string;
  avatar?: string;
  avatarUrl?: string;
  rating?: number;
  vehicle?: string;
  phoneMasked?: string;
  phone?: string;
  regPlate?: string;
  tripsCount?: number;
};

type PharmacyProfile = {
  id?: string;
  name?: string;
  address?: string;
  logoUrl?: string;
  tradingName?: string;
  registeredName?: string;
  sapcNumber?: string;
  coords?: { lat: number; lng: number } | null;
  distanceText?: string;
  phone?: string;
};

const EMPTY_RIDER: RiderProfile = {
  id: '',
  name: 'Assigned rider pending',
  vehicle: 'Delivery vehicle pending',
  phoneMasked: '—',
};

const EMPTY_PHARMACY: PharmacyProfile = {
  id: '',
  name: 'Assigned pharmacy pending',
  address: '—',
  coords: null,
  distanceText: '—',
  phone: '',
};

function partnerText(value: unknown) {
  if (typeof value !== 'string') return '';
  const text = value.trim();
  return text && text !== '[object Object]' ? text : '';
}

function partnerRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function partnerIdentityValue(value: unknown, keys: string[]) {
  const record = partnerRecord(value);
  const kycPayload = partnerRecord(record.kycPayload);
  const kyiPayload = partnerRecord(record.kyiPayload);
  const profileMeta = partnerRecord(record.profileMeta);
  const visualIdentity = partnerRecord(
    kycPayload.visualIdentity || kyiPayload.visualIdentity || profileMeta.visualIdentity
  );

  const sources = [record, kycPayload, kyiPayload, profileMeta, visualIdentity];

  for (const source of sources) {
    for (const key of keys) {
      const found = partnerText(source[key]);
      if (found) return found;
    }
  }

  return '';
}

function partnerInitials(value: string, fallback: string) {
  const parts = value
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (!parts.length) return fallback;

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function PartnerImage({
  imageUrl,
  name,
  fallback,
  altKind,
}: {
  imageUrl?: string | null;
  name: string;
  fallback: string;
  altKind: string;
}) {
  const safeImageUrl = partnerText(imageUrl);

  if (safeImageUrl) {
    return (
      <img
        src={safeImageUrl}
        alt={`${name} ${altKind}`}
        className="h-12 w-12 shrink-0 rounded-2xl border border-slate-200 object-cover"
      />
    );
  }

  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-indigo-200 bg-indigo-50 text-sm font-black text-indigo-800">
      {partnerInitials(name, fallback)}
    </div>
  );
}

function TrackingPartnerIdentity({
  rider,
  pharmacy,
}: {
  rider: RiderProfile;
  pharmacy: PharmacyProfile;
}) {
  const riderName = partnerText(rider.name) || 'Assigned rider pending';
  const riderVehicle = partnerText(rider.vehicle);
  const riderReg = partnerText(rider.regPlate);
  const riderImage = partnerText(rider.avatarUrl) || partnerText(rider.avatar);

  const pharmacyName =
    partnerText(pharmacy.tradingName) ||
    partnerText(pharmacy.name) ||
    'Assigned pharmacy pending';
  const pharmacyRegisteredName = partnerText(pharmacy.registeredName);
  const pharmacyCredential = partnerText(pharmacy.sapcNumber);
  const pharmacyLocation = partnerText(pharmacy.address);
  const pharmacyImage = partnerText(pharmacy.logoUrl);

  return (
    <section
      data-a4p3="careport-tracking-partner-identity"
      className="mb-4 grid gap-3 md:grid-cols-2"
      aria-label="CarePort partner identity"
    >
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex min-w-0 items-start gap-3">
          <PartnerImage imageUrl={pharmacyImage} name={pharmacyName} fallback="Rx" altKind="logo" />
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-wide text-slate-400">
              Pharmacy
            </div>
            <div className="truncate text-sm font-bold text-slate-950">{pharmacyName}</div>
            {pharmacyRegisteredName && pharmacyRegisteredName !== pharmacyName ? (
              <div className="truncate text-xs text-slate-500">{pharmacyRegisteredName}</div>
            ) : null}
            {pharmacyLocation ? <div className="mt-1 truncate text-xs text-slate-500">{pharmacyLocation}</div> : null}
            {pharmacyCredential ? (
              <div className="mt-1 text-[11px] font-semibold text-slate-500">
                SAPC/licence {pharmacyCredential}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex min-w-0 items-start gap-3">
          <PartnerImage imageUrl={riderImage} name={riderName} fallback="RD" altKind="photo" />
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-wide text-slate-400">
              Rider
            </div>
            <div className="truncate text-sm font-bold text-slate-950">{riderName}</div>
            {riderVehicle ? <div className="truncate text-xs text-slate-500">{riderVehicle}</div> : null}
            {riderReg ? (
              <div className="mt-1 text-[11px] font-semibold text-slate-500">
                Vehicle reg {riderReg}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}


function firstParam(qs: URLSearchParams, keys: string[]) {
  for (const key of keys) {
    const value = qs.get(key);
    if (value && value.trim()) return value.trim();
  }
  return '';
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const aa =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
  return R * c;
}

function polylineDistanceKm(points: { lat: number; lng: number }[]) {
  if (!points || points.length < 2) return 0;
  let sum = 0;
  for (let i = 1; i < points.length; i++) {
    sum += haversineKm(points[i - 1], points[i]);
  }
  return sum;
}

function timeHHMM(tsOrIso: number | string) {
  const d = typeof tsOrIso === 'number' ? new Date(tsOrIso) : new Date(tsOrIso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function timelineKey(it: TimelineItemType, idx: number) {
  const safe = encodeURIComponent(String(it.msg || '')).slice(0, 12);
  return `${it.t}-${safe}-${idx}`;
}

function toEntity(value: unknown): EntityType {
  return value === 'rider' || value === 'pharmacy' || value === 'system'
    ? value
    : 'system';
}

function coerceTimeline(raw: unknown): TimelineItemType[] {
  const source = Array.isArray(raw) ? raw : [];
  return source
    .map((x: any) => ({
      t: String(x?.t ?? x?.at ?? x?.createdAt ?? ''),
      msg: String(x?.msg ?? x?.message ?? x?.status ?? ''),
      entity: toEntity(x?.entity),
      lat: typeof x?.lat === 'number' ? x.lat : undefined,
      lng: typeof x?.lng === 'number' ? x.lng : undefined,
      place: typeof x?.place === 'string' ? x.place : undefined,
    }))
    .filter((x) => x.t && x.msg)
    .sort((a, b) => new Date(a.t).getTime() - new Date(b.t).getTime());
}

function coerceCoords(raw: unknown): Coord[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((c: any) => ({
      lat: Number(c?.lat),
      lng: Number(c?.lng),
      ts: typeof c?.ts === 'number' ? c.ts : Date.now(),
    }))
    .filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lng));
}

function buildInitialDeliveryDetails(trackingId: string): DeliveryDetailsProps {
  return {
    orderNo: trackingId || '—',
    eRxNo: '—',
    encounterId: '—',
    patientId: '—',
    clinicianId: '—',
    caseId: '—',
    sessionId: '—',
    trackingNo: trackingId || '—',
    riderId: '',
    bikeReg: '',
    deliveryAmount: '—',
    paymentMethod: '—',
    dateIso: new Date().toISOString(),
  };
}

function CarePortTrackContent() {
  const sp = useSearchParams();

  const qs = useMemo(
    () => new URLSearchParams(sp?.toString() ?? ''),
    [sp],
  );

  const trackingId = useMemo(
    () =>
      firstParam(qs, [
        'id',
        'jobId',
        'orderId',
        'trackingId',
        'externalId',
        'erxOrderId',
      ]),
    [qs],
  );

  const [timeline, setTimeline] = useState<TimelineItemType[]>([]);
  const [coords, setCoords] = useState<Coord[]>([]);
  const posHistoryRef = useRef<{ lat: number; lng: number; ts: number }[]>([]);
  const [lastUpdateAt, setLastUpdateAt] = useState<number | null>(null);

  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [rider, setRider] = useState<RiderProfile | null>(null);
  const [pharmacy, setPharmacy] = useState<PharmacyProfile | null>(null);
  const [contactOpen, setContactOpen] = useState(false);
  const [deliveryDetails, setDeliveryDetails] = useState<DeliveryDetailsProps>(() =>
    buildInitialDeliveryDetails(trackingId),
  );

  const { reverse: reverseGeocode } = useGeocode();

  useEffect(() => {
    const handler = () => setContactOpen(true);
    window.addEventListener('openContact', handler as EventListener);
    return () => window.removeEventListener('openContact', handler as EventListener);
  }, []);

  useEffect(() => {
    setDeliveryDetails((prev) => ({
      ...prev,
      orderNo: trackingId || prev.orderNo || '—',
      trackingNo: trackingId || prev.trackingNo || '—',
    }));
  }, [trackingId]);

  useEffect(() => {
    if (!trackingId) {
      setConnected(false);
      setTimeline([]);
      setCoords([]);
      setLastUpdateAt(null);
      setError('Provide a CarePort order, job, external, eRx, or tracking ID to start live tracking.');
      return;
    }

    let alive = true;
    const POLL_MS = 3000;
    let timer: ReturnType<typeof setInterval> | null = null;

    const tick = async () => {
      try {
        setError(null);

        const res = await fetch(`/api/careport/state?id=${encodeURIComponent(trackingId)}`, {
          cache: 'no-store',
        });

        if (!alive) return;

        if (!res.ok) {
          const js = await res.json().catch(() => ({}));
          throw new Error(js?.error ? String(js.error) : `HTTP ${res.status}`);
        }

        const js = await res.json();

        const job = js?.job ?? null;
        const ph = js?.pharmacy ?? null;
        const rd = js?.rider ?? js?.deliveryRider ?? null;

        if (job && typeof job === 'object') {
          setRider((prev) => ({
            ...(prev ?? {}),
            id: String(job.riderId ?? prev?.id ?? ''),
          }));

          setDeliveryDetails((d) => ({
            ...d,
            orderNo: String(job.orderId ?? job.carePortOrderId ?? job.id ?? d.orderNo),
            trackingNo: String(job.externalId ?? job.id ?? d.trackingNo),
            riderId: String(job.riderId ?? d.riderId ?? ''),
            bikeReg: String(job.bikeReg ?? job.vehicleReg ?? d.bikeReg ?? ''),
            dateIso: String(job.createdAt ?? job.updatedAt ?? d.dateIso),
          }));
        }

        if (rd && typeof rd === 'object') {
          setRider((prev) => ({
            ...(prev ?? {}),
            id: String(rd.id ?? prev?.id ?? ''),
            name: String(rd.name ?? rd.fullName ?? prev?.name ?? 'Delivery rider'),
            avatar: partnerIdentityValue(rd, ['avatarUrl', 'avatar', 'photoUrl', 'profilePhoto', 'profileImage']) || prev?.avatar,
            avatarUrl: partnerIdentityValue(rd, ['avatarUrl', 'avatar', 'photoUrl', 'profilePhoto', 'profileImage']) || prev?.avatarUrl,
            rating: typeof rd.rating === 'number' ? rd.rating : prev?.rating,
            vehicle: String(rd.vehicle ?? rd.vehicleType ?? prev?.vehicle ?? ''),
            phoneMasked: String(rd.phoneMasked ?? prev?.phoneMasked ?? '—'),
            phone: typeof rd.phone === 'string' ? rd.phone : prev?.phone,
            regPlate: String(rd.regPlate ?? rd.registration ?? prev?.regPlate ?? ''),
            tripsCount: typeof rd.tripsCount === 'number' ? rd.tripsCount : prev?.tripsCount,
          }));
        }

        if (ph && typeof ph === 'object') {
          setPharmacy((prev) => ({
            ...(prev ?? {}),
            id: String(ph.id ?? prev?.id ?? ''),
            name:
              partnerIdentityValue(ph, ['tradingName', 'displayName', 'name']) ||
              String(ph.name ?? prev?.name ?? 'Pharmacy'),
            tradingName: partnerIdentityValue(ph, ['tradingName', 'displayName']) || prev?.tradingName,
            registeredName: partnerIdentityValue(ph, ['registeredName', 'legalName', 'registeredLegalName']) || prev?.registeredName,
            logoUrl: partnerIdentityValue(ph, ['logoUrl', 'logoDataUrl', 'imageUrl']) || prev?.logoUrl,
            sapcNumber:
              partnerIdentityValue(ph, ['sapcNumber', 'sapc', 'pharmacyCouncilNumber', 'licenseNumber', 'licenceNumber', 'registrationNumber']) ||
              prev?.sapcNumber,
            address: String(ph.address ?? prev?.address ?? ''),
            phone: String(ph.phone ?? ph.contact ?? prev?.phone ?? ''),
            coords:
              ph.coords && typeof ph.coords.lat === 'number' && typeof ph.coords.lng === 'number'
                ? { lat: ph.coords.lat, lng: ph.coords.lng }
                : prev?.coords ?? null,
          }));
        }

        const nextTl = coerceTimeline(js?.timeline);
        setTimeline((prev) => {
          const placeByKey = new Map(prev.map((p) => [`${p.t}|${p.msg}`, p.place]));
          return nextTl.map((n) => ({ ...n, place: placeByKey.get(`${n.t}|${n.msg}`) ?? n.place }));
        });

        const nextCoords = coerceCoords(js?.coords);

        if (nextCoords.length) {
          setCoords(nextCoords);
          const last = nextCoords[nextCoords.length - 1];
          posHistoryRef.current = [
            ...posHistoryRef.current.slice(-99),
            { lat: last.lat, lng: last.lng, ts: last.ts ?? Date.now() },
          ];
          setLastUpdateAt(last.ts ?? Date.now());
        }

        setConnected(true);
      } catch (e: any) {
        if (!alive) return;
        setConnected(false);
        setError(e?.message ? String(e.message) : 'Failed to load CarePort delivery state');
      }
    };

    tick();
    timer = setInterval(tick, POLL_MS);

    return () => {
      alive = false;
      if (timer) clearInterval(timer);
    };
  }, [trackingId]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const toResolve = timeline.filter(
        (it) =>
          it.entity === 'pharmacy' &&
          typeof it.lat === 'number' &&
          typeof it.lng === 'number' &&
          !it.place,
      );

      for (const it of toResolve) {
        try {
          const name = await reverseGeocode(it.lat as number, it.lng as number);
          if (cancelled) return;
          setTimeline((prev) =>
            prev.map((p) => (p.t === it.t && p.msg === it.msg ? { ...p, place: name } : p)),
          );
        } catch {}
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [timeline, reverseGeocode]);

  const routeKm = useMemo(() => polylineDistanceKm(coords), [coords]);

  const progress = useMemo(() => {
    if (!coords || coords.length < 2) return 0;
    return Math.min(99, Math.round((coords.length / 40) * 100));
  }, [coords]);

  const avgSpeedKmh = useMemo(() => {
    const h = posHistoryRef.current;
    if (!h || h.length < 2) return 25;

    let dist = 0;
    let timeSec = 0;

    for (let i = 1; i < h.length; i++) {
      dist += haversineKm(h[i - 1], h[i]);
      const dt = Math.max(1, (h[i].ts - h[i - 1].ts) / 1000);
      timeSec += dt;
    }

    if (timeSec <= 0) return 25;

    const kmh = dist / (timeSec / 3600);
    if (!Number.isFinite(kmh) || kmh <= 0) return 10;
    return Math.min(80, kmh);
  }, [coords]);

  const eta = useMemo(() => {
    if (!coords || coords.length < 2) return { text: '—', colorClass: 'text-gray-500' };

    const remainingKm = 2;
    const mins = Math.max(1, Math.round((remainingKm / (avgSpeedKmh || 20)) * 60));
    const colorClass =
      mins <= 5 ? 'text-green-600' : mins <= 15 ? 'text-orange-500' : 'text-red-600';

    return { text: `~${mins} min`, colorClass };
  }, [coords, avgSpeedKmh]);

  const effectiveRider: RiderProfile = rider ?? EMPTY_RIDER;
  const effectivePharmacy: PharmacyProfile = pharmacy ?? EMPTY_PHARMACY;

  const [mapCollapsed, setMapCollapsed] = useState(false);

  const openInMaps = (lat: number, lng: number) => {
    const url = `https://www.google.com/maps?q=${lat},${lng}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <main className="p-6 max-w-6xl mx-auto">
      <header className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-semibold">Delivery tracking</h1>
          <p className="text-sm text-gray-500">
            CarePort • Job{' '}
            <span className="font-mono">{trackingId || 'No tracking ID supplied'}</span>
          </p>
        </div>

        <div className="text-right">
          <div className="flex items-center gap-3 justify-end">
            <div className={`text-sm font-medium ${eta.colorClass}`}>ETA: {eta.text}</div>
            <div
              className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${
                connected
                  ? 'bg-green-50 text-green-700 border border-green-100'
                  : 'bg-gray-100 text-gray-600 border border-gray-200'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-gray-400'}`} />
              {connected ? 'Live' : 'Offline'}
            </div>
          </div>

          <div className="mt-2 text-xs text-gray-500">
            {lastUpdateAt ? <>Last update: {timeHHMM(lastUpdateAt)}</> : 'No updates yet'}
            {error ? <div className="mt-1 text-rose-600">{error}</div> : null}
          </div>
        </div>
      </header>

      <TrackingPartnerIdentity rider={effectiveRider} pharmacy={effectivePharmacy} />

      <div className="mb-4">
        <div className="relative bg-gray-200 h-3 rounded overflow-hidden">
          <div className="bg-indigo-600 h-3 rounded transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
          <div>Progress</div>
          <div>
            {progress}% • {routeKm.toFixed(2)} km from rider coordinates
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr,420px] gap-6">
        <section className="rounded-md border bg-white overflow-hidden flex flex-col">
          <div className="flex items-center justify-between p-3 border-b">
            <div className="flex items-center gap-3">
              <button
                className="md:hidden px-2 py-1 text-sm rounded border"
                onClick={() => setMapCollapsed((s) => !s)}
              >
                {mapCollapsed ? 'Show map' : 'Hide map'}
              </button>
              <div className="text-sm font-medium">Rider map</div>
            </div>

            <button
              className="px-3 py-1 rounded border bg-white"
              onClick={() => window.dispatchEvent(new CustomEvent('openContact'))}
            >
              Contact
            </button>
          </div>

          <div className={`flex-1 ${mapCollapsed ? 'hidden' : 'block'}`} style={{ minHeight: 360 }}>
            <RiderMap coords={coords} rider={effectiveRider} pharmacy={effectivePharmacy} />
          </div>
        </section>

        <aside className="space-y-4">
          <DeliveryDetails order={deliveryDetails} />

          <div className="bg-white border rounded-md p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium">Recent activity</h2>
              <div className="text-xs text-gray-500">Updates</div>
            </div>

            {timeline.length === 0 ? (
              <div className="rounded-md border border-dashed border-gray-200 p-4 text-sm text-gray-500">
                No live CarePort delivery updates yet.
              </div>
            ) : (
              <ul className="space-y-2 text-sm">
                {timeline
                  .slice()
                  .reverse()
                  .slice(0, 10)
                  .map((it, idx) => (
                    <TimelineItem
                      key={timelineKey(it, idx)}
                      it={it}
                      onCenter={(lat, lng) => openInMaps(lat, lng)}
                    />
                  ))}
              </ul>
            )}
          </div>

          <ContactSheet open={contactOpen} onClose={() => setContactOpen(false)} rider={effectiveRider} />
        </aside>
      </div>
    </main>
  );
}

export default function CarePortTrack() {
  return (
    <Suspense fallback={null}>
      <CarePortTrackContent />
    </Suspense>
  );
}

