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
};

function formatDistance(meters?: number | null) {
  if (typeof meters !== 'number' || !Number.isFinite(meters)) return '—';
  if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`;
  return `${Math.round(meters)} m`;
}

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
  deviceInfo,
  lastCmd: _lastCmd,
  hydration,
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
  dailySummary: RingDailySummary | null;
  trace: RingTraceEvent[];
  compact?: boolean;
}) {
  const connected = isConnectedPhase(state.phase);
  const selectedLabel =
    selected?.name || state.connectedDevice?.name || 'No ring selected';
  const connectedLabel =
    state.connectedDevice?.name || selected?.name || 'Not connected';

  return (
    <div className="space-y-4">
      <Card
        title="Ring connection"
        subtitle="Pair, sync and refresh NexRing wellness metrics."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <InfoTile
            label="Status"
            value={connected ? 'Connected' : state.phase || 'Ready'}
          />
          <InfoTile label="Selected ring" value={selectedLabel} />
          <InfoTile label="Last seen" value={relativeTime(state.lastSeenTs)} />
          <InfoTile label="Last sync" value={relativeTime(lastPersistAt)} />
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <ActionButton
            onClick={actions.askPermissions}
            disabled={isWebTransport}
          >
            Enable Bluetooth
          </ActionButton>
          <ActionButton onClick={actions.scan}>Find ring</ActionButton>
          <ActionButton onClick={actions.stopScan}>Stop scan</ActionButton>
          <ActionButton disabled={!selected} onClick={actions.connect}>
            Connect
          </ActionButton>
          <ActionButton onClick={actions.disconnect}>Disconnect</ActionButton>
          <ActionButton onClick={actions.runHydrationBootstrap}>
            Sync ring
          </ActionButton>
          <ActionButton onClick={actions.requestBattery}>
            Refresh battery
          </ActionButton>
          <ActionButton onClick={actions.syncTime}>Sync time</ActionButton>
        </div>

        <div className="mt-4 rounded-2xl border border-cyan-100 bg-cyan-50 px-4 py-3 text-xs leading-5 text-cyan-900">
          NexRing sync pulls wellness, sleep, activity and recovery metrics into
          your patient reports. Advanced protocol diagnostics have moved out of
          this patient-facing panel.
        </div>

        <div className="mt-3">
          <a
            href="/myCare/devices/ble-debug"
            className="text-xs font-semibold text-cyan-700 underline-offset-4 hover:underline"
          >
            Open advanced BLE debug console
          </a>
        </div>
      </Card>

      {devices.length > 0 ? (
        <Card
          title="Nearby rings"
          subtitle="Select the ring you want to pair before connecting."
        >
          <div className="max-h-72 overflow-auto rounded-2xl border border-slate-200">
            <div className="divide-y divide-slate-200">
              {devices.map((d) => {
                const active = d.id === selectedId;

                return (
                  <button
                    key={d.id || d.mac || `${d.name}-${d.rssi}`}
                    className={`flex w-full items-center justify-between px-4 py-3 text-left ${
                      active ? 'bg-cyan-50' : 'bg-white'
                    }`}
                    onClick={() => onSelectDevice(d.id)}
                    type="button"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-900">
                        {d.name || 'Unnamed ring'}
                      </div>
                      <div className="truncate text-xs text-slate-500">
                        {d.mac || d.id}
                      </div>
                    </div>
                    <div className="ml-3 text-xs text-slate-500">
                      RSSI {d.rssi ?? '—'}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </Card>
      ) : null}

      <Card title="Today from NexRing">
        <div className="grid gap-3 md:grid-cols-2">
          <InfoTile
            label="Steps"
            value={formatNumber(dailySummary?.steps)}
          />
          <InfoTile
            label="Calories"
            value={formatNumber(dailySummary?.calories, ' kcal')}
          />
          <InfoTile
            label="Distance"
            value={formatDistance(dailySummary?.distanceMeters)}
          />
          <InfoTile
            label="Walking steps"
            value={formatNumber(dailySummary?.walkingSteps)}
          />
          <InfoTile
            label="Running steps"
            value={formatNumber(dailySummary?.runningSteps)}
          />
          <InfoTile
            label="Battery"
            value={
              typeof state.batteryPct === 'number'
                ? `${Math.round(state.batteryPct)}%`
                : '—'
            }
          />
        </div>
      </Card>

      <Card title="Report sync">
        <div className="grid gap-3 md:grid-cols-2">
          <InfoTile label="Sync phase" value={hydration.phase || 'ready'} />
          <InfoTile
            label="Metrics received"
            value={String(hydration.receivedMetrics || 0)}
          />
          <InfoTile
            label="Sleep records"
            value={String(hydration.sleepPackets || 0)}
          />
          <InfoTile
            label="Activity records"
            value={String(hydration.activePackets || 0)}
          />
          <InfoTile label="Persist status" value={persistInfo} />
          <InfoTile label="Transport" value={isWebTransport ? 'Web bridge' : 'Web Bluetooth'} />
        </div>

        <p className="mt-3 text-xs leading-5 text-slate-500">
          Sleep, recovery, daytime stress, activity and temperature variation
          are synced as wellness metrics. NexRing temperature variation is kept
          separate from clinical body temperature.
        </p>
      </Card>

      {!compact ? (
        <Card title="Ring details">
          <div className="grid gap-3 md:grid-cols-2">
            <InfoTile label="Connected ring" value={connectedLabel} />
            <InfoTile
              label="Device address"
              value={
                state.connectedDevice?.mac ||
                selected?.mac ||
                selected?.id ||
                '—'
              }
            />
            <InfoTile label="Model" value={deviceInfo?.model || '—'} />
            <InfoTile label="Firmware" value={deviceInfo?.firmware || '—'} />
            <InfoTile
              label="Manufacturer"
              value={deviceInfo?.manufacturer || '—'}
            />
            <InfoTile label="Software" value={deviceInfo?.software || '—'} />
          </div>
        </Card>
      ) : null}
    </div>
  );
}
