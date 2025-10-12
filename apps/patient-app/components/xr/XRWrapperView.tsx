'use client';

import dynamic from 'next/dynamic';
import type { TrackReferenceOrPlaceholder } from '@livekit/components-react';

const XRPanel = dynamic(() => import('./XRPanel'), { ssr: false });

export default function XRWrapperView({
  videoTrack,
  onExit,
}: {
  videoTrack?: TrackReferenceOrPlaceholder | null;
  onExit: () => void;
}) {
  return <XRPanel videoTrack={videoTrack ?? null} onExit={onExit} />;
}
