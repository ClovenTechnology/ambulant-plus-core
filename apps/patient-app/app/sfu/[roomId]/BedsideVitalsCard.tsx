// apps/patient-app/app/sfu/[roomId]/BedsideVitalsCard.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';

import MeterDonut from '../../../components/charts/MeterDonut';
import Sparkline from '../../../components/charts/Sparkline';
import BpChart, { type BpPoint } from '../../../components/charts/BpChart';

import { Card, Collapse, CollapseBtn, Icon, Tabs } from './ui';

/* ------------------------------
   Helpers
--------------------------------*/

const round1 = (n: number) => Math.round(n * 10) / 10;

const fmt = (x?: number | string | null) =>
  x === undefined || x === null || Number.isNaN(Number(x)) ? '—' : String(x);

function asFiniteNumber(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function readNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.map(asFiniteNumber).filter((x): x is number => typeof x === 'number');
}

type Vitals = {
  ts: number;
  hr?: number;
  spo2?: number;
  sys?: number;
  dia?: number;
  map?: number;
  rr?: number;
  tempC?: number;
  glucose?: number;
  steps?: number;
  calories?: number;
  distanceKm?: number;
  stress?: number;
  sleepStage?: number;
};

function normalizeVitals(input: any): Vitals | null {
  const source = input?.vitals ?? input?.data ?? input;
  if (!source || typeof source !== 'object') return null;

  const tsRaw = source.ts ?? source.timestamp ?? source.createdAt;
  const ts =
    typeof tsRaw === 'number'
      ? tsRaw
      : typeof tsRaw === 'string'
        ? Date.parse(tsRaw)
        : Date.now();

  const sys = asFiniteNumber(source.sys ?? source.systolic);
  const dia = asFiniteNumber(source.dia ?? source.diastolic);

  const vitals: Vitals = {
    ts: Number.isFinite(ts) ? ts : Date.now(),
    hr: asFiniteNumber(source.hr ?? source.heartRate ?? source.heart_rate),
    spo2: asFiniteNumber(source.spo2 ?? source.SpO2 ?? source.oxygenSaturation),
    sys,
    dia,
    map: asFiniteNumber(source.map),
    rr: asFiniteNumber(source.rr ?? source.respiratoryRate),
    tempC: asFiniteNumber(source.tempC ?? source.temp_c ?? source.temperatureC),
    glucose: asFiniteNumber(source.glucose ?? source.glucose_mg_dl),
    steps: asFiniteNumber(source.steps),
    calories: asFiniteNumber(source.calories ?? source.calories_kcal),
    distanceKm: asFiniteNumber(source.distanceKm ?? source.distance_km),
    stress: asFiniteNumber(source.stress),
    sleepStage: asFiniteNumber(source.sleepStage ?? source.sleep_stage),
  };

  if (vitals.map === undefined && sys !== undefined && dia !== undefined) {
    vitals.map = round1((sys + 2 * dia) / 3);
  }

  const hasAny =
    vitals.hr !== undefined ||
    vitals.spo2 !== undefined ||
    vitals.sys !== undefined ||
    vitals.dia !== undefined ||
    vitals.rr !== undefined ||
    vitals.tempC !== undefined ||
    vitals.glucose !== undefined ||
    vitals.steps !== undefined ||
    vitals.calories !== undefined ||
    vitals.distanceKm !== undefined ||
    vitals.stress !== undefined ||
    vitals.sleepStage !== undefined;

  return hasAny ? vitals : null;
}

/* ------------------------------
   Component
--------------------------------*/

type DeviceTab = 'wearable' | 'monitor' | 'stetho' | 'otoscope';

export function BedsideVitalsCard({
  dense,
  open,
  onToggleOpen,
  vitalsEnabled,
}: {
  dense?: boolean;
  open: boolean;
  onToggleOpen: () => void;
  vitalsEnabled: boolean;
}) {
  return (
    <Card
      title="Bedside Monitor (live)"
      toolbar={<CollapseBtn open={open} onClick={onToggleOpen} />}
      dense={dense}
    >
      <Collapse open={open}>
        <BedsideDeck vitalsEnabled={vitalsEnabled} />
        <div className="mt-2 text-xs text-gray-500">
          Streams from supported IoMT/device sources through{' '}
          <code className="rounded bg-gray-100 px-1">BroadcastChannel('ambulant-iomt')</code>
          {vitalsEnabled ? '; forwarding is enabled.' : '; forwarding is currently off.'}
        </div>
      </Collapse>
    </Card>
  );
}

function BedsideDeck({ vitalsEnabled }: { vitalsEnabled: boolean }) {
  const [tab, setTab] = useState<DeviceTab>('wearable');
  const [series, setSeries] = useState<Vitals[]>([]);
  const [ecgOn, setEcgOn] = useState(false);

  useEffect(() => {
    function pushVitals(payload: any) {
      const next = normalizeVitals(payload);
      if (!next) return;

      setSeries((old) => {
        const rows = [...old, next].sort((a, b) => a.ts - b.ts);
        return rows.slice(-240);
      });
    }

    function onWindowMessage(ev: MessageEvent) {
      const payload = ev.data;
      if (!payload || typeof payload !== 'object') return;

      if (payload.type === 'vitals' || payload.vitals) {
        pushVitals(payload);
      }
    }

    window.addEventListener('message', onWindowMessage);

    let bc: BroadcastChannel | null = null;

    try {
      bc = new BroadcastChannel('ambulant-iomt');
      bc.onmessage = (ev) => {
        const payload = ev.data;
        if (!payload || typeof payload !== 'object') return;

        if (payload.type === 'vitals' || payload.vitals) {
          pushVitals(payload);
        }
      };
    } catch {
      bc = null;
    }

    return () => {
      window.removeEventListener('message', onWindowMessage);
      try {
        bc?.close();
      } catch {}
    };
  }, []);

  const latest = series.length ? series[series.length - 1] : undefined;

  const hrSeries = useMemo(
    () =>
      series
        .filter((s) => typeof s.hr === 'number')
        .map((s) => ({ t: s.ts, y: s.hr as number })),
    [series],
  );

  const bpSeries: BpPoint[] = useMemo(
    () =>
      series
        .filter((s) => typeof s.sys === 'number' && typeof s.dia === 'number')
        .map((s) => ({
          ts: s.ts,
          sys: s.sys as number,
          dia: s.dia as number,
        })),
    [series],
  );

  const stressValues = useMemo(
    () =>
      series
        .filter((s) => typeof s.stress === 'number')
        .map((s) => s.stress as number),
    [series],
  );

  const sleepValues = useMemo(
    () =>
      series
        .filter((s) => typeof s.sleepStage === 'number')
        .map((s) => s.sleepStage as number),
    [series],
  );

  const hrValues = useMemo(() => hrSeries.map((p) => p.y), [hrSeries]);

  const externalSleepValues = useMemo(() => {
    const raw = (latest as any)?.sleep?.stages ?? (latest as any)?.sleepStages;
    return readNumberArray(raw);
  }, [latest]);

  const effectiveSleepValues = externalSleepValues.length ? externalSleepValues : sleepValues;

  const latestLabel = latest ? new Date(latest.ts).toLocaleTimeString() : '—';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Tabs<DeviceTab>
          items={[
            { key: 'wearable', label: 'Wearable' },
            { key: 'monitor', label: 'Health Monitor' },
            { key: 'stetho', label: 'Stethoscope' },
            { key: 'otoscope', label: 'Otoscope' },
          ]}
          active={tab}
          onChange={setTab}
        />
        <span className="text-xs text-gray-500" suppressHydrationWarning>
          {latestLabel}
        </span>
      </div>

      {!latest && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          No live bedside vitals are currently streaming. Connect a supported device or start
          the Health Monitor stream to populate this panel.
        </div>
      )}

      {tab === 'wearable' && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <MeterDonut
              value={latest?.steps ?? 0}
              max={10000}
              label="Steps"
              color="#34D399"
              unit=""
            />
            <MeterDonut
              value={latest?.calories ?? 0}
              max={2000}
              label="Calories"
              color="#F59E0B"
              unit=""
            />
            <MeterDonut
              value={latest?.distanceKm ?? 0}
              max={10}
              label="Distance (km)"
              color="#3B82F6"
              unit=""
            />
          </div>

          <div>
            <div className="mb-1 text-xs text-slate-500">
              Sleep stages (0 Awake · 1 Light · 2 Deep · 3 REM)
            </div>
            <div className="rounded-xl border bg-white p-2">
              {effectiveSleepValues.length ? (
                <Sparkline values={effectiveSleepValues} height={88} />
              ) : (
                <EmptyChartLabel label="No sleep-stage telemetry available" height={88} />
              )}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border bg-white p-2">
              <div className="mb-1 text-xs text-slate-500">Daytime stress</div>
              {stressValues.length ? (
                <Sparkline values={stressValues} height={64} />
              ) : (
                <EmptyChartLabel label="No stress telemetry available" height={64} />
              )}
            </div>

            <div className="rounded-xl border bg-white p-2">
              <div className="mb-1 text-xs text-slate-500">Live heart rate</div>
              {hrValues.length ? (
                <Sparkline values={hrValues} height={64} />
              ) : (
                <EmptyChartLabel label="No heart-rate telemetry available" height={64} />
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'monitor' && (
        <div className="space-y-3">
          <div className="grid gap-2 md:grid-cols-6">
            {[
              { key: 'glucose', label: 'Glucose', available: latest?.glucose !== undefined },
              {
                key: 'bp',
                label: 'Blood Pressure',
                available: latest?.sys !== undefined && latest?.dia !== undefined,
              },
              { key: 'spo2', label: 'SpO₂', available: latest?.spo2 !== undefined },
              { key: 'tempC', label: 'Temp', available: latest?.tempC !== undefined },
              { key: 'hr', label: 'Heart Rate', available: latest?.hr !== undefined },
              { key: 'ecg', label: 'ECG', available: false },
            ].map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => {
                  if (f.key === 'ecg') setEcgOn((v) => !v);
                }}
                className="relative rounded-xl border bg-white p-2 text-xs hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                title={f.available ? f.label : `${f.label} not streaming yet`}
                disabled={f.key !== 'ecg' && !f.available}
              >
                <div className="font-medium">{f.label}</div>
                <div className="mt-1 text-[11px] text-slate-500">
                  {f.available ? 'Live' : 'No data'}
                </div>
              </button>
            ))}
          </div>

          <div className="rounded-xl border bg-white p-3">
            <div className="mb-2 text-sm font-medium">Results</div>

            <div className="grid gap-2 text-sm md:grid-cols-3">
              <Result label="Glucose" value={fmt(latest?.glucose)} unit="mg/dL" />
              <Result label="SpO₂" value={fmt(latest?.spo2)} unit="%" />
              <Result label="Temp" value={fmt(latest?.tempC)} unit="°C" />
              <Result label="HR" value={fmt(latest?.hr)} unit="bpm" />
              <Result label="BP SYS" value={fmt(latest?.sys)} unit="mmHg" />
              <Result label="BP DIA" value={fmt(latest?.dia)} unit="mmHg" />
            </div>

            <div className="mt-3">
              {bpSeries.length ? (
                <BpChart data={bpSeries} />
              ) : (
                <div className="rounded-xl border border-dashed bg-slate-50 p-4 text-center text-xs text-slate-500">
                  No blood-pressure telemetry available.
                </div>
              )}
            </div>

            <div className="mt-3 rounded-xl border bg-[#0b1020] p-2">
              <div className="flex items-center justify-between">
                <div className="inline-flex items-center gap-2 text-sm font-medium text-slate-200">
                  <Icon name="heart" /> ECG {ecgOn ? '(awaiting device stream)' : '(stopped)'}
                </div>
                <button
                  type="button"
                  onClick={() => setEcgOn((v) => !v)}
                  className={`rounded px-2 py-1 text-xs ${
                    ecgOn ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'
                  }`}
                >
                  {ecgOn ? 'Stop' : 'Start'}
                </button>
              </div>

              <div className="mt-2 h-36">
                <EmptyChartLabel
                  label={
                    ecgOn
                      ? 'Waiting for ECG packets from the Health Monitor.'
                      : 'ECG stream is not active.'
                  }
                  height={144}
                  dark
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'stetho' && <StethoscopePane />}
      {tab === 'otoscope' && <OtoscopePane />}
    </div>
  );
}

function EmptyChartLabel({
  label,
  height,
  dark,
}: {
  label: string;
  height: number;
  dark?: boolean;
}) {
  return (
    <div
      className={`grid place-items-center rounded-lg text-xs ${
        dark ? 'bg-slate-950 text-slate-400' : 'bg-slate-50 text-slate-400'
      }`}
      style={{ height }}
    >
      {label}
    </div>
  );
}

function Result({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit?: string;
}) {
  return (
    <div className="flex items-baseline justify-between rounded border bg-white p-2">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-sm font-semibold">
        {value}
        {unit && value !== '—' ? ` ${unit}` : ''}
      </div>
    </div>
  );
}

/* ------------------------------
   Stethoscope
--------------------------------*/

function StethoscopePane() {
  return (
    <div className="space-y-3">
      <Tabs<'heart' | 'lung'>
        items={[
          { key: 'heart', label: 'Heart' },
          { key: 'lung', label: 'Lungs' },
        ]}
        active="heart"
        onChange={() => {}}
      />

      <div className="rounded-xl border bg-white p-3">
        <div className="text-sm font-medium text-gray-800">Digital stethoscope</div>
        <p className="mt-1 text-xs leading-5 text-gray-600">
          Live stethoscope capture is available only when the production digital
          stethoscope stream is connected. Synthetic auscultation sounds are disabled in
          production.
        </p>

        <div className="mt-3 rounded-xl border border-dashed bg-slate-50 p-4 text-xs text-slate-500">
          No stethoscope stream is currently connected.
        </div>
      </div>
    </div>
  );
}

/* ------------------------------
   Otoscope
--------------------------------*/

function OtoscopePane() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recRef = useRef<MediaRecorder | null>(null);

  const [rec, setRec] = useState(false);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function startCamera() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Camera capture is not available in this browser.');
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });

        if (!alive) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        setCameraError(null);
      } catch (err: any) {
        if (alive) {
          setCameraError(err?.message || 'Camera unavailable');
        }
      }
    }

    startCamera();

    return () => {
      alive = false;

      try {
        streamRef.current?.getTracks().forEach((track) => track.stop());
      } catch {}

      if (photoUrl) URL.revokeObjectURL(photoUrl);
      if (mediaUrl) URL.revokeObjectURL(mediaUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function snap() {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const canvas = document.createElement('canvas');

    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);

    canvas.toBlob((blob) => {
      if (!blob) return;

      if (photoUrl) URL.revokeObjectURL(photoUrl);
      setPhotoUrl(URL.createObjectURL(blob));
    }, 'image/png');
  }

  function toggleRec() {
    const stream = streamRef.current;
    if (!stream) return;

    if (!rec) {
      chunksRef.current = [];

      try {
        const recorder = new MediaRecorder(stream, {
          mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
            ? 'video/webm;codecs=vp9'
            : 'video/webm',
        });

        recRef.current = recorder;

        recorder.ondataavailable = (event) => {
          if (event.data.size) chunksRef.current.push(event.data);
        };

        recorder.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: 'video/webm' });

          if (mediaUrl) URL.revokeObjectURL(mediaUrl);
          setMediaUrl(URL.createObjectURL(blob));
        };

        recorder.start();
        setRec(true);
      } catch (err: any) {
        setCameraError(err?.message || 'Unable to start recording.');
      }
      return;
    }

    recRef.current?.stop();
    setRec(false);
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border bg-white p-2">
        <div className="relative aspect-video w-full rounded bg-black">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="h-full w-full rounded object-cover"
          />

          {cameraError && (
            <div className="absolute inset-0 grid place-items-center px-4 text-center text-sm text-white/80">
              {cameraError}
            </div>
          )}

          {!cameraError && !streamRef.current && (
            <div className="absolute inset-0 grid place-items-center text-sm text-white/70">
              Connecting camera…
            </div>
          )}
        </div>

        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={snap}
            className="rounded border bg-white px-3 py-1.5 hover:bg-gray-50"
            disabled={!streamRef.current}
          >
            Snap
          </button>

          <button
            type="button"
            onClick={toggleRec}
            className={`rounded px-3 py-1.5 ${
              rec ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'
            } disabled:opacity-50`}
            disabled={!streamRef.current}
          >
            {rec ? 'Stop Rec' : 'Start Rec'}
          </button>

          <button
            type="button"
            onClick={() => recRef.current?.pause()}
            className="rounded border bg-white px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50"
            disabled={!rec}
          >
            Pause
          </button>

          <button
            type="button"
            onClick={() => recRef.current?.resume()}
            className="rounded border bg-white px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50"
            disabled={!rec}
          >
            Resume
          </button>
        </div>
      </div>

      {(photoUrl || mediaUrl) && (
        <div className="rounded-xl border bg-white p-2">
          <div className="mb-2 text-sm font-medium">Captured locally</div>

          <div className="mb-2 rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
            Captures are local to this browser until the production media upload route is
            connected.
          </div>

          {photoUrl && (
            <div className="mb-2">
              <img src={photoUrl} alt="Otoscope snapshot" className="rounded border" />
              <div className="mt-1 flex gap-2">
                <a
                  href={photoUrl}
                  download="otoscope-photo.png"
                  className="rounded border bg-white px-2 py-1 text-xs hover:bg-gray-50"
                >
                  Download
                </a>
              </div>
            </div>
          )}

          {mediaUrl && (
            <div>
              <video controls src={mediaUrl} className="w-full rounded border" />
              <div className="mt-1 flex gap-2">
                <a
                  href={mediaUrl}
                  download="otoscope-video.webm"
                  className="rounded border bg-white px-2 py-1 text-xs hover:bg-gray-50"
                >
                  Download
                </a>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}