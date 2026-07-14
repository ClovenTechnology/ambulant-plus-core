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

// A5_M_E_ENTERPRISE_FINANCE_SHAREHOLDER_DOCUMENTS_ROUTE

function a5mEDefined(data: Record<string, any>) {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
}

function a5mEBoolean(value: any) {
  return value === undefined ? undefined : Boolean(value);
}

function a5mEDate(value: any) {
  return value ? new Date(value) : undefined;
}

function a5mEIdempotencyKey(req: NextRequest) {
  return text(req.headers.get('Idempotency-Key'), 180) || null;
}

async function a5mEAudit(action: string, req: NextRequest, model: string, subjectId: string, extra: Record<string, any> = {}) {
  await auditEnterpriseFinance(action, req, {
    model,
    subjectId,
    idempotencyKey: a5mEIdempotencyKey(req),
    mutationSurface: 'enterprise_finance_shareholder_documents',
    ...extra,
  });
}

function a5mECsvValue(value: any) {
  const str =
    value === null || value === undefined
      ? ''
      : typeof value === 'object'
        ? JSON.stringify(value)
        : String(value);

  return `"${str.replace(/"/g, '""')}"`;
}

function a5mECsv(rows: Record<string, any>[]) {
  const headers = [
    'kind',
    'id',
    'title',
    'financialYear',
    'documentType',
    'status',
    'visibleToShareholders',
    'downloadable',
    'shareholderId',
    'annualReturnId',
    'fileUrl',
    'documentUrl',
    'publishedAt',
    'approvedAt',
    'createdAt',
    'updatedAt',
  ];

  const lines = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => a5mECsvValue(row[header])).join(',')),
  ];

  return lines.join('\n');
}

export async function GET(req: NextRequest) {
  try {
    const access = await requireEnterpriseFinanceAdmin(req);
    if (!access.ok) return access.response;

    const db: any = prisma;
    const { searchParams } = new URL(req.url);

    const resource = text(searchParams.get('resource') || searchParams.get('type') || 'all', 80);
    const format = text(searchParams.get('format') || searchParams.get('export'), 40);
    const status = text(searchParams.get('status'), 80);
    const shareholderId = text(searchParams.get('shareholderId'), 180);
    const annualReturnId = text(searchParams.get('annualReturnId'), 180);
    const documentType = text(searchParams.get('documentType'), 100);
    const visibleOnly = searchParams.get('visibleToShareholders') === 'true';

    const annualReturnWhere: any = {};
    const documentWhere: any = {};
    const announcementWhere: any = {};

    if (status) {
      annualReturnWhere.status = status;
      documentWhere.status = status;
      announcementWhere.status = status;
    }

    if (visibleOnly) {
      annualReturnWhere.visibleToShareholders = true;
      documentWhere.visibleToShareholders = true;
      announcementWhere.visibleToShareholders = true;
    }

    if (shareholderId) documentWhere.shareholderId = shareholderId;
    if (annualReturnId) documentWhere.annualReturnId = annualReturnId;
    if (documentType) documentWhere.documentType = documentType;

    const includeAnnualReturns = resource === 'all' || resource === 'annual_returns' || resource === 'annual-return' || resource === 'annualReturn';
    const includeDocuments = resource === 'all' || resource === 'documents' || resource === 'shareholder_documents' || resource === 'shareholder-document';
    const includeAnnouncements = resource === 'all' || resource === 'announcements' || resource === 'shareholder_announcements' || resource === 'shareholder-announcement';

    const annualReturns = includeAnnualReturns
      ? await db.annualReturn.findMany({
          where: annualReturnWhere,
          orderBy: [{ createdAt: 'desc' }],
          take: 500,
        })
      : [];

    const documents = includeDocuments
      ? await db.shareholderDocument.findMany({
          where: documentWhere,
          orderBy: [{ createdAt: 'desc' }],
          take: 500,
        })
      : [];

    const announcements = includeAnnouncements
      ? await db.shareholderAnnouncement.findMany({
          where: announcementWhere,
          orderBy: [{ createdAt: 'desc' }],
          take: 500,
        })
      : [];

    if (format === 'csv') {
      const rows = [
        ...annualReturns.map((item: any) => ({
          kind: 'annual_return',
          id: item.id,
          title: item.financialYear,
          financialYear: item.financialYear,
          documentType: 'annual_return',
          status: item.status,
          visibleToShareholders: item.visibleToShareholders,
          downloadable: '',
          shareholderId: '',
          annualReturnId: item.id,
          fileUrl: '',
          documentUrl: item.documentUrl,
          publishedAt: item.filedAt,
          approvedAt: item.approvedAt,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        })),
        ...documents.map((item: any) => ({
          kind: 'shareholder_document',
          id: item.id,
          title: item.title,
          financialYear: '',
          documentType: item.documentType,
          status: item.status,
          visibleToShareholders: item.visibleToShareholders,
          downloadable: item.downloadable,
          shareholderId: item.shareholderId,
          annualReturnId: item.annualReturnId,
          fileUrl: item.fileUrl,
          documentUrl: item.fileUrl || item.objectKey,
          publishedAt: item.publishedAt,
          approvedAt: item.approvedAt,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        })),
        ...announcements.map((item: any) => ({
          kind: 'shareholder_announcement',
          id: item.id,
          title: item.title,
          financialYear: '',
          documentType: item.announcementType,
          status: item.status,
          visibleToShareholders: item.visibleToShareholders,
          downloadable: '',
          shareholderId: '',
          annualReturnId: '',
          fileUrl: '',
          documentUrl: '',
          publishedAt: item.publishedAt,
          approvedAt: item.approvedAt,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        })),
      ];

      return new Response(a5mECsv(rows), {
        status: 200,
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': 'attachment; filename="enterprise-finance-shareholder-documents.csv"',
          'cache-control': 'no-store',
        },
      });
    }

    return json({
      ok: true,
      envelope: access.envelope,
      annualReturns,
      documents,
      announcements,
      meta: {
        resource,
        format: format || 'json',
        canViewAnnualReturns: true,
        canDownloadDocuments: true,
        count: annualReturns.length + documents.length + announcements.length,
      },
    });
  } catch (error: any) {
    return routeError(error, 'enterprise_finance_shareholder_documents_list_failed');
  }
}

export async function POST(req: NextRequest) {
  try {
    const access = await requireEnterpriseFinanceAdmin(req);
    if (!access.ok) return access.response;

    const db: any = prisma;
    const body = await req.json().catch(() => ({}));
    const action = text(body.action, 120);

    if (!action) {
      return json({ ok: false, envelope: access.envelope, error: 'action_required' }, 400);
    }

    if (action === 'create_annual_return') {
      const item = await db.annualReturn.create({
        data: {
          financialYear: text(body.financialYear, 80) || String(new Date().getFullYear()),
          status: text(body.status || 'draft', 80),
          preparedByUserId: text(body.preparedByUserId, 180) || access.envelope.actor.userId,
          approvedByUserId: text(body.approvedByUserId, 180) || null,
          approvedAt: body.approvedAt ? new Date(body.approvedAt) : null,
          filedAt: body.filedAt ? new Date(body.filedAt) : null,
          reportSnapshotId: text(body.reportSnapshotId, 180) || null,
          documentUrl: text(body.documentUrl, 1000) || null,
          annualReturnMeta: asObject(body.annualReturnMeta || body.meta),
          visibleToShareholders: Boolean(body.visibleToShareholders),
        },
      });

      await a5mEAudit('annual_return_created', req, 'AnnualReturn', item.id);
      return json({ ok: true, envelope: access.envelope, item });
    }

    if (action === 'create_shareholder_document') {
      const item = await db.shareholderDocument.create({
        data: {
          title: text(body.title, 240) || 'Shareholder document',
          documentType: text(body.documentType || 'general', 100),
          objectKey: text(body.objectKey, 1000) || null,
          fileUrl: text(body.fileUrl, 1000) || null,
          status: text(body.status || 'draft', 80),
          shareholderId: text(body.shareholderId, 180) || null,
          investmentRoundId: text(body.investmentRoundId, 180) || null,
          annualReturnId: text(body.annualReturnId, 180) || null,
          boardResolutionId: text(body.boardResolutionId, 180) || null,
          visibleToShareholders: Boolean(body.visibleToShareholders),
          downloadable: body.downloadable === undefined ? true : Boolean(body.downloadable),
          documentMeta: asObject(body.documentMeta || body.meta),
          uploadedByUserId: access.envelope.actor.userId,
          approvedByUserId: text(body.approvedByUserId, 180) || null,
          approvedAt: body.approvedAt ? new Date(body.approvedAt) : null,
          publishedAt: body.publishedAt ? new Date(body.publishedAt) : null,
        },
      });

      await a5mEAudit('shareholder_document_created', req, 'ShareholderDocument', item.id, {
        shareholderId: item.shareholderId,
        annualReturnId: item.annualReturnId,
      });

      return json({ ok: true, envelope: access.envelope, item });
    }

    if (action === 'create_shareholder_announcement') {
      const item = await db.shareholderAnnouncement.create({
        data: {
          title: text(body.title, 240) || 'Shareholder announcement',
          body: text(body.body, 8000),
          announcementType: text(body.announcementType || 'general', 100),
          status: text(body.status || 'draft', 80),
          visibleToShareholders: Boolean(body.visibleToShareholders),
          visibleFrom: body.visibleFrom ? new Date(body.visibleFrom) : null,
          expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
          createdByUserId: access.envelope.actor.userId,
          approvedByUserId: text(body.approvedByUserId, 180) || null,
          approvedAt: body.approvedAt ? new Date(body.approvedAt) : null,
          publishedAt: body.publishedAt ? new Date(body.publishedAt) : null,
          meta: asObject(body.meta),
        },
      });

      await a5mEAudit('shareholder_announcement_created', req, 'ShareholderAnnouncement', item.id);
      return json({ ok: true, envelope: access.envelope, item });
    }

    return json({ ok: false, envelope: access.envelope, error: 'unsupported_shareholder_document_post_action', action }, 400);
  } catch (error: any) {
    return routeError(error, 'enterprise_finance_shareholder_documents_create_failed');
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const access = await requireEnterpriseFinanceAdmin(req);
    if (!access.ok) return access.response;

    const db: any = prisma;
    const body = await req.json().catch(() => ({}));
    const action = text(body.action, 120);

    if (!action) {
      return json({ ok: false, envelope: access.envelope, error: 'action_required' }, 400);
    }

    if (
      action === 'update_annual_return' ||
      action === 'publish_annual_return' ||
      action === 'unpublish_annual_return' ||
      action === 'archive_annual_return' ||
      action === 'void_annual_return'
    ) {
      const id = text(body.id || body.annualReturnId, 180);
      if (!id) return json({ ok: false, envelope: access.envelope, error: 'annual_return_id_required' }, 400);

      const forcedStatus =
        action === 'publish_annual_return' ? 'published' :
        action === 'archive_annual_return' ? 'archived' :
        action === 'void_annual_return' ? 'voided' :
        undefined;

      const item = await db.annualReturn.update({
        where: { id },
        data: a5mEDefined({
          financialYear: body.financialYear === undefined ? undefined : text(body.financialYear, 80),
          status: forcedStatus || (body.status === undefined ? undefined : text(body.status, 80)),
          preparedByUserId: body.preparedByUserId === undefined ? undefined : text(body.preparedByUserId, 180) || null,
          approvedByUserId: body.approvedByUserId === undefined ? undefined : text(body.approvedByUserId, 180) || null,
          approvedAt: body.approvedAt === undefined ? undefined : a5mEDate(body.approvedAt),
          filedAt:
            action === 'publish_annual_return'
              ? new Date()
              : body.filedAt === undefined
                ? undefined
                : body.filedAt
                  ? new Date(body.filedAt)
                  : null,
          reportSnapshotId: body.reportSnapshotId === undefined ? undefined : text(body.reportSnapshotId, 180) || null,
          documentUrl: body.documentUrl === undefined ? undefined : text(body.documentUrl, 1000) || null,
          annualReturnMeta: body.annualReturnMeta === undefined && body.meta === undefined ? undefined : asObject(body.annualReturnMeta || body.meta),
          visibleToShareholders:
            action === 'publish_annual_return'
              ? true
              : action === 'unpublish_annual_return' || action === 'archive_annual_return' || action === 'void_annual_return'
                ? false
                : a5mEBoolean(body.visibleToShareholders),
        }),
      });

      const auditAction =
        action === 'publish_annual_return' ? 'annual_return_published' :
        action === 'unpublish_annual_return' ? 'annual_return_unpublished' :
        action === 'archive_annual_return' ? 'annual_return_archived' :
        action === 'void_annual_return' ? 'annual_return_voided' :
        'annual_return_updated';

      await a5mEAudit(auditAction, req, 'AnnualReturn', item.id);
      return json({ ok: true, envelope: access.envelope, item });
    }

    if (
      action === 'update_shareholder_document' ||
      action === 'publish_shareholder_document' ||
      action === 'unpublish_shareholder_document' ||
      action === 'archive_shareholder_document' ||
      action === 'void_shareholder_document'
    ) {
      const id = text(body.id || body.documentId || body.shareholderDocumentId, 180);
      if (!id) return json({ ok: false, envelope: access.envelope, error: 'shareholder_document_id_required' }, 400);

      const forcedStatus =
        action === 'publish_shareholder_document' ? 'published' :
        action === 'archive_shareholder_document' ? 'archived' :
        action === 'void_shareholder_document' ? 'voided' :
        undefined;

      const item = await db.shareholderDocument.update({
        where: { id },
        data: a5mEDefined({
          title: body.title === undefined ? undefined : text(body.title, 240),
          documentType: body.documentType === undefined ? undefined : text(body.documentType, 100),
          objectKey: body.objectKey === undefined ? undefined : text(body.objectKey, 1000) || null,
          fileUrl: body.fileUrl === undefined ? undefined : text(body.fileUrl, 1000) || null,
          status: forcedStatus || (body.status === undefined ? undefined : text(body.status, 80)),
          shareholderId: body.shareholderId === undefined ? undefined : text(body.shareholderId, 180) || null,
          investmentRoundId: body.investmentRoundId === undefined ? undefined : text(body.investmentRoundId, 180) || null,
          annualReturnId: body.annualReturnId === undefined ? undefined : text(body.annualReturnId, 180) || null,
          boardResolutionId: body.boardResolutionId === undefined ? undefined : text(body.boardResolutionId, 180) || null,
          visibleToShareholders:
            action === 'publish_shareholder_document'
              ? true
              : action === 'unpublish_shareholder_document' || action === 'archive_shareholder_document' || action === 'void_shareholder_document'
                ? false
                : a5mEBoolean(body.visibleToShareholders),
          downloadable:
            action === 'archive_shareholder_document' || action === 'void_shareholder_document'
              ? false
              : a5mEBoolean(body.downloadable),
          documentMeta: body.documentMeta === undefined && body.meta === undefined ? undefined : asObject(body.documentMeta || body.meta),
          approvedByUserId: body.approvedByUserId === undefined ? undefined : text(body.approvedByUserId, 180) || null,
          approvedAt: body.approvedAt === undefined ? undefined : a5mEDate(body.approvedAt),
          publishedAt:
            action === 'publish_shareholder_document'
              ? new Date()
              : body.publishedAt === undefined
                ? undefined
                : body.publishedAt
                  ? new Date(body.publishedAt)
                  : null,
        }),
      });

      const auditAction =
        action === 'publish_shareholder_document' ? 'shareholder_document_published' :
        action === 'unpublish_shareholder_document' ? 'shareholder_document_unpublished' :
        action === 'archive_shareholder_document' ? 'shareholder_document_archived' :
        action === 'void_shareholder_document' ? 'shareholder_document_voided' :
        'shareholder_document_updated';

      await a5mEAudit(auditAction, req, 'ShareholderDocument', item.id, {
        shareholderId: item.shareholderId,
        annualReturnId: item.annualReturnId,
      });

      return json({ ok: true, envelope: access.envelope, item });
    }

    if (
      action === 'update_shareholder_announcement' ||
      action === 'publish_shareholder_announcement' ||
      action === 'unpublish_shareholder_announcement' ||
      action === 'archive_shareholder_announcement' ||
      action === 'void_shareholder_announcement'
    ) {
      const id = text(body.id || body.announcementId || body.shareholderAnnouncementId, 180);
      if (!id) return json({ ok: false, envelope: access.envelope, error: 'shareholder_announcement_id_required' }, 400);

      const forcedStatus =
        action === 'publish_shareholder_announcement' ? 'published' :
        action === 'archive_shareholder_announcement' ? 'archived' :
        action === 'void_shareholder_announcement' ? 'voided' :
        undefined;

      const item = await db.shareholderAnnouncement.update({
        where: { id },
        data: a5mEDefined({
          title: body.title === undefined ? undefined : text(body.title, 240),
          body: body.body === undefined ? undefined : text(body.body, 8000),
          announcementType: body.announcementType === undefined ? undefined : text(body.announcementType, 100),
          status: forcedStatus || (body.status === undefined ? undefined : text(body.status, 80)),
          visibleToShareholders:
            action === 'publish_shareholder_announcement'
              ? true
              : action === 'unpublish_shareholder_announcement' || action === 'archive_shareholder_announcement' || action === 'void_shareholder_announcement'
                ? false
                : a5mEBoolean(body.visibleToShareholders),
          visibleFrom: body.visibleFrom === undefined ? undefined : body.visibleFrom ? new Date(body.visibleFrom) : null,
          expiresAt: body.expiresAt === undefined ? undefined : body.expiresAt ? new Date(body.expiresAt) : null,
          approvedByUserId: body.approvedByUserId === undefined ? undefined : text(body.approvedByUserId, 180) || null,
          approvedAt: body.approvedAt === undefined ? undefined : a5mEDate(body.approvedAt),
          publishedAt:
            action === 'publish_shareholder_announcement'
              ? new Date()
              : body.publishedAt === undefined
                ? undefined
                : body.publishedAt
                  ? new Date(body.publishedAt)
                  : null,
          meta: body.meta === undefined ? undefined : asObject(body.meta),
        }),
      });

      const auditAction =
        action === 'publish_shareholder_announcement' ? 'shareholder_announcement_published' :
        action === 'unpublish_shareholder_announcement' ? 'shareholder_announcement_unpublished' :
        action === 'archive_shareholder_announcement' ? 'shareholder_announcement_archived' :
        action === 'void_shareholder_announcement' ? 'shareholder_announcement_voided' :
        'shareholder_announcement_updated';

      await a5mEAudit(auditAction, req, 'ShareholderAnnouncement', item.id);
      return json({ ok: true, envelope: access.envelope, item });
    }

    return json({ ok: false, envelope: access.envelope, error: 'unsupported_shareholder_document_patch_action', action }, 400);
  } catch (error: any) {
    return routeError(error, 'enterprise_finance_shareholder_documents_patch_failed');
  }
}

