// apps/patient-app/app/manifest.ts
import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Ambulant+ Patient',
    short_name: 'Ambulant Plus',
    start_url: '/',
    display: 'standalone',
    background_color: '#0B0F19',
    theme_color: '#0EA5E9',
    icons: [
      // Prefer SVG for modern browsers
      { src: '/icon-192.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any maskable' },
      { src: '/icon-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any maskable' },
      // PNG fallbacks for older UA / whatever was previously referenced
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
      { src: '/favicon.svg', sizes: '48x48', type: 'image/svg+xml', purpose: 'any' },
    ],
  };
}
