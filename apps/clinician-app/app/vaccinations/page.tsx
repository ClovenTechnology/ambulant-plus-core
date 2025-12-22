'use client';
import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { FiPlus, FiClock } from 'react-icons/fi';

const GATEWAY = process.env.NEXT_PUBLIC_APIGW_BASE ?? '';

type Vaccination = {
  id: string;
  vaccine: string;
  date?: string;
  batch?: string;
  notes?: string;
  clinician?: string;
  facility?: string;
  fileUrl?: string;
  fileName?: string;
  fileKey?: string | null;
  followupAt?: string | null;
  followupLabel?: string | null;
  ehrTxId?: string | null;
};

function makeMockVax(): Vaccination[] {
  return [
    {
      id: 'VAX-1',
      vaccine: 'COVID-19 (Pfizer)',
      date: new Date(Date.now() - 86400000 * 600).toISOString(),
      batch: 'PF12345',
      notes: '2 doses',
      clinician: 'Dr. Adeola',
      facility: 'Lagos General Hospital',
    },
  ];
}

export default function VaccinationsPage() {
  const [items, setItems] = useState<Vaccination[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewName, setPreviewName] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleTarget, setScheduleTarget] = useState<Vaccination | null>(null);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleNotes, setScheduleNotes] = useState('');
  const [scheduleSaving, setScheduleSaving] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/clinician/vaccinations', { cache: 'no-store' });
        const data = await res.json();
        setItems(Array.isArray(data) && data.length ? data : makeMockVax());
      } catch {
        setItems(makeMockVax());
      }
    }
    load();
  }, []);

  function validateFile(f: File) {
    const maxMB = 8;
    const allowed = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    if (f.size > maxMB * 1024 * 1024) return `File too large (max ${maxMB}MB)`;
    if (!allowed.includes(f.type)) return `Unsupported file type: ${f.type}`;
    return null;
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setSelectedFile(null);
    setPreviewName(null);
    if (!f) return;
    const err = validateFile(f);
    if (err) return alert(err);
    setSelectedFile(f);
    setPreviewName(f.name);
  }

  async function presignAndUpload(file: File) {
    if (!GATEWAY) throw new Error('Gateway (NEXT_PUBLIC_APIGW_BASE) is not configured');
    const metaRes = await fetch(`${GATEWAY}/files/presign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: 'vaccination-certificate',
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
    if (!s3Res.ok) throw new Error('Certificate upload failed');

    return { fileKey, fileName };
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
    const vaccine = String(f.get('vaccine') || '').trim();
    if (!vaccine) return alert('Enter vaccine name');
    const date = String(f.get('date') || '');
    const batch = String(f.get('batch') || '');
    const notes = String(f.get('notes') || '');
    const clinician = String(f.get('clinician') || '');
    const facility = String(f.get('facility') || '');

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
      alert(err.message || 'Certificate upload failed');
      return;
    }

    const tempId = `VAX-${Date.now()}`;
    const optimistic: Vaccination = {
      id: tempId,
      vaccine,
      date: date || undefined,
      batch: batch || undefined,
      notes,
      clinician,
      facility,
      fileKey: fileKey ?? null,
      fileName: fileName ?? selectedFile?.name ?? undefined,
    };
    setItems((prev) => [optimistic, ...prev]);
    setAddOpen(false);

    const payload = new FormData();
    payload.append('vaccine', vaccine);
    if (date) payload.append('date', date);
    if (batch) payload.append('batch', batch);
    if (notes) payload.append('notes', notes);
    if (clinician) payload.append('clinician', clinician);
    if (facility) payload.append('facility', facility);
    if (fileKey) payload.append('fileKey', fileKey);
    if (fileName) payload.append('fileName', fileName);

    const res = await uploadWithProgress(payload, '/api/clinician/vaccinations');
    if (res.ok && res.json) {
      const serverRecord = res.json.record;
      setItems((prev) => prev.map((it) => (it.id === tempId ? serverRecord ?? it : it)));
      alert('Vaccination uploaded');
    } else {
      alert('Upload failed, saved locally');
    }

    setSelectedFile(null);
    setPreviewName(null);
    setUploadProgress(null);
  }

  function openSchedule(v: Vaccination) {
    setScheduleTarget(v);
    setScheduleDate(v.followupAt ? v.followupAt.substring(0, 10) : '');
    setScheduleNotes(v.followupLabel || '');
    setScheduleOpen(true);
  }

  async function saveSchedule(e: React.FormEvent) {
    e.preventDefault();
    if (!scheduleTarget) return;
    if (!scheduleDate) {
      alert('Select a follow-up / booster date');
      return;
    }
    setScheduleSaving(true);
    try {
      const res = await fetch(
        `/api/clinician/vaccinations/${encodeURIComponent(
          scheduleTarget.id
        )}/schedule`,
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
        prev.map((v) => (v.id === scheduleTarget.id ? data.record : v))
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
        <h1 className="text-2xl font-bold">Vaccinations — Clinician</h1>
        <button
          onClick={() => setAddOpen(true)}
          className="px-3 py-1 bg-blue-600 text-white rounded flex items-center gap-2"
        >
          <FiPlus /> Add
        </button>
      </div>

      <ul className="space-y-2">
        {items.map((v) => (
          <li key={v.id} className="border rounded p-3 bg-white">
            <div className="flex justify-between items-start gap-2">
              <div>
                <div className="font-medium flex items-center gap-2">
                  <span>{v.vaccine}</span>
                  {v.ehrTxId && (
                    <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full uppercase tracking-wide">
                      EHR anchored
                    </span>
                  )}
                  {v.followupAt && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                      <FiClock className="w-3 h-3" />
                      Follow-up
                    </span>
                  )}
                </div>
                <div className="text-xs text-zinc-400">
                  {v.date
                    ? format(new Date(v.date), 'yyyy-MM-dd')
                    : 'Unknown date'}{' '}
                  {v.batch ? `• batch ${v.batch}` : ''}{' '}
                  {v.clinician ? `• ${v.clinician}` : ''}{' '}
                  {v.facility ? `• ${v.facility}` : ''}
                </div>
                {v.notes && (
                  <div className="text-sm text-zinc-700 mt-1">{v.notes}</div>
                )}
                {v.followupAt && (
                  <div className="text-xs text-blue-700 mt-1">
                    Next booster: {v.followupAt.substring(0, 10)}
                    {v.followupLabel && ` — ${v.followupLabel}`}
                  </div>
                )}
                {v.fileUrl && (
                  <div className="text-xs mt-1">
                    <a
                      href={v.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="underline"
                    >
                      {v.fileName || 'View certificate'}
                    </a>
                  </div>
                )}
              </div>
              <div className="flex flex-col items-end gap-1">
                <button
                  type="button"
                  onClick={() => openSchedule(v)}
                  className="text-[11px] text-blue-600 hover:text-blue-700"
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
            className="bg-white rounded p-4 w-full max-w-md space-y-2"
          >
            <h2 className="text-lg font-semibold">Add Vaccination</h2>
            <input
              name="vaccine"
              placeholder="Vaccine name"
              className="border rounded px-2 py-1 w-full"
            />
            <input
              type="date"
              name="date"
              className="border rounded px-2 py-1 w-full"
            />
            <input
              name="batch"
              placeholder="Batch"
              className="border rounded px-2 py-1 w-full"
            />
            <input
              name="clinician"
              placeholder="Administered by (clinician)"
              className="border rounded px-2 py-1 w-full"
            />
            <input
              name="facility"
              placeholder="Facility"
              className="border rounded px-2 py-1 w-full"
            />
            <textarea
              name="notes"
              placeholder="Notes"
              className="border rounded px-2 py-1 w-full"
            ></textarea>
            <label className="text-xs">
              Vaccination certificate (pdf/png/jpg, max 8MB)
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
              </div>
            )}
            <div className="flex justify-end gap-2 mt-2">
              <button
                type="button"
                className="border rounded px-3 py-1"
                onClick={() => {
                  setAddOpen(false);
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

      {/* Schedule follow-up modal */}
      {scheduleOpen && scheduleTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <form
            onSubmit={saveSchedule}
            className="bg-white rounded p-4 w-full max-w-md space-y-3"
          >
            <h2 className="text-lg font-semibold">Schedule follow-up / booster</h2>
            <p className="text-xs text-zinc-500">{scheduleTarget.vaccine}</p>
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
              Notes (e.g. dose number, booster details)
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
