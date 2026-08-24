import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  asCents,
  asObject,
  auditEnterpriseFinance,
  json,
  requireEnterpriseFinanceAdmin,
  routeError,
  text,
} from '@/src/enterprise-finance/access-envelope';
import {
  createStandaloneWorkforcePayrollProfile,
  ensureWorkforceMemberForPayrollProfile,
  normalizeEngagementType,
} from '@/src/lib/workforce';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const access = await requireEnterpriseFinanceAdmin(req);
    if (!access.ok) return access.response;

    const db: any = prisma;
    const { searchParams } = new URL(req.url);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '100', 10) || 100, 1), 500);

    const where: any = {};
    const staffUserId = text(searchParams.get('staffUserId'), 180);
    const payrollStatus = text(searchParams.get('payrollStatus'), 80);
    const employmentType = text(searchParams.get('employmentType'), 80);
    const approvalStatus = text(searchParams.get('approvalStatus'), 80);
    const q = text(searchParams.get('q'), 180)?.toLowerCase() || '';

    if (staffUserId) where.staffUserId = staffUserId;
    if (payrollStatus) where.payrollStatus = payrollStatus;
    if (employmentType) where.employmentType = employmentType;
    if (approvalStatus) where.approvalStatus = approvalStatus;

    const baseItems = await db.staffPayrollProfile.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }],
      take: 500,
    });

    const staffUserIds = Array.from(
      new Set(
        baseItems
          .map((item: any) => String(item.staffUserId || '').trim())
          .filter((value: string) => value && !value.startsWith('workforce:')),
      ),
    );
    const workforceIds = Array.from(
      new Set(
        baseItems
          .map((item: any) => String(item.workforceMemberId || '').trim())
          .filter(Boolean),
      ),
    );

    const [staffRows, bankRows, workforceRows] = await Promise.all([
      staffUserIds.length
        ? db.adminUserProfile.findMany({
            where: { userId: { in: staffUserIds } },
            select: {
              id: true,
              userId: true,
              name: true,
              email: true,
              staffIdentifier: true,
              lifecycleState: true,
              department: { select: { id: true, name: true } },
              designation: {
                select: {
                  id: true,
                  name: true,
                  roles: {
                    select: { role: { select: { id: true, name: true } } },
                  },
                },
              },
              roles: {
                select: { role: { select: { id: true, name: true } } },
              },
            },
          })
        : [],
      baseItems.length
        ? db.staffBankAccount.findMany({
            where: {
              staffUserId: { in: baseItems.map((item: any) => item.staffUserId) },
              active: true,
            },
            orderBy: [{ isPrimary: 'desc' }, { updatedAt: 'desc' }],
            select: {
              id: true,
              staffUserId: true,
              bankName: true,
              accountNumberMasked: true,
              verificationStatus: true,
              verificationProvider: true,
              verifiedAt: true,
              isPrimary: true,
            },
          })
        : [],
      workforceIds.length
        ? db.workforceMember.findMany({ where: { id: { in: workforceIds } } })
        : [],
    ]);

    const staffByUserId = new Map<string, any>(
      staffRows.map((row: any) => [String(row.userId), row]),
    );
    const workforceById = new Map<string, any>(
      workforceRows.map((row: any) => [String(row.id), row]),
    );

    const bankByUserId = new Map<string, any>();
    for (const row of bankRows) {
      const key = String(row.staffUserId || '');
      if (!bankByUserId.has(key)) bankByUserId.set(key, row);
    }

    const enriched = baseItems.map((item: any) => {
      const staff = staffByUserId.get(String(item.staffUserId || ''));
      const workforce = workforceById.get(String(item.workforceMemberId || ''));
      const bank = bankByUserId.get(String(item.staffUserId || ''));
      const designationRoles =
        staff?.designation?.roles?.map((entry: any) => entry.role?.name).filter(Boolean) || [];
      const directRoles =
        staff?.roles?.map((entry: any) => entry.role?.name).filter(Boolean) || [];
      const roles = Array.from(new Set([...designationRoles, ...directRoles]));

      return {
        ...item,
        payrollProfileId: item.id,
        workforceMember: workforce || null,
        engagementType:
          workforce?.engagementType || normalizeEngagementType(item.employmentType),
        hasAdminLogin: Boolean(staff),
        staffProfileId: staff?.id || workforce?.adminStaffProfileId || null,
        staffIdentifier:
          staff?.staffIdentifier || workforce?.workforceNumber || null,
        staffName:
          staff?.name ||
          workforce?.displayName ||
          item.staffDisplayName ||
          item.staffEmail ||
          item.staffUserId,
        staffEmail:
          staff?.email || workforce?.email || item.staffEmail || null,
        staffLifecycleState: staff?.lifecycleState || workforce?.status || null,
        departmentName: staff?.department?.name || null,
        designationName: staff?.designation?.name || null,
        roles,
        role:
          roles.join(', ') ||
          item.staffRole ||
          staff?.designation?.name ||
          workforce?.engagementType ||
          null,
        bankAccountId: bank?.id || null,
        bankName: bank?.bankName || null,
        bankAccountMasked: bank?.accountNumberMasked || null,
        bankStatus: bank?.verificationStatus || 'not_configured',
        bankVerificationProvider: bank?.verificationProvider || null,
        bankVerifiedAt: bank?.verifiedAt || null,
      };
    });

    const filtered = q
      ? enriched.filter((item: any) =>
          [
            item.staffName,
            item.staffEmail,
            item.staffIdentifier,
            item.staffProfileId,
            item.workforceMemberId,
            item.staffUserId,
            item.payrollNumber,
            item.employerReference,
            item.departmentName,
            item.designationName,
            item.role,
            item.engagementType,
            item.bankName,
            item.bankAccountMasked,
            item.payrollStatus,
            item.employmentType,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(q),
        )
      : enriched;

    return json({
      ok: true,
      envelope: access.envelope,
      items: filtered.slice(0, limit),
      engagementTypes: [
        'PERMANENT',
        'FIXED_TERM',
        'TEMPORARY',
        'CASUAL',
        'CONTRACTOR',
        'INTERN',
        'COMMISSION_ONLY',
      ],
      meta: {
        count: Math.min(filtered.length, limit),
        matched: filtered.length,
        scanned: baseItems.length,
        limit,
        canonicalWorkforceIdentity: true,
      },
    });
  } catch (error: any) {
    return routeError(error, 'enterprise_finance_payroll_profiles_list_failed');
  }
}

export async function POST(req: NextRequest) {
  try {
    const access = await requireEnterpriseFinanceAdmin(req);
    if (!access.ok) return access.response;

    const db: any = prisma;
    const body = await req.json().catch(() => ({}));
    const staffUserId = text(body.staffUserId, 180);
    const displayName = text(body.staffDisplayName || body.displayName, 240);
    const actorUserId = access.envelope.actor.userId;
    const startDate = body.startDate ? new Date(body.startDate) : null;
    const endDate = body.endDate ? new Date(body.endDate) : null;

    if (!staffUserId) {
      if (!displayName) {
        return json({
          ok: false,
          error: 'staffUserId_or_standalone_workforce_display_name_required',
        }, 400);
      }

      const created = await createStandaloneWorkforcePayrollProfile({
        displayName,
        email: text(body.staffEmail || body.email, 240) || null,
        phone: text(body.phone, 80) || null,
        engagementType: text(body.engagementType || body.employmentType || 'CASUAL', 80),
        country: text(body.country || 'ZA', 2).toUpperCase(),
        currency: text(body.currency || 'ZAR', 3).toUpperCase(),
        startDate,
        endDate,
        baseSalaryCents: asCents(body.baseSalaryCents),
        hourlyRateCents: asCents(body.hourlyRateCents),
        payFrequency: text(body.payFrequency || 'monthly', 80),
        commissionEligible: Boolean(body.commissionEligible),
        commissionMode: text(body.commissionMode || 'none', 80),
        actorUserId,
        profileMeta: asObject(body.profileMeta),
        payrollMeta: asObject(body.payrollMeta),
      });

      await auditEnterpriseFinance('standalone_workforce_payroll_profile_created', req, {
        model: 'StaffPayrollProfile',
        subjectId: created.payrollProfile.id,
        staffUserId: created.payrollProfile.staffUserId,
        workforceMemberId: created.workforce.id,
        engagementType: created.workforce.engagementType,
      });

      return json({
        ok: true,
        envelope: access.envelope,
        item: created.payrollProfile,
        workforceMember: created.workforce,
      });
    }

    const item = await db.staffPayrollProfile.create({
      data: {
        staffUserId,
        staffDisplayName: displayName || null,
        staffEmail: text(body.staffEmail || body.email, 240) || null,
        staffRole: text(body.staffRole || body.role, 120) || null,
        departmentId: text(body.departmentId, 180) || null,
        designationId: text(body.designationId, 180) || null,
        employmentType: text(body.employmentType || 'permanent', 80),
        payrollStatus: text(body.payrollStatus || 'draft', 80),
        country: text(body.country || 'ZA', 2).toUpperCase(),
        currency: text(body.currency || 'ZAR', 3).toUpperCase(),
        baseSalaryCents: asCents(body.baseSalaryCents),
        hourlyRateCents: asCents(body.hourlyRateCents),
        payFrequency: text(body.payFrequency || 'monthly', 80),
        commissionEligible: Boolean(body.commissionEligible),
        commissionMode: text(body.commissionMode || 'none', 80),
        taxNumber: text(body.taxNumber, 180) || null,
        payrollNumber: text(body.payrollNumber, 180) || null,
        employerReference: text(body.employerReference, 180) || null,
        startDate,
        endDate,
        profileMeta: asObject(body.profileMeta),
        payrollMeta: asObject(body.payrollMeta),
        approvalStatus: text(body.approvalStatus || 'pending', 80),
        approvedByUserId: text(body.approvedByUserId, 180) || null,
        approvedAt: body.approvedAt ? new Date(body.approvedAt) : null,
      },
    });

    const workforce = await ensureWorkforceMemberForPayrollProfile(item, actorUserId);

    await auditEnterpriseFinance('staff_payroll_profile_created', req, {
      model: 'StaffPayrollProfile',
      subjectId: item.id,
      staffUserId,
      workforceMemberId: workforce.id,
    });

    return json({
      ok: true,
      envelope: access.envelope,
      item: { ...item, workforceMemberId: workforce.id },
      workforceMember: workforce,
    });
  } catch (error: any) {
    return routeError(error, 'enterprise_finance_payroll_profile_create_failed');
  }
}
