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
