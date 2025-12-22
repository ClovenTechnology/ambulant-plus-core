//apps/clinician-app/types/claims.ts
export type SendToPayerPayload = {
  encounterId: string;
  roomId?: string;
  timestamp: string;

  patient: {
    id: string;
    name: string;
    dob?: string | null;
    gender?: string | null;
    mrn?: string | null;
    identifiers?: {
      type: 'NATIONAL_ID' | 'PASSPORT' | 'MEDICAL_AID_MEMBER' | string;
      value: string;
      system?: string;
    }[];
  };

  clinician: {
    id: string;
    name: string;
    registrationNumber?: string;
    specialty?: string;
    practiceNumber?: string;
  };

  facility?: {
    id?: string;
    name?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    countryCode?: string; // e.g. "ZA"
  };

  coverage?: {
    payerId: string;
    payerName: string;
    memberNumber: string;
    planCode?: string;
    groupNumber?: string;
  };

  visit: {
    reason: string;
    startTime?: string;
    endTime?: string;
    mode: 'VIRTUAL' | 'IN_PERSON';
    channel?: 'SFU' | 'P2P' | 'PHONE' | string;
    status: 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
  };

  diagnoses: {
    icd10Code: string;
    description?: string;
    primary?: boolean;
  }[];

  medications?: {
    name: string;
    dose?: string;
    route?: string;
    frequency?: string;
    duration?: string;
    quantity?: string;
    refills?: number;
  }[];

  labs?: {
    test: string;
    priority?: 'Routine' | 'Urgent' | 'Stat' | string;
    specimen?: string;
    icd10Code?: string;
    instructions?: string;
  }[];

  narrative: {
    synopsis?: string;
    assessment?: string;
    plan?: string;
    patientEducation?: string;
  };

  billing?: {
    currency?: string; // "ZAR"
    totalAmount?: number;
    coPayAmount?: number;
    codes?: {
      system: 'CPT' | 'NHRPL' | string;
      code: string;
      amount?: number;
    }[];
  };

  meta?: Record<string, unknown>;
};
