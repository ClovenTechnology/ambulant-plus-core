// apps/patient-app/components/RiderMap.tsx
'use client';

import React, { useMemo } from 'react';

interface Coord {
  lat: number;
  lng: number;
  ts?: number;
}

interface RiderProfile {
  id?: string;
  name?: string;
  avatar?: string;
  rating?: number;
  vehicle?: string;
  phoneMasked?: string;
  phone?: string;
  regPlate?: string;
  tripsCount?: number;
}

interface PharmacyProfile {
  id?: string;
  name?: string;
  address?: string;
  coords?: { lat: number; lng: number } | null;
  distanceText?: string;
}

interface RiderMapProps {
  coords: Coord[];
  rider?: RiderProfile;
  pharmacy?: PharmacyProfile;
  onClose?: () => void;
}

function formatWhen(ts?: number) {
  if (!ts) return 'Awaiting update';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return 'Awaiting update';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function RiderMap({ coords, rider, pharmacy }: RiderMapProps) {
  const lastPoint = useMemo(() => {
    if (coords && coords.length > 0) {
      const last = coords[coords.length - 1];
      if (typeof last.lat === 'number' && typeof last.lng === 'number') return last;
    }

    if (pharmacy?.coords) return { lat: pharmacy.coords.lat, lng: pharmacy.coords.lng, ts: undefined };
    return null;
  }, [coords, pharmacy]);

  const openGoogleMaps = () => {
    if (!lastPoint) return;
    window.open(`https://www.google.com/maps?q=${lastPoint.lat},${lastPoint.lng}`, '_blank', 'noopener,noreferrer');
  };

  const openWaze = () => {
    if (!lastPoint) return;
    const webFallback = `https://waze.com/ul?ll=${lastPoint.lat},${lastPoint.lng}&navigate=yes`;
    window.open(webFallback, '_blank', 'noopener,noreferrer');
  };

  return (
    <section className="flex h-full min-h-[360px] w-full flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Live location</p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-950">
              {rider?.name || 'Rider assignment pending'}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {pharmacy?.name ? `From ${pharmacy.name}` : 'The route appears as soon as dispatch begins.'}
            </p>
          </div>

          <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
            {formatWhen(lastPoint?.ts)}
          </div>
        </div>
      </div>

      <div className="grid flex-1 place-items-center bg-gradient-to-br from-slate-50 via-white to-cyan-50 p-6">
        <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white/90 p-5 text-center shadow-sm backdrop-blur">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50">
            <span className="h-3 w-3 rounded-full bg-emerald-500 ring-8 ring-emerald-100" aria-hidden />
          </div>

          <h3 className="mt-4 text-base font-semibold text-slate-950">
            {lastPoint ? 'Current delivery position is available' : 'Waiting for first location ping'}
          </h3>

          <p className="mt-2 text-sm leading-6 text-slate-600">
            CarePort keeps the order timeline live inside Ambulant+. When coordinates are available, patients can open
            the location in their preferred navigation app.
          </p>

          {lastPoint ? (
            <>
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-600">
                {lastPoint.lat.toFixed(5)}, {lastPoint.lng.toFixed(5)}
              </div>

              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={openGoogleMaps}
                  className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  Open in Google Maps
                </button>
                <button
                  type="button"
                  onClick={openWaze}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Open in Waze
                </button>
              </div>
            </>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">
              Tracking becomes active after pharmacy handover and rider assignment.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
