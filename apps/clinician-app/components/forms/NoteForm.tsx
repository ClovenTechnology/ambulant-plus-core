// apps/clinician-app/components/forms/NoteForm.tsx
'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import dynamic from 'next/dynamic';

type RichEditorProps = {
  value: string;
  onChange: (v: string) => void;
};

/**
 * Dynamic TipTap editor loader.
 *
 * Important:
 * - ssr: false keeps TipTap out of the server render path.
 * - immediatelyRender: false prevents hydration mismatch in Next.js.
 * - EditorContent is rendered via React.createElement to avoid React 18/19
 *   JSX component type incompatibility during production type-check.
 */
const RichEditor = dynamic<RichEditorProps>(
  async () => {
    try {
      const [{ EditorContent, useEditor }, StarterKitModule] =
        await Promise.all([
          import('@tiptap/react'),
          import('@tiptap/starter-kit'),
        ]);

      const StarterKit =
        (StarterKitModule && (StarterKitModule as any).default) ||
        StarterKitModule;

      const EditorContentComponent = EditorContent as unknown as React.ComponentType<{
        editor: any;
      }>;

      function TipTapEditor({ value, onChange }: RichEditorProps) {
        const editor = useEditor({
          extensions: [StarterKit],
          content: value || '',
          onUpdate({ editor: ed }: { editor: any }) {
            onChange(ed.getHTML());
          },
          editorProps: {
            attributes: {
              'aria-label': 'Note editor',
              class:
                'min-h-[140px] rounded bg-white px-2 py-2 text-sm outline-none',
            },
          },
          immediatelyRender: false,
        } as any);

        useEffect(() => {
          if (!editor) return;

          const current = editor.getHTML();

          if ((value || '') !== current) {
            editor.commands.setContent(value || '', { emitUpdate: false });
          }
        }, [value, editor]);

        return (
          <div>
            <div className="overflow-hidden rounded border">
              <div className="flex gap-2 border-b bg-gray-50 px-2 py-1">
                <button
                  type="button"
                  onClick={() => editor?.chain().focus().toggleBold().run()}
                  className="rounded border px-2 py-1 text-xs"
                  aria-label="Bold"
                  disabled={!editor}
                >
                  B
                </button>

                <button
                  type="button"
                  onClick={() => editor?.chain().focus().toggleItalic().run()}
                  className="rounded border px-2 py-1 text-xs"
                  aria-label="Italic"
                  disabled={!editor}
                >
                  i
                </button>

                <button
                  type="button"
                  onClick={() =>
                    editor?.chain().focus().toggleBulletList().run()
                  }
                  className="rounded border px-2 py-1 text-xs"
                  aria-label="Bullets"
                  disabled={!editor}
                >
                  •
                </button>

                <button
                  type="button"
                  onClick={() =>
                    editor?.chain().focus().toggleOrderedList().run()
                  }
                  className="rounded border px-2 py-1 text-xs"
                  aria-label="Numbered"
                  disabled={!editor}
                >
                  1.
                </button>
              </div>

              <div className="p-2">
                {React.createElement(EditorContentComponent, { editor })}
              </div>
            </div>
          </div>
        );
      }

      return TipTapEditor;
    } catch {
      function FallbackEditor({ value, onChange }: RichEditorProps) {
        return (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="min-h-[160px] w-full resize-y rounded border px-3 py-2 text-sm"
            aria-label="Plain note editor"
          />
        );
      }

      return FallbackEditor;
    }
  },
  { ssr: false }
);

/* ----------------- Note form implementation ----------------- */

type NoteAttachment = {
  id: string;
  name: string;
  type: string;
  size: number;
  url?: string;
};

type NoteFormType = {
  patientName: string;
  patientId?: string | null;
  title: string;
  content: string;
  priority: 'Low' | 'Medium' | 'High';
  tags?: string[];
  encounterId?: string | null;
  attachments?: NoteAttachment[];
};

export default function NoteForm({
  clinicianId,
  onSaved = () => {},
}: {
  clinicianId: string;
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
  const [toast, setToast] = useState<{
    msg: string;
    kind?: 'success' | 'error';
  } | null>(null);
  const [preview, setPreview] = useState(false);

  const [patientQ, setPatientQ] = useState('');
  const [patients, setPatients] = useState<{ id: string; name: string }[]>([]);
  const [patLoading, setPatLoading] = useState(false);
  const [showPatientList, setShowPatientList] = useState(false);
  const patFetchRef = useRef<number | null>(null);

  const [encounters, setEncounters] = useState<
    { id: string; when?: string; reason?: string }[]
  >([]);
  const [encLoading, setEncLoading] = useState(false);

  const TEMPLATES = useMemo(
    () => [
      {
        id: 't1',
        title: 'General consult',
        text: 'Patient presents with acute symptoms. Exam normal. Plan: conservative management and safety-netting.',
      },
      {
        id: 't2',
        title: 'Follow up',
        text: 'Follow-up visit to review response to therapy. Continue current meds. Return in 2 weeks.',
      },
      {
        id: 't3',
        title: 'Prescription note',
        text: 'Prescribed medication as discussed. Counseled patient on adherence and side effects.',
      },
    ],
    []
  );

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);

      if (!raw) return;

      const parsed = JSON.parse(raw) as Partial<NoteFormType>;

      setForm((f) => ({ ...f, ...parsed }));

      if (parsed?.patientName) {
        setPatientQ(parsed.patientName);
      }
    } catch {
      // Ignore corrupted local draft.
    }
  }, [storageKey]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        localStorage.setItem(
          storageKey,
          JSON.stringify({
            patientName: form.patientName,
            patientId: form.patientId,
            title: form.title,
            content: form.content,
            priority: form.priority,
            tags: form.tags || [],
            encounterId: form.encounterId || null,
            attachments: form.attachments || [],
          })
        );
      } catch {
        // Ignore storage errors.
      }
    }, 400);

    return () => window.clearTimeout(t);
  }, [form, storageKey]);

  useEffect(() => {
    if (patFetchRef.current) {
      window.clearTimeout(patFetchRef.current);
    }

    if (!patientQ || patientQ.trim().length < 1) {
      setPatients([]);
      return;
    }

    setPatLoading(true);

    patFetchRef.current = window.setTimeout(async () => {
      try {
        const q = encodeURIComponent(patientQ.trim());
        const res = await fetch(`/api/patients?q=${q}`, {
          cache: 'no-store',
        });

        if (!res.ok) {
          throw new Error('Patient search failed');
        }

        const json = await res.json();
        const list = Array.isArray(json)
          ? json
          : Array.isArray(json?.items)
            ? json.items
            : [];

        setPatients(
          list.slice(0, 50).map((p: any) => ({
            id: String(p.id || p.patientId || p._id || p.identifier),
            name: String(
              p.name ||
                p.fullName ||
                p.displayName ||
                p.patientName ||
                'Unknown'
            ),
          }))
        );
      } catch (err) {
        console.error(err);
        setPatients([]);
      } finally {
        setPatLoading(false);
        setShowPatientList(true);
      }
    }, 300);

    return () => {
      if (patFetchRef.current) {
        window.clearTimeout(patFetchRef.current);
      }
    };
  }, [patientQ]);

  useEffect(() => {
    const pid = form.patientId;

    if (!pid) {
      setEncounters([]);
      return;
    }

    let alive = true;

    async function loadEncounters() {
      setEncLoading(true);

      try {
        const res = await fetch(
          `/api/appointments?patientId=${encodeURIComponent(
            String(pid)
          )}&clinicianId=${encodeURIComponent(clinicianId)}`,
          { cache: 'no-store' }
        );

        if (!res.ok) {
          throw new Error('Unable to load encounters');
        }

        const js = await res.json();
        const arr = Array.isArray(js?.items)
          ? js.items
          : Array.isArray(js)
            ? js
            : [];

        if (!alive) return;

        setEncounters(
          arr.slice(0, 50).map((a: any) => ({
            id: String(
              a.id ||
                a._id ||
                a.appointmentId ||
                `${Date.now()}-${Math.random().toString(36).slice(2)}`
            ),
            when: String(a.startsAt || a.when || a.whenISO || ''),
            reason: String(a.reason || a.caseName || a.title || ''),
          }))
        );
      } catch {
        if (alive) {
          setEncounters([]);
        }
      } finally {
        if (alive) {
          setEncLoading(false);
        }
      }
    }

    loadEncounters();

    return () => {
      alive = false;
    };
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

    try {
      localStorage.removeItem(storageKey);
    } catch {
      // Ignore storage errors.
    }
  }, [storageKey]);

  const addTag = (t: string) => {
    const val = t.trim();

    if (!val) return;

    setForm((f) => ({
      ...f,
      tags: Array.from(new Set([...(f.tags || []), val])),
    }));
  };

  const removeTag = (t: string) => {
    setForm((f) => ({
      ...f,
      tags: (f.tags || []).filter((x) => x !== t),
    }));
  };

  function makeId(prefix = 'a') {
    return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
  }

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const arr = Array.from(files).map((file) => {
      const id = makeId();
      const url = URL.createObjectURL(file);

      return {
        id,
        name: file.name,
        type: file.type,
        size: file.size,
        url,
      };
    });

    setForm((f) => ({
      ...f,
      attachments: [...(f.attachments || []), ...arr],
    }));
  };

  const removeAttachment = (id: string) => {
    setForm((f) => {
      const found = (f.attachments || []).find((a) => a.id === id);

      if (found?.url) {
        try {
          URL.revokeObjectURL(found.url);
        } catch {
          // Ignore revoke errors.
        }
      }

      return {
        ...f,
        attachments: (f.attachments || []).filter((a) => a.id !== id),
      };
    });
  };

  const createEncounter = useCallback(
    async (opts?: { whenISO?: string; reason?: string }) => {
      const start = opts?.whenISO ?? new Date().toISOString();
      const parsedStart = Date.parse(start);
      const end = new Date(parsedStart + 20 * 60_000).toISOString();

      const body = {
        clinicianId,
        patientId: form.patientId,
        patientName: form.patientName,
        startsAt: start,
        endsAt: end,
        reason: opts?.reason ?? (form.title || 'Ad-hoc from note'),
        status: 'booked',
      };

      try {
        const r = await fetch('/api/appointments', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!r.ok) {
          const err = await r.json().catch(() => null);
          throw new Error(
            err?.error || err?.message || 'Failed to create encounter'
          );
        }

        const j = await r.json();
        const created = {
          ...(j || {}),
          id: j?.id || j?._id || j?.appointmentId,
        };

        if (!created.id) {
          throw new Error('Created encounter response did not include an id');
        }

        setForm((f) => ({ ...f, encounterId: created.id }));
        onSaved(created);
        setToast({ msg: 'Encounter created & attached', kind: 'success' });

        return created;
      } catch (err) {
        console.error(err);
        setToast({
          msg: 'Failed to create encounter. Please try again.',
          kind: 'error',
        });
        throw err;
      }
    },
    [
      clinicianId,
      form.patientId,
      form.patientName,
      form.title,
      onSaved,
    ]
  );

  const handleSubmit = useCallback(
    async (opts?: { newAfter?: boolean }) => {
      setSaving(true);

      try {
        const note = {
          id: `note-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 6)}`,
          patientName: form.patientName,
          patientId: form.patientId,
          title: form.title,
          content: form.content,
          priority: form.priority,
          tags: form.tags || [],
          encounterId: form.encounterId || null,
          timestamp: new Date().toISOString(),
          clinicianId,
          attachments: (form.attachments || []).map((a) => ({
            id: a.id,
            name: a.name,
            type: a.type,
            size: a.size,
          })),
        };

        const r = await fetch('/api/notes', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(note),
        });

        if (!r.ok) {
          const err = await r.json().catch(() => null);
          throw new Error(err?.error || err?.message || 'Failed to save note');
        }

        const saved = await r.json();

        try {
          localStorage.removeItem(storageKey);
        } catch {
          // Ignore storage errors.
        }

        setToast({ msg: 'Note saved', kind: 'success' });
        onSaved(saved);

        if (opts?.newAfter) {
          clearForm();
        }
      } catch (err) {
        console.error(err);
        setToast({ msg: 'Failed to save note', kind: 'error' });
      } finally {
        setSaving(false);
      }
    },
    [form, clinicianId, onSaved, clearForm, storageKey]
  );

  const selectPatient = (p: { id: string; name: string } | null) => {
    if (!p) {
      setForm((f) => ({
        ...f,
        patientName: '',
        patientId: null,
        encounterId: null,
      }));
      setPatientQ('');
      setPatients([]);
      return;
    }

    setForm((f) => ({
      ...f,
      patientName: p.name,
      patientId: p.id,
      encounterId: null,
    }));

    setPatientQ(p.name);
    setShowPatientList(false);
  };

  function escapeHtml(s: string) {
    return s.replace(/[&<>"']/g, (m) => {
      const map: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      };

      return map[m] || m;
    });
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

    const t = window.setTimeout(() => setToast(null), 3200);

    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    return () => {
      for (const attachment of form.attachments || []) {
        if (attachment.url?.startsWith('blob:')) {
          try {
            URL.revokeObjectURL(attachment.url);
          } catch {
            // Ignore cleanup errors.
          }
        }
      }
    };
  }, [form.attachments]);

  return (
    <div className="rounded bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold">Create New Note</h3>

      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium">Patient</label>

          <div className="relative">
            <input
              className="w-full rounded border px-3 py-2 text-sm"
              placeholder="Search patients by name or ID..."
              value={patientQ}
              onChange={(e) => {
                setPatientQ(e.target.value);
                setShowPatientList(true);
              }}
              onFocus={() => setShowPatientList(true)}
              aria-autocomplete="list"
            />

            {showPatientList &&
              (patLoading ? (
                <div className="absolute left-0 right-0 z-40 mt-1 rounded border bg-white p-2 text-sm text-gray-500">
                  Searching…
                </div>
              ) : patients.length ? (
                <ul className="absolute left-0 right-0 z-40 mt-1 max-h-48 overflow-auto rounded border bg-white shadow-sm">
                  {patients.map((p) => (
                    <li
                      key={p.id}
                      className="flex cursor-pointer items-center justify-between px-3 py-2 hover:bg-gray-100"
                      onClick={() => selectPatient(p)}
                    >
                      <div>
                        <div className="text-sm font-medium">{p.name}</div>
                        <div className="text-xs text-gray-500">{p.id}</div>
                      </div>
                      <div className="text-xs text-gray-400">Select</div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="absolute left-0 right-0 z-40 mt-1 rounded border bg-white p-2 text-sm text-gray-500">
                  No patients
                </div>
              ))}
          </div>
        </div>

        {form.patientId ? (
          <div className="rounded border bg-gray-50 p-2 text-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{form.patientName}</div>
                <div className="text-xs text-gray-500">{form.patientId}</div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="rounded border bg-white px-2 py-1 text-xs"
                  onClick={() => selectPatient(null)}
                >
                  Clear
                </button>

                <button
                  type="button"
                  className="rounded border bg-white px-2 py-1 text-xs"
                  onClick={() =>
                    createEncounter({
                      whenISO: new Date().toISOString(),
                      reason: `Ad-hoc created from note by ${clinicianId}`,
                    })
                  }
                >
                  + Create & attach encounter
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <div>
          <label className="mb-1 block text-sm font-medium">
            Attach to encounter / case (optional)
          </label>

          <div className="flex gap-2">
            <select
              className="flex-1 rounded border px-2 py-1 text-sm"
              value={form.encounterId || ''}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  encounterId: e.target.value || null,
                }))
              }
              disabled={!form.patientId || encLoading}
            >
              <option value="">
                {form.patientId
                  ? encounters.length
                    ? 'Select encounter...'
                    : 'No encounters found'
                  : 'Select patient first'}
              </option>

              {encounters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.when ? new Date(c.when).toLocaleString() : c.id} —{' '}
                  {c.reason || 'Consult'}
                </option>
              ))}
            </select>

            <button
              type="button"
              className="rounded border px-3 py-1 text-sm"
              onClick={() =>
                createEncounter({
                  whenISO: new Date().toISOString(),
                  reason: 'Ad-hoc (created from note)',
                })
              }
              title="Create ad-hoc encounter and attach"
            >
              + New
            </button>
          </div>

          <div className="mt-1 text-xs text-gray-500">
            Click +New to create an ad-hoc encounter through the backend and
            attach it to this note.
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Title</label>

          <input
            type="text"
            value={form.title}
            onChange={(e) =>
              setForm((f) => ({ ...f, title: e.target.value }))
            }
            placeholder="Short title"
            className="w-full rounded border px-3 py-2 text-sm"
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Content</label>

          <RichEditor
            value={form.content}
            onChange={(v) => setForm((f) => ({ ...f, content: v }))}
          />

          <div className="mt-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const t = TEMPLATES[0].text;
                  setForm((f) => ({
                    ...f,
                    content: f.content ? `${f.content}\n\n${t}` : t,
                  }));
                }}
                className="rounded border bg-white px-2 py-1 text-xs"
              >
                Insert template
              </button>

              <select
                onChange={(e) => {
                  const id = e.target.value;

                  if (!id) return;

                  const t = TEMPLATES.find((x) => x.id === id);

                  if (t) {
                    setForm((f) => ({
                      ...f,
                      content: f.content
                        ? `${f.content}\n\n${t.text}`
                        : t.text,
                    }));
                  }

                  e.currentTarget.value = '';
                }}
                className="rounded border px-2 py-1 text-xs"
                defaultValue=""
              >
                <option value="">Templates…</option>

                {TEMPLATES.map((tp) => (
                  <option key={tp.id} value={tp.id}>
                    {tp.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">Preview</label>
              <input
                type="checkbox"
                checked={preview}
                onChange={(e) => setPreview(e.target.checked)}
              />
            </div>
          </div>
        </div>

        {preview ? (
          <div className="rounded border bg-gray-50 p-3">
            <div className="mb-2 text-xs text-gray-500">Preview</div>
            <div
              className="prose max-w-none text-sm"
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{ __html: renderPreview(form.content) }}
            />
          </div>
        ) : null}

        <div>
          <label className="mb-1 block text-sm font-medium">Attachments</label>

          <div className="flex items-center gap-2">
            <input
              type="file"
              multiple
              onChange={(e) => handleFiles(e.target.files)}
              className="text-sm"
            />

            <div className="text-xs text-gray-500">
              Images and documents supported. Previews available for images.
            </div>
          </div>

          {form.attachments && form.attachments.length > 0 ? (
            <div className="mt-2 grid max-h-56 grid-cols-1 gap-2 overflow-auto pr-2 sm:grid-cols-2">
              {form.attachments.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center gap-2 rounded border bg-white p-2"
                >
                  {a.type?.startsWith('image/') && a.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={a.url}
                      alt={a.name}
                      className="h-12 w-12 rounded object-cover"
                    />
                  ) : (
                    <div className="grid h-12 w-12 place-items-center rounded bg-gray-50 text-xs">
                      {(a.name || '').split('.').pop()?.toUpperCase() ||
                        'FILE'}
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">
                      {a.name}
                    </div>
                    <div className="text-xs text-gray-500">
                      {Math.round((a.size || 0) / 1024)} KB
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    {a.url ? (
                      <a
                        href={a.url}
                        download={a.name}
                        className="rounded border bg-white px-2 py-1 text-xs"
                      >
                        Download
                      </a>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => removeAttachment(a.id)}
                      className="rounded border bg-white px-2 py-1 text-xs"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium">Priority</label>

            <select
              value={form.priority}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  priority: e.target.value as 'Low' | 'Medium' | 'High',
                }))
              }
              className="w-full rounded border px-3 py-2 text-sm"
            >
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
            </select>
          </div>

          <div className="col-span-2">
            <label className="mb-1 block text-sm font-medium">Tags</label>

            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Add tag and press Enter"
                className="flex-1 rounded border px-3 py-2 text-sm"
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return;

                  e.preventDefault();

                  const input = e.currentTarget;
                  const v = input.value.trim();

                  if (v) {
                    addTag(v);
                    input.value = '';
                  }
                }}
              />

              <div className="flex gap-2">
                {['urgent', 'follow-up', 'meds', 'education'].map((t) => (
                  <button
                    key={t}
                    type="button"
                    className="rounded border bg-white px-2 py-1 text-xs"
                    onClick={() => addTag(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-2 flex flex-wrap gap-2">
              {(form.tags || []).map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-2 rounded bg-gray-100 px-2 py-1 text-xs"
                >
                  <span>{t}</span>
                  <button
                    type="button"
                    onClick={() => removeTag(t)}
                    className="px-1 text-xs"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-2 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={clearForm}
            className="rounded border px-3 py-1"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={() => handleSubmit({ newAfter: true })}
            disabled={saving}
            className="rounded border bg-white px-3 py-1"
          >
            {saving ? 'Saving…' : 'Save & New'}
          </button>

          <button
            type="button"
            onClick={() => handleSubmit()}
            disabled={saving}
            className="rounded bg-indigo-600 px-3 py-1 text-white"
          >
            {saving ? 'Saving…' : 'Save Note'}
          </button>
        </div>
      </div>

      {toast ? (
        <div
          className={`fixed bottom-6 right-4 z-50 rounded p-3 shadow-lg ${
            toast.kind === 'success'
              ? 'bg-emerald-600 text-white'
              : 'bg-rose-600 text-white'
          }`}
        >
          <div className="text-sm">{toast.msg}</div>
        </div>
      ) : null}
    </div>
  );
}