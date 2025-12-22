// apps/clinician-app/components/ClinicianVitalsPanel.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Room } from 'livekit-client';
import { DataPacket_Kind, RoomEvent } from 'livekit-client';

/** Matches patient side shape we already use on the SFU (“vitals” topic) */
type Vitals = {
  ts?: number;
  hr?: number;
  spo2?: number;
  tempC?: number;
  rr?: number;
  bpSys?: number;
  bpDia?: number;
  map?: number; // optional, we derive if absent
  glucose?: number; // optional
};

type Props = {
  /** Pass your live Room instance after join */
  room?: Room | null;
  /** Render collapsed by default? */
  defaultCollapsed?: boolean;
  /** Max history points kept in memory (per series) */
  maxPoints?: number;
  /** Small top-right toggle badge (for tight layouts) */
  showDockBadge?: boolean;
};

export default function ClinicianVitalsPanel({
  room,
  defaultCollapsed = false,
  maxPoints = 180,
  showDockBadge = true,
}: Props) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [live, setLive] = useState(false);

  // Ring buffers (simple arrays with trim)
  const [labels, setLabels] = useState<string[]>([]);
  const [hr, setHR] = useState<number[]>([]);
  const [spo2, setSpO2] = useState<number[]>([]);
  const [sys, setSYS] = useState<number[]>([]);
  const [dia, setDIA] = useState<number[]>([]);
  const [mapv, setMAP] = useState<number[]>([]);
  const [rr, setRR] = useState<number[]>([]);
  const [temp, setTemp] = useState<number[]>([]);
  const [glucose, setGlucose] = useState<number[]>([]);

  const latest = useMemo(
    () => ({
      hr: hr.at(-1),
      spo2: spo2.at(-1),
      sys: sys.at(-1),
      dia: dia.at(-1),
      map: mapv.at(-1),
      rr: rr.at(-1),
      temp: temp.at(-1),
      glucose: glucose.at(-1),
    }),
    [hr, spo2, sys, dia, mapv, rr, temp, glucose]
  );

  // When patient pushes data on topic "vitals", we collect it here.
  useEffect(() => {
    if (!room) return;
    const onData = (
      payload: Uint8Array,
      _p: any,
      _kind: DataPacket_Kind,
      topic?: string
    ) => {
      if (topic !== 'vitals') return;
      try {
        const text = new TextDecoder().decode(payload);
        const v: Vitals = JSON.parse(text) || {};
        const ts = typeof v.ts === 'number' ? v.ts : Date.now();

        const label = new Date(ts).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });

        const add = (setter: (f: any) => void, value?: number) =>
          setter((arr: number[]) => {
            const next = [
              ...arr,
              Number.isFinite(value!) ? Number(value) : NaN,
            ].slice(-maxPoints);
            return next;
          });

        setLabels((a) => [...a, label].slice(-maxPoints));
        add(setHR, v.hr);
        add(setSpO2, v.spo2);
        add(setSYS, v.bpSys ?? (v as any).sys);
        add(setDIA, v.bpDia ?? (v as any).dia);
        add(
          setMAP,
          v.map ??
            deriveMAP(
              v.bpSys ?? (v as any).sys,
              v.bpDia ?? (v as any).dia
            )
        );
        add(setRR, v.rr);
        add(setTemp, v.tempC ?? (v as any).temp);
        add(setGlucose, v.glucose);

        setLive(true);
      } catch (err) {
        // ignore bad packets; keep the panel stable
        // eslint-disable-next-line no-console
        console.warn(
          '[ClinicianVitalsPanel] Data parse error',
          err
        );
      }
    };

    room.on(RoomEvent.DataReceived, onData);
    return () => {
      try {
        room.off(RoomEvent.DataReceived, onData);
      } catch {
        // ignore
      }
    };
  }, [room, maxPoints]);

  /** Remote-control patient sender (same schema we already wired) */
  const sendControl = async (value: boolean) => {
    if (!room) return;
    try {
      const payload = new TextEncoder().encode(
        JSON.stringify({ type: 'vitals', value })
      );
      await room.localParticipant.publishData(
        payload,
        DataPacket_Kind.RELIABLE,
        'control'
      );
      setLive(value);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(
        '[ClinicianVitalsPanel] control publish error',
        err
      );
    }
  };

  const neon = {
    hr: '#00FFC6',
    spo2: '#6EA8FE',
    sys: '#FF6B6B',
    dia: '#F7B267',
    map: '#FFD93D',
    rr: '#9B5DE5',
    temp: '#25CCF7',
    glucose: '#2EE59D',
  };

  return (
    <section className="relative rounded-2xl border border-slate-200/10 bg-slate-900/70 p-3 md:p-4 text-slate-100">
      {/* Header / Dock */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="text-sm font-semibold">Monitor</div>
          <span
            className={`text-xs px-2 py-0.5 rounded ${
              live
                ? 'bg-emerald-600/80'
                : 'bg-slate-700/80'
            }`}
          >
            {live ? 'live' : 'idle'}
          </span>
          {showDockBadge && (
            <button
              onClick={() => setCollapsed((v) => !v)}
              className="text-xs px-2 py-0.5 rounded border border-slate-600 hover:bg-slate-800"
              title={
                collapsed ? 'Show monitor' : 'Hide monitor'
              }
            >
              {collapsed ? 'Show' : 'Hide'}
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => sendControl(true)}
            disabled={!room}
            className="text-xs px-3 py-1 rounded border border-emerald-700 hover:bg-emerald-700/20 disabled:opacity-50"
          >
            Start
          </button>
          <button
            onClick={() => sendControl(false)}
            disabled={!room}
            className="text-xs px-3 py-1 rounded border border-rose-700 hover:bg-rose-700/20 disabled:opacity-50"
          >
            Stop
          </button>
        </div>
      </div>

      {!collapsed && (
        <>
          {/* Big bedside monitor */}
          <div className="mt-3 rounded-2xl border border-slate-800/50 bg-slate-900/80 p-3">
            <div className="h-[320px]">
              <BedsideMonitor
                labels={labels}
                hr={hr}
                spo2={spo2}
                sys={sys}
                dia={dia}
                mapv={mapv}
                rr={rr}
                temp={temp}
                glucose={glucose}
                colors={neon}
              />
            </div>
          </div>

          {/* Tiles */}
          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
            <Tile label="HR" value={fmtHR(latest.hr)} />
            <Tile
              label="SpO₂"
              value={fmtSpO2(latest.spo2)}
            />
            <Tile
              label="BP"
              value={fmtBP(latest.sys, latest.dia)}
            />
            <Tile label="MAP" value={fmtMAP(latest.map)} />
            <Tile label="RR" value={fmtRR(latest.rr)} />
            <Tile
              label="Temp"
              value={fmtTemp(latest.temp)}
            />
            <Tile
              label="Glucose"
              value={fmtGlu(latest.glucose)}
            />
          </div>

          {!labels.length && (
            <div className="mt-3 text-xs text-slate-400">
              Waiting for patient vitals… use{' '}
              <span className="text-slate-200">Start</span> to
              request streaming.
            </div>
          )}
        </>
      )}
    </section>
  );
}

/** ---------- tiny presentational helpers ---------- */

const DASH = '—';

function Tile({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800/40 bg-slate-950/40 p-3">
      <div className="text-[11px] text-slate-400">
        {label}
      </div>
      <div className="text-lg font-semibold text-slate-100">
        {value}
      </div>
    </div>
  );
}

function fmtNum(x?: number, digits = 0) {
  return typeof x === 'number' && Number.isFinite(x)
    ? x.toFixed(digits)
    : DASH;
}

const fmtHR = (x?: number) => `${fmtNum(x, 0)} bpm`;
const fmtSpO2 = (x?: number) => `${fmtNum(x, 0)} %`;
const fmtRR = (x?: number) => `${fmtNum(x, 0)} /min`;
const fmtTemp = (x?: number) => `${fmtNum(x, 1)} °C`;
const fmtMAP = (x?: number) => `${fmtNum(x, 0)} mmHg`;
const fmtGlu = (x?: number) => `${fmtNum(x, 1)} mmol/L`;

const fmtBP = (s?: number, d?: number) =>
  Number.isFinite(s as number) &&
  Number.isFinite(d as number)
    ? `${Math.round(s!)} / ${Math.round(d!)} mmHg`
    : '—/— mmHg';

const deriveMAP = (s?: number, d?: number) =>
  Number.isFinite(s as number) && Number.isFinite(d as number)
    ? d! + (s! - d!) / 3
    : undefined;

/** ---------- inline bedside monitor (Chart.js) ---------- */
function BedsideMonitor({
  labels,
  hr,
  spo2,
  sys,
  dia,
  mapv,
  rr,
  temp,
  glucose,
  colors,
}: {
  labels: string[];
  hr: number[];
  spo2: number[];
  sys: number[];
  dia: number[];
  mapv: number[];
  rr: number[];
  temp: number[];
  glucose: number[];
  colors: Record<string, string>;
}) {
  // lazy require to avoid SSR whining
  const { Line } = require('react-chartjs-2');
  const {
    Chart: ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Filler,
    Tooltip,
    Legend,
  } = require('chart.js');
  ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Filler,
    Tooltip,
    Legend
  );

  const data = {
    labels,
    datasets: [
      {
        label: 'HR (bpm)',
        data: hr,
        borderColor: colors.hr,
        pointRadius: 0,
        tension: 0.35,
      },
      {
        label: 'SpO₂ (%)',
        data: spo2,
        borderColor: colors.spo2,
        pointRadius: 0,
        tension: 0.35,
      },
      {
        label: 'SYS (mmHg)',
        data: sys,
        borderColor: colors.sys,
        pointRadius: 0,
        tension: 0.35,
      },
      {
        label: 'DIA (mmHg)',
        data: dia,
        borderColor: colors.dia,
        pointRadius: 0,
        tension: 0.35,
      },
      {
        label: 'MAP (mmHg)',
        data: mapv,
        borderColor: colors.map,
        borderDash: [6, 4],
        pointRadius: 0,
        tension: 0.35,
      },
      {
        label: 'RR (/min)',
        data: rr,
        borderColor: colors.rr,
        pointRadius: 0,
        tension: 0.35,
      },
      {
        label: 'Temp (°C)',
        data: temp,
        borderColor: colors.temp,
        pointRadius: 0,
        tension: 0.35,
      },
      {
        label: 'Glucose (mmol/L)',
        data: glucose,
        borderColor: colors.glucose,
        pointRadius: 0,
        tension: 0.35,
      },
    ],
  };
  const options = {
    animation: { duration: 0 },
    responsive: true,
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        labels: { color: '#cbd5e1' },
      },
      tooltip: { enabled: true },
    },
    scales: {
      x: {
        ticks: {
          color: '#94a3b8',
          maxRotation: 0,
          autoSkip: true,
        },
        grid: {
          color: 'rgba(148,163,184,0.08)',
        },
      },
      y: {
        ticks: { color: '#94a3b8' },
        grid: {
          color: 'rgba(148,163,184,0.08)',
        },
      },
    },
    elements: {
      line: { borderWidth: 2 },
      point: { radius: 0 },
    },
    maintainAspectRatio: false,
  };
  return <Line data={data} options={options as any} />;
}
