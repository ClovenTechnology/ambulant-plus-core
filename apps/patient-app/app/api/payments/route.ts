import { NextResponse } from 'next/server';

const PAY_KEY = Symbol.for('__demo_payments__');
const g = globalThis as any;
g[PAY_KEY] ||= new Map<string, any>();
const store: Map<string, any> = g[PAY_KEY];

export async function POST(req: Request) {
  const { appointmentId, amountZAR } = await req.json();
  if (!appointmentId || typeof amountZAR !== 'number') {
    return NextResponse.json({ error: 'appointmentId and amountZAR required' }, { status: 400 });
  }
  const id = `pay_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const payment = { id, appointmentId, amountZAR, status: 'authorized', createdAt: new Date().toISOString() };
  store.set(id, payment);
  return NextResponse.json(payment, { status: 201 });
}
