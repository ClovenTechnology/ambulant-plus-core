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

// A5_K_D_C_ENTERPRISE_FINANCE_SHAREHOLDERS_ROUTE

export async function GET(req: NextRequest) {
  try {
    const access = await requireEnterpriseFinanceAdmin(req);
    if (!access.ok) return access.response;

    const db: any = prisma;
    const { searchParams } = new URL(req.url);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '100', 10) || 100, 1), 500);

    const where: any = {};
    const investorStatus = text(searchParams.get('investorStatus'), 80);
    const shareholderType = text(searchParams.get('shareholderType'), 80);
    const userId = text(searchParams.get('userId'), 180);
    const email = text(searchParams.get('email'), 240);

    if (investorStatus) where.investorStatus = investorStatus;
    if (shareholderType) where.shareholderType = shareholderType;
    if (userId) where.userId = userId;
    if (email) where.email = email;

    const items = await db.shareholder.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      take: limit,
    });

    return json({ ok: true, envelope: access.envelope, items });
  } catch (error: any) {
    return routeError(error, 'enterprise_finance_shareholders_list_failed');
  }
}

export async function POST(req: NextRequest) {
  try {
    const access = await requireEnterpriseFinanceAdmin(req);
    if (!access.ok) return access.response;

    const db: any = prisma;
    const body = await req.json().catch(() => ({}));

    const item = await db.shareholder.create({
      data: {
        userId: text(body.userId, 180) || null,
        shareholderType: text(body.shareholderType || 'individual', 80),
        displayName: text(body.displayName || body.legalName || body.email, 240) || 'Shareholder',
        legalName: text(body.legalName, 240) || null,
        email: text(body.email, 240) || null,
        phone: text(body.phone, 80) || null,
        country: text(body.country, 2).toUpperCase() || null,
        taxIdentifierMasked: text(body.taxIdentifierMasked, 120) || null,
        investorStatus: text(body.investorStatus || 'active', 80),
        kycStatus: text(body.kycStatus || 'unverified', 80),
        communicationOptIn: body.communicationOptIn === undefined ? true : Boolean(body.communicationOptIn),
        portalEnabled: Boolean(body.portalEnabled),
        profileMeta: asObject(body.profileMeta || body.meta),
        createdByUserId: access.envelope.actor.userId,
        approvedByUserId: text(body.approvedByUserId, 180) || null,
        approvedAt: body.approvedAt ? new Date(body.approvedAt) : null,
      },
    });

    await auditEnterpriseFinance('shareholder_created', req, { model: 'Shareholder', subjectId: item.id });
    return json({ ok: true, envelope: access.envelope, item });
  } catch (error: any) {
    return routeError(error, 'enterprise_finance_shareholder_create_failed');
  }
}
