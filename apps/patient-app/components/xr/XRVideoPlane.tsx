// apps/patient-app/components/xr/XRVideoPlane.tsx
'use client';

import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  MutableRefObject,
} from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useController } from '@react-three/xr';
import * as THREE from 'three';
import { useVitalsSSE } from '@/lib/useVitalsSSE';

type Props = {
  deviceId?: string;
  videoSrc?: string;
  position?: [number, number, number];
  width?: number;
  followInitial?: boolean;
};

/** Compat helper: set sRGB / colorSpace on textures (works across three versions) */
function setSRGBColorSpace(tex: THREE.Texture | null) {
  if (!tex) return;
  // @ts-ignore tolerate variable names across versions
  const anyTHREE = THREE as any;
  try {
    if ('colorSpace' in tex) {
      // r152+ uses colorSpace constants
      tex.colorSpace = anyTHREE.SRGBColorSpace ?? anyTHREE.sRGBEncoding ?? tex.colorSpace;
    } else {
      // older three uses encoding
      tex.encoding = anyTHREE.sRGBEncoding ?? tex.encoding;
    }
  } catch {
    // ignore
  }
}

/** Render an SVG onto canvas → CanvasTexture (HiDPI safe). Kept minimal from prior version. */
function createIconTextureFromSVG(kind: 'snap' | 'mute' | 'pause', label?: string, bg = '#1f6feb') {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;

  const w = 512;
  const h = 256;
  const centerX = w / 2;
  const centerY = h / 2 - 10;
  const iconFill = '#ffffff';
  const bgFill = bg;
  let iconSVG = '';
  if (kind === 'snap') {
    iconSVG = `<rect x="${centerX - 100}" y="${centerY - 44}" rx="6" ry="6" width="200" height="88" fill="${iconFill}" />
               <circle cx="${centerX}" cy="${centerY}" r="34" fill="rgba(0,0,0,0.18)"/> 
               <polygon points="${centerX + 160},${centerY - 28} ${centerX + 208},${centerY - 60} ${centerX + 208},${centerY + 60} ${centerX + 160},${centerY + 28}" fill="${iconFill}"/>`;
  } else if (kind === 'mute') {
    iconSVG = `<polygon points="${centerX - 176},${centerY - 64} ${centerX - 64},${centerY - 64} ${centerX + 18},${centerY - 124} ${centerX + 18},${centerY + 124} ${centerX - 64},${centerY + 64} ${centerX - 176},${centerY + 64}" fill="${iconFill}"/>
               <line x1="${centerX + 56}" y1="${centerY - 56}" x2="${centerX + 176}" y2="${centerY + 56}" stroke="rgba(0,0,0,0.85)" stroke-width="20" stroke-linecap="round"/>
               <line x1="${centerX + 176}" y1="${centerY - 56}" x2="${centerX + 56}" y2="${centerY + 56}" stroke="rgba(0,0,0,0.85)" stroke-width="20" stroke-linecap="round"/>`;
  } else {
    iconSVG = `<rect x="${centerX - 90}" y="${centerY - 86}" width="40" height="172" rx="6" fill="${iconFill}" />
               <rect x="${centerX - 10}" y="${centerY - 86}" width="40" height="172" rx="6" fill="${iconFill}" />`;
  }
  const labelSVG = label
    ? `<text x="${w / 2}" y="${h - 28}" font-family="Segoe UI, Roboto, sans-serif" font-size="28" text-anchor="middle" fill="rgba(255,255,255,0.95)">${label}</text>`
    : '';

  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'>
    <defs><linearGradient id="g" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${bgFill}" stop-opacity="1"/><stop offset="1" stop-color="${bgFill}" stop-opacity="0.92"/></linearGradient></defs>
    <rect width="${w}" height="${h}" rx="16" fill="url(#g)" />
    <rect width="${w}" height="${Math.floor(h * 0.4)}" fill="rgba(255,255,255,0.06)"/>
    ${iconSVG}
    ${labelSVG}
  </svg>`;

  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    // HiDPI
    const ratio = Math.max(1, Math.floor(devicePixelRatio || 1));
    canvas.width = 512 * ratio;
    canvas.height = 256 * ratio;
    canvas.style.width = '512px';
    canvas.style.height = '256px';
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    tex.needsUpdate = true;
    setSRGBColorSpace(tex);
  };
  img.onerror = () => {
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';
    ctx.font = `${20 * (devicePixelRatio || 1)}px sans-serif`;
    ctx.fillText(label ?? kind, 20, canvas.height - 32);
    tex.needsUpdate = true;
    setSRGBColorSpace(tex);
  };
  img.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);

  return tex;
}

function createLabelTexture(text: string) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = '#fff';
  ctx.font = '18px "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, c.width / 2, c.height / 2);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  setSRGBColorSpace(tex);
  return tex;
}

const XRVideoPlane = forwardRef<THREE.Mesh | null, Props>(function XRVideoPlane(
  { deviceId = 'mock-device', videoSrc, position = [0, 1.6, -1], width = 1.6, followInitial = false },
  ref
) {
  const meshRef = useRef<THREE.Mesh | null>(null);
  useImperativeHandle(ref as MutableRefObject<THREE.Mesh | null> | ((m: THREE.Mesh | null) => void), () => meshRef.current, []);

  const left = useController('left');
  const right = useController('right');

  const grabState = useRef<{ left: boolean; right: boolean }>({ left: false, right: false });
  const grabOffset = useRef(new THREE.Vector3());
  const baseScale = useRef(1);
  const pinchStart = useRef<{ distance: number; scale: number } | null>(null);

  const [follow, setFollow] = useState(followInitial);
  const { camera } = useThree();

  const { last: vitals } = useVitalsSSE(deviceId);
  const targetHr = useRef(72);
  const targetSpO2 = useRef(98);
  const smoothHr = useRef(72);
  const smoothSpO2 = useRef(98);
  const [display, setDisplay] = useState({ hr: 72, spo2: 98 });

  useEffect(() => {
    if (!vitals) return;
    if (vitals.metric === 'hr') targetHr.current = Number(vitals.value);
    if (vitals.metric === 'spo2') targetSpO2.current = Number(vitals.value);
  }, [vitals]);

  // video element + texture (robust)
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const videoTexRef = useRef<THREE.VideoTexture | THREE.Texture | null>(null);
  const [muted, setMuted] = useState(true);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    let mounted = true;
    let cleanupFn: (() => void) | null = null;

    async function setup() {
      // dispose previous
      try { videoTexRef.current?.dispose(); } catch {}
      videoTexRef.current = null;

      console.debug('[XRVideoPlane] checking window.__XR_STREAM', (window as any).__XR_STREAM, 'videoSrc prop=', videoSrc);

      // 1) prefer explicit window stream
      const s = (window as any).__XR_STREAM as MediaStream | undefined;
      if (s && s.getVideoTracks && s.getVideoTracks().length > 0) {
        try {
          const v = document.createElement('video');
          v.autoplay = true;
          v.muted = true; // mute to allow autoplay
          v.playsInline = true;
          v.srcObject = s;
          videoElRef.current = v;
          v.play().catch(() => {});
          // wait for first frame before VideoTexture to avoid texImage2D invalid video
          const onCanPlay = () => {
            if (!mounted) return;
            try {
              const vt = new THREE.VideoTexture(v);
              vt.minFilter = THREE.LinearFilter;
              vt.magFilter = THREE.LinearFilter;
              vt.generateMipmaps = false;
              setSRGBColorSpace(vt);
              vt.needsUpdate = true;
              videoTexRef.current = vt;
              console.debug('[XRVideoPlane] created VideoTexture from __XR_STREAM');
            } catch (err) {
              console.warn('[XRVideoPlane] VideoTexture from stream failed', err);
            }
          };
          v.addEventListener('canplay', onCanPlay, { once: true });
          cleanupFn = () => { try { v.removeEventListener('canplay', onCanPlay); } catch {} };
          return;
        } catch (err) {
          console.warn('Failed to create video from __XR_STREAM', err);
        }
      }

      // 2) if videoSrc provided
      const tryVideoSrc = (src?: string|null) => {
        if (!src) return false;
        try {
          const v = document.createElement('video');
          v.src = src;
          v.autoplay = true;
          v.loop = true;
          v.muted = muted;
          v.playsInline = true;
          v.crossOrigin = 'anonymous';
          videoElRef.current = v;

          let created = false;
          const onLoaded = () => {
            if (!mounted || created) return;
            try {
              const vt = new THREE.VideoTexture(v);
              vt.minFilter = THREE.LinearFilter;
              vt.magFilter = THREE.LinearFilter;
              vt.generateMipmaps = false;
              setSRGBColorSpace(vt);
              vt.needsUpdate = true;
              videoTexRef.current = vt;
              created = true;
              console.debug('[XRVideoPlane] created VideoTexture from src=', src);
            } catch (err) {
              console.warn('[XRVideoPlane] VideoTexture create error, will fallback', err);
            }
          };
          const onError = () => {
            // allow fallback
            console.warn('[XRVideoPlane] video element error for', src);
          };

          if (v.readyState >= 2) {
            onLoaded();
          } else {
            v.addEventListener('loadeddata', onLoaded, { once: true });
            v.addEventListener('error', onError, { once: true });
            v.play().catch(() => {});
            cleanupFn = () => {
              try { v.removeEventListener('loadeddata', onLoaded); } catch {}
              try { v.removeEventListener('error', onError); } catch {}
            };
          }
          return true;
        } catch (err) {
          console.warn('video src attempt failed', err);
          return false;
        }
      };

      if (videoSrc && tryVideoSrc(videoSrc)) return;

      // 3) try packaged demo video path (your file: public/videos/demo.mp4)
      if (tryVideoSrc('/videos/demo.mp4')) return;

      // 4) final fallback: static image (mock)
      try {
        const tex = new THREE.TextureLoader().load('/mock-video.jpg', (t) => {
          setSRGBColorSpace(t);
          t.needsUpdate = true;
          console.debug('[XRVideoPlane] loaded fallback mock image');
        }, undefined, (err) => {
          console.warn('[XRVideoPlane] mock image load failed', err);
        });
        videoTexRef.current = tex;
        return;
      } catch (err) {
        console.warn('[XRVideoPlane] final fallback failed', err);
      }
    }

    setup();

    return () => {
      mounted = false;
      try { cleanupFn && cleanupFn(); } catch {}
      try {
        if (videoElRef.current) {
          videoElRef.current.pause();
          try { (videoElRef.current as any).srcObject = null; } catch {}
          videoElRef.current.src = '';
          (videoElRef.current as any).load?.();
        }
      } catch {}
      try { videoTexRef.current?.dispose(); } catch {}
      videoTexRef.current = null;
    };
    // include videoSrc and muted so re-create occurs if they change
  }, [videoSrc, muted]);

  // vitals canvas texture (semi-transparent)
  const vitalsCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const vitalsTexRef = useRef<THREE.CanvasTexture | null>(null);
  useEffect(() => {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 256;
    vitalsCanvasRef.current = c;
    const tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    setSRGBColorSpace(tex);
    vitalsTexRef.current = tex;

    const ctx = c.getContext('2d')!;
    ctx.fillStyle = 'rgba(10,14,10,0.6)';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.font = '28px monospace';
    ctx.fillStyle = '#7efc7e';
    ctx.fillText('HR: 72 bpm', 24, 36);
    ctx.fillText('SpO2: 98%', 24, 76);
    tex.needsUpdate = true;

    return () => {
      try { vitalsTexRef.current?.dispose(); } catch {}
    };
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setDisplay({ hr: Math.round(smoothHr.current), spo2: Math.round(smoothSpO2.current) });
    }, 200);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const c = vitalsCanvasRef.current;
    const t = vitalsTexRef.current;
    if (!c || !t) return;
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, c.width, c.height);

    const g = ctx.createLinearGradient(0, 0, c.width, c.height);
    g.addColorStop(0, 'rgba(6,12,8,0.85)');
    g.addColorStop(1, 'rgba(12,18,14,0.45)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, c.width, c.height);

    ctx.fillStyle = 'rgba(126,252,126,0.06)';
    ctx.fillRect(0, 0, c.width, 56);

    ctx.font = '30px "Segoe UI", Roboto, monospace';
    ctx.fillStyle = '#7efc7e';
    ctx.fillText(`HR: ${display.hr} bpm`, 24, 34);
    ctx.fillText(`SpO2: ${display.spo2}%`, 24, 70);

    ctx.font = '14px monospace';
    ctx.fillStyle = 'rgba(189,223,255,0.75)';
    ctx.fillText(new Date().toLocaleTimeString(), 24, c.height - 28);

    t.needsUpdate = true;
  }, [display.hr, display.spo2]);

  // button textures (same as before)
  const snapTex = useRef<THREE.CanvasTexture | null>(null);
  const muteTex = useRef<THREE.CanvasTexture | null>(null);
  const pauseTex = useRef<THREE.CanvasTexture | null>(null);
  const labelSnap = useRef<THREE.CanvasTexture | null>(null);
  const labelMute = useRef<THREE.CanvasTexture | null>(null);
  const labelPause = useRef<THREE.CanvasTexture | null>(null);
  useEffect(() => {
    snapTex.current = createIconTextureFromSVG('snap', undefined, '#115eab');
    muteTex.current = createIconTextureFromSVG('mute', muted ? 'off' : 'on', muted ? '#6b7280' : '#138a3b');
    pauseTex.current = createIconTextureFromSVG('pause', undefined, '#b45309');
    labelSnap.current = createLabelTexture('Snap (S)');
    labelMute.current = createLabelTexture('Mute (M)');
    labelPause.current = createLabelTexture('Pause (Space)');

    setSRGBColorSpace(snapTex.current);
    setSRGBColorSpace(muteTex.current);
    setSRGBColorSpace(pauseTex.current);
    setSRGBColorSpace(labelSnap.current);
    setSRGBColorSpace(labelMute.current);
    setSRGBColorSpace(labelPause.current);

    return () => {
      try {
        snapTex.current?.dispose();
        muteTex.current?.dispose();
        pauseTex.current?.dispose();
        labelSnap.current?.dispose();
        labelMute.current?.dispose();
        labelPause.current?.dispose();
      } catch {}
    };
  }, [muted, paused]);

  const hudTexRef = useRef<THREE.CanvasTexture | null>(null);
  useEffect(() => {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 128;
    const tex = new THREE.CanvasTexture(c);
    setSRGBColorSpace(tex);
    tex.needsUpdate = true;
    hudTexRef.current = tex;
    return () => {
      try { hudTexRef.current?.dispose(); } catch {}
    };
  }, []);

  const [hoveredButton, setHoveredButton] = useState<'snap' | 'mute' | 'pause' | null>(null);
  const [pressedButton, setPressedButton] = useState<'snap' | 'mute' | 'pause' | null>(null);
  const [controllerHover, setControllerHover] = useState<'snap' | 'mute' | 'pause' | null>(null);

  const snapToUser = () => {
    const m = meshRef.current;
    if (!m) return;
    const camPos = new THREE.Vector3();
    camera.getWorldPosition(camPos);
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    const target = camPos.clone().add(forward.multiplyScalar(0.8));
    target.y = Math.max(target.y, 1.2);
    m.position.copy(target);
    m.lookAt(camPos);
  };

  const toggleMute = () => {
    const v = videoElRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
    try {
      muteTex.current?.dispose();
      muteTex.current = createIconTextureFromSVG('mute', v.muted ? 'off' : 'on', v.muted ? '#6b7280' : '#138a3b');
      setSRGBColorSpace(muteTex.current);
    } catch {}
  };

  const togglePause = async () => {
    const v = videoElRef.current;
    if (!v) return;
    if (v.paused) {
      await v.play().catch(() => {});
      setPaused(false);
    } else {
      v.pause();
      setPaused(true);
    }
    try {
      pauseTex.current?.dispose();
      pauseTex.current = createIconTextureFromSVG('pause', undefined, '#b45309');
      setSRGBColorSpace(pauseTex.current);
    } catch {}
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 's' || e.key === 'S') snapToUser();
      if (e.key === 'm' || e.key === 'M') toggleMute();
      if (e.code === 'Space') {
        e.preventDefault();
        togglePause();
      }
      if (e.key === 'f' || e.key === 'F') setFollow((s) => !s);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [muted, paused]);

  function controllerTriggerPressed(ctrl: any) {
    try {
      if (!ctrl) return false;
      if (typeof ctrl.trigger?.pressed === 'boolean') return ctrl.trigger.pressed;
      if (ctrl.inputSource?.gamepad?.buttons && ctrl.inputSource.gamepad.buttons[0]) {
        return !!ctrl.inputSource.gamepad.buttons[0].pressed;
      }
      if (ctrl.controller && ctrl.controller.userData && ctrl.controller.userData.triggerPressed) {
        return !!ctrl.controller.userData.triggerPressed;
      }
    } catch {}
    return false;
  }

  function testControllerButtons(ctrl: any) {
    if (!ctrl || !ctrl.position) return null;
    const origin = ctrl.position.clone();
    const dir = new THREE.Vector3();
    try {
      if (ctrl.controller && typeof ctrl.controller.getWorldDirection === 'function') {
        ctrl.controller.getWorldDirection(dir);
      } else {
        dir.set(0, 0, -1).applyQuaternion(ctrl.quaternion ?? new THREE.Quaternion());
      }
    } catch {
      dir.set(0, 0, -1).applyQuaternion(ctrl.quaternion ?? new THREE.Quaternion());
    }
    const ray = new THREE.Ray(origin, dir);
    const height = (width * 9) / 16;
    const btnSpacing = 0.28;
    const btnY = position[1] - height * 0.55;
    const z = position[2] - 0.01;
    const centers = [
      { name: 'snap', pos: new THREE.Vector3(position[0] - btnSpacing, btnY, z) },
      { name: 'mute', pos: new THREE.Vector3(position[0], btnY, z) },
      { name: 'pause', pos: new THREE.Vector3(position[0] + btnSpacing, btnY, z) },
    ] as const;

    let pointed: 'snap' | 'mute' | 'pause' | null = null;
    centers.forEach((c) => {
      const d = ray.distanceToPoint(c.pos);
      if (d < 0.08) pointed = c.name;
    });

    if (pointed && controllerTriggerPressed(ctrl)) {
      if (pressedButton !== pointed) {
        setPressedButton(pointed);
        if (pointed === 'snap') snapToUser();
        if (pointed === 'mute') toggleMute();
        if (pointed === 'pause') togglePause();
        setTimeout(() => setPressedButton(null), 160);
      }
    }
    return pointed;
  }

  const glowTimer = useRef(0);
  useFrame(() => {
    smoothHr.current = THREE.MathUtils.lerp(smoothHr.current, targetHr.current, 0.06);
    smoothSpO2.current = THREE.MathUtils.lerp(smoothSpO2.current, targetSpO2.current, 0.06);

    if (videoTexRef.current instanceof THREE.VideoTexture) {
      // if the video element has no frames, this could throw - but we handled creation carefully.
      try { videoTexRef.current.needsUpdate = true; } catch {}
    }

    const m = meshRef.current;
    if (!m) return;

    if (follow) {
      const camPos = new THREE.Vector3();
      camera.getWorldPosition(camPos);
      const forward = new THREE.Vector3();
      camera.getWorldDirection(forward);
      const target = camPos.clone().add(forward.multiplyScalar(0.8));
      target.y = Math.max(target.y, 1.2);
      m.position.lerp(target, 0.15);
      m.lookAt(camPos);
    }

    const lObj = left?.controller;
    const rObj = right?.controller;
    if (lObj && rObj && grabState.current.left && grabState.current.right) {
      const dist = lObj.position.distanceTo(rObj.position);
      if (!pinchStart.current) pinchStart.current = { distance: dist, scale: baseScale.current };
      const ratio = dist / pinchStart.current.distance;
      const newScale = THREE.MathUtils.clamp(pinchStart.current.scale * ratio, 0.4, 3);
      m.scale.setScalar(newScale);
    } else if (pinchStart.current) {
      baseScale.current = m.scale.x;
      pinchStart.current = null;
    }

    (['left', 'right'] as const).forEach((hand) => {
      const ctrl = hand === 'left' ? left : right;
      if (!ctrl?.controller) return;
      if (grabState.current[hand]) {
        const ctrlObj = ctrl.controller;
        const target = ctrlObj.position.clone().add(grabOffset.current);
        m.position.lerp(target, 0.6);
        m.quaternion.slerp(ctrlObj.quaternion, 0.4);
      }
    });

    const hudTex = hudTexRef.current;
    if (hudTex) {
      const c = hudTex.image as HTMLCanvasElement;
      const ctx = c.getContext('2d')!;
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.fillStyle = '#fff';
      ctx.font = '18px "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`Muted: ${muted ? 'Yes' : 'No'}`, 12, 28);
      ctx.fillText(`Paused: ${paused ? 'Yes' : 'No'}`, 12, 56);
      ctx.fillStyle = '#7efc7e';
      ctx.fillText(`HR: ${Math.round(smoothHr.current)}`, 12, 92);
      ctx.fillText(`SpO2: ${Math.round(smoothSpO2.current)}%`, 128, 92);
      hudTex.needsUpdate = true;
    }

    const leftPointed = testControllerButtons(left?.controller ?? left);
    const rightPointed = testControllerButtons(right?.controller ?? right);
    setControllerHover(leftPointed ?? rightPointed ?? null);

    glowTimer.current += 0.06;
  });

  useEffect(() => {
    const onExit = () => {
      try { videoElRef.current?.pause(); if (videoElRef.current) videoElRef.current.src = ''; } catch {}
      try {
        videoTexRef.current?.dispose();
        vitalsTexRef.current?.dispose();
        snapTex.current?.dispose();
        muteTex.current?.dispose();
        pauseTex.current?.dispose();
        labelSnap.current?.dispose();
        labelMute.current?.dispose();
        labelPause.current?.dispose();
        hudTexRef.current?.dispose();
      } catch {}
    };
    window.addEventListener('xr-exit', onExit);
    return () => window.removeEventListener('xr-exit', onExit);
  }, []);

  const height = (width * 9) / 16;

  const btnSpacing = 0.28;
  const btnY = position[1] - height * 0.55;
  const z = position[2] - 0.01;

  function onButtonOver(kind: 'snap' | 'mute' | 'pause') { setHoveredButton(kind); }
  function onButtonOut() { setHoveredButton(null); setPressedButton(null); }
  function onButtonDown(kind: 'snap' | 'mute' | 'pause') { setPressedButton(kind); }
  function onButtonUp(kind: 'snap' | 'mute' | 'pause') { setPressedButton(null); if (kind === 'snap') snapToUser(); if (kind === 'mute') toggleMute(); if (kind === 'pause') togglePause(); }

  const isHovering = (kind: 'snap' | 'mute' | 'pause') => hoveredButton === kind || controllerHover === kind;
  const glowOpacity = (base: number) => 0.06 + Math.abs(Math.sin(performance.now() / 350)) * base;

  return (
    <>
      {/* Main video plane */}
      <mesh
        ref={(m) => (meshRef.current = m)}
        position={position}
        onPointerDown={(e: any) => {
          const hand = e.pointerType === 'xr-left' ? 'left' : 'right';
          grabState.current[hand] = true;
          const ctrl = hand === 'left' ? left?.controller : right?.controller;
          if (ctrl && meshRef.current) grabOffset.current = meshRef.current.position.clone().sub(ctrl.position);
        }}
        onPointerUp={(e: any) => {
          const hand = e.pointerType === 'xr-left' ? 'left' : 'right';
          grabState.current[hand] = false;
        }}
      >
        <planeGeometry args={[width, height]} />
        {videoTexRef.current ? (
          <meshBasicMaterial map={videoTexRef.current} toneMapped={false} />
        ) : (
          // safe fallback: dark material so plane isn't bright white
          <meshStandardMaterial color="#0b0b0b" metalness={0.1} roughness={0.8} side={THREE.DoubleSide} />
        )}
      </mesh>

      {/* subtle frame */}
      <mesh position={[position[0], position[1], position[2] - 0.002]}>
        <planeGeometry args={[width * 1.03, height * 1.03]} />
        <meshBasicMaterial transparent opacity={0.5} color={muted ? '#ffffff' : '#bdeeff'} blending={THREE.AdditiveBlending} />
      </mesh>

      {/* HUD (top-right) */}
      <mesh position={[position[0] + width * 0.42, position[1] + height * 0.42, position[2] - 0.001]}>
        <planeGeometry args={[0.42 * width, 0.12]} />
        <meshBasicMaterial map={hudTexRef.current ?? null} transparent />
      </mesh>

      {/* Vitals panel (above video) */}
      <mesh position={[position[0], position[1] + height / 1.12, position[2]]}>
        <planeGeometry args={[width * 0.9, 0.25]} />
        <meshBasicMaterial map={vitalsTexRef.current ?? null} transparent opacity={0.98} />
      </mesh>

      {/* Buttons: Snap / Mute / Pause */}
      {/* Snap */}
      <group>
        <mesh
          position={[position[0] - btnSpacing, btnY, z]}
          scale={isHovering('snap') ? (pressedButton === 'snap' ? 0.9 : 1.08) : 1.0}
          onPointerOver={() => onButtonOver('snap')}
          onPointerOut={() => onButtonOut()}
          onPointerDown={(e) => { e.stopPropagation(); onButtonDown('snap'); }}
          onPointerUp={(e) => { e.stopPropagation(); onButtonUp('snap'); }}
        >
          <planeGeometry args={[0.2, 0.09]} />
          <meshStandardMaterial map={snapTex.current ?? null} transparent />
        </mesh>
        <mesh position={[position[0] - btnSpacing, btnY + 0.11, z]}>
          <planeGeometry args={[0.22, 0.06]} />
          <meshBasicMaterial map={labelSnap.current ?? null} transparent />
        </mesh>
      </group>

      {/* Snap glow */}
      {controllerHover === 'snap' && (
        <mesh position={[position[0] - btnSpacing, btnY, z - 0.01]}>
          <planeGeometry args={[0.24, 0.11]} />
          <meshBasicMaterial color={'#60a5fa'} transparent opacity={glowOpacity(0.08)} />
        </mesh>
      )}

      {/* Mute */}
      <group>
        <mesh
          position={[position[0], btnY, z]}
          scale={isHovering('mute') ? (pressedButton === 'mute' ? 0.9 : 1.08) : 1.0}
          onPointerOver={() => onButtonOver('mute')}
          onPointerOut={() => onButtonOut()}
          onPointerDown={(e) => { e.stopPropagation(); onButtonDown('mute'); }}
          onPointerUp={(e) => { e.stopPropagation(); onButtonUp('mute'); }}
        >
          <planeGeometry args={[0.2, 0.09]} />
          <meshStandardMaterial map={muteTex.current ?? null} transparent />
        </mesh>
        <mesh position={[position[0], btnY + 0.11, z]}>
          <planeGeometry args={[0.22, 0.06]} />
          <meshBasicMaterial map={labelMute.current ?? null} transparent />
        </mesh>
      </group>

      {/* Mute glow */}
      {controllerHover === 'mute' && (
        <mesh position={[position[0], btnY, z - 0.01]}>
          <planeGeometry args={[0.24, 0.11]} />
          <meshBasicMaterial color={'#34d399'} transparent opacity={glowOpacity(0.08)} />
        </mesh>
      )}

      {/* Pause */}
      <group>
        <mesh
          position={[position[0] + btnSpacing, btnY, z]}
          scale={isHovering('pause') ? (pressedButton === 'pause' ? 0.9 : 1.08) : 1.0}
          onPointerOver={() => onButtonOver('pause')}
          onPointerOut={() => onButtonOut()}
          onPointerDown={(e) => { e.stopPropagation(); onButtonDown('pause'); }}
          onPointerUp={(e) => { e.stopPropagation(); onButtonUp('pause'); }}
        >
          <planeGeometry args={[0.2, 0.09]} />
          <meshStandardMaterial map={pauseTex.current ?? null} transparent />
        </mesh>
        <mesh position={[position[0] + btnSpacing, btnY + 0.11, z]}>
          <planeGeometry args={[0.22, 0.06]} />
          <meshBasicMaterial map={labelPause.current ?? null} transparent />
        </mesh>
      </group>

      {/* Pause glow */}
      {controllerHover === 'pause' && (
        <mesh position={[position[0] + btnSpacing, btnY, z - 0.01]}>
          <planeGeometry args={[0.24, 0.11]} />
          <meshBasicMaterial color={'#f97316'} transparent opacity={glowOpacity(0.08)} />
        </mesh>
      )}

      {/* on-screen follow toggle (small text plane under video for 2D testing) */}
      <mesh position={[position[0], position[1] - height * 0.65, position[2]]} onClick={() => setFollow((s) => !s)}>
        <planeGeometry args={[0.6, 0.08]} />
        <meshBasicMaterial color={follow ? '#065f46' : '#111827'} transparent opacity={0.9} />
      </mesh>
    </>
  );
});

export default XRVideoPlane;
