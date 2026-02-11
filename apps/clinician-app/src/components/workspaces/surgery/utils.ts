// File: apps/clinician-app/src/components/workspaces/surgery/utils.ts

import type { Location } from '@/src/lib/workspaces/types';
import type { SurgeryDomainKey, SurgeryPriority } from './constants';

export function nowISO() {
  return new Date().toISOString();
}

export function tmpId(prefix = 'tmp') {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`;
}

export function safeJsonParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  try {
    return JSON.stringify(e);
  } catch {
    return 'Unknown error';
  }
}

export function persistKey(encounterId: string) {
  return `ambulant.surgery.workspace.${encounterId}`;
}

export function locationForSurgery(params: {
  domain: SurgeryDomainKey;
  priority: SurgeryPriority;
}): Location {
  return {
    kind: 'surgery',
    domain: params.domain,
    priority: params.priority,
  } as unknown as Location;
}

export function pctChecklist(obj: Record<string, boolean>) {
  const values = Object.values(obj);
  if (!values.length) return 0;
  const done = values.filter(Boolean).length;
  return Math.round((done / values.length) * 100);
}
