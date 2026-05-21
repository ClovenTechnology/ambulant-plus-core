// apps/patient-app/components/iomt/OtoPane.tsx
'use client';

import { Camera, Circle, Download, Eye, Image as ImageIcon, MicOff, ScanLine, Video } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

export default function OtoPane() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [recording, setRecording] = useState(false);

  async function ensureStream() {
    if (streamRef.current) return streamRef.current;
    // USB camera support depends on device; this uses default camera as placeholder
    const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    streamRef.current = s;
    if (videoRef.current) videoRef.current.srcObject = s;
    return s;
  }

  async function startVideo() {
    await ensureStream();
    if (!videoRef.current) return;
    await videoRef.current.play();
    const rec = new MediaRecorder(streamRef.current!);
    rec.ondataavailable = (e) => chunksRef.current.push(e.data);
    rec.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      chunksRef.current = [];
      const a = document.createElement('a');
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      a.href = URL.createObjectURL(blob);
      a.download = `oto-${ts}.webm`; // MP4 when encoder/bridge available
      a.click();
    };
    rec.start();
    recRef.current = rec;
    setRecording(true);
  }

  function stopVideo() {
    recRef.current?.stop();
    setRecording(false);
  }

  async function takePhoto() {
    await ensureStream();
    const canvas = document.createElement('canvas');
    const v = videoRef.current!;
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(v, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement('a');
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      a.href = URL.createObjectURL(blob);
      a.download = `oto-${ts}.png`;
      a.click();
    }, 'image/png');
  }

  useEffect(
    () => () => {
      recRef.current?.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  const statusText = useMemo(() => {
    if (recording) return 'Recording clip';
    if (streamRef.current) return 'Camera ready';
    return 'Standby';
  }, [recording]);

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-slate-950 via-zinc-950 to-slate-900 p-3 shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.18),transparent_32%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.12),transparent_28%)]" />
        <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:24px_24px]" />

        <div className="relative mb-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-xl">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 p-2 text-cyan-300">
                <Eye className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-semibold tracking-wide text-white">HD Otoscope Live View</div>
                <div className="text-xs text-zinc-400">
                  Futuristic preview shell for otoscopy capture workflow
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-xs text-zinc-300">
              <span
                className={`h-2 w-2 rounded-full ${
                  recording ? 'animate-pulse bg-red-400 shadow-[0_0_12px_rgba(248,113,113,0.9)]' : 'bg-emerald-400'
                }`}
              />
              {statusText}
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-xs text-zinc-400">
              <MicOff className="h-3.5 w-3.5" />
              Audio muted
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-[24px] border border-cyan-400/15 bg-black shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]">
          <video
            ref={videoRef}
            className="aspect-video w-full bg-black object-cover"
            playsInline
            muted
          />

          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_35%,rgba(0,0,0,0.28)_100%)]" />
          <div className="pointer-events-none absolute inset-0 border border-white/5" />

          <div className="pointer-events-none absolute left-4 top-4 flex items-center gap-2 rounded-full border border-white/10 bg-black/45 px-3 py-1.5 text-xs text-white/90 backdrop-blur-md">
            <ScanLine className="h-3.5 w-3.5 text-cyan-300" />
            Live canal preview
          </div>

          <div className="pointer-events-none absolute right-4 top-4 flex items-center gap-2 rounded-full border border-white/10 bg-black/45 px-3 py-1.5 text-xs text-white/90 backdrop-blur-md">
            <div className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(74,222,128,0.75)]" />
            Preview feed
          </div>

          <div className="pointer-events-none absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3">
            <div className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 backdrop-blur-md">
              <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-400">Capture mode</div>
              <div className="mt-1 text-sm font-medium text-white">
                {recording ? 'Video acquisition' : 'Still / video ready'}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-right backdrop-blur-md">
              <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-400">Output</div>
              <div className="mt-1 text-sm font-medium text-white">
                {recording ? 'WEBM clip' : 'PNG snapshot'}
              </div>
            </div>
          </div>

          <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-cyan-400/8 to-transparent" />
        </div>

        <div className="relative mt-4 grid gap-3 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="rounded-[22px] border border-white/10 bg-white/5 p-3 backdrop-blur-xl">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-white">Capture Controls</div>
                <div className="text-xs text-zinc-400">
                  UI-only polish. Existing capture logic remains untouched.
                </div>
              </div>
              <div className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[11px] text-zinc-400">
                Otoscopy panel
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                onClick={takePhoto}
                className="group relative overflow-hidden rounded-[20px] border border-cyan-400/20 bg-gradient-to-br from-cyan-500/15 via-slate-900 to-slate-950 px-4 py-4 text-left shadow-[0_10px_30px_rgba(0,0,0,0.25)] transition duration-200 hover:-translate-y-0.5 hover:border-cyan-300/35 hover:shadow-[0_18px_40px_rgba(6,182,212,0.16)]"
              >
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(103,232,249,0.12),transparent_40%)] opacity-80" />
                <div className="relative flex items-start gap-3">
                  <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-3 text-cyan-300">
                    <Camera className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">Capture Photo</div>
                    <div className="mt-1 text-xs leading-5 text-zinc-400">
                      Freeze current view and export a still otoscopy image.
                    </div>
                  </div>
                </div>
              </button>

              {!recording ? (
                <button
                  onClick={startVideo}
                  className="group relative overflow-hidden rounded-[20px] border border-emerald-400/20 bg-gradient-to-br from-emerald-500/15 via-slate-900 to-slate-950 px-4 py-4 text-left shadow-[0_10px_30px_rgba(0,0,0,0.25)] transition duration-200 hover:-translate-y-0.5 hover:border-emerald-300/35 hover:shadow-[0_18px_40px_rgba(16,185,129,0.16)]"
                >
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(74,222,128,0.12),transparent_40%)] opacity-80" />
                  <div className="relative flex items-start gap-3">
                    <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-emerald-300">
                      <Video className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white">Start Video</div>
                      <div className="mt-1 text-xs leading-5 text-zinc-400">
                        Begin clip recording from the active otoscope preview.
                      </div>
                    </div>
                  </div>
                </button>
              ) : (
                <button
                  onClick={stopVideo}
                  className="group relative overflow-hidden rounded-[20px] border border-red-400/25 bg-gradient-to-br from-red-500/15 via-slate-900 to-slate-950 px-4 py-4 text-left shadow-[0_10px_30px_rgba(0,0,0,0.25)] transition duration-200 hover:-translate-y-0.5 hover:border-red-300/40 hover:shadow-[0_18px_40px_rgba(239,68,68,0.18)]"
                >
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(248,113,113,0.14),transparent_40%)] opacity-80" />
                  <div className="relative flex items-start gap-3">
                    <div className="rounded-2xl border border-red-400/20 bg-red-400/10 p-3 text-red-300">
                      <Circle className="h-5 w-5 fill-current" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white">Stop Video</div>
                      <div className="mt-1 text-xs leading-5 text-zinc-400">
                        End acquisition and export the recorded otoscopy clip.
                      </div>
                    </div>
                  </div>
                </button>
              )}
            </div>
          </div>

          <div className="rounded-[22px] border border-white/10 bg-white/5 p-3 backdrop-blur-xl">
            <div className="mb-3 text-sm font-semibold text-white">Session Insights</div>

            <div className="space-y-3">
              <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-zinc-500">
                  <ImageIcon className="h-3.5 w-3.5" />
                  Snapshot
                </div>
                <div className="mt-2 text-sm text-white">PNG still capture</div>
                <div className="mt-1 text-xs text-zinc-400">Ideal for tympanic membrane review and notes.</div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-zinc-500">
                  <Download className="h-3.5 w-3.5" />
                  Clip export
                </div>
                <div className="mt-2 text-sm text-white">WEBM recording</div>
                <div className="mt-1 text-xs text-zinc-400">
                  Current placeholder output until structured media pipeline is wired.
                </div>
              </div>

              <div className="rounded-2xl border border-cyan-400/15 bg-cyan-400/5 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-cyan-300/80">Status note</div>
                <div className="mt-2 text-sm text-white">
                  Buttons remain reusable after stopping and starting again.
                </div>
                <div className="mt-1 text-xs text-cyan-100/60">
                  This pane now looks product-grade without touching capture logic yet.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-950 to-zinc-900 p-4">
          <div className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">Preview Mode</div>
          <div className="mt-2 text-sm font-medium text-white">Live otoscope framing</div>
          <div className="mt-1 text-xs leading-5 text-zinc-400">
            High-contrast presentation with layered overlays for a more clinical, premium look.
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-950 to-zinc-900 p-4">
          <div className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">Future-ready</div>
          <div className="mt-2 text-sm font-medium text-white">Media workflow shell</div>
          <div className="mt-1 text-xs leading-5 text-zinc-400">
            Ready for later attachment metadata, clinician review, and AI analysis layers.
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-950 to-zinc-900 p-4">
          <div className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">Current limitation</div>
          <div className="mt-2 text-sm font-medium text-white">Default camera placeholder</div>
          <div className="mt-1 text-xs leading-5 text-zinc-400">
            USB otoscope transport and encoder-specific handling can be layered in next without redesigning the pane.
          </div>
        </div>
      </div>
    </div>
  );
}