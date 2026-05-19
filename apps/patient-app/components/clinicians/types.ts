// apps/patient-app/components/clinicians/types.ts

/**
 * Production clinician discovery types.
 *
 * Do not import anything from "@/mock/*" here.
 * Patients must only see clinicians returned by real API-backed discovery
 * routes: live, available, onboarded, and operationally enabled clinicians.
 */

export type CountryCode =
  | 'ZA'
  | 'NG'
  | 'GB'
  | 'US'
  | 'CA'
  | 'GH'
  | 'KE'
  | 'BW'
  | 'NA'
  | 'ZW'
  | 'ZM'
  | 'MW'
  | 'LS'
  | 'SZ'
  | 'OTHER';

export type ClinicianClass = 'Doctor' | 'Allied Health' | 'Wellness';

export type ClinicianStatus =
  | 'active'
  | 'pending'
  | 'disabled'
  | 'disciplinary'
  | 'suspended'
  | 'archived'
  | string;

export type ClinicianItem = {
  id: string;
  name: string;
  specialty: string;
  location: string;

  cls?: ClinicianClass;
  gender?: string;

  priceZAR?: number;
  priceCents?: number;
  currency?: string;

  rating?: number;
  ratingCount?: number;

  /**
   * True only when the real clinician presence/availability service marks
   * the clinician as currently online. This must not be synthetically derived.
   */
  online?: boolean;

  /**
   * Clinicians should be shown to patients only when the discovery API has
   * already filtered for onboarded + active + available clinicians.
   */
  status?: ClinicianStatus;

  lastBookedAt?: number | null;
  lastSeenAt?: number | null;
  onlineSeq?: number | null;
  recentBookedCount?: number;

  acceptsMedicalAid?: boolean;
  acceptedSchemes?: string[];

  practiceName?: string;
  country?: CountryCode;

  speaks?: string[];
  yearsExp?: number;
  joinedAt?: number | null;

  nextAvailableAt?: number | null;
  consultMins?: number | null;
  followupMins?: number | null;
  responseTimeMins?: number | null;
};

export type CompareMeta = {
  nextAvailableAt: number | null;
  consultMins: number | null;
  followupMins: number | null;
  responseTimeMins: number | null;

  /**
   * Must remain false in production patient discovery flows.
   * Kept only because some comparison UI may still expect the field.
   */
  isSynthetic: false;

  /**
   * True when comparison metadata came from a real API/source.
   */
  hasReal: boolean;
};