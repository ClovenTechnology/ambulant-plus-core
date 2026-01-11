// apps/patient-app/app/myCare/devices/otoscope/page.tsx
'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  Circle,
  Clipboard,
  Download,
  ExternalLink,
  Info,
  Loader2,
  PauseCircle,
  PlayCircle,
  PlugZap,
  Power,
  RefreshCw,
  Square,
  Trash2,
  Video,
} from 'lucide-react';
import { Otoscope } from '@/hooks/otoscope-plugin';
import { useAuthMe } from '@/src/hooks/useAuthMe';

type Telemetry = {
  connected: boolean;
  usbProduct?: string;
  message?: string;
  width?: number;
  height?: number;
};

type CaptureItem = {
  id: string; // local UI id
  kind: 'photo' | 'video';
  fileUrl: string; // plugin uri at first; replaced with API url after upload
  createdAt: string;

  // internal helpers (not rendered)
  serverId?: string;
  _uploading?: boolean;
  _uploadError?: string | null;
};

function isNativePlatform() {
  try {
    // @ts-expect-error window check
    const C = typeof window !== 'undefined' ? (window as any).Capacitor : undefined;
    return !!C && (C.isNativePlatform?.() || C.isNative);
  } catch {
    return false;
  }
}

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

function fmtRes(tel: Telemetry) {
  return tel.width && tel.height ? `${tel.width}×${tel.height}` : '—';
}

function nowId(prefix: string) {
  return `${prefix}_${Date.now().toString(16)}_${Math.random().toString(16).slice(2)}`;
}

function guessExt(kind: 'photo' | 'video', mime?: string) {
  const m = (mime || '').toLowerCase();
  if (kind === 'photo') {
    if (m.includes('png')) return 'png';
    if (m.includes('webp')) return 'webp';
    if (m.includes('jpeg') || m.includes('jpg')) return 'jpg';
    return 'jpg';
  }
  // video
  if (m.includes('mp4')) return 'mp4';
  if (m.includes('webm')) return 'webm';
  return 'mp4';
}

function safeFileNameFromUrl(url: string, fallback: string) {
  try {
    const clean = String(url || '').split('?')[0].split('#')[0];
    const base = clean.split('/').pop() || '';
    const trimmed = base.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
    return trimmed || fallback;
  } catch {
    return fallback;
  }
}

function dataUrlToBlob(dataUrl: string): { blob: Blob; mime: string } | null {
  try {
    const s = String(dataUrl || '');
    if (!s.startsWith('data:')) return null;

    const comma = s.indexOf(',');
    if (comma === -1) return null;

    const header = s.slice(5, comma); // after "data:"
    const body = s.slice(comma + 1);

    const isBase64 = header.includes(';base64');
    const mime = (header.split(';')[0] || 'application/octet-stream').trim();

    if (isBase64) {
      const bin = atob(body);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return { blob: new Blob([bytes], { type: mime }), mime };
    }

    // url-encoded
    const text = decodeURIComponent(body);
    return { blob: new Blob([text], { type: mime }), mime };
  } catch {
    return null;
  }
}

async function fetchAsBlobBestEffort(uri: string): Promise<{ blob: Blob; mime: string } | null> {
  if (!uri) return null;

  // data: URLs
  const asData = dataUrlToBlob(uri);
  if (asData) return asData;

  // Try direct fetch
  try {
    const r = await fetch(uri, { cache: 'no-store' });
    if (r.ok) {
      const blob = await r.blob();
      return { blob, mime: blob.type || '' };
    }
  } catch {
    // ignore
  }

  // Try Capacitor convertFileSrc then fetch
  try {
    // @ts-expect-error window check
    const C = typeof window !== 'undefined' ? (window as any).Capacitor : undefined;
    const canConvert = !!C?.convertFileSrc;
    if (canConvert) {
      const conv = C.convertFileSrc(uri);
      if (conv) {
        const r2 = await fetch(conv, { cache: 'no-store' });
        if (r2.ok) {
          const blob2 = await r2.blob();
          return { blob: blob2, mime: blob2.type || '' };
        }
      }
    }
  } catch {
    // ignore
  }

  return null;
}

export default function OtoscopeConsole() {
  const { user } = useAuthMe();
  const patientId = user?.id || 'anon';

  const [native, setNative] = useState(false);

  const [tel, setTel] = useState<Telemetry>({ connected: false });
  const [permission, setPermission] = useState<'unknown' | 'granted' | 'denied'>('unknown');

  const [isOpen, setIsOpen] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  const [busy, setBusy] = useState<null | string>(null);
  const [error, setError] = useState<string | null>(null);

  const [captures, setCaptures] = useState<CaptureItem[]>([]);
  const [log, setLog] = useState<string[]>([]);

  const mountedRef = useRef(true);
  const logRef = useRef<string[]>([]);
  const subRef = useRef<{ remove: () => void } | null>(null);

  const push = useCallback((msg: string) => {
    const line = `${new Date().toLocaleTimeString()}  ${msg}`;
    const next = [line, ...logRef.current].slice(0, 300);
    logRef.current = next;
    setLog(next);
  }, []);

  const apiBase = useMemo(() => {
    return `/api/v1/patients/${encodeURIComponent(patientId)}/otoscope-captures`;
  }, [patientId]);

  const loadRecentFromApi = useCallback(async () => {
    if (!native) return;
    try {
      const url = `${apiBase}?limit=12`;
      const r = await fetch(url, { cache: 'no-store' });
      const data = await r.json().catch(() => null);
      if (!r.ok || !data) {
        push(`API list failed (${r.status})`);
        return;
      }
      const items = Array.isArray(data.items) ? data.items : [];
      const mapped: CaptureItem[] = items.map((it: any) => ({
        id: String(it.id || nowId('srv')),
        serverId: String(it.id || ''),
        kind: it.kind === 'photo' ? 'photo' : 'video',
        fileUrl: String(it.fileUrl || ''),
        createdAt: String(it.createdAt || new Date().toISOString()),
      }));

      // Merge: keep local unsaved captures + bring server ones
      setCaptures((prev) => {
        const locals = prev.filter((c) => !c.serverId); // keep local (not uploaded yet)
        const next = [...mapped, ...locals]
          .filter((c) => !!c.fileUrl)
          .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
          .slice(0, 12);
        return next;
      });

      push(`Loaded ${mapped.length} capture(s) from API`);
    } catch (e: any) {
      push(`API list error: ${e?.message || String(e)}`);
    }
  }, [native, apiBase, push]);

  const uploadCaptureToApi = useCallback(
    async (capId: string, kind: 'photo' | 'video', pluginUri: string) => {
      if (!native) return;
      if (!pluginUri) return;

      // mark uploading
      setCaptures((prev) =>
        prev.map((c) =>
          c.id === capId ? { ...c, _uploading: true, _uploadError: null } : c,
        ),
      );

      push(`upload: preparing ${kind}…`);

      const blobRes = await fetchAsBlobBestEffort(pluginUri);
      if (!blobRes?.blob) {
        const msg = 'Could not read captured file for upload (URI not fetchable).';
        push(`upload failed: ${msg}`);
        setCaptures((prev) =>
          prev.map((c) =>
            c.id === capId ? { ...c, _uploading: false, _uploadError: msg } : c,
          ),
        );
        return;
      }

      const mime = blobRes.mime || (kind === 'photo' ? 'image/jpeg' : 'video/mp4');
      const ext = guessExt(kind, mime);
      const fallbackName = `${kind === 'photo' ? 'otoscope_photo' : 'otoscope_video'}_${Date.now()}.${ext}`;
      const fileName = safeFileNameFromUrl(pluginUri, fallbackName);

      try {
        const fd = new FormData();
        const file = new File([blobRes.blob], fileName, { type: mime || undefined });
        fd.append('file', file);
        fd.append('kind', kind);
        fd.append(
          'meta',
          JSON.stringify({
            device: 'otoscope',
            source: 'plugin',
            pluginUri: String(pluginUri).slice(0, 500),
            capturedAt: new Date().toISOString(),
          }),
        );

        const r = await fetch(apiBase, { method: 'POST', body: fd });
        const data = await r.json().catch(() => null);

        if (!r.ok || !data?.ok || !data?.item?.fileUrl) {
          const msg = data?.error ? String(data.error) : `HTTP ${r.status}`;
          push(`upload failed: ${msg}`);
          setCaptures((prev) =>
            prev.map((c) =>
              c.id === capId ? { ...c, _uploading: false, _uploadError: msg } : c,
            ),
          );
          return;
        }

        const serverId = String(data.item.id || '');
        const serverUrl = String(data.item.fileUrl || '');

        // replace local URI with API URL
        setCaptures((prev) =>
          prev.map((c) =>
            c.id === capId
              ? {
                  ...c,
                  serverId,
                  fileUrl: serverUrl,
                  _uploading: false,
                  _uploadError: null,
                }
              : c,
          ),
        );

        push(`upload ok: ${kind} saved to API`);
      } catch (e: any) {
        const msg = e?.message ? String(e.message) : String(e || 'Unknown upload error');
        push(`upload error: ${msg}`);
        setCaptures((prev) =>
          prev.map((c) =>
            c.id === capId ? { ...c, _uploading: false, _uploadError: msg } : c,
          ),
        );
      }
    },
    [native, apiBase, push],
  );

  const banner = useMemo(() => {
    if (!native) {
      return {
        tone: 'amber',
        title: 'Native Android required',
        body:
          'This otoscope console uses a native plugin (USB-OTG). Open Ambulant+ on an Android device (native build) and connect the otoscope via USB-OTG.',
      } as const;
    }
    if (error) {
      return {
        tone: 'rose',
        title: 'Action failed',
        body: error,
      } as const;
    }
    return null;
  }, [native, error]);

  const statusPill = useMemo(() => {
    const ok = tel.connected;
    return (
      <div
        className={cx(
          'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs',
          ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-white text-slate-700',
        )}
      >
        <span className={cx('inline-flex items-center gap-1', ok ? 'text-emerald-700' : 'text-slate-500')}>
          <Circle
            className={cx(
              'h-2.5 w-2.5',
              ok ? 'fill-emerald-500 text-emerald-500' : 'fill-slate-300 text-slate-300',
            )}
          />
          {ok ? 'Connected' : 'Disconnected'}
        </span>
        <span className="text-slate-300">•</span>
        <span className="text-slate-700">{tel.usbProduct ? tel.usbProduct : 'No device'}</span>
        <span className="text-slate-300">•</span>
        <span className="text-slate-700">{fmtRes(tel)}</span>
      </div>
    );
  }, [tel]);

  const canUse = native;
  const canStream = canUse && tel.connected && isOpen && permission !== 'denied';
  const canCapture = canStream && isPreviewing && !isRecording;
  const canRecStart = canStream && isPreviewing && !isRecording;
  const canRecStop = canStream && isRecording;

  async function safeCall<T>(label: string, fn: () => Promise<T>, opts?: { silent?: boolean }) {
    setError(null);
    setBusy(label);
    try {
      push(`→ ${label}`);
      const res = await fn();
      push(`✓ ${label}`);
      return res;
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : String(e || 'Unknown error');
      push(`✕ ${label}: ${msg}`);
      if (!opts?.silent) setError(msg);
      return null;
    } finally {
      if (mountedRef.current) setBusy(null);
    }
  }

  const requestPermission = useCallback(async () => {
    if (!native) return;
    const res = await safeCall(
      'askPermissions()',
      async () => {
        // @ts-ignore
        return await Otoscope.askPermissions();
      },
      { silent: true },
    );

    // We can’t reliably read permission state from plugin in this stub,
    // so infer “granted” if call didn’t throw.
    setPermission(res ? 'granted' : 'unknown');
    if (res) push('Permissions: granted (inferred)');
  }, [native, push]);

  useEffect(() => {
    mountedRef.current = true;
    const n = isNativePlatform();
    setNative(n);

    if (!n) {
      push('Running on web — native Otoscope plugin unavailable.');
      push('Tip: Use the Android native build + USB-OTG.');
      return () => {
        mountedRef.current = false;
      };
    }

    // Setup telemetry listener
    (async () => {
      await requestPermission();

      // Load server-side history (best-effort)
      await loadRecentFromApi();

      try {
        const sub = await Otoscope.addListener('telemetry', (e: any) => {
          if (!mountedRef.current) return;
          setTel({
            connected: !!e?.connected,
            usbProduct: e?.usbProduct,
            message: e?.message,
            width: e?.width,
            height: e?.height,
          });

          // Lightweight log entry (avoid huge JSON spam)
          const bits = [
            `connected=${!!e?.connected}`,
            e?.usbProduct ? `product=${e.usbProduct}` : null,
            e?.width && e?.height ? `res=${e.width}x${e.height}` : null,
            e?.message ? `msg=${String(e.message).slice(0, 80)}` : null,
          ].filter(Boolean);
          push(`telemetry: ${bits.join(' · ')}`);

          // If device drops, reset optimistic session states
          if (!e?.connected) {
            setIsPreviewing(false);
            setIsRecording(false);
          }
        });

        subRef.current = sub as any;
      } catch (e: any) {
        push(`telemetry listener failed: ${e?.message || String(e)}`);
      }
    })();

    return () => {
      mountedRef.current = false;
      try {
        subRef.current?.remove?.();
      } catch {}
      try {
        // @ts-ignore
        Otoscope.stopPreview?.();
      } catch {}
      try {
        // @ts-ignore
        Otoscope.close?.();
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If user loads later (auth hydration), refresh list once.
  useEffect(() => {
    if (!native) return;
    if (!patientId) return;
    void loadRecentFromApi();
  }, [native, patientId, loadRecentFromApi]);

  // Actions
  const open = async () => {
    if (!canUse) return;
    const res = await safeCall('open()', async () => {
      // @ts-ignore
      return await Otoscope.open();
    });
    if (res) setIsOpen(true);
  };

  const close = async () => {
    if (!canUse) return;
    await safeCall(
      'close()',
      async () => {
        // @ts-ignore
        return await Otoscope.close();
      },
      { silent: true },
    );
    setIsOpen(false);
    setIsPreviewing(false);
    setIsRecording(false);
  };

  const startPreview = async () => {
    if (!canUse || !tel.connected) return;
    const res = await safeCall('startPreview(1280×720@30)', async () => {
      // @ts-ignore
      return await Otoscope.startPreview({ width: 1280, height: 720, fps: 30 });
    });
    if (res !== null) setIsPreviewing(true);
  };

  const stopPreview = async () => {
    if (!canUse) return;
    await safeCall(
      'stopPreview()',
      async () => {
        // @ts-ignore
        return await Otoscope.stopPreview();
      },
      { silent: true },
    );
    setIsPreviewing(false);
    setIsRecording(false);
  };

  const snap = async () => {
    if (!canUse) return;
    const r: any = await safeCall('capturePhoto(quality=0.9)', async () => {
      // @ts-ignore
      return await Otoscope.capturePhoto({ quality: 0.9 });
    });

    const pluginUri = r?.fileUrl ? String(r.fileUrl) : '';
    if (!pluginUri) return;

    const localId = nowId('cap');
    const createdAt = new Date().toISOString();

    // optimistic UI: show immediately (plugin URI), then upload in background and replace URL
    setCaptures((prev) => [{ id: localId, kind: 'photo', fileUrl: pluginUri, createdAt }, ...prev].slice(0, 12));

    push('capture: photo saved locally (plugin)');
    void uploadCaptureToApi(localId, 'photo', pluginUri);
  };

  const recStart = async () => {
    if (!canUse) return;
    const res = await safeCall('startRecording(mp4, max=120s)', async () => {
      // @ts-ignore
      return await Otoscope.startRecording({ container: 'mp4', maxSeconds: 120 });
    });
    if (res !== null) setIsRecording(true);
  };

  const recStop = async () => {
    if (!canUse) return;
    const r: any = await safeCall('stopRecording()', async () => {
      // @ts-ignore
      return await Otoscope.stopRecording();
    });
    setIsRecording(false);

    const pluginUri = r?.fileUrl ? String(r.fileUrl) : '';
    if (!pluginUri) return;

    const localId = nowId('cap');
    const createdAt = new Date().toISOString();

    setCaptures((prev) => [{ id: localId, kind: 'video', fileUrl: pluginUri, createdAt }, ...prev].slice(0, 12));

    push('capture: video saved locally (plugin)');
    void uploadCaptureToApi(localId, 'video', pluginUri);
  };

  const refreshTelemetry = async () => {
    if (!canUse) return;
    await requestPermission();
    // If plugin exposes refresh/ping in future, we can call it here.
    push('refresh: permission re-check requested');

    // also refresh capture list (best-effort)
    await loadRecentFromApi();
  };

  const copyLog = async () => {
    try {
      await navigator.clipboard.writeText(log.join('\n'));
      push('log copied to clipboard');
    } catch {
      push('failed to copy log (clipboard not available)');
    }
  };

  const downloadLog = () => {
    try {
      const blob = new Blob([log.join('\n')], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `otoscope_session_log_${Date.now()}.txt`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1200);
      push('log downloaded');
    } catch {
      push('failed to download log');
    }
  };

  const clearLog = () => {
    logRef.current = [];
    setLog([]);
  };

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 space-y-6">
        {/* Header */}
        <header className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <PlugZap className="h-5 w-5 text-slate-400" />
                <h1 className="text-2xl font-semibold tracking-tight text-slate-900">HD Otoscope Console</h1>
              </div>
              <p className="mt-1 text-sm text-slate-600 max-w-2xl">
                Connect your UVC otoscope via USB-OTG, start preview, capture photos, and record short clips for clinical
                review.
              </p>
              <div className="mt-3">{statusPill}</div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={refreshTelemetry}
                disabled={!canUse || !!busy}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {busy === 'askPermissions()' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Refresh
              </button>

              <button
                type="button"
                onClick={permission === 'granted' ? open : requestPermission}
                disabled={!canUse || !!busy}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {busy === 'open()' || busy === 'askPermissions()' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Power className="h-4 w-4" />
                )}
                {permission === 'granted' ? (isOpen ? 'Opened' : 'Open') : 'Allow USB access'}
              </button>
            </div>
          </div>

          {banner ? (
            <div
              className={cx(
                'mt-4 rounded-2xl border px-4 py-3 text-sm',
                banner.tone === 'amber' && 'border-amber-200 bg-amber-50 text-amber-900',
                banner.tone === 'rose' && 'border-rose-200 bg-rose-50 text-rose-900',
              )}
            >
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4" />
                <div>
                  <div className="font-medium">{banner.title}</div>
                  <div className="mt-1 opacity-90">{banner.body}</div>
                </div>
              </div>
            </div>
          ) : null}

          {/* Quick start */}
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-start gap-2">
              <Info className="mt-0.5 h-4 w-4 text-slate-400" />
              <div className="w-full">
                <div className="text-sm font-semibold text-slate-900">Quick start</div>
                <ol className="mt-2 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
                  <li className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                    1) Use the <span className="font-medium">Android native build</span> and connect otoscope via{' '}
                    <span className="font-medium">USB-OTG</span>.
                  </li>
                  <li className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                    2) Tap <span className="font-medium">Allow USB access</span> (first time) then{' '}
                    <span className="font-medium">Open</span>.
                  </li>
                  <li className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                    3) Tap <span className="font-medium">Start Preview</span> then capture a photo or start a short recording.
                  </li>
                  <li className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                    4) Use <span className="font-medium">Export</span> links to share with a clinician (when attached to an
                    encounter).
                  </li>
                </ol>
                <div className="mt-2 text-xs text-slate-500">
                  Preview is handled native-side in this binding; once the vendor SDK confirms a JS thumbnail stream, we’ll
                  surface it here.
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main controls + captures */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Controls */}
          <section className="lg:col-span-2 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Controls</h2>
                <p className="mt-1 text-sm text-slate-600">Open the device, start preview, then capture.</p>
              </div>

              <div className="text-xs text-slate-500">
                Session: {isRecording ? 'Recording…' : isPreviewing ? 'Previewing' : isOpen ? 'Open' : 'Closed'}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={isOpen ? close : open}
                disabled={!canUse || !!busy}
                className={cx(
                  'inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition',
                  isOpen ? 'border border-slate-200 bg-white text-slate-900 hover:bg-slate-50' : 'bg-slate-900 text-white hover:bg-slate-800',
                  (!canUse || !!busy) && 'opacity-50',
                )}
              >
                {busy === 'open()' || busy === 'close()' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}
                {isOpen ? 'Close device' : 'Open device'}
              </button>

              <button
                type="button"
                onClick={isPreviewing ? stopPreview : startPreview}
                disabled={!canUse || !tel.connected || !isOpen || !!busy || isRecording}
                className={cx(
                  'inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50',
                  (!canUse || !tel.connected || !isOpen || !!busy || isRecording) && 'opacity-50',
                )}
              >
                {busy?.startsWith('startPreview') || busy === 'stopPreview()' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isPreviewing ? (
                  <PauseCircle className="h-4 w-4" />
                ) : (
                  <PlayCircle className="h-4 w-4" />
                )}
                {isPreviewing ? 'Stop preview' : 'Start preview'}
              </button>

              <button
                type="button"
                onClick={snap}
                disabled={!canCapture || !!busy}
                className={cx(
                  'inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50',
                  (!canCapture || !!busy) && 'opacity-50',
                )}
              >
                {busy?.startsWith('capturePhoto') ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                Capture photo
              </button>

              <button
                type="button"
                onClick={isRecording ? recStop : recStart}
                disabled={(!canRecStart && !canRecStop) || !!busy}
                className={cx(
                  'inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition',
                  isRecording ? 'bg-rose-600 text-white hover:bg-rose-700' : 'bg-emerald-600 text-white hover:bg-emerald-700',
                  ((!canRecStart && !canRecStop) || !!busy) && 'opacity-50',
                )}
              >
                {busy?.startsWith('startRecording') || busy === 'stopRecording()' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isRecording ? (
                  <Square className="h-4 w-4" />
                ) : (
                  <Video className="h-4 w-4" />
                )}
                {isRecording ? 'Stop recording' : 'Start recording'}
              </button>
            </div>

            {/* Capability notes */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <div className="flex items-start gap-2">
                <Info className="mt-0.5 h-4 w-4 text-slate-400" />
                <div>
                  <div className="font-medium text-slate-900">What you can do here (today)</div>
                  <ul className="mt-2 space-y-1">
                    <li>• Validate connection & resolution via telemetry.</li>
                    <li>• Start native preview (video rendering is native-side in this minimal binding).</li>
                    <li>• Capture photo + record short clips (saved as fileUrl from the plugin).</li>
                    <li>• Auto-upload to v1 API in the background (links become shareable).</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* Captures */}
          <aside className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Captures</h2>
                <p className="mt-1 text-sm text-slate-600">Recent photos and recordings from this device.</p>
              </div>
            </div>

            {captures.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                No captures yet. Start preview, then capture a photo or record a clip.
              </div>
            ) : (
              <div className="space-y-3">
                {captures.map((c) => (
                  <div key={c.id} className="rounded-2xl border border-slate-200 bg-white p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={cx(
                              'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]',
                              c.kind === 'photo'
                                ? 'border-slate-200 bg-slate-50 text-slate-700'
                                : 'border-emerald-200 bg-emerald-50 text-emerald-800',
                            )}
                          >
                            {c.kind === 'photo' ? <Camera className="h-3.5 w-3.5" /> : <Video className="h-3.5 w-3.5" />}
                            {c.kind === 'photo' ? 'Photo' : 'Video'}
                          </span>
                          <span className="text-xs text-slate-500">{new Date(c.createdAt).toLocaleString()}</span>
                        </div>

                        <div className="mt-2 break-all text-xs text-slate-600">{c.fileUrl}</div>
                      </div>

                      <a
                        href={c.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                        title="Open"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </aside>
        </div>

        {/* Logs */}
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Session log</h2>
              <p className="mt-1 text-sm text-slate-600">Useful for QA and plugin troubleshooting. Keep entries short and structured.</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={copyLog}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <Clipboard className="h-4 w-4" />
                Copy
              </button>
              <button
                type="button"
                onClick={downloadLog}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <Download className="h-4 w-4" />
                Download
              </button>
              <button
                type="button"
                onClick={clearLog}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <Trash2 className="h-4 w-4" />
                Clear
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <pre className="text-xs text-slate-800 whitespace-pre-wrap break-words max-h-[340px] overflow-auto">
              {log.length ? log.join('\n') : 'No log entries yet.'}
            </pre>
          </div>

          {tel.message ? (
            <div className="text-xs text-slate-500">
              Last device message: <span className="text-slate-700">{tel.message}</span>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
