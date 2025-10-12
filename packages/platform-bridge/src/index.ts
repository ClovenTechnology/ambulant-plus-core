export type StethoscopePcmFrame = Int16Array;

export interface StethoscopeBridge {
  connect(opts?: { deviceIdHint?: string }): Promise<void>;
  startPcmStream(opts?: { sampleRate?: number }): Promise<void>;
  stopPcmStream(): Promise<void>;
  onPcm(cb: (ts: number, frame: StethoscopePcmFrame) => void): () => void;
  setGain?(gain: number): Promise<void>;
}

let pcmHandlers: Array<(ts: number, f: StethoscopePcmFrame) => void> = [];

const notSupported = (what: string): never => {
  // why: surface clearly in UI and logs
  throw new Error(`[platform-bridge] ${what} is not available in web fallback. Use native HMS/GMS build.`);
};

export const Stethoscope: StethoscopeBridge = {
  async connect() { notSupported('stethoscope.connect'); },
  async startPcmStream() { notSupported('stethoscope.startPcmStream'); },
  async stopPcmStream() { return; },
  onPcm(cb) { pcmHandlers.push(cb); return () => { pcmHandlers = pcmHandlers.filter(x => x !== cb); }; },
};

export function __emitPcm(ts: number, frame: StethoscopePcmFrame) {
  // why: native side calls this to feed JS
  for (const h of pcmHandlers) h(ts, frame);
}
