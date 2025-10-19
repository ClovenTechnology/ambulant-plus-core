// apps/patient-app/components/xr/XRPanel.tsx
'use client';

import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { XR } from '@react-three/xr';
import XRScene from '@/components/xr/XRScene';
import type { TrackReferenceOrPlaceholder } from '@livekit/components-react';

type Props = {
  videoTrack?: TrackReferenceOrPlaceholder | null;
  onExit: () => void;
};

export default function XRPanel({ videoTrack, onExit }: Props) {
  return (
    <div className="fixed inset-0 z-[1000] bg-black">
      <div className="absolute inset-x-0 top-0 z-[1001] p-2 flex items-center justify-between">
        <div className="text-white/80 text-sm font-medium select-none">
          XR Scene — {videoTrack ? 'Live video mapped' : 'Preview (no session)'}
        </div>
        <button
          onClick={() => {
            // tell any XR components to cleanup (textures, video)
            try {
              window.dispatchEvent(new Event('xr-exit'));
            } catch {}
            // call parent callback so app layer hides the panel / routes back
            onExit();
          }}
          className="px-3 py-1.5 rounded-full bg-white/90 text-gray-900 shadow border text-sm hover:bg-white"
          aria-label="Exit XR"
          title="Exit XR"
        >
          Exit XR
        </button>
      </div>

      <Canvas camera={{ position: [0, 1.6, 2.8], fov: 60 }}>
        <XR>
          <ambientLight intensity={0.6} />
          <directionalLight position={[3, 3, 3]} intensity={0.6} />
          <Suspense fallback={null}>
            <XRScene videoSrc={videoTrack ? undefined : undefined} />
          </Suspense>
        </XR>
      </Canvas>
    </div>
  );
}
