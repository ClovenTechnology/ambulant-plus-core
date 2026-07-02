// packages/ambulant-rtc/src/captionTypes.ts

export const RTC_TOPIC_CAPTIONS = "captions" as const;
export const RTC_TOPIC_TRANSCRIPT = "transcript" as const;

export type CaptionSpeakerRole =
  | "clinician"
  | "patient"
  | "guest"
  | "caption-worker"
  | "system";

export type CaptionSegmentKind = "caption.partial" | "caption.final";

export type CaptionSource =
  | "aws-transcribe-medical"
  | "aws-transcribe-standard"
  | "livekit-agent"
  | "manual"
  | "unknown";

export type CaptionEvent = {
  type: CaptionSegmentKind;
  roomId: string;
  encounterId?: string | null;
  appointmentId?: string | null;

  speakerRole: CaptionSpeakerRole;
  speakerIdentity?: string | null;
  speakerName: string;
  speakerDisplay: string;

  text: string;
  final: boolean;
  language?: string | null;
  source: CaptionSource;
  confidence?: number | null;

  startedAt?: string | null;
  endedAt?: string | null;
  timestamp: string;
  sequence: number;
};

export type TranscriptDraftSection =
  | "presentingComplaint"
  | "symptoms"
  | "history"
  | "medicationsMentioned"
  | "allergiesMentioned"
  | "assessment"
  | "plan"
  | "safetyNetting"
  | "followUp";

export type TranscriptNoteSuggestion = {
  id: string;
  section: TranscriptDraftSection;
  suggestedText: string;
  source: "caption_transcript";
  confidence?: number | null;
  duplicateOf?: string[];
  action: "append_new_only";
  createdAt: string;
};

export function isCaptionEvent(value: unknown): value is CaptionEvent {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    (v.type === "caption.partial" || v.type === "caption.final") &&
    typeof v.roomId === "string" &&
    typeof v.text === "string" &&
    typeof v.speakerDisplay === "string" &&
    typeof v.timestamp === "string"
  );
}

export function makeCaptionEvent(input: Omit<CaptionEvent, "timestamp"> & { timestamp?: string }): CaptionEvent {
  return {
    ...input,
    timestamp: input.timestamp || new Date().toISOString(),
  };
}


type CaptionEventCoerceDefaults = {
  roomId: string;
  encounterId?: string | null;
  appointmentId?: string | null;
  speakerRole?: CaptionSpeakerRole;
  speakerIdentity?: string | null;
  speakerName?: string;
  speakerDisplay?: string;
  language?: string | null;
  source?: CaptionSource;
};

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Accepts the production caption-worker event shape and the older browser
 * caption shape { type: "caption", text, final, from, ts }.
 */
export function coerceCaptionEvent(
  value: unknown,
  defaults: CaptionEventCoerceDefaults,
): CaptionEvent | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;

  if (isCaptionEvent(v)) {
    return {
      ...v,
      roomId: v.roomId || defaults.roomId,
      encounterId: v.encounterId ?? defaults.encounterId ?? null,
      appointmentId: v.appointmentId ?? defaults.appointmentId ?? null,
    };
  }

  const legacyType = v.type === "caption";
  const text = stringOrNull(v.text);
  if (!legacyType || !text) return null;

  const from = stringOrNull(v.from);
  const inferredRole: CaptionSpeakerRole =
    from === "patient" || from === "clinician" || from === "guest" || from === "system"
      ? from
      : defaults.speakerRole || "guest";

  const speakerDisplay =
    stringOrNull(v.speakerDisplay) ||
    stringOrNull(v.speakerName) ||
    defaults.speakerDisplay ||
    defaults.speakerName ||
    (inferredRole === "clinician" ? "Clinician" : inferredRole === "patient" ? "Patient" : "Speaker");

  const timestamp =
    stringOrNull(v.timestamp) ||
    stringOrNull(v.ts) ||
    new Date().toISOString();

  const final = typeof v.final === "boolean" ? v.final : true;

  return {
    type: final ? "caption.final" : "caption.partial",
    roomId: defaults.roomId,
    encounterId: defaults.encounterId ?? null,
    appointmentId: defaults.appointmentId ?? null,
    speakerRole: inferredRole,
    speakerIdentity: stringOrNull(v.speakerIdentity) || from || defaults.speakerIdentity || null,
    speakerName: stringOrNull(v.speakerName) || speakerDisplay,
    speakerDisplay,
    text,
    final,
    language: stringOrNull(v.language) || defaults.language || null,
    source:
      stringOrNull(v.source) === "aws-transcribe-medical" ||
      stringOrNull(v.source) === "aws-transcribe-standard" ||
      stringOrNull(v.source) === "livekit-agent" ||
      stringOrNull(v.source) === "manual"
        ? (stringOrNull(v.source) as CaptionSource)
        : defaults.source || "unknown",
    confidence: numberOrNull(v.confidence),
    startedAt: stringOrNull(v.startedAt),
    endedAt: stringOrNull(v.endedAt),
    timestamp,
    sequence: numberOrNull(v.sequence) ?? Date.now(),
  };
}
