// apps/clinician-app/app/notes/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CollapseBtn } from '@/components/ui/CollapseBtn';
import { Collapse } from '@/components/ui/Collapse';

type Note = {
  id: string;
  patientName: string;
  title: string;
  content: string;
  timestamp: string;
  priority?: 'Low' | 'Medium' | 'High';
};

export default function NotesPage() {
  const router = useRouter();
  const clinicianId = 'clin-demo';

  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [newNoteOpen, setNewNoteOpen] = useState(true);

  const [form, setForm] = useState({ patientName: '', title: '', content: '', priority: 'Low' });

  /* ---------- Load notes ---------- */
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const r = await fetch('/api/notes?clinicianId=' + clinicianId, { cache: 'no-store' });
        const j = await r.json();
        setNotes(Array.isArray(j) ? j : []);
      } catch {
        setNotes([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const note: Note = { 
      id: 'note-' + Date.now(),
      ...form,
      timestamp: new Date().toISOString()
    };
    // Simulate API save
    setNotes(prev => [note, ...prev]);
    setForm({ patientName: '', title: '', content: '', priority: 'Low' });
    alert('Note saved!');
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
      <main className="p-4 max-w-5xl mx-auto space-y-4">

        {/* New Note Panel */}
        <section className="bg-white rounded-2xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold">Create New Note</h3>
            <CollapseBtn open={newNoteOpen} onClick={() => setNewNoteOpen(v => !v)} />
          </div>
          <Collapse open={newNoteOpen}>
            <form onSubmit={handleSubmit} className="space-y-3 mt-2">
              <input
                type="text"
                placeholder="Patient Name"
                value={form.patientName}
                onChange={e => setForm(f => ({ ...f, patientName: e.target.value }))}
                className="w-full border rounded px-3 py-2 text-sm"
                required
              />
              <input
                type="text"
                placeholder="Title"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="w-full border rounded px-3 py-2 text-sm"
                required
              />
              <textarea
                placeholder="Content"
                value={form.content}
                onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                className="w-full border rounded px-3 py-2 text-sm resize-none h-24"
                required
              />
              <select
                value={form.priority}
                onChange={e => setForm(f => ({ ...f, priority: e.target.value as 'Low'|'Medium'|'High' }))}
                className="border rounded px-2 py-1 text-sm"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
              <button type="submit" className="bg-indigo-600 text-white px-3 py-2 rounded-lg text-sm">Save Note</button>
            </form>
          </Collapse>
        </section>

        {/* Notes List */}
        <section className="bg-white rounded-2xl shadow-sm p-4">
          <h3 className="text-lg font-semibold mb-2">My Notes</h3>
          {loading ? (
            <div className="text-sm text-gray-500">Loading…</div>
          ) : notes.length === 0 ? (
            <div className="text-sm text-gray-500">No notes yet.</div>
          ) : (
            <ul className="divide-y">
              {notes.map(n => (
                <li key={n.id} className="p-3 hover:bg-gray-50 transition-colors duration-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{n.title}</div>
                      <div className="text-xs text-gray-500">{n.patientName}</div>
                    </div>
                    <div className={`text-xs px-2 py-1 border rounded font-semibold ${n.priority === 'High' ? 'bg-red-100 text-red-700 border-red-200' : 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                      {n.priority}
                    </div>
                  </div>
                  <div className="mt-1 text-sm text-gray-700">{n.content}</div>
                  <div className="text-xs text-gray-400 mt-1">{new Date(n.timestamp).toLocaleString()}</div>
                </li>
              ))}
            </ul>
          )}
        </section>

      </main>
    </div>
  );
}
