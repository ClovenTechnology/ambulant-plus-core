// apps/clinician-app/app/dental-workspace/_lib/helpers.ts
import type { DentalEvidence } from './types';

export function nowISO() {
  return new Date().toISOString();
}

export function errMsg(e: any) {
  return e?.message || e?.details?.message || e?.error || 'Request failed';
}

export function safeLower(v?: string | null) {
  return String(v || '').toLowerCase();
}

export function looksLikeXray(ev: DentalEvidence) {
  const m = ev?.meta || {};
  const ct = safeLower(ev.contentType);
  const url = safeLower(ev.url);
  const tag = safeLower(m?.modality || m?.type || '');
  return (
    tag.includes('xray') ||
    tag.includes('x-ray') ||
    tag.includes('radiograph') ||
    ct.includes('dicom') ||
    url.includes('dicom') ||
    url.includes('xray') ||
    url.includes('x-ray')
  );
}

export function extFromUrl(url: string) {
  const u = safeLower(url);
  const q = u.split('?')[0].split('#')[0];
  const m = q.match(/\.([a-z0-9]+)$/i);
  return m ? m[1] : '';
}

export function guessContentTypeFromExt(ext: string) {
  if (ext === 'glb') return 'model/gltf-binary';
  if (ext === 'gltf') return 'model/gltf+json';
  if (ext === 'obj') return 'text/plain';
  if (ext === 'stl') return 'model/stl';
  if (ext === 'png') return 'image/png';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'mp4') return 'video/mp4';
  return undefined;
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error('Failed to read file'));
    r.onload = () => resolve(String(r.result || ''));
    r.readAsDataURL(file);
  });
}

/** Small helper for “latest value in RAF loop” patterns */
export function useLatestRef<T>(value: T) {
  // NOTE: placed here for shared import simplicity;
  // we only use it inside client components.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const React = require('react') as typeof import('react');
  const ref = React.useRef<T>(value);
  ref.current = value;
  return ref as React.MutableRefObject<T>;
}
