// apps/patient-app/components/ContactSheet.tsx
'use client';

import React from 'react';
import { RiderProfile } from '@/app/careport/track/page';

interface ContactSheetProps {
  open: boolean;
  onClose: () => void;
  rider: RiderProfile;
}

export default function ContactSheet({ open, onClose, rider }: ContactSheetProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black opacity-50"
        onClick={onClose}
      ></div>

      {/* Sheet */}
      <div className="relative w-full max-w-md bg-white rounded-t-xl p-6 shadow-lg">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Contact Rider</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-800 font-bold"
          >
            ✕
          </button>
        </div>

        <div className="flex items-center gap-4 mb-4">
          {rider.avatar && (
            <img
              src={rider.avatar}
              alt={rider.name}
              className="w-12 h-12 rounded-full object-cover"
            />
          )}
          <div>
            <div className="font-medium">{rider.name}</div>
            <div className="text-sm text-gray-500">{rider.vehicle}</div>
          </div>
        </div>

        <div className="space-y-2">
          {rider.phoneMasked && (
            <a
              href={`tel:${rider.phone || ''}`}
              className="block text-blue-600 hover:underline"
            >
              📞 {rider.phoneMasked}
            </a>
          )}
          {rider.regPlate && <div>🛵 Plate: {rider.regPlate}</div>}
          {rider.tripsCount !== undefined && <div>📦 Trips: {rider.tripsCount}</div>}
        </div>
      </div>
    </div>
  );
}
