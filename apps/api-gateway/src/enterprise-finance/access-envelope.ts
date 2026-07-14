import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const ENTERPRISE_FINANCE_ACCESS_MARKER =
  'A5_K_D_C_ENTERPRISE_FINANCE_ACCESS_ENVELOPE';

export type EnterpriseFinanceActor = {
  userId: string | null;
  email: string | null;
  role: string | null;
  roles: string[];
};

export type ShareholderAccessEnvelope = {
  enabled: boolean;
  shareholderId: string | null;
  grantId: string | null;
  accessStatus: string | null;
  accessScope: string | null;
  canViewCapTable: boolean;
  canViewValuations: boolean;
  canViewAnnualReturns: boolean;
  canViewAnnouncements: boolean;
  canDownloadDocuments: boolean;
};

export type EnterpriseFinanceAccessEnvelope = {
  marker: string;
  actor: EnterpriseFinanceActor;
  operationalRoles: string[];
  shareholderAccess: ShareholderAccessEnvelope;
  activePortals: string[];
  defaultPortal: string;
  isFinanceAdmin: boolean;
  isInvestorOnly: boolean;
};

export function json(payload: any, status = 200) {
  return NextResponse.json(payload, { status });
}

export function routeError(error: any, fallback = 'enterprise_finance_error') {
  console.error(fallback, error);
  return json({ ok: false, error: error?.message || fallback }, 500);
}

export function text(value: any, max = 240) {
  if (value === null || value === undefined) return '';
  return String(value).trim().slice(0, max);
}

export function asObject(value: any): Record<string, any> {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, any>;

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  return {};
}

export function asCents(value: any, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : fallback;
}

export function parseBool(value: any) {
  const raw = text(value, 20).toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes';
}

export function parseDate(value: any) {
  const raw = text(value, 80);
  if (!raw) return null;

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function dateRangeWhere(searchParams: URLSearchParams, field = 'createdAt') {
  const from = parseDate(searchParams.get('from') || searchParams.get('periodStart') || searchParams.get('start'));
  const to = parseDate(searchParams.get('to') || searchParams.get('periodEnd') || searchParams.get('end'));

  if (!from && !to) return {};

  const range: any = {};
  if (from) range.gte = from;
  if (to) range.lte = to;

  return { [field]: range };
}

export function idsFrom(value: any): string[] {
  if (Array.isArray(value)) return value.map((item) => text(item, 180)).filter(Boolean);

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => text(item, 180))
      .filter(Boolean);
  }

  const single = text(value, 180);
  return single ? [single] : [];
}

function splitHeaderRoles(value: any) {
  return text(value, 1000)
    .split(',')
    .map((role) => role.trim().toLowerCase())
    .filter(Boolean);
}

export function actorFromRequest(req: NextRequest): EnterpriseFinanceActor {
  const userId =
    text(req.headers.get('x-user-id'), 180) ||
    text(req.headers.get('x-actor-id'), 180) ||
    text(req.headers.get('x-staff-user-id'), 180) ||
    null;

  const email =
    text(req.headers.get('x-user-email'), 240) ||
    text(req.headers.get('x-actor-email'), 240) ||
    null;

  const primaryRole =
    text(req.headers.get('x-user-role'), 120) ||
    text(req.headers.get('x-actor-role'), 120) ||
    null;

  const roles = Array.from(
    new Set([
      ...splitHeaderRoles(req.headers.get('x-user-role')),
      ...splitHeaderRoles(req.headers.get('x-user-roles')),
      ...splitHeaderRoles(req.headers.get('x-actor-role')),
      ...splitHeaderRoles(req.headers.get('x-actor-roles')),
      ...(primaryRole ? [primaryRole.toLowerCase()] : []),
    ]),
  );

  return { userId, email, role: primaryRole, roles };
}

export function isFinanceRole(roles: string[]) {
  const allowed = new Set([
    'admin',
    'super_admin',
    'owner',
    'founder',
    'accountant',
    'finance',
    'finance_admin',
    'finance_manager',
    'operations_admin',
  ]);

  return roles.some((role) => allowed.has(role));
}

export function isOperationalRole(roles: string[]) {
  const excludedInvestorOnly = new Set(['shareholder', 'investor', 'shareholder_read_only']);
  return roles.some((role) => role && !excludedInvestorOnly.has(role));
}

async function safeFindFirst(delegate: any, args: any) {
  if (!delegate?.findFirst) return null;
  try {
    return await delegate.findFirst(args);
  } catch {
    return null;
  }
}

export async function resolveEnterpriseFinanceAccess(
  req: NextRequest,
): Promise<EnterpriseFinanceAccessEnvelope> {
  const actor = actorFromRequest(req);
  const db: any = prisma;
  const roleSet = Array.from(new Set(actor.roles));

  const or: any[] = [];
  if (actor.userId) or.push({ userId: actor.userId });
  if (actor.email) or.push({ email: actor.email });

  let grant: any = null;
  let shareholder: any = null;

  if (or.length) {
    grant = await safeFindFirst(db.shareholderAccessGrant, {
      where: {
        OR: or,
        accessStatus: { in: ['active', 'approved', 'granted'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (grant?.shareholderId) {
      shareholder = await safeFindFirst(db.shareholder, {
        where: { id: grant.shareholderId },
      });
    } else if (actor.userId || actor.email) {
      const shareholderOr: any[] = [];
      if (actor.userId) shareholderOr.push({ userId: actor.userId });
      if (actor.email) shareholderOr.push({ email: actor.email });

      shareholder = await safeFindFirst(db.shareholder, {
        where: {
          OR: shareholderOr,
          investorStatus: { in: ['active', 'approved'] },
        },
        orderBy: { createdAt: 'desc' },
      });
    }
  }

  const shareholderAccess: ShareholderAccessEnvelope = {
    enabled: Boolean(grant || shareholder?.portalEnabled),
    shareholderId: grant?.shareholderId || shareholder?.id || null,
    grantId: grant?.id || null,
    accessStatus: grant?.accessStatus || null,
    accessScope: grant?.accessScope || null,
    canViewCapTable: Boolean(grant?.canViewCapTable ?? shareholder?.portalEnabled ?? false),
    canViewValuations: Boolean(grant?.canViewValuations ?? shareholder?.portalEnabled ?? false),
    canViewAnnualReturns: Boolean(grant?.canViewAnnualReturns ?? shareholder?.portalEnabled ?? false),
    canViewAnnouncements: Boolean(grant?.canViewAnnouncements ?? shareholder?.portalEnabled ?? false),
    canDownloadDocuments: Boolean(grant?.canDownloadDocuments ?? shareholder?.portalEnabled ?? false),
  };

  const financeAdmin = isFinanceRole(roleSet);
  const operations = isOperationalRole(roleSet);
  const activePortals: string[] = [];

  if (operations || financeAdmin) activePortals.push('operations');
  if (shareholderAccess.enabled) activePortals.push('shareholder');
  if (financeAdmin) activePortals.push('enterprise_finance');

  const isInvestorOnly = shareholderAccess.enabled && !operations && !financeAdmin;

  return {
    marker: ENTERPRISE_FINANCE_ACCESS_MARKER,
    actor,
    operationalRoles: roleSet,
    shareholderAccess,
    activePortals,
    defaultPortal: isInvestorOnly ? 'shareholder' : activePortals[0] || 'none',
    isFinanceAdmin: financeAdmin,
    isInvestorOnly,
  };
}

export async function requireEnterpriseFinanceAdmin(req: NextRequest) {
  const envelope = await resolveEnterpriseFinanceAccess(req);

  if (!envelope.isFinanceAdmin) {
    return {
      ok: false as const,
      envelope,
      response: json(
        {
          ok: false,
          error: 'enterprise_finance_admin_required',
          envelope,
        },
        403,
      ),
    };
  }

  return { ok: true as const, envelope };
}

export async function requireShareholderReadAccess(
  req: NextRequest,
  capability:
    | 'canViewCapTable'
    | 'canViewValuations'
    | 'canViewAnnualReturns'
    | 'canViewAnnouncements'
    | 'canDownloadDocuments',
) {
  const envelope = await resolveEnterpriseFinanceAccess(req);

  if (!envelope.shareholderAccess.enabled || !envelope.shareholderAccess[capability]) {
    return {
      ok: false as const,
      envelope,
      response: json(
        {
          ok: false,
          error: 'shareholder_access_required',
          requiredCapability: capability,
          envelope,
        },
        403,
      ),
    };
  }

  return { ok: true as const, envelope };
}

export async function auditEnterpriseFinance(eventType: string, req: NextRequest, meta: any) {
  const db: any = prisma;
  const actor = actorFromRequest(req);

  try {
    await db.payrollAuditEvent?.create?.({
      data: {
        eventType,
        actorUserId: actor.userId,
        actorRole: actor.role,
        subjectType: text(meta?.subjectType || meta?.model, 120) || null,
        subjectId: text(meta?.subjectId || meta?.id, 180) || null,
        staffUserId: text(meta?.staffUserId, 180) || null,
        meta,
      },
    });
  } catch {
    // Audit should not break operational finance actions.
  }
}

export async function safeCount(delegate: any, where: any = {}) {
  if (!delegate?.count) return 0;
  try {
    return await delegate.count({ where });
  } catch {
    return 0;
  }
}

export async function safeFindMany(delegate: any, args: any = {}) {
  if (!delegate?.findMany) return [];
  try {
    return await delegate.findMany(args);
  } catch {
    return [];
  }
}

export async function safeAggregateSum(delegate: any, fields: string[], where: any = {}) {
  const empty = Object.fromEntries(fields.map((field) => [field, 0]));

  if (!delegate?.aggregate) return empty;

  try {
    const result = await delegate.aggregate({
      where,
      _sum: Object.fromEntries(fields.map((field) => [field, true])),
    });

    const sums = result?._sum || {};
    return Object.fromEntries(fields.map((field) => [field, asCents(sums[field])]));
  } catch {
    return empty;
  }
}
