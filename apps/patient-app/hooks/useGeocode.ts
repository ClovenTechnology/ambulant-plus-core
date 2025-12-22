// apps/patient-app/hooks/useGeocode.ts
import { useCallback } from 'react';

export function useGeocode() {
  // leverage your reverseGeocode function already in page; move it here
  const reverse = useCallback(async (lat:number, lng:number) => {
    // minimal wrapper: try server proxy first
    try {
      const res = await fetch(`/api/geocode?lat=${lat}&lng=${lng}`);
      if (res.ok) {
        const json = await res.json();
        if (json?.display_name) return json.display_name as string;
      }
    } catch {}
    // fallback to direct client (your existing reverseGeocode)
    // eslint-disable-next-line no-undef
    // @ts-ignore
    return window.__reverseGeocode ? window.__reverseGeocode(lat, lng) : `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }, []);
  return { reverse };
}
