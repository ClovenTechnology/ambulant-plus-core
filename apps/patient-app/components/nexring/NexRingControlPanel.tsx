// apps/patient-app/components/nexring/NexRingControlPanel.tsx
'use client';

import React, { useMemo } from 'react';
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

type CommandMatrixRow = {
  label: string;
  expectedFamilies: string[];
  matchedFamilies: string[];
  observedPackets: number;
  retainedMetrics: number;
};

function tracePreview(trace: RingTraceEvent[]) {
  return trace.slice(-10).reverse();
}

function familyCountRows(hydration: RingHydrationState) {
  return Object.entries(hydration.familyCounts ?? {})
    .map(([family, count]) => ({
      family,
      count: typeof count === 'number' && Number.isFinite(count) ? count : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

function matrixFromLastCmd(lastCmd: RingCommandResult | null): CommandMatrixRow[] {
  const ledger = (lastCmd?.raw as any)?.ledger;
  if (!Array.isArray(ledger)) return [];

  return ledger.map((row: any) => ({
    label: String(row?.label ?? 'unknown'),
    expectedFamilies: Array.isArray(row?.expectedFamilies)
      ? row.expectedFamilies
      : [],
    matchedFamilies: Array.isArray(row?.matchedFamilies)
      ? row.matchedFamilies
      : [],
    observedPackets: Number(row?.observedPackets ?? 0),
    retainedMetrics: Number(row?.retainedMetrics ?? 0),
  }));
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
  lastCmd,
  hydration,
  dailySummary,
  trace,
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
  const matrix = useMemo(() => matrixFromLastCmd(lastCmd), [lastCmd]);
  const families = useMemo(() => familyCountRows(hydration), [hydration]);

  if (compact) {
    return (
      <div className="space-y-4">
        <Card
          title="Ring control"
          subtitle="Compact connection and hydration surface."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <InfoTile label="Status" value={state.phase} />
            <InfoTile
              label="Selected ring"
              value={selected?.name || 'None selected'}
            />
            <InfoTile label="Hydration phase" value={hydration.phase} />
            <InfoTile
              label="History metrics"
              value={String(hydration.receivedMetrics)}
            />
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <ActionButton onClick={actions.scan}>Scan</ActionButton>
            <ActionButton onClick={actions.stopScan}>Stop scan</ActionButton>
            <ActionButton disabled={!selected} onClick={actions.connect}>
              Connect
            </ActionButton>
            <ActionButton onClick={actions.disconnect}>Disconnect</ActionButton>
            <ActionButton onClick={actions.startHealth}>
              Live health
            </ActionButton>
            <ActionButton onClick={actions.startSingleHealth}>
              Single health
            </ActionButton>
            <ActionButton onClick={actions.runHydrationBootstrap}>
              Hydrate reports
            </ActionButton>
            <ActionButton onClick={actions.requestNewAlgorithmHistoryData}>
              Algorithm history
            </ActionButton>
          </div>
        </Card>

        <Card title="Diagnostic matrix">
          <div className="space-y-2 text-xs text-slate-600">
            {matrix.length === 0 ? (
              <div>No command ledger yet.</div>
            ) : (
              matrix
                .slice(-6)
                .reverse()
                .map((row, idx) => (
                  <div
                    key={`${row.label}-${idx}`}
                    className="rounded-xl border border-slate-200 p-3"
                  >
                    <div className="font-semibold text-slate-900">
                      {row.label}
                    </div>
                    <div>
                      Expected: {row.expectedFamilies.join(', ') || '—'}
                    </div>
                    <div>
                      Matched: {row.matchedFamilies.join(', ') || '—'}
                    </div>
                    <div>Packets: {row.observedPackets}</div>
                    <div>Retained: {row.retainedMetrics}</div>
                  </div>
                ))
            )}
          </div>
        </Card>

        <Card title="Debug trace">
          <div className="max-h-72 overflow-auto rounded-2xl bg-slate-950 p-4 text-xs text-slate-200">
            <pre>
              {JSON.stringify({ lastCmd, trace: tracePreview(trace) }, null, 2)}
            </pre>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card title="Ring control">
        <div className="flex flex-wrap gap-2">
          <ActionButton
            onClick={actions.askPermissions}
            disabled={isWebTransport}
          >
            Ask permissions
          </ActionButton>
          <ActionButton onClick={actions.scan}>Scan</ActionButton>
          <ActionButton onClick={actions.stopScan}>Stop scan</ActionButton>
          <ActionButton disabled={!selected} onClick={actions.connect}>
            Connect
          </ActionButton>
          <ActionButton onClick={actions.disconnect}>Disconnect</ActionButton>

          <ActionButton onClick={actions.syncTime}>Sync time</ActionButton>
          <ActionButton onClick={actions.requestBattery}>Battery</ActionButton>
          <ActionButton onClick={actions.requestDeviceInfo}>
            Device info
          </ActionButton>
          <ActionButton onClick={actions.startHealth}>Live health</ActionButton>
          <ActionButton onClick={actions.startSingleHealth}>
            Single health
          </ActionButton>
          <ActionButton onClick={actions.requestHistoricalCount}>
            History count
          </ActionButton>
          <ActionButton onClick={actions.requestHistoricalData}>
            History data
          </ActionButton>
          <ActionButton onClick={actions.requestActiveData}>
            Active data
          </ActionButton>
          <ActionButton onClick={actions.requestActiveData2}>
            Active data 2
          </ActionButton>
          <ActionButton onClick={actions.requestNewAlgorithmHistoryCount}>
            Alg count
          </ActionButton>
          <ActionButton onClick={actions.requestNewAlgorithmHistoryData}>
            Alg data
          </ActionButton>
          <ActionButton onClick={actions.requestStep}>Step</ActionButton>
          <ActionButton onClick={actions.requestTemperature}>Temp</ActionButton>
          <ActionButton onClick={actions.runHydrationBootstrap}>
            Hydrate reports
          </ActionButton>
        </div>

        {isWebTransport ? (
          <p className="mt-3 text-xs text-slate-500">
            Web mode now records a command ledger so you can compare sent
            commands, expected receive families, observed families, and retained
            metrics instead of relying only on a rolling JSON trace.
          </p>
        ) : null}
      </Card>

      <Card
        title="Nearby rings"
        subtitle="Select the strongest ring candidate before connecting."
      >
        <div className="max-h-72 overflow-auto rounded-2xl border border-slate-200">
          {devices.length === 0 ? (
            <div className="p-4 text-sm text-slate-500">
              No devices discovered yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {devices.map((d) => {
                const active = d.id === selectedId;

                return (
                  <button
                    key={d.id || d.mac || `${d.name}-${d.rssi}`}
                    className={`flex w-full items-center justify-between px-4 py-3 text-left ${
                      active ? 'bg-slate-50' : 'bg-white'
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
          )}
        </div>
      </Card>

      <Card title="Hydration status">
        <div className="grid gap-3 md:grid-cols-2">
          <InfoTile label="Phase" value={hydration.phase} />
          <InfoTile
            label="Received packets"
            value={String(hydration.receivedPackets)}
          />
          <InfoTile
            label="Received metrics"
            value={String(hydration.receivedMetrics)}
          />
          <InfoTile
            label="Count estimate"
            value={
              typeof hydration.countEstimate === 'number'
                ? String(hydration.countEstimate)
                : '—'
            }
          />
          <InfoTile
            label="Algorithm packets"
            value={String(hydration.algorithmPackets)}
          />
          <InfoTile
            label="Active packets"
            value={String(hydration.activePackets)}
          />
          <InfoTile
            label="Sleep packets"
            value={String(hydration.sleepPackets)}
          />
          <InfoTile
            label="History errors"
            value={String(hydration.historyErrorPackets)}
          />
        </div>
      </Card>

      <Card title="Observed receive families">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {families.length === 0 ? (
            <div className="text-sm text-slate-500">
              No receive families counted yet.
            </div>
          ) : (
            families.map((row) => (
              <InfoTile
                key={row.family}
                label={row.family}
                value={String(row.count)}
              />
            ))
          )}
        </div>
      </Card>

      <Card title="Command / response matrix">
        <div className="space-y-3">
          {matrix.length === 0 ? (
            <div className="text-sm text-slate-500">No command ledger yet.</div>
          ) : (
            matrix
              .slice(-12)
              .reverse()
              .map((row, idx) => (
                <div
                  key={`${row.label}-${idx}`}
                  className="rounded-2xl border border-slate-200 p-4"
                >
                  <div className="text-sm font-semibold text-slate-900">
                    {row.label}
                  </div>
                  <div className="mt-2 grid gap-2 text-xs text-slate-600 md:grid-cols-2 xl:grid-cols-4">
                    <div>
                      <div className="font-medium text-slate-900">
                        Expected
                      </div>
                      <div>{row.expectedFamilies.join(', ') || '—'}</div>
                    </div>
                    <div>
                      <div className="font-medium text-slate-900">Matched</div>
                      <div>{row.matchedFamilies.join(', ') || '—'}</div>
                    </div>
                    <div>
                      <div className="font-medium text-slate-900">
                        Observed packets
                      </div>
                      <div>{row.observedPackets}</div>
                    </div>
                    <div>
                      <div className="font-medium text-slate-900">
                        Retained metrics
                      </div>
                      <div>{row.retainedMetrics}</div>
                    </div>
                  </div>
                </div>
              ))
          )}
        </div>
      </Card>

      <Card title="Daily summary">
        <div className="grid gap-3 md:grid-cols-2">
          <InfoTile
            label="Steps"
            value={
              dailySummary?.steps != null ? String(dailySummary.steps) : '—'
            }
          />
          <InfoTile
            label="Calories"
            value={
              dailySummary?.calories != null
                ? String(dailySummary.calories)
                : '—'
            }
          />
          <InfoTile
            label="Distance"
            value={
              dailySummary?.distanceMeters != null
                ? `${Math.round(dailySummary.distanceMeters)} m`
                : '—'
            }
          />
          <InfoTile
            label="Walking steps"
            value={
              dailySummary?.walkingSteps != null
                ? String(dailySummary.walkingSteps)
                : '—'
            }
          />
          <InfoTile
            label="Running steps"
            value={
              dailySummary?.runningSteps != null
                ? String(dailySummary.runningSteps)
                : '—'
            }
          />
          <InfoTile
            label="Last hydrate"
            value={relativeTime(hydration.lastPacketTs)}
          />
        </div>
      </Card>

      <Card title="Persistence">
        <div className="grid gap-3 md:grid-cols-2">
          <InfoTile label="Persist status" value={persistInfo} />
          <InfoTile label="Last persist" value={relativeTime(lastPersistAt)} />
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Safe shared-vital persistence currently targets heart rate and SpO₂.
          Temperature remains baseline-deviation-only until clinically
          normalized.
        </p>
      </Card>

      <Card title="Ring profile">
        <div className="grid gap-3 md:grid-cols-2">
          <InfoTile
            label="Connected device"
            value={state.connectedDevice?.name || selected?.name || '—'}
          />
          <InfoTile
            label="Device address"
            value={
              state.connectedDevice?.mac || selected?.mac || selected?.id || '—'
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

      <Card title="Last command / sync">
        <pre className="overflow-auto rounded-2xl bg-slate-950 p-4 text-xs text-slate-200">
          {JSON.stringify(lastCmd, null, 2)}
        </pre>
      </Card>

      <Card title="Session trace">
        <pre className="max-h-80 overflow-auto rounded-2xl bg-slate-950 p-4 text-xs text-slate-200">
          {JSON.stringify(tracePreview(trace), null, 2)}
        </pre>
      </Card>
    </div>
  );
}