// apps/clinician-app/types/clinicians.ts

export type ClinicianStatus =
  | 'pending'
  | 'active'
  | 'disabled'
  | 'disciplinary'
  | 'archived';

export type ClinicianCore = {
  id: string;
  userId?: string | null;
  displayName?: string | null;
  email?: string | null;
  phone?: string | null;
  specialty?: string | null;
  status?: ClinicianStatus | null;
  createdAt?: string | null;
};

export type ClinicianOnboardingStage =
  | 'applied'
  | 'screened'
  | 'approved'
  | 'rejected'
  | 'training_scheduled'
  | 'training_completed';

export type TrainingSlotMode = 'virtual' | 'in_person';
export type TrainingSlotStatus = 'scheduled' | 'completed' | 'canceled';

export type ClinicianTrainingSlot = {
  id: string;
  clinicianId: string;
  startAt: string;
  endAt: string;
  mode: TrainingSlotMode;
  status: TrainingSlotStatus;
  joinUrl?: string | null;
};

export type ClinicianDispatchStatus =
  | 'pending'
  | 'packed'
  | 'shipped'
  | 'delivered'
  | 'canceled';

export type ClinicianDispatch = {
  id: string;
  clinicianId: string;
  status: ClinicianDispatchStatus;
  courierName?: string | null;
  trackingCode?: string | null;
  trackingUrl?: string | null;
  shippedAt?: string | null;
  deliveredAt?: string | null;
};

export type ClinicianDispatchItem = {
  id: string;
  dispatchId: string;
  kind: 'device' | 'merch' | 'paperwork' | 'other';
  name: string;
  sku?: string | null;
  deviceId?: string | null;
  serialNumber?: string | null;
  quantity: number;
};

export type OnboardingBoardRow = {
  clinicianId: string;
  displayName: string;
  email?: string | null;
  phone?: string | null;
  specialty?: string | null;
  createdAt: string;

  onboarding: {
    id: string;
    stage: ClinicianOnboardingStage;
    notes?: string | null;
  };

  trainingSlot?: ClinicianTrainingSlot | null;
  dispatch?: ClinicianDispatch | null;
};
