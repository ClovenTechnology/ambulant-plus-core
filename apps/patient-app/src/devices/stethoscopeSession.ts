//apps/patient-app/src/devices/stethoscopeSession.ts
import type { PcmChunk } from '@/src/devices/decoders/wav';
import { cleanStethoscopePcm16Samples, WavRecorder } from '@/src/devices/decoders/wav';
import { StethoscopeBridge, type StethScanDevice } from '@/src/devices/stethoscopeBridge';
import type {
  StethBodySite,
  StethClipMeta,
  StethEchoMode,
  StethNativeAudioEvent,
  StethNativeEvent,
  StethQuickAnalysis,
  StethSessionState,
  StethStreamKind,
  StethTelemetry,
} from '@/src/lib/stethoscope-types';

type SessionOptions = {
  patientId: string;
  site?: StethBodySite;
  echoMode?: StethEchoMode;
  agcGain?: number;
  sampleRate?: number;
  streamKind?: StethStreamKind;
  onState?: (state: StethSessionState) => void;
  onWaveform?: (samples: Int16Array) => void;
  onClipReady?: (clip: { blob: Blob; meta: StethClipMeta }) => void;
  onScanResult?: (device: StethScanDevice) => void;
};

function newId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `steth_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }
}

function classifyQuality(analysis: StethQuickAnalysis): 'unknown' | 'good' | 'noise' {
  if (analysis.clipPct > 1.0) return 'noise';
  if (analysis.rms < 0.01) return 'noise';
  return 'good';
}

function summarizeSamples(
  samples: Int16Array,
  sampleRate: number,
): { peaks: number[]; analysis: StethQuickAnalysis } {
  const n = samples.length;
  if (!n) {
    return {
      peaks: [],
      analysis: { rms: 0, peak: 0, clipPct: 0, dc: 0, zcrPerSec: 0 },
    };
  }

  let sumSq = 0;
  let maxAbs = 0;
  let clipCount = 0;
  let dcSum = 0;
  let zc = 0;
  let lastSign = 0;

  const peakBins = 120;
  const peaks = new Array<number>(peakBins).fill(0);
  const binSize = Math.max(1, Math.floor(n / peakBins));

  for (let i = 0; i < n; i++) {
    const s = samples[i] / 32768;
    const abs = Math.abs(s);

    sumSq += s * s;
    dcSum += s;
    if (abs > maxAbs) maxAbs = abs;
    if (abs >= 0.98) clipCount++;

    const sign = s >= 0 ? 1 : -1;
    if (i > 0 && sign !== lastSign) zc++;
    lastSign = sign;

    const bin = Math.min(peakBins - 1, Math.floor(i / binSize));
    if (abs > peaks[bin]) peaks[bin] = abs;
  }

  const rms = Math.sqrt(sumSq / n);
  const dc = dcSum / n;
  const clipPct = (clipCount / n) * 100;
  const durationSec = sampleRate > 0 ? n / sampleRate : 0;
  const zcrPerSec = durationSec > 0 ? zc / durationSec : 0;

  return {
    peaks,
    analysis: {
      rms,
      peak: maxAbs,
      clipPct,
      dc,
      zcrPerSec,
    },
  };
}

export class StethoscopeSession {
  private readonly bridge: StethoscopeBridge;
  private readonly onState?: SessionOptions['onState'];
  private readonly onWaveform?: SessionOptions['onWaveform'];
  private readonly onClipReady?: SessionOptions['onClipReady'];
  private readonly onScanResult?: SessionOptions['onScanResult'];

  private patientId: string;
  private site: StethBodySite;
  private echoMode: StethEchoMode;
  private agcGain: number;
  private streamKind: StethStreamKind;
  private sampleRate: number;
  private channels = 1;

  private recorder: WavRecorder;
  private state: StethSessionState;
  private startedAt: number | null = null;

  constructor(opts: SessionOptions) {
    this.patientId = opts.patientId;
    this.site = opts.site ?? 'chest-apex';
    this.echoMode = opts.echoMode ?? 'heart';
    this.agcGain = opts.agcGain ?? 0;
    this.streamKind = opts.streamKind ?? 'filtered';
    this.sampleRate = opts.sampleRate ?? 8000;

    this.bridge = new StethoscopeBridge();
    this.onState = opts.onState;
    this.onWaveform = opts.onWaveform;
    this.onClipReady = opts.onClipReady;
    this.onScanResult = opts.onScanResult;
    this.recorder = new WavRecorder(this.sampleRate);

    this.state = {
      captureState: 'idle',
      connected: false,
      recording: false,
      packets: 0,
      sampleRate: this.sampleRate,
      channels: this.channels,
      streamKind: this.streamKind,
      site: this.site,
      echoMode: this.echoMode,
      agcGain: this.agcGain,
      telemetry: { updatedAt: Date.now() },
      startedAt: null,
      elapsedMs: 0,
      lastError: null,
    };

    this.bridge.setHandlers({
      onEvent: (evt) => this.handleEvent(evt),
      onTelemetry: (telemetry) => this.handleTelemetry(telemetry),
      onScanResult: (device) => this.onScanResult?.(device),
      onDisconnect: () => {
        this.patchState({
          connected: false,
          recording: false,
          captureState: this.state.captureState === 'capturing' ? 'error' : 'idle',
          lastError:
            this.state.captureState === 'capturing'
              ? 'Device disconnected during capture.'
              : this.state.lastError,
        });
      },
      onError: (message) => {
        this.patchState({
          captureState: 'error',
          recording: false,
          lastError: message,
        });
      },
    });
  }

  getState() {
    return this.state;
  }

  isNative() {
    return this.bridge.isNative;
  }

  async startScan() {
    await this.bridge.askPermissions();
    return this.bridge.startScan();
  }

  async stopScan() {
    return this.bridge.stopScan();
  }

  setSite(site: StethBodySite) {
    this.site = site;
    this.patchState({ site });
  }

  async setEchoMode(mode: StethEchoMode) {
    this.echoMode = mode;
    this.patchState({ echoMode: mode });
    await this.bridge.setEchoMode(mode);
  }

  async setAgcGain(gain: number) {
    this.agcGain = gain;
    this.patchState({ agcGain: gain });
    await this.bridge.setAgcGain(gain);
  }

  async connect(mac?: string) {
    this.patchState({ captureState: 'connecting', lastError: null });
    await this.bridge.askPermissions();
    await this.bridge.connect(mac);
    this.patchState({
      captureState: 'connected',
      connected: true,
      lastError: null,
    });
  }

  async disconnect() {
    await this.bridge.disconnect();
    this.patchState({
      connected: false,
      recording: false,
      captureState: 'idle',
      startedAt: null,
      elapsedMs: 0,
    });
  }

  async startCapture() {
    this.recorder.clear();
    this.startedAt = Date.now();

    this.patchState({
      captureState: 'capturing',
      recording: true,
      packets: 0,
      startedAt: this.startedAt,
      elapsedMs: 0,
      lastError: null,
    });

    await this.bridge.startAuscultation({
      site: this.site,
      sampleRate: this.sampleRate,
      echoMode: this.echoMode,
      agcGain: this.agcGain,
      streamKind: this.streamKind,
    });
  }

  async stopCapture(note?: string) {
    if (!this.state.recording) return;

    this.patchState({
      captureState: 'stopping',
      recording: false,
    });

    await this.bridge.stopAuscultation();

    this.patchState({ captureState: 'finalizing' });

    const samples = this.recorder.flushSamples();
    const durationMs =
      this.sampleRate > 0 ? Math.round((samples.length / this.sampleRate) * 1000) : 0;

    const recorder = new WavRecorder(this.sampleRate);
    recorder.push({
      ts: Date.now(),
      sampleRate: this.sampleRate,
      samples,
    });
    const finalBlob = recorder.flush();

    const { peaks, analysis } = summarizeSamples(samples, this.sampleRate);

    const meta: StethClipMeta = {
      id: newId(),
      patientId: this.patientId,
      createdAt: new Date().toISOString(),
      durationMs,
      sizeBytes: finalBlob.size,
      sampleRate: this.sampleRate,
      channels: this.channels,
      bitsPerSample: 16,
      site: this.site,
      note,
      streamKind: this.streamKind,
      echoMode: this.echoMode,
      agcGain: this.agcGain,
      quality: classifyQuality(analysis),
      peaks,
      analysis,
      status: 'queued',
      attempts: 0,
      audit: {
        deviceId: this.state.telemetry.deviceId,
        deviceName: this.state.telemetry.deviceName,
        manufacturer: this.state.telemetry.manufacturer,
        model: this.state.telemetry.model,
        firmware: this.state.telemetry.firmware,
      },
    };

    this.patchState({
      captureState: this.state.connected ? 'connected' : 'idle',
      recording: false,
      startedAt: null,
      elapsedMs: 0,
    });

    this.onClipReady?.({ blob: finalBlob, meta });
  }

  async destroy() {
    await this.bridge.destroy();
  }

  private handleTelemetry(telemetry: StethTelemetry) {
    this.patchState({
      telemetry,
      connected: !!telemetry.connected,
    });
  }

  private handleEvent(evt: StethNativeEvent) {
    if (evt.type === 'audioFrame') {
      this.handleAudioFrame(evt, this.streamKind);
      return;
    }
    if (evt.type === 'rawAudioFrame') {
      if (this.streamKind === 'raw') this.handleAudioFrame(evt, 'raw');
      return;
    }
    if (evt.type === 'filteredAudioFrame') {
      if (this.streamKind === 'filtered') this.handleAudioFrame(evt, 'filtered');
      return;
    }
  }

  private handleAudioFrame(evt: StethNativeAudioEvent, kind: StethStreamKind) {
    const decodedSamples = this.bridge.decodeAudioFrame(evt);
    const samples =
      kind === 'raw'
        ? decodedSamples
        : cleanStethoscopePcm16Samples(decodedSamples, {
            hpAlpha: 0.995,
            gain: this.echoMode === 'lung' ? 0.95 : 0.85,
            limit: 0.92,
          });

    if (!samples.length) return;

    if (evt.sampleRate && evt.sampleRate !== this.sampleRate) {
      this.sampleRate = evt.sampleRate;
      this.recorder = new WavRecorder(this.sampleRate);
    }
    if (evt.channels && evt.channels > 0) this.channels = evt.channels;

    const chunk: PcmChunk = {
      ts: evt.ts || Date.now(),
      sampleRate: this.sampleRate,
      samples,
    };

    if (kind === this.streamKind) {
      this.recorder.push(chunk);
      this.onWaveform?.(samples);

      const { analysis } = summarizeSamples(samples, this.sampleRate);
      const elapsedMs = this.startedAt ? Date.now() - this.startedAt : 0;

      this.patchState({
        packets: this.state.packets + 1,
        elapsedMs,
        sampleRate: this.sampleRate,
        channels: this.channels,
        live: analysis,
      });
    }
  }

  private patchState(patch: Partial<StethSessionState>) {
    this.state = { ...this.state, ...patch };
    this.onState?.(this.state);
  }
}