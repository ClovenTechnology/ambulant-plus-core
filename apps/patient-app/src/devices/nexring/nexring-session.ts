/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { Capacitor } from '@capacitor/core';
import { NexRing, type NexRingScanResult } from '@/hooks/nexring-plugin';
import {
  getBroadcastData,
  getMacFromAdvertising,
  getSdkDebugSummary,
  getSendCmdMap,
  loadNexRingSdk,
  maybeRegisterListener,
} from './nexring-sdk';
import {
  bestMetricsFromListener,
  normalizeCommandResult,
  normalizeDailySummary,
  normalizeDeviceInfo,
} from './nexring-normalizer';
import {
  expectedFamiliesForLabel,
  inferCommandResultFromPacket,
  inferDeviceInfoFromPacket,
  inferMetricFromPacket,
  isHistoryLikeFamily,
  packetFamilyLabel,
  parseNexRingPacket,
  safePushRawDataToSdk,
  shouldUseVendorParser,
} from './nexring-protocol';
import {
  decodeLiveHealthPacket,
  metricFromLiveHealthEnvelope,
} from './nexring-health-decoder';
import {
  NexRingHistoryTracker,
  isHistoryPacket,
} from './nexring-history';
import { NexRingReportStore } from './nexring-report-store';
import { NexRingWebTransport } from './nexring-web';
import {
  NexRingWebCommands,
  type SentPacketResult,
} from './nexring-web-commands';
import type {
  RingCommandResult,
  RingDeviceInfo,
  RingHealthMetric,
  RingMetric,
  RingScanDevice,
  RingSessionCallbacks,
  RingSessionState,
  RingTraceEvent,
} from './nexring-types';

function b64ToU8(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function u8ToNumArray(u8: Uint8Array): number[] {
  return Array.from(u8, (v) => v & 0xff);
}

type TransportLike = {
  askPermissions(): Promise<any>;
  startScan(): Promise<any>;
  stopScan(): Promise<any>;
  connect(options: { id?: string; mac?: string; name?: string }): Promise<any>;
  disconnect(): Promise<any>;
  requestMtu?(options?: { mtu?: number }): Promise<any>;
  startStreaming?(): Promise<any>;
  stopStreaming?(): Promise<any>;
  write(options: { bytes?: number[]; base64?: string }): Promise<any>;
};

type RawPacketSample = {
  ts: number;
  cmd: number | null;
  family: string;
  hex: string;
  meta: Record<string, number | string | boolean | null | undefined>;
};

type SessionMode = 'passive' | 'single_health' | 'live_health';

type CommandLedgerEntry = {
  id: number;
  label: string;
  code: string | number;
  expectedFamilies: string[];
  ts: number;
  matchedFamilies: string[];
  retainedMetrics: number;
  observedPackets: number;
  observedHex: string[];
};

function medianRounded(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 1) return Math.round(sorted[mid]);
  return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function scalarNumber(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export class NexRingSession {
  private callbacks: RingSessionCallbacks;
  private state: RingSessionState = {
    phase: 'idle',
    connectedDevice: null,
    lastError: null,
    lastSeenTs: null,
    mtu: null,
    batteryPct: null,
  };

  private sdk: any | null = null;
  private devices = new Map<string, RingScanDevice>();
  private listenerHandles: Array<{ remove: () => Promise<void> | void }> = [];
  private sdkUnsubscribers: Array<() => void> = [];
  private bootstrapping = false;
  private transport: TransportLike | null = null;
  private isWebTransport = false;
  private webCommands: NexRingWebCommands | null = null;
  private lastBatteryCandidates: number[] = [];
  private lastKnownBatteryPct: number | null = null;
  private lastLiveMetricTs: number | null = null;
  private lastKnownHr: number | null = null;
  private readyAtTs: number | null = null;
  private history = new NexRingHistoryTracker();
  private reportStore = new NexRingReportStore();

  private mode: SessionMode = 'passive';
  private passiveHealthPacketCount = 0;
  private passiveHealthWindowStartTs: number | null = null;
  private passiveGuardClosing = false;
  private lastPassiveGuardTs: number | null = null;

  private ledgerSeq = 1;
  private commandLedger: CommandLedgerEntry[] = [];

  private historyCalcInFlight = false;
  private lastHistoryCalcTs: number | null = null;

  constructor(callbacks: RingSessionCallbacks = {}) {
    this.callbacks = callbacks;
  }

  getState() {
    return this.state;
  }

  getDevices(): RingScanDevice[] {
    return Array.from(this.devices.values()).sort((a, b) => (b.rssi ?? -999) - (a.rssi ?? -999));
  }

  isUsingWebTransport() {
    return this.isWebTransport;
  }

  private delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private emitTrace(event: Omit<RingTraceEvent, 'ts'> & { ts?: number }) {
    this.callbacks.onTrace?.({
      ts: event.ts ?? Date.now(),
      ...event,
    });
  }

  private pushHydrationSnapshot() {
    this.callbacks.onHydration?.(this.history.getState());
    this.callbacks.onReportSnapshot?.(this.reportStore.getSnapshot());
  }

  private setMode(mode: SessionMode) {
    this.mode = mode;
    this.emitTrace({
      direction: 'sdk',
      label: 'session_mode',
      family: 'control',
      ok: true,
      parser: 'session',
      message: `mode=${mode}`,
      raw: { mode },
    });
  }

  private resetPassiveModeGuards() {
    this.setMode('passive');
    this.passiveHealthPacketCount = 0;
    this.passiveHealthWindowStartTs = null;
    this.passiveGuardClosing = false;
    this.lastPassiveGuardTs = null;
  }

  private markLiveModeAllowed(mode: Extract<SessionMode, 'single_health' | 'live_health'>) {
    this.setMode(mode);
    this.passiveHealthPacketCount = 0;
    this.passiveHealthWindowStartTs = null;
    this.passiveGuardClosing = false;
  }

  private clearLiveModeAllowed() {
    this.setMode('passive');
    this.passiveHealthPacketCount = 0;
    this.passiveHealthWindowStartTs = null;
    this.passiveGuardClosing = false;
  }

  private createLedgerEntry(label: string, code: string | number) {
    const entry: CommandLedgerEntry = {
      id: this.ledgerSeq++,
      label,
      code,
      expectedFamilies: expectedFamiliesForLabel(label),
      ts: Date.now(),
      matchedFamilies: [],
      retainedMetrics: 0,
      observedPackets: 0,
      observedHex: [],
    };
    this.commandLedger.push(entry);
    if (this.commandLedger.length > 200) {
      this.commandLedger = this.commandLedger.slice(-200);
    }
    return entry;
  }

  private recordSentPackets(results: SentPacketResult[], parser = 'web_command') {
    for (const result of results) {
      const entry = this.createLedgerEntry(result.label, result.cmd);

      this.emitTrace({
        direction: 'tx',
        label: result.label,
        code: result.cmd,
        hex: Array.from(result.packet)
          .map((b) => b.toString(16).padStart(2, '0'))
          .join(' '),
        ok: true,
        parser,
        message: `${result.label} dispatched`,
        raw: {
          ledgerId: entry.id,
          expectedFamilies: entry.expectedFamilies,
          mode: this.mode,
        },
      });
    }
  }

  private matchPacketToLedger(family: string, hex: string) {
    for (let i = this.commandLedger.length - 1; i >= 0; i--) {
      const entry = this.commandLedger[i];
      if (
        entry.expectedFamilies.length === 0 ||
        entry.expectedFamilies.includes(family)
      ) {
        entry.observedPackets += 1;
        if (!entry.matchedFamilies.includes(family)) entry.matchedFamilies.push(family);
        if (entry.observedHex.length < 5) entry.observedHex.push(hex);
        return entry;
      }
    }
    return null;
  }

  private bumpRetainedMetric(family: string, count: number) {
    for (let i = this.commandLedger.length - 1; i >= 0; i--) {
      const entry = this.commandLedger[i];
      if (
        entry.expectedFamilies.length === 0 ||
        entry.expectedFamilies.includes(family) ||
        entry.matchedFamilies.includes(family)
      ) {
        entry.retainedMetrics += count;
        return entry;
      }
    }
    return null;
  }

  private async enforcePassiveMode(reason: string) {
    if (!this.isWebTransport || !this.webCommands) return;
    if (this.passiveGuardClosing) return;

    const now = Date.now();
    if (this.lastPassiveGuardTs && now - this.lastPassiveGuardTs < 4000) return;

    this.passiveGuardClosing = true;
    this.lastPassiveGuardTs = now;

    try {
      const results = await this.webCommands.sendPassiveModeStop();
      this.recordSentPackets(results, 'passive_guard');
      this.clearLiveModeAllowed();

      this.emitCommandResult({
        ts: Date.now(),
        ok: true,
        code: 'passive_guard_close_health',
        message: `Unexpected live health stream observed during passive mode. Sent closeSingleHealth + closeHealth (${reason}).`,
      });
    } catch (err: any) {
      this.emitCommandResult({
        ts: Date.now(),
        ok: false,
        code: 'passive_guard_close_health_failed',
        message: err?.message || String(err),
      });
    } finally {
      this.passiveHealthPacketCount = 0;
      this.passiveHealthWindowStartTs = null;
      this.passiveGuardClosing = false;
    }
  }

  private maybeGuardUnexpectedLiveHealth(packetCmd: number | null) {
    if (!this.isWebTransport) return;
    if (packetCmd !== 0x83) return;
    if (this.mode !== 'passive') return;
    if (this.passiveGuardClosing) return;

    const now = Date.now();

    if (this.passiveHealthWindowStartTs == null) {
      this.passiveHealthWindowStartTs = now;
      this.passiveHealthPacketCount = 1;
      return;
    }

    this.passiveHealthPacketCount += 1;
    const elapsed = now - this.passiveHealthWindowStartTs;

    if (this.passiveHealthPacketCount >= 4 && elapsed >= 2500) {
      void this.enforcePassiveMode(`0x83 packets=${this.passiveHealthPacketCount} over ${elapsed}ms`);
    }
  }

  private retainMetric(metric: RingMetric, family: string, source: 'live' | 'history') {
    this.reportStore.ingestMetrics([metric], source);

    const retainedEntry = this.bumpRetainedMetric(family, 1);

    this.emitTrace({
      direction: 'sdk',
      label: 'retained_metric',
      family,
      ok: true,
      parser: 'session',
      message: `${metric.kind} retained`,
      raw: {
        metricKind: metric.kind,
        matchedLedgerId: retainedEntry?.id,
        matchedTxLabel: retainedEntry?.label,
        mode: this.mode,
      },
    });

    if (metric.kind === 'battery' && typeof metric.pct === 'number') {
      const pct = Math.round(metric.pct);
      this.lastBatteryCandidates.push(pct);
      if (this.lastBatteryCandidates.length > 5) {
        this.lastBatteryCandidates.shift();
      }

      const stable = medianRounded(this.lastBatteryCandidates);
      this.lastKnownBatteryPct = stable;
      this.patchState({ batteryPct: stable });

      this.callbacks.onMetric?.({
        ...metric,
        pct: stable,
      } as RingMetric);
    } else if (source === 'history') {
      this.history.ingestHistoricalMetric(metric);
      this.callbacks.onHistoricalMetric?.(metric as any);
    } else {
      if (metric.kind === 'health') {
        this.lastLiveMetricTs = Date.now();
        if (typeof metric.hr === 'number') {
          this.lastKnownHr = metric.hr;
        }
      }
      this.callbacks.onMetric?.(metric as RingMetric);
    }

    this.pushHydrationSnapshot();
  }

  private invokeSdkNoArgs(methodNames: string[]): unknown {
    if (!this.sdk) return undefined;

    for (const name of methodNames) {
      const fn = this.sdk?.[name];
      if (typeof fn !== 'function') continue;

      try {
        return Reflect.apply(fn, this.sdk, []);
      } catch (err) {
        this.emitTrace({
          direction: 'sdk',
          label: name,
          family: 'history_data',
          ok: false,
          parser: 'sdk_calculation',
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return undefined;
  }

  private maybeEmitScalarHistoryHealth(
    label: string,
    value: unknown,
    field: keyof RingHealthMetric,
  ) {
    const n = scalarNumber(value);
    if (typeof n !== 'number') return;

    const metric: RingMetric = {
      kind: 'health',
      ts: Date.now(),
      [field]: n,
      sourceMode: 'sdk_calculated',
      ...(field === 'spo2' ? { nightSpo2: n } : {}),
      ...(field === 'rr' ? { rr: n } : {}),
      ...(field === 'rhr' ? { rhr: n } : {}),
    } as RingMetric;

    this.retainMetric(metric, 'history_data', 'history');

    this.emitTrace({
      direction: 'sdk',
      label,
      family: 'history_data',
      ok: true,
      parser: 'sdk_calculation',
      message: `${field} derived from SDK calculator`,
      raw: { value: n },
    });
  }

  private retainSleepMetricsFromAny(
    label: string,
    raw: unknown,
    family: string = 'sleep_history',
  ) {
    if (raw == null) return 0;

    const sleepMetrics = bestMetricsFromListener('sleep', raw).filter(
      (metric): metric is Extract<RingMetric, { kind: 'sleep' }> => metric.kind === 'sleep',
    );

    for (const metric of sleepMetrics) {
      this.retainMetric(metric, family, 'history');
    }

    this.emitTrace({
      direction: 'sdk',
      label,
      family,
      ok: true,
      parser: 'sdk_calculation',
      message: `${sleepMetrics.length} sleep metrics retained`,
      raw: {
        metricCount: sleepMetrics.length,
        valuePreview:
          typeof raw === 'object' && raw
            ? Array.isArray(raw)
              ? { type: 'array', length: raw.length }
              : {
                  type: 'object',
                  keys: Object.keys(raw as Record<string, unknown>).slice(0, 30),
                  hasStagingList: Array.isArray((raw as any)?.stagingList),
                  hasSleepList: Array.isArray((raw as any)?.sleepList),
                  hasSessions: Array.isArray((raw as any)?.sessions),
                  startTimeStamp: (raw as any)?.startTimeStamp,
                  endTimeStamp: (raw as any)?.endTimeStamp,
                  duration: (raw as any)?.duration,
                }
            : raw,
      },
    });

    return sleepMetrics.length;
  }

  private maybeRunHistoryCalculators(reason: string) {
    if (!this.sdk) return;
    if (this.historyCalcInFlight) return;

    const now = Date.now();
    if (this.lastHistoryCalcTs && now - this.lastHistoryCalcTs < 4000) return;

    const historyState = this.history.getState();
    if ((historyState.receivedMetrics ?? 0) < 50) return;

    this.historyCalcInFlight = true;
    this.lastHistoryCalcTs = now;

    try {
      const validHistory = this.invokeSdkNoArgs(['ObtainValidHistoricalData']);
      if (validHistory != null) {
        const metrics = bestMetricsFromListener('history_row', validHistory);
        for (const metric of metrics) {
          this.retainMetric(metric, 'history_data', 'history');
        }

        this.emitTrace({
          direction: 'sdk',
          label: 'ObtainValidHistoricalData',
          family: 'history_data',
          ok: true,
          parser: 'sdk_calculation',
          message: `history calculators invoked (${reason})`,
          raw: {
            metricCount: metrics.length,
          },
        });
      }

      const processed = this.invokeSdkNoArgs(['processHistoryData']);
      if (processed != null) {
        const metrics = bestMetricsFromListener('history_row', processed);
        for (const metric of metrics) {
          this.retainMetric(metric, 'history_data', 'history');
        }

        const summary = normalizeDailySummary(processed);
        this.reportStore.ingestDailySummary(summary);
        this.pushHydrationSnapshot();

        this.emitTrace({
          direction: 'sdk',
          label: 'processHistoryData',
          family: 'history_data',
          ok: true,
          parser: 'sdk_calculation',
          message: `processHistoryData returned`,
          raw: {
            metricCount: metrics.length,
            summary,
          },
        });
      }

      let retainedSleepMetrics = 0;

      if (processed != null) {
        retainedSleepMetrics += this.retainSleepMetricsFromAny(
          'processHistoryData.sleep',
          processed,
          'sleep_history',
        );
      }

      if (retainedSleepMetrics === 0) {
        const sleepTime = this.invokeSdkNoArgs(['calcSleepTime']);
        if (sleepTime != null) {
          retainedSleepMetrics += this.retainSleepMetricsFromAny(
            'calcSleepTime',
            sleepTime,
            'sleep_history',
          );

          this.emitTrace({
            direction: 'sdk',
            label: 'calcSleepTime',
            family: 'sleep_history',
            ok: true,
            parser: 'sdk_calculation',
            message: 'sleep calculator returned',
            raw: {
              retainedSleepMetrics,
              sleepTime,
            },
          });
        }
      }

      this.maybeEmitScalarHistoryHealth(
        'calcRestingHeartRate',
        this.invokeSdkNoArgs(['calcRestingHeartRate']),
        'rhr',
      );

      this.maybeEmitScalarHistoryHealth(
        'calcOxygenSaturation',
        this.invokeSdkNoArgs(['calcOxygenSaturation']),
        'spo2',
      );

      this.maybeEmitScalarHistoryHealth(
        'calcRespiratoryRate',
        this.invokeSdkNoArgs(['calcRespiratoryRate']),
        'rr',
      );

      const sleepAvgHr = this.invokeSdkNoArgs(['calcSleepAverageHeartRate']);
      const avgHr = scalarNumber(sleepAvgHr);
      if (typeof avgHr === 'number') {
        this.retainMetric(
          {
            kind: 'health',
            ts: Date.now(),
            sleepAvgHr: avgHr,
            sourceMode: 'sdk_calculated',
          } as RingMetric,
          'history_data',
          'history',
        );

        this.emitTrace({
          direction: 'sdk',
          label: 'calcSleepAverageHeartRate',
          family: 'history_data',
          ok: true,
          parser: 'sdk_calculation',
          message: 'sleep average heart rate calculated',
          raw: { value: avgHr },
        });
      }

      if (processed != null) {
        const sleepPreviewCount = bestMetricsFromListener('sleep', processed).length;
        if (sleepPreviewCount === 0) {
          this.emitTrace({
            direction: 'sdk',
            label: 'sleep_stage_gap',
            family: 'sleep_history',
            ok: true,
            parser: 'sdk_calculation',
            message: 'processed history did not yield sleep stage metrics',
            raw: {
              processedType: Array.isArray(processed) ? 'array' : typeof processed,
            },
          });
        }
      }
    } finally {
      this.historyCalcInFlight = false;
    }
  }

  async init() {
    if (this.sdk) return;

    this.sdk = await loadNexRingSdk();
    console.log('[NexRing SDK summary]', getSdkDebugSummary(this.sdk));
    console.log('[NexRing SendCmd map]', getSendCmdMap(this.sdk));

    this.bindSdkListeners();

    if (Capacitor.getPlatform() === 'web') {
      this.isWebTransport = true;
      this.transport = new NexRingWebTransport({
        onScanResult: (e) => this.onScanResult(e as NexRingScanResult),
        onConnectionState: (e) => {
          const phase =
            e.state === 'scanning' ||
            e.state === 'scan_stopped' ||
            e.state === 'connecting' ||
            e.state === 'connected' ||
            e.state === 'disconnecting' ||
            e.state === 'disconnected'
              ? e.state
              : 'idle';

          this.patchState({
            phase: phase === 'scan_stopped' ? 'idle' : phase,
            connectedDevice:
              e.id && this.devices.has(e.id)
                ? this.devices.get(e.id)!
                : this.state.connectedDevice,
            lastError: null,
          });

          this.emitTrace({
            direction: 'sdk',
            label: 'connectionState',
            family: 'transport',
            ok: true,
            message: `state=${phase}`,
            raw: e,
          });
        },
        onReady: async () => {
          this.readyAtTs = Date.now();
          this.patchState({ phase: 'ready' });

          if (this.transport) {
            this.webCommands = new NexRingWebCommands(
              this.sdk,
              async (packet) => {
                await this.transport!.write({ bytes: u8ToNumArray(packet) });
              },
            );
          }

          await this.bootstrapAfterReady();
        },
        onNotify: (e) => {
          try {
            const bytes = b64ToU8(e.base64);
            const packet = parseNexRingPacket(bytes);

            this.patchState({
              lastSeenTs: Date.now(),
              lastError: null,
            });

            const ledger = this.matchPacketToLedger(packet.family, packet.hex);

            this.emitTrace({
              direction: 'rx',
              label: 'notify',
              code: packet.cmd ?? undefined,
              family: packet.family,
              hex: packet.hex,
              ok: true,
              parser: 'packet_router',
              message: `cmd=0x${(packet.cmd ?? 0).toString(16)} family=${packet.family}`,
              raw: {
                ...packet.meta,
                packetFamilyLabel: packetFamilyLabel(packet.family),
                mode: this.mode,
                matchedLedgerId: ledger?.id,
                matchedTxLabel: ledger?.label,
              },
            });

            this.maybeGuardUnexpectedLiveHealth(packet.cmd);

            let passiveMetric: RingMetric | null = null;
            const commandResult = inferCommandResultFromPacket(packet);
            const deviceInfo = inferDeviceInfoFromPacket(packet);

            const liveEnv = decodeLiveHealthPacket(packet, {
              prevHr: this.lastKnownHr ?? undefined,
            });

            if (liveEnv) {
              this.emitCommandResult({
                ts: liveEnv.ts,
                ok: true,
                code: 'live_health_envelope',
                message: `0x83 ${liveEnv.streamKind} sample=${liveEnv.sampleValidity}`,
                raw: {
                  packetHex: packet.hex,
                  family: packet.family,
                  streamKind: liveEnv.streamKind,
                  opticalHint: liveEnv.opticalHint,
                  hrCandidates: liveEnv.hrCandidates,
                  spo2Candidates: liveEnv.spo2Candidates,
                  tempCandidates: liveEnv.tempCandidates,
                  preferredHr: liveEnv.preferredHr,
                  preferredSpo2: liveEnv.preferredSpo2,
                  preferredTempDeviation: liveEnv.preferredTempDeviation,
                  byteMap: liveEnv.byteMap,
                  mode: this.mode,
                },
              });

              if (this.mode !== 'passive') {
                passiveMetric = metricFromLiveHealthEnvelope(liveEnv);
              }
            } else {
              passiveMetric = inferMetricFromPacket(packet);
            }

            if (passiveMetric) {
              const isHistoryMetric = isHistoryLikeFamily(packet.family);
              this.retainMetric(
                passiveMetric,
                packet.family,
                isHistoryMetric ? 'history' : 'live',
              );
            }

            if (deviceInfo) {
              this.callbacks.onDeviceInfo?.(deviceInfo);
            }

            if (isHistoryPacket(packet)) {
              const historyMeta = this.history.ingestPacket(packet);
              this.reportStore.ingestPacket(packet, historyMeta?.countEstimate);
              this.pushHydrationSnapshot();

              if (historyMeta) {
                this.emitCommandResult({
                  ts: Date.now(),
                  ok: true,
                  code: 'history_packet_observed',
                  message: `history packets=${historyMeta.receivedPackets}${typeof historyMeta.countEstimate === 'number' ? ` count≈${historyMeta.countEstimate}` : ''}`,
                  raw: {
                    packetHex: packet.hex,
                    cmd: packet.cmd,
                    family: packet.family,
                    meta: packet.meta,
                  },
                });
              }

              if (
                packet.family === 'history_data' ||
                packet.family === 'sleep_history' ||
                packet.family === 'algorithm_history'
              ) {
                this.maybeRunHistoryCalculators(`packet:${packet.family}`);
              }
            }

            const rawPacketSample: RawPacketSample = {
              ts: Date.now(),
              cmd: packet.cmd,
              family: packet.family,
              hex: packet.hex,
              meta: packet.meta,
            };

            if (commandResult) {
              this.emitCommandResult(commandResult);
            } else {
              this.emitCommandResult({
                ts: rawPacketSample.ts,
                ok: true,
                code: 'raw_packet',
                message: `cmd=0x${(packet.cmd ?? 0).toString(16)} family=${packet.family}`,
                raw: rawPacketSample,
              });
            }

            if (this.sdk && shouldUseVendorParser(packet)) {
              const pushed = safePushRawDataToSdk(this.sdk, bytes);
              this.emitTrace({
                direction: 'sdk',
                label: 'pushRawData',
                code: packet.cmd ?? undefined,
                family: packet.family,
                hex: packet.hex,
                ok: pushed.ok,
                parser: 'vendor',
                message: pushed.ok
                  ? 'raw packet forwarded to vendor parser'
                  : pushed.error,
                raw: {
                  mode: this.mode,
                  matchedLedgerId: ledger?.id,
                  matchedTxLabel: ledger?.label,
                },
              });

              if (!pushed.ok) {
                const alreadyHandled = !!passiveMetric || !!commandResult || !!deviceInfo;

                this.emitCommandResult({
                  ts: Date.now(),
                  ok: alreadyHandled,
                  code: alreadyHandled
                    ? 'vendor_parser_debug_failed'
                    : 'vendor_parser_failed',
                  message: `cmd=0x${(packet.cmd ?? 0).toString(16)} ${pushed.error}`,
                  raw: {
                    packetHex: packet.hex,
                    family: packet.family,
                    meta: packet.meta,
                  },
                });
              }
            }
          } catch (err: any) {
            const message = err?.message || String(err);
            this.patchState({ lastError: message });
            this.emitCommandResult({
              ts: Date.now(),
              ok: false,
              code: 'notify_decode_failed',
              message,
            });
          }
        },
        onError: (e) => {
          this.emitError(`${e.code}: ${e.message}`);
        },
      });
      return;
    }

    this.transport = NexRing;

    this.listenerHandles.push(
      await NexRing.addListener('scanResult', (e) => this.onScanResult(e)),
      await NexRing.addListener('connectionState', (e) => {
        const phase =
          e.state === 'scanning' ||
          e.state === 'scan_stopped' ||
          e.state === 'connecting' ||
          e.state === 'connected' ||
          e.state === 'disconnecting' ||
          e.state === 'disconnected'
            ? e.state
            : 'idle';

        this.patchState({
          phase: phase === 'scan_stopped' ? 'idle' : phase,
          connectedDevice:
            e.id && this.devices.has(e.id)
              ? this.devices.get(e.id)!
              : this.state.connectedDevice,
          lastError: null,
        });
      }),
      await NexRing.addListener('ready', async () => {
        this.readyAtTs = Date.now();
        this.patchState({ phase: 'ready' });
        await this.bootstrapAfterReady();
      }),
      await NexRing.addListener('mtu', (e) => {
        this.patchState({ mtu: e.mtu ?? null });
      }),
      await NexRing.addListener('notify', (e) => {
        try {
          const bytes = b64ToU8(e.base64);
          const packet = parseNexRingPacket(bytes);

          this.emitTrace({
            direction: 'rx',
            label: 'native_notify',
            code: packet.cmd ?? undefined,
            family: packet.family,
            hex: packet.hex,
            ok: true,
            parser: 'native_notify',
          });

          this.patchState({ lastSeenTs: Date.now() });

          if (this.sdk) {
            const pushed = safePushRawDataToSdk(this.sdk, bytes);
            this.emitTrace({
              direction: 'sdk',
              label: 'pushRawData',
              code: packet.cmd ?? undefined,
              family: packet.family,
              hex: packet.hex,
              ok: pushed.ok,
              parser: 'vendor',
              message: pushed.ok ? 'native raw packet forwarded' : pushed.error,
            });

            if (!pushed.ok) {
              this.emitCommandResult({
                ts: Date.now(),
                ok: false,
                code: 'vendor_parser_failed',
                message: pushed.error,
              });
            }
          }
        } catch (err: any) {
          this.emitError(`Failed to handle notify data: ${err?.message || String(err)}`);
        }
      }),
      await NexRing.addListener('error', (e) => {
        this.emitError(`${e.code}: ${e.message}`);
      }),
    );
  }

  async destroy() {
    for (const h of this.listenerHandles) {
      try {
        await h.remove();
      } catch {}
    }
    this.listenerHandles = [];

    for (const fn of this.sdkUnsubscribers) {
      try {
        fn();
      } catch {}
    }
    this.sdkUnsubscribers = [];
  }

  async askPermissions() {
    await this.init();
    await this.transport?.askPermissions();
  }

  async startScan() {
    await this.init();
    this.patchState({ phase: 'scanning', lastError: null });

    try {
      const result = await this.transport?.startScan();

      if (result && result.ok === false) {
        const message = result.message || 'Scan failed';
        this.patchState({ phase: 'idle', lastError: message });
        this.emitError(message);
        return;
      }
    } catch (err: any) {
      const message = err?.message || String(err);
      this.patchState({ phase: 'idle', lastError: message });
      this.emitError(message);
    }
  }

  async stopScan() {
    await this.init();
    await this.transport?.stopScan();
    if (this.state.phase === 'scanning') {
      this.patchState({ phase: 'idle' });
    }
  }

  async connect(device: RingScanDevice) {
    await this.init();
    this.patchState({ phase: 'connecting', connectedDevice: device, lastError: null });

    try {
      this.history.reset();
      this.reportStore.reset();
      this.lastLiveMetricTs = null;
      this.commandLedger = [];
      this.ledgerSeq = 1;
      this.lastHistoryCalcTs = null;
      this.historyCalcInFlight = false;
      this.resetPassiveModeGuards();
      this.pushHydrationSnapshot();

      await this.transport?.connect({
        id: device.id,
        mac: device.mac || device.id,
        name: device.name,
      });

      try {
        await this.transport?.requestMtu?.({ mtu: 247 });
      } catch {}

      try {
        await this.transport?.startStreaming?.();
      } catch {}
    } catch (err: any) {
      const message = err?.message || String(err);
      this.patchState({
        phase: 'idle',
        connectedDevice: device,
        lastError: message,
      });
      this.emitError(message);
    }
  }

  async disconnect() {
    await this.init();
    this.patchState({ phase: 'disconnecting' });
    this.bootstrapping = false;
    this.clearLiveModeAllowed();

    try {
      if (this.isWebTransport && this.webCommands) {
        const results = await this.webCommands.sendPassiveModeStop();
        this.recordSentPackets(results, 'disconnect');
      }
    } catch {}

    try {
      await this.transport?.stopStreaming?.();
    } catch {}

    await this.transport?.disconnect();
    this.patchState({ phase: 'disconnected', lastError: null });
  }

  async syncTime() {
    await this.init();
    if (this.isWebTransport && this.webCommands) {
      const result = await this.webCommands.sendTimeSync();
      this.recordSentPackets([result]);
      this.emitCommandResult({
        ts: Date.now(),
        ok: true,
        code: 'timeSyn',
        message: 'time sync dispatched',
      });
    }
  }

  async requestBattery() {
    await this.init();
    if (this.isWebTransport && this.webCommands) {
      const result = await this.webCommands.sendBatteryRequest();
      this.recordSentPackets([result]);
      this.emitCommandResult({
        ts: Date.now(),
        ok: true,
        code: 'batteryDataAndState',
        message: 'battery request dispatched',
      });
    }
  }

  async requestDeviceInfo() {
    await this.init();
    if (this.isWebTransport && this.webCommands) {
      const results = await this.webCommands.sendDeviceInfoRequests();
      this.recordSentPackets(results);
      this.emitCommandResult({
        ts: Date.now(),
        ok: true,
        code: 'deviceInfo1/2/5',
        message: 'device info requests dispatched',
      });
    }
  }

  async startHealth() {
    await this.init();

    try {
      if (this.isWebTransport && this.webCommands) {
        this.markLiveModeAllowed('live_health');
        const results = await this.webCommands.sendLiveHealthStart();
        this.recordSentPackets(results);

        this.emitCommandResult({
          ts: Date.now(),
          ok: true,
          code: 'start_health_sent',
          message: 'Live health mode command dispatched on web.',
        });

        return;
      }

      await this.transport?.startStreaming?.();
    } catch (err: any) {
      const message = err?.message || String(err);
      this.patchState({ lastError: message, phase: 'error' });
      this.emitError(message);
    }
  }

  async startSingleHealth() {
    await this.init();

    try {
      if (this.isWebTransport && this.webCommands) {
        this.markLiveModeAllowed('single_health');
        const results = await this.webCommands.sendSingleMeasurementStart();
        this.recordSentPackets(results);

        this.emitCommandResult({
          ts: Date.now(),
          ok: true,
          code: 'start_single_health_sent',
          message: 'Single health mode command dispatched on web.',
        });

        return;
      }
    } catch (err: any) {
      const message = err?.message || String(err);
      this.patchState({ lastError: message, phase: 'error' });
      this.emitError(message);
    }
  }

  async stopHealth() {
    await this.init();

    try {
      if (this.isWebTransport && this.webCommands) {
        const results = await this.webCommands.sendPassiveModeStop();
        this.recordSentPackets(results);
        this.clearLiveModeAllowed();

        this.emitCommandResult({
          ts: Date.now(),
          ok: true,
          code: 'stop_health_sent',
          message: 'Live health stop command dispatched on web.',
        });

        return;
      }

      await this.transport?.stopStreaming?.();
    } catch (err: any) {
      const message = err?.message || String(err);
      this.patchState({ lastError: message, phase: 'error' });
      this.emitError(message);
    }
  }

  async requestHistoricalCount() {
    await this.init();
    if (this.isWebTransport && this.webCommands) {
      this.clearLiveModeAllowed();
      this.history.markRequestedCount();
      this.reportStore.markRequestedCount();
      const result = await this.webCommands.sendHistoricalNum();
      this.recordSentPackets([result]);
      this.pushHydrationSnapshot();
      this.emitCommandResult({
        ts: Date.now(),
        ok: true,
        code: 'historicalNum',
        message: 'historical count dispatched',
      });
    }
  }

  async requestHistoricalData() {
    await this.init();
    if (this.isWebTransport && this.webCommands) {
      this.clearLiveModeAllowed();
      this.history.markRequestedData();
      this.reportStore.markRequestedData();
      const result = await this.webCommands.sendHistoricalData();
      this.recordSentPackets([result]);
      this.pushHydrationSnapshot();
      this.emitCommandResult({
        ts: Date.now(),
        ok: true,
        code: 'historicalData',
        message: 'historical data dispatched',
      });
    }
  }

  async requestStep() {
    await this.init();
    if (this.isWebTransport && this.webCommands) {
      this.clearLiveModeAllowed();
      const result = await this.webCommands.sendStepRequest();
      this.recordSentPackets([result]);
      this.emitCommandResult({
        ts: Date.now(),
        ok: true,
        code: 'step',
        message: 'step request dispatched',
      });
    }
  }

  async requestTemperature() {
    await this.init();
    if (this.isWebTransport && this.webCommands) {
      this.clearLiveModeAllowed();
      const result = await this.webCommands.sendTemperatureRequest();
      this.recordSentPackets([result]);
      this.emitCommandResult({
        ts: Date.now(),
        ok: true,
        code: 'temperature',
        message: 'temperature request dispatched',
      });
    }
  }

  async requestActiveData() {
    await this.init();
    if (this.isWebTransport && this.webCommands) {
      this.clearLiveModeAllowed();
      const result = await this.webCommands.sendActiveData();
      this.recordSentPackets([result]);
      this.emitCommandResult({
        ts: Date.now(),
        ok: true,
        code: 'ACTIVE_DATA',
        message: 'active data request dispatched',
      });
    }
  }

  async requestActiveData2() {
    await this.init();
    if (this.isWebTransport && this.webCommands) {
      this.clearLiveModeAllowed();
      const result = await this.webCommands.sendActiveData2();
      this.recordSentPackets([result]);
      this.emitCommandResult({
        ts: Date.now(),
        ok: true,
        code: 'ACTIVE_DATA_2',
        message: 'active data 2 request dispatched',
      });
    }
  }

  async requestNewAlgorithmHistoryCount() {
    await this.init();
    if (this.isWebTransport && this.webCommands) {
      this.clearLiveModeAllowed();
      const result = await this.webCommands.sendNewAlgorithmHistoryNum();
      this.recordSentPackets([result]);
      this.emitCommandResult({
        ts: Date.now(),
        ok: true,
        code: 'NEW_ALGORITHM_HISTORY_NUM',
        message: 'new algorithm history count dispatched',
      });
    }
  }

  async requestNewAlgorithmHistoryData() {
    await this.init();
    if (this.isWebTransport && this.webCommands) {
      this.clearLiveModeAllowed();
      const result = await this.webCommands.sendNewAlgorithmHistoryData();
      this.recordSentPackets([result]);
      this.emitCommandResult({
        ts: Date.now(),
        ok: true,
        code: 'NEW_ALGORITHM_HISTORY',
        message: 'new algorithm history data dispatched',
      });
    }
  }

  async runHydrationBootstrap() {
    await this.init();
    if (this.isWebTransport && this.webCommands) {
      this.clearLiveModeAllowed();
      this.history.markRequestedCount();
      this.history.markRequestedData();
      this.reportStore.markRequestedCount();
      this.reportStore.markRequestedData();

      const results = await this.webCommands.sendPassiveHydrationBootstrap();
      this.recordSentPackets(results, 'hydration_bootstrap');
      this.pushHydrationSnapshot();

      this.emitCommandResult({
        ts: Date.now(),
        ok: true,
        code: 'hydration_bootstrap',
        message: 'passive hydration requests dispatched',
      });
    }
  }

  private async bootstrapAfterReady() {
    if (this.bootstrapping) return;
    this.bootstrapping = true;

    try {
      if (this.isWebTransport && this.webCommands) {
        this.clearLiveModeAllowed();

        try {
          this.history.markRequestedCount();
          this.reportStore.markRequestedCount();

          const handshake = await this.webCommands.sendBootHandshake();
          this.recordSentPackets(handshake, 'identity_bootstrap');

          this.emitCommandResult({
            ts: Date.now(),
            ok: true,
            code: 'web_boot_handshake_complete',
            message: 'Web identity handshake dispatched: time sync, device info1/2/5, historicalNum.',
          });

          this.pushHydrationSnapshot();
        } catch (err: any) {
          this.emitCommandResult({
            ts: Date.now(),
            ok: false,
            code: 'bootstrap_handshake_failed',
            message: err?.message || String(err),
          });
        }

        await this.delay(260);

        try {
          const battery = await this.webCommands.sendBatteryRequest();
          this.recordSentPackets([battery], 'identity_bootstrap');
          this.emitCommandResult({
            ts: Date.now(),
            ok: true,
            code: 'battery_bootstrap',
            message: 'Battery request dispatched after boot handshake.',
          });
        } catch (err: any) {
          this.emitCommandResult({
            ts: Date.now(),
            ok: false,
            code: 'battery_bootstrap_failed',
            message: err?.message || String(err),
          });
        }

        await this.delay(420);

        try {
          this.history.markRequestedData();
          this.reportStore.markRequestedData();
          const hydration = await this.webCommands.sendPassiveHydrationBootstrap();
          this.recordSentPackets(hydration, 'report_bootstrap');
          this.pushHydrationSnapshot();

          this.emitCommandResult({
            ts: Date.now(),
            ok: true,
            code: 'report_hydration_bootstrap',
            message: 'Passive history/report hydration dispatched without auto-starting live health.',
          });
        } catch (err: any) {
          this.emitCommandResult({
            ts: Date.now(),
            ok: false,
            code: 'report_hydration_bootstrap_failed',
            message: err?.message || String(err),
          });
        }

        await this.delay(700);

        try {
          const stopResults = await this.webCommands.sendPassiveModeStop();
          this.recordSentPackets(stopResults, 'post_bootstrap_passive_stop');
          this.clearLiveModeAllowed();

          this.emitCommandResult({
            ts: Date.now(),
            ok: true,
            code: 'post_bootstrap_passive_stop',
            message: 'Sent closeSingleHealth + closeHealth after passive bootstrap to suppress stray measurement carry-over.',
          });
        } catch (err: any) {
          this.emitCommandResult({
            ts: Date.now(),
            ok: false,
            code: 'post_bootstrap_passive_stop_failed',
            message: err?.message || String(err),
          });
        }

        this.emitCommandResult({
          ts: Date.now(),
          ok: true,
          code: 'bootstrap_complete_passive',
          message: 'Connect bootstrap finished in passive mode. Start live health manually only when needed.',
        });

        return;
      }
    } finally {
      this.bootstrapping = false;
    }
  }

  private bindSdkListeners() {
    if (!this.sdk) return;

    const add = (unbind?: (() => void) | undefined) => {
      if (unbind) this.sdkUnsubscribers.push(unbind);
    };

    const emitMetrics = (
      metrics: RingMetric[],
      source: 'live' | 'history',
      sdkLabel: string,
      raw: any,
      familyHint?: string,
    ) => {
      if (metrics.length === 0) {
        this.emitTrace({
          direction: 'sdk',
          label: sdkLabel,
          family: familyHint ?? (source === 'history' ? 'history' : 'live'),
          ok: true,
          parser: 'sdk_listener',
          message: 'listener fired but no normalized metrics retained',
          raw,
        });
        return;
      }

      this.emitTrace({
        direction: 'sdk',
        label: sdkLabel,
        family: familyHint ?? (source === 'history' ? 'history' : 'live'),
        ok: true,
        parser: 'sdk_listener',
        message: `${metrics.length} normalized metrics retained`,
        raw,
      });

      const familyForLedger =
        familyHint && familyHint !== 'history' && familyHint !== 'live'
          ? familyHint
          : source === 'history'
            ? 'history_data'
            : 'live_stream';

      for (const metric of metrics) {
        this.retainMetric(metric, familyForLedger, source);
      }

      if (source === 'history') {
        this.maybeRunHistoryCalculators(`listener:${sdkLabel}`);
      }
    };

    add(
      maybeRegisterListener(this.sdk, ['registerHealthListener'], (raw: any) => {
        emitMetrics(bestMetricsFromListener('health', raw), 'live', 'registerHealthListener', raw, 'live_stream');
      }),
    );

    add(
      maybeRegisterListener(
        this.sdk,
        ['registerStepListener', 'registerActivityDataListener'],
        (raw: any) => {
          emitMetrics(bestMetricsFromListener('activity', raw), 'live', 'registerActivityDataListener', raw, 'active_data');
        },
      ),
    );

    add(
      maybeRegisterListener(this.sdk, ['registerTemperatureListener'], (raw: any) => {
        emitMetrics(bestMetricsFromListener('temperature', raw), 'live', 'registerTemperatureListener', raw, 'temperature_history');
      }),
    );

    add(
      maybeRegisterListener(this.sdk, ['registerBatteryDataAndStateListener'], (raw: any) => {
        emitMetrics(bestMetricsFromListener('battery', raw), 'live', 'registerBatteryDataAndStateListener', raw, 'battery');
      }),
    );

    add(
      maybeRegisterListener(this.sdk, ['registerHistoricalNumListener'], (raw: any) => {
        this.emitTrace({
          direction: 'sdk',
          label: 'registerHistoricalNumListener',
          family: 'history_count',
          ok: true,
          parser: 'sdk_listener',
          raw,
        });

        this.emitCommandResult(
          normalizeCommandResult({
            ok: true,
            code: 'historicalNumListener',
            raw,
          }),
        );
      }),
    );

    add(
      maybeRegisterListener(this.sdk, ['registerHistoricalDataListener'], (raw: any) => {
        emitMetrics(bestMetricsFromListener('history_row', raw), 'history', 'registerHistoricalDataListener', raw, 'history_data');
      }),
    );

    add(
      maybeRegisterListener(
        this.sdk,
        ['registerSleepHistoryListener', 'registerSleepHistoryListeners'],
        (raw: any) => {
          emitMetrics(bestMetricsFromListener('sleep', raw), 'history', 'registerSleepHistoryListener', raw, 'sleep_history');
        },
      ),
    );

    add(
      maybeRegisterListener(
        this.sdk,
        ['registerDailyActivityHistoryListener', 'registerDailyActivityHistoryListeners'],
        (raw: any) => {
          emitMetrics(bestMetricsFromListener('daily_summary', raw), 'history', 'registerDailyActivityHistoryListener', raw, 'daily_activity_history');
          this.reportStore.ingestDailySummary(normalizeDailySummary(raw));
          this.pushHydrationSnapshot();
        },
      ),
    );

    add(
      maybeRegisterListener(
        this.sdk,
        ['registerExerciseActivityHistoryListener', 'registerExerciseActivityHistoryListeners'],
        (raw: any) => {
          emitMetrics(bestMetricsFromListener('activity', raw), 'history', 'registerExerciseActivityHistoryListener', raw, 'activity_intensity_history');
        },
      ),
    );

    add(
      maybeRegisterListener(
        this.sdk,
        ['registerTemperatureHistoryDataListener', 'registerTemperatureHistoryDataListeners'],
        (raw: any) => {
          emitMetrics(bestMetricsFromListener('temperature', raw), 'history', 'registerTemperatureHistoryListener', raw, 'temperature_history');
        },
      ),
    );

    add(
      maybeRegisterListener(
        this.sdk,
        ['registerStepTemperatureActivityIntensityHistoryListener', 'registerStepTemperatureActivityIntensityHistoryListeners'],
        (raw: any) => {
          emitMetrics(bestMetricsFromListener('daily_summary', raw), 'history', 'registerStepTemperatureActivityIntensityHistoryListener', raw, 'activity_intensity_history');
          this.reportStore.ingestDailySummary(normalizeDailySummary(raw));
          this.pushHydrationSnapshot();
        },
      ),
    );

    add(
      maybeRegisterListener(
        this.sdk,
        ['registerNewAlgorithmHistoryNumberListener'],
        (raw: any) => {
          this.emitTrace({
            direction: 'sdk',
            label: 'registerNewAlgorithmHistoryNumberListener',
            family: 'algorithm_history',
            ok: true,
            parser: 'sdk_listener',
            raw,
          });

          this.emitCommandResult(
            normalizeCommandResult({
              ok: true,
              code: 'newAlgorithmHistoryNumberListener',
              raw,
            }),
          );
        },
      ),
    );

    add(
      maybeRegisterListener(
        this.sdk,
        ['registerNewAlgorithmHistoryDataListener', 'registerNewAlgorithmHistoryListener'],
        (raw: any) => {
          emitMetrics(
            bestMetricsFromListener('sleep', raw),
            'history',
            'registerNewAlgorithmHistoryDataListener.sleep',
            raw,
            'algorithm_history',
          );

          emitMetrics(
            bestMetricsFromListener('algorithm', raw),
            'history',
            'registerNewAlgorithmHistoryDataListener.algorithm',
            raw,
            'algorithm_history',
          );
        },
      ),
    );

    add(
      maybeRegisterListener(
        this.sdk,
        ['registerActiveDataListener', 'registerActivityDataListener'],
        (raw: any) => {
          emitMetrics(bestMetricsFromListener('active_data', raw), 'history', 'registerActiveDataListener', raw, 'active_data');
        },
      ),
    );

    add(
      maybeRegisterListener(this.sdk, ['registerActivityData2Listener', 'registerActiveData2Listener'], (raw: any) => {
        emitMetrics(bestMetricsFromListener('active_data_2', raw), 'history', 'registerActivityData2Listener', raw, 'active_data_2');
      }),
    );

    add(
      maybeRegisterListener(
        this.sdk,
        ['registerDailyActivitySummary2Listener', 'registerDailyActivityDataSummary2Listener'],
        (raw: any) => {
          emitMetrics(bestMetricsFromListener('daily_summary', raw), 'history', 'registerDailyActivitySummary2Listener', raw, 'daily_activity_summary_2');
          this.reportStore.ingestDailySummary(normalizeDailySummary(raw));
          this.pushHydrationSnapshot();
        },
      ),
    );

    add(
      maybeRegisterListener(
        this.sdk,
        ['registerHistoryDataErrorCallbackListener', 'registerHistoricalDataErrorCallbackListener'],
        (raw: any) => {
          this.emitTrace({
            direction: 'sdk',
            label: 'registerHistoryDataErrorCallbackListener',
            family: 'history_error',
            ok: true,
            parser: 'sdk_listener',
            raw,
          });

          this.emitCommandResult(
            normalizeCommandResult({
              ok: false,
              code: 'historyDataErrorCallback',
              raw,
            }),
          );
        },
      ),
    );

    add(
      maybeRegisterListener(
        this.sdk,
        ['registerDeviceInfo1Listener', 'registerDeviceInfo2Listener', 'registerDeviceInfo5Listener'],
        (raw: any) => {
          const info: RingDeviceInfo = normalizeDeviceInfo(raw);
          this.callbacks.onDeviceInfo?.(info);
        },
      ),
    );
  }

  private onScanResult(e: NexRingScanResult | any) {
    const device: RingScanDevice = {
      id: e.id || e.mac || '',
      mac: e.mac || e.id,
      name: e.name || '',
      rssi: e.rssi,
      isConnectable: e.isConnectable,
      advBase64: e.advBase64,
    };

    if (e.advBase64 && this.sdk) {
      try {
        const advBytes = b64ToU8(e.advBase64);
        device.advMac = getMacFromAdvertising(this.sdk, advBytes);
        device.advMeta = getBroadcastData(this.sdk, advBytes);
      } catch {}
    }

    const key = device.id || device.mac || `${device.name || 'ring'}-${device.rssi || 0}`;
    this.devices.set(key, device);
    this.callbacks.onScan?.(device);
  }

  private emitCommandResult(result: RingCommandResult) {
    const ledgerSnapshot = this.commandLedger.slice(-20).map((entry) => ({
      id: entry.id,
      label: entry.label,
      expectedFamilies: entry.expectedFamilies,
      matchedFamilies: entry.matchedFamilies,
      observedPackets: entry.observedPackets,
      retainedMetrics: entry.retainedMetrics,
    }));

    this.callbacks.onCommandResult?.({
      ...result,
      raw: {
        ...(typeof result.raw === 'object' && result.raw ? (result.raw as Record<string, unknown>) : {}),
        mode: this.mode,
        ledger: ledgerSnapshot,
      },
    });
  }

  private emitError(message: string) {
    this.patchState({ phase: 'error', lastError: message });
    this.callbacks.onError?.(message);
  }

  private patchState(patch: Partial<RingSessionState>) {
    this.state = { ...this.state, ...patch };
    this.callbacks.onState?.(this.state);
  }
}