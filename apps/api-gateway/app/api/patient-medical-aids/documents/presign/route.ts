import { NextRequest, NextResponse } from 'next/server';
import { requireInternalPatientIdentity } from '@/src/lib/internal-patient-identity';
import {
  patientMedicalAidDocumentErrorResponse,
  patientMedicalAidDocumentObjectKey,
  presignPatientMedicalAidDocumentUpload,
  validatePatientMedicalAidDocumentUploadInput,
} from '@/src/lib/patient-medical-aid-document-storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const access = requireInternalPatientIdentity(req);
    if (!access.ok) return access.response;

    const body = await req.json().catch(() => ({}));
    const validated = validatePatientMedicalAidDocumentUploadInput(body);
    const objectKey = patientMedicalAidDocumentObjectKey(access.identity.patientId);
    const presigned = await presignPatientMedicalAidDocumentUpload({
      objectKey,
      contentType: validated.contentType,
      checksumSha256: validated.checksumSha256,
    });

    return NextResponse.json(
      { ok: true, objectKey, ...validated, ...presigned },
      { headers: { 'cache-control': 'no-store' } },
    );
  } catch (error) {
    const storage = patientMedicalAidDocumentErrorResponse(error);
    if (storage) return NextResponse.json(storage.body, { status: storage.status });
    console.error('[patient medical aid document presign] failed', error);
    return NextResponse.json({ ok: false, error: 'patient_document_presign_failed' }, { status: 500 });
  }
}
