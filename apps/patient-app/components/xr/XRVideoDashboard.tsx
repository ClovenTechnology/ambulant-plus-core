// apps/patient-app/components/xr/XRVideoDashboard.tsx
'use client';

import React, { forwardRef, useEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useController } from '@react-three/xr';
import * as THREE from 'three';
import XRVideoPlane from './XRVideoPlane';

type Props = {
  deviceId?: string;
  videoSrc?: string;
  position?: [number, number, number]; // world default
  width?: number;
};

function setSRGBColorSpace(tex: THREE.Texture | null) {
  if (!tex) return;
  // @ts-ignore
  const anyTHREE = THREE as any;
  try {
    if ('colorSpace' in tex) {
      tex.colorSpace = anyTHREE.SRGBColorSpace ?? anyTHREE.sRGBEncoding ?? tex.colorSpace;
    } else {
      tex.encoding = anyTHREE.sRGBEncoding ?? tex.encoding;
    }
  } catch {}
}

/**
 * Small helper to create a simple label texture (canvas)
 */
function createLabelTexture(text: string) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = '#fff';
  ctx.font = '36px "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, c.width / 2, c.height / 2);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  setSRGBColorSpace(tex);
  return tex;
}

/**
 * XRVideoDashboard
 *
 * - Default position purposely low (y ~1.5) so it appears in 2D screenshots
 * - Has an outline frame + label so it is visible from far away
 * - Has a small grab handle mesh you can point/grab with controllers
 * - Keeps a localTransform (position/quaternion/scale) state so it can be pinned
 */
const XRVideoDashboard = forwardRef<THREE.Group | null, Props>(function XRVideoDashboard(
  { deviceId = 'mock-device', videoSrc, position = [0.9, 1.5, -0.85], width = 1.0 },
  ref
) {
  // refs
  const groupRef = useRef<THREE.Group | null>(null);
  const handleRef = useRef<THREE.Mesh | null>(null);

  // controllers
  const left = useController('left');
  const right = useController('right');

  // local transform state (independent of group world transform)
  // store as THREE.Object3D-like values so we can apply them to the group
  const localPos = useRef(new THREE.Vector3(...position));
  const localQuat = useRef(new THREE.Quaternion());
  const localScale = useRef(new THREE.Vector3(1, 1, 1));
  const [pinned, setPinned] = useState(false);

  // grabbing state
  const grabbing = useRef<{ hand: 'left' | 'right' | null; offset?: THREE.Vector3 } | null>(null);

  // label texture
  const labelTexRef = useRef<THREE.CanvasTexture | null>(null);
  useEffect(() => {
    labelTexRef.current = createLabelTexture('XR Dashboard');
    return () => {
      try { labelTexRef.current?.dispose(); } catch {}
    };
  }, []);

  // We print position periodically (not every frame) to avoid console spam.
  const lastDebugAt = useRef(0);
  const { camera } = useThree();

  useFrame((_, delta) => {
    // If grabbed and not pinned, drive localPos from controller
    if (grabbing.current && !pinned) {
      const hand = grabbing.current.hand;
      const ctrl = hand === 'left' ? left?.controller : right?.controller;
      if (ctrl && ctrl.position) {
        // world controller position
        const ctrlWorld = new THREE.Vector3();
        ctrl.getWorldPosition ? ctrl.getWorldPosition(ctrlWorld) : ctrl.getWorldPosition?.(ctrlWorld);
        // apply offset in world space (offset was localGroupWorld - ctrlWorld)
        const targetWorld = ctrlWorld.clone().add(grabbing.current.offset ?? new THREE.Vector3());
        // convert targetWorld into local space relative to parent (or world)
        // If group has a parent, compute world->parent local conversion. Simpler: set group's world pos directly:
        if (groupRef.current) {
          groupRef.current.position.lerp(targetWorld, 0.55); // smooth follow
        }
      }
    }

    // apply local transform each frame (if not being moved by follow logic)
    if (groupRef.current) {
      // When pinned, apply localPos directly; when not pinned, keep group's position (we allow direct world-edit).
      if (pinned) {
        groupRef.current.position.copy(localPos.current);
        groupRef.current.quaternion.copy(localQuat.current);
        groupRef.current.scale.copy(localScale.current);
      } else {
        // ensure localPos tracks group's current world position when unpinned
        const wpos = new THREE.Vector3();
        groupRef.current.getWorldPosition(wpos);
        localPos.current.copy(wpos);
      }

      // periodic debug
      lastDebugAt.current += delta;
      if (lastDebugAt.current >= 0.5) {
        lastDebugAt.current = 0;
        const worldPos = new THREE.Vector3();
        const worldQuat = new THREE.Quaternion();
        groupRef.current.getWorldPosition(worldPos);
        groupRef.current.getWorldQuaternion(worldQuat);
        const camPos = new THREE.Vector3();
        camera.getWorldPosition(camPos);
        console.debug('[XR Dashboard DEBUG] panelWorldPos=', worldPos.toArray(), 'panelQuat=', [worldQuat.x, worldQuat.y, worldQuat.z, worldQuat.w], 'cameraWorldPos=', camPos.toArray());
      }
    }
  });

  // pointer handlers for the small handle (works for XR pointer events too when using controllers)
  function onHandlePointerDown(e: any) {
    e.stopPropagation();
    // Determine which hand attempted the grab via pointerType or controller association
    const hand = e.pointerType === 'xr-left' ? 'left' : e.pointerType === 'xr-right' ? 'right' : null;
    // fallback: prioritize left controller if available
    const chosenHand: 'left' | 'right' = hand === 'left' ? 'left' : hand === 'right' ? 'right' : left?.controller ? 'left' : 'right';
    const ctrl = chosenHand === 'left' ? left?.controller : right?.controller;
    if (!ctrl || !groupRef.current) return;

    // compute offset: worldPanelPos - controllerPos
    const panelWorld = new THREE.Vector3();
    groupRef.current.getWorldPosition(panelWorld);
    const ctrlWorld = new THREE.Vector3();
    ctrl.getWorldPosition ? ctrl.getWorldPosition(ctrlWorld) : (ctrlWorld.copy(ctrl.position) as any);
    const offset = new THREE.Vector3().subVectors(panelWorld, ctrlWorld);

    grabbing.current = { hand: chosenHand, offset };
    // if pinned — allow grabbing to temporarily drag but keep pinned = false while dragging
    if (pinned) {
      // unpin during drag so the user can reposition; re-pin on release if they toggle pin
      // (we don't auto-toggle pinned here)
    }
  }

  function onHandlePointerUp(e: any) {
    e.stopPropagation();
    grabbing.current = null;
    // ensure we update localPos to current world position so pin toggles don't jump
    if (groupRef.current) {
      const wpos = new THREE.Vector3();
      groupRef.current.getWorldPosition(wpos);
      localPos.current.copy(wpos);
      const wquat = new THREE.Quaternion();
      groupRef.current.getWorldQuaternion(wquat);
      localQuat.current.copy(wquat);
    }
  }

  // simple visual sizes
  const panelWidth = width;
  const panelHeight = (width * 9) / 16;
  const outlinePad = 0.04;

  return (
    <group
      ref={(g) => {
        groupRef.current = g ?? null;
        // allow parent components to get the group ref if they want
        if (typeof ref === 'function') (ref as any)(g);
        else if (ref && typeof (ref as any) === 'object') (ref as any).current = g;
      }}
      position={position}
      // rotation a little so panel faces camera nicely (keeps visible in 2D)
      rotation={[0, -0.18, 0]}
    >
      {/* frame / outline (visible from far away) */}
      <mesh position={[0, 0, -0.01]}>
        <planeGeometry args={[panelWidth + outlinePad * 2, panelHeight + outlinePad * 2]} />
        <meshBasicMaterial
          color={'#ff5d5d'}
          transparent
          opacity={0.85}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* inner dark backing */}
      <mesh position={[0, 0, -0.02]}>
        <planeGeometry args={[panelWidth, panelHeight]} />
        <meshStandardMaterial color="#080808" metalness={0.1} roughness={0.9} />
      </mesh>

      {/* Label (top-left small plane) */}
      <mesh position={[-panelWidth * 0.45, panelHeight * 0.48 + 0.03, -0.005]}>
        <planeGeometry args={[0.5, 0.12]} />
        <meshBasicMaterial map={labelTexRef.current ?? null} transparent />
      </mesh>

      {/* grab handle — small tall rectangle above the panel */}
      <mesh
        ref={handleRef}
        position={[0, panelHeight * 0.55 + 0.06, 0]}
        onPointerDown={onHandlePointerDown}
        onPointerUp={onHandlePointerUp}
        onPointerOut={onHandlePointerUp}
        onPointerCancel={onHandlePointerUp}
      >
        <boxGeometry args={[0.18, 0.06, 0.02]} />
        <meshStandardMaterial color={pinned ? '#f59e0b' : '#06b6d4'} metalness={0.2} roughness={0.6} />
      </mesh>

      {/* pin/unpin indicator — small circle to the right */}
      <mesh
        position={[panelWidth * 0.45, panelHeight * 0.48 + 0.03, -0.005]}
        onClick={(e: any) => {
          e.stopPropagation();
          setPinned((p) => !p);
          // if toggling to pinned, capture current transform
          if (groupRef.current) {
            const wp = new THREE.Vector3();
            groupRef.current.getWorldPosition(wp);
            localPos.current.copy(wp);
            const wq = new THREE.Quaternion();
            groupRef.current.getWorldQuaternion(wq);
            localQuat.current.copy(wq);
          }
        }}
      >
        <circleGeometry args={[0.04, 24]} />
        <meshStandardMaterial color={pinned ? '#10b981' : '#9ca3af'} />
      </mesh>

      {/* video plane inside the dashboard */}
      <group position={[0, 0, 0]}>
        {/* Place the video plane slightly in front so the frame is visible */}
        <XRVideoPlane deviceId={deviceId} videoSrc={videoSrc} position={[0, 0, 0.001]} width={panelWidth * 0.95} />
      </group>
    </group>
  );
});

export default XRVideoDashboard;
