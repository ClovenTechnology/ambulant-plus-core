// apps/patient-app/app/medreach/track/page.tsx
'use client';

import React, { useEffect, useMemo, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import JobStatusPill from '../../../components/JobStatusPill';
import type {
  PhlebProfile,
  CollectionLocation,
} from '../../../components/PhlebMap';
import CollectionDetails, {
  type CollectionDetailsProps,
} from '../../../components/CollectionDetails';
import LabTimelineItem, {
  type LabTimelineEntry,
} from '../../../components/LabTimelineItem';

import { normalizeToJobStatus } from '../../../lib/medreachStatus';

type MedReachJob = {
  id: string;
  status?: string;
  eta?: string;
  patient?: string;
  labOrderNo?: string;
  encounterId?: string;
  patientId?: string;
  clinicianId?: string;
  caseId?: string;
  sessionId?: string;
  trackingNo?: string;
  [key: string]: any;
};

type Coord = { lat: number; lng: number; ts?: number };

function mapJobToPhleb(job: MedReachJob | null): PhlebProfile | null {
  if (!job) return null;
  const j = job as any;
  return {
    id: j.phlebId || job.id,
    name: j.phlebName || j.phlebotomist || 'Phlebotomist',
    avatar: j.phlebAvatar || j.avatar || undefined,
    rating: j.phlebRating || undefined,
    vehicle: j.phlebVehicle || j.vehicle || 'MedReach fleet',
    phoneMasked: j.phlebPhoneMasked || j.phoneMasked || undefined,
    phone: j.phlebPhone || j.phone || undefined,
    regPlate: j.phlebRegPlate || j.regPlate || undefined,
    visitsCount: j.phlebVisitsCount || undefined,
    labName: j.labName || undefined,
  };
}

function mapJobToPatientLoc(job: MedReachJob | null): CollectionLocation | null {
  if (!job) return null;
  const j = job as any;
  const lat =
    j.patientLat ??
    j.lat ??
    j.locationLat ??
    j.coords?.patient?.lat ??
    null;
  const lng =
    j.patientLng ??
    j.lng ??
    j.locationLng ??
    j.coords?.patient?.lng ??
    null;

  return {
    id: j.patientId || job.patientId || undefined,
    name: job.patient || 'Home collection',
    address:
      j.address ||
      j.location ||
      j.area ||
      'Patient home / collection address',
    coords:
      typeof lat === 'number' && typeof lng === 'number'
        ? { lat, lng }
        : null,
    notes: j.collectionWindow || j.slot || undefined,
  };
}

function mapJobToLabLoc(job: MedReachJob | null): CollectionLocation | null {
  if (!job) return null;
  const j = job as any;
  const lat = j.labLat ?? j.coords?.lab?.lat ?? null;
  const lng = j.labLng ?? j.coords?.lab?.lng ?? null;

  if (!j.labName && (lat == null || lng == null)) return null;

  return {
    id: j.labId || undefined,
    name: j.labName || 'Lab',
    address: j.labAddress || undefined,
    coords:
      typeof lat === 'number' && typeof lng === 'number'
        ? { lat, lng }
        : null,
  };
}

function mapJobToCoords(job: MedReachJob | null): Coord[] {
  if (!job) return [];
  const j = job as any;

  if (Array.isArray(j.coords) && j.coords.length > 0) {
    const arr = j.coords as any[];
    if (typeof arr[0].lat === 'number' && typeof arr[0].lng === 'number') {
      return arr.map((c) => ({
        lat: Number(c.lat),
        lng: Number(c.lng),
        ts: c.ts ? Number(c.ts) : Date.now(),
      }));
    }
  }

  const patientLoc = mapJobToPatientLoc(job);
  const labLoc = mapJobToLabLoc(job);

  if (patientLoc?.coords && labLoc?.coords) {
    return [
      {
        lat: labLoc.coords.lat,
        lng: labLoc.coords.lng,
        ts: Date.now() - 10 * 60_000,
      },
      { lat: patientLoc.coords.lat, lng: patientLoc.coords.lng, ts: Date.now() },
    ];
  }

  if (patientLoc?.coords) {
    const { lat, lng } = patientLoc.coords;
    return [
      { lat: lat + 0.003, lng: lng - 0.003 },
      { lat: lat + 0.001, lng: lng + 0.001 },
      { lat, lng },
    ].map((c, i) => ({ ...c, ts: Date.now() - (3 - i) * 3 * 60_000 }));
  }

  // graceful static fallback
  const baseLat = -26.1;
  const baseLng = 28.0;
  return [
    { lat: baseLat, lng: baseLng, ts: Date.now() - 20 * 60_000 },
    { lat: baseLat + 0.01, lng: baseLng + 0.01, ts: Date.now() - 10 * 60_000 },
    {
      lat: baseLat + 0.015,
      lng: baseLng + 0.015,
      ts: Date.now() - 2 * 60_000,
    },
  ];
}

function mapJobToCollectionDetails(
  job: MedReachJob | null,
): CollectionDetailsProps {
  if (!job) return {};
  const j = job as any;
  return {
    labOrderNo: j.labOrderNo || j.labId || job.id,
    encounterId: j.encounterId || undefined,
    patientId: j.patientId || undefined,
    clinicianId: j.clinicianId || undefined,
    caseId: j.caseId || undefined,
    sessionId: j.sessionId || undefined,
    collectionId: job.id,
    trackingNo: j.trackingNo || undefined,
    phlebId: j.phlebId || undefined,
    phlebName: j.phlebName || j.phlebotomist || undefined,
    collectionWindow: j.collectionWindow || j.slot || undefined,
    address: j.address || j.location || j.area || undefined,
    notes: j.notes || undefined,
    dateIso: j.createdAt || j.orderedAt || j.at || undefined,
  };
}

/* ---------- component ---------- */


function medreachText(value: unknown) {
  if (typeof value !== 'string') return '';
  const text = value.trim();
  return text && text !== '[object Object]' ? text : '';
}

function medreachRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function medreachIdentityRecords(...values: unknown[]) {
  const out: Record<string, unknown>[] = [];

  for (const value of values) {
    const root = medreachRecord(value);
    if (!Object.keys(root).length) continue;

    out.push(root);

    for (const key of [
      'profileMeta',
      'meta',
      'visualIdentity',
      'lab',
      'labProfile',
      'assignedLab',
      'phleb',
      'phlebProfile',
      'assignedPhleb',
      'phlebotomist',
      'phlebotomistProfile',
    ]) {
      const child = medreachRecord(root[key]);
      if (Object.keys(child).length) {
        out.push(child);

        const childProfileMeta = medreachRecord(child.profileMeta);
        if (Object.keys(childProfileMeta).length) out.push(childProfileMeta);

        const childVisualIdentity = medreachRecord(child.visualIdentity || childProfileMeta.visualIdentity);
        if (Object.keys(childVisualIdentity).length) out.push(childVisualIdentity);
      }
    }

    const rootVisualIdentity = medreachRecord(root.visualIdentity || medreachRecord(root.profileMeta).visualIdentity);
    if (Object.keys(rootVisualIdentity).length) out.push(rootVisualIdentity);
  }

  return out;
}

function medreachIdentityValue(values: unknown[], keys: string[]) {
  for (const source of medreachIdentityRecords(...values)) {
    for (const key of keys) {
      const value = medreachText(source[key]);
      if (value) return value;
    }
  }

  return '';
}

function medreachInitials(value: string, fallback: string) {
  const parts = value
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (!parts.length) return fallback;

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function MedReachPartnerImage({
  imageUrl,
  name,
  fallback,
  altKind,
}: {
  imageUrl?: string | null;
  name: string;
  fallback: string;
  altKind: string;
}) {
  const safeImageUrl = medreachText(imageUrl);

  if (safeImageUrl) {
    return (
      <img
        src={safeImageUrl}
        alt={`${name} ${altKind}`}
        className="h-12 w-12 shrink-0 rounded-2xl border border-slate-200 object-cover"
      />
    );
  }

  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 text-sm font-black text-emerald-800">
      {medreachInitials(name, fallback)}
    </div>
  );
}

function MedReachPartnerIdentity({
  job,
  phleb,
  labLoc,
}: {
  job: MedReachJob | null;
  phleb: PhlebProfile | null;
  labLoc: CollectionLocation | null;
}) {
  const jobAny = job as MedReachJob | null;

  const labName =
    medreachIdentityValue([jobAny, labLoc], ['labDisplayName', 'labName', 'displayName', 'tradingName', 'name']) ||
    medreachText(labLoc?.name) ||
    'Assigned lab pending';

  const labRegisteredName = medreachIdentityValue([jobAny, labLoc], [
    'labRegisteredName',
    'registeredName',
    'registeredLegalName',
    'legalName',
  ]);

  const labLogoUrl = medreachIdentityValue([jobAny, labLoc], [
    'labLogoUrl',
    'logoUrl',
    'logoDataUrl',
    'imageUrl',
  ]);

  const labAddress =
    medreachIdentityValue([jobAny, labLoc], ['labAddress', 'address', 'location']) ||
    medreachText(labLoc?.address);

  const labAccreditation = medreachIdentityValue([jobAny, labLoc], [
    'labAccreditation',
    'accreditation',
    'accreditationNumber',
    'registrationNumber',
    'licenseNumber',
    'licenceNumber',
  ]);

  const phlebName =
    medreachText(phleb?.name) ||
    medreachIdentityValue([jobAny, phleb], ['phlebName', 'phlebotomist', 'displayName', 'name']) ||
    'Assigned phlebotomist pending';

  const phlebAvatar =
    medreachText(phleb?.avatar) ||
    medreachIdentityValue([jobAny, phleb], [
      'phlebAvatarUrl',
      'phlebAvatar',
      'avatarUrl',
      'avatar',
      'photoUrl',
      'profilePhoto',
      'profileImage',
      'imageUrl',
    ]);

  const phlebVehicle =
    medreachText(phleb?.vehicle) ||
    medreachIdentityValue([jobAny, phleb], ['phlebVehicle', 'vehicle', 'vehicleType']);

  const phlebReg =
    medreachText(phleb?.regPlate) ||
    medreachIdentityValue([jobAny, phleb], ['phlebRegPlate', 'regPlate', 'vehicleReg', 'vehicleRegistration', 'registration']);

  const phlebHpcsa = medreachIdentityValue([jobAny, phleb], [
    'phlebHpcsaNumber',
    'hpcsaNumber',
    'hpcsa',
    'qualificationRegistration',
    'professionalRegistration',
  ]);

  return (
    <section
      data-a4p3="medreach-tracking-partner-identity"
      className="grid gap-3 md:grid-cols-2"
      aria-label="MedReach lab and phlebotomist identity"
    >
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex min-w-0 items-start gap-3">
          <MedReachPartnerImage imageUrl={labLogoUrl} name={labName} fallback="Lab" altKind="logo" />
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-wide text-slate-400">
              Laboratory
            </div>
            <div className="truncate text-sm font-bold text-slate-950">{labName}</div>
            {labRegisteredName && labRegisteredName !== labName ? (
              <div className="truncate text-xs text-slate-500">{labRegisteredName}</div>
            ) : null}
            {labAddress ? <div className="mt-1 truncate text-xs text-slate-500">{labAddress}</div> : null}
            {labAccreditation ? (
              <div className="mt-1 text-[11px] font-semibold text-slate-500">
                Accreditation/licence {labAccreditation}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex min-w-0 items-start gap-3">
          <MedReachPartnerImage imageUrl={phlebAvatar} name={phlebName} fallback="PB" altKind="photo" />
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-wide text-slate-400">
              Phlebotomist
            </div>
            <div className="truncate text-sm font-bold text-slate-950">{phlebName}</div>
            {phlebVehicle ? <div className="truncate text-xs text-slate-500">{phlebVehicle}</div> : null}
            {phlebReg ? (
              <div className="mt-1 text-[11px] font-semibold text-slate-500">
                Vehicle reg {phlebReg}
              </div>
            ) : null}
            {phlebHpcsa ? (
              <div className="mt-1 text-[11px] font-semibold text-slate-500">
                HPCSA/professional ref {phlebHpcsa}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function MedReachTrackPageContent() {
  const searchParams = useSearchParams();
  const qs = searchParams ?? new URLSearchParams();

  const initialId =
    qs.get('id') ||
    qs.get('labId') ||
    qs.get('jobId') ||
    'LAB-2001';

  const [labId] = useState(initialId);
  const [job, setJob] = useState<MedReachJob | null>(null);
  const [timeline, setTimeline] = useState<LabTimelineEntry[]>([]);
  const [loadingJob, setLoadingJob] = useState(false);
  const [loadingTl, setLoadingTl] = useState(false);
  const [jobError, setJobError] = useState<string | null>(null);
  const [tlError, setTlError] = useState<string | null>(null);

  // Even though we don't render the map, keep coords mapping for future use
  const [coords, setCoords] = useState<Coord[]>([]);

  // load job detail
  useEffect(() => {
    let mounted = true;
    const ac = new AbortController();

    (async () => {
      setLoadingJob(true);
      setJobError(null);
      try {
        const res = await fetch(
          `/api/medreach/jobs/${encodeURIComponent(labId)}`,
          {
            cache: 'no-store',
            signal: ac.signal,
          },
        );
        if (!mounted) return;
        if (!res.ok) {
          if (res.status === 404) {
            setJob(null);
            setJobError('We could not find this MedReach job.');
          } else {
            throw new Error(`HTTP ${res.status}`);
          }
          return;
        }
        const data = await res.json();
        const j = (data.job || data) as MedReachJob;
        setJob(j);
        setCoords(mapJobToCoords(j));
      } catch (e: any) {
        if (!mounted) return;
        console.warn('MedReach track: job load failed', e);
        setJob(null);
        setCoords([]);
        setJobError('Unable to load job details.');
      } finally {
        if (mounted) setLoadingJob(false);
      }
    })();

    return () => {
      mounted = false;
      ac.abort();
    };
  }, [labId]);

  // load timeline
  useEffect(() => {
    let mounted = true;
    const ac = new AbortController();

    (async () => {
      setLoadingTl(true);
      setTlError(null);
      try {
        const res = await fetch(
          `/api/medreach/timeline?id=${encodeURIComponent(labId)}`,
          { cache: 'no-store', signal: ac.signal },
        );
        if (!mounted) return;
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const raw = Array.isArray(data.timeline) ? data.timeline : [];
        const mapped: LabTimelineEntry[] = raw.map((it: any) => ({
          status: it.status,
          at: it.at,
          note: it.note,
        }));
        setTimeline(mapped);
      } catch (e: any) {
        if (!mounted) return;
        console.warn('MedReach track: timeline load failed', e);
        setTimeline([]);
        setTlError('Unable to load status history.');
      } finally {
        if (mounted) setLoadingTl(false);
      }
    })();

    return () => {
      mounted = false;
      ac.abort();
    };
  }, [labId]);

  const phleb = useMemo(() => mapJobToPhleb(job), [job]);
  const patientLoc = useMemo(() => mapJobToPatientLoc(job), [job]);
  const labLoc = useMemo(() => mapJobToLabLoc(job), [job]);
  const details = useMemo(() => mapJobToCollectionDetails(job), [job]);

  const jobStatus = normalizeToJobStatus(job?.status);
  const etaText = job?.eta || 'â€”';
  const headerTitle = job?.patient
    ? `Collection for ${job.patient}`
    : 'MedReach collection tracking';

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Header */}
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{headerTitle}</h1>
          <p className="text-sm text-gray-500 mt-1">
            Live status and timeline for your home sample collection.
          </p>
          <div className="text-xs text-gray-500 mt-1">
            Job ID:&nbsp;
            <span className="font-mono font-medium">{labId}</span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <JobStatusPill status={jobStatus} />
          <div className="text-xs text-gray-500">
            ETA: <span className="font-medium">{etaText}</span>
          </div>
          <Link
            href="/medreach"
            className="px-3 py-1 border rounded-full bg-white hover:bg-gray-50 text-xs"
          >
            Back to MedReach
          </Link>
        </div>
      </header>

      <MedReachPartnerIdentity job={job} phleb={phleb} labLoc={labLoc} />

      {/* Map-ish summary (no embedded map) */}
      <section className="bg-white border rounded-lg p-4 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div className="space-y-1 text-sm">
          <div className="font-medium">
            {patientLoc?.name || job?.patient || 'Home collection'}
          </div>
          {patientLoc?.address && (
            <div className="text-xs text-gray-500">{patientLoc.address}</div>
          )}
          {details.collectionWindow && (
            <div className="text-xs text-gray-500">
              Collection window:{' '}
              <span className="font-medium">{details.collectionWindow}</span>
            </div>
          )}
          {labLoc?.name && (
            <div className="text-xs text-gray-500">
              Lab:&nbsp;
              <span className="font-medium">{labLoc.name}</span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          {phleb?.phoneMasked && (
            <a
              href={phleb.phone ? `tel:${phleb.phone}` : undefined}
              className="px-3 py-2 text-xs md:text-sm border rounded bg-white hover:bg-gray-50"
            >
              Call phlebotomist
            </a>
          )}
        </div>
      </section>

      {/* Collection details */}
      <section>
        <CollectionDetails order={details} />
      </section>

      {/* Timeline */}
      <section className="bg-white border rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">Status history</h2>
          {(loadingTl || tlError) && (
            <div className="text-xs text-gray-500">
              {loadingTl ? 'Loadingâ€¦' : tlError}
            </div>
          )}
        </div>

        {timeline.length === 0 && !loadingTl ? (
          <div className="text-sm text-gray-500">
            No timeline entries yet for this job.
          </div>
        ) : (
          <ul className="space-y-2 text-sm">
            {timeline.map((it, i) => (
              <LabTimelineItem key={`${it.status}-${it.at}-${i}`} item={it} />
            ))}
          </ul>
        )}
      </section>

      {/* Job error */}
      {jobError && <div className="text-xs text-rose-600">{jobError}</div>}
    </main>
  );
}

export default function MedReachTrackPage() {
  return (
    <Suspense fallback={null}>
      <MedReachTrackPageContent />
    </Suspense>
  );
}

