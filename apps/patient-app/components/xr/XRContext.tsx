// apps/patient-app/components/xr/XRContext.tsx
'use client';

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

type XRContextValue = {
  // Prefer a live MediaStream for video; fallback to videoSrc if stream is null
  xrStream: MediaStream | null;
  setXrStream: (s: MediaStream | null) => void;
  videoSrc: string | null;
  setVideoSrc: (s: string | null) => void;
  // convenience toggle: if true the provider will also set window.__XR_STREAM
  exposeToWindow: boolean;
  setExposeToWindow: (v: boolean) => void;
};

const defaultVideo = '/videos/demo.mp4'; // put a demo video into public/videos/demo.mp4 or fallback to /mock-video.jpg

const XRContext = createContext<XRContextValue | null>(null);

export function XRProvider({ children }: { children: React.ReactNode }) {
  const [xrStream, setXrStreamState] = useState<MediaStream | null>(null);
  const [videoSrc, setVideoSrcState] = useState<string | null>(defaultVideo);
  const [exposeToWindow, setExposeToWindow] = useState<boolean>(false);

  const setXrStream = useCallback((s: MediaStream | null) => {
    // clear old window ref if present
    try {
      if ((window as any).__XR_STREAM && !s) {
        delete (window as any).__XR_STREAM;
      }
    } catch {}
    setXrStreamState(s);
    if (exposeToWindow) {
      try {
        (window as any).__XR_STREAM = s ?? null;
      } catch {}
    }
  }, [exposeToWindow]);

  const setVideoSrc = useCallback((s: string | null) => {
    setVideoSrcState(s);
  }, []);

  const value = useMemo<XRContextValue>(() => ({
    xrStream,
    setXrStream,
    videoSrc,
    setVideoSrc,
    exposeToWindow,
    setExposeToWindow,
  }), [xrStream, setXrStream, videoSrc, setVideoSrc, exposeToWindow, setExposeToWindow]);

  return <XRContext.Provider value={value}>{children}</XRContext.Provider>;
}

export function useXR() {
  const ctx = useContext(XRContext);
  if (!ctx) {
    throw new Error('useXR must be used inside XRProvider');
  }
  return ctx;
}
