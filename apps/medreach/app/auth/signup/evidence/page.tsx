// apps/medreach/app/auth/signup/evidence/page.tsx
'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';

type SubjectType = 'lab' | 'phleb';

const DOC_TYPES = {
  lab: [
    'LAB_REGISTRATION',
    'ACCREDITATION_CERTIFICATE',
    'RESPONSIBLE_PERSON_ID',
    'PAYOUT_PROOF',
    'INSURANCE_OR_INDEMNITY',
    'OTHER',
  ],
  phleb: [
    'IDENTITY_DOCUMENT',
    'PHLEBOTOMY_CERTIFICATE',
    'PROOF_OF_ADDRESS',
    'PAYOUT_PROOF',
    'VEHICLE_OR_TRANSPORT_PROOF',
    'OTHER',
  ],
};

const MAX_FILE_BYTES = 1_250_000;
const ALLOWED_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Unable to read file'));

    reader.readAsDataURL(file);
  });
}

async function sha256(file: File) {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export default function MedReachEvidencePage() {
  const [subjectType, setSubjectType] = useState<SubjectType>('lab');
  const [subjectId, setSubjectId] = useState('');
  const [documentType, setDocumentType] = useState(DOC_TYPES.lab[0]);
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function changeType(next: SubjectType) {
    setSubjectType(next);
    setDocumentType(DOC_TYPES[next][0]);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSubmitting(true);
    setNotice(null);
    setErr(null);

    try {
      if (!subjectId.trim()) {
        throw new Error('Application reference is required.');
      }

      if (!file) {
        throw new Error('Select a document file first.');
      }

      if (!ALLOWED_TYPES.includes(file.type)) {
        throw new Error('Unsupported file type. Upload PDF, PNG, JPG or WEBP.');
      }

      if (file.size > MAX_FILE_BYTES) {
        throw new Error('File is too large for this evidence intake. Use a smaller PDF/image.');
      }

      const [fileDataUrl, hash] = await Promise.all([readAsDataUrl(file), sha256(file)]);

      const res = await fetch('/api/onboarding/evidence', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          subjectType,
          subjectId: subjectId.trim(),
          applicantRef: subjectId.trim(),
          documentType,
          fileName: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
          sha256: hash,
          fileDataUrl,
          notes,
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || `HTTP ${res.status}`);
      }

      setNotice(`Evidence submitted. Evidence ID: ${json?.data?.id || 'created'}`);
      setFile(null);
      setNotes('');
    } catch (error: any) {
      setErr(error?.message || 'Unable to submit evidence');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8">
      <section className="mx-auto max-w-3xl space-y-6">
        <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-950">
              MedReach compliance evidence
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              Upload supporting KYB/KYC/KYI evidence after submitting a lab or phleb
              application. Admin still decides approval, rejection or further-information
              requests.
            </p>
          </div>

          <Link
            href="/auth/signup"
            className="rounded-full border bg-white px-3 py-1 text-xs hover:bg-gray-50"
          >
            Back to application
          </Link>
        </header>

        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
          Use the application reference returned after signup. Files are capped for this
          intake ledger. Long-term production storage can later move binaries to S3 while
          keeping this audit trail as the evidence index.
        </section>

        {notice ? (
          <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            {notice}
          </section>
        ) : null}

        {err ? (
          <section className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
            {err}
          </section>
        ) : null}

        <form onSubmit={submit} className="space-y-5 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap gap-2 text-xs">
            {(['lab', 'phleb'] as SubjectType[]).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => changeType(type)}
                className={`rounded-full border px-4 py-2 ${
                  subjectType === type
                    ? 'border-gray-900 bg-gray-900 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {type === 'lab' ? 'Lab evidence' : 'Phleb evidence'}
              </button>
            ))}
          </div>

          <label className="block text-sm">
            <span className="text-xs font-medium text-gray-600">
              Application reference / profile ID
            </span>
            <input
              value={subjectId}
              onChange={(event) => setSubjectId(event.target.value)}
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
              placeholder={subjectType === 'lab' ? 'LabPartner ID' : 'Phleb profile ID or userId'}
              required
            />
          </label>

          <label className="block text-sm">
            <span className="text-xs font-medium text-gray-600">Document type</span>
            <select
              value={documentType}
              onChange={(event) => setDocumentType(event.target.value)}
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
            >
              {DOC_TYPES[subjectType].map((type) => (
                <option key={type} value={type}>
                  {type.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="text-xs font-medium text-gray-600">Document file</span>
            <input
              type="file"
              accept=".pdf,image/png,image/jpeg,image/webp"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
              required
            />
            <span className="mt-1 block text-[11px] text-gray-500">
              PDF, PNG, JPG or WEBP. Max {(MAX_FILE_BYTES / 1_000_000).toFixed(2)} MB.
            </span>
          </label>

          <label className="block text-sm">
            <span className="text-xs font-medium text-gray-600">Notes</span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
              rows={3}
              placeholder="Any context admin should know"
            />
          </label>

          <div className="flex justify-end border-t pt-4">
            <button
              type="submit"
              disabled={submitting}
              className={`rounded border px-5 py-2 text-sm ${
                submitting
                  ? 'bg-gray-200 text-gray-500'
                  : 'bg-gray-900 text-white hover:bg-black'
              }`}
            >
              {submitting ? 'Submitting...' : 'Submit evidence'}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}