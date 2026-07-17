export const LEGAL_DOCUMENT_KEYS = {
  PATIENT_TERMS_OF_SERVICE: 'PATIENT_TERMS_OF_SERVICE',
  PATIENT_PRIVACY_NOTICE: 'PATIENT_PRIVACY_NOTICE',
  PATIENT_SIGNUP_DISCLOSURE: 'PATIENT_SIGNUP_DISCLOSURE',
  CLINICIAN_TERMS_OF_SERVICE: 'CLINICIAN_TERMS_OF_SERVICE',
  CLINICIAN_PRIVACY_NOTICE: 'CLINICIAN_PRIVACY_NOTICE',
  CLINICIAN_PROFESSIONAL_INDEMNITY_NOTICE:
    'CLINICIAN_PROFESSIONAL_INDEMNITY_NOTICE',
  CLINICIAN_ONBOARDING_PAYMENT_DISCLOSURE:
    'CLINICIAN_ONBOARDING_PAYMENT_DISCLOSURE',
  PATIENT_TELEVISIT_CONSENT: 'PATIENT_TELEVISIT_CONSENT',
  CLINICIAN_TELEVISIT_NOTICE: 'CLINICIAN_TELEVISIT_NOTICE',
  CAREPORT_PHARMACY_PARTNER_TERMS: 'CAREPORT_PHARMACY_PARTNER_TERMS',
  CAREPORT_RIDER_PARTNER_TERMS: 'CAREPORT_RIDER_PARTNER_TERMS',
  MEDREACH_LAB_PARTNER_TERMS: 'MEDREACH_LAB_PARTNER_TERMS',
  MEDREACH_PHLEBOTOMIST_PARTNER_TERMS:
    'MEDREACH_PHLEBOTOMIST_PARTNER_TERMS',
  PLATFORM_COOKIE_NOTICE: 'PLATFORM_COOKIE_NOTICE',
  PLATFORM_DATA_PROCESSING_NOTICE: 'PLATFORM_DATA_PROCESSING_NOTICE',
} as const;

export type LegalDocumentKey =
  (typeof LEGAL_DOCUMENT_KEYS)[keyof typeof LEGAL_DOCUMENT_KEYS];

export type LegalAcknowledgementMode =
  | 'NONE'
  | 'NOTICE'
  | 'REQUIRED'
  | 'NON_BLOCKING';

export type LegalCatalogEntry = {
  key: LegalDocumentKey;
  title: string;
  category: string;
  audiences: readonly string[];
  applications: readonly string[];
  surfaces: readonly string[];
  acknowledgementMode: LegalAcknowledgementMode;
};

export const LEGAL_DOCUMENT_CATALOG: readonly LegalCatalogEntry[] = [
  {
    key: LEGAL_DOCUMENT_KEYS.PATIENT_TERMS_OF_SERVICE,
    title: 'Patient Terms of Service',
    category: 'terms',
    audiences: ['patient'],
    applications: ['patient-app'],
    surfaces: ['patient-signup', 'patient-settings', 'public-legal'],
    acknowledgementMode: 'REQUIRED',
  },
  {
    key: LEGAL_DOCUMENT_KEYS.PATIENT_PRIVACY_NOTICE,
    title: 'Patient Privacy Notice',
    category: 'privacy',
    audiences: ['patient'],
    applications: ['patient-app'],
    surfaces: ['patient-signup', 'patient-settings', 'public-legal'],
    acknowledgementMode: 'REQUIRED',
  },
  {
    key: LEGAL_DOCUMENT_KEYS.PATIENT_SIGNUP_DISCLOSURE,
    title: 'Patient Signup Disclosure',
    category: 'disclosure',
    audiences: ['patient'],
    applications: ['patient-app'],
    surfaces: ['patient-signup'],
    acknowledgementMode: 'REQUIRED',
  },
  {
    key: LEGAL_DOCUMENT_KEYS.CLINICIAN_TERMS_OF_SERVICE,
    title: 'Clinician Terms of Service',
    category: 'terms',
    audiences: ['clinician'],
    applications: ['clinician-app'],
    surfaces: ['clinician-signup', 'clinician-settings', 'public-legal'],
    acknowledgementMode: 'REQUIRED',
  },
  {
    key: LEGAL_DOCUMENT_KEYS.CLINICIAN_PRIVACY_NOTICE,
    title: 'Clinician Privacy Notice',
    category: 'privacy',
    audiences: ['clinician'],
    applications: ['clinician-app'],
    surfaces: ['clinician-signup', 'clinician-settings', 'public-legal'],
    acknowledgementMode: 'REQUIRED',
  },
  {
    key: LEGAL_DOCUMENT_KEYS.CLINICIAN_PROFESSIONAL_INDEMNITY_NOTICE,
    title: 'Clinician Professional Indemnity Notice',
    category: 'professional-indemnity',
    audiences: ['clinician'],
    applications: ['clinician-app', 'admin-dashboard'],
    surfaces: ['clinician-signup', 'clinician-onboarding'],
    acknowledgementMode: 'NON_BLOCKING',
  },
  {
    key: LEGAL_DOCUMENT_KEYS.CLINICIAN_ONBOARDING_PAYMENT_DISCLOSURE,
    title: 'Clinician Onboarding Payment Disclosure',
    category: 'payment-disclosure',
    audiences: ['clinician'],
    applications: ['clinician-app', 'admin-dashboard'],
    surfaces: [
      'clinician-signup',
      'clinician-onboarding',
      'payment-pathway-selection',
    ],
    acknowledgementMode: 'REQUIRED',
  },
  {
    key: LEGAL_DOCUMENT_KEYS.PATIENT_TELEVISIT_CONSENT,
    title: 'Patient Televisit Informed Consent and Privacy Notice',
    category: 'televisit-consent',
    audiences: ['patient'],
    applications: ['patient-app'],
    surfaces: ['televisit-consent', 'previsit-lobby', 'televisit-admission'],
    acknowledgementMode: 'REQUIRED',
  },
  {
    key: LEGAL_DOCUMENT_KEYS.CLINICIAN_TELEVISIT_NOTICE,
    title: 'Clinician Televisit Notice',
    category: 'televisit-notice',
    audiences: ['clinician'],
    applications: ['clinician-app'],
    surfaces: ['clinician-televisit'],
    acknowledgementMode: 'NOTICE',
  },
  {
    key: LEGAL_DOCUMENT_KEYS.CAREPORT_PHARMACY_PARTNER_TERMS,
    title: 'CarePort Pharmacy Partner Terms',
    category: 'partner-terms',
    audiences: ['pharmacy_partner'],
    applications: ['careport'],
    surfaces: ['pharmacy-application', 'pharmacy-onboarding'],
    acknowledgementMode: 'REQUIRED',
  },
  {
    key: LEGAL_DOCUMENT_KEYS.CAREPORT_RIDER_PARTNER_TERMS,
    title: 'CarePort Rider Partner Terms',
    category: 'partner-terms',
    audiences: ['rider_partner'],
    applications: ['careport'],
    surfaces: ['rider-application', 'rider-onboarding'],
    acknowledgementMode: 'REQUIRED',
  },
  {
    key: LEGAL_DOCUMENT_KEYS.MEDREACH_LAB_PARTNER_TERMS,
    title: 'MedReach Laboratory Partner Terms',
    category: 'partner-terms',
    audiences: ['lab_partner'],
    applications: ['medreach'],
    surfaces: ['lab-application', 'lab-onboarding'],
    acknowledgementMode: 'REQUIRED',
  },
  {
    key: LEGAL_DOCUMENT_KEYS.MEDREACH_PHLEBOTOMIST_PARTNER_TERMS,
    title: 'MedReach Phlebotomist Partner Terms',
    category: 'partner-terms',
    audiences: ['phlebotomist_partner'],
    applications: ['medreach'],
    surfaces: ['phlebotomist-application', 'phlebotomist-onboarding'],
    acknowledgementMode: 'REQUIRED',
  },
  {
    key: LEGAL_DOCUMENT_KEYS.PLATFORM_COOKIE_NOTICE,
    title: 'Platform Cookie Notice',
    category: 'cookie-notice',
    audiences: ['public'],
    applications: [
      'landing',
      'patient-app',
      'clinician-app',
      'careport',
      'medreach',
      'client-app',
    ],
    surfaces: ['public-applications'],
    acknowledgementMode: 'NOTICE',
  },
  {
    key: LEGAL_DOCUMENT_KEYS.PLATFORM_DATA_PROCESSING_NOTICE,
    title: 'Platform Data Processing Notice',
    category: 'data-processing',
    audiences: ['public'],
    applications: [
      'landing',
      'patient-app',
      'clinician-app',
      'careport',
      'medreach',
      'client-app',
    ],
    surfaces: ['public-legal', 'account-creation'],
    acknowledgementMode: 'REQUIRED',
  },
] as const;

export const LEGAL_DOCUMENT_CATALOG_BY_KEY =
  Object.fromEntries(
    LEGAL_DOCUMENT_CATALOG.map((entry) => [
      entry.key,
      entry,
    ]),
  ) as Record<LegalDocumentKey, LegalCatalogEntry>;
