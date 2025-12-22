// apps/patient-app/lib/mapConfig.ts

// Read from NEXT_PUBLIC_ so it’s available in client components
export const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY || '';

/**
 * Primary basemap URL.
 * If no key is configured, we gracefully fall back to plain OpenStreetMap
 * so local dev still works.
 *
 * MapTiler docs reference (streets-v2, 256px raster tiles):
 * https://api.maptiler.com/maps/streets-v2/256/{z}/{x}/{y}.png?key=${key}
 */
export const MAP_TILE_URL = MAPTILER_KEY
  ? `https://api.maptiler.com/maps/streets-v2/256/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`
  : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

/**
 * Attribution matching MapTiler guidance, with OSM fallback.
 * MapTiler example attribution: © MapTiler © OpenStreetMap contributors
 */
export const MAP_TILE_ATTRIBUTION = MAPTILER_KEY
  ? '<a href="https://www.maptiler.com/copyright/" target="_blank">&copy; MapTiler</a> ' +
    '<a href="https://www.openstreetmap.org/copyright" target="_blank">&copy; OpenStreetMap contributors</a>'
  : '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors';

/**
 * Optional shared map defaults – tweak as needed
 */
export const MAP_DEFAULTS = {
  minZoom: 1,
  maxZoom: 19,
};
