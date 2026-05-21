// apps/patient-app/components/iomt/StethoPane.tsx
'use client';

import {
  AudioLines,
  Bluetooth,
  Download,
  HeartPulse,
  Loader2,
  Mic,
  MicOff,
  Play,
  ShieldCheck,
  Square,
  Stethoscope,
  TriangleAlert,
  Volume2,
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import { StethoscopeSession } from '@/src/devices/stethoscopeSession';
import { useIomtConsent } from '@/src/hooks/useIomtConsent';
import type { StethClipMeta, StethSessionState } from '@/src/lib/stethoscope-types';

type PaneMode = 'heart' | 'lung';

type StethoPaneProps = {
  embedded?: boolean;
  patientId?: string;
  roomId?: string;
};

const EMPTY_STATE: StethSessionState = {
  captureState: 'idle',
  connected: false,
  recording: false,
  packets: 0,
  sampleRate: 8000,
  channels: 1,
  streamKind: 'filtered',
  site: 'chest-apex',
  echoMode: 'heart',
  agcGain: 0,
  telemetry: { updatedAt: Date.now() },
  startedAt: null,
  elapsedMs: 0,
  lastError: null,
};

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

function formatMs(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

function shortErr(e: unknown) {
  const msg = (e as any)?.message
    ? String((e as any).message)
    : String(e ?? 'Unknown error');

  return msg.length > 180 ? `${msg.slice(0, 180)}…` : msg;
}

function SignalCanvas({
  samples,
  active,
}: {
  samples: Int16Array | null;
  active: boolean;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth || 900;
    const cssH = canvas.clientHeight || 220;
    const w = Math.floor(cssW * dpr);
    const h = Math.floor(cssH * dpr);

    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.globalAlpha = 0.14;
    ctx.strokeStyle = '#67e8f9';
    ctx.lineWidth = 1;

    for (let i = 1; i < 6; i += 1) {
      const y = Math.round((h * i) / 6);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    for (let i = 1; i < 10; i += 1) {
      const x = Math.round((w * i) / 10);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }

    ctx.restore();

    const mid = Math.floor(h / 2);

    ctx.strokeStyle = 'rgba(103,232,249,0.28)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, mid);
    ctx.lineTo(w, mid);
    ctx.stroke();

    ctx.strokeStyle = active ? '#67e8f9' : '#94a3b8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, mid);

    if (samples && samples.length > 0) {
      const step = Math.max(1, Math.floor(samples.length / w));
      const amp = mid - 10;

      for (let x = 0; x < w; x += 1) {
        const i = Math.min(samples.length - 1, x * step);
        const s = (samples[i] || 0) / 32768;
        const y = mid - s * amp;
        ctx.lineTo(x, y);
      }
    } else {
      ctx.lineTo(w, mid);
    }

    ctx.stroke();
  }, [samples, active]);

  return (
    <canvas
      ref={ref}
      className="h-56 w-full rounded-[24px] border border-cyan-400/10 bg-slate-950"
    />
  );
}

function SurfaceHeader({
  embedded,
  connected,
  isRecording,
  busy,
  statusLabel,
}: {
  embedded: boolean;
  connected: boolean;
  isRecording: boolean;
  busy: boolean;
  statusLabel: string;
}) {
  if (embedded) {
    return (
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-[24px] border border-slate-200 bg-white px-4 py-4 shadow-sm">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-3 text-cyan-700">
              <Stethoscope className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold tracking-tight text-slate-900">
                Digital Stethoscope
              </div>
              <div className="text-xs text-slate-500">
                Quick auscultation surface for connect, capture, playback, and export.
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700">
            <span
              className={cx(
                'h-2 w-2 rounded-full',
                isRecording
                  ? 'animate-pulse bg-red-500'
                  : connected
                    ? 'bg-emerald-500'
                    : 'bg-slate-400',
              )}
            />
            {statusLabel}
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600">
            {isRecording ? (
              <Mic className="h-3.5 w-3.5" />
            ) : (
              <MicOff className="h-3.5 w-3.5" />
            )}
            {busy ? 'Busy' : isRecording ? 'Capture live' : 'Mic idle'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-slate-950 via-zinc-950 to-slate-900 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.16),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.10),transparent_28%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:24px_24px]" />

      <div className="relative flex flex-wrap items-start justify-between gap-3 rounded-[22px] border border-white/10 bg-white/5 px-4 py-4 backdrop-blur-xl">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-3 text-cyan-300">
              <Stethoscope className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold tracking-wide text-white">
                Digital Stethoscope Quick Console
              </div>
              <div className="text-xs text-zinc-400">
                Lightweight connect, capture, waveform, playback, and export surface
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-xs text-zinc-300">
            <span
              className={cx(
                'h-2 w-2 rounded-full',
                isRecording
                  ? 'animate-pulse bg-red-400 shadow-[0_0_12px_rgba(248,113,113,0.9)]'
                  : connected
                    ? 'bg-emerald-400 shadow-[0_0_10px_rgba(74,222,128,0.65)]'
                    : 'bg-slate-500',
              )}
            />
            {statusLabel}
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-xs text-zinc-400">
            {isRecording ? (
              <Mic className="h-3.5 w-3.5" />
            ) : (
              <MicOff className="h-3.5 w-3.5" />
            )}
            {isRecording ? 'Capture live' : 'Mic idle'}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function StethoPane({
  embedded = false,
  patientId: patientIdProp,
}: StethoPaneProps) {
  const consent = useIomtConsent('stethoscope');
  const sp = useSearchParams();

  const patientId = useMemo(() => {
    const fromProp = String(patientIdProp || '').trim();
    if (fromProp) return fromProp;

    const fromQuery = sp?.get('patientId') || sp?.get('pid') || '';
    return fromQuery.trim();
  }, [patientIdProp, sp]);

  const [mode, setMode] = useState<PaneMode>('heart');
  const [state, setState] = useState<StethSessionState>(EMPTY_STATE);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [liveSamples, setLiveSamples] = useState<Int16Array | null>(null);
  const [audioURL, setAudioURL] = useState<string | null>(null);
  const [lastClipMeta, setLastClipMeta] = useState<StethClipMeta | null>(null);
  const [deviceMac, setDeviceMac] = useState('');
  const [actionNote, setActionNote] = useState<string | null>(null);

  const clipBlobRef = useRef<Blob | null>(null);
  const sessionRef = useRef<StethoscopeSession | null>(null);

  useEffect(() => {
    const site = mode === 'heart' ? 'chest-apex' : 'chest-left';
    const echoMode = mode === 'heart' ? 'heart' : 'lung';

    const session = new StethoscopeSession({
      patientId,
      site,
      echoMode,
      streamKind: 'filtered',
      onState: (next) => {
        setState(next);
        if (next.lastError) setErr(next.lastError);
      },
      onWaveform: (samples) => {
        setLiveSamples(new Int16Array(samples));
      },
      onClipReady: ({ blob, meta }) => {
        clipBlobRef.current = blob;
        setLastClipMeta(meta);
        setAudioURL((prev) => {
          if (prev) {
            try {
              URL.revokeObjectURL(prev);
            } catch {
              // Ignore URL revoke failures.
            }
          }

          return URL.createObjectURL(blob);
        });
        setActionNote('Clip captured and ready for playback.');
      },
    });

    sessionRef.current = session;

    return () => {
      const current = sessionRef.current;
      sessionRef.current = null;

      if (audioURL) {
        try {
          URL.revokeObjectURL(audioURL);
        } catch {
          // Ignore URL revoke failures.
        }
      }

      void current?.destroy().catch(() => undefined);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  useEffect(() => {
    const session = sessionRef.current;
    if (!session) return;

    const site = mode === 'heart' ? 'chest-apex' : 'chest-left';
    const echoMode = mode === 'heart' ? 'heart' : 'lung';

    session.setSite(site);
    void session.setEchoMode(echoMode);

    setActionNote(`Mode set to ${mode}.`);
  }, [mode]);

  async function connect() {
    setErr(null);
    setActionNote(null);
    setBusy(true);

    try {
      const session = sessionRef.current;
      if (!session) throw new Error('Stethoscope session not ready.');

      const maybeNative = (session as any).isNative?.() === true;

      if (maybeNative) {
        const mac = deviceMac.trim();
        if (!mac) throw new Error('Enter a device MAC address for native connection.');
        await (session as any).connect(mac);
      } else {
        await (session as any).connect();
      }

      setActionNote('Stethoscope connected.');
    } catch (e) {
      setErr(shortErr(e));
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setErr(null);
    setBusy(true);

    try {
      await sessionRef.current?.disconnect();
      setLiveSamples(null);
      setActionNote('Stethoscope disconnected.');
    } catch (e) {
      setErr(shortErr(e));
    } finally {
      setBusy(false);
    }
  }

  async function startCapture() {
    setErr(null);
    setActionNote(null);

    if (!consent.accepted) {
      setErr('Please review and accept the Stethoscope consent before recording.');
      return;
    }

    setBusy(true);

    try {
      const session = sessionRef.current;
      if (!session) throw new Error('Stethoscope session not ready.');

      setLiveSamples(null);
      await (session as any).startCapture();
      setActionNote('Capture started.');
    } catch (e) {
      setErr(shortErr(e));
    } finally {
      setBusy(false);
    }
  }

  async function stopCapture() {
    setErr(null);
    setBusy(true);

    try {
      await (sessionRef.current as any)?.stopCapture(note || undefined);
      setActionNote('Capture stopped.');
    } catch (e) {
      setErr(shortErr(e));
    } finally {
      setBusy(false);
    }
  }

  function saveClip() {
    if (!audioURL) return;

    const a = document.createElement('a');
    const ts = new Date().toISOString().replace(/[:.]/g, '-');

    a.href = audioURL;
    a.download = `stetho-${ts}-${mode}.wav`;
    a.click();
  }

  const isRecording = !!state.recording;
  const connected = !!state.connected;

  const statusLabel = useMemo(() => {
    if (busy) return 'Working';
    if (isRecording) return `Recording • ${formatMs(state.elapsedMs)}`;
    if (audioURL) return 'Clip ready';
    if (connected) return 'Connected';
    return 'Standby';
  }, [busy, isRecording, state.elapsedMs, audioURL, connected]);

  const qualityGuidance = useMemo(() => {
    const live = state.live;

    if (!connected) return { level: 'neutral' as const, text: 'Not connected' };
    if (!consent.accepted) return { level: 'warn' as const, text: 'Consent not accepted' };
    if (!live) return { level: 'neutral' as const, text: 'Awaiting signal' };

    if ((live.clipPct ?? 0) >= 1 || (live.peak ?? 0) >= 0.98) {
      return { level: 'bad' as const, text: 'Too loud / clipping' };
    }

    if ((live.rms ?? 0) <= 0.02) {
      return { level: 'warn' as const, text: 'Too quiet' };
    }

    return { level: 'good' as const, text: 'Signal OK' };
  }, [connected, consent.accepted, state.live]);

  const qualityClass =
    qualityGuidance.level === 'good'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
      : qualityGuidance.level === 'bad'
        ? 'border-rose-200 bg-rose-50 text-rose-800'
        : qualityGuidance.level === 'warn'
          ? 'border-amber-200 bg-amber-50 text-amber-900'
          : 'border-slate-200 bg-white text-slate-700';

  return (
    <div className="space-y-4">
      <SurfaceHeader
        embedded={embedded}
        connected={connected}
        isRecording={isRecording}
        busy={busy}
        statusLabel={statusLabel}
      />

      {(err || actionNote) && (
        <div className="space-y-3">
          {err ? (
            <div
              className={cx(
                'rounded-[18px] border p-3 text-sm',
                embedded
                  ? 'border-red-200 bg-red-50 text-red-700'
                  : 'border-red-400/20 bg-red-500/10 text-red-200',
              )}
            >
              <div className="flex items-start gap-2">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{err}</span>
              </div>
            </div>
          ) : null}

          {actionNote ? (
            <div
              className={cx(
                'rounded-[18px] border p-3 text-sm',
                embedded
                  ? 'border-cyan-200 bg-cyan-50 text-cyan-700'
                  : 'border-cyan-400/20 bg-cyan-500/10 text-cyan-100',
              )}
            >
              {actionNote}
            </div>
          ) : null}
        </div>
      )}

      <div
        className={cx(
          'grid gap-4',
          embedded ? 'xl:grid-cols-[1.2fr_0.8fr]' : 'xl:grid-cols-[1.15fr_0.85fr]',
        )}
      >
        <div
          className={cx(
            'rounded-[24px] border p-4',
            embedded
              ? 'border-slate-200 bg-white shadow-sm'
              : 'border-white/10 bg-white/5 backdrop-blur-xl',
          )}
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <div className={cx('text-sm font-semibold', embedded ? 'text-slate-900' : 'text-white')}>
                Auscultation Mode
              </div>
              <div className={cx('text-xs', embedded ? 'text-slate-500' : 'text-zinc-400')}>
                Session-backed heart and lung capture with live waveform preview.
              </div>
            </div>

            <div
              className={cx(
                'rounded-full border px-3 py-1 text-[11px]',
                embedded
                  ? 'border-slate-200 bg-slate-50 text-slate-600'
                  : 'border-white/10 bg-black/30 text-zinc-400',
              )}
            >
              Quick surface
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setMode('heart')}
              className={cx(
                'group relative overflow-hidden rounded-[20px] border px-4 py-4 text-left transition duration-200',
                mode === 'heart'
                  ? embedded
                    ? 'border-cyan-200 bg-cyan-50 shadow-sm'
                    : 'border-cyan-300/35 bg-gradient-to-br from-cyan-500/15 via-slate-900 to-slate-950 shadow-[0_18px_40px_rgba(6,182,212,0.14)]'
                  : embedded
                    ? 'border-slate-200 bg-white hover:-translate-y-0.5 hover:border-cyan-200'
                    : 'border-white/10 bg-black/20 hover:-translate-y-0.5 hover:border-cyan-300/20 hover:bg-black/30',
              )}
            >
              <div className="relative flex items-start gap-3">
                <div
                  className={cx(
                    'rounded-2xl p-3',
                    mode === 'heart'
                      ? embedded
                        ? 'border border-cyan-200 bg-cyan-100 text-cyan-700'
                        : 'border border-cyan-400/20 bg-cyan-400/10 text-cyan-300'
                      : embedded
                        ? 'border border-slate-200 bg-slate-50 text-slate-500'
                        : 'border border-white/10 bg-white/5 text-zinc-300',
                  )}
                >
                  <HeartPulse className="h-5 w-5" />
                </div>
                <div>
                  <div className={cx('text-sm font-semibold', embedded ? 'text-slate-900' : 'text-white')}>
                    Heart Mode
                  </div>
                  <div className={cx('mt-1 text-xs leading-5', embedded ? 'text-slate-500' : 'text-zinc-400')}>
                    Uses apex-focused quick session defaults.
                  </div>
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setMode('lung')}
              className={cx(
                'group relative overflow-hidden rounded-[20px] border px-4 py-4 text-left transition duration-200',
                mode === 'lung'
                  ? embedded
                    ? 'border-emerald-200 bg-emerald-50 shadow-sm'
                    : 'border-emerald-300/35 bg-gradient-to-br from-emerald-500/15 via-slate-900 to-slate-950 shadow-[0_18px_40px_rgba(16,185,129,0.14)]'
                  : embedded
                    ? 'border-slate-200 bg-white hover:-translate-y-0.5 hover:border-emerald-200'
                    : 'border-white/10 bg-black/20 hover:-translate-y-0.5 hover:border-emerald-300/20 hover:bg-black/30',
              )}
            >
              <div className="relative flex items-start gap-3">
                <div
                  className={cx(
                    'rounded-2xl p-3',
                    mode === 'lung'
                      ? embedded
                        ? 'border border-emerald-200 bg-emerald-100 text-emerald-700'
                        : 'border border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
                      : embedded
                        ? 'border border-slate-200 bg-slate-50 text-slate-500'
                        : 'border border-white/10 bg-white/5 text-zinc-300',
                  )}
                >
                  <AudioLines className="h-5 w-5" />
                </div>
                <div>
                  <div className={cx('text-sm font-semibold', embedded ? 'text-slate-900' : 'text-white')}>
                    Lung Mode
                  </div>
                  <div className={cx('mt-1 text-xs leading-5', embedded ? 'text-slate-500' : 'text-zinc-400')}>
                    Uses chest-left respiratory quick session defaults.
                  </div>
                </div>
              </div>
            </button>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            <div
              className={cx(
                'rounded-2xl border p-3',
                embedded ? 'border-slate-200 bg-slate-50' : 'border-white/10 bg-black/25',
              )}
            >
              <div className={cx('text-[10px] uppercase tracking-[0.22em]', embedded ? 'text-slate-400' : 'text-zinc-500')}>
                Selected
              </div>
              <div className={cx('mt-2 text-sm font-medium capitalize', embedded ? 'text-slate-900' : 'text-white')}>
                {mode}
              </div>
            </div>

            <div
              className={cx(
                'rounded-2xl border p-3',
                embedded ? 'border-slate-200 bg-slate-50' : 'border-white/10 bg-black/25',
              )}
            >
              <div className={cx('text-[10px] uppercase tracking-[0.22em]', embedded ? 'text-slate-400' : 'text-zinc-500')}>
                Packets
              </div>
              <div className={cx('mt-2 text-sm font-medium', embedded ? 'text-slate-900' : 'text-white')}>
                {state.packets}
              </div>
            </div>

            <div
              className={cx(
                'rounded-2xl border p-3',
                embedded ? 'border-slate-200 bg-slate-50' : 'border-white/10 bg-black/25',
              )}
            >
              <div className={cx('text-[10px] uppercase tracking-[0.22em]', embedded ? 'text-slate-400' : 'text-zinc-500')}>
                Sample rate
              </div>
              <div className={cx('mt-2 text-sm font-medium', embedded ? 'text-slate-900' : 'text-white')}>
                {state.sampleRate} Hz
              </div>
            </div>

            <div
              className={cx(
                'rounded-2xl border p-3',
                embedded ? 'border-slate-200 bg-slate-50' : 'border-white/10 bg-black/25',
              )}
            >
              <div className={cx('text-[10px] uppercase tracking-[0.22em]', embedded ? 'text-slate-400' : 'text-zinc-500')}>
                Elapsed
              </div>
              <div className={cx('mt-2 text-sm font-medium', embedded ? 'text-slate-900' : 'text-white')}>
                {formatMs(state.elapsedMs)}
              </div>
            </div>
          </div>

          <div
            className={cx(
              'mt-4 rounded-[20px] border p-4',
              embedded ? 'border-slate-200 bg-slate-50' : 'border-white/10 bg-black/25',
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className={cx('text-sm font-semibold', embedded ? 'text-slate-900' : 'text-white')}>
                  Live Signal
                </div>
                <div className={cx('text-xs', embedded ? 'text-slate-500' : 'text-zinc-400')}>
                  Real waveform from the session bridge while connected.
                </div>
              </div>

              <div className={cx('rounded-full border px-3 py-1 text-[11px] font-semibold', qualityClass)}>
                {qualityGuidance.text}
              </div>
            </div>

            <div className="mt-4">
              <SignalCanvas samples={liveSamples} active={connected || isRecording} />
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className={cx('rounded-2xl border p-3', embedded ? 'border-slate-200 bg-white' : 'border-white/10 bg-slate-950/70')}>
                <div className={cx('text-[10px] uppercase tracking-[0.2em]', embedded ? 'text-slate-400' : 'text-zinc-500')}>
                  RMS
                </div>
                <div className={cx('mt-2 text-sm font-semibold', embedded ? 'text-slate-900' : 'text-white')}>
                  {(state.live?.rms ?? 0).toFixed(3)}
                </div>
              </div>

              <div className={cx('rounded-2xl border p-3', embedded ? 'border-slate-200 bg-white' : 'border-white/10 bg-slate-950/70')}>
                <div className={cx('text-[10px] uppercase tracking-[0.2em]', embedded ? 'text-slate-400' : 'text-zinc-500')}>
                  Peak
                </div>
                <div className={cx('mt-2 text-sm font-semibold', embedded ? 'text-slate-900' : 'text-white')}>
                  {(state.live?.peak ?? 0).toFixed(3)}
                </div>
              </div>

              <div className={cx('rounded-2xl border p-3', embedded ? 'border-slate-200 bg-white' : 'border-white/10 bg-slate-950/70')}>
                <div className={cx('text-[10px] uppercase tracking-[0.2em]', embedded ? 'text-slate-400' : 'text-zinc-500')}>
                  Clip %
                </div>
                <div className={cx('mt-2 text-sm font-semibold', embedded ? 'text-slate-900' : 'text-white')}>
                  {(state.live?.clipPct ?? 0).toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          className={cx(
            'rounded-[24px] border p-4',
            embedded
              ? 'border-slate-200 bg-white shadow-sm'
              : 'border-white/10 bg-white/5 backdrop-blur-xl',
          )}
        >
          {!consent.accepted ? (
            <div
              className={cx(
                'rounded-[20px] border p-4',
                embedded
                  ? 'border-amber-200 bg-amber-50'
                  : 'border-amber-400/20 bg-gradient-to-br from-amber-500/10 via-slate-900 to-slate-950',
              )}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cx(
                    'rounded-2xl p-3',
                    embedded
                      ? 'border border-amber-200 bg-amber-100 text-amber-700'
                      : 'border border-amber-400/20 bg-amber-400/10 text-amber-300',
                  )}
                >
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className={cx('text-sm font-semibold', embedded ? 'text-slate-900' : 'text-white')}>
                    Stethoscope consent required
                  </div>
                  <div className={cx('mt-1 text-xs leading-5', embedded ? 'text-slate-600' : 'text-zinc-300')}>
                    Capture stays locked until this device consent is accepted.
                  </div>
                  <div className={cx('mt-3 text-xs', embedded ? 'text-amber-700' : 'text-amber-200/85')}>
                    <a
                      className="underline decoration-amber-300/60 underline-offset-4 hover:text-inherit"
                      href={consent.pdfUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View consent PDF ({consent.version})
                    </a>
                  </div>
                  <button
                    type="button"
                    onClick={consent.accept}
                    className={cx(
                      'mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition',
                      embedded
                        ? 'border border-amber-200 bg-white text-slate-800 hover:bg-amber-50'
                        : 'border border-amber-300/25 bg-white/10 text-white hover:bg-white/15',
                    )}
                  >
                    <ShieldCheck className="h-4 w-4" />
                    I agree — enable capture
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div
              className={cx(
                'rounded-[20px] border p-4',
                embedded
                  ? 'border-emerald-200 bg-emerald-50'
                  : 'border-emerald-400/20 bg-gradient-to-br from-emerald-500/10 via-slate-900 to-slate-950',
              )}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cx(
                    'rounded-2xl p-3',
                    embedded
                      ? 'border border-emerald-200 bg-emerald-100 text-emerald-700'
                      : 'border border-emerald-400/20 bg-emerald-400/10 text-emerald-300',
                  )}
                >
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <div className={cx('text-sm font-semibold', embedded ? 'text-slate-900' : 'text-white')}>
                    Consent active
                  </div>
                  <div className={cx('mt-1 text-xs leading-5', embedded ? 'text-slate-600' : 'text-zinc-300')}>
                    {consent.version}
                    {consent.acceptedAt
                      ? ` · ${new Date(consent.acceptedAt).toLocaleString()}`
                      : ''}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div
            className={cx(
              'mt-4 rounded-[20px] border p-4',
              embedded ? 'border-slate-200 bg-slate-50' : 'border-white/10 bg-black/25',
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className={cx('text-sm font-semibold', embedded ? 'text-slate-900' : 'text-white')}>
                  Connection + Capture
                </div>
                <div className={cx('text-xs', embedded ? 'text-slate-500' : 'text-zinc-400')}>
                  Session-backed quick controls
                </div>
              </div>
              <div
                className={cx(
                  'rounded-full border px-3 py-1 text-[11px]',
                  embedded
                    ? 'border-slate-200 bg-white text-slate-600'
                    : 'border-white/10 bg-black/25 text-zinc-400',
                )}
              >
                {busy ? 'Busy' : isRecording ? 'Live' : connected ? 'Connected' : 'Ready'}
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <label className="block">
                <div className={cx('mb-2 text-xs font-medium uppercase tracking-[0.18em]', embedded ? 'text-slate-400' : 'text-zinc-500')}>
                  Native MAC override
                </div>
                <input
                  value={deviceMac}
                  onChange={(e) => setDeviceMac(e.target.value)}
                  placeholder="AA:BB:CC:DD:EE:FF"
                  className={cx(
                    'w-full rounded-2xl px-4 py-3 text-sm outline-none',
                    embedded
                      ? 'border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-cyan-300'
                      : 'border border-white/10 bg-slate-950/60 text-white placeholder:text-zinc-500 focus:border-cyan-300/30',
                  )}
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                {!connected ? (
                  <button
                    type="button"
                    onClick={connect}
                    disabled={busy}
                    className={cx(
                      'group relative overflow-hidden rounded-[20px] border px-4 py-4 text-left transition duration-200 disabled:cursor-not-allowed disabled:opacity-50',
                      embedded
                        ? 'border-cyan-200 bg-cyan-50 hover:-translate-y-0.5 hover:border-cyan-300'
                        : 'border-cyan-400/20 bg-gradient-to-br from-cyan-500/15 via-slate-900 to-slate-950 text-white shadow-[0_10px_30px_rgba(0,0,0,0.25)] hover:-translate-y-0.5 hover:border-cyan-300/35 hover:shadow-[0_18px_40px_rgba(6,182,212,0.16)]',
                    )}
                  >
                    <div className="relative flex items-start gap-3">
                      <div
                        className={cx(
                          'rounded-2xl p-3',
                          embedded
                            ? 'border border-cyan-200 bg-white text-cyan-700'
                            : 'border border-cyan-400/20 bg-cyan-400/10 text-cyan-300',
                        )}
                      >
                        {busy ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <Bluetooth className="h-5 w-5" />
                        )}
                      </div>
                      <div>
                        <div className={cx('text-sm font-semibold', embedded ? 'text-slate-900' : 'text-white')}>
                          Connect Stethoscope
                        </div>
                        <div className={cx('mt-1 text-xs leading-5', embedded ? 'text-slate-500' : 'text-zinc-300')}>
                          Web uses Bluetooth picker. Native can use MAC override.
                        </div>
                      </div>
                    </div>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={disconnect}
                    disabled={busy}
                    className={cx(
                      'group relative overflow-hidden rounded-[20px] border px-4 py-4 text-left transition duration-200 disabled:cursor-not-allowed disabled:opacity-50',
                      embedded
                        ? 'border-slate-200 bg-white hover:-translate-y-0.5 hover:border-slate-300'
                        : 'border-slate-300/20 bg-gradient-to-br from-slate-700/20 via-slate-900 to-slate-950 text-white shadow-[0_10px_30px_rgba(0,0,0,0.25)] hover:-translate-y-0.5 hover:border-slate-200/35',
                    )}
                  >
                    <div className="relative flex items-start gap-3">
                      <div
                        className={cx(
                          'rounded-2xl p-3',
                          embedded
                            ? 'border border-slate-200 bg-slate-50 text-slate-700'
                            : 'border border-white/10 bg-white/5 text-zinc-200',
                        )}
                      >
                        <Stethoscope className="h-5 w-5" />
                      </div>
                      <div>
                        <div className={cx('text-sm font-semibold', embedded ? 'text-slate-900' : 'text-white')}>
                          Disconnect
                        </div>
                        <div className={cx('mt-1 text-xs leading-5', embedded ? 'text-slate-500' : 'text-zinc-300')}>
                          Close the active device session cleanly.
                        </div>
                      </div>
                    </div>
                  </button>
                )}

                {!isRecording ? (
                  <button
                    type="button"
                    onClick={startCapture}
                    disabled={busy || !connected || !consent.accepted}
                    className={cx(
                      'group relative overflow-hidden rounded-[20px] border px-4 py-4 text-left transition duration-200 disabled:cursor-not-allowed disabled:opacity-50',
                      embedded
                        ? 'border-emerald-200 bg-emerald-50 hover:-translate-y-0.5 hover:border-emerald-300'
                        : 'border-emerald-400/20 bg-gradient-to-br from-emerald-500/15 via-slate-900 to-slate-950 text-white shadow-[0_10px_30px_rgba(0,0,0,0.25)] hover:-translate-y-0.5 hover:border-emerald-300/35 hover:shadow-[0_18px_40px_rgba(16,185,129,0.16)]',
                    )}
                  >
                    <div className="relative flex items-start gap-3">
                      <div
                        className={cx(
                          'rounded-2xl p-3',
                          embedded
                            ? 'border border-emerald-200 bg-white text-emerald-700'
                            : 'border border-emerald-400/20 bg-emerald-400/10 text-emerald-300',
                        )}
                      >
                        <Mic className="h-5 w-5" />
                      </div>
                      <div>
                        <div className={cx('text-sm font-semibold', embedded ? 'text-slate-900' : 'text-white')}>
                          Start Capture
                        </div>
                        <div className={cx('mt-1 text-xs leading-5', embedded ? 'text-slate-500' : 'text-zinc-300')}>
                          Begin live auscultation and waveform capture.
                        </div>
                      </div>
                    </div>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={stopCapture}
                    disabled={busy}
                    className={cx(
                      'group relative overflow-hidden rounded-[20px] border px-4 py-4 text-left transition duration-200 disabled:cursor-not-allowed disabled:opacity-50',
                      embedded
                        ? 'border-rose-200 bg-rose-50 hover:-translate-y-0.5 hover:border-rose-300'
                        : 'border-rose-400/20 bg-gradient-to-br from-rose-500/15 via-slate-900 to-slate-950 text-white shadow-[0_10px_30px_rgba(0,0,0,0.25)] hover:-translate-y-0.5 hover:border-rose-300/35 hover:shadow-[0_18px_40px_rgba(244,63,94,0.16)]',
                    )}
                  >
                    <div className="relative flex items-start gap-3">
                      <div
                        className={cx(
                          'rounded-2xl p-3',
                          embedded
                            ? 'border border-rose-200 bg-white text-rose-700'
                            : 'border border-rose-400/20 bg-rose-400/10 text-rose-300',
                        )}
                      >
                        <Square className="h-5 w-5" />
                      </div>
                      <div>
                        <div className={cx('text-sm font-semibold', embedded ? 'text-slate-900' : 'text-white')}>
                          Stop Capture
                        </div>
                        <div className={cx('mt-1 text-xs leading-5', embedded ? 'text-slate-500' : 'text-zinc-300')}>
                          End recording and prepare clip playback.
                        </div>
                      </div>
                    </div>
                  </button>
                )}
              </div>
            </div>
          </div>

          <div
            className={cx(
              'mt-4 rounded-[20px] border p-4',
              embedded ? 'border-slate-200 bg-slate-50' : 'border-white/10 bg-black/25',
            )}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div className={cx('text-sm font-semibold', embedded ? 'text-slate-900' : 'text-white')}>
                  Playback + Export
                </div>
                <div className={cx('text-xs', embedded ? 'text-slate-500' : 'text-zinc-400')}>
                  Review the latest captured clip and export it.
                </div>
              </div>
              <div
                className={cx(
                  'rounded-full border px-3 py-1 text-[11px]',
                  embedded
                    ? 'border-slate-200 bg-white text-slate-600'
                    : 'border-white/10 bg-black/25 text-zinc-400',
                )}
              >
                {audioURL ? 'Ready' : 'Awaiting clip'}
              </div>
            </div>

            <label className="block">
              <div className={cx('mb-2 text-xs font-medium uppercase tracking-[0.18em]', embedded ? 'text-slate-400' : 'text-zinc-500')}>
                Encounter note
              </div>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="Optional note for this recording..."
                className={cx(
                  'w-full rounded-2xl px-4 py-3 text-sm outline-none',
                  embedded
                    ? 'border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-cyan-300'
                    : 'border border-white/10 bg-slate-950/60 text-white placeholder:text-zinc-500 focus:border-cyan-300/30',
                )}
              />
            </label>

            {audioURL ? (
              <div className="mt-4 space-y-4">
                <audio controls className="w-full">
                  <source src={audioURL} type="audio/wav" />
                </audio>

                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => {
                      const audio = document.querySelector('audio');
                      audio?.play();
                    }}
                    className={cx(
                      'inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition',
                      embedded
                        ? 'border border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                        : 'border border-white/10 bg-white/5 text-white hover:bg-white/10',
                    )}
                  >
                    <Play className="h-4 w-4" />
                    Play clip
                  </button>

                  <button
                    type="button"
                    onClick={saveClip}
                    className={cx(
                      'inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition',
                      embedded
                        ? 'border border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                        : 'border border-white/10 bg-white/5 text-white hover:bg-white/10',
                    )}
                  >
                    <Download className="h-4 w-4" />
                    Export WAV
                  </button>
                </div>

                {lastClipMeta ? (
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className={cx('rounded-2xl border p-3', embedded ? 'border-slate-200 bg-white' : 'border-white/10 bg-slate-950/70')}>
                      <div className={cx('text-[10px] uppercase tracking-[0.2em]', embedded ? 'text-slate-400' : 'text-zinc-500')}>
                        Duration
                      </div>
                      <div className={cx('mt-2 text-sm font-semibold', embedded ? 'text-slate-900' : 'text-white')}>
                        {typeof lastClipMeta.durationMs === 'number'
                          ? formatMs(lastClipMeta.durationMs)
                          : '—'}
                      </div>
                    </div>

                    <div className={cx('rounded-2xl border p-3', embedded ? 'border-slate-200 bg-white' : 'border-white/10 bg-slate-950/70')}>
                      <div className={cx('text-[10px] uppercase tracking-[0.2em]', embedded ? 'text-slate-400' : 'text-zinc-500')}>
                        Sample rate
                      </div>
                      <div className={cx('mt-2 text-sm font-semibold', embedded ? 'text-slate-900' : 'text-white')}>
                        {lastClipMeta.sampleRate ?? state.sampleRate} Hz
                      </div>
                    </div>

                    <div className={cx('rounded-2xl border p-3', embedded ? 'border-slate-200 bg-white' : 'border-white/10 bg-slate-950/70')}>
                      <div className={cx('text-[10px] uppercase tracking-[0.2em]', embedded ? 'text-slate-400' : 'text-zinc-500')}>
                        Output
                      </div>
                      <div className={cx('mt-2 text-sm font-semibold', embedded ? 'text-slate-900' : 'text-white')}>
                        WAV clip
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div
                className={cx(
                  'mt-4 rounded-2xl border p-4 text-sm',
                  embedded
                    ? 'border-slate-200 bg-white text-slate-500'
                    : 'border-white/10 bg-slate-950/70 text-zinc-400',
                )}
              >
                No clip captured yet. Start and stop capture to prepare playback.
              </div>
            )}

            {audioURL ? (
              <div
                className={cx(
                  'mt-4 rounded-2xl border p-4',
                  embedded ? 'border-slate-200 bg-white' : 'border-white/10 bg-slate-950/70',
                )}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cx(
                      'rounded-2xl p-3',
                      embedded
                        ? 'border border-slate-200 bg-slate-50 text-slate-700'
                        : 'border border-white/10 bg-white/5 text-zinc-200',
                    )}
                  >
                    <Volume2 className="h-5 w-5" />
                  </div>
                  <div>
                    <div className={cx('text-sm font-semibold', embedded ? 'text-slate-900' : 'text-white')}>
                      Playback ready
                    </div>
                    <div className={cx('mt-1 text-xs leading-5', embedded ? 'text-slate-500' : 'text-zinc-400')}>
                      The latest auscultation clip is ready for review and export.
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}