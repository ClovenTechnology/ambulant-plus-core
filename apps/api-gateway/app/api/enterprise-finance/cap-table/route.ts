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

    // A5_M_D_ENTERPRISE_FINANCE_INVESTMENT_ALLOCATION_TRANSFER_POST_ACTIONS
    if (action === 'create_investment_round') {
      const item = await db.investmentRound.create({
        data: {
          name: text(body.name, 240) || 'Investment round',
          roundType: text(body.roundType || 'seed', 80),
          status: text(body.status || 'draft', 80),
          openedAt: body.openedAt ? new Date(body.openedAt) : null,
          closedAt: body.closedAt ? new Date(body.closedAt) : null,
          currency: text(body.currency || 'ZAR', 3).toUpperCase(),
          targetRaiseCents: asCents(body.targetRaiseCents),
          committedAmountCents: asCents(body.committedAmountCents),
          receivedAmountCents: asCents(body.receivedAmountCents),
          preMoneyValuationCents: asCents(body.preMoneyValuationCents),
          postMoneyValuationCents: asCents(body.postMoneyValuationCents),
          instrumentType: text(body.instrumentType || 'equity', 80),
          shareClassId: text(body.shareClassId, 180) || null,
          pricePerShareCents: asCents(body.pricePerShareCents),
          termsMeta: asObject(body.termsMeta || body.meta),
          createdByUserId: access.envelope.actor.userId,
          approvedByUserId: text(body.approvedByUserId, 180) || null,
          approvedAt: body.approvedAt ? new Date(body.approvedAt) : null,
        },
      });

      await auditEnterpriseFinance('investment_round_created', req, {
        model: 'InvestmentRound',
        subjectId: item.id,
        idempotencyKey: text(req.headers.get('Idempotency-Key'), 180) || null,
        mutationSurface: 'enterprise_finance_cap_table_post',
      });

      return json({ ok: true, envelope: access.envelope, item });
    }

    if (action === 'create_shareholding' || action === 'create_share_allocation') {
      const item = await db.shareholding.create({
        data: {
          shareholderId: text(body.shareholderId, 180),
          shareClassId: text(body.shareClassId, 180),
          sharesHeld: decimalText(body.sharesHeld),
          allocatedShares: decimalText(body.allocatedShares),
          vestedShares: decimalText(body.vestedShares),
          unvestedShares: decimalText(body.unvestedShares),
          ownershipPercent: body.ownershipPercent === undefined ? null : decimalText(body.ownershipPercent),
          fullyDilutedPercent: body.fullyDilutedPercent === undefined ? null : decimalText(body.fullyDilutedPercent),
          votingPercent: body.votingPercent === undefined ? null : decimalText(body.votingPercent),
          status: text(body.status || 'active', 80),
          asOfDate: body.asOfDate ? new Date(body.asOfDate) : new Date(),
          meta: asObject(body.meta),
        },
      });

      await auditEnterpriseFinance('shareholding_created', req, {
        model: 'Shareholding',
        subjectId: item.id,
        idempotencyKey: text(req.headers.get('Idempotency-Key'), 180) || null,
        mutationSurface: 'enterprise_finance_cap_table_post',
      });

      return json({ ok: true, envelope: access.envelope, item });
    }

    if (action === 'create_capital_contribution') {
      const item = await db.capitalContribution.create({
        data: {
          shareholderId: text(body.shareholderId, 180) || null,
          investorName: text(body.investorName, 240) || null,
          investmentRoundId: text(body.investmentRoundId, 180) || null,
          contributionType: text(body.contributionType || 'investment', 100),
          status: text(body.status || 'pending', 80),
          amountCents: asCents(body.amountCents),
          currency: text(body.currency || 'ZAR', 3).toUpperCase(),
          receivedAt: body.receivedAt ? new Date(body.receivedAt) : null,
          paymentMethod: text(body.paymentMethod, 80) || null,
          externalReference: text(body.externalReference, 240) || null,
          revenueLedgerEntryId: text(body.revenueLedgerEntryId, 180) || null,
          sharesIssued: body.sharesIssued === undefined ? null : decimalText(body.sharesIssued),
          shareClassId: text(body.shareClassId, 180) || null,
          pricePerShareCents: body.pricePerShareCents === undefined ? null : asCents(body.pricePerShareCents),
          description: text(body.description, 2000) || null,
          documentUrl: text(body.documentUrl, 1000) || null,
          meta: asObject(body.meta),
          createdByUserId: access.envelope.actor.userId,
          approvedByUserId: text(body.approvedByUserId, 180) || null,
          approvedAt: body.approvedAt ? new Date(body.approvedAt) : null,
        },
      });

      await auditEnterpriseFinance('capital_contribution_created', req, {
        model: 'CapitalContribution',
        subjectId: item.id,
        idempotencyKey: text(req.headers.get('Idempotency-Key'), 180) || null,
        mutationSurface: 'enterprise_finance_cap_table_post',
      });

      return json({ ok: true, envelope: access.envelope, item });
    }

    if (action === 'create_share_transfer') {
      const item = await db.shareTransfer.create({
        data: {
          fromShareholderId: text(body.fromShareholderId, 180) || null,
          toShareholderId: text(body.toShareholderId, 180),
          shareClassId: text(body.shareClassId, 180),
          sharesTransferred: decimalText(body.sharesTransferred),
          considerationCents: asCents(body.considerationCents),
          currency: text(body.currency || 'ZAR', 3).toUpperCase(),
          transferType: text(body.transferType || 'secondary_sale', 100),
          status: text(body.status || 'draft', 80),
          transferRestrictionCleared: Boolean(body.transferRestrictionCleared),
          effectiveAt: body.effectiveAt ? new Date(body.effectiveAt) : null,
          approvedByUserId: text(body.approvedByUserId, 180) || null,
          approvedAt: body.approvedAt ? new Date(body.approvedAt) : null,
          documentUrl: text(body.documentUrl, 1000) || null,
          meta: asObject(body.meta),
        },
      });

      await auditEnterpriseFinance('share_transfer_created', req, {
        model: 'ShareTransfer',
        subjectId: item.id,
        idempotencyKey: text(req.headers.get('Idempotency-Key'), 180) || null,
        mutationSurface: 'enterprise_finance_cap_table_post',
      });

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

    // A5_M_D_ENTERPRISE_FINANCE_INVESTMENT_ALLOCATION_TRANSFER_PATCH_ACTIONS
    if (action === 'update_investment_round' || action === 'archive_investment_round' || action === 'void_investment_round') {
      const id = text(body.id || body.investmentRoundId, 180);
      if (!id) return json({ ok: false, envelope: access.envelope, error: 'investment_round_id_required' });

      const forcedStatus =
        action === 'archive_investment_round' ? 'archived' :
        action === 'void_investment_round' ? 'voided' :
        undefined;

      const item = await db.investmentRound.update({
        where: { id },
        data: a5mCDefined({
          name: body.name === undefined ? undefined : text(body.name, 240),
          roundType: body.roundType === undefined ? undefined : text(body.roundType, 80),
          status: forcedStatus || (body.status === undefined ? undefined : text(body.status, 80)),
          openedAt: body.openedAt === undefined ? undefined : body.openedAt ? new Date(body.openedAt) : null,
          closedAt: body.closedAt === undefined ? undefined : body.closedAt ? new Date(body.closedAt) : null,
          currency: body.currency === undefined ? undefined : text(body.currency || 'ZAR', 3).toUpperCase(),
          targetRaiseCents: body.targetRaiseCents === undefined ? undefined : asCents(body.targetRaiseCents),
          committedAmountCents: body.committedAmountCents === undefined ? undefined : asCents(body.committedAmountCents),
          receivedAmountCents: body.receivedAmountCents === undefined ? undefined : asCents(body.receivedAmountCents),
          preMoneyValuationCents: body.preMoneyValuationCents === undefined ? undefined : asCents(body.preMoneyValuationCents),
          postMoneyValuationCents: body.postMoneyValuationCents === undefined ? undefined : asCents(body.postMoneyValuationCents),
          instrumentType: body.instrumentType === undefined ? undefined : text(body.instrumentType, 80),
          shareClassId: body.shareClassId === undefined ? undefined : text(body.shareClassId, 180) || null,
          pricePerShareCents: body.pricePerShareCents === undefined ? undefined : asCents(body.pricePerShareCents),
          termsMeta: body.termsMeta === undefined && body.meta === undefined ? undefined : asObject(body.termsMeta || body.meta),
          approvedByUserId: body.approvedByUserId === undefined ? undefined : text(body.approvedByUserId, 180) || null,
          approvedAt: body.approvedAt === undefined ? undefined : body.approvedAt ? new Date(body.approvedAt) : null,
        }),
      });

      const auditAction =
        action === 'archive_investment_round' ? 'investment_round_archived' :
        action === 'void_investment_round' ? 'investment_round_voided' :
        'investment_round_updated';

      await a5mCAudit(auditAction, req, 'InvestmentRound', item.id, idempotencyKey);
      return json({ ok: true, envelope: access.envelope, item });
    }

    if (action === 'update_shareholding' || action === 'update_share_allocation' || action === 'archive_shareholding' || action === 'void_shareholding') {
      const id = text(body.id || body.shareholdingId || body.allocationId, 180);
      if (!id) return json({ ok: false, envelope: access.envelope, error: 'shareholding_id_required' });

      const forcedStatus =
        action === 'archive_shareholding' ? 'archived' :
        action === 'void_shareholding' ? 'voided' :
        undefined;

      const item = await db.shareholding.update({
        where: { id },
        data: a5mCDefined({
          shareholderId: body.shareholderId === undefined ? undefined : text(body.shareholderId, 180),
          shareClassId: body.shareClassId === undefined ? undefined : text(body.shareClassId, 180),
          sharesHeld: body.sharesHeld === undefined ? undefined : decimalText(body.sharesHeld),
          allocatedShares: body.allocatedShares === undefined ? undefined : decimalText(body.allocatedShares),
          vestedShares: body.vestedShares === undefined ? undefined : decimalText(body.vestedShares),
          unvestedShares: body.unvestedShares === undefined ? undefined : decimalText(body.unvestedShares),
          ownershipPercent: body.ownershipPercent === undefined ? undefined : decimalText(body.ownershipPercent),
          fullyDilutedPercent: body.fullyDilutedPercent === undefined ? undefined : decimalText(body.fullyDilutedPercent),
          votingPercent: body.votingPercent === undefined ? undefined : decimalText(body.votingPercent),
          status: forcedStatus || (body.status === undefined ? undefined : text(body.status, 80)),
          asOfDate: body.asOfDate === undefined ? undefined : body.asOfDate ? new Date(body.asOfDate) : null,
          meta: body.meta === undefined ? undefined : asObject(body.meta),
        }),
      });

      const auditAction =
        action === 'archive_shareholding' ? 'shareholding_archived' :
        action === 'void_shareholding' ? 'shareholding_voided' :
        'shareholding_updated';

      await a5mCAudit(auditAction, req, 'Shareholding', item.id, idempotencyKey);
      return json({ ok: true, envelope: access.envelope, item });
    }

    if (action === 'update_capital_contribution' || action === 'archive_capital_contribution' || action === 'void_capital_contribution') {
      const id = text(body.id || body.capitalContributionId, 180);
      if (!id) return json({ ok: false, envelope: access.envelope, error: 'capital_contribution_id_required' });

      const forcedStatus =
        action === 'archive_capital_contribution' ? 'archived' :
        action === 'void_capital_contribution' ? 'voided' :
        undefined;

      const item = await db.capitalContribution.update({
        where: { id },
        data: a5mCDefined({
          shareholderId: body.shareholderId === undefined ? undefined : text(body.shareholderId, 180) || null,
          investorName: body.investorName === undefined ? undefined : text(body.investorName, 240) || null,
          investmentRoundId: body.investmentRoundId === undefined ? undefined : text(body.investmentRoundId, 180) || null,
          contributionType: body.contributionType === undefined ? undefined : text(body.contributionType, 100),
          status: forcedStatus || (body.status === undefined ? undefined : text(body.status, 80)),
          amountCents: body.amountCents === undefined ? undefined : asCents(body.amountCents),
          currency: body.currency === undefined ? undefined : text(body.currency || 'ZAR', 3).toUpperCase(),
          receivedAt: body.receivedAt === undefined ? undefined : body.receivedAt ? new Date(body.receivedAt) : null,
          paymentMethod: body.paymentMethod === undefined ? undefined : text(body.paymentMethod, 80) || null,
          externalReference: body.externalReference === undefined ? undefined : text(body.externalReference, 240) || null,
          revenueLedgerEntryId: body.revenueLedgerEntryId === undefined ? undefined : text(body.revenueLedgerEntryId, 180) || null,
          sharesIssued: body.sharesIssued === undefined ? undefined : decimalText(body.sharesIssued),
          shareClassId: body.shareClassId === undefined ? undefined : text(body.shareClassId, 180) || null,
          pricePerShareCents: body.pricePerShareCents === undefined ? undefined : asCents(body.pricePerShareCents),
          description: body.description === undefined ? undefined : text(body.description, 2000) || null,
          documentUrl: body.documentUrl === undefined ? undefined : text(body.documentUrl, 1000) || null,
          meta: body.meta === undefined ? undefined : asObject(body.meta),
          approvedByUserId: body.approvedByUserId === undefined ? undefined : text(body.approvedByUserId, 180) || null,
          approvedAt: body.approvedAt === undefined ? undefined : body.approvedAt ? new Date(body.approvedAt) : null,
        }),
      });

      const auditAction =
        action === 'archive_capital_contribution' ? 'capital_contribution_archived' :
        action === 'void_capital_contribution' ? 'capital_contribution_voided' :
        'capital_contribution_updated';

      await a5mCAudit(auditAction, req, 'CapitalContribution', item.id, idempotencyKey);
      return json({ ok: true, envelope: access.envelope, item });
    }

    if (action === 'update_share_transfer' || action === 'archive_share_transfer' || action === 'void_share_transfer') {
      const id = text(body.id || body.shareTransferId || body.transferId, 180);
      if (!id) return json({ ok: false, envelope: access.envelope, error: 'share_transfer_id_required' });

      const forcedStatus =
        action === 'archive_share_transfer' ? 'archived' :
        action === 'void_share_transfer' ? 'voided' :
        undefined;

      const item = await db.shareTransfer.update({
        where: { id },
        data: a5mCDefined({
          fromShareholderId: body.fromShareholderId === undefined ? undefined : text(body.fromShareholderId, 180) || null,
          toShareholderId: body.toShareholderId === undefined ? undefined : text(body.toShareholderId, 180),
          shareClassId: body.shareClassId === undefined ? undefined : text(body.shareClassId, 180),
          sharesTransferred: body.sharesTransferred === undefined ? undefined : decimalText(body.sharesTransferred),
          considerationCents: body.considerationCents === undefined ? undefined : asCents(body.considerationCents),
          currency: body.currency === undefined ? undefined : text(body.currency || 'ZAR', 3).toUpperCase(),
          transferType: body.transferType === undefined ? undefined : text(body.transferType, 100),
          status: forcedStatus || (body.status === undefined ? undefined : text(body.status, 80)),
          transferRestrictionCleared: body.transferRestrictionCleared === undefined ? undefined : Boolean(body.transferRestrictionCleared),
          effectiveAt: body.effectiveAt === undefined ? undefined : body.effectiveAt ? new Date(body.effectiveAt) : null,
          approvedByUserId: body.approvedByUserId === undefined ? undefined : text(body.approvedByUserId, 180) || null,
          approvedAt: body.approvedAt === undefined ? undefined : body.approvedAt ? new Date(body.approvedAt) : null,
          documentUrl: body.documentUrl === undefined ? undefined : text(body.documentUrl, 1000) || null,
          meta: body.meta === undefined ? undefined : asObject(body.meta),
        }),
      });

      const auditAction =
        action === 'archive_share_transfer' ? 'share_transfer_archived' :
        action === 'void_share_transfer' ? 'share_transfer_voided' :
        'share_transfer_updated';

      await a5mCAudit(auditAction, req, 'ShareTransfer', item.id, idempotencyKey);
      return json({ ok: true, envelope: access.envelope, item });
    }
    return json({ ok: false, envelope: access.envelope, error: 'unsupported_cap_table_patch_action', action });
  } catch (error: any) {
    return routeError(error, 'enterprise_finance_cap_table_patch_failed');
  }
}


