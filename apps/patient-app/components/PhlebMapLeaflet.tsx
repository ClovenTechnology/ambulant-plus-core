// apps/patient-app/components/PhlebMapLeaflet.tsx
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import type {
  PhlebMapProps,
  Coord,
} from './PhlebMap';

const easeInOut = (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * t);

export default function PhlebMapLeaflet({
  open,
  onClose,
  coords,
  phleb,
  patientLocation,
  labLocation,
}: PhlebMapProps) {
  // Safety: wrapper should already gate on `open`, but keep this in case
  if (!open) return null;

  const [markerPos, setMarkerPos] = useState<{ lat: number; lng: number } | null>(
    coords && coords.length
      ? { lat: coords[coords.length - 1].lat, lng: coords[coords.length - 1].lng }
      : null,
  );

  const trailRef = useRef<{ lat: number; lng: number }[]>(
    coords && coords.length ? [{ lat: coords[0].lat, lng: coords[0].lng }] : [],
  );
  const indexRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  // Reset when coords change
  useEffect(() => {
    if (!coords || coords.length < 1) {
      setMarkerPos(null);
      trailRef.current = [];
      indexRef.current = 0;
      return;
    }
    setMarkerPos({
      lat: coords[coords.length - 1].lat,
      lng: coords[coords.length - 1].lng,
    });
    trailRef.current = [{ lat: coords[0].lat, lng: coords[0].lng }];
    indexRef.current = Math.max(0, coords.length - 2);
  }, [coords]);

  // Simple animation along the coords path
  useEffect(() => {
    if (!open || !coords || coords.length < 2) {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    let running = true;
    let idx = Math.max(0, indexRef.current);
    let start: Coord = coords[idx];
    let end: Coord = coords[Math.min(idx + 1, coords.length - 1)];
    let prog = 0;

    const step = () => {
      if (!running) return;
      prog += 0.02;
      const t = Math.min(1, prog);
      const eased = easeInOut(t);
      const lat = start.lat + (end.lat - start.lat) * eased;
      const lng = start.lng + (end.lng - start.lng) * eased;

      setMarkerPos({ lat, lng });
      trailRef.current = [...trailRef.current.slice(-80), { lat, lng }];

      if (t >= 1) {
        idx++;
        if (idx >= coords.length - 1) {
          setMarkerPos({
            lat: coords[coords.length - 1].lat,
            lng: coords[coords.length - 1].lng,
          });
          indexRef.current = coords.length - 1;
          return;
        }
        start = coords[idx];
        end = coords[idx + 1];
        prog = 0;
        indexRef.current = idx;
      }

      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);

    return () => {
      running = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [coords, open]);

  const phlebIcon = new L.DivIcon({
    html: `<div class="phleb-marker"><div class="pulse" aria-hidden></div><div class="phleb-icon" aria-hidden>🩺</div></div>`,
    className: '',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });

  const patientIcon = new L.DivIcon({
    html: `<div class="pickup-marker" aria-hidden>🏠</div>`,
    className: '',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });

  const labIcon = new L.DivIcon({
    html: `<div class="pickup-marker" aria-hidden>🧪</div>`,
    className: '',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });

  const activeTrail =
    trailRef.current.length > 1
      ? trailRef.current
      : coords.length
      ? [
          { lat: coords[0].lat, lng: coords[0].lng },
          { lat: coords[coords.length - 1].lat, lng: coords[coords.length - 1].lng },
        ]
      : [];

  const remainingTrail = (() => {
    const idx = indexRef.current;
    if (!coords || coords.length <= idx + 1) return [];
    return coords.slice(idx + 1).map((c) => ({ lat: c.lat, lng: c.lng }));
  })();

  const allBounds: { lat: number; lng: number }[] = [];
  if (activeTrail.length) allBounds.push(...activeTrail);
  if (remainingTrail.length) allBounds.push(...remainingTrail);
  if (patientLocation?.coords) allBounds.push(patientLocation.coords);
  if (labLocation?.coords) allBounds.push(labLocation.coords);

  const initialCenter =
    markerPos ||
    patientLocation?.coords ||
    labLocation?.coords || { lat: -26.1, lng: 28.0 };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Phlebotomist map — live tracking"
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <div className="bg-white rounded-2xl overflow-hidden w-full max-w-3xl h-96 relative shadow-2xl">
        <button
          className="absolute top-3 right-3 z-40 px-3 py-1 bg-gray-100 rounded-md hover:bg-gray-200"
          onClick={onClose}
        >
          ✕
        </button>

        {/* Phleb card overlay */}
        <div className="absolute left-4 top-4 z-40">
          <div className="bg-white/95 backdrop-blur-sm rounded-lg p-3 flex items-center gap-3 border shadow-sm">
            <img
              src={phleb?.avatar || '/phleb-avatar.png'}
              alt={phleb?.name || 'Phlebotomist'}
              className="w-10 h-10 rounded-full object-cover"
            />
            <div className="text-sm">
              <div className="font-medium">{phleb?.name || 'Phlebotomist'}</div>
              {phleb?.labName && (
                <div className="text-xs text-gray-500">{phleb.labName}</div>
              )}
              <div className="text-xs text-gray-500">
                {phleb?.vehicle || 'MedReach fleet'}
              </div>
              {typeof phleb?.rating === 'number' && (
                <div className="text-xs text-yellow-600">
                  ★ {phleb.rating.toFixed(1)}
                </div>
              )}
            </div>
          </div>
        </div>

        <MapContainer
          center={[initialCenter.lat, initialCenter.lng]}
          zoom={14}
          className="w-full h-full"
          whenCreated={(map) => {
            try {
              if (allBounds.length > 0) {
                const bounds = L.latLngBounds(
                  allBounds.map((c) => [c.lat, c.lng] as [number, number]),
                );
                map.fitBounds(bounds, { padding: [50, 50] });
              }
            } catch {
              // ignore fitBounds errors
            }
          }}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

          {activeTrail.length > 1 && (
            <Polyline
              positions={activeTrail.map((c) => [c.lat, c.lng])}
              pathOptions={{
                color: '#6366f1',
                weight: 6,
                opacity: 0.9,
                className: 'glow-trail',
              }}
            />
          )}

          {remainingTrail.length > 1 && (
            <Polyline
              positions={remainingTrail.map((c) => [c.lat, c.lng])}
              pathOptions={{
                color: '#6366f1',
                opacity: 0.3,
                dashArray: '6,10',
                weight: 4,
              }}
            />
          )}

          {patientLocation?.coords && (
            <Marker
              position={[patientLocation.coords.lat, patientLocation.coords.lng]}
              icon={patientIcon as any}
            >
              <Popup>
                {patientLocation.name ?? 'Home collection'}
                <br />
                {patientLocation.address}
              </Popup>
            </Marker>
          )}

          {labLocation?.coords && (
            <Marker
              position={[labLocation.coords.lat, labLocation.coords.lng]}
              icon={labIcon as any}
            >
              <Popup>{labLocation.name ?? 'Lab'}</Popup>
            </Marker>
          )}

          {markerPos && (
            <Marker position={[markerPos.lat, markerPos.lng]} icon={phlebIcon as any}>
              <Popup>Phlebotomist en route</Popup>
            </Marker>
          )}
        </MapContainer>
      </div>

      <style jsx global>{`
        .glow-trail {
          filter: drop-shadow(0 0 8px rgba(99, 102, 241, 0.55));
          transition: all 0.1s linear;
        }
        .phleb-marker {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .phleb-icon {
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          border-radius: 50%;
          background: white;
          box-shadow: 0 0 12px rgba(99, 102, 241, 0.6);
          z-index: 2;
        }
        .pulse {
          position: absolute;
          width: 64px;
          height: 64px;
          border-radius: 50%;
          background: rgba(99, 102, 241, 0.18);
          animation: pulseGlow 1.6s infinite;
          z-index: 1;
        }
        .pickup-marker {
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          border-radius: 50%;
          background: white;
          box-shadow: 0 0 8px rgba(0, 0, 0, 0.08);
        }
        @keyframes pulseGlow {
          0% {
            transform: scale(0.8);
            opacity: 0.8;
          }
          70% {
            transform: scale(1.6);
            opacity: 0.05;
          }
          100% {
            transform: scale(0.8);
            opacity: 0.8;
          }
        }
      `}</style>
    </div>
  );
}
