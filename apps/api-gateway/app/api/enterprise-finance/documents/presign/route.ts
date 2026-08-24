import { NextRequest } from 'next/server';
import {
  auditEnterpriseFinance,
  json,
  requireEnterpriseFinanceAdmin,
  routeError,
  text,
} from '@/src/enterprise-finance/access-envelope';
import {
  enterpriseFinanceDocumentErrorResponse,
  enterpriseFinanceDocumentObjectKey,
  presignEnterpriseFinanceDocumentUpload,
  type EnterpriseFinanceDocumentPurpose,
  validateEnterpriseFinanceDocumentUploadInput,
} from '@/src/lib/enterprise-finance-document-storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PURPOSES = new Set<EnterpriseFinanceDocumentPurpose>([
  'expenditure-invoice', 'expenditure-evidence', 'proof-of-payment', 'vendor-invoice',
  'revenue-evidence', 'shareholder-document', 'annual-return', 'agm-document',
  'board-resolution', 'valuation-document', 'import-document',
]);

export async function POST(req: NextRequest) {
  try {
    const access = await requireEnterpriseFinanceAdmin(req);
    if (!access.ok) return access.response;
    const body = await req.json().catch(() => ({}));
    const purpose = text(body.purpose, 80) as EnterpriseFinanceDocumentPurpose | null;
    if (!purpose || !PURPOSES.has(purpose)) {
      return json({ ok: false, envelope: access.envelope, error: 'finance_document_purpose_invalid' }, 400);
    }
    const actorId = text(access.envelope.actor.userId, 180);
    if (!actorId) {
      return json({ ok: false, envelope: access.envelope, error: 'enterprise_finance_actor_identity_required' }, 403);
    }
    const validated = validateEnterpriseFinanceDocumentUploadInput(body);
    const objectKey = enterpriseFinanceDocumentObjectKey({
      purpose,
      actorId,
    });
    const presigned = await presignEnterpriseFinanceDocumentUpload({
      objectKey,
      contentType: validated.contentType,
      checksumSha256: validated.checksumSha256,
    });
    await auditEnterpriseFinance('finance_document_upload_presigned', req, {
      model: 'FinanceDocument',
      subjectId: objectKey,
      purpose,
      contentType: validated.contentType,
      sizeBytes: validated.sizeBytes,
      mutationSurface: 'enterprise_finance_documents',
    });
    return json({ ok: true, envelope: access.envelope, objectKey, purpose, ...validated, ...presigned });
  } catch (error) {
    const storage = enterpriseFinanceDocumentErrorResponse(error);
    if (storage) return json(storage.body, storage.status);
    return routeError(error, 'enterprise_finance_document_presign_failed');
  }
}
