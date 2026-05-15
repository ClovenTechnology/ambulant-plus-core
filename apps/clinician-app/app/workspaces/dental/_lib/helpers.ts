// apps/clinician-app/app/workspaces/dental/_lib/helpers.ts

import { useEffect, useRef } from 'react';
import type { DentalEvidence } from './types';

export function useLatestRef<T>(value: T) {
  const ref = useRef(value);

  useEffect(() => {
    ref.current = value;
  }, [value]);

  return ref;
}

export function extFromUrl(value?: string | null) {
  if (!value) return '';

  try {
    const url = new URL(value, 'http://local');
    const pathname = url.pathname || '';
    const last = pathname.split('/').pop() || '';
    const ext = last.includes('.') ? last.split('.').pop() || '' : '';

    return ext.toLowerCase();
  } catch {
    const clean = String(value).split('?')[0].split('#')[0];
    const last = clean.split('/').pop() || '';
    const ext = last.includes('.') ? last.split('.').pop() || '' : '';

    return ext.toLowerCase();
  }
}

export function looksLikeXray(evidence: DentalEvidence) {
  const modality = evidence.meta?.modality;
  const contentType = evidence.contentType || '';
  const url = evidence.url || '';

  if (modality === 'xray') return true;

  const lowerUrl = url.toLowerCase();

  return (
    lowerUrl.includes('xray') ||
    lowerUrl.includes('x-ray') ||
    lowerUrl.includes('radiograph') ||
    lowerUrl.includes('opg') ||
    lowerUrl.includes('panoramic') ||
    lowerUrl.includes('cbct') ||
    contentType.includes('dicom')
  );
}