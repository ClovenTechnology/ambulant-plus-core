import crypto from 'crypto';
import Link from 'next/link';
import { headers } from 'next/headers';
import { prisma } from '@/src/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function tokenHash(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function fmtDateTime(value?: string | Date | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function normaliseScope(scope?: string) {
  switch (scope) {
    case 'full_record':
      return 'Full record';
    case 'documents_only':
      return 'Documents only';
    case 'labs_only':
      return 'Laboratory results only';
    case 'selected_documents':
      return 'Selected documents';
    default:
      return 'Shared record';
  }
}

function flagTone(flag?: string | null) {
  const f = String(flag || '').toLowerCase();
  if (f === 'critical' || f === 'abnormal') return 'text-rose-700 bg-rose-50 border-rose-100';
  if (f === 'high' || f === 'low') return 'text-amber-700 bg-amber-50 border-amber-100';
  return 'text-emerald-700 bg-emerald-50 border-emerald-100';
}

async function resolveShare(token: string) {
  const hash = tokenHash(token);

  const created = await prisma.auditEvent.findFirst({
    where: { kind: 'medical_record_share_created', subjectId: hash },
    orderBy: { at: 'desc' },
  });

  if (!created) return { ok: false as const, reason: 'not_found' as const };

  const revoked = await prisma.auditEvent.findFirst({
    where: { kind: 'medical_record_share_revoked', subjectId: hash },
    orderBy: { at: 'desc' },
  });

  if (revoked) return { ok: false as const, reason: 'revoked' as const };

  const meta = created.meta as any;
  const expiresAt = new Date(String(meta?.expiresAt || ''));
  if (!meta?.patientId || Number.isNaN(expiresAt.getTime())) return { ok: false as const, reason: 'invalid' as const };
  if (expiresAt.getTime() <= Date.now()) return { ok: false as const, reason: 'expired' as const };

  return { ok: true as const, hash, meta, createdAt: created.at, expiresAt };
}

export default async function SharedMedicalRecordPage({ params }: { params: { token: string } }) {
  const token = String(params.token || '');
  const share = await resolveShare(token);

  if (!share.ok) {
    return (
      <main data-p-ui="patient-shared-medical-records-page" className="min-w-0 overflow-x-clip min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-sm font-black uppercase tracking-wide text-rose-700">Link unavailable</div>
          <h1 className="mt-2 text-2xl font-black text-slate-950">This medical record link is no longer available.</h1>
          <p className="mt-3 text-sm text-slate-600">
            The link may have expired, been revoked by the patient, or may not exist.
          </p>
        </div>
      </main>
    );
  }

  const scope = String(share.meta.scope || 'documents_only');
  const selectedDocumentIds = Array.isArray(share.meta.selectedDocumentIds) ? share.meta.selectedDocumentIds : [];

  const patient = await prisma.patientProfile.findUnique({
    where: { id: String(share.meta.patientId) },
    select: {
      id: true,
      name: true,
      mrn: true,
    },
  });

  const includeDocs = scope === 'full_record' || scope === 'documents_only' || scope === 'selected_documents';
  const includeLabs = scope === 'full_record' || scope === 'labs_only';

  const [documents, labs] = await Promise.all([
    includeDocs
      ? prisma.patientDocument.findMany({
          where: {
            patientId: String(share.meta.patientId),
            ...(scope === 'selected_documents' ? { id: { in: selectedDocumentIds } } : {}),
            status: { not: 'DELETED' },
          },
          orderBy: { createdAt: 'desc' },
          take: 100,
        })
      : Promise.resolve([]),
    includeLabs
      ? prisma.labResult.findMany({
          where: { patientId: String(share.meta.patientId) },
          orderBy: { createdAt: 'desc' },
          take: 100,
        })
      : Promise.resolve([]),
  ]);

  await prisma.auditEvent.create({
    data: {
      kind: 'medical_record_share_viewed',
      actorId: null,
      actorRole: 'share_viewer',
      subjectId: share.hash,
      meta: {
        patientId: share.meta.patientId,
        scope,
        viewedAt: new Date().toISOString(),
        userAgent: headers().get('user-agent') || null,
      },
    },
  });

  return (
    <main data-p-ui="patient-shared-medical-records-page" className="min-w-0 overflow-x-clip min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-5xl space-y-4">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="text-xs font-black uppercase tracking-wide text-emerald-700">Ambulant+ shared medical record</div>
              <h1 className="mt-2 text-2xl font-black text-slate-950">{patient?.name || 'Patient record'}</h1>
              <div className="mt-2 text-sm text-slate-600">
                {patient?.mrn ? `MRN ${patient.mrn}` : 'MRN not shown'}
              </div>
            </div>
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              <div className="font-black">{normaliseScope(scope)}</div>
              <div className="mt-1">Expires {fmtDateTime(share.expiresAt)}</div>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            This link was created by the patient for time-limited, consent-based access. Access is logged for audit.
          </div>
        </section>

        {includeDocs ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-black text-slate-950">Documents</h2>
            {documents.length === 0 ? (
              <p className="mt-3 text-sm text-slate-600">No documents are included in this share.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {documents.map((doc) => (
                  <div key={doc.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="font-black text-slate-950">{doc.title}</div>
                      <div className="mt-1 text-xs text-slate-600">
                        {doc.documentKind.replace('-', ' ')} · {fmtDateTime(doc.createdAt)} {doc.fileName ? `· ${doc.fileName}` : ''}
                      </div>
                    </div>
                    <Link
                      href={`/api/medical-records/share/${encodeURIComponent(token)}/file?documentId=${encodeURIComponent(doc.id)}`}
                      className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-2 text-sm font-extrabold text-white hover:bg-slate-800"
                    >
                      Download
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </section>
        ) : null}

        {includeLabs ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-black text-slate-950">Laboratory results</h2>
            {labs.length === 0 ? (
              <p className="mt-3 text-sm text-slate-600">No laboratory results are included in this share.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {labs.map((lab) => (
                  <div key={lab.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="font-black text-slate-950">{lab.name}</div>
                        <div className="mt-1 text-xs text-slate-600">{fmtDateTime(lab.createdAt)}</div>
                      </div>
                      <div className={`rounded-full border px-3 py-1 text-xs font-black ${flagTone(lab.flag)}`}>
                        {lab.flag || 'normal'}
                      </div>
                    </div>
                    <div className="mt-3 text-sm text-slate-700">
                      {lab.valueNum ?? '—'} {lab.unit || ''}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        ) : null}
      </div>
    </main>
  );
}
