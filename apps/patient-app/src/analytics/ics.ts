// ============================================================================
// apps/patient-app/src/analytics/ics.ts
// Extend appointment ICS builder to include address + GEO
// ============================================================================
import type { FertilityPrefs } from './prediction';
import type { AntenatalPrefs } from './antenatal';

export function buildFertilityICSUrlFromPrefs(prefs: FertilityPrefs | null, origin: string): string | null {
  if (!prefs?.lmp || !prefs?.cycleDays) return null;
  const base = origin.replace(/\/$/, '');
  const params = new URLSearchParams({ lmp: prefs.lmp, cycleDays: String(prefs.cycleDays) });
  return `${base}/api/ics/fertility?${params.toString()}`;
}

export function buildAntenatalICSUrlFromPrefs(
  prefs: AntenatalPrefs | null,
  origin: string,
  opts?: { location?: string; telehealth?: string; address?: string; geo?: { lat: number; lon: number } }
): string | null {
  if (!prefs?.edd) return null;
  const base = origin.replace(/\/$/, '');
  const params = new URLSearchParams({ edd: prefs.edd });

  // location: prefer explicit opts.location, otherwise fall back to prefs.address (single-line) or default
  if (opts?.location) {
    params.set('location', opts.location);
  } else if (prefs.address) {
    // Use first line or full address as the calendar LOCATION; caller may prefer opts.address for more control
    params.set('location', prefs.address.split('\n')[0] || prefs.address);
  }

  // telehealth: prefer opts.telehealth if provided, otherwise prefer prefs.telehealth
  const tele = opts?.telehealth ?? prefs.telehealth;
  if (tele) params.set('telehealth', tele);

  // address: a dedicated full clinic address (multi-line). opts overrides prefs.
  const addr = opts?.address ?? prefs.address;
  if (addr) params.set('addr', addr);

  // geo: opts.geo overrides prefs.geo, and we include both lat & lon query params if present
  const geo = opts?.geo ?? prefs.geo;
  if (geo && typeof geo.lat === 'number' && typeof geo.lon === 'number') {
    params.set('geoLat', String(geo.lat));
    params.set('geoLon', String(geo.lon));
  }

  return `${base}/api/ics/antenatal?${params.toString()}`;
}

export function buildKickICSUrl(origin: string, timeHHMM = '20:00'): string {
  const base = origin.replace(/\/$/, '');
  const params = new URLSearchParams({ time: timeHHMM });
  return `${base}/api/ics/kick?${params.toString()}`;
}

export function buildLabICSUrl(origin: string, edd: string, code: string, when: 'start' | 'due' | 'end' = 'due', overdue = false): string {
  const base = origin.replace(/\/$/, '');
  const params = new URLSearchParams({ edd, code, when, overdue: overdue ? '1' : '0' });
  return `${base}/api/ics/antenatal-lab?${params.toString()}`;
}
