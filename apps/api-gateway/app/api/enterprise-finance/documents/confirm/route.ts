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
  managedEnterpriseFinanceDocumentRef,
  verifyEnterpriseFinanceDocumentUpload,
} from '@/src/lib/enterprise-finance-document-storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const access = await requireEnterpriseFinanceAdmin(req);
    if (!access.ok) return access.response;
    const body = await req.json().catch(() => ({}));
    const objectKey = text(body.objectKey, 700);
    const purpose = text(body.purpose, 80);
    const contentType = text(body.contentType, 160)?.toLowerCase();
    const sizeBytes = Number(body.sizeBytes);
    const checksumSha256 = text(body.checksumSha256, 64)?.toLowerCase();
    if (!objectKey || !purpose || !contentType || !Number.isInteger(sizeBytes) || !checksumSha256) {
      return json({ ok: false, envelope: access.envelope, error: 'finance_document_confirmation_invalid' }, 400);
    }
    const expectedPrefix = `enterprise-finance-documents/${purpose}/`;
    if (!objectKey.startsWith(expectedPrefix)) {
      return json({ ok: false, envelope: access.envelope, error: 'finance_document_object_scope_invalid' }, 403);
    }
    await verifyEnterpriseFinanceDocumentUpload({ objectKey, contentType, sizeBytes, checksumSha256 });
    const managedRef = managedEnterpriseFinanceDocumentRef(objectKey);
    await auditEnterpriseFinance('finance_document_upload_confirmed', req, {
      model: 'FinanceDocument', subjectId: objectKey, purpose, contentType, sizeBytes,
      mutationSurface: 'enterprise_finance_documents',
    });
    return json({ ok: true, envelope: access.envelope, objectKey, managedRef });
  } catch (error) {
    const storage = enterpriseFinanceDocumentErrorResponse(error);
    if (storage) return json(storage.body, storage.status);
    return routeError(error, 'enterprise_finance_document_confirm_failed');
  }
}
