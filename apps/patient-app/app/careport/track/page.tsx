// apps/patient-app/app/careport/track/page.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import RiderMap from '@/components/RiderMap';
import TimelineItem from '@/components/TimelineItem';
import DeliveryDetails, {
  DeliveryDetailsProps,
} from '@/components/DeliveryDetails';
import ContactSheet from '@/components/ContactSheet';
import { useSSE } from '@/hooks/useSSE';
import { useGeocode } from '@/hooks/useGeocode';

/* ================= types ================= */
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

// exported so ContactSheet can import it
export type RiderProfile = {
  id?: string;
  name?: string;
  avatar?: string;
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
  coords?: { lat: number; lng: number } | null;
  distanceText?: string;
};

/* ================= mocked fallbacks ================= */
const MOCK_RIDER: RiderProfile = {
  id: 'r-mock',
  name: 'Sipho R.',
  avatar: '/rider-avatar.png',
  rating: 4.8,
  vehicle: 'Motorbike • Red',
  phoneMasked: '+27 ••• ••• 1234',
  phone: undefined,
  regPlate: 'GP-123-XY',
  tripsCount: 1242,
};

const MOCK_PHARMACY: PharmacyProfile = {
  id: 'ph-mock',
  name: 'MedCare Sandton',
  address: 'Sandton, Johannesburg',
  coords: { lat: -26.082, lng: 28.034 },
  distanceText: '2.1 km from patient',
};

const carePortMockTimeline: TimelineItemType[] = [
  {
    t: '2025-08-08T09:12:00.000Z',
    msg: 'Pharmacy selected',
    lat: -26.082,
    lng: 28.034,
    entity: 'pharmacy',
  },
  {
    t: '2025-08-08T09:18:00.000Z',
    msg: 'Rider assigned',
    lat: -26.0825,
    lng: 28.0348,
    entity: 'rider',
  },
  {
    t: '2025-08-08T09:33:00.000Z',
    msg: 'Pharmacy preparing order',
    lat: -26.082,
    lng: 28.034,
    entity: 'pharmacy',
  },
  {
    t: '2025-08-08T09:55:00.000Z',
    msg: 'Rider picked up order',
    lat: -26.084,
    lng: 28.0364,
    entity: 'rider',
  },
  {
    t: '2025-08-08T10:20:00.000Z',
    msg: 'Out for delivery',
    lat: -26.0856,
    lng: 28.0386,
    entity: 'rider',
  },
];

/* ================= helpers: haversine, polyline, time formatting ================= */
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
  const d =
    typeof tsOrIso === 'number' ? new Date(tsOrIso) : new Date(tsOrIso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function timelineKey(it: TimelineItemType, idx: number) {
  const safe = encodeURIComponent(String(it.msg || '')).slice(0, 12);
  return `${it.t}-${safe}-${idx}`;
}

/* ================= main page ================= */
export default function CarePortTrack() {
  const [timeline, setTimeline] = useState<TimelineItemType[]>(
    carePortMockTimeline,
  );
  const [coords, setCoords] = useState<Coord[]>(
    carePortMockTimeline
      .filter((c) => c.lat && c.lng)
      .map((c) => ({ lat: c.lat!, lng: c.lng!, ts: Date.now() })),
  );
  const [routePoints, setRoutePoints] = useState<
    { lat: number; lng: number }[] | null
  >(null);
  const posHistoryRef = useRef<{ lat: number; lng: number; ts: number }[]>(
    [],
  );
  const [lastUpdateAt, setLastUpdateAt] = useState<number | null>(null);

  const [rider, setRider] = useState<RiderProfile | null>(null);
  const [pharmacy, setPharmacy] = useState<PharmacyProfile | null>(null);

  // contact sheet state + global "openContact" event
  const [contactOpen, setContactOpen] = useState(false);
  useEffect(() => {
    const handler = () => setContactOpen(true);
    window.addEventListener('openContact', handler as EventListener);
    return () =>
      window.removeEventListener('openContact', handler as EventListener);
  }, []);

  // delivery details card (mocked, can be overridden by SSE `meta` later)
  const [deliveryDetails, setDeliveryDetails] =
    useState<DeliveryDetailsProps>({
      orderNo: 'ORD-123456',
      eRxNo: 'ERX-789012',
      encounterId: 'ENC-001',
      patientId: 'PAT-001',
      clinicianId: 'CLN-001',
      caseId: 'CASE-001',
      sessionId: 'SESS-001',
      trackingNo: 'TRK-987654',
      riderId: MOCK_RIDER.id,
      bikeReg: MOCK_RIDER.regPlate,
      deliveryAmount: 'R75.00',
      paymentMethod: 'Card',
      dateIso: new Date().toISOString(),
    });

  // SSE hook
  const {
    connected: sseConnected,
    error: sseHookError,
    on,
  } = useSSE('/api/careport/track/stream');

  // Geocode hook
  const { reverse: reverseGeocode } = useGeocode();

  const [sseError, setSseError] = useState<string | null>(null);
  useEffect(() => {
    setSseError(sseHookError);
  }, [sseHookError]);

  // pushTimeline with dedupe
  function pushTimeline(item: TimelineItemType) {
    setTimeline((prev) => {
      if (prev.some((p) => p.t === item.t && p.msg === item.msg)) return prev;
      return [...prev.slice(-19), item];
    });
  }

  /* ================= SSE wiring via useSSE ================= */
  useEffect(() => {
    const offPharmacy = on('pharmacy', (ev: any) => {
      try {
        const p = JSON.parse(ev.data);
        if (p && typeof p === 'object') {
          setPharmacy({
            id: p.id,
            name: p.name,
            address: p.address,
            coords: p.coords
              ? { lat: Number(p.coords.lat), lng: Number(p.coords.lng) }
              : null,
            distanceText: p.distanceText,
          });
          const ts = p.ts || Date.now();
          pushTimeline({
            t: new Date(ts).toISOString(),
            msg: `Pharmacy selected: ${p.name || 'Pharmacy'}`,
            lat: p.coords?.lat,
            lng: p.coords?.lng,
            entity: 'pharmacy',
          });
        }
      } catch (err) {
        console.warn('pharmacy event parse failed', err);
      }
    });

    const offRider = on('rider', (ev: any) => {
      try {
        const parsed = JSON.parse(ev.data);
        if (parsed && typeof parsed === 'object') {
          setRider(parsed as RiderProfile);
          pushTimeline({
            t: new Date().toISOString(),
            msg: `Rider assigned: ${parsed.name || 'Rider'}`,
            entity: 'rider',
            lat: parsed.lastLat,
            lng: parsed.lastLng,
          });
          setDeliveryDetails((d) => ({
            ...d,
            riderId: parsed.id ?? d.riderId,
            bikeReg: parsed.regPlate ?? d.bikeReg,
          }));
        }
      } catch (err) {
        console.warn('Failed to parse rider SSE', err);
      }
    });

    const offCoords = on('coords', (ev: any) => {
      try {
        const parsed = JSON.parse(ev.data);
        if (
          Array.isArray(parsed) &&
          parsed.length > 0 &&
          typeof parsed[0].lat === 'number'
        ) {
          const next: Coord[] = parsed.map((p: any) => ({
            lat: Number(p.lat),
            lng: Number(p.lng),
            ts: typeof p.ts === 'number' ? p.ts : Date.now(),
          }));
          setCoords(next);

          const last = next[next.length - 1];
          if (last) {
            posHistoryRef.current = [
              ...posHistoryRef.current.slice(-19),
              {
                lat: last.lat,
                lng: last.lng,
                ts: last.ts ?? Date.now(),
              },
            ];
            setLastUpdateAt(last.ts ?? Date.now());
            pushTimeline({
              t: new Date(last.ts ?? Date.now()).toISOString(),
              msg: 'Rider location update',
              lat: last.lat,
              lng: last.lng,
              entity: 'rider',
            });
          }
        }
      } catch (err) {
        console.warn('Failed to parse coords SSE', err);
      }
    });

    const offMeta = on('meta', (ev: any) => {
      try {
        const m = JSON.parse(ev.data);
        if (m?.status === 'done') {
          pushTimeline({
            t: new Date().toISOString(),
            msg: 'Delivery completed',
            entity: 'system',
          });
        }
        if (m?.order) {
          setDeliveryDetails((d) => ({ ...d, ...m.order }));
        }
      } catch {
        // ignore
      }
    });

    return () => {
      offPharmacy();
      offRider();
      offCoords();
      offMeta();
    };
  }, [on]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ================= optional route fetch ================= */
  useEffect(() => {
    let mounted = true;
    fetch('/api/careport/track/route')
      .then((r) => (r.ok ? r.json() : Promise.reject('no route')))
      .then((json) => {
        if (mounted && Array.isArray(json))
          setRoutePoints(json as { lat: number; lng: number }[]);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  /* ================= progress & route distance ================= */
  const routeKm = useMemo(
    () =>
      polylineDistanceKm(
        (routePoints ?? coords) as { lat: number; lng: number }[],
      ),
    [routePoints, coords],
  );

  const progress = useMemo(() => {
    if (!coords || coords.length === 0) return 0;
    const current = coords[coords.length - 1];
    const route = routePoints && routePoints.length > 1 ? routePoints : coords;
    const total = polylineDistanceKm(route);
    if (total <= 0) return 0;
    let nearestIdx = 0;
    let nearestDist = Infinity;
    for (let i = 0; i < route.length; i++) {
      const d = haversineKm(current, route[i]);
      if (d < nearestDist) {
        nearestDist = d;
        nearestIdx = i;
      }
    }
    let traveled = 0;
    for (let i = 1; i <= nearestIdx; i++) {
      traveled += haversineKm(route[i - 1], route[i]);
    }
    traveled += nearestDist;
    return Math.round(Math.min(100, (traveled / total) * 100));
  }, [coords, routePoints]);

  /* ================= avg speed (km/h) ================= */
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
    if (!isFinite(kmh) || kmh <= 0) return 10;
    return Math.min(80, kmh);
  }, [coords]);

  /* ================= ETA calculation ================= */
  const eta = useMemo(() => {
    if (!coords || coords.length === 0)
      return { text: '—', colorClass: 'text-gray-500' };
    const current = coords[coords.length - 1];
    const fullRoute =
      routePoints && routePoints.length > 1 ? routePoints : coords;
    let nearestIdx = 0;
    let nearestDist = Infinity;
    for (let i = 0; i < fullRoute.length; i++) {
      const d = haversineKm(current, fullRoute[i]);
      if (d < nearestDist) {
        nearestDist = d;
        nearestIdx = i;
      }
    }
    const remainingPoints = fullRoute.slice(nearestIdx);
    const remainingKm = polylineDistanceKm([current, ...remainingPoints]);
    const speed = avgSpeedKmh || 20;
    const mins = Math.round((remainingKm / speed) * 60);
    if (remainingKm < 0.05 || mins <= 0)
      return { text: 'Arriving', colorClass: 'text-green-600' };
    const arriveTs = Date.now() + mins * 60 * 1000;
    const arriveAt = new Date(arriveTs);
    const abs = arriveAt.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
    const tz =
      Intl.DateTimeFormat().resolvedOptions().timeZone || 'local';
    const text =
      mins < 60
        ? `~${mins} min (arr ${abs})`
        : `${Math.floor(mins / 60)}h ${mins % 60}m (arr ${abs})`;
    const colorClass =
      mins <= 5
        ? 'text-green-600'
        : mins <= 15
        ? 'text-orange-500'
        : 'text-red-600';
    return { text, colorClass, tooltip: `${abs} ${tz}` } as any;
  }, [coords, routePoints, avgSpeedKmh]);

  const effectiveRider: RiderProfile = rider || MOCK_RIDER;
  const effectivePharmacy: PharmacyProfile = pharmacy || MOCK_PHARMACY;

  // reverse geocode pharmacy coords to a nicer address
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (effectivePharmacy?.coords) {
        try {
          const name = await reverseGeocode(
            effectivePharmacy.coords.lat,
            effectivePharmacy.coords.lng,
          );
          if (!cancelled) {
            setPharmacy((p) => ({ ...(p || {}), address: name }));
          }
        } catch {
          // ignore
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    effectivePharmacy?.coords?.lat,
    effectivePharmacy?.coords?.lng,
    reverseGeocode,
  ]);

  // reverse-geocode timeline pharmacy entries
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const toResolve = timeline.filter(
        (it) =>
          it.entity === 'pharmacy' && it.lat && it.lng && !it.place,
      );
      for (const it of toResolve) {
        try {
          const name = await reverseGeocode(it.lat!, it.lng!);
          if (cancelled) return;
          setTimeline((prev) =>
            prev.map((p) =>
              p.t === it.t && p.msg === it.msg
                ? { ...p, place: name }
                : p,
            ),
          );
        } catch {
          // ignore
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [timeline, reverseGeocode]);

  /* small UI state for mobile map toggle */
  const [mapCollapsed, setMapCollapsed] = useState(false);

  /* ===== helper: open a coordinate in external maps ===== */
  const openInMaps = (lat: number, lng: number) => {
    if (Number.isNaN(lat) || Number.isNaN(lng)) return;
    const url = `https://www.google.com/maps?q=${lat},${lng}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleCenterOnMap = (lat: number, lng: number) => {
    openInMaps(lat, lng);
  };

  return (
    <main className="p-6 max-w-6xl mx-auto">
      {/* HEADER */}
      <header className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-4">
        <div className="flex items-start gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Delivery tracking</h1>
            <p className="text-sm text-gray-500">
              Real-time rider location &amp; pharmacy pickup — live ETA and
              timeline.
            </p>
          </div>

          {/* Pharmacy + Rider summary (desktop) */}
          <div className="hidden md:flex items-center gap-3 ml-4">
            {/* Pharmacy pill */}
            <div className="flex items-center gap-3 bg-white border rounded-md px-3 py-2 shadow-sm">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-sm font-medium">
                🏥
              </div>
              <div className="text-sm">
                <div className="font-medium">
                  {effectivePharmacy.name}
                </div>
                <div className="text-xs text-gray-500">
                  {effectivePharmacy.distanceText ?? ''}
                </div>
                {effectivePharmacy.coords ? (
                  <div className="text-xs text-gray-500 mt-1">
                    {effectivePharmacy.coords.lat.toFixed(5)},{' '}
                    {effectivePharmacy.coords.lng.toFixed(5)}
                  </div>
                ) : null}
              </div>
            </div>

            {/* Rider pill */}
            <div className="flex items-center gap-3 bg-white border rounded-md px-3 py-2 shadow-sm">
              <img
                src={effectiveRider.avatar || '/rider-avatar.png'}
                alt={effectiveRider.name || 'Rider'}
                className="w-10 h-10 rounded-full object-cover"
              />
              <div className="text-sm">
                <div className="font-medium">{effectiveRider.name}</div>
                <div className="text-xs text-gray-500">
                  {effectiveRider.vehicle}
                </div>
                <div className="text-xs text-yellow-600">
                  ★{' '}
                  {typeof effectiveRider.rating === 'number'
                    ? effectiveRider.rating.toFixed(1)
                    : '—'}
                </div>
              </div>
              <div className="ml-2 flex flex-col gap-1">
                <button
                  className="px-2 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700"
                  onClick={() => {
                    const last =
                      coords && coords.length
                        ? coords[coords.length - 1]
                        : effectivePharmacy.coords;
                    if (last) openInMaps(last.lat, last.lng);
                    else alert('Location not available yet');
                  }}
                >
                  View map
                </button>
                <button
                  className="px-2 py-1 text-xs border rounded bg-white"
                  onClick={() => {
                    window.dispatchEvent(
                      new CustomEvent('openContact'),
                    );
                  }}
                >
                  Contact
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ETA + live status */}
        <div className="text-right">
          <div className="flex items-center gap-3">
            <div className={`text-sm font-medium ${eta.colorClass}`}>
              ETA: {eta.text}
            </div>
            <div
              role="status"
              aria-live="polite"
              className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${
                sseConnected
                  ? 'bg-green-50 text-green-700 border border-green-100'
                  : 'bg-gray-100 text-gray-600 border border-gray-200'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  sseConnected ? 'bg-green-500' : 'bg-gray-400'
                }`}
                aria-hidden
              />
              {sseConnected ? 'Live' : 'Offline'}
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-500">
            {lastUpdateAt ? (
              <>
                Last update:{' '}
                <span title={new Date(lastUpdateAt).toLocaleString()}>
                  {timeHHMM(lastUpdateAt)}
                </span>
              </>
            ) : (
              'No updates yet'
            )}
            {sseError ? (
              <div className="mt-1 text-xxs text-rose-600">
                {sseError}
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {/* PROGRESS BAR */}
      <div className="mb-4">
        <div
          className="relative bg-gray-200 h-3 rounded overflow-hidden"
          aria-hidden
        >
          <div
            className="bg-indigo-600 h-3 rounded transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
          <div>Progress</div>
          <div>
            {progress}% • {routeKm.toFixed(2)} km route
          </div>
        </div>
      </div>

      {/* MAIN CONTENT: MAP + SIDEBAR */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr,420px] gap-6">
        {/* LEFT: MAP AREA */}
        <section
          className="rounded-md border bg-white overflow-hidden flex flex-col"
          aria-label="Map and controls"
        >
          <div className="flex items-center justify-between p-3 border-b">
            <div className="flex items-center gap-3">
              <button
                className="md:hidden px-2 py-1 text-sm rounded border"
                onClick={() => setMapCollapsed((s) => !s)}
                aria-expanded={!mapCollapsed}
                aria-controls="map-area"
              >
                {mapCollapsed ? 'Show map' : 'Hide map'}
              </button>
              <div className="text-sm font-medium">Rider map</div>
              <div className="text-xs text-gray-500">
                External navigation — Google Maps / Waze
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                className="px-3 py-1 rounded border bg-white"
                onClick={() => {
                  navigator.clipboard?.writeText(window.location.href);
                  pushTimeline({
                    t: new Date().toISOString(),
                    msg: 'Share link copied to clipboard',
                    entity: 'system',
                  });
                }}
              >
                Share
              </button>
              <button
                className="px-3 py-1 rounded border bg-white"
                onClick={() =>
                  window.dispatchEvent(new CustomEvent('openContact'))
                }
              >
                Contact
              </button>
            </div>
          </div>

          <div
            id="map-area"
            className={`flex-1 ${mapCollapsed ? 'hidden' : 'block'}`}
            style={{ minHeight: 360 }}
          >
            <RiderMap
              coords={coords}
              rider={rider ?? undefined}
              pharmacy={pharmacy ?? undefined}
            />
          </div>
        </section>

        {/* RIGHT: INFO PANEL */}
        <aside className="space-y-4">
          {/* Rider summary + stats */}
          <div className="bg-white border rounded-md p-4">
            <div className="flex items-center gap-3">
              <img
                src={effectiveRider.avatar || '/rider-avatar.png'}
                alt={effectiveRider.name || 'Rider'}
                className="w-14 h-14 rounded-full object-cover"
              />
              <div className="flex-1">
                <div className="font-medium text-lg">
                  {effectiveRider.name}
                </div>
                <div className="text-sm text-gray-500">
                  {effectiveRider.vehicle} •{' '}
                  <span className="font-medium">
                    {effectiveRider.regPlate}
                  </span>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Trips: {effectiveRider.tripsCount ?? '—'} • ★{' '}
                  {typeof effectiveRider.rating === 'number'
                    ? effectiveRider.rating.toFixed(1)
                    : '—'}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  className="px-3 py-2 rounded bg-indigo-600 text-white text-sm"
                  onClick={() => {
                    window.dispatchEvent(
                      new CustomEvent('openContact'),
                    );
                  }}
                >
                  Message
                </button>
                <button
                  className="px-3 py-2 rounded border text-sm bg-white"
                  onClick={() => {
                    if (effectiveRider.phone) {
                      window.location.href = `tel:${effectiveRider.phone}`;
                    } else {
                      navigator.clipboard?.writeText(
                        effectiveRider.phoneMasked ?? '',
                      );
                      alert('Phone number copied to clipboard');
                    }
                  }}
                >
                  Call
                </button>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-600">
              <div>
                <div className="text-xxs text-gray-500">Speed (avg)</div>
                <div className="font-medium">
                  {Math.round(avgSpeedKmh)} km/h
                </div>
              </div>
              <div>
                <div className="text-xxs text-gray-500">ETA</div>
                <div className={`font-medium ${eta.colorClass}`}>
                  {eta.text}
                </div>
              </div>
            </div>
          </div>

          {/* Delivery Details card */}
          <DeliveryDetails order={deliveryDetails} />

          {/* Timeline (using TimelineItem component) */}
          <div className="bg-white border rounded-md p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium">Recent activity</h2>
              <div className="text-xs text-gray-500">Live updates</div>
            </div>

            <ul className="space-y-2 text-sm" aria-live="polite">
              {timeline
                .slice()
                .reverse()
                .slice(0, 10)
                .map((it, idx) => (
                  <TimelineItem
                    key={timelineKey(it, idx)}
                    it={it}
                    onCenter={(lat, lng) => handleCenterOnMap(lat, lng)}
                  />
                ))}
            </ul>

            <div className="mt-3 text-right">
              <button
                className="text-xs px-3 py-1 rounded border bg-white"
                onClick={() => {
                  pushTimeline({
                    t: new Date().toISOString(),
                    msg: 'Full timeline expanded',
                    entity: 'system',
                  });
                }}
              >
                See more
              </button>
            </div>
          </div>

          {/* Pickup info card */}
          <div className="bg-white border rounded-md p-4 text-xs text-gray-600">
            <div className="font-medium mb-2">Pickup</div>
            <div className="text-sm">{effectivePharmacy.name}</div>
            <div className="text-xs text-gray-500">
              {effectivePharmacy.address ??
                (effectivePharmacy.coords
                  ? `${effectivePharmacy.coords.lat.toFixed(
                      5,
                    )}, ${effectivePharmacy.coords.lng.toFixed(5)}`
                  : '—')}
            </div>
            <div className="mt-2 text-xs text-gray-500">
              {effectivePharmacy.distanceText ?? ''}
            </div>
            <div className="mt-3">
              <button
                className="px-3 py-1 rounded border bg-white text-sm"
                onClick={() => {
                  if (effectivePharmacy.coords) {
                    openInMaps(
                      effectivePharmacy.coords.lat,
                      effectivePharmacy.coords.lng,
                    );
                  }
                }}
              >
                Open pickup in Maps
              </button>
            </div>
          </div>
        </aside>
      </div>

      {/* ContactSheet modal */}
      <ContactSheet
        open={contactOpen}
        onClose={() => setContactOpen(false)}
        rider={effectiveRider}
      />
    </main>
  );
}
