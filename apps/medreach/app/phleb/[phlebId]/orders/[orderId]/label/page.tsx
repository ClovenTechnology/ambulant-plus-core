'use client';

// apps/medreach/app/phleb/[phlebId]/orders/[orderId]/label/page.tsx
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

function humanErrorMessage(value: unknown, fallback = "Unable to complete this request. Please try again.") {
  if (typeof value === "string") {
    const text = value.trim();
    if (text && text !== "[object Object]") return text;
  }

  if (value instanceof Error) {
    const text = value.message.trim();
    if (text && text !== "[object Object]") return text;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;

    for (const key of ["message", "error", "detail", "reason", "statusText", "code"]) {
      const candidate = record[key];

      if (typeof candidate === "string") {
        const text = candidate.trim();
        if (text && text !== "[object Object]") return text;
      }

      if (candidate && typeof candidate === "object") {
        const nested = candidate as Record<string, unknown>;

        for (const nestedKey of ["message", "error", "detail", "reason", "statusText", "code"]) {
          const nestedCandidate = nested[nestedKey];

          if (typeof nestedCandidate === "string") {
            const text = nestedCandidate.trim();
            if (text && text !== "[object Object]") return text;
          }
        }
      }
    }
  }

  if (value != null) {
    const text = String(value).trim();
    if (text && text !== "[object Object]") return text;
  }

  return fallback;
}


type CustodyEvent = {
  id?: string;
  action?: string;
  actorId?: string | null;
  actorRole?: string | null;
  specimenId?: string | null;
  lat?: number | null;
  lng?: number | null;
  meta?: any;
  createdAt?: string | null;
  at?: string | null;
};

type Specimen = {
  id?: string;
  specimenType?: string | null;
  containerType?: string | null;
  containerCount?: number | null;
  barcodeValue?: string | null;
  barcodeChecksum?: string | null;
  labelVersion?: number | null;
  requiresColdChain?: boolean | null;
  requiredTempMinC?: number | null;
  requiredTempMaxC?: number | null;
  maxTransitMins?: number | null;
  storageMode?: string | null;
  status?: string | null;
  collectionTime?: string | null;
  sealStatus?: string | null;
  deliveredAtLabAt?: string | null;
  temperatures?: any[];
  evidence?: any[];
};

type Bundle = {
  id?: string;
  orderId?: string | null;
  drawId?: string | null;
  encounterId?: string | null;
  patientId?: string | null;
  clinicianId?: string | null;
  labPartnerId?: string | null;
  status?: string | null;
  labelPrintedAt?: string | null;
  collectedAt?: string | null;
  sealedAt?: string | null;
  inTransitAt?: string | null;
  receivedAtLabAt?: string | null;
  specimens?: Specimen[];
  custody?: CustodyEvent[];
};

type Job = {
  id: string;
  drawId?: string;
  jobId?: string;
  orderId?: string;
  encounterId?: string | null;
  patientId?: string | null;
  clinicianId?: string | null;
  labId?: string | null;
  partnerId?: string | null;
  status?: string;
  scheduledAt?: string | null;
  assignedAt?: string | null;
  receivedByLabAt?: string | null;
  lab?: {
    id?: string;
    name?: string;
    contact?: string | null;
    locationCode?: string | null;
  } | null;
  bundle?: Bundle | null;
  specimenBundle?: Bundle | null;
  bundleStatus?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function asArray(value: any): any[] {
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.jobs)) return value.jobs;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value)) return value;

  return [];
}

function normalizeJob(raw: any): Job {
  const draw = raw?.draw || raw;
  const bundle = raw?.bundle || raw?.specimenBundle || raw?.medReachSpecimenBundle || null;

  return {
    id: String(raw?.id || raw?.jobId || raw?.drawId || draw?.id || raw?.orderId || '').trim(),
    drawId: raw?.drawId || draw?.id || raw?.id,
    jobId: raw?.jobId || raw?.id || draw?.id,
    orderId: raw?.orderId || draw?.orderId,
    encounterId: raw?.encounterId || draw?.encounterId || bundle?.encounterId || null,
    patientId: raw?.patientId || draw?.patientId || bundle?.patientId || null,
    clinicianId: raw?.clinicianId || draw?.clinicianId || bundle?.clinicianId || null,
    labId: raw?.labId || raw?.partnerId || draw?.partnerId || bundle?.labPartnerId || raw?.lab?.id || null,
    partnerId: raw?.partnerId || draw?.partnerId || raw?.labId || bundle?.labPartnerId || null,
    status: String(raw?.status || draw?.status || 'ASSIGNED'),
    scheduledAt: raw?.scheduledAt || draw?.scheduledAt || null,
    assignedAt: raw?.assignedAt || draw?.assignedAt || null,
    receivedByLabAt: raw?.receivedByLabAt || draw?.receivedByLabAt || null,
    lab: raw?.lab || null,
    bundle,
    specimenBundle: bundle,
    bundleStatus: raw?.bundleStatus || bundle?.status || null,
    createdAt: raw?.createdAt || draw?.createdAt || null,
    updatedAt: raw?.updatedAt || draw?.updatedAt || null,
  };
}

function matchesOrder(job: Job, orderId: string) {
  const wanted = decodeURIComponent(orderId).toLowerCase();

  return [
    job.orderId,
    job.drawId,
    job.jobId,
    job.id,
    job.bundle?.orderId,
    job.bundle?.drawId,
  ]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase())
    .includes(wanted);
}

function fmtDate(value?: string | null) {
  if (!value) return '-';

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';

  return d.toLocaleString();
}

function statusTone(status?: string | null) {
  const s = String(status || '').toUpperCase();

  if (['ACCEPTED', 'RECEIVED_AT_LAB', 'DELIVERED_TO_LAB', 'COMPLETED'].includes(s)) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }

  if (['IN_TRANSIT', 'PHLEB_EN_ROUTE_TO_LAB', 'PHLEB_EN_ROUTE_TO_PATIENT'].includes(s)) {
    return 'border-blue-200 bg-blue-50 text-blue-700';
  }

  if (['COLLECTED', 'SEALED', 'SAMPLING_IN_PROGRESS'].includes(s)) {
    return 'border-indigo-200 bg-indigo-50 text-indigo-700';
  }

  if (['REJECTED', 'FAILED', 'CANCELLED', 'TEMPERATURE_BREACH'].includes(s)) {
    return 'border-rose-200 bg-rose-50 text-rose-700';
  }

  return 'border-amber-200 bg-amber-50 text-amber-700';
}

function safeBarcode(specimen: Specimen, bundle: Bundle | null, index: number) {
  return (
    clean(specimen.barcodeValue) ||
    clean(specimen.id) ||
    (bundle?.id ? `MR-${bundle.id.slice(-6).toUpperCase()}-${String(index + 1).padStart(2, '0')}` : '')
  );
}

function tempRange(specimen: Specimen) {
  if (!specimen.requiresColdChain) return 'Ambient / not cold-chain flagged';

  const min = specimen.requiredTempMinC == null ? '?' : String(specimen.requiredTempMinC);
  const max = specimen.requiredTempMaxC == null ? '?' : String(specimen.requiredTempMaxC);

  return `${min}C to ${max}C`;
}

function identityComplete(job: Job, specimen: Specimen) {
  return Boolean(
    clean(job.orderId) &&
      clean(job.patientId) &&
      clean(job.encounterId) &&
      clean(safeBarcode(specimen, job.bundle || null, 0)),
  );
}

function barcodeBars(value: string) {
  const chars = value || 'NO-BARCODE';

  return chars
    .split('')
    .slice(0, 48)
    .map((char, index) => {
      const code = char.charCodeAt(0) + index;
      const width = 1 + (code % 4);

      return (
        <span
          key={`${char}-${index}`}
          style={{ width: `${width}px` }}
          className="inline-block h-10 bg-gray-950"
        />
      );
    });
}

function specimenLabelTitle(job: Job, specimen: Specimen, index: number) {
  return [
    job.orderId || job.id || 'ORDER',
    safeBarcode(specimen, job.bundle || null, index) || `SPECIMEN-${index + 1}`,
  ].join(' / ');
}

export default function LabelPage() {
  const params = useParams<{ phlebId: string; orderId: string }>();
  const phlebId = params.phlebId;
  const orderId = params.orderId;

  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [ensuring, setEnsuring] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const selectedJob = useMemo(
    () => jobs.find((job) => matchesOrder(job, orderId)) || null,
    [jobs, orderId],
  );

  const bundle = selectedJob?.bundle || selectedJob?.specimenBundle || null;
  const specimens = Array.isArray(bundle?.specimens) ? bundle!.specimens! : [];

  async function load() {
    setLoading(true);
    setErr(null);
    setNotice(null);

    try {
      const res = await fetch(
        `/api/phleb-jobs?phlebId=${encodeURIComponent(phlebId)}&includeCompleted=true&limit=300`,
        { cache: 'no-store' },
      );

      const json = await res.json().catch(() => null);

      if (!res.ok || json?.ok === false) {
        throw new Error(humanErrorMessage(json?.error, `HTTP ${res.status}`));
      }

      setJobs(asArray(json).map(normalizeJob));
    } catch (e: any) {
      setErr(e?.message || 'Unable to load label payload');
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phlebId, orderId]);

  useEffect(() => {
    const titleId =
      selectedJob?.orderId ||
      selectedJob?.drawId ||
      decodeURIComponent(orderId);

    document.title = `MedReach label - ${titleId}`;
  }, [selectedJob, orderId]);

  async function ensureLabelBundle() {
    if (!selectedJob) {
      setErr('Cannot create a label bundle because the job was not found.');
      return;
    }

    setEnsuring(true);
    setErr(null);
    setNotice(null);

    try {
      const jobId =
        selectedJob.drawId ||
        selectedJob.jobId ||
        selectedJob.id ||
        selectedJob.orderId;

      const res = await fetch('/api/phleb-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phlebId,
          jobId,
          drawId: selectedJob.drawId,
          orderId: selectedJob.orderId,
          bundleId: bundle?.id || undefined,
          action: 'PRINT_LABEL',
          specimens:
            specimens.length > 0
              ? specimens
              : [
                  {
                    specimenType: 'Blood',
                    containerType: 'EDTA',
                    containerCount: 1,
                    requiresColdChain: false,
                    storageMode: 'AMBIENT',
                  },
                ],
          meta: {
            source: 'medreach_label_page',
            orderId: selectedJob.orderId || orderId,
            labId: selectedJob.labId,
            partnerId: selectedJob.partnerId,
          },
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || json?.ok === false) {
        throw new Error(humanErrorMessage(json?.error, `HTTP ${res.status}`));
      }

      setNotice('Specimen label bundle ensured. Refreshing live label payload.');
      await load();
    } catch (e: any) {
      setErr(e?.message || 'Unable to ensure label bundle');
    } finally {
      setEnsuring(false);
    }
  }

  return (
    <>
      <style jsx global>{`
        @media print {
          body {
            margin: 0;
            padding: 0;
            background: #fff !important;
          }

          .no-print {
            display: none !important;
          }

          .print-shell {
            background: #fff !important;
            padding: 0 !important;
          }

          .label-page {
            box-shadow: none !important;
            border: 1px solid #111827 !important;
            break-inside: avoid;
            page-break-inside: avoid;
            margin: 0 0 8px 0 !important;
          }
        }
      `}</style>

      <main className="print-shell min-h-screen bg-gray-100 px-4 py-6">
        <section className="no-print mx-auto mb-4 flex max-w-5xl flex-col gap-3 rounded-xl border bg-white p-4 text-xs text-gray-700 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <div className="font-semibold text-gray-950">MedReach specimen label</div>
            <div className="mt-1">
              Phleb <span className="font-mono">{phlebId}</span> / Order{' '}
              <span className="font-mono">{decodeURIComponent(orderId)}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={`/phleb/${encodeURIComponent(phlebId)}`}
              className="rounded border bg-white px-3 py-1 hover:bg-gray-50"
            >
              Field console
            </Link>
            <button
              type="button"
              onClick={load}
              className="rounded border bg-white px-3 py-1 hover:bg-gray-50"
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={ensureLabelBundle}
              disabled={ensuring || !selectedJob}
              className={`rounded border px-3 py-1 ${
                ensuring || !selectedJob
                  ? 'bg-gray-100 text-gray-400'
                  : 'bg-indigo-700 text-white hover:bg-indigo-800'
              }`}
            >
              {ensuring ? 'Ensuring...' : 'Ensure label bundle'}
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              disabled={!bundle || specimens.length === 0}
              className={`rounded border px-3 py-1 ${
                !bundle || specimens.length === 0
                  ? 'bg-gray-100 text-gray-400'
                  : 'bg-gray-900 text-white hover:bg-black'
              }`}
            >
              Print
            </button>
          </div>
        </section>

        {notice ? (
          <section className="no-print mx-auto mb-4 max-w-5xl rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
            {notice}
          </section>
        ) : null}

        {err ? (
          <section className="no-print mx-auto mb-4 max-w-5xl rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            {humanErrorMessage(err, "Unable to complete this request. Please try again.")}
          </section>
        ) : null}

        {loading ? (
          <section className="mx-auto max-w-5xl rounded-xl border bg-white p-6 text-sm text-gray-500">
            Loading live label payload...
          </section>
        ) : !selectedJob ? (
          <section className="mx-auto max-w-5xl rounded-xl border bg-white p-6 text-sm text-gray-700">
            <div className="font-semibold text-gray-950">Job not found</div>
            <div className="mt-2">
              No gateway-backed phleb job matched order/draw{' '}
              <span className="font-mono">{decodeURIComponent(orderId)}</span>. No label
              has been generated because MedReach should never print placeholder specimen
              labels.
            </div>
          </section>
        ) : !bundle || specimens.length === 0 ? (
          <section className="mx-auto max-w-5xl rounded-xl border bg-white p-6 text-sm text-gray-700">
            <div className="font-semibold text-gray-950">Specimen bundle not ready</div>
            <div className="mt-2">
              This job was found, but no specimen bundle/specimen barcode payload is present
              yet. Use <span className="font-semibold">Ensure label bundle</span> before
              printing.
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 text-xs md:grid-cols-4">
              <div className="rounded-lg border bg-gray-50 p-3">
                <div className="text-gray-500">Order</div>
                <div className="truncate font-mono">{selectedJob.orderId || '-'}</div>
              </div>
              <div className="rounded-lg border bg-gray-50 p-3">
                <div className="text-gray-500">Draw</div>
                <div className="truncate font-mono">{selectedJob.drawId || '-'}</div>
              </div>
              <div className="rounded-lg border bg-gray-50 p-3">
                <div className="text-gray-500">Status</div>
                <div className="truncate font-mono">{selectedJob.status || '-'}</div>
              </div>
              <div className="rounded-lg border bg-gray-50 p-3">
                <div className="text-gray-500">Lab</div>
                <div className="truncate font-mono">
                  {selectedJob.lab?.name || selectedJob.labId || selectedJob.partnerId || '-'}
                </div>
              </div>
            </div>
          </section>
        ) : (
          <section className="mx-auto max-w-5xl space-y-4">
            <div className="no-print rounded-xl border bg-white p-4 text-xs shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="font-semibold text-gray-950">Live bundle summary</div>
                  <div className="mt-1 text-gray-600">
                    Bundle <span className="font-mono">{bundle.id}</span> / Status{' '}
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusTone(bundle.status)}`}>
                      {bundle.status || 'PLANNED'}
                    </span>
                  </div>
                </div>

                <div className="text-right text-gray-600">
                  <div>Specimens: {specimens.length}</div>
                  <div>Label printed: {fmtDate(bundle.labelPrintedAt)}</div>
                </div>
              </div>

              {Array.isArray(bundle.custody) && bundle.custody.length > 0 ? (
                <div className="mt-4 rounded-lg border bg-gray-50 p-3">
                  <div className="font-semibold text-gray-800">Custody timeline</div>
                  <div className="mt-2 space-y-1">
                    {bundle.custody.map((event) => (
                      <div
                        key={event.id || `${event.action}:${event.createdAt || event.at}`}
                        className="flex justify-between gap-3 border-b pb-1 last:border-b-0"
                      >
                        <span className="font-mono">{event.action || 'EVENT'}</span>
                        <span>{fmtDate(event.createdAt || event.at)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            {specimens.map((specimen, index) => {
              const barcode = safeBarcode(specimen, bundle, index);
              const complete = identityComplete(selectedJob, specimen);

              return (
                <article
                  key={specimen.id || barcode || index}
                  className="label-page rounded-xl border bg-white p-5 text-xs text-gray-950 shadow-sm"
                >
                  <header className="flex items-start justify-between gap-4 border-b pb-3">
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                        MedReach specimen label
                      </div>
                      <h1 className="mt-1 text-base font-bold">
                        {specimenLabelTitle(selectedJob, specimen, index)}
                      </h1>
                      <div className="mt-1 text-[11px] text-gray-600">
                        Print only if identifiers match the patient and request.
                      </div>
                    </div>

                    <div className="text-right">
                      <div className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusTone(specimen.status || bundle.status)}`}>
                        {specimen.status || bundle.status || 'PLANNED'}
                      </div>
                      <div className="mt-1 text-[10px] text-gray-500">
                        Label v{specimen.labelVersion || 1}
                      </div>
                    </div>
                  </header>

                  {!complete ? (
                    <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-[11px] font-semibold text-rose-800">
                      Identifier warning: one or more core identifiers are missing from the
                      gateway payload. Verify manually before collection, transport or lab
                      handoff.
                    </div>
                  ) : null}

                  <section className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
                    <div>
                      <div className="text-[10px] uppercase text-gray-500">Order</div>
                      <div className="font-mono font-semibold">{selectedJob.orderId || '-'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase text-gray-500">Draw</div>
                      <div className="font-mono font-semibold">{selectedJob.drawId || '-'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase text-gray-500">Encounter</div>
                      <div className="font-mono font-semibold">
                        {selectedJob.encounterId || bundle.encounterId || '-'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase text-gray-500">Patient ID</div>
                      <div className="font-mono font-semibold">
                        {selectedJob.patientId || bundle.patientId || '-'}
                      </div>
                    </div>
                  </section>

                  <section className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
                    <div>
                      <div className="text-[10px] uppercase text-gray-500">Lab</div>
                      <div className="font-semibold">
                        {selectedJob.lab?.name ||
                          selectedJob.labId ||
                          selectedJob.partnerId ||
                          bundle.labPartnerId ||
                          '-'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase text-gray-500">Bundle</div>
                      <div className="font-mono font-semibold">{bundle.id || '-'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase text-gray-500">Specimen</div>
                      <div className="font-mono font-semibold">{specimen.id || '-'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase text-gray-500">Container count</div>
                      <div className="font-semibold">{specimen.containerCount || 1}</div>
                    </div>
                  </section>

                  <section className="mt-4 rounded-lg border bg-gray-50 p-3">
                    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                      <div>
                        <div className="text-[10px] uppercase text-gray-500">Barcode value</div>
                        <div className="mt-1 break-all font-mono text-base font-bold">
                          {barcode || 'MISSING-BARCODE'}
                        </div>
                        <div className="mt-1 text-[10px] text-gray-500">
                          Checksum: {specimen.barcodeChecksum || 'not supplied'}
                        </div>
                      </div>

                      <div className="flex h-12 items-end gap-[2px] rounded bg-white px-2 py-1">
                        {barcodeBars(barcode)}
                      </div>
                    </div>
                  </section>

                  <section className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
                    <div>
                      <div className="text-[10px] uppercase text-gray-500">Specimen type</div>
                      <div className="font-semibold">{specimen.specimenType || 'Unspecified'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase text-gray-500">Container</div>
                      <div className="font-semibold">{specimen.containerType || '-'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase text-gray-500">Storage</div>
                      <div className="font-semibold">{specimen.storageMode || 'AMBIENT'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase text-gray-500">Temperature</div>
                      <div className="font-semibold">{tempRange(specimen)}</div>
                    </div>
                  </section>

                  <section className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
                    <div>
                      <div className="text-[10px] uppercase text-gray-500">Collected</div>
                      <div className="font-semibold">
                        {fmtDate(specimen.collectionTime || bundle.collectedAt)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase text-gray-500">Sealed</div>
                      <div className="font-semibold">
                        {specimen.sealStatus || (bundle.sealedAt ? 'SEALED' : '-')}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase text-gray-500">Transit max</div>
                      <div className="font-semibold">
                        {specimen.maxTransitMins == null ? '-' : `${specimen.maxTransitMins} mins`}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase text-gray-500">Lab receipt</div>
                      <div className="font-semibold">
                        {fmtDate(specimen.deliveredAtLabAt || bundle.receivedAtLabAt)}
                      </div>
                    </div>
                  </section>

                  <footer className="mt-4 border-t pt-3 text-[10px] text-gray-500">
                    Generated from MedReach gateway-backed job and specimen-bundle data. Do
                    not use if patient, order, barcode or specimen identifiers do not match
                    the live request.
                  </footer>
                </article>
              );
            })}
          </section>
        )}
      </main>
    </>
  );
}