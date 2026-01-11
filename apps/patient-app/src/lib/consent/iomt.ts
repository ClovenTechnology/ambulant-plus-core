//apps/patient-app/src/lib/consent/iomt.ts
export type IomtDeviceKey = 'stethoscope' | 'otoscope' | 'nexring' | 'monitor';

export type IomtConsentRecord = {
  ok: boolean;
  device: IomtDeviceKey;
  version: string;
  acceptedAt?: string;
  source?: 'ui';
};

const V_STETH = process.env.NEXT_PUBLIC_IOMT_STETH_CONSENT_VERSION || 'v1';
const V_OTOS = process.env.NEXT_PUBLIC_IOMT_OTOSCOPE_CONSENT_VERSION || 'v1';
const V_RING  = process.env.NEXT_PUBLIC_IOMT_NEXRING_CONSENT_VERSION || 'v1';
const V_MON   = process.env.NEXT_PUBLIC_IOMT_MONITOR_CONSENT_VERSION || 'v1';

export function consentVersion(device: IomtDeviceKey) {
  if (device === 'stethoscope') return V_STETH;
  if (device === 'otoscope') return V_OTOS;
  if (device === 'nexring') return V_RING;
  return V_MON;
}

/**
 * Put PDFs in:
 * /public/policy/iomt-<device>-consent-<version>.pdf
 * e.g. /public/policy/iomt-stethoscope-consent-v1.pdf
 */
export function consentPdfUrl(device: IomtDeviceKey, version = consentVersion(device)) {
  const v = encodeURIComponent(version || 'v1');
  return `/policy/iomt-${device}-consent-${v}.pdf`;
}

export function consentStorageKey(userId: string, device: IomtDeviceKey, version = consentVersion(device)) {
  const uid = encodeURIComponent(userId || 'anon');
  const v = encodeURIComponent(version || 'v1');
  return `iomtConsent:${uid}:${device}:${v}`;
}

export function readIomtConsent(userId: string, device: IomtDeviceKey): IomtConsentRecord {
  try {
    const v = consentVersion(device);
    const k = consentStorageKey(userId, device, v);
    const raw = localStorage.getItem(k);
    if (!raw) return { ok: false, device, version: v };
    const parsed = JSON.parse(raw);
    if (!parsed?.ok) return { ok: false, device, version: v };
    return {
      ok: true,
      device,
      version: v,
      acceptedAt: parsed.acceptedAt || undefined,
      source: 'ui',
    };
  } catch {
    const v = consentVersion(device);
    return { ok: false, device, version: v };
  }
}

export function writeIomtConsent(userId: string, device: IomtDeviceKey, ok: boolean) {
  const v = consentVersion(device);
  const k = consentStorageKey(userId, device, v);
  const payload = ok
    ? { ok: true, acceptedAt: new Date().toISOString() }
    : { ok: false };
  localStorage.setItem(k, JSON.stringify(payload));
}
