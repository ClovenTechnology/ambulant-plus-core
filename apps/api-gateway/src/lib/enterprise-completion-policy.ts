export const STAFF_ONBOARDING_ELIGIBLE_APPLICATION_STATUSES = ['SUCCESSFUL', 'OFFERED'] as const;

export function canStartCanonicalStaffOnboarding(status: string) {
  return (STAFF_ONBOARDING_ELIGIBLE_APPLICATION_STATUSES as readonly string[]).includes(status);
}

export function canonicalDirectConversationKey(a: string, b: string) {
  const values = [String(a || '').trim(), String(b || '').trim()].filter(Boolean).sort();
  if (values.length !== 2 || values[0] === values[1]) return null;
  return `${values[0]}:${values[1]}`;
}

export function normalizeStaffMessageBody(value: unknown, max = 8000) {
  if (typeof value !== 'string') return null;
  const body = value.trim();
  if (!body || body.length > max) return null;
  return body;
}

export function validConversationShape(input: {
  kind: string;
  otherProfileIds: string[];
  title?: string | null;
}) {
  if (input.kind === 'DIRECT') return input.otherProfileIds.length === 1;
  if (input.kind === 'GROUP') return input.otherProfileIds.length >= 1 && Boolean(input.title?.trim());
  return false;
}

export function validDirectCallMode(value: unknown): 'audio' | 'video' | null {
  return value === 'audio' || value === 'video' ? value : null;
}
