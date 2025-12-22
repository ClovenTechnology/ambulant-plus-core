// apps/clinician-app/app/sfu/[roomId]/ReferralPanel.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';

export type ToastKind = 'info' | 'success' | 'warning' | 'error';

export type ReferralPanelProps = {
  encounterId?: string;
  patient: { id: string; name: string };
  clinician: { id: string; name?: string };
  summary: string;
  onNotify?: (body: string, kind?: ToastKind, title?: string) => void;
  onAudit?: (action: string, extra?: Record<string, unknown>) => void;
};

export default function ReferralPanel({
  encounterId,
  patient,
  clinician,
  summary,
  onNotify,
  onAudit,
}: ReferralPanelProps) {
  type ClinClass = 'Doctor' | 'Allied Health' | 'Wellness';
  type Clin = {
    id: string;
    name: string;
    specialty: string;
    location: string;
    gender?: string;
    cls?: ClinClass;
    priceZAR?: number;
    rating?: number;
    online?: boolean;
    status?: 'active' | 'inactive' | 'suspended' | string;
    isActive?: boolean;
    referralEnabled?: boolean;
  };

  const UI_CLASSES = ['Doctors', 'Allied Health', 'Wellness'] as const;
  type UIClass = (typeof UI_CLASSES)[number];

  const toDataClass = (tab: UIClass): ClinClass =>
    tab === 'Doctors' ? 'Doctor' : (tab as ClinClass);

  type ClassVisibility = Partial<Record<ClinClass, boolean>>;

  const [rawList, setRawList] = useState<Clin[]>([]);
  const [loading, setLoading] = useState(false);
  const [classVisibility, setClassVisibility] = useState<ClassVisibility>({});

  const [tab, setTab] = useState<UIClass>('Doctors');
  const [filters, setFilters] = useState({
    q: '',
    specialty: '',
    gender: '',
    location: '',
  });

  const [mode, setMode] = useState<'internal' | 'external' | null>(null);

  const allTabs: UIClass[] = UI_CLASSES;

  const visibleTabs = useMemo(() => {
    const enabledTabs = allTabs.filter((t) => {
      const cls = toDataClass(t);
      const flag = classVisibility[cls];
      return flag !== false;
    });
    return enabledTabs.length ? enabledTabs : allTabs;
  }, [classVisibility]);

  useEffect(() => {
    if (!visibleTabs.includes(tab)) {
      setTab(visibleTabs[0] ?? 'Doctors');
    }
  }, [visibleTabs, tab]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const r = await fetch(
          '/api/clinicians?limit=500&scope=referral&onlyActive=1',
          { cache: 'no-store' }
        );
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const js = await r.json();
        const items = (js?.items || []) as any[];
        if (!Array.isArray(items) || items.length === 0) throw new Error('empty');

        setRawList(
          items.map((c) => {
            const cls: ClinClass = c.cls || c.class || 'Doctor';
            const status: string = c.status || c.state || 'active';
            const isActive =
              typeof c.isActive === 'boolean'
                ? c.isActive
                : typeof c.active === 'boolean'
                ? c.active
                : status.toLowerCase() === 'active';
            const referralEnabled =
              typeof c.referralEnabled === 'boolean'
                ? c.referralEnabled
                : typeof c.enabledForReferral === 'boolean'
                ? c.enabledForReferral
                : true;

            return {
              id: c.id,
              name: c.name,
              specialty: c.specialty || '',
              location: c.location || '',
              gender: (c.gender || '').trim(),
              cls,
              priceZAR: c.priceZAR,
              rating: c.rating,
              online: c.online,
              status,
              isActive,
              referralEnabled,
            } satisfies Clin;
          })
        );

        if (js?.classVisibility && typeof js.classVisibility === 'object') {
          const cv: ClassVisibility = {};
          (['Doctor', 'Allied Health', 'Wellness'] as ClinClass[]).forEach(
            (cls) => {
              const uiKey = cls === 'Doctor' ? 'Doctors' : cls;
              const apiVal =
                js.classVisibility[cls] ??
                js.classVisibility[uiKey] ??
                js.classVisibility[cls.toLowerCase()];
              if (typeof apiVal === 'boolean') cv[cls] = apiVal;
            }
          );
          setClassVisibility(cv);
        }
      } catch {
        const mock: Clin[] = [
          {
            id: 'clin-za-001',
            name: 'Dr Ama Ndlovu',
            specialty: 'GP',
            location: 'Johannesburg',
            gender: 'Female',
            cls: 'Doctor',
            priceZAR: 500,
            rating: 4.7,
            online: true,
            status: 'active',
            isActive: true,
            referralEnabled: true,
          },
          {
            id: 'clin-za-002',
            name: 'Dr Jane Smith',
            specialty: 'Cardiology',
            location: 'Cape Town',
            gender: 'Female',
            cls: 'Doctor',
            priceZAR: 850,
            rating: 4.8,
            online: true,
            status: 'active',
            isActive: true,
            referralEnabled: true,
          },
          {
            id: 'clin-za-003',
            name: 'Dr Adam Lee',
            specialty: 'ENT',
            location: 'Johannesburg',
            gender: 'Male',
            cls: 'Doctor',
            priceZAR: 700,
            rating: 4.6,
            online: true,
            status: 'active',
            isActive: true,
            referralEnabled: true,
          },
          {
            id: 'clin-za-101',
            name: 'RN T. Dube',
            specialty: 'Nurse',
            location: 'Durban',
            gender: 'Male',
            cls: 'Allied Health',
            priceZAR: 300,
            rating: 4.5,
            online: false,
            status: 'active',
            isActive: true,
            referralEnabled: true,
          },
          {
            id: 'clin-za-201',
            name: 'Coach L. Maseko',
            specialty: 'Therapist',
            location: 'Pretoria',
            gender: 'Female',
            cls: 'Wellness',
            priceZAR: 400,
            rating: 4.4,
            online: true,
            status: 'active',
            isActive: true,
            referralEnabled: true,
          },
        ];
        setRawList(mock);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const scoped = useMemo(
    () =>
      rawList.filter((c) => {
        const cls = c.cls || 'Doctor';
        if (cls !== toDataClass(tab)) return false;
        if (c.isActive === false) return false;
        if (typeof c.status === 'string' && c.status.toLowerCase() !== 'active')
          return false;
        const classFlag = classVisibility[cls];
        if (classFlag === false) return false;
        if (c.referralEnabled === false) return false;
        return true;
      }),
    [rawList, tab, classVisibility]
  );

  const specialties = useMemo(
    () => Array.from(new Set(scoped.map((c) => c.specialty))).filter(Boolean),
    [scoped]
  );
  const genders = useMemo(() => {
    const set = new Set(scoped.map((c) => (c.gender || '').trim()).filter(Boolean));
    const arr = Array.from(set);
    return arr.length ? arr : ['Male', 'Female', 'Other'];
  }, [scoped]);
  const locations = useMemo(
    () => Array.from(new Set(scoped.map((c) => c.location))).filter(Boolean),
    [scoped]
  );

  const filtered = useMemo(() => {
    let L = scoped;
    const q = filters.q.trim().toLowerCase();
    if (q)
      L = L.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.specialty.toLowerCase().includes(q) ||
          c.location.toLowerCase().includes(q)
      );
    if (filters.specialty) L = L.filter((c) => c.specialty === filters.specialty);
    if (filters.gender)
      L = L.filter((c) => (c.gender || '').trim() === filters.gender);
    if (filters.location) L = L.filter((c) => c.location === filters.location);
    L = [...L].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    return L;
  }, [scoped, filters]);

  const [selId, setSelId] = useState('');
  const sel = filtered.find((c) => c.id === selId) || null;

  const [extName, setExtName] = useState('');
  const [extEmail, setExtEmail] = useState('');
  const [extPhone, setExtPhone] = useState('');

  const emailOk = useMemo(() => {
    if (!extEmail.trim()) return false;
    const re = /^[^\s"<>@]+@[^\s"<>@]+\.[A-Za-z]{2,}$/;
    return re.test(extEmail.trim());
  }, [extEmail]);

  const phoneOk = useMemo(
    () => /^\d{7,15}$/.test(extPhone),
    [extPhone]
  );

  useEffect(() => {
    if (selId) setMode('internal');
  }, [selId]);

  useEffect(() => {
    if (extName || extEmail || extPhone) setMode('external');
  }, [extName, extEmail, extPhone]);

  const disableInternal = mode === 'external';
  const disableExternal = mode === 'internal';

  const handleInternalPrepare = async () => {
    if (!sel) return;
    const payload = {
      type: 'internal' as const,
      encounterId: encounterId ?? null,
      toClinicianId: sel.id,
      toClinicianName: sel.name,
      fromClinicianId: clinician.id,
      fromClinicianName: clinician.name ?? null,
      patientId: patient.id,
      patientName: patient.name,
      summary,
    };
    try {
      const res = await fetch('/api/referrals', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      onNotify?.(
        `Internal referral sent to ${sel.name}.`,
        'success',
        'Referral sent'
      );
      onAudit?.('referral.internal.send', {
        toClinicianId: sel.id,
        encounterId: encounterId ?? null,
      });
    } catch (err: any) {
      console.error('[ReferralPanel] internal referral failed', err);
      onNotify?.(
        'Failed to send internal referral.',
        'error',
        'Referral error'
      );
      onAudit?.('referral.internal.error', {
        toClinicianId: sel.id,
        encounterId: encounterId ?? null,
        message: err?.message || String(err),
      });
    }
  };

  const handleExternalPrepare = async () => {
    const name = extName.trim();
    const email = extEmail.trim();
    const phone = extPhone.trim();
    if (!name || !email || !emailOk || (phone && !phoneOk)) return;

    const emailBodyLines: string[] = [
      'You have been referred a patient on Ambulant+.',
      '',
      `Patient: ${patient.name} (${patient.id})`,
      encounterId ? `Encounter ID: ${encounterId}` : '',
      '',
      'Encounter summary:',
      summary || 'No summary captured.',
      '',
      'Log in to Ambulant+ to access the full patient record and book a session with this patient.',
      'Not a clinician on Ambulant+ yet? Use our quick signup flow to get secure access in minutes.',
    ].filter(Boolean);
    const emailBody = emailBodyLines.join('\n');

    const smsBody = `Ambulant+ referral: patient ${patient.name}. Check your email for full details and a link to log in / sign up.`;

    const payload = {
      type: 'external' as const,
      encounterId: encounterId ?? null,
      to: { name, email, phone: phone || null },
      patient: { id: patient.id, name: patient.name },
      summary,
      emailBody,
      smsBody,
      fromClinicianId: clinician.id,
      fromClinicianName: clinician.name ?? null,
    };

    try {
      const res = await fetch('/api/referrals', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      onNotify?.(
        `External referral email${phone ? ' and SMS' : ''} sent to ${name}.`,
        'success',
        'Referral sent'
      );
      onAudit?.('referral.external.send', {
        toEmail: email,
        toPhone: phone || null,
        encounterId: encounterId ?? null,
      });
    } catch (err: any) {
      console.error('[ReferralPanel] external referral failed', err);
      onNotify?.(
        'Failed to send external referral.',
        'error',
        'Referral error'
      );
      onAudit?.('referral.external.error', {
        toEmail: email,
        toPhone: phone || null,
        encounterId: encounterId ?? null,
        message: err?.message || String(err),
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Internal referral */}
      <div className={`border rounded p-3 ${disableInternal ? 'opacity-60' : ''}`}>
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-medium">Refer within Ambulant+</div>
          <div className="flex items-center gap-2">
            {visibleTabs.map((cls) => (
              <button
                key={cls}
                onClick={() => {
                  setTab(cls);
                  setSelId('');
                  setMode('internal');
                }}
                className={`px-2 py-1 text-xs rounded-full border ${
                  tab === cls
                    ? 'bg-gray-900 text-white'
                    : 'bg-white hover:bg-gray-100'
                }`}
                disabled={disableInternal}
              >
                {cls}
              </button>
            ))}
          </div>
        </div>

        <div className="grid md:grid-cols-4 gap-2 mb-2">
          <input
            type="text"
            placeholder="Search name or specialty"
            value={filters.q}
            onChange={(e) => {
              setFilters((f) => ({ ...f, q: e.target.value }));
              setMode('internal');
            }}
            className="rounded border p-2 text-sm"
            disabled={disableInternal || loading}
          />
          <select
            value={filters.specialty}
            onChange={(e) => {
              setFilters((f) => ({ ...f, specialty: e.target.value }));
              setMode('internal');
            }}
            className="rounded border p-2 text-sm"
            disabled={disableInternal || loading}
          >
            <option value="">All Specialties</option>
            {specialties.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            value={filters.gender}
            onChange={(e) => {
              setFilters((f) => ({ ...f, gender: e.target.value }));
              setMode('internal');
            }}
            className="rounded border p-2 text-sm"
            disabled={disableInternal || loading}
          >
            <option value="">Any Gender</option>
            {genders.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
          <select
            value={filters.location}
            onChange={(e) => {
              setFilters((f) => ({ ...f, location: e.target.value }));
              setMode('internal');
            }}
            className="rounded border p-2 text-sm"
            disabled={disableInternal || loading}
          >
            <option value="">Any Location</option>
            {locations.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>

        <div className="grid md:grid-cols-2 gap-2 items-end">
          <label className="text-xs flex flex-col">
            <span className="text-gray-600 mb-1">Select Clinician</span>
            <select
              className="border rounded px-2 py-1"
              value={selId}
              onChange={(e) => {
                setSelId(e.target.value);
                setMode('internal');
              }}
              disabled={loading || disableInternal}
              aria-label="Select clinician for internal referral"
            >
              <option value="">
                {loading ? 'Loading…' : 'Choose a clinician'}
              </option>
              {filtered.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — {c.specialty || '—'} — {c.location || '—'} (
                  {c.id})
                </option>
              ))}
            </select>
          </label>

          <div className="flex justify-end">
            <button
              className="px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              disabled={!sel || disableInternal}
              onClick={handleInternalPrepare}
            >
              Prepare Referral
            </button>
          </div>
        </div>

        {sel && (
          <div className="mt-3 rounded border bg-white p-2 text-sm">
            <div className="grid md:grid-cols-2 gap-2">
              <div>
                <b>Name</b>
                <div>{sel.name}</div>
              </div>
              <div>
                <b>Clinician ID</b>
                <div className="font-mono">{sel.id}</div>
              </div>
              <div>
                <b>Specialty</b>
                <div>{sel.specialty || '—'}</div>
              </div>
              <div>
                <b>Location</b>
                <div>{sel.location || '—'}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* External referral */}
      <div className={`border rounded p-3 ${disableExternal ? 'opacity-60' : ''}`}>
        <div className="text-sm font-medium mb-2">Refer outside Ambulant+</div>
        <div className="grid md:grid-cols-3 gap-2">
          <input
            className="border rounded px-2 py-1"
            placeholder="Clinician name"
            value={extName}
            onChange={(e) => {
              setExtName(e.target.value);
              setMode('external');
              setSelId('');
            }}
            disabled={disableExternal}
          />
          <input
            className="border rounded px-2 py-1"
            placeholder="Email"
            type="email"
            value={extEmail}
            onChange={(e) => {
              setExtEmail(e.target.value);
              setMode('external');
              setSelId('');
            }}
            disabled={disableExternal}
            aria-invalid={!!extEmail && !emailOk}
          />
          <input
            className="border rounded px-2 py-1"
            placeholder="Mobile (digits only)"
            inputMode="numeric"
            value={extPhone}
            onChange={(e) => {
              const digitsOnly = e.target.value.replace(/\D+/g, '');
              setExtPhone(digitsOnly);
              setMode('external');
              setSelId('');
            }}
            disabled={disableExternal}
          />
        </div>
        <div className="mt-2 flex justify-end">
          <button
            className="px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            disabled={
              disableExternal || !extName || !emailOk || (extPhone ? !phoneOk : false)
            }
            onClick={handleExternalPrepare}
          >
            Prepare Referral
          </button>
        </div>
      </div>
    </div>
  );
}
