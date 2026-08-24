import { NextRequest } from 'next/server';
import { json, requireEnterpriseFinanceAdmin, routeError, text } from '@/src/enterprise-finance/access-envelope';
import {
  enterpriseFinanceDocumentErrorResponse,
  objectKeyFromManagedEnterpriseFinanceDocumentRef,
  presignEnterpriseFinanceDocumentView,
} from '@/src/lib/enterprise-finance-document-storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const access = await requireEnterpriseFinanceAdmin(req);
    if (!access.ok) return access.response;
    const body = await req.json().catch(() => ({}));
    const raw = text(body.objectKey || body.managedRef, 1200);
    const objectKey = raw?.startsWith('managed://') ? objectKeyFromManagedEnterpriseFinanceDocumentRef(raw) : raw;
    if (!objectKey || !objectKey.startsWith('enterprise-finance-documents/')) {
      return json({ ok: false, envelope: access.envelope, error: 'finance_document_object_invalid' }, 400);
    }
    const signed = await presignEnterpriseFinanceDocumentView(objectKey);
    return json({ ok: true, envelope: access.envelope, objectKey, ...signed });
  } catch (error) {
    const storage = enterpriseFinanceDocumentErrorResponse(error);
    if (storage) return json(storage.body, storage.status);
    return routeError(error, 'enterprise_finance_document_view_failed');
  }
}
