'use client';
import React, { useEffect, useMemo, useState } from 'react';

type Task = {
  id: string;
  title: string;
  due?: string; // ISO date
  done: boolean;
};

const LS_KEY = 'ambulant.tasks.v1';

function load(): Task[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) as Task[] : [];
  } catch { return []; }
}
function save(tasks: Task[]) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(tasks)); } catch {}
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState('');
  const [due, setDue] = useState<string>('');

  useEffect(() => { setTasks(load()); }, []);
  useEffect(() => { save(tasks); }, [tasks]);

  function addTask() {
    if (!title.trim()) {
      alert('Enter a task title'); return;
    }
    const t: Task = {
      id: Math.random().toString(36).slice(2),
      title: title.trim(),
      due: due ? new Date(due).toISOString() : undefined,
      done: false,
    };
    setTasks([t, ...tasks]);
    setTitle(''); setDue('');
  }

  function toggle(id: string) {
    setTasks(tasks.map(t => t.id === id ? { ...t, done: !t.done } : t));
  }

  function remove(id: string) {
    setTasks(tasks.filter(t => t.id !== id));
  }

  const grouped = useMemo(() => {
    const open = tasks.filter(t => !t.done);
    const completed = tasks.filter(t => t.done);
    return { open, completed };
  }, [tasks]);

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Tasks</h1>

      {/* Add form */}
      <section className="p-4 border rounded-lg bg-white space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
          <input
            value={title}
            onChange={(e)=>setTitle(e.target.value)}
            placeholder="Task title"
            className="sm:col-span-3 p-2 border rounded"
          />
          <input
            type="date"
            value={due}
            onChange={(e)=>setDue(e.target.value)}
            className="sm:col-span-1 p-2 border rounded"
          />
          <button onClick={addTask} className="sm:col-span-1 p-2 rounded bg-blue-600 text-white">
            Add
          </button>
        </div>
        <p className="text-xs text-gray-500">Personal checklist (local-only). Data persists in your browser.</p>
      </section>

      {/* Open tasks */}
      <section className="p-4 border rounded-lg bg-white">
        <h2 className="font-semibold mb-3">Open</h2>
        {grouped.open.length === 0 ? (
          <div className="text-sm text-gray-500">No open tasks.</div>
        ) : (
          <ul className="space-y-2">
            {grouped.open.map(t => (
              <li key={t.id} className="flex items-center justify-between gap-3 p-2 border rounded">
                <div className="flex items-center gap-3">
                  <input type="checkbox" checked={t.done} onChange={()=>toggle(t.id)} />
                  <div>
                    <div className="font-medium">{t.title}</div>
                    <div className="text-xs text-gray-500">
                      {t.due ? `Due ${new Date(t.due).toLocaleDateString()}` : 'No due date'}
                    </div>
                  </div>
                </div>
                <button onClick={()=>remove(t.id)} className="text-sm text-rose-700">Remove</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Completed tasks */}
      <section className="p-4 border rounded-lg bg-white">
        <h2 className="font-semibold mb-3">Completed</h2>
        {grouped.completed.length === 0 ? (
          <div className="text-sm text-gray-500">Nothing completed yet.</div>
        ) : (
          <ul className="space-y-2">
            {grouped.completed.map(t => (
              <li key={t.id} className="flex items-center justify-between gap-3 p-2 border rounded opacity-70">
                <div className="flex items-center gap-3">
                  <input type="checkbox" checked={t.done} onChange={()=>toggle(t.id)} />
                  <div>
                    <div className="line-through">{t.title}</div>
                    <div className="text-xs text-gray-500">
                      {t.due ? `Due ${new Date(t.due).toLocaleDateString()}` : 'No due date'}
                    </div>
                  </div>
                </div>
                <button onClick={()=>remove(t.id)} className="text-sm text-rose-700">Remove</button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
