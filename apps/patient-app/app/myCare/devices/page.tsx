// apps/patient-app/app/myCare/devices/page.tsx
'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BadgeCheck,
  Bluetooth,
  Cable,
  CheckCircle2,
  ChevronRight,
  Circle,
  Cpu,
  FileText,
  HeartPulse,
  Info,
  Loader2,
  RefreshCw,
  RotateCw,
  Search,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Video,
  Watch,
  XCircle,
} from 'lucide-react';

import { toast } from '@/components/ToastMount';
import { useAuthMe } from '@/src/hooks/useAuthMe';
import type { IomtDeviceKey } from '@/src/lib/consent/iomt';
import { consentPdfUrl, readIomtConsent } from '@/src/lib/consent/iomt';

// ⬇️ bring the same BLE driver used by the Stethoscope console
import { StethoscopeNUS, type StethoscopeTelemetry } from '@/src/devices/decoders/stethoscopeNUS';

type Device = {
  id: string;
  kind: 'wearable' | 'stethoscope' | 'otoscope' | 'monitor' | 'ring' | 'scale' | string;
  vendor: string;
  model: string;
  displayName?: string;
  paired?: boolean;
  lastSeenAt?: string | null;
  status?: 'disconnected' | 'connected' | 'streaming';
};

type ListResp = { devices: Device[] } | Device[];

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

function safeDeviceName(d: Device) {
  const display = String(d.displayName || '').trim();
  if (display) return display;
  const built = [d.vendor, d.model].filter(Boolean).join(' ').trim();
  return built || d.id;
}

function safeDateLabel(iso?: string | null) {
  if (!iso) return '—';
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '—';
  return new Date(t).toLocaleString();
}

function kindLabel(k: Device['kind']) {
  return (
    {
      wearable: 'Wearable',
      stethoscope: 'Stethoscope',
      otoscope: 'Otoscope',
      monitor: 'Health Monitor',
      ring: 'NexRing',
      scale: 'Smart Scale',
    }[k] || k
  );
}

function kindToIomt(k: Device['kind']): IomtDeviceKey | null {
  if (k === 'stethoscope') return 'stethoscope';
  if (k === 'otoscope') return 'otoscope';
  if (k === 'monitor') return 'monitor';
  if (k === 'ring') return 'nexring';
  return null;
}

function deviceConsoleHref(d: Device) {
  if (d.kind === 'otoscope') return '/myCare/devices/otoscope';
  if (d.kind === 'stethoscope') return '/myCare/devices/stethoscope';
  if (d.kind === 'monitor') return '/myCare/devices/health-monitor';
  if (d.kind === 'ring') return '/myCare/devices/nexring';
  return `/myCare/devices/console?deviceId=${encodeURIComponent(d.id)}`;
}

function kindIcon(kind: Device['kind']) {
  const cls = 'h-4.5 w-4.5';
  if (kind === 'stethoscope') return <Stethoscope className={cls} />;
  if (kind === 'otoscope') return <Video className={cls} />;
  if (kind === 'monitor') return <HeartPulse className={cls} />;
  if (kind === 'ring') return <Activity className={cls} />;
  if (kind === 'wearable') return <Watch className={cls} />;
  return <Cpu className={cls} />;
}

function statusTone(s?: Device['status'], paired?: boolean) {
  const v: Device['status'] = s || (paired ? 'connected' : 'disconnected');
  if (v === 'streaming') return { label: 'Streaming', pill: 'bg-emerald-600 text-white', dot: 'bg-emerald-500' };
  if (v === 'connected') return { label: 'Connected', pill: 'bg-indigo-600 text-white', dot: 'bg-indigo-500' };
  return { label: 'Disconnected', pill: 'bg-slate-100 text-slate-700', dot: 'bg-slate-300' };
}

function consentTone(ok: boolean) {
  return ok
    ? { label: 'Accepted', pill: 'bg-emerald-50 text-emerald-800 border-emerald-200', icon: <CheckCircle2 className="h-4 w-4" /> }
    : { label: 'Pending', pill: 'bg-amber-50 text-amber-900 border-amber-200', icon: <XCircle className="h-4 w-4" /> };
}

function classifyBtError(e: unknown): { title: string; detail: string } {
  const name = String((e as any)?.name || '');
  const msg = String((e as any)?.message || e || '');
  if (name === 'NotAllowedError')
    return { title: 'Permission blocked', detail: 'Bluetooth permission was denied or blocked by the browser/OS.' };
  if (name === 'NotFoundError')
    return { title: 'Device not found', detail: 'No device was selected, or the device is unavailable/off.' };
  if (name === 'SecurityError')
    return { title: 'Security restriction', detail: 'Web Bluetooth requires HTTPS and compatible browser settings.' };
  if (name === 'NetworkError' || /gatt|GATT/i.test(msg))
    return { title: 'GATT connection error', detail: msg || 'The device could not be reached or the GATT session failed.' };
  return { title: 'Bluetooth error', detail: msg || 'Unknown Bluetooth failure.' };
}

type StethBtState = {
  connected: boolean;
  connecting: boolean;
  lastSeenAt: number | null;
  packets: number;
  telemetry: StethoscopeTelemetry;
  error: string | null;
};

function stethStateInit(): StethBtState {
  return {
    connected: false,
    connecting: false,
    lastSeenAt: null,
    packets: 0,
    telemetry: { updatedAt: Date.now() },
    error: null,
  };
}

export default function DevicesPage() {
  const { user } = useAuthMe();
  const userId = user?.id || 'anon';

  const [loading, setLoading] = useState(false);
  const [pairingId, setPairingId] = useState<string | null>(null);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [consentTick, setConsentTick] = useState(0);

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'iomt' | 'wearables' | 'connected' | 'disconnected'>('all');

  const firstLoadRef = useRef(false);

  // ====== Stethoscope BLE (Quick Pair from hub) ======
  const SAMPLE_RATE = 8000;

  const supportsBluetooth = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return typeof navigator !== 'undefined' && !!(navigator as any).bluetooth;
  }, []);

  // Keep one NUS instance per hub-card (keyed by device id)
  const stethRefMap = useRef<Map<string, StethoscopeNUS>>(new Map());
  const [stethById, setStethById] = useState<Record<string, StethBtState>>({});

  const patchSteth = useCallback((id: string, patch: Partial<StethBtState>) => {
    setStethById((prev) => {
      const cur = prev[id] ?? stethStateInit();
      return { ...prev, [id]: { ...cur, ...patch } };
    });
  }, []);

  const connectSteth = useCallback(
    async (id: string) => {
      setErr(null);

      if (!supportsBluetooth) {
        toast('Web Bluetooth not supported here. Use Chrome/Edge on desktop or Android (HTTPS).', { type: 'error' });
        patchSteth(id, { error: 'Web Bluetooth not supported on this browser.' });
        return;
      }

      patchSteth(id, { connecting: true, error: null });

      try {
        // stop any previous instance for this card
        const old = stethRefMap.current.get(id);
        if (old) {
          try {
            await old.stop();
          } catch {}
          stethRefMap.current.delete(id);
        }

        const st = new StethoscopeNUS({
          sampleRate: SAMPLE_RATE,
          playToSpeaker: false,
          onChunk: () => {
            patchSteth(id, {
              connected: true,
              lastSeenAt: Date.now(),
              packets: (stethById[id]?.packets ?? 0) + 1,
            });
          },
          onDisconnected: ({ reason }: any) => {
            patchSteth(id, { connected: false, connecting: false });
            toast(`Stethoscope disconnected${reason ? `: ${String(reason)}` : ''}`, { type: 'error' });
          },
          onTelemetry: (t: StethoscopeTelemetry) => {
            patchSteth(id, { telemetry: t, lastSeenAt: Date.now() });
          },
        } as any);

        stethRefMap.current.set(id, st);
        await st.requestAndConnect();

        patchSteth(id, { connected: true, packets: 0, lastSeenAt: Date.now(), error: null });
        toast('Stethoscope connected (this tab).', { type: 'success' });
      } catch (e) {
        const c = classifyBtError(e);
        patchSteth(id, { connected: false, error: `${c.title}: ${c.detail}` });
        toast(`${c.title}: ${c.detail}`, { type: 'error' });
      } finally {
        patchSteth(id, { connecting: false });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [supportsBluetooth, patchSteth, SAMPLE_RATE, stethById],
  );

  const reconnectSteth = useCallback(
    async (id: string) => {
      setErr(null);

      if (!supportsBluetooth) {
        toast('Web Bluetooth not supported here. Use Chrome/Edge on desktop or Android (HTTPS).', { type: 'error' });
        patchSteth(id, { error: 'Web Bluetooth not supported on this browser.' });
        return;
      }

      const st = stethRefMap.current.get(id);
      if (!st) return connectSteth(id);

      patchSteth(id, { connecting: true, error: null });

      try {
        await (st as any).reconnect?.();
        patchSteth(id, { connected: true, lastSeenAt: Date.now(), error: null });
        toast('Stethoscope reconnected (this tab).', { type: 'success' });
      } catch (e) {
        const c = classifyBtError(e);
        patchSteth(id, { connected: false, error: `Reconnect failed: ${c.title}: ${c.detail}` });
        toast(`Reconnect failed: ${c.title}: ${c.detail}`, { type: 'error' });
      } finally {
        patchSteth(id, { connecting: false });
      }
    },
    [connectSteth, patchSteth, supportsBluetooth],
  );

  const disconnectSteth = useCallback(
    async (id: string) => {
      setErr(null);

      const st = stethRefMap.current.get(id);
      patchSteth(id, { connecting: true, error: null });

      try {
        if (st) {
          try {
            await st.stop();
          } catch {}
          stethRefMap.current.delete(id);
        }
        patchSteth(id, { connected: false, connecting: false, lastSeenAt: null, packets: 0 });
        toast('Stethoscope disconnected.', { type: 'success' });
      } finally {
        patchSteth(id, { connecting: false });
      }
    },
    [patchSteth],
  );

  const refreshStethTelemetry = useCallback(
    async (id: string) => {
      const st = stethRefMap.current.get(id);
      if (!st) return;
      try {
        await (st as any).refreshTelemetry?.();
        toast('Telemetry refreshed.', { type: 'success' });
      } catch (e) {
        toast(`Telemetry refresh failed: ${String((e as any)?.message || e)}`, { type: 'error' });
      }
    },
    [],
  );

  // Stop any active stethoscope sessions if the hub unmounts
  useEffect(() => {
    return () => {
      try {
        for (const st of stethRefMap.current.values()) {
          try {
            st.stop();
          } catch {}
        }
        stethRefMap.current.clear();
      } catch {}
    };
  }, []);

  // Recompute consent indicators when coming back / other tab updates.
  useEffect(() => {
    const bump = () => setConsentTick((x) => x + 1);
    window.addEventListener('focus', bump);
    window.addEventListener('visibilitychange', bump);
    window.addEventListener('storage', bump);
    return () => {
      window.removeEventListener('focus', bump);
      window.removeEventListener('visibilitychange', bump);
      window.removeEventListener('storage', bump);
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch('/api/devices/list', { cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j: ListResp = await r.json();
      const list = Array.isArray(j) ? j : j.devices || [];
      setDevices(list);

      // ensure steth state records exist for steth devices (non-breaking)
      setStethById((prev) => {
        let next = prev;
        for (const d of list) {
          if (d.kind !== 'stethoscope') continue;
          if (next[d.id]) continue;
          next = { ...next, [d.id]: stethStateInit() };
        }
        return next;
      });

      if (firstLoadRef.current) toast('Devices refreshed.', { type: 'success' });
      firstLoadRef.current = true;
    } catch (e: any) {
      setErr(e?.message || 'Failed to load devices');
      setDevices([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const consentByDeviceId = useMemo(() => {
    const map = new Map<string, { iomt: IomtDeviceKey; ok: boolean; pdfUrl: string; version: string }>();
    for (const d of devices) {
      const iomt = kindToIomt(d.kind);
      if (!iomt) continue;
      const rec = readIomtConsent(userId, iomt);
      map.set(d.id, { iomt, ok: !!rec.ok, pdfUrl: consentPdfUrl(iomt), version: rec.version });
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    consentTick;
    return map;
  }, [devices, userId, consentTick]);

  const stats = useMemo(() => {
    const total = devices.length;
    const iomt = devices.filter((d) => !!kindToIomt(d.kind)).length;

    const connected = devices.filter((d) => {
      if (d.kind === 'stethoscope') {
        const bt = stethById[d.id];
        if (bt?.connected) return true;
      }
      const status = d.status || (d.paired ? 'connected' : 'disconnected');
      return status !== 'disconnected';
    }).length;

    const streaming = devices.filter((d) => (d.status || '') === 'streaming').length;

    let consentAccepted = 0;
    let consentPending = 0;
    for (const d of devices) {
      const c = consentByDeviceId.get(d.id);
      if (!c) continue;
      if (c.ok) consentAccepted += 1;
      else consentPending += 1;
    }

    return { total, iomt, connected, streaming, consentAccepted, consentPending };
  }, [devices, consentByDeviceId, stethById]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    const passText = (d: Device) => {
      if (!q) return true;
      const hay = `${safeDeviceName(d)} ${d.vendor} ${d.model} ${d.id} ${kindLabel(d.kind)}`.toLowerCase();
      return hay.includes(q);
    };

    const passFilter = (d: Device) => {
      const btConnected = d.kind === 'stethoscope' ? !!stethById[d.id]?.connected : false;
      const status = btConnected ? 'connected' : d.status || (d.paired ? 'connected' : 'disconnected');
      const isIomt = !!kindToIomt(d.kind);

      if (filter === 'all') return true;
      if (filter === 'iomt') return isIomt;
      if (filter === 'wearables') return !isIomt;
      if (filter === 'connected') return status !== 'disconnected';
      if (filter === 'disconnected') return status === 'disconnected';
      return true;
    };

    return [...devices]
      .filter(passText)
      .filter(passFilter)
      .sort((a, b) => safeDeviceName(a).localeCompare(safeDeviceName(b)));
  }, [devices, query, filter, stethById]);

  const onPair = useCallback(
    async (id: string) => {
      setPairingId(id);
      setErr(null);
      try {
        const r = await fetch('/api/devices/pair', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ deviceId: id }),
        });
        if (!r.ok) {
          const t = await r.text().catch(() => '');
          throw new Error(t || `HTTP ${r.status}`);
        }
        await load();
        toast('Pairing started. Confirm the system Bluetooth/USB prompt if shown.', { type: 'success' });
      } catch (e: any) {
        toast(`Pair failed: ${e?.message || e}`, { type: 'error' });
      } finally {
        setPairingId(null);
      }
    },
    [load],
  );

  const onStream = useCallback(async (id: string, kind?: Device['kind']) => {
    setStreamingId(id);
    setErr(null);

    // Stethoscope streaming happens in its own console (Web Bluetooth local session)
    if (kind === 'stethoscope') {
      window.location.href = '/myCare/devices/stethoscope';
      setStreamingId(null);
      return;
    }

    try {
      const r = await fetch('/api/devices/stream', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ deviceId: id }),
      });
      const j = await r.json().catch(() => ({}));
      const url: string = j?.consoleUrl || `/myCare/devices/console?deviceId=${encodeURIComponent(id)}`;
      window.location.href = url;
    } catch (e: any) {
      toast(`Stream start failed: ${e?.message || e}`, { type: 'error' });
    } finally {
      setStreamingId(null);
    }
  }, []);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 space-y-6">
        {/* HERO */}
        <header className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="pointer-events-none absolute inset-0 opacity-[0.18]">
            <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-indigo-400 blur-3xl" />
            <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-emerald-400 blur-3xl" />
          </div>

          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-3 py-1.5 text-xs text-slate-700 backdrop-blur">
                <Sparkles className="h-4 w-4 text-slate-500" />
                IoMT & Wearables Hub
                <span className="text-slate-300">•</span>
                Consent-aware
                <span className="text-slate-300">•</span>
                Device consoles
              </div>

              <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">My Devices</h1>
              <p className="mt-1 max-w-2xl text-sm text-slate-600">
                Pair your wearables and IoMT devices, review consent PDFs (version-locked), open consoles — and now you can also connect the
                stethoscope directly from here via Web Bluetooth.
              </p>

              {!supportsBluetooth ? (
                <div className="mt-3 inline-flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  <AlertTriangle className="mt-0.5 h-4 w-4" />
                  <div>
                    <div className="font-semibold">Web Bluetooth not available</div>
                    <div className="mt-1 text-amber-800">Stethoscope “Connect” works on Chrome/Edge (HTTPS) on desktop or Android.</div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="relative flex flex-wrap items-center gap-2">
              <button
                onClick={load}
                className={cx(
                  'inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50',
                  loading && 'opacity-70',
                )}
                disabled={loading}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {loading ? 'Refreshing…' : 'Refresh'}
              </button>

              <div className="hidden sm:flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
                <ShieldCheck className="h-4 w-4 text-slate-500" />
                Consent is stored locally per user + device + version
              </div>
            </div>
          </div>

          {/* STAT STRIP */}
          <div className="relative mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-2xl border border-slate-200 bg-white/70 p-4 backdrop-blur">
              <div className="text-xs text-slate-500">Total</div>
              <div className="mt-1 flex items-baseline justify-between">
                <div className="text-2xl font-semibold text-slate-900">{stats.total}</div>
                <div className="text-xs text-slate-500">devices</div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white/70 p-4 backdrop-blur">
              <div className="text-xs text-slate-500">IoMT</div>
              <div className="mt-1 flex items-baseline justify-between">
                <div className="text-2xl font-semibold text-slate-900">{stats.iomt}</div>
                <div className="text-xs text-slate-500">clinical</div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white/70 p-4 backdrop-blur">
              <div className="text-xs text-slate-500">Connected</div>
              <div className="mt-1 flex items-baseline justify-between">
                <div className="text-2xl font-semibold text-slate-900">{stats.connected}</div>
                <div className="text-xs text-slate-500">online</div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white/70 p-4 backdrop-blur">
              <div className="text-xs text-slate-500">Streaming</div>
              <div className="mt-1 flex items-baseline justify-between">
                <div className="text-2xl font-semibold text-slate-900">{stats.streaming}</div>
                <div className="text-xs text-slate-500">active</div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white/70 p-4 backdrop-blur">
              <div className="text-xs text-slate-500">Consent</div>
              <div className="mt-1 flex items-baseline justify-between">
                <div className="text-2xl font-semibold text-slate-900">
                  {stats.consentAccepted}
                  <span className="text-slate-400">/</span>
                  {stats.consentAccepted + stats.consentPending}
                </div>
                <div className="text-xs text-slate-500">accepted</div>
              </div>
            </div>
          </div>

          {/* SEARCH + FILTERS */}
          <div className="relative mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex w-full items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, vendor, model, kind, id…"
                className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 outline-none"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                >
                  Clear
                </button>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  ['all', 'All'],
                  ['iomt', 'IoMT'],
                  ['wearables', 'Wearables'],
                  ['connected', 'Connected'],
                  ['disconnected', 'Disconnected'],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setFilter(k)}
                  className={cx(
                    'rounded-full border px-3 py-1.5 text-xs font-medium transition',
                    filter === k ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {err && (
            <div className="relative mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{err}</div>
          )}
        </header>

        {/* GRID */}
        <section className="grid gap-4 md:grid-cols-2">
          {filtered.map((d) => {
            const name = safeDeviceName(d);

            const st = d.kind === 'stethoscope' ? stethById[d.id] : null;
            const stConnected = !!st?.connected;
            const stConnecting = !!st?.connecting;
            const stHasInstance = d.kind === 'stethoscope' ? stethRefMap.current.has(d.id) : false;

            const displayStatus: Device['status'] | undefined =
              d.kind === 'stethoscope' ? (stConnected ? 'connected' : 'disconnected') : d.status;

            const status = statusTone(displayStatus, d.paired);

            const consent = consentByDeviceId.get(d.id) || null;
            const consentUi = consent ? consentTone(consent.ok) : null;

            const consoleHref = deviceConsoleHref(d);

            const isBusy =
              pairingId === d.id ||
              streamingId === d.id ||
              (d.kind === 'stethoscope' ? stConnecting : false);

            const isIomt = !!kindToIomt(d.kind);

            const linkHint =
              d.kind === 'otoscope'
                ? 'Otoscope console'
                : d.kind === 'stethoscope'
                ? 'Stethoscope console'
                : d.kind === 'monitor'
                ? 'Health Monitor console'
                : d.kind === 'ring'
                ? 'NexRing console'
                : 'Generic console';

            const lastSeenLabel =
              d.kind === 'stethoscope' && st?.lastSeenAt ? new Date(st.lastSeenAt).toLocaleString() : safeDateLabel(d.lastSeenAt);

            const stethTelemetry = d.kind === 'stethoscope' ? st?.telemetry : null;

            return (
              <div
                key={d.id}
                className={cx(
                  'group rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md',
                  isBusy && 'opacity-80',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-700">
                        {kindIcon(d.kind)}
                      </div>

                      <div className="min-w-0">
                        <div className="truncate text-base font-semibold text-slate-900">{name}</div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5">
                            <Circle className={cx('h-2 w-2', status.dot)} />
                            {kindLabel(d.kind)}
                          </span>

                          <span className={cx('inline-flex rounded-full px-2 py-0.5 text-xs', status.pill)}>{status.label}</span>

                          {isIomt ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5">
                              <BadgeCheck className="h-4 w-4 text-slate-500" />
                              IoMT
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5">
                              <Watch className="h-4 w-4 text-slate-500" />
                              Wearable
                            </span>
                          )}

                          {d.kind === 'stethoscope' ? (
                            <span
                              className={cx(
                                'inline-flex items-center gap-1 rounded-full border px-2 py-0.5',
                                stConnected ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-white text-slate-600',
                              )}
                              title="Stethoscope connection is per-browser-tab (Web Bluetooth)"
                            >
                              <Bluetooth className="h-4 w-4" />
                              {stConnected ? 'BLE connected' : 'BLE idle'}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        <div className="text-[11px] text-slate-500">Vendor • Model</div>
                        <div className="mt-1 font-medium text-slate-900">
                          {(d.vendor || '—') + (d.model ? ` • ${d.model}` : '')}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        <div className="text-[11px] text-slate-500">Last seen</div>
                        <div className="mt-1 font-medium text-slate-900">{lastSeenLabel}</div>
                      </div>
                    </div>

                    {/* Stethoscope quick telemetry (from BLE session) */}
                    {d.kind === 'stethoscope' ? (
                      <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="inline-flex items-center gap-2 text-xs text-slate-600">
                            <Stethoscope className="h-4 w-4 text-slate-500" />
                            Stethoscope quick connect
                            <span className="text-slate-300">•</span>
                            <span className="text-slate-500">tab-scoped</span>
                          </div>

                          <button
                            type="button"
                            onClick={() => void refreshStethTelemetry(d.id)}
                            disabled={!stConnected}
                            className={cx(
                              'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold',
                              stConnected ? 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50' : 'border-slate-200 bg-white text-slate-400',
                            )}
                            title="Refresh telemetry"
                          >
                            <RotateCw className="h-3.5 w-3.5" />
                            Refresh
                          </button>
                        </div>

                        <div className="mt-2 grid gap-2 text-xs sm:grid-cols-3">
                          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                            <div className="text-[11px] text-slate-500">Battery</div>
                            <div className="mt-0.5 font-semibold text-slate-900 tabular-nums">
                              {Number.isFinite(stethTelemetry?.batteryPct) ? `${stethTelemetry?.batteryPct}%` : '—'}
                            </div>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                            <div className="text-[11px] text-slate-500">Firmware</div>
                            <div className="mt-0.5 font-semibold text-slate-900">{stethTelemetry?.firmware || '—'}</div>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                            <div className="text-[11px] text-slate-500">Packets</div>
                            <div className="mt-0.5 font-semibold text-slate-900 tabular-nums">{st?.packets ?? 0}</div>
                          </div>
                        </div>

                        {!supportsBluetooth ? (
                          <div className="mt-2 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                            <Info className="mt-0.5 h-4 w-4" />
                            <div>Web Bluetooth not available here. Use Chrome/Edge (HTTPS) on desktop/Android.</div>
                          </div>
                        ) : null}

                        {st?.error ? (
                          <div className="mt-2 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900">
                            <AlertTriangle className="mt-0.5 h-4 w-4" />
                            <div>{st.error}</div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <Link
                    href={consoleHref}
                    className="inline-flex shrink-0 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
                    title={linkHint}
                  >
                    Open
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>

                {/* Consent row */}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="inline-flex items-center gap-2 text-xs text-slate-600">
                      <ShieldCheck className="h-4 w-4 text-slate-500" />
                      Consent
                    </div>

                    {consentUi ? (
                      <div
                        className={cx('inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs', consentUi.pill)}
                        title={consent ? `Version: ${consent.version}` : undefined}
                      >
                        {consentUi.icon}
                        {consentUi.label}
                        {consent ? <span className="text-slate-400">•</span> : null}
                        {consent ? <span className="text-[11px]">{consent.version}</span> : null}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400">—</div>
                    )}

                    {consent ? (
                      <a
                        href={consent.pdfUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                        title="Open consent PDF"
                      >
                        <FileText className="h-4 w-4 text-slate-500" />
                        PDF
                        <ArrowUpRight className="h-3.5 w-3.5 text-slate-400" />
                      </a>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Pair button: for stethoscope we do Web Bluetooth connect/reconnect */}
                    {d.kind === 'stethoscope' ? (
                      <>
                        {!stConnected ? (
                          <button
                            onClick={() => (stHasInstance ? void reconnectSteth(d.id) : void connectSteth(d.id))}
                            disabled={stConnecting || loading}
                            className={cx(
                              'inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition',
                              stConnecting ? 'border-slate-200 bg-slate-100 text-slate-600' : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50',
                              (stConnecting || loading) && 'opacity-70',
                            )}
                            title={stHasInstance ? 'Reconnect to last selected stethoscope (this tab)' : 'Connect stethoscope via Web Bluetooth'}
                          >
                            {stConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bluetooth className="h-4 w-4 text-slate-500" />}
                            {stConnecting ? 'Connecting…' : stHasInstance ? 'Reconnect' : 'Connect'}
                          </button>
                        ) : (
                          <button
                            onClick={() => void disconnectSteth(d.id)}
                            disabled={stConnecting || loading}
                            className={cx(
                              'inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition',
                              'border-slate-200 bg-white text-slate-800 hover:bg-slate-50',
                              (stConnecting || loading) && 'opacity-70',
                            )}
                            title="Disconnect stethoscope (this tab)"
                          >
                            {stConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4 text-slate-500" />}
                            {stConnecting ? 'Disconnecting…' : 'Disconnect'}
                          </button>
                        )}

                        <button
                          onClick={() => void onStream(d.id, d.kind)}
                          disabled={streamingId === d.id || loading}
                          className={cx(
                            'inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold transition',
                            streamingId === d.id ? 'bg-slate-200 text-slate-700' : 'bg-slate-900 text-white hover:bg-slate-800',
                            (streamingId === d.id || loading) && 'opacity-70',
                          )}
                          title="Open stethoscope console"
                        >
                          {streamingId === d.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Stethoscope className="h-4 w-4" />}
                          {streamingId === d.id ? 'Opening…' : 'Console'}
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => onPair(d.id)}
                          disabled={pairingId === d.id || loading}
                          className={cx(
                            'inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition',
                            pairingId === d.id ? 'border-slate-200 bg-slate-100 text-slate-600' : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50',
                            (pairingId === d.id || loading) && 'opacity-70',
                          )}
                          title="Pair / bind over BLE"
                        >
                          {pairingId === d.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bluetooth className="h-4 w-4 text-slate-500" />}
                          {pairingId === d.id ? 'Pairing…' : 'Pair'}
                        </button>

                        <button
                          onClick={() => void onStream(d.id, d.kind)}
                          disabled={streamingId === d.id || loading}
                          className={cx(
                            'inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold transition',
                            streamingId === d.id ? 'bg-slate-200 text-slate-700' : 'bg-slate-900 text-white hover:bg-slate-800',
                            (streamingId === d.id || loading) && 'opacity-70',
                          )}
                          title="Start streaming session"
                        >
                          {streamingId === d.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Cable className="h-4 w-4" />}
                          {streamingId === d.id ? 'Starting…' : 'Stream'}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Subtle footer */}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
                  <div className="truncate">
                    <span className="text-slate-400">ID:</span> {d.id}
                  </div>
                  <div className="inline-flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5">
                      <Cpu className="h-3.5 w-3.5 text-slate-400" />
                      {kindLabel(d.kind)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="md:col-span-2 rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
              <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-700">
                <Search className="h-5 w-5" />
              </div>
              <div className="mt-3 text-lg font-semibold text-slate-900">No devices match</div>
              <div className="mt-1 text-sm text-slate-600">Try a different search term or change your filter.</div>

              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    setFilter('all');
                  }}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={load}
                  className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  Refresh devices
                </button>
              </div>
            </div>
          )}
        </section>

        {/* FOOTNOTE */}
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-900">Device consoles</div>
              <p className="mt-1 text-sm text-slate-600">
                Otoscope, Stethoscope, Health Monitor and NexRing open dedicated consoles. Unknown devices fall back to the generic console.
                <span className="block mt-1 text-xs text-slate-500">
                  Note: Stethoscope “Connected” is tab-scoped (Web Bluetooth). It won’t persist across tabs/devices.
                </span>
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-600">
              <ShieldCheck className="h-4 w-4 text-slate-500" />
              Consent is version-locked via local PDF naming.
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
