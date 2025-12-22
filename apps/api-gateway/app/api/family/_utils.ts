// apps/api-gateway/app/api/family/_utils.ts
import { prisma } from '@/lib/prisma';

export async function ensurePatientProfileForUser(userId: string, fallbackName?: string) {
  let profile = await prisma.patientProfile.findUnique({
    where: { userId },
  });

  if (!profile) {
    profile = await prisma.patientProfile.create({
      data: {
        userId,
        name: fallbackName ?? 'Family member',
      },
    });
  }

  return profile;
}

export function isMinor(dob?: Date | null) {
  if (!dob) return false;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
  return age < 18;
}

// Very lightweight permissions template – you can expand later
export function buildPermissionsTemplate(opts: {
  relationType: string;
  direction: string;
  subjectIsMinor: boolean;
}) {
  const { relationType, subjectIsMinor } = opts;

  // default: can act, can join televisit, but conservative on full notes
  const base = {
    canActForSubject: true,
    canJoinTelevisit: true,
    canBookAppointments: true,
    canViewHighLevelSummary: true,
    modules: {
      encounters: { viewSummary: true, viewFullNotes: false },
      appointments: { view: true, book: true, cancel: true, reschedule: true },
      reminders: { view: true, manage: true },
      meds: { view: true, manage: true },
      labs: { view: true },
      vitals: { view: true },
      reports: { view: true },
      careport: { view: true, manage: false },
      medreach: { view: true, manage: false },
    },
    canViewSensitiveMentalHealth: false,
    canViewSensitiveSexualRepro: false,
    canViewNotesFlaggedPrivate: false,
  };

  if (relationType === 'SELF') {
    return {
      ...base,
      modules: {
        ...base.modules,
        encounters: { viewSummary: true, viewFullNotes: true },
      },
      canViewSensitiveMentalHealth: true,
      canViewSensitiveSexualRepro: true,
    };
  }

  if (relationType === 'SPOUSE' || relationType === 'PARTNER') {
    return {
      ...base,
      modules: {
        ...base.modules,
        encounters: { viewSummary: true, viewFullNotes: true },
      },
      canViewSensitiveMentalHealth: true,
      canViewSensitiveSexualRepro: true,
    };
  }

  if (relationType === 'PARENT' || relationType === 'GUARDIAN') {
    // child / dependant
    return {
      ...base,
      modules: {
        ...base.modules,
        encounters: { viewSummary: true, viewFullNotes: true },
      },
      canViewSensitiveMentalHealth: !subjectIsMinor,
      canViewSensitiveSexualRepro: !subjectIsMinor,
    };
  }

  if (relationType === 'FRIEND' || relationType === 'CARE_ALLY') {
    return {
      ...base,
      canBookAppointments: false,
      modules: {
        ...base.modules,
        encounters: { viewSummary: false, viewFullNotes: false },
        meds: { view: false, manage: false },
        labs: { view: false },
        vitals: { view: false },
        reports: { view: false },
        careport: { view: false, manage: false },
        medreach: { view: false, manage: false },
      },
    };
  }

  return base;
}
