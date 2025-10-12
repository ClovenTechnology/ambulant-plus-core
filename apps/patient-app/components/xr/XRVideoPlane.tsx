'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Interactive, useController } from '@react-three/xr';
import { useFrame } from '@react-three/fiber';
import type { TrackReferenceOrPlaceholder } from '@livekit/components-react';

type Props = {
  track: TrackReferenceOrPlaceholder | null;
  initialWidth?: number;
  fallbackVideoUrl?: string;
};

export default function XRVideoPlane({ track, initialWidth = 1.6, fallbackVideoUrl }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoReady, setVideoReady] = useState(false);
  const [videoAR, setVideoAR] = useState(16 / 9);

  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const [grabbed, setGrabbed] = useState(false);
  const [scale, setScale] = useState(1);

  const rightController = useController('right');
  const leftController = useController('left');
  const dragStartOffset = useRef<THREE.Vector3 | null>(null);
  const grabController = useRef<'left' | 'right' | null>(null);

  useEffect(() => {
    const v = document.createElement('video');
    v.muted = true;
    v.playsInline = true;
    v.autoplay = true;
    v.loop = true;
    videoRef.current = v;

    let detach: (() => void) | null = null;

    (async () => {
      try {
        const pub: any = (track as any)?.publication;
        if (pub?.videoTrack && typeof pub.videoTrack.attach === 'function') {
          pub.videoTrack.attach(v);
          detach = () => { try { pub.videoTrack?.detach(v); } catch {} };
        } else if (fallbackVideoUrl) {
          v.src = fallbackVideoUrl;
          await v.play().catch(() => {});
        }
        const onLoaded = () => {
          const ar = v.videoWidth && v.videoHeight ? v.videoWidth / v.videoHeight : 16 / 9;
          setVideoAR(ar || 16/9);
          setVideoReady(true);
        };
        v.addEventListener('loadedmetadata', onLoaded);
        v.addEventListener('loadeddata', onLoaded);
      } catch {}
    })();

    return () => {
      if (detach) detach();
      try { v.pause(); } catch {}
      videoRef.current = null;
    };
  }, [track, fallbackVideoUrl]);

  const texture = useMemo(() => {
    if (!videoReady || !videoRef.current) return null;
    const tex = new THREE.VideoTexture(videoRef.current);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  }, [videoReady]);

  const width = initialWidth * scale;
  const height = useMemo(() => width / (videoAR || 16/9), [width, videoAR]);

  useFrame(() => {
    if (!grabbed || !meshRef.current) return;
    const ctrl = grabController.current === 'right' ? rightController : leftController;
    if (!ctrl || !ctrl.controller) return;

    const controllerObj = ctrl.controller;
    const targetPos = controllerObj.position.clone();
    const forward = new THREE.Vector3(0, 0, -0.5).applyQuaternion(controllerObj.quaternion);
    targetPos.add(forward);

    if (!dragStartOffset.current) {
      const cur = meshRef.current.position.clone();
      dragStartOffset.current = cur.sub(targetPos);
    }
    const offset = dragStartOffset.current.clone();
    const newPos = targetPos.add(offset);
    meshRef.current.position.lerp(newPos, 0.6);
    meshRef.current.quaternion.slerp(controllerObj.quaternion, 0.5);
  });

  return (
    <Interactive
      onHover={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      onSelect={() => {
        const v = videoRef.current;
        if (v) {
          if (v.paused) v.play().catch(() => {});
          else v.pause();
        } else if (meshRef.current) {
          meshRef.current.position.z -= 0.15;
        }
      }}
      onSelectStart={(e) => {
        setGrabbed(true);
        const handed = (e as any).controller?.inputSource?.handedness as 'left' | 'right' | undefined;
        grabController.current = handed || 'right';
        dragStartOffset.current = null;
      }}
      onSelectEnd={() => {
        setGrabbed(false);
        grabController.current = null;
        dragStartOffset.current = null;
      }}
      onSqueeze={() => setScale(s => Math.min(2.5, Math.max(0.5, s + 0.15)))}
    >
      <mesh ref={meshRef} position={[0, 0, 0]} castShadow>
        <planeGeometry args={[width, height, 1, 1]} />
        <meshStandardMaterial
          map={texture || undefined}
          color="#ffffff"
          roughness={0.7}
          metalness={0}
          emissive={hovered ? new THREE.Color(0.08, 0.1, 0.12) : new THREE.Color(0, 0, 0)}
          emissiveIntensity={hovered ? 1.2 : 0.0}
        />
        <mesh position={[0, 0, -0.001]}>
          <planeGeometry args={[width + 0.02, height + 0.02]} />
          <meshBasicMaterial color={hovered ? '#58a6ff' : '#1f2937'} transparent opacity={0.35} />
        </mesh>
      </mesh>
    </Interactive>
  );
}
