import { NextRequest, NextResponse } from 'next/server';
import { requireInternalPatientIdentity } from '@/src/lib/internal-patient-identity';
import {
  objectKeyFromManagedPatientMedicalAidDocumentRef,
  patientMedicalAidDocumentErrorResponse,
  patientMedicalAidObjectBelongsToPatient,
  presignPatientMedicalAidDocumentView,
} from '@/src/lib/patient-medical-aid-document-storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const access = requireInternalPatientIdentity(req);
    if (!access.ok) return access.response;

    const body = await req.json().catch(() => ({}));
    const objectKey = objectKeyFromManagedPatientMedicalAidDocumentRef(body.managedRef);
    if (!objectKey) {
      return NextResponse.json({ ok: false, error: 'patient_document_managed_ref_invalid' }, { status: 400 });
    }
    if (!patientMedicalAidObjectBelongsToPatient(objectKey, access.identity.patientId)) {
      return NextResponse.json({ ok: false, error: 'patient_document_object_scope_invalid' }, { status: 403 });
    }

    const signed = await presignPatientMedicalAidDocumentView(objectKey);
    return NextResponse.json(
      { ok: true, objectKey, ...signed },
      { headers: { 'cache-control': 'no-store' } },
    );
  } catch (error) {
    const storage = patientMedicalAidDocumentErrorResponse(error);
    if (storage) return NextResponse.json(storage.body, { status: storage.status });
    console.error('[patient medical aid document view] failed', error);
    return NextResponse.json({ ok: false, error: 'patient_document_view_failed' }, { status: 500 });
  }
}
