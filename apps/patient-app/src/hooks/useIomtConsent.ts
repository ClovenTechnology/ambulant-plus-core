//apps/patient-app/src/hooks/useIomtConsent.ts
'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import type { IomtDeviceKey, IomtConsentRecord } from '@/src/lib/consent/iomt';
import { consentPdfUrl, readIomtConsent, writeIomtConsent } from '@/src/lib/consent/iomt';
import { useAuthMe } from '@/src/hooks/useAuthMe';

export function useIomtConsent(device: IomtDeviceKey) {
  const { user } = useAuthMe();
  const userId = user?.id || 'anon';

  const [rec, setRec] = useState<IomtConsentRecord>(() => {
    if (typeof window === 'undefined') return { ok: false, device, version: 'v1' } as any;
    return readIomtConsent(userId, device);
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setRec(readIomtConsent(userId, device));
  }, [userId, device]);

  const accept = useCallback(() => {
    writeIomtConsent(userId, device, true);
    setRec(readIomtConsent(userId, device));
  }, [userId, device]);

  const revokeLocal = useCallback(() => {
    writeIomtConsent(userId, device, false);
    setRec(readIomtConsent(userId, device));
  }, [userId, device]);

  return useMemo(() => {
    const pdfUrl = consentPdfUrl(device);
    return {
      userId,
      accepted: !!rec.ok,
      acceptedAt: rec.acceptedAt || null,
      version: rec.version,
      pdfUrl,
      accept,
      revokeLocal,
    };
  }, [userId, rec, device, accept, revokeLocal]);
}
