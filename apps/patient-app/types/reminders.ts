// apps/patient-app/types.ts
// Shared types for patient-app (reminders, pills, API payloads)

export type ReminderStatus = 'Pending' | 'Taken' | 'Missed';

export interface Reminder {
  id: string;
  name: string;
  dose?: string;
  time?: string;
  status: ReminderStatus;
  snoozedUntil?: string | null;
  source?: 'manual' | 'erx' | 'import';
  createdAt: string;
}

/**
 * POST /api/reminders/confirm body for confirm / snooze actions.
 * Accepts either single id or array ids for batch operations.
 */
export interface ConfirmRequestBody {
  action: 'confirm' | 'snooze';
  id?: string;
  ids?: string[];
  snoozeMinutes?: number;
}

/**
 * Per-id result returned by confirm/snooze operations.
 */
export interface ConfirmResult {
  ok: boolean;
  reminder?: Reminder | null;
  error?: string;
}

/**
 * Response shape for POST /api/reminders/confirm
 * - `results` maps reminder id -> ConfirmResult
 * - `medPatches` is best-effort info from attempts to mirror to /api/medications
 */
export interface ConfirmResponse {
  ok: boolean;
  results?: Record<string, ConfirmResult>;
  medPatches?: Record<string, any>;
  error?: string;
}

/**
 * PUT /api/reminders/confirm request item used to create or upsert reminders.
 */
export interface PutRemindersBodyItem {
  id?: string;
  name: string;
  dose?: string;
  time?: string;
  status?: ReminderStatus;
  snoozedUntil?: string | null;
  source?: 'manual' | 'erx' | 'import';
}

/**
 * PUT body may be a single item or an array of items.
 */
export type PutRemindersBody = PutRemindersBodyItem | PutRemindersBodyItem[];

/**
 * Response for PUT endpoint
 */
export interface PutRemindersResponse {
  ok: boolean;
  created?: Reminder[];           // items created/updated
  remindersCount?: number;
  error?: string;
}

/**
 * DELETE request body or query variations:
 * - { id } or { ids: [] }
 */
export interface DeleteRemindersBody {
  id?: string;
  ids?: string[];
}

/**
 * DELETE response shape
 */
export interface DeleteRemindersResponse {
  ok: boolean;
  removed?: string[];   // ids removed
  notFound?: string[];  // ids not found
  remindersCount?: number;
  error?: string;
}

/**
 * Lightweight analytics payload (used by client)
 */
export interface AnalyticsEvent {
  event: string;
  props?: Record<string, any>;
  ts?: number;
  path?: string;
  ua?: string;
  ref?: string;
}

/* Optional: Pill shape used in client components (keeps compatibility) */
export interface Pill {
  id: string;
  name: string;
  dose?: string;
  time?: string;
  status: 'Pending' | 'Taken' | 'Missed';
  // optional extra fields that may be present from eRx
  frequency?: string;
  route?: string;
  started?: string;
  lastFilled?: string;
}
