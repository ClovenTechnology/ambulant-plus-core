import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  asObject,
  auditEnterpriseFinance,
  json,
  requireEnterpriseFinanceAdmin,
  routeError,
  text,
} from '@/src/enterprise-finance/access-envelope';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// A5_K_D_C_ENTERPRISE_FINANCE_SHAREHOLDER_ACCESS_ROUTE

export async function GET(req: NextRequest) {
  try {
    const access = await requireEnterpriseFinanceAdmin(req);
    if (!access.ok) return access.response;

    const db: any = prisma;
    const { searchParams } = new URL(req.url);
    const where: any = {};

    const shareholderId = text(searchParams.get('shareholderId'), 180);
    const userId = text(searchParams.get('userId'), 180);
    const email = text(searchParams.get('email'), 240);
    const accessStatus = text(searchParams.get('accessStatus'), 80);

    if (shareholderId) where.shareholderId = shareholderId;
    if (userId) where.userId = userId;
    if (email) where.email = email;
    if (accessStatus) where.accessStatus = accessStatus;

    const items = await db.shareholderAccessGrant.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }],
      take: 500,
    });

    return json({ ok: true, envelope: access.envelope, items });
  } catch (error: any) {
    return routeError(error, 'enterprise_finance_shareholder_access_list_failed');
  }
}

export async function POST(req: NextRequest) {
  try {
    const access = await requireEnterpriseFinanceAdmin(req);
    if (!access.ok) return access.response;

    const db: any = prisma;
    const body = await req.json().catch(() => ({}));
    const shareholderId = text(body.shareholderId, 180);

    if (!shareholderId) return json({ ok: false, error: 'shareholderId_required' }, 400);

    const item = await db.shareholderAccessGrant.create({
      data: {
        shareholderId,
        userId: text(body.userId, 180) || null,
        email: text(body.email, 240) || null,
        accessStatus: text(body.accessStatus || 'active', 80),
        accessScope: text(body.accessScope || 'shareholder_read_only', 120),
        canViewCapTable: body.canViewCapTable === undefined ? true : Boolean(body.canViewCapTable),
        canViewValuations: body.canViewValuations === undefined ? true : Boolean(body.canViewValuations),
        canViewAnnualReturns: body.canViewAnnualReturns === undefined ? true : Boolean(body.canViewAnnualReturns),
        canViewAnnouncements: body.canViewAnnouncements === undefined ? true : Boolean(body.canViewAnnouncements),
        canDownloadDocuments: body.canDownloadDocuments === undefined ? true : Boolean(body.canDownloadDocuments),
        grantedByUserId: access.envelope.actor.userId,
        grantedAt: new Date(),
        meta: asObject(body.meta),
      },
    });

    await auditEnterpriseFinance('shareholder_access_granted', req, {
      model: 'ShareholderAccessGrant',
      subjectId: item.id,
      shareholderId,
      userId: item.userId,
      email: item.email,
    });

    return json({ ok: true, envelope: access.envelope, item });
  } catch (error: any) {
    return routeError(error, 'enterprise_finance_shareholder_access_create_failed');
  }
}
