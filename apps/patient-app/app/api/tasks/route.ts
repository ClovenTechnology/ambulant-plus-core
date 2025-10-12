import { NextResponse } from 'next/server';

let tasks: { id: string; text: string; due: string; done: boolean }[] = [
  { id: 't1', text: 'Follow-up labs', due: '2025-08-20', done: false },
  { id: 't2', text: 'Schedule MRI', due: '2025-08-25', done: false },
];

export async function GET() {
  return NextResponse.json(tasks);
}

export async function POST(req: Request) {
  const body = await req.json();
  const t = { id: crypto.randomUUID(), text: body.text, due: body.due, done: false };
  tasks.unshift(t);
  return NextResponse.json(t);
}

export async function PATCH(req: Request) {
  const body = await req.json();
  tasks = tasks.map((t) => (t.id === body.id ? { ...t, done: body.done } : t));
  return NextResponse.json({ ok: true });
}
