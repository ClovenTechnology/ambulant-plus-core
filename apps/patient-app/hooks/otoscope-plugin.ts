import { registerPlugin } from '@capacitor/core';

export type OtoscopeEvent =
  | { type: 'telemetry'; connected: boolean; usbProduct?: string; width?: number; height?: number; message?: string }
  | { type: 'frame'; ts: number }; // reserved for future

export type OtoscopePlugin = {
  askPermissions(): Promise<void>;
  /** Opens the UVC device (requests permission if needed). */
  open(options?: { patientId?: string }): Promise<{ ok: true }>;
  /** Closes device and stops preview/recording if running. */
  close(): Promise<{ ok: true }>;

  /** Start/stop a native preview pipeline (will render natively first; JS thumbnails later). */
  startPreview(options?: { width?: number; height?: number; fps?: number }): Promise<{ ok: true }>;
  stopPreview(): Promise<{ ok: true }>;

  /** Optional capture/record. Returns a local content:// or file:// URL when available. */
  capturePhoto(options?: { quality?: number }): Promise<{ ok: true; fileUrl?: string }>;
  startRecording(options?: { container?: 'mp4' | 'mkv'; maxSeconds?: number }): Promise<{ ok: true }>;
  stopRecording(): Promise<{ ok: true; fileUrl?: string }>;

  addListener(event: 'telemetry' | 'frame', cb: (e: OtoscopeEvent) => void): Promise<{ remove: () => void }>;
};

export const Otoscope = registerPlugin<OtoscopePlugin>('Otoscope');
