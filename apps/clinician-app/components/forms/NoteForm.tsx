// apps/clinician-app/components/forms/NoteForm.tsx
'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';

/**
 * Dynamic TipTap editor loader (client only).
 * Uses immediatelyRender: false to avoid hydration mismatch in Next.js.
 */
const RichEditor = dynamic(async () => {
  try {
    const [{ EditorContent, useEditor }, StarterKitModule] = await Promise.all([
      import('@tiptap/react'),
      import('@tiptap/starter-kit'),
    ]);

    const StarterKit = (StarterKitModule && (StarterKitModule as any).default) || StarterKitModule;

    return function TipTapEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
      // NOTE: `immediatelyRender: false` is essential to avoid SSR/hydration mismatch.
      const editor = useEditor({
        extensions: [StarterKit],
        content: value || '',
        onUpdate({ editor: ed }) {
          onChange(ed.getHTML());
        },
        editorProps: { attributes: { 'aria-label': 'Note editor' } },
        // avoid SSR hydration mismatch
        immediatelyRender: false as any,
      } as any);

      // Keep external changes in sync
      useEffect(() => {
        if (!editor) return;
        const current = editor.getHTML();
        if ((value || '') !== current) editor.commands.setContent(value || '', false);
      }, [value, editor]);

      return (
        <div>
          <div className="border rounded overflow-hidden">
            <div className="px-2 py-1 bg-gray-50 border-b flex gap-2">
              <button
                type="button"
                onClick={() => editor?.chain().focus().toggleBold().run()}
                className="text-xs px-2 py-1 border rounded"
                aria-label="Bold"
              >
                B
              </button>
              <button
                type="button"
                onClick={() => editor?.chain().focus().toggleItalic().run()}
                className="text-xs px-2 py-1 border rounded"
                aria-label="Italic"
              >
                i
              </button>
              <button
                type="button"
                onClick={() => editor?.chain().focus().toggleBulletList().run()}
                className="text-xs px-2 py-1 border rounded"
                aria-label="Bullets"
              >
                •
              </button>
              <button
                type="button"
                onClick={() => editor?.chain().focus().toggleOrderedList().run()}
                className="text-xs px-2 py-1 border rounded"
                aria-label="Numbered"
              >
                1.
              </button>
            </div>
            <div className="p-2">
              <EditorContent editor={editor} />
            </div>
          </div>
        </div>
      );
    };
  } catch (err) {
    // fallback: simple textarea
    return function FallbackEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
      return (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full border rounded px-3 py-2 text-sm resize-y min-h-[160px]"
          aria-label="Plain note editor"
        />
      );
    };
  }
}, { ssr: false });

/* ----------------- Note form implementation ----------------- */

type NoteFormType = {
  patientName: string;
  patientId?: string | null;
  title: string;
  content: string;
  priority: 'Low' | 'Medium' | 'High';
  tags?: string[];
  encounterId?: string | null;
  attachments?: { id: string; name: string; type: string; size: number; url?: string }[];
};

export default function NoteForm({
  clinicianId = 'clin-demo',
  onSaved = (v: any) => {},
}: {
  clinicianId?: string;
  onSaved?: (v: any) => void;
}) {
  const storageKey = `note-draft:${clinicianId}`;

  const [form, setForm] = useState<NoteFormType>({
    patientName: '',
    patientId: null,
    title: '',
    content: '',
    priority: 'Low',
    tags: [],
    encounterId: null,
    attachments: [],
  });

  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; kind?: 'success' | 'error' } | null>(null);
  const [preview, setPreview] = useState(false);

  // Patient search
  const [patientQ, setPatientQ] = useState('');
  const [patients, setPatients] = useState<{ id: string; name: string }[]>([]);
  const [patLoading, setPatLoading] = useState(false);
  const [showPatientList, setShowPatientList] = useState(false);
  const patFetchRef = useRef<number | null>(null);

  // Encounters for selected patient
  const [encounters, setEncounters] = useState<{ id: string; when?: string; reason?: string }[]>([]);
  const [encLoading, setEncLoading] = useState(false);

  // Mock patients (10 South African names)
  const MOCK_PATIENTS = useMemo(() => ([
    { id: 'PT-1001', name: 'Nomsa Dlamini' },
    { id: 'PT-1002', name: 'Thabo Mbeki' },
    { id: 'PT-1003', name: 'Lerato Mokoena' },
    { id: 'PT-1004', name: 'Sipho Nkosi' },
    { id: 'PT-1005', name: 'Zanele Khumalo' },
    { id: 'PT-1006', name: 'Mpho Mahlangu' },
    { id: 'PT-1007', name: 'Sibusiso Ndlovu' },
    { id: 'PT-1008', name: 'Themba Tshabalala' },
    { id: 'PT-1009', name: 'Nkateko van der Merwe' },
    { id: 'PT-1010', name: 'Kagiso Petersen' },
  ]), []);

  // Templates
  const TEMPLATES = useMemo(() => [
    { id: 't1', title: 'General consult', text: 'Patient presents with acute symptoms. Exam normal. Plan: conservative management and safety-netting.' },
    { id: 't2', title: 'Follow up', text: 'Follow-up visit to review response to therapy. Continue current meds. Return in 2 weeks.' },
    { id: 't3', title: 'Prescription note', text: 'Prescribed medication as discussed. Counseled patient on adherence and side effects.' },
  ], []);

  // Load draft
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<NoteFormType>;
        setForm((f) => ({ ...f, ...parsed }));
        if (parsed?.patientName) setPatientQ(parsed.patientName);
      }
    } catch {}
  }, [storageKey]);

  // Autosave
  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        localStorage.setItem(storageKey, JSON.stringify({
          patientName: form.patientName,
          patientId: form.patientId,
          title: form.title,
          content: form.content,
          priority: form.priority,
          tags: form.tags || [],
          encounterId: form.encounterId || null,
          attachments: form.attachments || [],
        }));
      } catch {}
    }, 400);
    return () => window.clearTimeout(t);
  }, [form, storageKey]);

  // Patient search / autosuggest (attempt API, fallback to MOCK)
  useEffect(() => {
    if (patFetchRef.current) window.clearTimeout(patFetchRef.current);
    if (!patientQ || patientQ.trim().length < 1) {
      setPatients([]);
      return;
    }
    setPatLoading(true);
    patFetchRef.current = window.setTimeout(async () => {
      try {
        const q = encodeURIComponent(patientQ.trim());
        const res = await fetch(`/api/patients?q=${q}`, { cache: 'no-store' });
        if (!res.ok) throw new Error('api-failed');
        const json = await res.json();
        if (Array.isArray(json) && json.length) {
          setPatients(json.slice(0, 50).map((p: any) => ({ id: String(p.id || p.patientId || p._id || p.identifier || 'p'), name: p.name || p.fullName || p.displayName || p.patientName || 'Unknown' })));
        } else {
          setPatients(MOCK_PATIENTS.filter(p => (p.name + p.id).toLowerCase().includes(patientQ.toLowerCase())));
        }
      } catch {
        setPatients(MOCK_PATIENTS.filter(p => (p.name + p.id).toLowerCase().includes(patientQ.toLowerCase())));
      } finally {
        setPatLoading(false);
        setShowPatientList(true);
      }
    }, 300);
    return () => { if (patFetchRef.current) window.clearTimeout(patFetchRef.current); };
  }, [patientQ, MOCK_PATIENTS]);

  // Load encounters for selected patient
  useEffect(() => {
    const pid = form.patientId;
    if (!pid) {
      setEncounters([]);
      return;
    }
    let alive = true;
    (async () => {
      setEncLoading(true);
      try {
        const res = await fetch(`/api/appointments?patientId=${encodeURIComponent(String(pid))}&clinicianId=${encodeURIComponent(clinicianId)}`, { cache: 'no-store' });
        if (!res.ok) throw new Error('no-encs');
        const js = await res.json();
        const arr = Array.isArray(js.items) ? js.items : (Array.isArray(js) ? js : js.items || []);
        if (!alive) return;
        setEncounters((arr as any[]).slice(0, 50).map(a => ({
          id: a.id || a._id || a.appointmentId || String(a.id || a._id || Date.now()),
          when: a.startsAt || a.when || a.whenISO || '',
          reason: a.reason || a.caseName || a.title || '',
        })));
      } catch {
        setEncounters([]);
      } finally {
        if (alive) setEncLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [form.patientId, clinicianId]);

  const clearForm = useCallback(() => {
    setForm({
      patientName: '',
      patientId: null,
      title: '',
      content: '',
      priority: 'Low',
      tags: [],
      encounterId: null,
      attachments: [],
    });
    setPatientQ('');
    try { localStorage.removeItem(storageKey); } catch {}
  }, [storageKey]);

  const addTag = (t: string) => {
    const val = t.trim();
    if (!val) return;
    setForm((f) => ({ ...f, tags: Array.from(new Set([...(f.tags || []), val])) }));
  };
  const removeTag = (t: string) => setForm((f) => ({ ...f, tags: (f.tags || []).filter(x => x !== t) }));

  // Attachments handling (client-side)
  function makeId(prefix = 'a') { return `${prefix}-${Math.random().toString(36).slice(2, 9)}`; }
  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const arr = Array.from(files).map((f) => {
      const id = makeId();
      const url = URL.createObjectURL(f);
      return { id, name: f.name, type: f.type, size: f.size, url, file: f } as any;
    });
    setForm((f) => ({ ...f, attachments: [...(f.attachments || []), ...arr] }));
  };
  const removeAttachment = (id: string) => {
    setForm((f) => {
      const found = (f.attachments || []).find(a => a.id === id);
      if (found && found.url) try { URL.revokeObjectURL(found.url); } catch {}
      return { ...f, attachments: (f.attachments || []).filter(a => a.id !== id) };
    });
  };

  // create an encounter (API -> fallback local)
  const createEncounter = useCallback(async (opts?: { whenISO?: string; reason?: string }) => {
    // Construct a minimal appointment payload
    const start = opts?.whenISO ?? new Date().toISOString();
    const end = new Date(Date.parse(start) + 20 * 60000).toISOString();
    const body = {
      clinicianId,
      patientId: form.patientId,
      patientName: form.patientName,
      startsAt: start,
      endsAt: end,
      reason: opts?.reason ?? (form.title || 'Ad-hoc from note'),
      status: 'booked',
    };
    // Try API
    try {
      const r = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (r.ok) {
        const j = await r.json();
        const created = { ...(j || {}), id: j?.id || j?._id || (j?.appointmentId ?? (`enc-${Date.now()}`)) };
        // attach locally and notify page via onSaved
        setForm(f => ({ ...f, encounterId: created.id }));
        onSaved(created); // let page know (so it can refresh)
        setToast({ msg: 'Encounter created & attached', kind: 'success' });
        return created;
      }
      // non-ok -> fallback to local
    } catch (err) {
      // ignore -> fallback
    }
    // Fallback local ad-hoc encounter object
    const fallback = {
      id: `enc-${Date.now()}`,
      clinicianId,
      patientId: form.patientId,
      patientName: form.patientName,
      startsAt: start,
      endsAt: end,
      reason: body.reason,
      status: 'booked',
    };
    setForm(f => ({ ...f, encounterId: fallback.id }));
    // notify page anyway (so it may refresh or show)
    try { onSaved(fallback); } catch {}
    setToast({ msg: 'Local encounter created & attached (offline)', kind: 'success' });
    return fallback;
  }, [clinicianId, form.patientId, form.patientName, form.title, onSaved]);

  // Submit note (simulate upload of attachments; call API if available)
  const handleSubmit = useCallback(async (opts?: { newAfter?: boolean }) => {
    setSaving(true);
    try {
      // Build note payload
      const note = {
        id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        patientName: form.patientName,
        patientId: form.patientId,
        title: form.title,
        content: form.content,
        priority: form.priority,
        tags: form.tags || [],
        encounterId: form.encounterId || null,
        timestamp: new Date().toISOString(),
        clinicianId,
        attachments: (form.attachments || []).map(a => ({ id: a.id, name: a.name, type: a.type, size: a.size })),
      };

      // If your backend supports multipart upload you can send FormData here.
      // We'll attempt a POST /api/notes with JSON (and without real file upload).
      let saved: any = note;
      try {
        const r = await fetch('/api/notes', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(note) });
        if (r.ok) saved = await r.json();
      } catch {
        // ignore -> we keep simulated saved object
      }

      // simulate a short delay
      await new Promise((r) => setTimeout(r, 250));

      // clear local draft (but keep attachments if newAfter not set)
      try { localStorage.removeItem(storageKey); } catch {}

      setToast({ msg: 'Note saved', kind: 'success' });
      onSaved(saved); // notify page-level handler (page will re-fetch appointments etc.)

      if (opts?.newAfter) {
        clearForm();
      }
    } catch (err) {
      console.error(err);
      setToast({ msg: 'Failed to save note', kind: 'error' });
    } finally {
      setSaving(false);
    }
  }, [form, clinicianId, onSaved, clearForm, storageKey]);

  const selectPatient = (p: { id: string; name: string } | null) => {
    if (!p) {
      setForm((f) => ({ ...f, patientName: '', patientId: null, encounterId: null }));
      setPatientQ('');
      setPatients([]);
      return;
    }
    setForm((f) => ({ ...f, patientName: p.name, patientId: p.id, encounterId: null }));
    setPatientQ(p.name);
    setShowPatientList(false);
  };

  function escapeHtml(s: string) {
    return s.replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]!));
  }
  function renderPreview(s: string) {
    if (!s) return '';
    const isHtml = /<\/?[a-z][\s\S]*>/i.test(s);
    if (isHtml) return s;
    let out = escapeHtml(s);
    out = out.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    out = out.replace(/\*(.*?)\*/g, '<em>$1</em>');
    out = out.replace(/\n{2,}/g, '</p><p>');
    return `<p>${out}</p>`;
  }

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <div className="bg-white rounded p-4">
      <h3 className="text-sm font-semibold mb-3">Create New Note</h3>

      <div className="space-y-3">
        {/* Patient search */}
        <div>
          <label className="block text-sm font-medium mb-1">Patient</label>
          <div className="relative">
            <input
              className="w-full border rounded px-3 py-2 text-sm"
              placeholder="Search patients by name or ID..."
              value={patientQ}
              onChange={(e) => { setPatientQ(e.target.value); setShowPatientList(true); }}
              onFocus={() => setShowPatientList(true)}
              aria-autocomplete="list"
            />
            {showPatientList && (patLoading ? (
              <div className="absolute left-0 right-0 mt-1 z-40 rounded border bg-white p-2 text-sm text-gray-500">Searching…</div>
            ) : patients.length ? (
              <ul className="absolute left-0 right-0 z-40 mt-1 max-h-48 overflow-auto rounded border bg-white shadow-sm">
                {patients.map((p) => (
                  <li key={p.id} className="px-3 py-2 cursor-pointer hover:bg-gray-100 flex items-center justify-between" onClick={() => selectPatient(p)}>
                    <div>
                      <div className="font-medium text-sm">{p.name}</div>
                      <div className="text-xs text-gray-500">{p.id}</div>
                    </div>
                    <div className="text-xs text-gray-400">Select</div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="absolute left-0 right-0 mt-1 z-40 rounded border bg-white p-2 text-sm text-gray-500">No patients</div>
            ))}
          </div>
          <div className="text-xs text-gray-500 mt-1">Fallback to mock patients if API unavailable.</div>
        </div>

        {/* Selected patient summary */}
        {form.patientId && (
          <div className="p-2 border rounded bg-gray-50 text-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{form.patientName}</div>
                <div className="text-xs text-gray-500">{form.patientId}</div>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" className="text-xs px-2 py-1 border rounded bg-white" onClick={() => selectPatient(null)}>Clear</button>
                <button
                  type="button"
                  className="text-xs px-2 py-1 border rounded bg-white"
                  onClick={() => createEncounter({ whenISO: new Date().toISOString(), reason: `Ad-hoc created from note by ${clinicianId}` })}
                >
                  + Create & attach encounter
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Attach to encounter selector */}
        <div>
          <label className="block text-sm font-medium mb-1">Attach to encounter / case (optional)</label>
          <div className="flex gap-2">
            <select
              className="flex-1 border rounded px-2 py-1 text-sm"
              value={form.encounterId || ''}
              onChange={(e) => setForm((f) => ({ ...f, encounterId: e.target.value || null }))}
              disabled={!form.patientId || encLoading}
            >
              <option value="">{form.patientId ? (encounters.length ? 'Select encounter...' : 'No encounters found') : 'Select patient first'}</option>
              {encounters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.when ? new Date(c.when).toLocaleString() : c.id} — {c.reason || 'Consult'}
                </option>
              ))}
            </select>

            <button
              type="button"
              className="px-3 py-1 rounded border text-sm"
              onClick={() => {
                // Local quick create -> createEncounter will try API then fallback
                createEncounter({ whenISO: new Date().toISOString(), reason: 'Ad-hoc (created from note)' });
              }}
              title="Create ad-hoc encounter and attach"
            >
              + New
            </button>
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Click +New to create an ad-hoc encounter (will attempt backend create, otherwise created locally).
          </div>
        </div>

        {/* Title */}
        <div>
          <label className="block text-sm font-medium mb-1">Title</label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Short title"
            className="w-full border rounded px-3 py-2 text-sm"
            required
          />
        </div>

        {/* Rich editor */}
        <div>
          <label className="block text-sm font-medium mb-1">Content</label>
          <div>
            {/* @ts-ignore */}
            <RichEditor value={form.content} onChange={(v: string) => setForm((f) => ({ ...f, content: v }))} />
          </div>

          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const t = TEMPLATES[0].text;
                  setForm((f) => ({ ...f, content: f.content ? `${f.content}\n\n${t}` : t }));
                }}
                className="px-2 py-1 text-xs border rounded bg-white"
              >
                Insert template
              </button>

              <select
                onChange={(e) => {
                  const id = e.target.value;
                  if (!id) return;
                  const t = TEMPLATES.find((x) => x.id === id);
                  if (t) setForm((f) => ({ ...f, content: f.content ? `${f.content}\n\n${t.text}` : t.text }));
                  e.currentTarget.value = '';
                }}
                className="text-xs border rounded px-2 py-1"
                defaultValue=""
              >
                <option value="">Templates…</option>
                {TEMPLATES.map((tp) => <option key={tp.id} value={tp.id}>{tp.title}</option>)}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">Preview</label>
              <input type="checkbox" checked={preview} onChange={(e) => setPreview(e.target.checked)} />
            </div>
          </div>
        </div>

        {preview && (
          <div className="border rounded p-3 bg-gray-50">
            <div className="text-xs text-gray-500 mb-2">Preview</div>
            <div className="prose max-w-none text-sm"
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{ __html: renderPreview(form.content) }}
            />
          </div>
        )}

        {/* Attachments */}
        <div>
          <label className="block text-sm font-medium mb-1">Attachments</label>
          <div className="flex gap-2 items-center">
            <input
              type="file"
              multiple
              onChange={(e) => handleFiles(e.target.files)}
              className="text-sm"
            />
            <div className="text-xs text-gray-500">Images and documents supported. Previews available for images.</div>
          </div>

          {form.attachments && form.attachments.length > 0 && (
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-auto pr-2">
              {form.attachments.map((a: any) => (
                <div key={a.id} className="border rounded p-2 flex items-center gap-2 bg-white">
                  {a.type?.startsWith('image/') && a.url ? (
                    <img src={a.url} alt={a.name} className="w-12 h-12 object-cover rounded" />
                  ) : (
                    <div className="w-12 h-12 grid place-items-center bg-gray-50 rounded text-xs">{(a.name || '').split('.').pop()?.toUpperCase() || 'FILE'}</div>
                  )}
                  <div className="flex-1">
                    <div className="font-medium text-sm truncate">{a.name}</div>
                    <div className="text-xs text-gray-500">{Math.round((a.size || 0) / 1024)} KB</div>
                  </div>
                  <div className="flex flex-col gap-1">
                    {a.url && <a href={a.url} download={a.name} className="text-xs px-2 py-1 border rounded bg-white">Download</a>}
                    <button type="button" onClick={() => removeAttachment(a.id)} className="text-xs px-2 py-1 border rounded bg-white">Remove</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Priority + tags */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <div>
            <label className="block text-sm font-medium mb-1">Priority</label>
            <select
              value={form.priority}
              onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as 'Low' | 'Medium' | 'High' }))}
              className="w-full border rounded px-3 py-2 text-sm"
            >
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
            </select>
          </div>

          <div className="col-span-2">
            <label className="block text-sm font-medium mb-1">Tags</label>
            <div className="flex gap-2 items-center">
              <input
                type="text"
                placeholder="Add tag and press Enter"
                className="flex-1 border rounded px-3 py-2 text-sm"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const v = (e.target as HTMLInputElement).value.trim();
                    if (v) {
                      addTag(v);
                      (e.target as HTMLInputElement).value = '';
                    }
                  }
                }}
              />
              <div className="flex gap-2">
                {['urgent', 'follow-up', 'meds', 'education'].map((t) => (
                  <button key={t} type="button" className="text-xs px-2 py-1 border rounded bg-white" onClick={() => addTag(t)}>{t}</button>
                ))}
              </div>
            </div>

            <div className="mt-2 flex gap-2 flex-wrap">
              {(form.tags || []).map((t) => (
                <span key={t} className="inline-flex items-center gap-2 bg-gray-100 text-xs px-2 py-1 rounded">
                  <span>{t}</span>
                  <button type="button" onClick={() => removeTag(t)} className="text-xs px-1">✕</button>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 mt-2">
          <button type="button" onClick={clearForm} className="px-3 py-1 rounded border">Cancel</button>

          <button type="button" onClick={() => handleSubmit({ newAfter: true })} disabled={saving} className="px-3 py-1 rounded border bg-white">
            {saving ? 'Saving…' : 'Save & New'}
          </button>

          <button type="button" onClick={() => handleSubmit()} disabled={saving} className="px-3 py-1 rounded bg-indigo-600 text-white">
            {saving ? 'Saving…' : 'Save Note'}
          </button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed right-4 bottom-6 z-50 rounded p-3 shadow-lg ${toast.kind === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
          <div className="text-sm">{toast.msg}</div>
        </div>
      )}
    </div>
  );
}
