// apps/patient-app/app/medications/print/page.tsx
import { headers } from 'next/headers';
import PrintButton from '../../../components/PrintButton';
import { formatDate, formatDateTime } from '../../../src/lib/date';

export const dynamic = 'force-dynamic';

function baseUrl() {
  const h = headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3002';
  const proto = h.get('x-forwarded-proto') ?? 'http';
  return `${proto}://${host}`;
}

function forwardAuthHeaders() {
  const h = headers();
  const out = new Headers();
  const keys = ['cookie', 'authorization', 'x-ambulant-identity'];
  for (const k of keys) {
    const v = h.get(k);
    if (v) out.set(k, v);
  }
  out.set('content-type', 'application/json');
  return out;
}

type MedicationStatus = 'Active' | 'Completed' | 'On Hold';

type Medication = {
  id: string;
  name: string;
  dose?: string | null;
  frequency?: string | null;
  route?: string | null;
  started?: string | null;
  lastFilled?: string | null;
  status: MedicationStatus;

  durationDays?: number | null;
  orderId?: string | null;
  source?: string | null; // 'erx' | 'manual' | etc
  meta?: any; // may include { encounterId }
};

type Reminder = {
  id: string;
  medicationId?: string | null;
  status: 'Pending' | 'Taken' | 'Missed';
  source?: string | null;
};

type Profile = {
  userId: string | null;
  patientId: string | null;
  name: string | null;
  email: string | null;
  age: number | null;
  gender: string | null;
  dob: string | null;
  avatarUrl: string | null;
  address: string | null;
  mobile: string | null;
  bloodType: string | null;
  allergies: string[];
  chronicConditions: string[];
  primaryConditionsText: string | null;
  patientRaw?: any;
};

type Allergy = {
  id: string;
  substance: string;
  reaction: string;
  severity: 'Mild' | 'Moderate' | 'Severe';
  status: 'Active' | 'Resolved';
  notedAt: string; // ISO
};

type Condition = {
  id?: string;
  name?: string | null;
  status?: string | null;
  diagnosedAt?: string | null;
  notes?: string | null;
  source?: string | null;
};

type EncounterSession = {
  id: string;
  caseId: string;
  caseTitle?: string | null;
  caseStatus?: string | null;
  start: string;
  stop?: string;
  clinician?: { id: string; name: string; specialty?: string | null };
};

async function fetchMeds(): Promise<Medication[]> {
  try {
    const res = await fetch(`${baseUrl()}/api/medications`, {
      cache: 'no-store',
      headers: forwardAuthHeaders(),
    });
    if (!res.ok) return [];
    const data = await res.json().catch(() => null);
    const list = Array.isArray(data)
      ? data
      : Array.isArray(data?.items)
      ? data.items
      : [];
    return list as Medication[];
  } catch {
    return [];
  }
}

async function fetchReminders(): Promise<Reminder[]> {
  try {
    const res = await fetch(`${baseUrl()}/api/reminders?source=medication`, {
      cache: 'no-store',
      headers: forwardAuthHeaders(),
    });
    if (!res.ok) return [];
    const data = await res.json().catch(() => null);
    const list = Array.isArray(data?.reminders)
      ? data.reminders
      : Array.isArray(data)
      ? data
      : [];
    return list as Reminder[];
  } catch {
    return [];
  }
}

async function fetchProfile(): Promise<Profile | null> {
  try {
    const res = await fetch(`${baseUrl()}/api/profile`, {
      cache: 'no-store',
      headers: forwardAuthHeaders(),
    });
    if (!res.ok) return null;
    return (await res.json().catch(() => null)) as Profile | null;
  } catch {
    return null;
  }
}

async function fetchAllergies(): Promise<Allergy[]> {
  try {
    const res = await fetch(`${baseUrl()}/api/allergies`, {
      cache: 'no-store',
      headers: forwardAuthHeaders(),
    });
    if (!res.ok) return [];
    const data = await res.json().catch(() => null);
    const list = Array.isArray(data)
      ? data
      : Array.isArray(data?.items)
      ? data.items
      : Array.isArray(data?.allergies)
      ? data.allergies
      : [];
    return list as Allergy[];
  } catch {
    return [];
  }
}

async function fetchConditions(): Promise<Condition[]> {
  try {
    const res = await fetch(`${baseUrl()}/api/conditions?limit=100`, {
      cache: 'no-store',
      headers: forwardAuthHeaders(),
    });
    if (!res.ok) return [];
    const data = await res.json().catch(() => null);
    const list = Array.isArray(data)
      ? data
      : Array.isArray(data?.data)
      ? data.data
      : Array.isArray(data?.items)
      ? data.items
      : Array.isArray(data?.conditions)
      ? data.conditions
      : [];
    return list as Condition[];
  } catch {
    return [];
  }
}

// Best-effort: we only have a “sessions list” endpoint shown in your codebase.
// We’ll use it and match encounter IDs from meds meta.encounterId.
async function fetchEncounterSessions(limit = 50): Promise<EncounterSession[]> {
  try {
    const res = await fetch(`${baseUrl()}/api/encounters?mode=sessions&limit=${limit}`, {
      cache: 'no-store',
      headers: forwardAuthHeaders(),
    });
    if (!res.ok) return [];
    const data = await res.json().catch(() => null);

    const raw: any[] = Array.isArray(data)
      ? data
      : Array.isArray((data as any)?.encounters)
      ? (data as any).encounters
      : [];

    return raw.map((e: any) => ({
      id: String(e.id ?? ''),
      caseId: String(e.caseId ?? e.case ?? 'UNKNOWN'),
      caseTitle: e.caseTitle ?? null,
      caseStatus: e.caseStatus ?? e.status ?? null,
      start: String(e.start ?? e.startedAt ?? new Date().toISOString()),
      stop: e.stop ? String(e.stop) : undefined,
      clinician: e.clinician
        ? {
            id: String(e.clinician.id ?? ''),
            name: String(e.clinician.name ?? ''),
            specialty: e.clinician.specialty ? String(e.clinician.specialty) : null,
          }
        : undefined,
    }));
  } catch {
    return [];
  }
}

function safeStr(v: any) {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  return String(v);
}

function fmtMaybeDate(d?: string | null) {
  if (!d) return '—';
  try {
    return formatDate(d);
  } catch {
    return safeStr(d).slice(0, 10);
  }
}

function statusPill(status: MedicationStatus) {
  switch (status) {
    case 'Active':
      return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    case 'On Hold':
      return 'bg-amber-50 text-amber-800 border-amber-200';
    case 'Completed':
    default:
      return 'bg-gray-50 text-gray-700 border-gray-200';
  }
}

function groupByStatus(meds: Medication[]) {
  const active: Medication[] = [];
  const hold: Medication[] = [];
  const completed: Medication[] = [];

  for (const m of meds) {
    if (m.status === 'Active') active.push(m);
    else if (m.status === 'On Hold') hold.push(m);
    else completed.push(m);
  }

  active.sort((a, b) => safeStr(a.name).localeCompare(safeStr(b.name)));
  hold.sort(
    (a, b) =>
      new Date(b.lastFilled ?? 0 as any).getTime() -
        new Date(a.lastFilled ?? 0 as any).getTime() ||
      safeStr(a.name).localeCompare(safeStr(b.name)),
  );
  completed.sort(
    (a, b) =>
      new Date(b.lastFilled ?? 0 as any).getTime() -
        new Date(a.lastFilled ?? 0 as any).getTime() ||
      safeStr(a.name).localeCompare(safeStr(b.name)),
  );

  return { active, hold, completed };
}

function sigLine({ label }: { label: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <div className="w-36 text-[11px] text-gray-500">{label}</div>
      <div className="flex-1 border-b border-dashed border-gray-300 h-4" />
    </div>
  );
}

function SummaryTile(props: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm print:shadow-none">
      <div className="text-[11px] font-medium text-slate-500">{props.label}</div>
      <div className="mt-1 text-2xl font-black tracking-tight text-slate-950">{props.value}</div>
      {props.sub ? <div className="mt-1 text-[11px] leading-4 text-slate-500">{props.sub}</div> : null}
    </div>
  );
}

function SectionTitle(props: {
  title: string;
  subtitle?: string;
  tone?: 'emerald' | 'amber' | 'slate';
}) {
  const tone =
    props.tone === 'emerald'
      ? 'from-emerald-50'
      : props.tone === 'amber'
      ? 'from-amber-50'
      : 'from-slate-50';

  return (
    <div className={`rounded-2xl border border-slate-200 bg-gradient-to-b ${tone} to-white p-4`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-bold text-slate-950">{props.title}</div>
          {props.subtitle ? (
            <div className="mt-0.5 text-xs leading-5 text-slate-600">{props.subtitle}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function pillToneForSeverity(sev: Allergy['severity']) {
  switch (sev) {
    case 'Severe':
      return 'bg-red-50 text-red-800 border-red-200';
    case 'Moderate':
      return 'bg-amber-50 text-amber-800 border-amber-200';
    case 'Mild':
    default:
      return 'bg-emerald-50 text-emerald-800 border-emerald-200';
  }
}

function MedTable(props: {
  meds: Medication[];
  pendingByMedId: Record<string, number>;
}) {
  const { meds, pendingByMedId } = props;

  if (meds.length === 0) {
    return (
      <div className="rounded-xl border bg-white p-4 text-sm text-gray-600">
        No items in this section.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm print:shadow-none">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="print:table-header-group">
            <tr className="border-b bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
              <th className="py-2.5 px-3">Medication</th>
              <th className="py-2.5 px-3">Dose</th>
              <th className="py-2.5 px-3">SIG</th>
              <th className="py-2.5 px-3 whitespace-nowrap">Start</th>
              <th className="py-2.5 px-3 whitespace-nowrap">Last Fill</th>
              <th className="py-2.5 px-3 whitespace-nowrap">Duration</th>
              <th className="py-2.5 px-3">Source</th>
              <th className="py-2.5 px-3 text-right whitespace-nowrap">Flags</th>
            </tr>
          </thead>
          <tbody>
            {meds.map((m) => {
              const sig =
                [safeStr(m.frequency || ''), safeStr(m.route || '')]
                  .filter(Boolean)
                  .join(' · ') || '—';

              const duration =
                m.durationDays != null
                  ? `${m.durationDays} day${m.durationDays === 1 ? '' : 's'}`
                  : '—';

              const src = safeStr(m.source || '') || (m.orderId ? 'order' : '—');

              const pending = pendingByMedId[m.id] ?? 0;
              const encounterId = m?.meta?.encounterId ? safeStr(m.meta.encounterId) : '';

              return (
                <tr key={m.id} className="border-b last:border-0 align-top">
                  <td className="py-2.5 px-3">
                    <div className="font-medium text-gray-900">{safeStr(m.name) || '—'}</div>

                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                      <span
                        className={
                          'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ' +
                          statusPill(m.status)
                        }
                      >
                        {m.status}
                      </span>

                      {m.orderId ? (
                        <span className="inline-flex items-center rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[11px] text-gray-700">
                          Order: {m.orderId}
                        </span>
                      ) : null}

                      {encounterId ? (
                        <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] text-indigo-800">
                          eRx: {encounterId}
                        </span>
                      ) : null}
                    </div>
                  </td>

                  <td className="py-2.5 px-3 whitespace-nowrap">{safeStr(m.dose || '') || '—'}</td>
                  <td className="py-2.5 px-3 min-w-[220px]">{sig}</td>
                  <td className="py-2.5 px-3 whitespace-nowrap">{fmtMaybeDate(m.started)}</td>
                  <td className="py-2.5 px-3 whitespace-nowrap">{fmtMaybeDate(m.lastFilled)}</td>
                  <td className="py-2.5 px-3 whitespace-nowrap">{duration}</td>

                  <td className="py-2.5 px-3 whitespace-nowrap">
                    {src || '—'}
                    {m.source === 'erx' ? (
                      <div className="text-[11px] text-gray-500">clinician prescribed</div>
                    ) : null}
                    {safeStr(m.source).startsWith('manual') ? (
                      <div className="text-[11px] text-gray-500">patient added</div>
                    ) : null}
                  </td>

                  <td className="py-2.5 px-3 text-right whitespace-nowrap">
                    <div className="inline-flex flex-col items-end gap-1">
                      {pending > 0 ? (
                        <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-800">
                          {pending} pending reminder{pending === 1 ? '' : 's'}
                        </span>
                      ) : (
                        <span className="text-[11px] text-gray-400">—</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="px-3 py-3 text-[11px] text-gray-500 border-t bg-white">
        Notes for clinician: This list is patient-provided unless marked as eRx. Please reconcile
        against current prescription records.
      </div>
    </div>
  );
}

function uniqBy<T>(arr: T[], keyFn: (x: T) => string) {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const x of arr) {
    const k = keyFn(x);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(x);
  }
  return out;
}

function isErxMedication(med: Medication) {
  const source = safeStr(med.source).toLowerCase();
  return source.includes('erx') || Boolean(med?.meta?.encounterId);
}

function displayValue(value?: string | null) {
  const clean = safeStr(value).trim();
  return clean || 'Not recorded';
}

function normaliseConditionName(item: unknown) {
  if (typeof item === 'string') return item.trim();
  if (!item || typeof item !== 'object') return '';
  const record = item as Record<string, unknown>;
  return safeStr(record.name ?? record.condition ?? record.title ?? '').trim();
}

function conditionStatusLabel(item: Condition) {
  const status = safeStr(item.status).trim();
  return status || 'Recorded';
}

export default async function MedicationsPrintPage() {
  const [meds, reminders, profile, allergiesApi, conditionsApi] = await Promise.all([
    fetchMeds(),
    fetchReminders(),
    fetchProfile(),
    fetchAllergies(),
    fetchConditions(),
  ]);

  const now = new Date();
  const { active, hold, completed } = groupByStatus(meds);

  const pendingByMedId: Record<string, number> = {};
  for (const r of reminders) {
    if (!r.medicationId) continue;
    if (r.status !== 'Pending') continue;
    pendingByMedId[r.medicationId] = (pendingByMedId[r.medicationId] ?? 0) + 1;
  }

  const total = meds.length;
  const coverage = active.length
    ? Math.round(
        (active.filter((m) => (pendingByMedId[m.id] ?? 0) > 0).length /
          Math.max(active.length, 1)) *
          100,
      )
    : 0;

  // Patient info (fully wired)
  const patientName = profile?.name ?? null;
  const patientId = profile?.patientId ?? null;
  const patientDob = profile?.dob ?? null;
  const patientGender = profile?.gender ?? null;
  const patientBlood = profile?.bloodType ?? null;
  const patientMobile = profile?.mobile ?? null;
  const patientEmail = profile?.email ?? null;
  const patientAddress = profile?.address ?? null;
  const profileConditionNames = [
    ...(Array.isArray(profile?.chronicConditions) ? profile!.chronicConditions : []),
    ...(profile?.primaryConditionsText
      ? profile.primaryConditionsText.split(',').map((item) => item.trim())
      : []),
  ].filter(Boolean);

  const activeConditions = uniqBy(
    [
      ...conditionsApi
        .filter((condition) => !safeStr(condition.status).toLowerCase().includes('resolved'))
        .map((condition) => ({
          name: normaliseConditionName(condition),
          status: conditionStatusLabel(condition),
          diagnosedAt: condition.diagnosedAt ?? null,
          notes: condition.notes ?? null,
          source: condition.source ?? null,
        })),
      ...profileConditionNames.map((name) => ({
        name,
        status: 'Reported',
        diagnosedAt: null,
        notes: null,
        source: 'profile',
      })),
    ].filter((condition) => condition.name),
    (condition) => condition.name.toLowerCase(),
  );

  // Allergies: merge profile allergies[] + allergies API (Active)
  const activeAllergies = allergiesApi.filter((a) => a.status === 'Active');
  const profileAllergies = Array.isArray(profile?.allergies) ? profile!.allergies : [];

  const mergedSimple = uniqBy(
    profileAllergies
      .map((s) => safeStr(s).trim())
      .filter(Boolean)
      .map((s) => ({ substance: s, reaction: '', severity: 'Mild' as const, notedAt: '' })),
    (x) => x.substance.toLowerCase(),
  );

  const merged = uniqBy(
    [...activeAllergies, ...mergedSimple].filter((x: any) => safeStr(x.substance).trim()),
    (x: any) => safeStr(x.substance).trim().toLowerCase(),
  );

  // Clinician / encounter block (only if any med is eRx and has encounterId)
  const erxEncounterIds = uniqBy(
    meds
      .filter((m) => m.source === 'erx' && m?.meta?.encounterId)
      .map((m) => safeStr(m.meta.encounterId))
      .filter(Boolean),
    (x) => x,
  );

  let encounters: EncounterSession[] = [];
  let erxSessions: EncounterSession[] = [];
  let erxClinicians: { id: string; name: string; specialty?: string | null }[] = [];

  if (erxEncounterIds.length > 0) {
    encounters = await fetchEncounterSessions(60);
    const map = new Map(encounters.map((e) => [e.id, e] as const));
    erxSessions = erxEncounterIds.map((id) => map.get(id)).filter(Boolean) as EncounterSession[];

    erxClinicians = uniqBy(
      erxSessions
        .map((s) => s.clinician)
        .filter(Boolean) as { id: string; name: string; specialty?: string | null }[],
      (c) => safeStr(c.id) || safeStr(c.name),
    );
  }

  const hasErxMedication = meds.some(isErxMedication);
  const hasErxContext = hasErxMedication;

  return (
    <main className="mx-auto max-w-6xl space-y-5 bg-slate-50/60 p-6 text-slate-900 print:max-w-none print:bg-white print:p-0 print:text-black print:space-y-4">
      <style>{`
        @media print {
          html, body { background: #fff !important; }
          .print\\:p-0 { padding: 0 !important; }
          .avoid-break { break-inside: avoid; page-break-inside: avoid; }
          thead { display: table-header-group; }
          tfoot { display: table-footer-group; }
        }
      `}</style>

      {/* Header */}
      <header className="avoid-break overflow-hidden rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-cyan-50 p-5 shadow-sm print:rounded-none print:border-gray-200 print:bg-white print:shadow-none">
        <div className="flex items-start justify-between gap-4 print:gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-200 bg-white text-sm font-black text-emerald-700">
                A+
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">
                  Medication reconciliation record
                </div>
                <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950">
                  Medication Summary
                </h1>
                <div className="mt-1 text-xs text-slate-500">
                  Generated {formatDateTime(now)}
                </div>
              </div>
            </div>

            <div className="mt-3 max-w-3xl text-xs leading-5 text-slate-600">
              Confidential medication information for clinical review. Reconcile eRx-synced medicines against prescribing records and patient-added medicines against patient history.
            </div>
          </div>

          <div className="flex items-center gap-2 print:hidden">
            <PrintButton />
          </div>
        </div>
      </header>

      {/* Patient profile block (wired) */}
      <section className="avoid-break overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm print:rounded-none print:shadow-none">
        <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-sm font-bold text-slate-950">Patient profile</div>
              <div className="mt-0.5 text-xs text-slate-500">
                Pulled from the patient profile, allergies service, and conditions service where available.
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-right text-[11px] text-slate-500">
              <div className="font-semibold text-slate-800">{patientId ? `MRN: ${patientId}` : 'MRN: Not recorded'}</div>
              <div>{patientDob ? `DOB: ${fmtMaybeDate(patientDob)}` : 'DOB: Not recorded'}</div>
            </div>
          </div>
        </div>

        <div className="grid gap-3 p-5 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 md:col-span-2">
            <div className="text-[11px] font-medium text-slate-500">Full name</div>
            <div className="mt-1 text-sm font-semibold text-slate-950">{displayValue(patientName)}</div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
            <div className="text-[11px] font-medium text-slate-500">Gender</div>
            <div className="mt-1 text-sm font-semibold text-slate-950">{displayValue(patientGender)}</div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
            <div className="text-[11px] font-medium text-slate-500">Blood type</div>
            <div className="mt-1 text-sm font-semibold text-slate-950">{displayValue(patientBlood)}</div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-3 md:col-span-2">
            <div className="text-[11px] font-medium text-slate-500">Mobile</div>
            <div className="mt-1 text-sm text-slate-900">{displayValue(patientMobile)}</div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-3 md:col-span-2">
            <div className="text-[11px] font-medium text-slate-500">Email</div>
            <div className="mt-1 break-all text-sm text-slate-900">{displayValue(patientEmail)}</div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-3 md:col-span-4">
            <div className="text-[11px] font-medium text-slate-500">Address</div>
            <div className="mt-1 text-sm text-slate-900">{displayValue(patientAddress)}</div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-3 md:col-span-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[11px] font-medium text-slate-500">Clinical conditions</div>
              <div className="text-[11px] text-slate-400">{activeConditions.length} recorded</div>
            </div>

            {activeConditions.length === 0 ? (
              <div className="mt-1 text-sm text-slate-700">Not recorded</div>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                {activeConditions.map((condition) => (
                  <span
                    key={condition.name.toLowerCase()}
                    className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-[11px] text-indigo-800"
                  >
                    <span className="font-semibold">{condition.name}</span>
                    <span className="text-indigo-600">· {condition.status}</span>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-3 md:col-span-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[11px] font-medium text-slate-500">Allergies / intolerances</div>
              <div className="text-[11px] text-slate-400">{merged.length} active</div>
            </div>

            {merged.length === 0 ? (
              <div className="mt-1 text-sm text-slate-700">No active allergies recorded</div>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                {merged.map((a: any) => {
                  const substance = safeStr(a.substance);
                  const reaction = safeStr(a.reaction);
                  const sev = (a.severity as Allergy['severity']) || 'Mild';
                  const pill = pillToneForSeverity(sev);

                  return (
                    <span
                      key={substance.toLowerCase()}
                      className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] ${pill}`}
                    >
                      <span className="font-semibold">{substance}</span>
                      {reaction ? <span className="text-slate-600">· {reaction}</span> : null}
                      {sev ? <span className="text-slate-600">· {sev}</span> : null}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* eRx context (only when applicable) */}
      {hasErxContext ? (
        <section className="rounded-2xl border bg-white p-4 avoid-break">
          <div className="text-sm font-semibold text-slate-950">Prescription context</div>
          <div className="mt-0.5 text-xs text-slate-500">
            Shown because this report includes eRx-synced medication records. Encounter and clinician details are displayed when available from the encounters service.
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl border bg-gray-50 p-3">
              <div className="text-[11px] text-gray-500">Prescribing clinician(s)</div>
              {erxClinicians.length === 0 ? (
                <div className="mt-1 text-sm text-gray-700">—</div>
              ) : (
                <div className="mt-1 space-y-1">
                  {erxClinicians.map((c) => (
                    <div key={safeStr(c.id) || safeStr(c.name)} className="text-sm text-gray-900">
                      <span className="font-medium">{c.name}</span>
                      {c.specialty ? <span className="text-gray-500"> · {c.specialty}</span> : null}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border bg-gray-50 p-3">
              <div className="text-[11px] text-gray-500">Encounter(s)</div>
              {erxSessions.length === 0 ? (
                <div className="mt-1 text-sm text-gray-700">—</div>
              ) : (
                <div className="mt-1 space-y-1">
                  {erxSessions.slice(0, 6).map((s) => {
                    const dateStr = (() => {
                      try {
                        return new Date(s.start).toLocaleString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        });
                      } catch {
                        return safeStr(s.start);
                      }
                    })();

                    return (
                      <div key={s.id} className="text-sm text-gray-900">
                        <span className="font-medium">{dateStr}</span>
                        {s.caseTitle ? <span className="text-gray-500"> · {s.caseTitle}</span> : null}
                        <div className="text-[11px] text-gray-500">
                          {s.id}
                          {s.caseStatus ? ` · ${s.caseStatus}` : ''}
                        </div>
                      </div>
                    );
                  })}
                  {erxSessions.length > 6 ? (
                    <div className="text-[11px] text-gray-500">+ {erxSessions.length - 6} more</div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </section>
      ) : null}

      {/* Summary tiles */}
      <section className="grid gap-3 sm:grid-cols-4 avoid-break">
        <SummaryTile label="Total medications" value={String(total)} sub="Across all statuses" />
        <SummaryTile label="Active" value={String(active.length)} sub="Currently taken" />
        <SummaryTile label="On hold" value={String(hold.length)} sub="Paused / temporarily stopped" />
        <SummaryTile
          label="Reminder coverage"
          value={active.length ? `${coverage}%` : '—'}
          sub={active.length ? 'Active meds with pending reminders' : 'No active meds'}
        />
      </section>

      {/* Sections */}
      <section className="space-y-3">
        <div className="avoid-break">
          <SectionTitle
            title="Active medications"
            subtitle="Medications the patient reports currently taking. Reconcile with current script."
            tone="emerald"
          />
          <div className="mt-3">
            <MedTable meds={active} pendingByMedId={pendingByMedId} />
          </div>
        </div>

        <div className="avoid-break">
          <SectionTitle
            title="On hold"
            subtitle="Medications temporarily paused. Confirm reasons and restart plan if applicable."
            tone="amber"
          />
          <div className="mt-3">
            <MedTable meds={hold} pendingByMedId={pendingByMedId} />
          </div>
        </div>

        <div className="avoid-break">
          <SectionTitle
            title="Completed"
            subtitle="Previously taken medications. Useful for history and medication reconciliation."
            tone="slate"
          />
          <div className="mt-3">
            <MedTable meds={completed} pendingByMedId={pendingByMedId} />
          </div>
        </div>
      </section>

      {/* Review / declaration block */}
      {hasErxMedication ? (
        <section className="avoid-break rounded-3xl border border-slate-200 bg-white p-5 shadow-sm print:shadow-none">
          <div className="text-sm font-bold text-slate-950">Clinician reconciliation</div>
          <div className="mt-0.5 text-xs leading-5 text-slate-500">
            This report includes eRx-synced medicines. Please reconcile against the current prescription record before making treatment decisions.
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
              {sigLine({ label: 'Reviewed on' })}
              {sigLine({ label: 'Clinician name' })}
              {sigLine({ label: 'Practice / facility' })}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
              {sigLine({ label: 'Signature' })}
              {sigLine({ label: 'Registration no.' })}
              {sigLine({ label: 'Next review' })}
            </div>
          </div>

          <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3">
            <div className="mb-2 text-[11px] font-medium text-slate-500">Clinical reconciliation notes</div>
            <div className="h-24 rounded-xl border border-dashed border-slate-300" />
          </div>
        </section>
      ) : (
        <section className="avoid-break rounded-3xl border border-slate-200 bg-white p-5 shadow-sm print:shadow-none">
          <div className="text-sm font-bold text-slate-950">Patient-maintained medication declaration</div>
          <div className="mt-0.5 text-xs leading-5 text-slate-500">
            This report contains patient-maintained medication records only; no eRx-synced medication context was detected.
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
              {sigLine({ label: 'Patient name' })}
              {sigLine({ label: 'Signed on' })}
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
              {sigLine({ label: 'Signature' })}
              {sigLine({ label: 'Contact number' })}
            </div>
          </div>
        </section>
      )}

      <footer className="flex items-center justify-between text-[11px] text-slate-500 print:pt-2">
        <div>Ambulant+ · Medication Summary</div>
        <div className="print:hidden">Use your browser’s Print dialog to save as PDF.</div>
      </footer>
    </main>
  );
}
