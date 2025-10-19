// apps/patient-app/components/xr/XRScene.tsx
'use client';

import React, { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useXREvent } from '@react-three/xr';
import * as THREE from 'three';
import XRVideoPlane from './XRVideoPlane';
import XRDashboard from './XRVideoDashboard'; // ensure file name matches component

export default function XRScene({ videoSrc }: { videoSrc?: string }) {
  // Root group so we can move the world on teleport (keeps camera stable)
  const rootRef = useRef<THREE.Group | null>(null);

  // Ensure dashboard is placed in front of camera on mount for 2D testing.
  const dashboardDefaultPos = useRef<THREE.Vector3>(new THREE.Vector3(0.9, 1.5, -0.85));
  const dashboardDefaultScale = useRef<number>(1.05); // slightly larger so it's obvious in 2D

  useEffect(() => {
    // debug marker
    console.info('[XRScene] mounted - dashboard default pos', dashboardDefaultPos.current.toArray());
  }, []);

  // Listen for a global cleanup event (dispatched by XRPanel on exit)
  useEffect(() => {
    const onExit = () => {
      // components will cleanup themselves; placeholder in case we add extra global cleanup.
    };
    window.addEventListener('xr-exit', onExit);
    return () => window.removeEventListener('xr-exit', onExit);
  }, []);

  return (
    <group ref={rootRef}>
      <Ground rootRef={rootRef} />

      {/* Main content: video plane in the center */}
      <group position={[0, 1.6, -1]}>
        <XRVideoPlane videoSrc={videoSrc} width={1.6} />
      </group>

      {/* Dashboard: forced visible position & scale for 2D testing */}
      <group
        // use the default vector so it's definitely in-front/right of the video
        position={dashboardDefaultPos.current.toArray() as [number, number, number]}
        scale={[dashboardDefaultScale.current, dashboardDefaultScale.current, dashboardDefaultScale.current]}
        rotation={[0, -0.18, 0]}
      >
        {/* pass the videoSrc so the dashboard can show related info if needed */}
        <XRDashboard deviceId={'mock-device'} videoSrc={videoSrc} width={1.0} />
      </group>

      {/* Example objects to interact with */}
      <ExampleCubes />
    </group>
  );
}

/** Ground: accepts teleport rays and moves root so camera ends up at target */
function Ground({ rootRef }: { rootRef: React.RefObject<THREE.Group | null> }) {
  const meshRef = useRef<THREE.Mesh | null>(null);

  useXREvent('select', (event: any) => {
    const intersection = event.intersections?.[0] ?? event.intersection ?? event.detail?.intersection;
    const point = intersection?.point ?? event.point ?? null;
    if (!point || !rootRef.current) return;

    const camWorld = new THREE.Vector3();
    try {
      if (event.camera && typeof event.camera.getWorldPosition === 'function') {
        event.camera.getWorldPosition(camWorld);
      } else return;
    } catch {
      return;
    }

    const delta = new THREE.Vector3().subVectors(point, camWorld);
    rootRef.current.position.sub(delta);
  });

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[50, 50]} />
      <meshStandardMaterial color="#0f0f10" roughness={1} metalness={0} />
    </mesh>
  );
}

/** Example cubes to test grab + pinch */
function ExampleCubes() {
  const count = 4;
  return (
    <group>
      {Array.from({ length: count }).map((_, i) => (
        <GrabbableBox key={i} position={[i - 1.5, 1.2, -2.2]} color={new THREE.Color(`hsl(${i * 70},80%,60%)`)} />
      ))}
    </group>
  );
}

function GrabbableBox({ position = [0, 1, -2], color }: { position?: [number, number, number]; color?: THREE.Color }) {
  const meshRef = useRef<THREE.Mesh | null>(null);
  const grabbingRef = useRef(false);
  const offsetRef = useRef<THREE.Vector3 | null>(null);
  const controllerRef = useRef<any>(null);

  useFrame(() => {
    if (!grabbingRef.current || !meshRef.current || !controllerRef.current) return;
    const ctrlObj: THREE.Object3D = controllerRef.current.controller ?? controllerRef.current;
    if (!ctrlObj) return;

    const target = new THREE.Vector3();
    ctrlObj.getWorldPosition(target);

    if (!offsetRef.current) {
      const meshWorld = new THREE.Vector3();
      meshRef.current.getWorldPosition(meshWorld);
      offsetRef.current = new THREE.Vector3().subVectors(meshWorld, target);
    }

    const wanted = target.clone().add(offsetRef.current);
    meshRef.current.position.lerp(wanted, 0.6);
    meshRef.current.quaternion.slerp(ctrlObj.quaternion, 0.3);
  });

  useXREvent('selectstart', (event: any) => {
    const ctrl = event.controller ?? event;
    if (!meshRef.current || !ctrl?.position) return;
    const distance = meshRef.current.position.distanceTo(ctrl.position);
    if (distance < 0.6) {
      grabbingRef.current = true;
      controllerRef.current = ctrl;
      offsetRef.current = null;
    }
  });

  useXREvent('selectend', () => {
    grabbingRef.current = false;
    controllerRef.current = null;
    offsetRef.current = null;
  });

  return (
    <mesh ref={meshRef} position={position} castShadow>
      <boxGeometry args={[0.35, 0.35, 0.35]} />
      <meshStandardMaterial color={color ?? '#ff8'} />
    </mesh>
  );
}
