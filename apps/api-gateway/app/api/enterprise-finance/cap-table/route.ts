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

// A5_K_D_C_ENTERPRISE_FINANCE_CAP_TABLE_ROUTE

function decimalText(value: any, fallback = '0') {
  const raw = text(value, 80);
  return raw || fallback;
}

export async function GET(req: NextRequest) {
  try {
    const access = await requireEnterpriseFinanceAdmin(req);
    if (!access.ok) return access.response;

    const db: any = prisma;
    const limit = 200;

    const shareClasses = await db.shareClass.findMany({ orderBy: [{ createdAt: 'desc' }], take: limit });
    const shareholdings = await db.shareholding.findMany({ orderBy: [{ asOfDate: 'desc' }], take: limit });
    const investmentRounds = await db.investmentRound.findMany({ orderBy: [{ createdAt: 'desc' }], take: limit });
    const capitalContributions = await db.capitalContribution.findMany({ orderBy: [{ createdAt: 'desc' }], take: limit });
    const snapshots = await db.capTableSnapshot.findMany({ orderBy: [{ snapshotDate: 'desc' }], take: 50 });
    const valuations = await db.companyValuationSnapshot.findMany({ orderBy: [{ valuationDate: 'desc' }], take: 50 });
    const shareSaleNotices = await db.shareSaleNotice.findMany({ orderBy: [{ createdAt: 'desc' }], take: 50 });

    return json({
      ok: true,
      envelope: access.envelope,
      shareClasses,
      shareholdings,
      investmentRounds,
      capitalContributions,
      snapshots,
      valuations,
      shareSaleNotices,
    });
  } catch (error: any) {
    return routeError(error, 'enterprise_finance_cap_table_list_failed');
  }
}

export async function POST(req: NextRequest) {
  try {
    const access = await requireEnterpriseFinanceAdmin(req);
    if (!access.ok) return access.response;

    const db: any = prisma;
    const body = await req.json().catch(() => ({}));
    const action = text(body.action || 'create_share_class', 120);

    if (action === 'create_snapshot') {
      const item = await db.capTableSnapshot.create({
        data: {
          label: text(body.label, 240) || 'Cap table snapshot',
          snapshotDate: body.snapshotDate ? new Date(body.snapshotDate) : new Date(),
          status: text(body.status || 'draft', 80),
          totalAuthorisedShares: decimalText(body.totalAuthorisedShares),
          totalIssuedShares: decimalText(body.totalIssuedShares),
          totalAllocatedShares: decimalText(body.totalAllocatedShares),
          totalUnallocatedShares: decimalText(body.totalUnallocatedShares),
          fullyDilutedShares: decimalText(body.fullyDilutedShares),
          ordinarySharePercent: body.ordinarySharePercent === undefined ? null : decimalText(body.ordinarySharePercent),
          preferenceSharePercent: body.preferenceSharePercent === undefined ? null : decimalText(body.preferenceSharePercent),
          optionPoolPercent: body.optionPoolPercent === undefined ? null : decimalText(body.optionPoolPercent),
          snapshotMeta: asObject(body.snapshotMeta || body.meta),
          publishedToShareholders: Boolean(body.publishedToShareholders),
          generatedByUserId: access.envelope.actor.userId,
          approvedByUserId: text(body.approvedByUserId, 180) || null,
          approvedAt: body.approvedAt ? new Date(body.approvedAt) : null,
        },
      });

      await auditEnterpriseFinance('cap_table_snapshot_created', req, { model: 'CapTableSnapshot', subjectId: item.id });
      return json({ ok: true, envelope: access.envelope, item });
    }

    if (action === 'create_valuation') {
      const item = await db.companyValuationSnapshot.create({
        data: {
          label: text(body.label, 240) || 'Valuation snapshot',
          valuationDate: body.valuationDate ? new Date(body.valuationDate) : new Date(),
          valuationType: text(body.valuationType || 'internal', 80),
          status: text(body.status || 'draft', 80),
          preMoneyValuationCents: asCents(body.preMoneyValuationCents),
          postMoneyValuationCents: asCents(body.postMoneyValuationCents),
          enterpriseValueCents: asCents(body.enterpriseValueCents),
          currency: text(body.currency || 'ZAR', 3).toUpperCase(),
          methodology: text(body.methodology, 1000) || null,
          notes: text(body.notes, 1000) || null,
          valuationMeta: asObject(body.valuationMeta || body.meta),
          publishedToShareholders: Boolean(body.publishedToShareholders),
          createdByUserId: access.envelope.actor.userId,
          approvedByUserId: text(body.approvedByUserId, 180) || null,
          approvedAt: body.approvedAt ? new Date(body.approvedAt) : null,
        },
      });

      await auditEnterpriseFinance('company_valuation_snapshot_created', req, { model: 'CompanyValuationSnapshot', subjectId: item.id });
      return json({ ok: true, envelope: access.envelope, item });
    }

    if (action === 'create_share_sale_notice') {
      const item = await db.shareSaleNotice.create({
        data: {
          title: text(body.title, 240) || 'Share sale notice',
          shareClassId: text(body.shareClassId, 180) || null,
          sellerShareholderId: text(body.sellerShareholderId, 180) || null,
          sharesAvailable: body.sharesAvailable === undefined ? null : decimalText(body.sharesAvailable),
          askingPricePerShareCents: body.askingPricePerShareCents === undefined ? null : asCents(body.askingPricePerShareCents),
          currency: text(body.currency || 'ZAR', 3).toUpperCase(),
          status: text(body.status || 'draft', 80),
          saleTerms: text(body.saleTerms, 2000) || null,
          restrictionNotes: text(body.restrictionNotes, 2000) || null,
          visibleToShareholders: Boolean(body.visibleToShareholders),
          opensAt: body.opensAt ? new Date(body.opensAt) : null,
          closesAt: body.closesAt ? new Date(body.closesAt) : null,
          createdByUserId: access.envelope.actor.userId,
          approvedByUserId: text(body.approvedByUserId, 180) || null,
          approvedAt: body.approvedAt ? new Date(body.approvedAt) : null,
          publishedAt: body.publishedAt ? new Date(body.publishedAt) : null,
          meta: asObject(body.meta),
        },
      });

      await auditEnterpriseFinance('share_sale_notice_created', req, { model: 'ShareSaleNotice', subjectId: item.id });
      return json({ ok: true, envelope: access.envelope, item });
    }

    const item = await db.shareClass.create({
      data: {
        code: text(body.code, 80) || 'ORD-' + Date.now(),
        name: text(body.name, 240) || 'Ordinary shares',
        description: text(body.description, 1000) || null,
        authorisedShares: decimalText(body.authorisedShares),
        issuedShares: decimalText(body.issuedShares),
        allocatedShares: decimalText(body.allocatedShares),
        unallocatedShares: decimalText(body.unallocatedShares),
        votingRights: text(body.votingRights || 'standard', 120),
        votesPerShare: decimalText(body.votesPerShare, '1'),
        dividendRights: text(body.dividendRights, 1000) || null,
        liquidationPreference: text(body.liquidationPreference, 1000) || null,
        transferRestrictions: text(body.transferRestrictions, 1000) || null,
        conversionRights: text(body.conversionRights, 1000) || null,
        antiDilutionRights: text(body.antiDilutionRights, 1000) || null,
        active: body.active === undefined ? true : Boolean(body.active),
        termsMeta: asObject(body.termsMeta || body.meta),
        createdByUserId: access.envelope.actor.userId,
        approvedByUserId: text(body.approvedByUserId, 180) || null,
        approvedAt: body.approvedAt ? new Date(body.approvedAt) : null,
      },
    });

    await auditEnterpriseFinance('share_class_created', req, { model: 'ShareClass', subjectId: item.id });
    return json({ ok: true, envelope: access.envelope, item });
  } catch (error: any) {
    return routeError(error, 'enterprise_finance_cap_table_write_failed');
  }
}


// A5_M_C_ENTERPRISE_FINANCE_CAP_TABLE_UPDATE_ARCHIVE_VOID_PATCH
function a5mCDefined(data: Record<string, any>) {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
}

function a5mCBoolean(value: any) {
  return value === undefined ? undefined : Boolean(value);
}

function a5mCDate(value: any) {
  return value ? new Date(value) : undefined;
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
    const action = text(body.action, 120);
    const idempotencyKey = a5mCIdempotencyKey(req);

    if (!action) {
      return json({ ok: false, envelope: access.envelope, error: 'action_required' });
    }

    if (action === 'update_snapshot' || action === 'archive_snapshot' || action === 'void_snapshot') {
      const id = text(body.id || body.snapshotId, 180);
      if (!id) return json({ ok: false, envelope: access.envelope, error: 'snapshot_id_required' });

      const forcedStatus =
        action === 'archive_snapshot' ? 'archived' :
        action === 'void_snapshot' ? 'voided' :
        undefined;

      const item = await db.capTableSnapshot.update({
        where: { id },
        data: a5mCDefined({
          label: body.label === undefined ? undefined : text(body.label, 240),
          snapshotDate: a5mCDate(body.snapshotDate),
          status: forcedStatus || (body.status === undefined ? undefined : text(body.status, 80)),
          totalAuthorisedShares: body.totalAuthorisedShares === undefined ? undefined : decimalText(body.totalAuthorisedShares),
          totalIssuedShares: body.totalIssuedShares === undefined ? undefined : decimalText(body.totalIssuedShares),
          totalAllocatedShares: body.totalAllocatedShares === undefined ? undefined : decimalText(body.totalAllocatedShares),
          totalUnallocatedShares: body.totalUnallocatedShares === undefined ? undefined : decimalText(body.totalUnallocatedShares),
          fullyDilutedShares: body.fullyDilutedShares === undefined ? undefined : decimalText(body.fullyDilutedShares),
          ordinarySharePercent: body.ordinarySharePercent === undefined ? undefined : decimalText(body.ordinarySharePercent),
          preferenceSharePercent: body.preferenceSharePercent === undefined ? undefined : decimalText(body.preferenceSharePercent),
          optionPoolPercent: body.optionPoolPercent === undefined ? undefined : decimalText(body.optionPoolPercent),
          snapshotMeta: body.snapshotMeta === undefined && body.meta === undefined ? undefined : asObject(body.snapshotMeta || body.meta),
          publishedToShareholders:
            action === 'archive_snapshot' || action === 'void_snapshot'
              ? false
              : a5mCBoolean(body.publishedToShareholders),
          approvedByUserId: body.approvedByUserId === undefined ? undefined : text(body.approvedByUserId, 180) || null,
          approvedAt: body.approvedAt === undefined ? undefined : body.approvedAt ? new Date(body.approvedAt) : null,
        }),
      });

      const auditAction =
        action === 'archive_snapshot' ? 'cap_table_snapshot_archived' :
        action === 'void_snapshot' ? 'cap_table_snapshot_voided' :
        'cap_table_snapshot_updated';

      await a5mCAudit(auditAction, req, 'CapTableSnapshot', item.id, idempotencyKey);
      return json({ ok: true, envelope: access.envelope, item });
    }

    if (action === 'update_valuation' || action === 'archive_valuation' || action === 'void_valuation') {
      const id = text(body.id || body.valuationId, 180);
      if (!id) return json({ ok: false, envelope: access.envelope, error: 'valuation_id_required' });

      const forcedStatus =
        action === 'archive_valuation' ? 'archived' :
        action === 'void_valuation' ? 'voided' :
        undefined;

      const item = await db.companyValuationSnapshot.update({
        where: { id },
        data: a5mCDefined({
          label: body.label === undefined ? undefined : text(body.label, 240),
          valuationDate: a5mCDate(body.valuationDate),
          valuationType: body.valuationType === undefined ? undefined : text(body.valuationType, 80),
          status: forcedStatus || (body.status === undefined ? undefined : text(body.status, 80)),
          preMoneyValuationCents: body.preMoneyValuationCents === undefined ? undefined : asCents(body.preMoneyValuationCents),
          postMoneyValuationCents: body.postMoneyValuationCents === undefined ? undefined : asCents(body.postMoneyValuationCents),
          enterpriseValueCents: body.enterpriseValueCents === undefined ? undefined : asCents(body.enterpriseValueCents),
          currency: body.currency === undefined ? undefined : text(body.currency || 'ZAR', 3).toUpperCase(),
          methodology: body.methodology === undefined ? undefined : text(body.methodology, 1000) || null,
          notes: body.notes === undefined ? undefined : text(body.notes, 1000) || null,
          valuationMeta: body.valuationMeta === undefined && body.meta === undefined ? undefined : asObject(body.valuationMeta || body.meta),
          publishedToShareholders:
            action === 'archive_valuation' || action === 'void_valuation'
              ? false
              : a5mCBoolean(body.publishedToShareholders),
          approvedByUserId: body.approvedByUserId === undefined ? undefined : text(body.approvedByUserId, 180) || null,
          approvedAt: body.approvedAt === undefined ? undefined : body.approvedAt ? new Date(body.approvedAt) : null,
        }),
      });

      const auditAction =
        action === 'archive_valuation' ? 'company_valuation_snapshot_archived' :
        action === 'void_valuation' ? 'company_valuation_snapshot_voided' :
        'company_valuation_snapshot_updated';

      await a5mCAudit(auditAction, req, 'CompanyValuationSnapshot', item.id, idempotencyKey);
      return json({ ok: true, envelope: access.envelope, item });
    }

    if (action === 'update_share_sale_notice' || action === 'archive_share_sale_notice' || action === 'void_share_sale_notice') {
      const id = text(body.id || body.noticeId || body.shareSaleNoticeId, 180);
      if (!id) return json({ ok: false, envelope: access.envelope, error: 'share_sale_notice_id_required' });

      const forcedStatus =
        action === 'archive_share_sale_notice' ? 'archived' :
        action === 'void_share_sale_notice' ? 'voided' :
        undefined;

      const item = await db.shareSaleNotice.update({
        where: { id },
        data: a5mCDefined({
          title: body.title === undefined ? undefined : text(body.title, 240),
          shareClassId: body.shareClassId === undefined ? undefined : text(body.shareClassId, 180) || null,
          sellerShareholderId: body.sellerShareholderId === undefined ? undefined : text(body.sellerShareholderId, 180) || null,
          sharesAvailable: body.sharesAvailable === undefined ? undefined : decimalText(body.sharesAvailable),
          askingPricePerShareCents: body.askingPricePerShareCents === undefined ? undefined : asCents(body.askingPricePerShareCents),
          currency: body.currency === undefined ? undefined : text(body.currency || 'ZAR', 3).toUpperCase(),
          status: forcedStatus || (body.status === undefined ? undefined : text(body.status, 80)),
          saleTerms: body.saleTerms === undefined ? undefined : text(body.saleTerms, 2000) || null,
          restrictionNotes: body.restrictionNotes === undefined ? undefined : text(body.restrictionNotes, 2000) || null,
          visibleToShareholders:
            action === 'archive_share_sale_notice' || action === 'void_share_sale_notice'
              ? false
              : a5mCBoolean(body.visibleToShareholders),
          opensAt: body.opensAt === undefined ? undefined : body.opensAt ? new Date(body.opensAt) : null,
          closesAt: body.closesAt === undefined ? undefined : body.closesAt ? new Date(body.closesAt) : null,
          approvedByUserId: body.approvedByUserId === undefined ? undefined : text(body.approvedByUserId, 180) || null,
          approvedAt: body.approvedAt === undefined ? undefined : body.approvedAt ? new Date(body.approvedAt) : null,
          publishedAt: body.publishedAt === undefined ? undefined : body.publishedAt ? new Date(body.publishedAt) : null,
          meta: body.meta === undefined ? undefined : asObject(body.meta),
        }),
      });

      const auditAction =
        action === 'archive_share_sale_notice' ? 'share_sale_notice_archived' :
        action === 'void_share_sale_notice' ? 'share_sale_notice_voided' :
        'share_sale_notice_updated';

      await a5mCAudit(auditAction, req, 'ShareSaleNotice', item.id, idempotencyKey);
      return json({ ok: true, envelope: access.envelope, item });
    }

    if (action === 'update_share_class' || action === 'archive_share_class') {
      const id = text(body.id || body.shareClassId, 180);
      if (!id) return json({ ok: false, envelope: access.envelope, error: 'share_class_id_required' });

      const item = await db.shareClass.update({
        where: { id },
        data: a5mCDefined({
          code: body.code === undefined ? undefined : text(body.code, 80),
          name: body.name === undefined ? undefined : text(body.name, 240),
          description: body.description === undefined ? undefined : text(body.description, 1000) || null,
          authorisedShares: body.authorisedShares === undefined ? undefined : decimalText(body.authorisedShares),
          issuedShares: body.issuedShares === undefined ? undefined : decimalText(body.issuedShares),
          allocatedShares: body.allocatedShares === undefined ? undefined : decimalText(body.allocatedShares),
          unallocatedShares: body.unallocatedShares === undefined ? undefined : decimalText(body.unallocatedShares),
          votingRights: body.votingRights === undefined ? undefined : text(body.votingRights, 120),
          votesPerShare: body.votesPerShare === undefined ? undefined : decimalText(body.votesPerShare, '1'),
          dividendRights: body.dividendRights === undefined ? undefined : text(body.dividendRights, 1000) || null,
          liquidationPreference: body.liquidationPreference === undefined ? undefined : text(body.liquidationPreference, 1000) || null,
          transferRestrictions: body.transferRestrictions === undefined ? undefined : text(body.transferRestrictions, 1000) || null,
          conversionRights: body.conversionRights === undefined ? undefined : text(body.conversionRights, 1000) || null,
          antiDilutionRights: body.antiDilutionRights === undefined ? undefined : text(body.antiDilutionRights, 1000) || null,
          active: action === 'archive_share_class' ? false : a5mCBoolean(body.active),
          termsMeta: body.termsMeta === undefined && body.meta === undefined ? undefined : asObject(body.termsMeta || body.meta),
          approvedByUserId: body.approvedByUserId === undefined ? undefined : text(body.approvedByUserId, 180) || null,
          approvedAt: body.approvedAt === undefined ? undefined : body.approvedAt ? new Date(body.approvedAt) : null,
        }),
      });

      const auditAction = action === 'archive_share_class' ? 'share_class_archived' : 'share_class_updated';

      await a5mCAudit(auditAction, req, 'ShareClass', item.id, idempotencyKey);
      return json({ ok: true, envelope: access.envelope, item });
    }

    return json({ ok: false, envelope: access.envelope, error: 'unsupported_cap_table_patch_action', action });
  } catch (error: any) {
    return routeError(error, 'enterprise_finance_cap_table_patch_failed');
  }
}

