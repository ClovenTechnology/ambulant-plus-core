// packages/ambulant-rtc/src/controlTypes.ts
/**
 * Single source of truth for LiveKit data topics and message types.
 * Import from both apps + server-ish helpers so you never drift again.
 */

export const RTC_TOPICS = {
  CONTROL: 'control',
  CHAT: 'chat',
  VITALS: 'vitals',
} as const;

export type RtcTopic = (typeof RTC_TOPICS)[keyof typeof RTC_TOPICS];

/**
 * Canonical control message types.
 * ✅ Use these exact strings on both sides.
 */
export const CONTROL_TYPES = {
  OVERLAY: 'overlay',
  CAPTIONS: 'captions',
  VITALS_VISIBILITY: 'vitals', // show/hide vitals UI
  VITALS_OVERLAY: 'vitalsOverlay', // stream vitals overlay
  RECORDING: 'recording',
  SCREENSHARE: 'screenshare',
  RAISE_HAND: 'raise_hand',
  XR: 'xr',
  EXPORT: 'export',
  TYPING: 'typing',
} as const;

export type ControlType = (typeof CONTROL_TYPES)[keyof typeof CONTROL_TYPES];

export type ControlMessage<T = unknown> = {
  type: ControlType;
  value: T;
  from?: string; // "patient" | "clinician" | etc (not enforced)
};

export type ChatMessage = {
  from?: string;
  text?: string;

  /** Optional typing signal (if you keep it) */
  type?: 'typing';
  value?: boolean;
};

/** Encode helper (safe, small, consistent) */
export function encodeJson(data: unknown) {
  return new TextEncoder().encode(JSON.stringify(data));
}

/** Decode helper (safe-ish) */
export function decodeJson<T = any>(payload: Uint8Array): T | null {
  try {
    const text = new TextDecoder().decode(payload);
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}
