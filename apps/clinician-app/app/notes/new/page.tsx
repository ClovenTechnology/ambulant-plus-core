// apps/clinician-app/app/notes/new/page.tsx
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

type NoteForm = {
  patientName: string;
  title: string;
  content: string;
  priority: 'Low' | 'Medium' | 'High';
};

export default function NewNotePage() {
  const router = useRouter();
  const clinicianId = 'clin-demo';

  const [form, setForm] = useState<NoteForm>({ patientName: '', title: '', content: '', priority: 'Low' });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const newNote = {
        id: 'note-' + Date.now(),
        ...form,
        timestamp: new Date().toISOString(),
        clinicianId
      };

      // Simulate API save
      // await fetch('/api/notes', { method: 'POST', body: JSON.stringify(newNote) });

      alert('Note saved successfully!');
      router.push('/notes'); // redirect back to notes list
    } catch (err) {
      console.error(err);
      alert('Failed to save note.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
      <main className="p-4 max-w-3xl mx-auto">
        <h2 className="text-xl font-semibold mb-4">Create New Note</h2>
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Patient Name</label>
            <input
              type="text"
              value={form.patientName}
              onChange={e => setForm(f => ({ ...f, patientName: e.target.value }))}
              required
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Title</label>
            <input
              type="text"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              required
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Content</label>
            <textarea
              value={form.content}
              onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
              required
              rows={6}
              className="w-full border rounded px-3 py-2 text-sm resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Priority</label>
            <select
              value={form.priority}
              onChange={e => setForm(f => ({ ...f, priority: e.target.value as 'Low' | 'Medium' | 'High' }))}
              className="border rounded px-3 py-2 text-sm"
            >
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
            </select>
          </div>

          <div className="flex items-center justify-end gap-2 mt-4">
            <button
              type="button"
              onClick={() => router.push('/notes')}
              className="px-4 py-2 rounded border text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded bg-indigo-600 text-white text-sm"
            >
              {saving ? 'Saving…' : 'Save Note'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
