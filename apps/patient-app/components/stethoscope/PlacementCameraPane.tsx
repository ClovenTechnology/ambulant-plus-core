//apps/patient-app/components/stethoscope/PlacementCameraPane.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, CameraOff, FlipHorizontal, Layers, AlertTriangle } from 'lucide-react';

type OverlayView = 'front' | 'back';
type Facing = 'user' | 'environment';

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

export default function PlacementCameraPane(props: {
  overlaySrc: string;
  overlayEnabled: boolean;
  setOverlayEnabled: (v: boolean) => void;

  overlayOpacity: number; // 0..1
  setOverlayOpacity: (v: number) => void;

  overlayView: OverlayView;
  setOverlayView: (v: OverlayView) => void;

  overlayAuto: boolean;
  setOverlayAuto: (v: boolean) => void;

  mirror: boolean;
  setMirror: (v: boolean) => void;

  className?: string;
}) {
  const {
    overlaySrc,
    overlayEnabled,
    setOverlayEnabled,
    overlayOpacity,
    setOverlayOpacity,
    overlayView,
    setOverlayView,
    overlayAuto,
    setOverlayAuto,
    mirror,
    setMirror,
    className,
  } = props;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraOn, setCameraOn] = useState(false);
  const [starting, setStarting] = useState(false);
  const [facing, setFacing] = useState<Facing>('environment');
  const [err, setErr] = useState<string | null>(null);

  const canCamera = useMemo(() => {
    return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
  }, []);

  async function stopCamera() {
    try {
      const s = streamRef.current;
      if (s) s.getTracks().forEach((t) => t.stop());
    } catch {}
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
  }

  async function startCamera(nextFacing?: Facing) {
    if (!canCamera) {
      setErr('Camera not supported in this browser.');
      return;
    }
    setErr(null);
    setStarting(true);
    try {
      const desiredFacing = nextFacing || facing;

      // Stop any previous stream
      await stopCamera();

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: desiredFacing },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        } as any,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setCameraOn(true);
    } catch (e: any) {
      setErr(e?.message ? String(e.message) : 'Camera permission denied or unavailable.');
      setCameraOn(false);
    } finally {
      setStarting(false);
    }
  }

  async function toggleFacing() {
    const next: Facing = facing === 'environment' ? 'user' : 'environment';
    setFacing(next);
    await startCamera(next);
  }

  useEffect(() => {
    return () => {
      void stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={cx('rounded-2xl border border-slate-200 bg-white p-4', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">Camera guide (optional)</div>
          <div className="mt-1 text-xs text-slate-600">
            Uses your camera locally (no upload). Overlay helps you position the chest/back points.
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!cameraOn ? (
            <button
              type="button"
              onClick={() => void startCamera()}
              disabled={starting || !canCamera}
              className={cx(
                'inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold',
                canCamera ? 'bg-slate-900 text-white hover:bg-slate-800' : 'bg-slate-200 text-slate-500',
                starting && 'opacity-60'
              )}
            >
              <Camera className="h-4 w-4" />
              {starting ? 'Starting…' : 'Start camera'}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void stopCamera()}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <CameraOff className="h-4 w-4" />
              Stop
            </button>
          )}

          <button
            type="button"
            onClick={() => void toggleFacing()}
            disabled={!cameraOn || starting}
            className={cx(
              'inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold',
              cameraOn ? 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50' : 'border-slate-200 bg-white text-slate-400'
            )}
            title="Switch camera (if available)"
          >
            <FlipHorizontal className="h-4 w-4" />
            Flip
          </button>
        </div>
      </div>

      {err ? (
        <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4" />
            <div>
              <div className="font-semibold">Camera issue</div>
              <div className="mt-1 text-rose-800">{err}</div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Video frame */}
      <div className="mt-3">
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50" style={{ aspectRatio: '16 / 10' }}>
          <video
            ref={videoRef}
            playsInline
            muted
            className={cx('absolute inset-0 h-full w-full object-cover', mirror && 'scale-x-[-1]')}
          />

          {/* Overlay */}
          {overlayEnabled ? (
            <img
              src={overlaySrc}
              alt="Placement overlay"
              className={cx('absolute inset-0 h-full w-full object-contain pointer-events-none', mirror && 'scale-x-[-1]')}
              style={{ opacity: Math.max(0, Math.min(1, overlayOpacity)) }}
              draggable={false}
            />
          ) : null}

          {!cameraOn ? (
            <div className="absolute inset-0 grid place-items-center p-4 text-center">
              <div className="max-w-sm">
                <div className="text-sm font-semibold text-slate-900">Camera is off</div>
                <div className="mt-1 text-xs text-slate-600">
                  Turn it on to line up placement points. This does not save or upload video.
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Controls */}
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-slate-700">Overlay</div>
              <button
                type="button"
                onClick={() => setOverlayEnabled(!overlayEnabled)}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Layers className="h-3.5 w-3.5" />
                {overlayEnabled ? 'On' : 'Off'}
              </button>
            </div>

            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs text-slate-600">Opacity</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={overlayOpacity}
                onChange={(e) => setOverlayOpacity(parseFloat(e.target.value))}
                className="w-full"
                aria-label="Overlay opacity"
              />
              <span className="text-xs text-slate-600 tabular-nums">{Math.round(overlayOpacity * 100)}%</span>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700">
                <input type="checkbox" checked={overlayAuto} onChange={(e) => setOverlayAuto(e.target.checked)} className="h-3.5 w-3.5" />
                Auto (follow site)
              </label>

              <div className="inline-flex items-center rounded-full border border-slate-200 bg-white p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setOverlayView('front')}
                  disabled={overlayAuto}
                  className={cx('rounded-full px-3 py-1 font-semibold', overlayView === 'front' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-50', overlayAuto && 'opacity-50')}
                >
                  Front
                </button>
                <button
                  type="button"
                  onClick={() => setOverlayView('back')}
                  disabled={overlayAuto}
                  className={cx('rounded-full px-3 py-1 font-semibold', overlayView === 'back' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-50', overlayAuto && 'opacity-50')}
                >
                  Back
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="text-xs font-semibold text-slate-700">View</div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700">
                <input type="checkbox" checked={mirror} onChange={(e) => setMirror(e.target.checked)} className="h-3.5 w-3.5" />
                Mirror preview
              </label>

              <span className="text-xs text-slate-500">Facing: <span className="font-semibold text-slate-700">{facing}</span></span>
            </div>
            <div className="mt-2 text-xs text-slate-500">
              Tip: Use rear camera (environment) if available for easier positioning.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
