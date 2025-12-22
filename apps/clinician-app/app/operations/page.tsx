'use client';
import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { FiPlus, FiClock } from 'react-icons/fi';

const GATEWAY = process.env.NEXT_PUBLIC_APIGW_BASE ?? '';

type Operation = {
  id: string;
  title: string;
  date?: string;
  facility?: string;
  surgeon?: string; // lead surgeon
  coClinicians?: string[]; // other clinicians involved
  clinicianCount?: number; // number of clinicians involved
  notes?: string;
  fileUrl?: string;
  fileName?: string;
  fileKey?: string | null;
  recordedBy?: string;
  source?: 'clinician' | 'patient';
  followupAt?: string | null;
  followupLabel?: string | null;
  ehrTxId?: string | null;
};

/* ----------------- Helpers & mocks ----------------- */
function makeMockOps(): Operation[] {
  return [
    {
      id: 'OP-1',
      title: 'Appendicectomy',
      date: new Date(Date.now() - 86400000 * 1200).toISOString(),
      facility: 'Ambulant+ Surgical Centre',
      surgeon: 'Dr. Teeke',
      coClinicians: ['Dr. Naidoo'],
      clinicianCount: 2,
      notes: 'Laparoscopic; no complications',
      recordedBy: 'Dr. Teeke',
      source: 'clinician',
    },
  ];
}

function validateFile(f: File | null, maxMB = 24) {
  if (!f) return null;
  const allowed = ['application/pdf', 'image/png', 'image/jpeg'];
  if (f.size > maxMB * 1024 * 1024) return `File too large (max ${maxMB}MB)`;
  if (!allowed.includes(f.type)) return `Unsupported file type: ${f.type}`;
  return null;
}

/* ----------------- Page ----------------- */
export default function ClinicianOperationsPage() {
  const [items, setItems] = useState<Operation[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewName, setPreviewName] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [clinicians, setClinicians] = useState<string[]>([]);
  const [currentClinician, setCurrentClinician] = useState<string | null>(null);
  const [useExternalSurgeon, setUseExternalSurgeon] = useState(false);

  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleTarget, setScheduleTarget] = useState<Operation | null>(null);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleNotes, setScheduleNotes] = useState('');
  const [scheduleSaving, setScheduleSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/clinician/operations', { cache: 'no-store' });
        const data = await res.json();
        if (!cancelled) {
          setItems(Array.isArray(data) && data.length ? data : makeMockOps());
        }
      } catch {
        if (!cancelled) setItems(makeMockOps());
      }
    })();

    // clinicians list
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
          setClinicians(['Dr. Teeke', 'Dr. Naidoo', 'Dr. Adeola']);
        }
      } catch {
        setClinicians(['Dr. Teeke', 'Dr. Naidoo', 'Dr. Adeola']);
      }
    })();

    // current clinician
    (async () => {
      try {
        const r = await fetch('/api/auth/me', { cache: 'no-store' });
        if (r.ok) {
          const me = await r.json();
          const name = me?.name || me?.fullName || me?.username;
          if (name) setCurrentClinician(name);
        }
      } catch {}
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
    const err = validateFile(f, 24);
    if (err) {
      alert(err);
      return;
    }
    setSelectedFile(f);
    setPreviewName(f.name);
  }

  async function presignAndUpload(file: File) {
    if (!GATEWAY) throw new Error('Gateway (NEXT_PUBLIC_APIGW_BASE) is not configured');
    const metaRes = await fetch(`${GATEWAY}/files/presign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: 'operation-report',
        contentType: file.type,
        fileName: file.name,
      }),
    });
    if (!metaRes.ok) throw new Error('Failed to request presigned URL');
    const meta = await metaRes.json();
    const { url, fields, fileKey, fileName } = meta;

    const fd = new FormData();
    Object.entries(fields || {}).forEach(([k, v]) => fd.append(k, String(v)));
    fd.append('file', file);

    const s3Res = await fetch(url, { method: 'POST', body: fd });
    if (!s3Res.ok) throw new Error('Operation report upload failed');

    return { fileKey, fileName };
  }

  function uploadWithProgress(fd: FormData, endpoint: string) {
    return new Promise<{ ok: boolean; json?: any }>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', endpoint, true);
      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable) setUploadProgress(Math.round((ev.loaded / ev.total) * 100));
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
    const title = String(f.get('title') || '').trim();
    if (!title) {
      alert('Please enter operation title');
      return;
    }
    const date = String(f.get('date') || '');
    const facility = String(f.get('facility') || '');
    const surgeonDropdown = String(f.get('surgeon') || '');
    const surgeonExternal = String(f.get('surgeonExternal') || '').trim();
    const coCliniciansRaw = String(f.get('coClinicians') || '');
    const coClinicians = coCliniciansRaw
      ? coCliniciansRaw.split(',').map((s) => s.trim()).filter(Boolean)
      : [];
    const clinicianCount =
      Number(f.get('clinicianCount') || (1 + coClinicians.length)) ||
      (1 + coClinicians.length);
    const notes = String(f.get('notes') || '');

    // if checkbox 'useSelf' then set surgeon to currentClinician
    const useSelf = Boolean(
      f.get('useSelf') === 'on' || f.get('useSelf') === 'true'
    );

    let leadSurgeon: string | undefined;
    if (useExternalSurgeon && surgeonExternal) {
      leadSurgeon = surgeonExternal;
    } else if (useSelf && currentClinician) {
      leadSurgeon = currentClinician;
    } else if (surgeonDropdown) {
      leadSurgeon = surgeonDropdown;
    } else if (surgeonExternal) {
      // fallback: if they typed but toggle got changed
      leadSurgeon = surgeonExternal;
    }

    let fileKey: string | undefined;
    let fileName: string | undefined;
    try {
      if (selectedFile) {
        const uploaded = await presignAndUpload(selectedFile);
        fileKey = uploaded.fileKey;
        fileName = uploaded.fileName;
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Operation report upload failed');
      return;
    }

    // optimistic
    const tempId = `OP-${Date.now()}`;
    const optimistic: Operation = {
      id: tempId,
      title,
      date: date || undefined,
      facility: facility || undefined,
      surgeon: leadSurgeon,
      coClinicians: coClinicians.length ? coClinicians : undefined,
      clinicianCount,
      notes,
      fileKey: fileKey ?? null,
      fileName: fileName ?? selectedFile?.name ?? undefined,
      recordedBy: currentClinician || 'Clinician (local)',
      source: 'clinician',
    };
    setItems((prev) => [optimistic, ...prev]);
    setAddOpen(false);

    const payload = new FormData();
    payload.append('title', title);
    if (date) payload.append('date', date);
    if (facility) payload.append('facility', facility);
    if (leadSurgeon) payload.append('surgeon', leadSurgeon);
    if (coClinicians.length) payload.append('coClinicians', JSON.stringify(coClinicians));
    payload.append('clinicianCount', String(clinicianCount));
    if (notes) payload.append('notes', notes);
    if (fileKey) payload.append('fileKey', fileKey);
    if (fileName) payload.append('fileName', fileName);

    const res = await uploadWithProgress(payload, '/api/clinician/operations');
    if (res.ok && res.json) {
      const serverRecord = res.json.record;
      setItems((prev) => prev.map((it) => (it.id === tempId ? serverRecord ?? it : it)));
      alert('Operation recorded');
    } else {
      alert('Save failed to server — record saved locally (optimistic).');
    }

    setSelectedFile(null);
    setPreviewName(null);
    setUploadProgress(null);
  }

  function openSchedule(op: Operation) {
    setScheduleTarget(op);
    setScheduleDate(op.followupAt ? op.followupAt.substring(0, 10) : '');
    setScheduleNotes(op.followupLabel || '');
    setScheduleOpen(true);
  }

  async function saveSchedule(e: React.FormEvent) {
    e.preventDefault();
    if (!scheduleTarget) return;
    if (!scheduleDate) {
      alert('Select a follow-up date');
      return;
    }
    setScheduleSaving(true);
    try {
      const res = await fetch(
        `/api/clinician/operations/${encodeURIComponent(scheduleTarget.id)}/schedule`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            followupAt: scheduleDate,
            followupLabel: scheduleNotes || undefined,
          }),
        }
      );
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || !data.record) {
        throw new Error(data.error || 'Failed to save schedule');
      }
      setItems((prev) =>
        prev.map((o) => (o.id === scheduleTarget.id ? data.record : o))
      );
      setScheduleOpen(false);
      setScheduleTarget(null);
      setScheduleDate('');
      setScheduleNotes('');
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Failed to schedule follow-up');
    } finally {
      setScheduleSaving(false);
    }
  }

  return (
    <main className="p-4 space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Operations — Clinician</h1>
        <button
          onClick={() => setAddOpen(true)}
          className="px-3 py-1 bg-blue-600 text-white rounded flex items-center gap-2"
        >
          <FiPlus /> Record Operation
        </button>
      </div>

      <ul className="space-y-2">
        {items.map((op) => (
          <li key={op.id} className="border rounded p-3 bg-white">
            <div className="flex justify-between items-start gap-2">
              <div>
                <div className="font-medium flex items-center gap-2">
                  <span>{op.title}</span>
                  {op.ehrTxId && (
                    <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full uppercase tracking-wide">
                      EHR anchored
                    </span>
                  )}
                  {op.followupAt && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                      <FiClock className="w-3 h-3" />
                      Follow-up
                    </span>
                  )}
                </div>
                <div className="text-xs text-zinc-400">
                  {op.date
                    ? format(new Date(op.date), 'yyyy-MM-dd')
                    : 'Unknown date'}
                  {op.facility ? ` • ${op.facility}` : ''}
                  {op.surgeon ? ` • Lead: ${op.surgeon}` : ''}
                  {op.clinicianCount ? ` • ${op.clinicianCount} clinician(s)` : ''}
                </div>
                {op.coClinicians && op.coClinicians.length > 0 && (
                  <div className="text-xs text-zinc-500 mt-1">
                    Co-clinicians: {op.coClinicians.join(', ')}
                  </div>
                )}
                {op.notes && (
                  <div className="mt-1 text-sm text-zinc-700">{op.notes}</div>
                )}
                {op.followupAt && (
                  <div className="text-xs text-blue-700 mt-1">
                    Follow-up scheduled: {op.followupAt.substring(0, 10)}
                    {op.followupLabel && ` — ${op.followupLabel}`}
                  </div>
                )}
                {op.fileUrl && (
                  <div className="mt-1 text-xs">
                    <a
                      className="underline"
                      href={op.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {op.fileName ?? 'View report'}
                    </a>
                  </div>
                )}
              </div>
              <div className="flex flex-col items-end gap-1 text-xs text-zinc-400">
                <div>{op.recordedBy}</div>
                <button
                  type="button"
                  className="text-[11px] text-blue-600 hover:text-blue-700"
                  onClick={() => openSchedule(op)}
                >
                  Schedule follow-up
                </button>
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
            className="bg-white rounded p-4 w-full max-w-2xl space-y-3"
          >
            <h2 className="text-lg font-semibold">Record Operation</h2>

            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs">
                Operation title
                <input name="title" className="border rounded px-2 py-1 w-full" />
              </label>
              <label className="text-xs">
                Date
                <input
                  name="date"
                  type="date"
                  className="border rounded px-2 py-1 w-full"
                />
              </label>
              <label className="text-xs">
                Facility
                <input
                  name="facility"
                  placeholder="Facility where operation performed"
                  className="border rounded px-2 py-1 w-full"
                />
              </label>
              <div className="text-xs space-y-1">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setUseExternalSurgeon(false)}
                    className={`flex-1 border rounded px-2 py-1 ${
                      !useExternalSurgeon
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-gray-50 text-gray-700'
                    }`}
                  >
                    Lead on Ambulant+
                  </button>
                  <button
                    type="button"
                    onClick={() => setUseExternalSurgeon(true)}
                    className={`flex-1 border rounded px-2 py-1 ${
                      useExternalSurgeon
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-gray-50 text-gray-700'
                    }`}
                  >
                    External lead
                  </button>
                </div>
                {!useExternalSurgeon && (
                  <label className="block mt-1">
                    Lead surgeon (Ambulant+)
                    <select
                      name="surgeon"
                      defaultValue=""
                      className="border rounded px-2 py-1 w-full mt-1"
                    >
                      <option value="">— select lead surgeon —</option>
                      {clinicians.map((cl) => (
                        <option key={cl} value={cl}>
                          {cl}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {useExternalSurgeon && (
                  <label className="block mt-1">
                    Lead clinician name (external)
                    <input
                      name="surgeonExternal"
                      placeholder="Type lead clinician"
                      className="border rounded px-2 py-1 w-full mt-1"
                    />
                  </label>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs">
                Co-clinicians (comma separated)
                <input
                  name="coClinicians"
                  placeholder="Dr A, Dr B"
                  className="border rounded px-2 py-1 w-full"
                />
              </label>
              <label className="text-xs">
                Number of clinicians involved
                <input
                  name="clinicianCount"
                  type="number"
                  min={1}
                  defaultValue={1}
                  className="border rounded px-2 py-1 w-full"
                />
              </label>
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" name="useSelf" />
                I was the lead surgeon (Ambulant+)
              </label>
              <span className="text-[11px] text-zinc-500">
                Or use dropdown / external lead above.
              </span>
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
              Attach operation report (pdf/png/jpg, max 24MB)
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
                  setSelectedFile(null);
                  setPreviewName(null);
                  setUploadProgress(null);
                  setUseExternalSurgeon(false);
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

      {/* Schedule follow-up modal */}
      {scheduleOpen && scheduleTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <form
            onSubmit={saveSchedule}
            className="bg-white rounded p-4 w-full max-w-md space-y-3"
          >
            <h2 className="text-lg font-semibold">Schedule follow-up</h2>
            <p className="text-xs text-zinc-500">{scheduleTarget.title}</p>
            <label className="text-xs">
              Follow-up date
              <input
                type="date"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
                className="border rounded px-2 py-1 w-full mt-1"
              />
            </label>
            <label className="text-xs">
              Notes (e.g. wound review, suture removal)
              <textarea
                value={scheduleNotes}
                onChange={(e) => setScheduleNotes(e.target.value)}
                className="border rounded px-2 py-1 w-full mt-1"
              />
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="border rounded px-3 py-1"
                onClick={() => {
                  setScheduleOpen(false);
                  setScheduleTarget(null);
                  setScheduleDate('');
                  setScheduleNotes('');
                }}
              >
                Cancel
              </button>
              <button
                className="px-3 py-1 bg-blue-600 text-white rounded"
                disabled={scheduleSaving}
              >
                {scheduleSaving ? 'Saving…' : 'Save schedule'}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
