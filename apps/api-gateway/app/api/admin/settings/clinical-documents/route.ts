import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { readIdentity, requireTrustedIdentityInProduction } from '@/src/lib/identity';
import {
  CLINICAL_DOCUMENT_BRANDING_KEY,
  getClinicalDocumentBranding,
  normalizeClinicalDocumentBranding,
} from '@/src/clinical-documents/branding';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(data: any, status = 200) {
  return NextResponse.json(data, { status, headers: { 'cache-control': 'no-store' } });
}

function adminIdentity(req: NextRequest) {
  const who = readIdentity(req.headers);
  try { requireTrustedIdentityInProduction(req.headers, who); } catch { return null; }
  return who?.uid && ['admin', 'admin_staff'].includes(String(who.role || '').toLowerCase()) ? who : null;
}

export async function GET(req: NextRequest) {
  const who = adminIdentity(req);
  if (!who) return json({ ok: false, error: 'unauthorized' }, 401);
  return json({ ok: true, data: await getClinicalDocumentBranding() });
}

export async function PUT(req: NextRequest) {
  const who = adminIdentity(req);
  if (!who) return json({ ok: false, error: 'unauthorized' }, 401);
  const body = await req.json().catch(() => ({}));
  const normalized = normalizeClinicalDocumentBranding(body?.data || body);
  const saved = await (prisma as any).platformSetting.upsert({
    where: { key: CLINICAL_DOCUMENT_BRANDING_KEY },
    create: {
      key: CLINICAL_DOCUMENT_BRANDING_KEY,
      category: 'clinical_documents',
      value: normalized,
      updatedByUserId: who.uid,
    },
    update: {
      category: 'clinical_documents',
      value: normalized,
      updatedByUserId: who.uid,
    },
  });
  await (prisma as any).auditEvent?.create?.({
    data: {
      kind: 'clinical_document_branding_updated',
      actorId: who.uid,
      actorRole: who.role,
      subjectId: CLINICAL_DOCUMENT_BRANDING_KEY,
      meta: { version: normalized.version },
    },
  }).catch(() => null);
  return json({ ok: true, data: normalizeClinicalDocumentBranding({ ...normalized, updatedAt: saved.updatedAt?.toISOString?.() || saved.updatedAt }) });
}
