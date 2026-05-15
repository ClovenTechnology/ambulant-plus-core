// apps/clinician-app/app/workspaces/dental/_lib/toothMap.ts

import type { ToothSystem } from './types';

const UNIVERSAL_TO_FDI: Record<string, string> = {
  '1': '18',
  '2': '17',
  '3': '16',
  '4': '15',
  '5': '14',
  '6': '13',
  '7': '12',
  '8': '11',
  '9': '21',
  '10': '22',
  '11': '23',
  '12': '24',
  '13': '25',
  '14': '26',
  '15': '27',
  '16': '28',

  '17': '38',
  '18': '37',
  '19': '36',
  '20': '35',
  '21': '34',
  '22': '33',
  '23': '32',
  '24': '31',
  '25': '41',
  '26': '42',
  '27': '43',
  '28': '44',
  '29': '45',
  '30': '46',
  '31': '47',
  '32': '48',
};

const FDI_TO_UNIVERSAL: Record<string, string> = Object.fromEntries(
  Object.entries(UNIVERSAL_TO_FDI).map(([universal, fdi]) => [fdi, universal])
);

export function universalToFdi(universalToothId?: string | number | null) {
  if (universalToothId == null) return null;

  const key = String(universalToothId).trim();

  return UNIVERSAL_TO_FDI[key] ?? null;
}

export function fdiToUniversal(fdiToothId?: string | number | null) {
  if (fdiToothId == null) return null;

  const key = String(fdiToothId).trim();

  return FDI_TO_UNIVERSAL[key] ?? null;
}

export function toDisplayToothId(
  universalToothId: string,
  toothSystem: ToothSystem
) {
  if (toothSystem === 'FDI') {
    return universalToFdi(universalToothId) ?? universalToothId;
  }

  return universalToothId;
}

export function toothNodeName(toothId: string | number) {
  return `tooth_${String(toothId).trim()}`;
}

export function meshNameToToothId(name?: string | null):
  | {
      scheme: 'FDI' | 'universal';
      toothId: string;
    }
  | null {
  if (!name) return null;

  const raw = String(name).trim();

  const match = raw.match(/(?:^|[_\-\s])tooth[_\-\s]?(\d{1,2})(?:$|[_\-\s])/i) ||
    raw.match(/^tooth[_\-\s]?(\d{1,2})$/i) ||
    raw.match(/^(\d{1,2})$/);

  if (!match) return null;

  const toothId = match[1];

  if (FDI_TO_UNIVERSAL[toothId]) {
    return {
      scheme: 'FDI',
      toothId,
    };
  }

  if (UNIVERSAL_TO_FDI[toothId]) {
    return {
      scheme: 'universal',
      toothId,
    };
  }

  return null;
}