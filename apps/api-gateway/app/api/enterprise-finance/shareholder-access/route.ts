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


// A5_M_C_ENTERPRISE_FINANCE_SHAREHOLDER_ACCESS_UPDATE_REVOKE_PATCH
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
    const action = text(body.action || 'update_shareholder_access', 120);
    const id = text(body.id || body.accessGrantId || body.shareholderAccessGrantId, 180);
    const idempotencyKey = a5mCIdempotencyKey(req);

    if (!id) {
      return json({ ok: false, envelope: access.envelope, error: 'shareholder_access_grant_id_required' });
    }

    if (action === 'update_shareholder_access' || action === 'revoke_shareholder_access') {
      const revoking = action === 'revoke_shareholder_access';

      const item = await db.shareholderAccessGrant.update({
        where: { id },
        data: a5mCDefined({
          shareholderId: body.shareholderId === undefined ? undefined : text(body.shareholderId, 180),
          userId: body.userId === undefined ? undefined : text(body.userId, 180) || null,
          email: body.email === undefined ? undefined : text(body.email, 240) || null,
          accessStatus: revoking ? 'revoked' : body.accessStatus === undefined ? undefined : text(body.accessStatus, 80),
          accessScope: body.accessScope === undefined ? undefined : text(body.accessScope, 120),
          canViewCapTable: revoking ? false : a5mCBoolean(body.canViewCapTable),
          canViewValuations: revoking ? false : a5mCBoolean(body.canViewValuations),
          canViewAnnualReturns: revoking ? false : a5mCBoolean(body.canViewAnnualReturns),
          canViewAnnouncements: revoking ? false : a5mCBoolean(body.canViewAnnouncements),
          canDownloadDocuments: revoking ? false : a5mCBoolean(body.canDownloadDocuments),
          revokedByUserId: revoking ? access.envelope.actor.userId : body.revokedByUserId === undefined ? undefined : text(body.revokedByUserId, 180) || null,
          revokedAt: revoking ? new Date() : body.revokedAt === undefined ? undefined : body.revokedAt ? new Date(body.revokedAt) : null,
          meta: body.meta === undefined ? undefined : asObject(body.meta),
        }),
      });

      const auditAction = revoking ? 'shareholder_access_revoked' : 'shareholder_access_updated';

      await a5mCAudit(auditAction, req, 'ShareholderAccessGrant', item.id, idempotencyKey);
      return json({ ok: true, envelope: access.envelope, item });
    }

    return json({ ok: false, envelope: access.envelope, error: 'unsupported_shareholder_access_patch_action', action });
  } catch (error: any) {
    return routeError(error, 'enterprise_finance_shareholder_access_patch_failed');
  }
}

