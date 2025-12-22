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
  onClose?: () => void; // kept for API compatibility, unused for now
}

export default function RiderMap({ coords, pharmacy }: RiderMapProps) {
  const lastPoint = useMemo(() => {
    if (coords && coords.length > 0) {
      const last = coords[coords.length - 1];
      if (typeof last.lat === 'number' && typeof last.lng === 'number') {
        return last;
      }
    }
    if (pharmacy?.coords) {
      return { lat: pharmacy.coords.lat, lng: pharmacy.coords.lng };
    }
    return null;
  }, [coords, pharmacy]);

  const openGoogleMaps = () => {
    if (!lastPoint) return;
    const url = `https://www.google.com/maps?q=${lastPoint.lat},${lastPoint.lng}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const openWaze = () => {
    if (!lastPoint) return;
    const wazeUrl = `waze://?ll=${lastPoint.lat},${lastPoint.lng}&navigate=yes`;
    const webFallback = `https://waze.com/ul?ll=${lastPoint.lat},${lastPoint.lng}&navigate=yes`;
    // try app, fall back to web (mobile browsers will handle scheme if available)
    window.open(wazeUrl, '_blank');
    setTimeout(() => {
      window.open(webFallback, '_blank', 'noopener,noreferrer');
    }, 500);
  };

  return (
    <div className="h-full w-full flex flex-col items-center justify-center p-4 text-xs text-gray-600">
      <div className="max-w-sm text-center">
        <div className="font-medium text-sm mb-1">
          In-app live map is temporarily disabled
        </div>
        <p className="text-xs text-gray-500 mb-3">
          You still get real-time ETA, progress and timeline here. Use the buttons
          below to open navigation in your preferred maps app.
        </p>

        {lastPoint ? (
          <>
            <div className="mb-3 text-[11px] text-gray-500">
              Current location:&nbsp;
              <span className="font-mono">
                {lastPoint.lat.toFixed(5)}, {lastPoint.lng.toFixed(5)}
              </span>
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              <button
                type="button"
                onClick={openGoogleMaps}
                className="px-3 py-1.5 rounded border bg-white hover:bg-gray-50 text-xs"
              >
                Open in Google Maps
              </button>
              <button
                type="button"
                onClick={openWaze}
                className="px-3 py-1.5 rounded border bg-white hover:bg-gray-50 text-xs"
              >
                Open in Waze
              </button>
            </div>
          </>
        ) : (
          <div className="text-[11px] text-gray-500">
            We don’t have a location yet. As soon as coordinates are available,
            this panel will offer “Open in Maps” links.
          </div>
        )}
      </div>
    </div>
  );
}
