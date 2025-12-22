'use client';
import React, { useEffect, useState } from 'react';
import { FiPlus } from 'react-icons/fi';
import { format } from 'date-fns';

type ConditionStatus =
  | 'Active'
  | 'Inactive'
  | 'Controlled'
  | 'Suppressed'
  | 'Remission'
  | 'Resolved';

type Condition = {
  id: string;
  name: string;
  diagnosedAt?: string;
  status?: ConditionStatus;
  notes?: string;
  facility?: string;
  clinician?: string; // diagnosing clinician
  onAmbulant?: boolean; // diagnosed on Ambulant+
  fileUrl?: string;
  fileName?: string;
  fileKey?: string | null;
  recordedBy?: string;
  source?: 'clinician' | 'patient';
  ehrTxId?: string | null;
};

/* ----------------- Helpers & mocks ----------------- */
function makeMockConditions(): Condition[] {
  return [
    {
      id: 'C-1',
      name: 'Hypertension',
      diagnosedAt: '2020-01-01',
      status: 'Active',
      notes: 'Controlled with ACE inhibitor',
      facility: 'Ambulant+ Clinic',
      clinician: 'Dr. Naidoo',
      onAmbulant: true,
      recordedBy: 'Dr. Naidoo',
      source: 'clinician',
    },
  ];
}

function validateFile(f: File | null, maxMB = 12) {
  if (!f) return null;
  const allowed = ['application/pdf', 'image/png', 'image/jpeg'];
  if (f.size > maxMB * 1024 * 1024) return `File too large (max ${maxMB}MB)`;
  if (!allowed.includes(f.type)) return `Unsupported file type: ${f.type}`;
  return null;
}

/* ----------------- Page ----------------- */
export default function ClinicianConditionsPage() {
  const [items, setItems] = useState<Condition[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewName, setPreviewName] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [clinicians, setClinicians] = useState<string[]>([]);
  const [currentClinician, setCurrentClinician] = useState<string | null>(null);
  const [onAmbulantFlag, setOnAmbulantFlag] = useState(false);

  useEffect(() => {
    // load conditions
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/clinician/conditions', { cache: 'no-store' });
        const data = await res.json();
        if (!cancelled) {
          setItems(Array.isArray(data) && data.length ? data : makeMockConditions());
        }
      } catch {
        if (!cancelled) setItems(makeMockConditions());
      }
    }
    load();

    // fetch clinician list
    (async () => {
      try {
        const r = await fetch('/api/clinicians', { cache: 'no-store' });
        const d = await r.json();
        if (Array.isArray(d) && d.length) {
          setClinicians(
            d.map((x: any) =>
              typeof x === 'string' ? x : (x.name ?? x.fullName ?? x.id)
            )
          );
        } else {
          setClinicians(['Dr. Naidoo', 'Dr. Adeola']);
        }
      } catch {
        setClinicians(['Dr. Naidoo', 'Dr. Adeola']);
      }
    })();

    // try to fetch current clinician (for "self" checkbox)
    (async () => {
      try {
        const r = await fetch('/api/auth/me', { cache: 'no-store' });
        if (r.ok) {
          const me = await r.json();
          const name = me?.name || me?.fullName || me?.username;
          if (name) setCurrentClinician(name);
        }
      } catch {
        // ignore
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setSelectedFile(null);
    setPreviewName(null);
    if (!f) return;
    const err = validateFile(f, 12);
    if (err) {
      alert(err);
      return;
    }
    setSelectedFile(f);
    setPreviewName(f.name);
  }

  function uploadWithProgress(fd: FormData, endpoint: string) {
    return new Promise<{ ok: boolean; json?: any }>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', endpoint, true);
      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable) {
          setUploadProgress(Math.round((ev.loaded / ev.total) * 100));
        }
      };
      xhr.onload = () => {
        setUploadProgress(null);
        try {
          resolve({
            ok: xhr.status >= 200 && xhr.status < 300,
            json: JSON.parse(xhr.responseText || '{}'),
          });
        } catch (e) {
          resolve({
            ok: xhr.status >= 200 && xhr.status < 300,
            json: { raw: xhr.responseText },
          });
        }
      };
      xhr.onerror = () => {
        setUploadProgress(null);
        resolve({ ok: false });
      };
      xhr.send(fd);
    });
  }

  async function onAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const name = String(f.get('name') || '').trim();
    if (!name) {
      alert('Please enter condition name');
      return;
    }
    const diagnosedAt = String(f.get('diagnosedAt') || '');
    const status = String(f.get('status') || 'Active') as ConditionStatus;
    const notes = String(f.get('notes') || '');
    const facility = String(f.get('facility') || '');
    let clinician = String(f.get('clinician') || '');
    const clinicianExternal = String(f.get('clinicianExternal') || '').trim();
    const onAmbulant = Boolean(
      f.get('onAmbulant') === 'on' || f.get('onAmbulant') === 'true'
    );

    // If diagnosed outside Ambulant+, prefer the typed external clinician
    if (!onAmbulant && clinicianExternal) {
      clinician = clinicianExternal;
    }

    // If "self" was checked we expect a special field 'useSelf'
    const useSelf = Boolean(
      f.get('useSelf') === 'on' || f.get('useSelf') === 'true'
    );
    if (useSelf && currentClinician && onAmbulant) {
      clinician = currentClinician;
    }

    // optimistic
    const tempId = `C-${Date.now()}`;
    const optimistic: Condition = {
      id: tempId,
      name,
      diagnosedAt: diagnosedAt || undefined,
      status,
      notes,
      facility: facility || undefined,
      clinician: clinician || undefined,
      onAmbulant,
      recordedBy: currentClinician || 'Clinician (local)',
      source: 'clinician',
    };
    setItems((prev) => [optimistic, ...prev]);
    setAddOpen(false);

    // prepare payload
    const payload = new FormData();
    payload.append('name', name);
    if (diagnosedAt) payload.append('diagnosedAt', diagnosedAt);
    payload.append('status', status);
    if (notes) payload.append('notes', notes);
    if (facility) payload.append('facility', facility);
    if (clinician) payload.append('clinician', clinician);
    payload.append('onAmbulant', String(onAmbulant));
    if (selectedFile) payload.append('file', selectedFile);

    const res = await uploadWithProgress(payload, '/api/clinician/conditions');
    if (res.ok && res.json) {
      const serverRecord = res.json.record;
      setItems((prev) => prev.map((it) => (it.id === tempId ? serverRecord ?? it : it)));
      alert('Condition recorded');
    } else {
      alert('Save failed to server — record saved locally (optimistic).');
    }

    setSelectedFile(null);
    setPreviewName(null);
    setUploadProgress(null);
  }

  return (
    <main className="p-4 space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Conditions — Clinician</h1>
        <button
          onClick={() => setAddOpen(true)}
          className="px-3 py-1 bg-blue-600 text-white rounded flex items-center gap-2"
        >
          <FiPlus /> New Condition
        </button>
      </div>

      <ul className="space-y-2">
        {items.map((c) => (
          <li key={c.id} className="border rounded p-3 bg-white">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-medium flex items-center gap-2">
                  <span>
                    {c.name}{' '}
                    <span className="text-xs text-zinc-500">
                      ({c.status ?? 'Unknown'})
                    </span>
                  </span>
                  {c.onAmbulant && (
                    <span className="text-[10px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full uppercase tracking-wide">
                      Ambulant+
                    </span>
                  )}
                  {c.ehrTxId && (
                    <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full uppercase tracking-wide">
                      EHR anchored
                    </span>
                  )}
                </div>
                <div className="text-xs text-zinc-400">
                  {c.diagnosedAt
                    ? `${format(new Date(c.diagnosedAt), 'yyyy-MM-dd')}`
                    : 'Unknown date'}
                  {c.facility ? ` • ${c.facility}` : ''}
                  {c.clinician ? ` • ${c.clinician}` : ''}
                </div>
                {c.notes && (
                  <div className="mt-1 text-sm text-zinc-700">{c.notes}</div>
                )}
                {c.fileUrl && (
                  <div className="mt-1 text-xs">
                    <a
                      className="underline"
                      href={c.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {c.fileName ?? 'View document'}
                    </a>
                  </div>
                )}
              </div>
              <div className="text-xs text-zinc-400 text-right">
                {c.recordedBy}
              </div>
            </div>
          </li>
        ))}
      </ul>

      {/* Add modal */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <form
            onSubmit={onAdd}
            className="bg-white rounded p-4 w-full max-w-lg space-y-3"
          >
            <h2 className="text-lg font-semibold">Record Condition</h2>

            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs">
                Condition name
                <input name="name" className="border rounded px-2 py-1 w-full" />
              </label>
              <label className="text-xs">
                Status
                <select
                  name="status"
                  defaultValue="Active"
                  className="border rounded px-2 py-1 w-full"
                >
                  <option>Active</option>
                  <option>Inactive</option>
                  <option>Controlled</option>
                  <option>Suppressed</option>
                  <option>Remission</option>
                  <option>Resolved</option>
                </select>
              </label>
              <label className="text-xs">
                Diagnosed at (date)
                <input
                  name="diagnosedAt"
                  type="date"
                  className="border rounded px-2 py-1 w-full"
                />
              </label>
              <label className="text-xs">
                Facility
                <input
                  name="facility"
                  placeholder="Facility name"
                  className="border rounded px-2 py-1 w-full"
                />
              </label>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-4 text-xs">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="onAmbulant"
                    onChange={(e) => setOnAmbulantFlag(e.target.checked)}
                  />
                  Diagnosed on Ambulant+
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="useSelf" />
                  I&apos;m the diagnosing clinician (Ambulant+)
                </label>
              </div>

              {onAmbulantFlag ? (
                <div className="grid grid-cols-2 gap-2 items-end">
                  <label className="text-xs">
                    Diagnosing clinician (Ambulant+)
                    <select
                      name="clinician"
                      defaultValue=""
                      className="border rounded px-2 py-1 w-full"
                    >
                      <option value="">— select clinician —</option>
                      {clinicians.map((cl) => (
                        <option key={cl} value={cl}>
                          {cl}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className="text-[11px] text-zinc-500">
                    Use the dropdown or “I&apos;m the clinician” above.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 items-end">
                  <label className="text-xs col-span-2">
                    Diagnosing clinician (outside Ambulant+)
                    <input
                      name="clinicianExternal"
                      placeholder="Type clinician name"
                      className="border rounded px-2 py-1 w-full"
                    />
                  </label>
                </div>
              )}
            </div>

            <label className="text-xs">
              Notes
              <textarea
                name="notes"
                rows={3}
                className="border rounded px-2 py-1 w-full"
              ></textarea>
            </label>

            <label className="text-xs">
              Attach supporting doc (pdf/png/jpg, max 12MB)
              <input
                type="file"
                accept=".pdf,image/png,image/jpeg"
                onChange={onFileChange}
                className="mt-1"
              />
            </label>
            {previewName && (
              <div className="text-xs text-zinc-500">Selected: {previewName}</div>
            )}
            {uploadProgress != null && (
              <div className="w-full bg-gray-100 rounded h-3 mt-1">
                <div
                  className="h-3 rounded bg-blue-600"
                  style={{ width: `${uploadProgress}%` }}
                />
                <div className="text-xs mt-1">{uploadProgress}%</div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="px-3 py-1 border rounded"
                onClick={() => {
                  setAddOpen(false);
                  setOnAmbulantFlag(false);
                  setSelectedFile(null);
                  setPreviewName(null);
                  setUploadProgress(null);
                }}
              >
                Cancel
              </button>
              <button className="px-3 py-1 bg-blue-600 text-white rounded">
                Save & Upload
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
