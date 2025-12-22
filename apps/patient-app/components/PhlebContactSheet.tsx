'use client';

import React from 'react';
import type { PhlebProfile } from './PhlebMap';

interface PhlebContactSheetProps {
  open: boolean;
  onClose: () => void;
  phleb: PhlebProfile | null;
}

export default function PhlebContactSheet({
  open,
  onClose,
  phleb,
}: PhlebContactSheetProps) {
  if (!open) return null;
  const p = phleb || {};

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black opacity-50"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="relative w-full max-w-md bg-white rounded-t-xl p-6 shadow-lg">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Contact phlebotomist</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-800 font-bold"
          >
            ✕
          </button>
        </div>

        <div className="flex items-center gap-4 mb-4">
          {p.avatar && (
            <img
              src={p.avatar}
              alt={p.name || 'Phlebotomist'}
              className="w-12 h-12 rounded-full object-cover"
            />
          )}
          <div>
            <div className="font-medium">{p.name ?? 'Phlebotomist'}</div>
            <div className="text-sm text-gray-500">
              {p.labName || p.vehicle || 'MedReach network'}
            </div>
            {typeof p.rating === 'number' && (
              <div className="text-xs text-yellow-600 mt-0.5">
                ★ {p.rating.toFixed(1)}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2 text-sm">
          {p.phoneMasked && (
            <a
              href={p.phone ? `tel:${p.phone}` : undefined}
              className="block text-indigo-600 hover:underline"
            >
              📞 {p.phoneMasked}
            </a>
          )}
          {p.regPlate && <div>🚗 Plate: {p.regPlate}</div>}
          {typeof p.visitsCount === 'number' && (
            <div>🧪 Home visits: {p.visitsCount}</div>
          )}
        </div>
      </div>
    </div>
  );
}
