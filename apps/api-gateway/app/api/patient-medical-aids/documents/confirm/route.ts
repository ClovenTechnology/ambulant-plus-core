import { NextRequest, NextResponse } from 'next/server';
import { requireInternalPatientIdentity } from '@/src/lib/internal-patient-identity';
import {
  managedPatientMedicalAidDocumentRef,
  patientMedicalAidDocumentErrorResponse,
  patientMedicalAidObjectBelongsToPatient,
  validatePatientMedicalAidDocumentUploadInput,
  verifyPatientMedicalAidDocumentUpload,
} from '@/src/lib/patient-medical-aid-document-storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function clean(value: unknown, max: number) {
  return String(value ?? '').trim().slice(0, max);
}

export async function POST(req: NextRequest) {
  try {
    const access = requireInternalPatientIdentity(req);
    if (!access.ok) return access.response;

    const body = await req.json().catch(() => ({}));
    const objectKey = clean(body.objectKey, 700);
    if (!objectKey) {
      return NextResponse.json({ ok: false, error: 'patient_document_confirmation_invalid' }, { status: 400 });
    }
    if (!patientMedicalAidObjectBelongsToPatient(objectKey, access.identity.patientId)) {
      return NextResponse.json({ ok: false, error: 'patient_document_object_scope_invalid' }, { status: 403 });
    }

    const validated = validatePatientMedicalAidDocumentUploadInput(body);
    await verifyPatientMedicalAidDocumentUpload({ objectKey, ...validated });
    const managedRef = managedPatientMedicalAidDocumentRef(objectKey);
    return NextResponse.json(
      { ok: true, objectKey, managedRef },
      { headers: { 'cache-control': 'no-store' } },
    );
  } catch (error) {
    const storage = patientMedicalAidDocumentErrorResponse(error);
    if (storage) return NextResponse.json(storage.body, { status: storage.status });
    console.error('[patient medical aid document confirm] failed', error);
    return NextResponse.json({ ok: false, error: 'patient_document_confirm_failed' }, { status: 500 });
  }
}
