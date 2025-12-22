// apps/medreach/lib/matching.ts

export type GeoPoint = {
  lat: number;
  lng: number;
};

export type LabOrderForMatching = {
  id: string;
  labId?: string;
  patientLocation: GeoPoint;
  patientArea?: string; // e.g. "Randburg", "Umhlanga"
};

export type PhlebForMatching = {
  id: string;
  fullName: string;
  active: boolean;
  homeBase?: GeoPoint;
  serviceRadiusKm?: number; // if undefined, treat as "no limit"
  serviceAreas?: string[];
  preferredLabs?: string[];
};

export type RankedPhleb = {
  phleb: PhlebForMatching;
  score: number;
  distanceKm: number;
};

// Haversine distance in km
export function distanceKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);

  const h =
    sinDLat * sinDLat +
    Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;

  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return R * c;
}

// Core scoring: distance + lab preference + area match
export function scorePhlebForOrder(
  order: LabOrderForMatching,
  phleb: PhlebForMatching,
): { score: number; distanceKm: number } | null {
  if (!phleb.active) return null;
  if (!phleb.homeBase) return null;

  const dKm = distanceKm(order.patientLocation, phleb.homeBase);

  if (typeof phleb.serviceRadiusKm === 'number' && dKm > phleb.serviceRadiusKm) {
    return null;
  }

  let score = -dKm; // closer is better

  if (order.labId && phleb.preferredLabs?.includes(order.labId)) {
    score += 10;
  }

  if (
    order.patientArea &&
    phleb.serviceAreas?.some(
      (area) => area.toLowerCase() === order.patientArea!.toLowerCase(),
    )
  ) {
    score += 5;
  }

  return { score, distanceKm: dKm };
}

export function rankPhlebsForOrder(
  order: LabOrderForMatching,
  phlebs: PhlebForMatching[],
  limit = 10,
): RankedPhleb[] {
  const ranked: RankedPhleb[] = [];

  for (const phleb of phlebs) {
    const result = scorePhlebForOrder(order, phleb);
    if (!result) continue;

    ranked.push({
      phleb,
      score: result.score,
      distanceKm: result.distanceKm,
    });
  }

  ranked.sort((a, b) => b.score - a.score);

  if (limit != null && ranked.length > limit) {
    return ranked.slice(0, limit);
  }
  return ranked;
}
