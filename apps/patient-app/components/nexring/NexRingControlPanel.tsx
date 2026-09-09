// apps/patient-app/components/nexring/NexRingControlPanel.tsx
'use client';

import React from 'react';
import type {
  RingCommandResult,
  RingDailySummary,
  RingDeviceInfo,
  RingHydrationState,
  RingScanDevice,
  RingSessionState,
  RingTraceEvent,
} from '@/src/devices/nexring/nexring-types';
import type { NexRingCapabilities } from '@/src/devices/nexring/nexring-capabilities';
import { relativeTime } from '@/src/devices/nexring/nexring-view-model';
import { ActionButton, Card, InfoTile } from './NexRingPrimitives';

type ControlActions = {
  askPermissions: () => void;
  scan: () => void;
  stopScan: () => void;
  connect: () => void;
  disconnect: () => void;
  syncTime: () => void;
  requestBattery: () => void;
  requestDeviceInfo: () => void;
  startHealth: () => void;
  startSingleHealth: () => void;
  requestHistoricalCount: () => void;
  requestHistoricalData: () => void;
  requestStep: () => void;
  requestTemperature: () => void;
  requestActiveData: () => void;
  requestActiveData2: () => void;
  requestNewAlgorithmHistoryCount: () => void;
  requestNewAlgorithmHistoryData: () => void;
  runHydrationBootstrap: () => void;
  startSr09Sport: (options: { mode: 0 | 1; timeInterval: number; duration: number }) => void;
  stopSr09Sport: () => void;
};


function formatNumber(value?: number | null, suffix = '') {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return `${new Intl.NumberFormat().format(Math.round(value))}${suffix}`;
}

function isConnectedPhase(phase?: string | null) {
  return phase === 'ready' || phase === 'connected';
}

export function NexRingControlPanel({
  isWebTransport,
  selected,
  devices,
  selectedId,
  onSelectDevice,
  actions,
  persistInfo,
  lastPersistAt,
  state,
  deviceInfo: _deviceInfo,
  lastCmd: _lastCmd,
  hydration,
  capabilities,
  dailySummary,
  trace: _trace,
  compact = false,
}: {
  isWebTransport: boolean;
  selected: RingScanDevice | null;
  devices: RingScanDevice[];
  selectedId: string;
  onSelectDevice: (id: string) => void;
  actions: ControlActions;
  persistInfo: string;
  lastPersistAt: number | null;
  state: RingSessionState;
  deviceInfo: RingDeviceInfo | null;
  lastCmd: RingCommandResult | null;
  hydration: RingHydrationState;
  capabilities: NexRingCapabilities;
  dailySummary: RingDailySummary | null;
  trace: RingTraceEvent[];
  compact?: boolean;
}) {
  const connected = isConnectedPhase(state.phase);
  const scanning = state.phase === 'scanning';
  const [sportMode, setSportMode] = React.useState<0 | 1>(1);
  const [sportInterval, setSportInterval] = React.useState(10);
  const [sportDuration, setSportDuration] = React.useState(30);
  const selectedLabel =
    selected?.name || state.connectedDevice?.name || 'No ring selected';

  return (
    <div className="min-w-0 space-y-4">
      <Card
        title="Ring connection"
        subtitle="Pair once, then sync wellness, sleep and activity from your NexRing."
      >
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          <InfoTile
            label="Status"
            value={connected ? 'Connected' : scanning ? 'Scanning' : state.phase || 'Ready'}
          />
          <InfoTile label="Ring" value={selectedLabel} />
          <InfoTile label="Last seen" value={relativeTime(state.lastSeenTs)} />
          <InfoTile label="Last sync" value={relativeTime(lastPersistAt)} />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-medium text-slate-700">
            {isWebTransport ? 'Browser Bluetooth' : 'Android native'}
          </span>
          {connected ? (
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700">
              Ready to sync
            </span>
          ) : null}
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {!isWebTransport && !connected ? (
            <ActionButton onClick={actions.askPermissions}>Enable Bluetooth</ActionButton>
          ) : null}

          {!connected && !scanning ? (
            <ActionButton onClick={actions.scan}>
              {isWebTransport ? 'Choose ring' : 'Find ring'}
            </ActionButton>
          ) : null}

          {scanning ? (
            <ActionButton onClick={actions.stopScan}>Stop scan</ActionButton>
          ) : null}

          {!connected && !scanning && selected ? (
            <ActionButton onClick={actions.connect}>Connect</ActionButton>
          ) : null}

          {connected ? (
            <>
              <ActionButton onClick={actions.runHydrationBootstrap}>Sync ring</ActionButton>
              <ActionButton onClick={actions.requestBattery}>Refresh battery</ActionButton>
              <ActionButton onClick={actions.syncTime}>Sync time</ActionButton>
              <ActionButton onClick={actions.disconnect}>Disconnect</ActionButton>
            </>
          ) : null}
        </div>

        {!connected && !scanning && devices.length === 0 ? (
          <p className="mt-3 text-xs leading-5 text-slate-500">
            Keep the ring nearby and awake. On web, choosing a ring opens the browser
            Bluetooth picker. In the Android app, Find ring starts the native BLE scan.
          </p>
        ) : null}
      </Card>

      {devices.length > 0 && !connected ? (
        <Card
          title="Nearby rings"
          subtitle="Choose the ring you want to connect."
        >
          <div className="max-h-72 overflow-auto rounded-2xl border border-slate-200">
            <div className="divide-y divide-slate-200">
              {devices.map((d) => {
                const active = d.id === selectedId;

                return (
                  <button
                    key={d.id || d.mac || `${d.name}-${d.rssi}`}
                    className={`flex min-h-[56px] w-full min-w-0 items-center justify-between gap-3 px-4 py-3 text-left transition ${
                      active ? 'bg-cyan-50' : 'bg-white hover:bg-slate-50'
                    }`}
                    onClick={() => onSelectDevice(d.id)}
                    type="button"
                    aria-pressed={active}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-slate-900">
                        {d.name || 'Unnamed ring'}
                      </div>
                      <div className="truncate text-xs text-slate-500">
                        {d.mac || d.id}
                      </div>
                    </div>
                    <div className="shrink-0 text-xs text-slate-500">
                      {typeof d.rssi === 'number' ? `${d.rssi} dBm` : 'Signal —'}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </Card>
      ) : null}

      <Card title="Today from NexRing">
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          <InfoTile label="Steps" value={formatNumber(dailySummary?.steps)} />
          <InfoTile label="Walking" value={formatNumber(dailySummary?.walkingSteps)} />
          {!compact ? (
            <InfoTile label="Running" value={formatNumber(dailySummary?.runningSteps)} />
          ) : null}
          <InfoTile
            label="Battery"
            value={
              typeof state.batteryPct === 'number'
                ? `${Math.round(state.batteryPct)}%`
                : '—'
            }
          />
        </div>
        <p className="mt-3 text-xs leading-5 text-slate-500">
          Steps are read from vendor history. Distance and calories are intentionally not
          estimated because this SDK does not expose an authoritative distance calculation.
        </p>
      </Card>

      {!compact ? (
        <>
          <Card
            title="Exercise and mindfulness"
            subtitle={`Detected model family: ${capabilities.model.toUpperCase()}`}
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <InfoTile
                label="Exercise protocol"
                value={
                  capabilities.legacySport
                    ? 'Legacy Sport Mode · Run / Other'
                    : capabilities.advancedExercise
                      ? 'SR28 advanced exercise'
                      : 'Unavailable until model is identified'
                }
              />
              <InfoTile
                label="Mindfulness"
                value={capabilities.mindfulness ? 'SR28 supported' : 'Not proven for this model'}
              />
            </div>

            {capabilities.legacySport ? (
              <div className="mt-4 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="text-xs font-medium text-slate-700">
                    Sport
                    <select
                      className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 text-sm"
                      value={sportMode}
                      onChange={(e) => setSportMode(Number(e.target.value) as 0 | 1)}
                    >
                      <option value={1}>Run</option>
                      <option value={0}>Other sport</option>
                    </select>
                  </label>
                  <label className="text-xs font-medium text-slate-700">
                    Record every (sec)
                    <input
                      className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 text-sm"
                      type="number"
                      min={10}
                      max={180}
                      step={1}
                      value={sportInterval}
                      onChange={(e) => setSportInterval(Number(e.target.value))}
                    />
                  </label>
                  <label className="text-xs font-medium text-slate-700">
                    Duration (min)
                    <input
                      className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 text-sm"
                      type="number"
                      min={5}
                      max={180}
                      step={1}
                      value={sportDuration}
                      onChange={(e) => setSportDuration(Number(e.target.value))}
                    />
                  </label>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <ActionButton
                    onClick={() =>
                      actions.startSr09Sport({
                        mode: sportMode,
                        timeInterval: sportInterval,
                        duration: sportDuration,
                      })
                    }
                  >
                    Start exercise
                  </ActionButton>
                  <ActionButton onClick={actions.stopSr09Sport}>End exercise</ActionButton>
                </div>
                <p className="text-xs leading-5 text-slate-500">
                  A successful command only proves that Ambulant+ sent the documented vendor
                  protocol. End exercise automatically refreshes legacy history; returned ring
                  history remains the authority for recorded activity.
                </p>
              </div>
            ) : capabilities.advancedExercise ? (
              <p className="mt-3 text-xs leading-5 text-slate-500">
                SR28 uses the separate advanced exercise protocol with pause/continue and
                mindfulness support. SR09 legacy controls are intentionally not sent to SR28.
              </p>
            ) : (
              <p className="mt-3 text-xs leading-5 text-slate-500">
                Sport controls stay disabled until the connected ring can be identified as
                SR09/SR23 or SR28.
              </p>
            )}
          </Card>

          <Card title="Report sync">
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <InfoTile label="Sync phase" value={hydration.phase || 'idle'} />
              <InfoTile label="Metrics received" value={String(hydration.receivedMetrics)} />
              <InfoTile label="Sleep records" value={String(hydration.sleepPackets)} />
              <InfoTile label="Activity packets" value={String(hydration.activePackets)} />
            </div>
            <p className="mt-3 break-words text-xs leading-5 text-slate-500">
              {persistInfo || 'No patient-report writes yet.'}
            </p>
          </Card>
        </>
      ) : null}
    </div>
  );
}
