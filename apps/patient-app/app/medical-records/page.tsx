// apps/patient-app/app/medical-records/page.tsx
'use client';

import Link from 'next/link';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Download,
  FileText,
  Filter,
  FlaskConical,
  HeartPulse,
  Image as ImageIcon,
  Loader2,
  Pill,
  Search,
  Share2,
  ShieldCheck,
  Upload,
  X,
  AlertTriangle,
  Stethoscope,
} from 'lucide-react';

import { toast } from '@/components/ToastMount';

type RecordDocType = 'clinical-note' | 'lab-report' | 'imaging-report' | 'prescription' | 'referral' | 'other';
type LabFlag = 'low' | 'high' | 'critical' | 'normal' | 'abnormal';

type PatientMini = {
  id: string;
  displayName: string;
  dob?: string; // yyyy-mm-dd
  sex?: 'female' | 'male' | 'other' | 'prefer_not';
  mrn?: string;
};

type EncounterMini = {
  id: string;
  date: string; // ISO
  clinicianName?: string;
  specialty?: string;
  reason?: string;
  summary?: string;
  linkHref?: string; // e.g. /encounters/<id>
};

type MedicationMini = {
  id: string;
  name: string;
  dose?: string;
  route?: string;
  frequency?: string;
  status: 'active' | 'stopped' | 'completed';
  startDate?: string; // ISO
  endDate?: string; // ISO
  prescriber?: string;
};

type AllergyMini = {
  id: string;
  allergen: string;
  reaction?: string;
  severity?: 'mild' | 'moderate' | 'severe';
  notedAt?: string; // ISO
};

type ImmunisationMini = {
  id: string;
  name: string;
  date: string; // ISO
  dose?: string;
  provider?: string;
};

type LabMini = {
  id: string;
  date: string; // ISO
  panel?: string;
  test: string;
  value: string;
  unit?: string;
  ref?: string;
  flag?: LabFlag;
  orderingClinician?: string;
  orderId?: string;
  source?: string;
  resultStatus?: string;
  resultPdfUrl?: string;
  resultReadyAt?: string;
  resultSentAt?: string;
  specimenBundleId?: string;
  labName?: string;
  reviewSubmitted?: boolean;
};

type ImagingMini = {
  id: string;
  date: string; // ISO
  modality?: string; // XR, CT, MRI, US
  study: string;
  impression?: string;
  reportDocId?: string; // link to a document in docs[]
};

type RecordDocument = {
  id: string;
  date: string; // ISO
  title: string;
  type: RecordDocType;
  source?: string; // facility/provider
  fileName?: string;
  mimeType?: string;
  sizeBytes?: number;
  // If your backend returns a signed URL, put it here:
  downloadUrl?: string;
  // Optional: deep-link to viewer route
  viewHref?: string;
};

type MedicalRecordsBundle = {
  ok: boolean;
  patient: PatientMini;
  updatedAt: string; // ISO
  problems?: { id: string; name: string; status?: 'active' | 'resolved'; notedAt?: string }[];
  encounters?: EncounterMini[];
  medications?: MedicationMini[];
  allergies?: AllergyMini[];
  immunisations?: ImmunisationMini[];
  labs?: LabMini[];
  imaging?: ImagingMini[];
  docs?: RecordDocument[];
};

type TabKey =
  | 'overview'
  | 'timeline'
  | 'documents'
  | 'labs'
  | 'imaging'
  | 'medications'
  | 'allergies'
  | 'immunisations'
  | 'sharing';

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(' ');
}

function fmtDate(iso?: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
}

function fmtDateTime(iso?: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function bytes(n?: number) {
  if (!n || n <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

async function safeJsonFetch<T>(url: string, init?: RequestInit, timeoutMs = 12_000): Promise<T | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as T;
    return data;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/* ---------------------------------------------
   Small UI bits (local, zero deps)
----------------------------------------------*/
function PillBadge({ text, tone }: { text: string; tone?: 'neutral' | 'ok' | 'warn' | 'danger' }) {
  const cls =
    tone === 'ok'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
      : tone === 'warn'
        ? 'border-amber-200 bg-amber-50 text-amber-800'
        : tone === 'danger'
          ? 'border-rose-200 bg-rose-50 text-rose-800'
          : 'border-slate-200 bg-white text-slate-700';
  return <span className={cx('inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-extrabold', cls)}>{text}</span>;
}

function Card({
  title,
  icon: Icon,
  right,
  children,
}: {
  title: React.ReactNode;
  icon?: any;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm shadow-black/5">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div className="flex items-center gap-2 min-w-0">
          {Icon ? (
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200 bg-white">
              <Icon className="h-4 w-4 text-slate-700" />
            </span>
          ) : null}
          <div className="min-w-0">
            <div className="text-sm font-black text-slate-950 truncate">{title}</div>
          </div>
        </div>
        {right}
      </div>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

function SegTabs({
  value,
  onChange,
  tabs,
}: {
  value: TabKey;
  onChange: (v: TabKey) => void;
  tabs: Array<{ key: TabKey; label: string; icon?: any }>;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-1 shadow-sm shadow-black/5 overflow-x-auto">
      <div className="flex items-center gap-1 min-w-max">
        {tabs.map((t) => {
          const active = t.key === value;
          const I = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => onChange(t.key)}
              className={cx(
                'inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-extrabold transition',
                active ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-50',
              )}
              type="button"
            >
              {I ? <I className={cx('h-4 w-4', active ? 'text-white' : 'text-slate-500')} /> : null}
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  desc,
  action,
}: {
  icon: any;
  title: string;
  desc: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center">
      <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white">
        <Icon className="h-5 w-5 text-slate-700" />
      </div>
      <div className="mt-3 text-base font-black text-slate-950">{title}</div>
      <div className="mt-1 text-sm text-slate-600">{desc}</div>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export default function MedicalRecordsPage() {
  const pathname = '/medical-records';

  const [loading, setLoading] = useState(true);
  const [bundle, setBundle] = useState<MedicalRecordsBundle | null>(null);

  const [tab, setTab] = useState<TabKey>('overview');
  const [q, setQ] = useState('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [shareScope, setShareScope] = useState<'full_record' | 'documents_only' | 'labs_only'>('documents_only');
  const [shareTtlHours, setShareTtlHours] = useState<1 | 6 | 12 | 24 | 72>(24);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const tabs = useMemo(
    () =>
      [
        { key: 'overview', label: 'Overview', icon: HeartPulse },
        { key: 'timeline', label: 'Timeline', icon: Calendar },
        { key: 'documents', label: 'Documents', icon: FileText },
        { key: 'labs', label: 'Labs', icon: FlaskConical },
        { key: 'imaging', label: 'Imaging', icon: ImageIcon },
        { key: 'medications', label: 'Meds', icon: Pill },
        { key: 'allergies', label: 'Allergies', icon: AlertTriangle },
        { key: 'immunisations', label: 'Immunisations', icon: ShieldCheck },
        { key: 'sharing', label: 'Sharing', icon: Share2 },
      ] as Array<{ key: TabKey; label: string; icon?: any }>,
    [],
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);

      const live = await safeJsonFetch<MedicalRecordsBundle>('/api/medical-records');
      if (!alive) return;

      if (live?.ok) {
        setBundle(live);
      } else {
        setBundle(null);
      }

      setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, []);

  const patient = bundle?.patient;

  const problems = bundle?.problems || [];
  const encounters = bundle?.encounters || [];
  const meds = bundle?.medications || [];
  const allergies = bundle?.allergies || [];
  const immunisations = bundle?.immunisations || [];
  const labs = bundle?.labs || [];
  const imaging = bundle?.imaging || [];
  const docs = bundle?.docs || [];

  const normalizedQuery = q.trim().toLowerCase();

  const inDateRange = (iso: string) => {
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return true;
    if (dateFrom) {
      const f = new Date(dateFrom).getTime();
      if (!Number.isNaN(f) && t < f) return false;
    }
    if (dateTo) {
      const to = new Date(dateTo).getTime();
      if (!Number.isNaN(to) && t > to) return false;
    }
    return true;
  };

  const filteredDocs = useMemo(() => {
    return docs
      .filter((d) => inDateRange(d.date))
      .filter((d) => {
        if (!normalizedQuery) return true;
        return (
          d.title.toLowerCase().includes(normalizedQuery) ||
          (d.type || '').toLowerCase().includes(normalizedQuery) ||
          (d.source || '').toLowerCase().includes(normalizedQuery) ||
          (d.fileName || '').toLowerCase().includes(normalizedQuery)
        );
      })
      .sort((a, b) => +new Date(b.date) - +new Date(a.date));
  }, [docs, normalizedQuery, dateFrom, dateTo]);

  const filteredLabs = useMemo(() => {
    return labs
      .filter((l) => inDateRange(l.date))
      .filter((l) => {
        if (!normalizedQuery) return true;
        const blob = `${l.panel || ''} ${l.test} ${l.value} ${l.unit || ''} ${l.ref || ''} ${l.source || ''} ${l.resultStatus || ''} ${l.labName || ''} ${l.orderId || ''}`.toLowerCase();
        return blob.includes(normalizedQuery);
      })
      .sort((a, b) => +new Date(b.date) - +new Date(a.date));
  }, [labs, normalizedQuery, dateFrom, dateTo]);

  const filteredEncounters = useMemo(() => {
    return encounters
      .filter((e) => inDateRange(e.date))
      .filter((e) => {
        if (!normalizedQuery) return true;
        const blob = `${e.clinicianName || ''} ${e.specialty || ''} ${e.reason || ''} ${e.summary || ''}`.toLowerCase();
        return blob.includes(normalizedQuery);
      })
      .sort((a, b) => +new Date(b.date) - +new Date(a.date));
  }, [encounters, normalizedQuery, dateFrom, dateTo]);

  const timelineItems = useMemo(() => {
    const items: Array<{
      id: string;
      date: string;
      kind: 'encounter' | 'doc' | 'lab' | 'imaging';
      title: string;
      subtitle?: string;
      icon: any;
      href?: string;
      badge?: { text: string; tone?: 'neutral' | 'ok' | 'warn' | 'danger' };
    }> = [];

    for (const e of filteredEncounters) {
      items.push({
        id: `enc_${e.id}`,
        date: e.date,
        kind: 'encounter',
        title: e.reason || 'Encounter',
        subtitle: `${e.clinicianName || 'Clinician'}${e.specialty ? ` • ${e.specialty}` : ''}${e.summary ? ` • ${e.summary}` : ''}`,
        icon: Stethoscope,
        href: e.linkHref || '/encounters',
        badge: { text: 'Encounter', tone: 'neutral' },
      });
    }

    for (const d of filteredDocs) {
      items.push({
        id: `doc_${d.id}`,
        date: d.date,
        kind: 'doc',
        title: d.title,
        subtitle: `${d.source || 'Document'}${d.fileName ? ` • ${d.fileName}` : ''}`,
        icon: FileText,
        href: d.viewHref || (d.downloadUrl ? d.downloadUrl : undefined),
        badge: { text: d.type.replace('-', ' '), tone: 'neutral' },
      });
    }

    for (const l of filteredLabs.slice(0, 12)) {
      const tone =
        l.flag === 'critical' ? 'danger' : l.flag === 'high' || l.flag === 'low' || l.flag === 'abnormal' ? 'warn' : l.flag === 'normal' ? 'ok' : 'neutral';
      items.push({
        id: `lab_${l.id}`,
        date: l.date,
        kind: 'lab',
        title: `${l.test}: ${l.value}${l.unit ? ` ${l.unit}` : ''}`,
        subtitle: `${l.panel || 'Lab'}${l.ref ? ` • Ref: ${l.ref}` : ''}`,
        icon: FlaskConical,
        badge: { text: l.flag || 'lab', tone },
      });
    }

    for (const im of imaging.filter((x) => inDateRange(x.date))) {
      items.push({
        id: `img_${im.id}`,
        date: im.date,
        kind: 'imaging',
        title: `${im.modality ? `${im.modality} • ` : ''}${im.study}`,
        subtitle: im.impression || 'Impression not available.',
        icon: ImageIcon,
        badge: { text: 'imaging', tone: 'neutral' },
      });
    }

    return items.sort((a, b) => +new Date(b.date) - +new Date(a.date)).slice(0, 30);
  }, [filteredDocs, filteredLabs, filteredEncounters, imaging, dateFrom, dateTo]);

  const counts = useMemo(() => {
    const activeMeds = meds.filter((m) => m.status === 'active').length;
    const allergyCount = allergies.length;
    const docCount = docs.length;
    const labAbnormal = labs.filter((l) => l.flag && l.flag !== 'normal').length;
    return { activeMeds, allergyCount, docCount, labAbnormal };
  }, [meds, allergies, docs, labs]);

  const headerSub = useMemo(() => {
    const parts: string[] = [];
    if (patient?.mrn) parts.push(`MRN ${patient.mrn}`);
    if (patient?.dob) parts.push(`DOB ${patient.dob}`);
    if (bundle?.updatedAt) parts.push(`Updated ${fmtDateTime(bundle.updatedAt)}`);
    return parts.join(' • ');
  }, [patient?.mrn, patient?.dob, bundle?.updatedAt]);

  async function doExport() {
    if (!bundle || exporting) return;

    setExporting(true);
    try {
      const res = await fetch('/api/reports/export', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind: 'medical-records' }),
      });

      const blob = await res.blob();
      if (!res.ok || !blob.size) {
        const text = await blob.text().catch(() => '');
        throw new Error(text || 'Export failed.');
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ambulant-health-records-${patient?.id || 'patient'}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast('Exported health records PDF.', 'success');
    } catch (error: any) {
      toast(error?.message || 'Export failed.', 'error');
    } finally {
      setExporting(false);
    }
  }

  function doShare() {
    const url = typeof window !== 'undefined' ? `${window.location.origin}${pathname}` : pathname;

    if (typeof navigator !== 'undefined' && (navigator as any).share) {
      (navigator as any)
        .share({ title: 'Ambulant+ Health Records', text: 'View my health records', url })
        .catch(() => {});
      return;
    }

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(url);
        toast('Link copied to clipboard.', 'success');
      } else {
        toast('Sharing not available on this device.', 'info');
      }
    } catch {
      toast('Could not copy link.', 'error');
    }
  }

  function onUploadClick() {
    setUploadOpen(true);
    setTimeout(() => fileRef.current?.click(), 200);
  }

  async function onFilesChosen(files: FileList | null) {
    setUploadOpen(false);
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      let uploaded = 0;

      for (const file of Array.from(files)) {
        const form = new FormData();
        form.set('file', file);
        form.set('documentKind', file.type.startsWith('image/') ? 'imaging-report' : 'other');
        form.set('title', file.name.replace(/\.[^.]+$/, '') || file.name);

        const res = await fetch('/api/medical-records/upload', {
          method: 'POST',
          body: form,
        });

        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.ok) {
          throw new Error(data?.message || data?.error || `Upload failed for ${file.name}`);
        }

        uploaded += 1;
      }

      toast(`Uploaded ${uploaded} document(s) to your medical records.`, 'success');
      window.location.reload();
    } catch (error: any) {
      toast(error?.message || 'Document upload failed.', 'error');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function createTimeLimitedShareLink() {
    const consent = window.confirm(
      'Create a time-limited medical record share link? Only share this with a trusted recipient. Access will be logged.',
    );

    if (!consent) return;

    setShareBusy(true);
    try {
      const res = await fetch('/api/medical-records/share', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          scope: shareScope,
          ttlHours: shareTtlHours,
          consentConfirmed: true,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok || !data?.share?.shareUrl) {
        throw new Error(data?.error || 'Could not create share link.');
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(data.share.shareUrl);
        toast('Time-limited share link copied to clipboard.', 'success');
      } else {
        toast(data.share.shareUrl, 'info');
      }
    } catch (error: any) {
      toast(error?.message || 'Could not create share link.', 'error');
    } finally {
      setShareBusy(false);
    }
  }

  const TopBar = (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm shadow-black/5">
            <FileText className="h-5 w-5 text-slate-800" />
          </div>
          <div className="min-w-0">
            <div className="text-xl font-black text-slate-950 leading-tight truncate">Health Records</div>
            <div className="text-xs text-slate-600 truncate">
              {patient?.displayName ? patient.displayName : 'Patient'}{headerSub ? ` • ${headerSub}` : ''}
            </div>
          </div>
        </div>

        <div className="mt-2 inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-900">
          <CheckCircle2 className="h-4 w-4" />
          Live records connected
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={doShare}
          className={cx(
            'inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-extrabold text-slate-800',
            'hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/25',
          )}
        >
          <Share2 className="h-4 w-4" />
          Share
        </button>

        <button
          type="button"
          onClick={doExport}
          disabled={exporting}
          className={cx(
            'inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-extrabold text-slate-800',
            'hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/25',
          )}
        >
          <Download className="h-4 w-4" />
          {exporting ? 'Exporting…' : 'Export'}
        </button>

        <button
          type="button"
          onClick={onUploadClick}
          className={cx(
            'inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-900 px-3 py-2 text-sm font-extrabold text-white',
            'hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/25',
          )}
        >
          <Upload className="h-4 w-4" />
          {uploading ? 'Uploading…' : 'Upload'}
        </button>

        <input
          ref={fileRef}
          type="file"
          className="hidden"
          multiple
          onChange={(e) => onFilesChosen(e.target.files)}
          accept=".pdf,.png,.jpg,.jpeg,.webp"
        />
      </div>
    </div>
  );

  if (loading) {
    return (
      <main data-p-ui="patient-medical-records-page" className="min-w-0 overflow-x-clip min-h-[calc(100vh-0px)] bg-white">
        <div className="mx-auto max-w-6xl px-4 py-6">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-extrabold text-slate-800 hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
          </div>

          <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-black/5">
            <div className="flex items-center gap-3 text-slate-700">
              <Loader2 className="h-5 w-5 animate-spin" />
              <div className="text-sm font-bold">Loading Health Records…</div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!bundle) {
    return (
      <main data-p-ui="patient-medical-records-page" className="min-w-0 overflow-x-clip min-h-[calc(100vh-0px)] bg-white">
        <div className="mx-auto max-w-6xl px-4 py-6">
          <EmptyState
            icon={FileText}
            title="Records unavailable"
            desc="We couldn’t load medical records right now."
            action={
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-extrabold text-white hover:bg-slate-800"
              >
                Retry
              </button>
            }
          />
        </div>
      </main>
    );
  }

  return (
    <main data-p-ui="patient-medical-records-page" className="min-w-0 overflow-x-clip min-h-[calc(100vh-0px)] bg-white">
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-extrabold text-slate-800 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>

          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-600">
            <ShieldCheck className="h-4 w-4 text-emerald-700" />
            POPIA-safe sharing • Consent-based access
          </div>
        </div>

        <div className="mt-5">{TopBar}</div>

        <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search records… (labs, notes, meds, allergies)"
                className={cx(
                  'w-full rounded-2xl border border-slate-200 bg-white px-10 py-3 text-sm',
                  'focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-300',
                )}
              />
            </div>
          </div>

          <div className="lg:col-span-5 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2">
              <div className="flex items-center gap-2 text-xs font-black text-slate-700">
                <Filter className="h-4 w-4 text-slate-500" />
                From
              </div>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/25"
              />
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2">
              <div className="flex items-center gap-2 text-xs font-black text-slate-700">
                <Filter className="h-4 w-4 text-slate-500" />
                To
              </div>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/25"
              />
            </div>
          </div>
        </div>

        <div className="mt-5">
          <SegTabs value={tab} onChange={setTab} tabs={tabs} />
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="lg:col-span-8 space-y-4">
            {tab === 'overview' ? (
              <>
                <Card
                  title="At a glance"
                  icon={HeartPulse}
                  right={
                    <Link
                      href="/encounters"
                      className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-extrabold text-slate-800 hover:bg-slate-50"
                    >
                      <ClipboardList className="h-4 w-4" />
                      Encounters
                    </Link>
                  }
                >
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="text-xs font-black text-slate-500">Active meds</div>
                      <div className="mt-1 text-2xl font-black text-slate-950">{counts.activeMeds}</div>
                      <div className="mt-2 text-xs text-slate-600">Review regularly with your clinician.</div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="text-xs font-black text-slate-500">Allergies</div>
                      <div className="mt-1 text-2xl font-black text-slate-950">{counts.allergyCount}</div>
                      <div className="mt-2 text-xs text-slate-600">Ensure reactions are accurate.</div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="text-xs font-black text-slate-500">Documents</div>
                      <div className="mt-1 text-2xl font-black text-slate-950">{counts.docCount}</div>
                      <div className="mt-2 text-xs text-slate-600">Notes, reports, referrals.</div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="text-xs font-black text-slate-500">Abnormal labs</div>
                      <div className="mt-1 text-2xl font-black text-slate-950">{counts.labAbnormal}</div>
                      <div className="mt-2 text-xs text-slate-600">Tap Labs to review details.</div>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start gap-3">
                      <div className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200 bg-white">
                        <ShieldCheck className="h-4 w-4 text-emerald-700" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-black text-slate-950">Privacy & consent</div>
                        <div className="mt-1 text-sm text-slate-600">
                          Sharing is designed to be consent-based and time-limited.
                          Avoid uploading sensitive documents you don’t want in your record.
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>

                <Card title="Problems & conditions" icon={ClipboardList}>
                  {problems.length === 0 ? (
                    <EmptyState icon={ClipboardList} title="No problems listed" desc="Add conditions as they’re confirmed by a clinician." />
                  ) : (
                    <div className="space-y-2">
                      {problems.map((p) => (
                        <div key={p.id} className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                          <div className="min-w-0">
                            <div className="text-sm font-black text-slate-950">{p.name}</div>
                            <div className="mt-1 text-xs text-slate-600">Noted: {fmtDate(p.notedAt)}</div>
                          </div>
                          <PillBadge text={p.status === 'resolved' ? 'resolved' : 'active'} tone={p.status === 'resolved' ? 'ok' : 'neutral'} />
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </>
            ) : null}

            {tab === 'timeline' ? (
              <Card title="Timeline" icon={Calendar}>
                {timelineItems.length === 0 ? (
                  <EmptyState icon={Calendar} title="No events found" desc="Try clearing your search or date filters." />
                ) : (
                  <div className="space-y-2">
                    {timelineItems.map((it) => {
                      const I = it.icon;
                      const content = (
                        <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 hover:bg-slate-50 transition">
                          <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white">
                            <I className="h-4 w-4 text-slate-700" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <div className="text-sm font-black text-slate-950 truncate">{it.title}</div>
                              {it.badge ? <PillBadge text={it.badge.text} tone={it.badge.tone} /> : null}
                            </div>
                            <div className="mt-1 text-xs text-slate-600">{fmtDateTime(it.date)}</div>
                            {it.subtitle ? <div className="mt-2 text-sm text-slate-700">{it.subtitle}</div> : null}
                          </div>
                        </div>
                      );

                      if (it.href) {
                        return (
                          <Link key={it.id} href={it.href} className="block">
                            {content}
                          </Link>
                        );
                      }
                      return <div key={it.id}>{content}</div>;
                    })}
                  </div>
                )}
              </Card>
            ) : null}

            {tab === 'documents' ? (
              <Card
                title="Documents"
                icon={FileText}
                right={
                  <button
                    type="button"
                    onClick={onUploadClick}
                    className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-3 py-2 text-sm font-extrabold text-white hover:bg-slate-800"
                  >
                    <Upload className="h-4 w-4" />
                      {uploading ? 'Uploading…' : 'Upload'}
                  </button>
                }
              >
                {filteredDocs.length === 0 ? (
                  <EmptyState icon={FileText} title="No documents found" desc="Upload PDFs or lab reports, or clear your filters." />
                ) : (
                  <div className="space-y-2">
                    {filteredDocs.map((d) => (
                      <div key={d.id} className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-black text-slate-950 truncate">{d.title}</div>
                            <PillBadge text={d.type.replace('-', ' ')} />
                          </div>
                          <div className="mt-1 text-xs text-slate-600">
                            {fmtDateTime(d.date)} {d.source ? ` • ${d.source}` : ''} {d.fileName ? ` • ${d.fileName}` : ''}{' '}
                            {d.sizeBytes ? ` • ${bytes(d.sizeBytes)}` : ''}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {d.downloadUrl ? (
                            <Link
                              href={d.downloadUrl}
                              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-extrabold text-slate-800 hover:bg-slate-50"
                            >
                              <Download className="h-4 w-4" />
                              Download
                            </Link>
                          ) : (
                            <button
                              type="button"
                              onClick={() => toast('Download URL is not available for this document.', 'info')}
                              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-extrabold text-slate-800 hover:bg-slate-50"
                            >
                              <Download className="h-4 w-4" />
                              Download
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            ) : null}

            {tab === 'labs' ? (
              <Card title="Labs" icon={FlaskConical}>
                {filteredLabs.length === 0 ? (
                  <EmptyState icon={FlaskConical} title="No labs found" desc="Your lab results will show up here once connected." />
                ) : (
                  <div className="space-y-2">
                    {filteredLabs.map((l) => {
                      const tone =
                        l.flag === 'critical' ? 'danger' : l.flag === 'high' || l.flag === 'low' ? 'warn' : l.flag === 'normal' ? 'ok' : 'neutral';
                      return (
                        <div key={l.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <div className="text-sm font-black text-slate-950 truncate">
                                  {l.test}: {l.value}
                                  {l.unit ? ` ${l.unit}` : ''}
                                </div>
                                <PillBadge text={l.flag || 'lab'} tone={tone} />
                              </div>
                              <div className="mt-1 text-xs text-slate-600">
                                {fmtDateTime(l.date)} {l.panel ? ` • ${l.panel}` : ''} {l.ref ? ` • Ref: ${l.ref}` : ''}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            ) : null}

            {tab === 'imaging' ? (
              <Card title="Imaging" icon={ImageIcon}>
                {imaging.length === 0 ? (
                  <EmptyState icon={ImageIcon} title="No imaging yet" desc="Radiology reports will show here once available." />
                ) : (
                  <div className="space-y-2">
                    {imaging
                      .filter((x) => inDateRange(x.date))
                      .map((im) => (
                        <div key={im.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-black text-slate-950 truncate">
                                {im.modality ? `${im.modality} • ` : ''}
                                {im.study}
                              </div>
                              <div className="mt-1 text-xs text-slate-600">{fmtDateTime(im.date)}</div>
                              <div className="mt-2 text-sm text-slate-700">{im.impression || 'Impression not available.'}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </Card>
            ) : null}

            {tab === 'medications' ? (
              <Card title="Medications" icon={Pill}>
                {meds.length === 0 ? (
                  <EmptyState icon={Pill} title="No meds listed" desc="Your prescriptions will appear here once connected." />
                ) : (
                  <div className="space-y-2">
                    {meds.map((m) => (
                      <div key={m.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <div className="text-sm font-black text-slate-950 truncate">{m.name}</div>
                              <PillBadge text={m.status} tone={m.status === 'active' ? 'ok' : 'neutral'} />
                            </div>
                            <div className="mt-1 text-sm text-slate-700">
                              {[m.dose, m.route, m.frequency].filter(Boolean).join(' • ') || '—'}
                            </div>
                            <div className="mt-2 text-xs text-slate-600">
                              Start: {fmtDate(m.startDate)} {m.endDate ? ` • End: ${fmtDate(m.endDate)}` : ''}{' '}
                              {m.prescriber ? ` • Prescriber: ${m.prescriber}` : ''}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            ) : null}

            {tab === 'allergies' ? (
              <Card title="Allergies" icon={AlertTriangle}>
                {allergies.length === 0 ? (
                  <EmptyState icon={AlertTriangle} title="No allergies listed" desc="If you have allergies, add them with a clinician." />
                ) : (
                  <div className="space-y-2">
                    {allergies.map((a) => (
                      <div key={a.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <div className="text-sm font-black text-slate-950 truncate">{a.allergen}</div>
                              <PillBadge
                                text={a.severity || '—'}
                                tone={a.severity === 'severe' ? 'danger' : a.severity === 'moderate' ? 'warn' : 'neutral'}
                              />
                            </div>
                            <div className="mt-1 text-sm text-slate-700">{a.reaction || 'Reaction not specified.'}</div>
                            <div className="mt-2 text-xs text-slate-600">Noted: {fmtDate(a.notedAt)}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            ) : null}

            {tab === 'immunisations' ? (
              <Card title="Immunisations" icon={ShieldCheck}>
                {immunisations.length === 0 ? (
                  <EmptyState icon={ShieldCheck} title="No immunisations listed" desc="Vaccination records will show here once added." />
                ) : (
                  <div className="space-y-2">
                    {immunisations.map((im) => (
                      <div key={im.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-black text-slate-950 truncate">{im.name}</div>
                            <div className="mt-1 text-xs text-slate-600">
                              {fmtDateTime(im.date)} {im.dose ? ` • Dose: ${im.dose}` : ''} {im.provider ? ` • ${im.provider}` : ''}
                            </div>
                          </div>
                          <PillBadge text="verified" tone="ok" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            ) : null}

            {tab === 'sharing' ? (
              <Card title="Sharing & access" icon={Share2}>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start gap-3">
                    <div className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200 bg-white">
                      <ShieldCheck className="h-4 w-4 text-emerald-700" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-black text-slate-950">How sharing works</div>
                      <ul className="mt-2 space-y-1 text-sm text-slate-700 list-disc pl-5">
                        <li>Generate a consent-based, time-limited link with the selected scope once secure record sharing is enabled.</li>
                        <li>Require explicit consent confirmation before link generation.</li>
                        <li>Log each access event for audit.</li>
                        <li>Allow immediate revocation.</li>
                      </ul>
                      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <label className="block">
                          <span className="text-xs font-black uppercase tracking-wide text-slate-500">Share scope</span>
                          <select
                            value={shareScope}
                            onChange={(e) => setShareScope(e.target.value as 'full_record' | 'documents_only' | 'labs_only')}
                            className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/25"
                          >
                            <option value="documents_only">Documents only</option>
                            <option value="labs_only">Laboratory results only</option>
                            <option value="full_record">Full record</option>
                          </select>
                        </label>

                        <label className="block">
                          <span className="text-xs font-black uppercase tracking-wide text-slate-500">Expires after</span>
                          <select
                            value={shareTtlHours}
                            onChange={(e) => setShareTtlHours(Number(e.target.value) as 1 | 6 | 12 | 24 | 72)}
                            className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/25"
                          >
                            <option value={1}>1 hour</option>
                            <option value={6}>6 hours</option>
                            <option value={12}>12 hours</option>
                            <option value={24}>24 hours</option>
                            <option value={72}>72 hours</option>
                          </select>
                        </label>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={createTimeLimitedShareLink}
                          disabled={shareBusy}
                          className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-extrabold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Calendar className="h-4 w-4" />
                          {shareBusy ? 'Creating secure link…' : 'Generate time-limited link'}
                        </button>

                        <button
                          type="button"
                          onClick={doShare}
                          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-800 hover:bg-slate-50"
                        >
                          <Share2 className="h-4 w-4" />
                          Copy page link
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            ) : null}
          </div>

          <div className="lg:col-span-4 space-y-4">
            <Card title="Quick actions" icon={ClipboardList}>
              <div className="grid grid-cols-1 gap-2">
                <Link
                  href="/encounters"
                  className="inline-flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-extrabold text-slate-900 hover:bg-slate-50"
                >
                  View encounters
                  <ClipboardList className="h-4 w-4 text-slate-500" />
                </Link>

                <Link
                  href="/appointments"
                  className="inline-flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-extrabold text-slate-900 hover:bg-slate-50"
                >
                  Book appointment
                  <Calendar className="h-4 w-4 text-slate-500" />
                </Link>

                <Link
                  href="/televisit"
                  className="inline-flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-extrabold text-slate-900 hover:bg-slate-50"
                >
                  Start Televisit
                  <Stethoscope className="h-4 w-4 text-slate-500" />
                </Link>

                <button
                  type="button"
                  onClick={onUploadClick}
                  className="inline-flex items-center justify-between gap-3 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-extrabold text-white hover:bg-slate-800"
                >
                  {uploading ? 'Uploading document…' : 'Upload document'}
                  <Upload className="h-4 w-4 text-white/90" />
                </button>
              </div>
            </Card>

            <Card title="Record integrity" icon={ShieldCheck}>
              <div className="space-y-2 text-sm text-slate-700">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold">Last updated</span>
                  <span className="text-slate-600">{fmtDateTime(bundle.updatedAt)}</span>
                </div>
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3 text-xs text-emerald-800">
                  Your record is assembled from Ambulant+ encounters, clinician notes, medications, allergies, documents, and laboratory results where available.
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {uploadOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => setUploadOpen(false)} />
          <div className="relative w-full max-w-md rounded-3xl border border-slate-200 bg-white p-5 shadow-xl shadow-black/15">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-base font-black text-slate-950">Upload document</div>
                <div className="mt-1 text-sm text-slate-600">Secure upload will support PDFs, images, outside prescriptions, radiology reports, and referral documents.</div>
              </div>
              <button
                type="button"
                onClick={() => setUploadOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white hover:bg-slate-50"
              >
                <X className="h-4 w-4 text-slate-700" />
              </button>
            </div>

            <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
              <div className="text-sm font-bold text-slate-800">Selecting files…</div>
              <div className="mt-1 text-xs text-slate-600">Your file picker should open automatically.</div>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setUploadOpen(false)}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-800 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-extrabold text-white hover:bg-slate-800"
              >
                {uploading ? 'Uploading…' : 'Choose files'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}