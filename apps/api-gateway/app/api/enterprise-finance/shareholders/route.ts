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


// A5_M_C_ENTERPRISE_FINANCE_SHAREHOLDER_UPDATE_ARCHIVE_VOID_PATCH
function a5mCDefined(data: Record<string, any>) {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
}

function a5mCBoolean(value: any) {
  return value === undefined ? undefined : Boolean(value);
}

function a5mCIdempotencyKey(req: NextRequest) {
  return text(req.headers.get('Idempotency-Key'), 180) || null;
}

async function a5mCAudit(action: string, req: NextRequest, model: string, subjectId: string, idempotencyKey: string | null) {
  await auditEnterpriseFinance(action, req, {
    model,
    subjectId,
    idempotencyKey,
    mutationSurface: 'enterprise_finance_patch',
  });
}

export async function PATCH(req: NextRequest) {
  try {
    const access = await requireEnterpriseFinanceAdmin(req);
    if (!access.ok) return access.response;

    const db: any = prisma;
    const body = await req.json().catch(() => ({}));
    const action = text(body.action || 'update_shareholder', 120);
    const id = text(body.id || body.shareholderId, 180);
    const idempotencyKey = a5mCIdempotencyKey(req);

    if (!id) {
      return json({ ok: false, envelope: access.envelope, error: 'shareholder_id_required' });
    }

    if (action === 'update_shareholder' || action === 'archive_shareholder' || action === 'disable_shareholder_portal') {
      const item = await db.shareholder.update({
        where: { id },
        data: a5mCDefined({
          userId: body.userId === undefined ? undefined : text(body.userId, 180) || null,
          shareholderType: body.shareholderType === undefined ? undefined : text(body.shareholderType, 80),
          displayName: body.displayName === undefined ? undefined : text(body.displayName, 240),
          legalName: body.legalName === undefined ? undefined : text(body.legalName, 240) || null,
          email: body.email === undefined ? undefined : text(body.email, 240) || null,
          phone: body.phone === undefined ? undefined : text(body.phone, 80) || null,
          country: body.country === undefined ? undefined : text(body.country, 2).toUpperCase() || null,
          taxIdentifierMasked: body.taxIdentifierMasked === undefined ? undefined : text(body.taxIdentifierMasked, 120) || null,
          investorStatus:
            action === 'archive_shareholder'
              ? 'archived'
              : body.investorStatus === undefined
                ? undefined
                : text(body.investorStatus, 80),
          kycStatus: body.kycStatus === undefined ? undefined : text(body.kycStatus, 80),
          communicationOptIn:
            action === 'archive_shareholder'
              ? false
              : a5mCBoolean(body.communicationOptIn),
          portalEnabled:
            action === 'archive_shareholder' || action === 'disable_shareholder_portal'
              ? false
              : a5mCBoolean(body.portalEnabled),
          profileMeta: body.profileMeta === undefined && body.meta === undefined ? undefined : asObject(body.profileMeta || body.meta),
          approvedByUserId: body.approvedByUserId === undefined ? undefined : text(body.approvedByUserId, 180) || null,
          approvedAt: body.approvedAt === undefined ? undefined : body.approvedAt ? new Date(body.approvedAt) : null,
        }),
      });

      const auditAction =
        action === 'archive_shareholder' ? 'shareholder_archived' :
        action === 'disable_shareholder_portal' ? 'shareholder_portal_disabled' :
        'shareholder_updated';

      await a5mCAudit(auditAction, req, 'Shareholder', item.id, idempotencyKey);
      return json({ ok: true, envelope: access.envelope, item });
    }

    return json({ ok: false, envelope: access.envelope, error: 'unsupported_shareholder_patch_action', action });
  } catch (error: any) {
    return routeError(error, 'enterprise_finance_shareholder_patch_failed');
  }
}

