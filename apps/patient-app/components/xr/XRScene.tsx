'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import XRVideoPlane from '@components/xr/XRVideoPlane';
import type { TrackReferenceOrPlaceholder } from '@livekit/components-react';

export default function XRScene({ videoTrack }: { videoTrack: TrackReferenceOrPlaceholder | null }) {
  const floorRef = useRef<THREE.Mesh>(null);

  const floorMat = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#222') });
    mat.roughness = 1;
    mat.metalness = 0;
    return mat;
  }, []);

  useFrame(() => {
    if (floorRef.current) {
      const t = performance.now() * 0.001;
      (floorRef.current.material as THREE.MeshStandardMaterial).emissive =
        new THREE.Color().setScalar(0.03 + Math.sin(t * 0.5) * 0.02);
    }
  });

  return (
    <>
      <mesh ref={floorRef} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[8, 60]} />
        <meshStandardMaterial />
      </mesh>

      <gridHelper args={[16, 32, 0x555555, 0x2a2a2a]} position={[0, 0.001, 0]} />

      <group position={[0, 1.6, -2]}>
        <XRVideoPlane
          track={videoTrack}
          initialWidth={1.6}
          fallbackVideoUrl="/videos/demo.mp4"
        />
      </group>
    </>
  );
}
