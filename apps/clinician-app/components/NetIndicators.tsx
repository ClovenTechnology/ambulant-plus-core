import React from 'react';
import type { ConnectionQuality } from 'livekit-client';

/**
 * Session/connection state pill used across clinician views.
 */
export function StatePill({
  state,
  className,
}: {
  state: 'disconnected' | 'connecting' | 'connected' | 'reconnecting';
  className?: string;
}) {
  const classes = {
    disconnected: 'bg-gray-200 text-gray-700',
    connecting:   'bg-amber-100 text-amber-800',
    reconnecting: 'bg-amber-100 text-amber-800',
    connected:    'bg-emerald-100 text-emerald-800',
  } as const;

  const dot =
    state === 'connected' ? 'bg-emerald-600'
    : state === 'connecting' || state === 'reconnecting' ? 'bg-amber-500'
    : 'bg-gray-500';

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${classes[state]} ${className || ''}`}>
      <span className={`inline-block h-2 w-2 rounded-full ${dot}`} />
      {state}
    </span>
  );
}

/**
 * 0–5 bar connection quality indicator compatible with LiveKit's ConnectionQuality.
 */
function qualityToBars(quality?: ConnectionQuality) {
  if (quality == null) return 0;

  const normalized = String(quality).toLowerCase();

  if (normalized === 'excellent') return 5;
  if (normalized === 'good') return 4;
  if (normalized === 'poor') return 2;
  if (normalized === 'lost' || normalized === 'unknown') return 0;

  return 0;
}

/**
 * 0–5 bar connection quality indicator compatible with LiveKit's ConnectionQuality.
 */
export function QualityBars({
  quality,
  className,
  title = 'Connection quality',
}: {
  quality?: ConnectionQuality;
  className?: string;
  title?: string;
}) {
  const n = qualityToBars(quality);

  return (
    <div className={`flex items-end gap-0.5 ${className || ''}`} title={`${title}: ${quality ?? 'n/a'}`} aria-label={title}>
      {[1, 2, 3, 4, 5].map(i => (
        <div
          key={i}
          className={`w-1.5 ${i <= n ? 'bg-emerald-600' : 'bg-gray-300'} rounded`}
          style={{ height: `${4 + i * 3}px` }}
        />
      ))}
    </div>
  );
}
