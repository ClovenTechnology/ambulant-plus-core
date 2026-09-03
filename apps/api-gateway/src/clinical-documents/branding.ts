import { prisma } from '@/src/lib/prisma';

export const CLINICAL_DOCUMENT_BRANDING_KEY = 'clinical_documents.branding';
export const CLINICAL_DOCUMENT_BRANDING_VERSION = 'clinical-document-branding-v1';

export type ClinicalDocumentBranding = {
  version: string;
  organizationName: string;
  serviceLine: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  verificationUrl: string;
  accentColor: string;
  prescriptionFooter: string;
  labFooter: string;
  certificateFooter: string;
  updatedAt?: string | null;
};

export const DEFAULT_CLINICAL_DOCUMENT_BRANDING: ClinicalDocumentBranding = {
  version: CLINICAL_DOCUMENT_BRANDING_VERSION,
  organizationName: 'Ambulant+',
  serviceLine: 'Contactless Medicine',
  address: '0B Meadowbrook Lane, Epsom Downs, Bryanston 2152, South Africa',
  phone: '069 669 0899',
  email: 'support@ambulantplus.co.za',
  website: 'ambulantplus.co.za',
  verificationUrl: 'ambulantplus.co.za',
  accentColor: '#0AA7A8',
  prescriptionFooter:
    'This prescription was issued via Ambulant+ Contactless Medicine. It may be presented at participating CarePort pharmacies or any other pharmacy in South Africa, subject to applicable dispensing requirements. Report concerns: hpcsa.co.za',
  labFooter:
    'This laboratory requisition was issued via Ambulant+ Contactless Medicine. Laboratory acceptance, specimen requirements and test processing remain subject to the receiving laboratory requirements.',
  certificateFooter:
    'This clinical certificate was issued via Ambulant+ Contactless Medicine. Verification should be made against the original Ambulant+ clinical record where required.',
  updatedAt: null,
};

function clean(value: unknown, fallback: string, max: number) {
  const text = String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, max);
  return text || fallback;
}

function safeHexColor(value: unknown, fallback = DEFAULT_CLINICAL_DOCUMENT_BRANDING.accentColor) {
  const raw = String(value ?? '').trim();
  return /^#[0-9a-fA-F]{6}$/.test(raw) ? raw.toUpperCase() : fallback;
}

function asObject(value: unknown): Record<string, any> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, any>;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

export function normalizeClinicalDocumentBranding(value: unknown): ClinicalDocumentBranding {
  const raw = asObject(value);
  return {
    version: CLINICAL_DOCUMENT_BRANDING_VERSION,
    organizationName: clean(raw.organizationName, DEFAULT_CLINICAL_DOCUMENT_BRANDING.organizationName, 120),
    serviceLine: clean(raw.serviceLine, DEFAULT_CLINICAL_DOCUMENT_BRANDING.serviceLine, 120),
    address: clean(raw.address, DEFAULT_CLINICAL_DOCUMENT_BRANDING.address, 300),
    phone: clean(raw.phone, DEFAULT_CLINICAL_DOCUMENT_BRANDING.phone, 80),
    email: clean(raw.email, DEFAULT_CLINICAL_DOCUMENT_BRANDING.email, 180),
    website: clean(raw.website, DEFAULT_CLINICAL_DOCUMENT_BRANDING.website, 180),
    verificationUrl: clean(raw.verificationUrl, DEFAULT_CLINICAL_DOCUMENT_BRANDING.verificationUrl, 260),
    accentColor: safeHexColor(raw.accentColor),
    prescriptionFooter: clean(raw.prescriptionFooter, DEFAULT_CLINICAL_DOCUMENT_BRANDING.prescriptionFooter, 900),
    labFooter: clean(raw.labFooter, DEFAULT_CLINICAL_DOCUMENT_BRANDING.labFooter, 900),
    certificateFooter: clean(raw.certificateFooter, DEFAULT_CLINICAL_DOCUMENT_BRANDING.certificateFooter, 900),
    updatedAt: raw.updatedAt ? clean(raw.updatedAt, '', 80) || null : null,
  };
}

export async function getClinicalDocumentBranding(): Promise<ClinicalDocumentBranding> {
  try {
    const row = await (prisma as any).platformSetting?.findUnique?.({
      where: { key: CLINICAL_DOCUMENT_BRANDING_KEY },
    });
    if (!row) return { ...DEFAULT_CLINICAL_DOCUMENT_BRANDING };
    return normalizeClinicalDocumentBranding({
      ...asObject(row.value),
      updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt,
    });
  } catch {
    return { ...DEFAULT_CLINICAL_DOCUMENT_BRANDING };
  }
}

export function clinicalDocumentBrandingSnapshot(value: unknown) {
  const normalized = normalizeClinicalDocumentBranding(value);
  return {
    ...normalized,
    snapshotAt: new Date().toISOString(),
  };
}
