// apps/clinician-app/app/dental-workspace/_lib/toothMap.ts
/* ---------- Universal <-> FDI mapping (adult dentition) ---------- */
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
  Object.entries(UNIVERSAL_TO_FDI).map(([u, f]) => [f, u]),
);

export function universalToFdi(universal: string) {
  return UNIVERSAL_TO_FDI[String(universal)] ?? null;
}

export function fdiToUniversal(fdi: string) {
  return FDI_TO_UNIVERSAL[String(fdi)] ?? null;
}

export function toothNodeName(toothId: string) {
  return `tooth_${String(toothId)}`;
}

export function meshNameToToothId(
  name: string,
): { scheme: 'FDI' | 'universal'; toothId: string } | null {
  const n = String(name || '');
  const m = n.match(/tooth[_-]?(\d{1,2})$/i) || n.match(/tooth[_-]?(\d{1,2})\b/i);
  if (!m) return null;
  const id = m[1];
  const num = Number(id);
  if (num >= 11 && num <= 48) return { scheme: 'FDI', toothId: id };
  return { scheme: 'universal', toothId: id };
}

/** Option A: internal universal; toothSystem is display-only */
export function toDisplayToothId(universalToothId: string, displaySystem: 'universal' | 'FDI') {
  if (displaySystem === 'universal') return String(universalToothId);
  return universalToFdi(String(universalToothId)) ?? String(universalToothId);
}
