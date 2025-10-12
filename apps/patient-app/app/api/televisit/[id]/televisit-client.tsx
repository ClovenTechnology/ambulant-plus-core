"use client";
import React, { useEffect, useState } from "react";

type Note = { id: string; ts: string; text: string };

export default function TelevisitClient({ visitId }: { visitId: string }) {
  const [connected, setConnected] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [text, setText] = useState("");

  async function loadNotes() {
    const res = await fetch(`/api/televisit/${visitId}/notes`, { cache: "no-store" });
    if (res.ok) setNotes(await res.json());
  }
  useEffect(() => { loadNotes(); }, [visitId]);

  async function addNote() {
    if (!text.trim()) return;
    const optimistic: Note = { id: `tmp-${Date.now()}`, ts: new Date().toISOString(), text };
    setNotes(n => [optimistic, ...n]);
    setText("");
    const res = await fetch(`/api/televisit/${visitId}/notes`, {
      method: "POST",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify({ text: optimistic.text })
    });
    if (res.ok) {
      const saved = await res.json();
      setNotes(n => [saved, ...n.filter(x=>x.id !== optimistic.id)]);
    }
  }

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Televisit #{visitId}</h1>
        <div className="flex gap-2">
          {!connected ? (
            <button onClick={()=>setConnected(true)} className="px-3 py-1 rounded-md bg-black text-white text-sm">Start</button>
          ) : (
            <button onClick={()=>setConnected(false)} className="px-3 py-1 rounded-md border text-sm bg-white">Stop</button>
          )}
        </div>
      </header>

      {/* RTC Placeholder */}
      <section className="p-4 border rounded-lg bg-white">
        <div className="h-48 flex items-center justify-center text-gray-600">
          {connected ? "🔴 Connected (stub RTC UI)" : "RTC not connected"}
        </div>
      </section>

      {/* Notes */}
      <section className="p-4 border rounded-lg bg-white space-y-3">
        <div className="flex gap-2">
          <input
            value={text}
            onChange={e=>setText(e.target.value)}
            placeholder="Type note…"
            className="flex-1 border rounded-md px-3 py-2 text-sm"
          />
          <button onClick={addNote} className="px-3 py-2 rounded-md bg-black text-white text-sm">Add to Encounter</button>
        </div>
        <div className="space-y-2">
          {notes.length === 0 ? (
            <div className="text-gray-600 text-sm">No notes yet.</div>
          ) : notes.map(n => (
            <div key={n.id} className="border rounded-md p-2">
              <div className="text-[11px] text-gray-500">{new Date(n.ts).toLocaleString()}</div>
              <div className="text-sm">{n.text}</div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
