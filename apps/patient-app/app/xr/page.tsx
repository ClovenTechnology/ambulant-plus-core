// apps/patient-app/app/xr/page.tsx
'use client';

import React from 'react';
import { Canvas } from '@react-three/fiber';
import { XR, Hands } from '@react-three/xr';
import * as THREE from 'three';
import XRScene from '@/components/xr/XRScene';
import { XRProvider, useXR } from '@/components/xr/XRContext';
import XRPanel from '@/components/xr/XRPanel';

// small client wrapper that reads videoSrc from XR context and passes to XRPanel
function XRInner() {
  const { videoSrc } = useXR();

  return (
    <div className="fixed inset-0 z-[1000] bg-black">
      <div className="absolute inset-x-0 top-0 z-[1001] p-2 flex items-center justify-between">
        <div className="text-white/80 text-sm font-medium select-none">XR Sandbox</div>
        {/* XRPanel expects onExit prop; we provide no-op here — parent route should navigate away on exit */}
        <XRPanel videoTrack={null} onExit={() => {
          // dispatch cleanup and log
          try { window.dispatchEvent(new Event('xr-exit')); } catch {}
          // no route change here; developer can wire navigation if desired
        }} />
      </div>

      <Canvas shadows camera={{ position: [0, 1.6, 3], fov: 60 }}>
        <XR>
          <ambientLight intensity={0.6} />
          <directionalLight position={[3, 6, 3]} intensity={0.9} />
          <Hands />
          <XRScene videoSrc={videoSrc ?? undefined} />
        </XR>
      </Canvas>
    </div>
  );
}

export default function XRPage() {
  return (
    <XRProvider>
      <XRInner />
    </XRProvider>
  );
}
