import { prisma } from '@/lib/prisma';

const ALLOWED_ENGAGEMENT_TYPES = new Set([
  'PERMANENT',
  'FIXED_TERM',
  'TEMPORARY',
  'CASUAL',
  'CONTRACTOR',
  'INTERN',
  'COMMISSION_ONLY',
]);

export function normalizeEngagementType(value: unknown) {
  const normalized = String(value || 'PERMANENT')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
  return ALLOWED_ENGAGEMENT_TYPES.has(normalized) ? normalized : 'PERMANENT';
}

export async function ensureWorkforceMemberForPayrollProfile(
  profile: any,
  actorUserId?: string | null,
) {
  const db: any = prisma;

  if (profile.workforceMemberId) {
    const existing = await db.workforceMember.findUnique({
      where: { id: profile.workforceMemberId },
    });
    if (existing) return existing;
  }

  const adminProfile = await db.adminUserProfile.findFirst({
    where: { userId: profile.staffUserId },
    select: {
      id: true,
      userId: true,
      name: true,
      email: true,
      phone: true,
      staffIdentifier: true,
    },
  });

  const engagementType = normalizeEngagementType(profile.employmentType);
  const lookup: any[] = [];
  if (adminProfile?.id) lookup.push({ adminStaffProfileId: adminProfile.id });
  if (adminProfile?.userId) lookup.push({ platformUserId: adminProfile.userId });

  let workforce =
    lookup.length
      ? await db.workforceMember.findFirst({ where: { OR: lookup } })
      : null;

  if (!workforce) {
    workforce = await db.workforceMember.create({
      data: {
        workforceNumber: adminProfile?.staffIdentifier || null,
        displayName:
          adminProfile?.name ||
          profile.staffDisplayName ||
          profile.staffEmail ||
          profile.staffUserId,
        email: adminProfile?.email || profile.staffEmail || null,
        phone: adminProfile?.phone || null,
        engagementType,
        status: profile.endDate ? 'INACTIVE' : 'ACTIVE',
        platformUserId: adminProfile?.userId || null,
        adminStaffProfileId: adminProfile?.id || null,
        country: profile.country || 'ZA',
        currency: profile.currency || 'ZAR',
        startDate: profile.startDate || null,
        endDate: profile.endDate || null,
        meta: {
          source: 'staff_payroll_profile',
          payrollProfileId: profile.id,
          adminLoginRequired: false,
        },
        createdByUserId: actorUserId || null,
        updatedByUserId: actorUserId || null,
      },
    });
  }

  if (profile.workforceMemberId !== workforce.id) {
    await db.staffPayrollProfile.update({
      where: { id: profile.id },
      data: { workforceMemberId: workforce.id },
    });
  }

  return workforce;
}

export async function createStandaloneWorkforcePayrollProfile(input: {
  displayName: string;
  email?: string | null;
  phone?: string | null;
  engagementType?: string | null;
  country?: string | null;
  currency?: string | null;
  startDate?: Date | null;
  endDate?: Date | null;
  baseSalaryCents?: number;
  hourlyRateCents?: number;
  payFrequency?: string | null;
  commissionEligible?: boolean;
  commissionMode?: string | null;
  actorUserId?: string | null;
  payrollMeta?: Record<string, any>;
  profileMeta?: Record<string, any>;
}) {
  const db: any = prisma;
  const engagementType = normalizeEngagementType(input.engagementType);
  const workforce = await db.workforceMember.create({
    data: {
      displayName: input.displayName,
      email: input.email || null,
      phone: input.phone || null,
      engagementType,
      status: input.endDate ? 'INACTIVE' : 'ACTIVE',
      country: input.country || 'ZA',
      currency: input.currency || 'ZAR',
      startDate: input.startDate || null,
      endDate: input.endDate || null,
      meta: {
        standaloneWorkforce: true,
        adminLoginRequired: false,
      },
      createdByUserId: input.actorUserId || null,
      updatedByUserId: input.actorUserId || null,
    },
  });

  const syntheticStaffUserId = `workforce:${workforce.id}`;
  const payrollProfile = await db.staffPayrollProfile.create({
    data: {
      staffUserId: syntheticStaffUserId,
      workforceMemberId: workforce.id,
      staffDisplayName: input.displayName,
      staffEmail: input.email || null,
      employmentType: engagementType.toLowerCase(),
      payrollStatus: 'draft',
      country: input.country || 'ZA',
      currency: input.currency || 'ZAR',
      baseSalaryCents: Math.max(0, Math.round(Number(input.baseSalaryCents || 0))),
      hourlyRateCents: Math.max(0, Math.round(Number(input.hourlyRateCents || 0))),
      payFrequency: input.payFrequency || 'monthly',
      commissionEligible: Boolean(input.commissionEligible),
      commissionMode: input.commissionMode || 'none',
      startDate: input.startDate || null,
      endDate: input.endDate || null,
      profileMeta: {
        ...(input.profileMeta || {}),
        standaloneWorkforce: true,
      },
      payrollMeta: input.payrollMeta || {},
      approvalStatus: 'pending',
    },
  });

  return { workforce, payrollProfile };
}
