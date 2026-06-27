// apps/patient-app/components/NexRingPanel.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { NexRingSession } from '@/src/devices/nexring/nexring-session';
import { createNexRingMetricPersister } from '@/src/devices/nexring/nexring-persistence';
import type {
  RingCommandResult,
  RingDeviceInfo,
  RingHydrationState,
  RingReportSnapshot,
  RingScanDevice,
  RingSessionState,
  RingTraceEvent,
} from '@/src/devices/nexring/nexring-types';
import {
  type HrPoint,
  type Metrics,
  type PersistStampMap,
  type SleepSession,
  type StressPoint,
  type TempPoint,
  MAX_HR_POINTS,
  MAX_STRESS_POINTS,
  MAX_TEMP_POINTS,
  inferLiveMode,
  mergeMetric,
  pushBounded,
  shouldPersistMetric,
  upsertSleepSession,
} from '@/src/devices/nexring/nexring-view-model';
import { NexRingHero } from '@/components/nexring/NexRingHero';
import { NexRingControlPanel } from '@/components/nexring/NexRingControlPanel';
import { NexRingInsights } from '@/components/nexring/NexRingInsights';

type NexRingPanelProps = {
  roomId?: string;
  patientId?: string;
  embedded?: boolean;
};

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export default function NexRingPanel({
  roomId,
  patientId,
  embedded = false,
}: NexRingPanelProps) {
  const sessionRef = useRef<NexRingSession | null>(null);
  const lastPersistRef = useRef<PersistStampMap>({});

  const [state, setState] = useState<RingSessionState>({
    phase: 'idle',
    connectedDevice: null,
    lastError: null,
    lastSeenTs: null,
    mtu: null,
    batteryPct: null,
  });

  const [devices, setDevices] = useState<RingScanDevice[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [metrics, setMetrics] = useState<Metrics>({});
  const [deviceInfo, setDeviceInfo] = useState<RingDeviceInfo | null>(null);
  const [lastCmd, setLastCmd] = useState<RingCommandResult | null>(null);
  const [historyCount, setHistoryCount] = useState(0);
  const [persistInfo, setPersistInfo] = useState<string>('No vital writes yet.');
  const [lastPersistAt, setLastPersistAt] = useState<number | null>(null);
  const [isWebTransport, setIsWebTransport] = useState(false);
  const [trace, setTrace] = useState<RingTraceEvent[]>([]);
  const [hydration, setHydration] = useState<RingHydrationState>({
    phase: 'idle',
    receivedPackets: 0,
    receivedMetrics: 0,
    familyCounts: {},
    algorithmPackets: 0,
    activePackets: 0,
    sleepPackets: 0,
    historyErrorPackets: 0,
  });
  const [reportSnapshot, setReportSnapshot] =
    useState<RingReportSnapshot | null>(null);

  const [hrHistory, setHrHistory] = useState<HrPoint[]>([]);
  const [stressHistory, setStressHistory] = useState<StressPoint[]>([]);
  const [tempHistory, setTempHistory] = useState<TempPoint[]>([]);
  const [sleepSessions, setSleepSessions] = useState<SleepSession[]>([]);

  const title = useMemo(
    () => `NexRing${roomId ? ` • ${roomId}` : ''}`,
    [roomId],
  );

  const persistMetric = useMemo(() => {
    if (!patientId) return null;

    return createNexRingMetricPersister({
      patientId,
      deviceId: 'duecare.nexring',
      deviceLabel: 'NexRing',
      source: 'nexring',
      persistTemperature: false,
      temperatureMode: 'unknown',
      onStoredSummary(summary) {
        const okText = `${summary.stored}/${summary.attempted} stored`;
        const skipText = summary.skipped.length
          ? ` • skipped: ${summary.skipped.map((s) => s.reason).join(', ')}`
          : '';
        setPersistInfo(`${summary.ok ? 'OK' : 'Check'} • ${okText}${skipText}`);
        setLastPersistAt(Date.now());
      },
    });
  }, [patientId]);

  useEffect(() => {
    const seen = new Map<string, RingScanDevice>();

    const session = new NexRingSession({
      onState(next) {
        setState({ ...next });
      },

      onTrace(event) {
        setTrace((prev) => {
          const next = [...prev, event];
          return next.length <= 250 ? next : next.slice(next.length - 250);
        });
      },

      onHydration(next) {
        setHydration(next);
        setHistoryCount(next.receivedMetrics);
      },

      onReportSnapshot(snapshot) {
        setReportSnapshot(snapshot);
        setSleepSessions(snapshot.sleepSessions as SleepSession[]);
      },

      onScan(device) {
        const key =
          device.id ||
          device.mac ||
          `${device.name || 'ring'}-${device.rssi || 0}`;

        seen.set(key, device);

        const arr = Array.from(seen.values()).sort(
          (a, b) => (b.rssi ?? -999) - (a.rssi ?? -999),
        );

        setDevices(arr);

        setSelectedId((prev) => {
          if (prev && arr.some((d) => d.id === prev)) return prev;

          const preferred =
            arr.find((d) =>
              /sr09_93b7/i.test(`${d.name || ''}${d.id || ''}${d.mac || ''}`),
            ) ??
            arr[0] ??
            null;

          return preferred?.id ?? '';
        });
      },

      async onMetric(metric) {
        setMetrics((prev) => mergeMetric(prev, metric));

        if (metric.kind === 'health') {
          const hr = finiteNumber(metric.hr);
          if (hr !== null) {
            const ts = metric.ts || Date.now();
            const mode = inferLiveMode(metric);

            setHrHistory((prev) =>
              pushBounded(
                prev,
                {
                  ts,
                  value: hr,
                  mode,
                },
                MAX_HR_POINTS,
              ),
            );
          }

          const stress = finiteNumber(metric.stress);
          if (stress !== null) {
            const ts = metric.ts || Date.now();

            setStressHistory((prev) =>
              pushBounded(
                prev,
                {
                  ts,
                  value: stress,
                },
                MAX_STRESS_POINTS,
              ),
            );
          }
        }

        if (metric.kind === 'temperature') {
          const celsius = finiteNumber(metric.celsius);
          if (celsius !== null) {
            const ts = metric.ts || Date.now();

            setTempHistory((prev) =>
              pushBounded(
                prev,
                {
                  ts,
                  value: celsius,
                },
                MAX_TEMP_POINTS,
              ),
            );
          }
        }

        if (metric.kind === 'sleep') {
          setSleepSessions((prev) => upsertSleepSession(prev, metric));
        }

        if (!persistMetric) return;
        if (!shouldPersistMetric(metric, lastPersistRef.current)) return;

        try {
          await persistMetric(metric);

          if (
            metric.kind === 'health' ||
            metric.kind === 'temperature' ||
            metric.kind === 'sleep' ||
            metric.kind === 'activity'
          ) {
            lastPersistRef.current[metric.kind] = metric.ts || Date.now();
          }
        } catch (err) {
          console.warn('[NexRing] persist failed', err);
        }
      },

      onHistoricalMetric(metric) {
        setHistoryCount((n) => n + 1);
        setMetrics((prev) => mergeMetric(prev, metric));

        if (metric.kind === 'health') {
          const hr = finiteNumber(metric.hr);
          if (hr !== null) {
            const ts = metric.ts || Date.now();

            setHrHistory((prev) =>
              pushBounded(
                prev,
                {
                  ts,
                  value: hr,
                },
                MAX_HR_POINTS,
              ),
            );
          }

          const stress = finiteNumber(metric.stress);
          if (stress !== null) {
            const ts = metric.ts || Date.now();

            setStressHistory((prev) =>
              pushBounded(
                prev,
                {
                  ts,
                  value: stress,
                },
                MAX_STRESS_POINTS,
              ),
            );
          }
        }

        if (metric.kind === 'temperature') {
          const celsius = finiteNumber(metric.celsius);
          if (celsius !== null) {
            const ts = metric.ts || Date.now();

            setTempHistory((prev) =>
              pushBounded(
                prev,
                {
                  ts,
                  value: celsius,
                },
                MAX_TEMP_POINTS,
              ),
            );
          }
        }

        if (metric.kind === 'sleep') {
          setSleepSessions((prev) => upsertSleepSession(prev, metric));
        }

        if (!persistMetric) return;
        if (!shouldPersistMetric(metric, lastPersistRef.current)) return;

        void persistMetric(metric)
          .then(() => {
            if (
              metric.kind === 'health' ||
              metric.kind === 'temperature' ||
              metric.kind === 'sleep' ||
              metric.kind === 'activity'
            ) {
              lastPersistRef.current[metric.kind] = metric.ts || Date.now();
            }
          })
          .catch((err) => {
            console.warn('[NexRing] historical persist failed', err);
          });
      },

      onDeviceInfo(info) {
        setDeviceInfo(info);
      },

      onCommandResult(result) {
        setLastCmd(result);
      },

      onError(message) {
        console.error('[NexRing]', message);
      },
    });

    sessionRef.current = session;

    session
      .init()
      .then(() => {
        setIsWebTransport(session.isUsingWebTransport());
      })
      .catch((err) => {
        console.error('[NexRing] init failed', err);
      });

    return () => {
      session.destroy().catch(() => {});
      sessionRef.current = null;
    };
  }, [persistMetric]);

  const selected = devices.find((d) => d.id === selectedId) ?? null;

  const actions = {
    askPermissions: () => sessionRef.current?.askPermissions(),
    scan: () => sessionRef.current?.startScan(),
    stopScan: () => sessionRef.current?.stopScan(),
    connect: () => {
      setTrace([]);
      if (selected) sessionRef.current?.connect(selected);
    },
    disconnect: () => sessionRef.current?.disconnect(),
    syncTime: () => sessionRef.current?.syncTime(),
    requestBattery: () => sessionRef.current?.requestBattery(),
    requestDeviceInfo: () => sessionRef.current?.requestDeviceInfo(),
    startHealth: () => sessionRef.current?.startHealth(),
    startSingleHealth: () => sessionRef.current?.startSingleHealth(),
    requestHistoricalCount: () => sessionRef.current?.requestHistoricalCount(),
    requestHistoricalData: () => sessionRef.current?.requestHistoricalData(),
    requestStep: () => sessionRef.current?.requestStep(),
    requestTemperature: () => sessionRef.current?.requestTemperature(),
    requestActiveData: () => sessionRef.current?.requestActiveData(),
    requestActiveData2: () => sessionRef.current?.requestActiveData2(),
    requestNewAlgorithmHistoryCount: () =>
      sessionRef.current?.requestNewAlgorithmHistoryCount(),
    requestNewAlgorithmHistoryData: () =>
      sessionRef.current?.requestNewAlgorithmHistoryData(),
    runHydrationBootstrap: () => sessionRef.current?.runHydrationBootstrap(),
  };

  const mergedMetrics: Metrics = {
    ...metrics,
    batteryPct: metrics.batteryPct ?? state.batteryPct ?? undefined,
    rhr: metrics.rhr ?? reportSnapshot?.derived?.rhr,
    sleepAvgHr: metrics.sleepAvgHr ?? reportSnapshot?.derived?.sleepAvgHr,
    nightSpo2: metrics.nightSpo2 ?? reportSnapshot?.derived?.nightSpo2,
    historyRr: metrics.historyRr ?? reportSnapshot?.derived?.rr,
  };
  return (
    <div
      className={
        embedded
          ? 'space-y-4'
          : 'space-y-4 rounded-3xl border border-slate-200 bg-white/95 p-4 shadow-sm'
      }
    >
      <NexRingHero
        title={title}
        phase={state.phase}
        lastCmd={lastCmd}
        metrics={mergedMetrics}
        hrHistory={hrHistory}
        historyCount={historyCount}
        lastSeenTs={state.lastSeenTs}
        mtu={state.mtu}
        patientBound={Boolean(patientId)}
        sleepCount={sleepSessions.length || undefined}
        compact={embedded}
      />

      {state.lastError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.lastError}
        </div>
      ) : null}


      <section
        className={
          embedded
            ? 'grid gap-4 xl:grid-cols-[0.95fr_1.05fr]'
            : 'grid gap-4 xl:grid-cols-[0.9fr_1.1fr]'
        }
      >
        <NexRingControlPanel
          isWebTransport={isWebTransport}
          selected={selected}
          devices={devices}
          selectedId={selectedId}
          onSelectDevice={setSelectedId}
          actions={actions}
          persistInfo={persistInfo}
          lastPersistAt={lastPersistAt}
          state={state}
          deviceInfo={deviceInfo}
          lastCmd={lastCmd}
          hydration={hydration}
          dailySummary={reportSnapshot?.dailySummary ?? null}
          trace={trace}
          compact={embedded}
        />

        <NexRingInsights
          metrics={mergedMetrics}
          stressHistory={stressHistory}
          tempHistory={tempHistory}
          sleepSessions={sleepSessions}
        />
      </section>

    </div>
  );
}
