// packages/shared-runtime/src/xrPayload.ts
export type XrSignal = { type: 'xr'; value: boolean; who?: 'clinician' | 'patient'; ts?: number };

export function isXrSignal(msg: unknown): msg is XrSignal {
  return !!msg && typeof msg === 'object' && (msg as any).type === 'xr' && typeof (msg as any).value === 'boolean';
}
