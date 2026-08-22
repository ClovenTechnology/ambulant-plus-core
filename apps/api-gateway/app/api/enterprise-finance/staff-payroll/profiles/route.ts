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

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// A5_K_D_C_ENTERPRISE_FINANCE_STAFF_PAYROLL_PROFILES_ROUTE

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

    // This is intentionally capped at 500: the Admin surface needs canonical Staff
    // identity enrichment before filtering, but must not turn into an unbounded export.
    const baseItems = await db.staffPayrollProfile.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }],
      take: 500,
    });

    const staffUserIds = Array.from(
      new Set(
        baseItems
          .map((item: any) => String(item.staffUserId || '').trim())
          .filter(Boolean),
      ),
    );

    const [staffRows, bankRows] = staffUserIds.length
      ? await Promise.all([
          db.adminUserProfile.findMany({
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
                    select: {
                      role: { select: { id: true, name: true } },
                    },
                  },
                },
              },
              roles: {
                select: {
                  role: { select: { id: true, name: true } },
                },
              },
            },
          }),
          db.staffBankAccount.findMany({
            where: {
              staffUserId: { in: staffUserIds },
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
          }),
        ])
      : [[], []];

    const staffByUserId = new Map<string, any>(
      staffRows.map((row: any) => [String(row.userId), row] as [string, any]),
    );

    const bankByUserId = new Map<string, any>();
    for (const row of bankRows) {
      const key = String(row.staffUserId || '');
      if (!bankByUserId.has(key)) {
        bankByUserId.set(key, row);
      }
    }

    const enriched = baseItems.map((item: any) => {
      const staff = staffByUserId.get(String(item.staffUserId || ''));
      const bank = bankByUserId.get(String(item.staffUserId || ''));
      const designationRoles =
        staff?.designation?.roles?.map((entry: any) => entry.role?.name).filter(Boolean) || [];
      const directRoles =
        staff?.roles?.map((entry: any) => entry.role?.name).filter(Boolean) || [];
      const roles = Array.from(new Set([...designationRoles, ...directRoles]));

      return {
        ...item,
        payrollProfileId: item.id,
        staffProfileId: staff?.id || null,
        staffIdentifier: staff?.staffIdentifier || null,
        staffName: staff?.name || item.staffDisplayName || item.staffEmail || item.staffUserId,
        staffEmail: staff?.email || item.staffEmail || null,
        staffLifecycleState: staff?.lifecycleState || null,
        departmentName: staff?.department?.name || null,
        designationName: staff?.designation?.name || null,
        roles,
        role: roles.join(', ') || item.staffRole || staff?.designation?.name || null,
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
            item.staffUserId,
            item.payrollNumber,
            item.employerReference,
            item.departmentName,
            item.designationName,
            item.role,
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
      meta: {
        count: Math.min(filtered.length, limit),
        matched: filtered.length,
        scanned: baseItems.length,
        limit,
        canonicalStaffEnrichment: true,
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

    if (!staffUserId) return json({ ok: false, error: 'staffUserId_required' }, 400);

    const item = await db.staffPayrollProfile.create({
      data: {
        staffUserId,
        staffDisplayName: text(body.staffDisplayName || body.displayName, 240) || null,
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
        startDate: body.startDate ? new Date(body.startDate) : null,
        endDate: body.endDate ? new Date(body.endDate) : null,
        profileMeta: asObject(body.profileMeta),
        payrollMeta: asObject(body.payrollMeta),
        approvalStatus: text(body.approvalStatus || 'pending', 80),
        approvedByUserId: text(body.approvedByUserId, 180) || null,
        approvedAt: body.approvedAt ? new Date(body.approvedAt) : null,
      },
    });

    await auditEnterpriseFinance('staff_payroll_profile_created', req, {
      model: 'StaffPayrollProfile',
      subjectId: item.id,
      staffUserId,
    });

    return json({ ok: true, envelope: access.envelope, item });
  } catch (error: any) {
    return routeError(error, 'enterprise_finance_payroll_profile_create_failed');
  }
}