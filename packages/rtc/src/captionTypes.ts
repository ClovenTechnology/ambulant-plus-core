// packages/ambulant-rtc/src/captionTypes.ts

export const RTC_TOPIC_CAPTIONS = "captions" as const;
export const RTC_TOPIC_TRANSCRIPT = "transcript" as const;

export type RtcParticipantRole =
  | "clinician"
  | "patient"
  | "parent"
  | "guardian"
  | "caregiver"
  | "carer"
  | "partner"
  | "interpreter"
  | "guest"
  | "observer"
  | "caption-worker"
  | "system";

export type CaptionSpeakerRole = RtcParticipantRole;

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

export type RtcChatMessage = {
  id?: string;
  type?: "message" | "typing" | string;
  from?: string;
  text?: string;
  ts?: number;
  timestamp?: string;

  senderRole?: RtcParticipantRole | string | null;
  senderIdentity?: string | null;
  senderDisplay?: string | null;
  senderName?: string | null;
  relationshipToPatient?: string | null;
  participantRole?: RtcParticipantRole | string | null;

  roomId?: string | null;
  encounterId?: string | null;
  appointmentId?: string | null;
  visitId?: string | null;
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

export function normalizeRtcParticipantRole(value: unknown): RtcParticipantRole {
  const raw = String(value ?? "").trim().toLowerCase().replace(/_/g, "-");
  if (!raw) return "guest";

  if (["clinician", "doctor", "dr", "lead-clinician", "co-clinician", "advisor", "nurse", "therapist"].includes(raw)) {
    return "clinician";
  }
  if (["patient", "lead-patient", "dependent-patient", "second-patient-participant"].includes(raw)) {
    return "patient";
  }
  if (["parent", "mother", "father", "mum", "mom", "dad"].includes(raw)) {
    return "parent";
  }
  if (["guardian", "legal-guardian"].includes(raw)) {
    return "guardian";
  }
  if (["caregiver", "carer", "care-ally", "care-giver"].includes(raw)) {
    return "caregiver";
  }
  if (["partner", "spouse", "wife", "husband", "couple"].includes(raw)) {
    return "partner";
  }
  if (["interpreter", "translator"].includes(raw)) {
    return "interpreter";
  }
  if (["observer"].includes(raw)) {
    return "observer";
  }
  if (["caption-worker", "caption", "transcriber"].includes(raw)) {
    return "caption-worker";
  }
  if (["system", "service"].includes(raw)) {
    return "system";
  }

  if (raw.includes("clinician") || raw.startsWith("dr-") || raw.startsWith("doctor")) return "clinician";
  if (raw.includes("patient") || raw.startsWith("pt-")) return "patient";
  if (raw.includes("interpreter") || raw.includes("translator")) return "interpreter";
  if (raw.includes("guardian")) return "guardian";
  if (raw.includes("caregiver") || raw.includes("carer") || raw.includes("care-ally")) return "caregiver";
  if (raw.includes("mother") || raw.includes("father") || raw.includes("parent")) return "parent";
  if (raw.includes("partner") || raw.includes("spouse") || raw.includes("wife") || raw.includes("husband")) return "partner";

  return "guest";
}

export function rtcParticipantRoleLabel(role: unknown): string {
  switch (normalizeRtcParticipantRole(role)) {
    case "clinician":
      return "Clinician";
    case "patient":
      return "Patient";
    case "parent":
      return "Parent";
    case "guardian":
      return "Guardian";
    case "caregiver":
    case "carer":
      return "Caregiver";
    case "partner":
      return "Partner";
    case "interpreter":
      return "Interpreter";
    case "observer":
      return "Observer";
    case "caption-worker":
      return "Caption worker";
    case "system":
      return "System";
    default:
      return "Guest";
  }
}

export function formatRtcParticipantLabel(input: {
  role?: unknown;
  displayName?: string | null;
  senderDisplay?: string | null;
  senderName?: string | null;
  identity?: string | null;
  self?: boolean;
}): string {
  const role = normalizeRtcParticipantRole(input.role);
  const explicit =
    (typeof input.senderDisplay === "string" && input.senderDisplay.trim()) ||
    (typeof input.senderName === "string" && input.senderName.trim()) ||
    (typeof input.displayName === "string" && input.displayName.trim()) ||
    "";

  if (input.self) {
    if (role === "patient") return "You";
    return explicit ? `You (${rtcParticipantRoleLabel(role)} - ${explicit})` : `You (${rtcParticipantRoleLabel(role)})`;
  }

  if (role === "clinician") {
    if (!explicit) return "Clinician";
    return explicit.toLowerCase().startsWith("dr") || explicit.toLowerCase().startsWith("nurse")
      ? explicit
      : `Dr ${explicit}`;
  }

  if (role === "system") return "System";

  const base = rtcParticipantRoleLabel(role);
  return explicit ? `${base} - ${explicit}` : base;
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
  const inferredRole: CaptionSpeakerRole = normalizeRtcParticipantRole(
    from || defaults.speakerRole || "guest",
  );

  const speakerDisplay =
    stringOrNull(v.speakerDisplay) ||
    stringOrNull(v.speakerName) ||
    defaults.speakerDisplay ||
    defaults.speakerName ||
    formatRtcParticipantLabel({ role: inferredRole });

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
