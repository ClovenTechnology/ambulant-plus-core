// apps/api-gateway/app/api/clinicians/available/route.ts
import { NextResponse } from 'next/server';

// however you load clinicians:
type Clin = {
  id: string;
  status: 'online_available'|'in_consult'|'wrap_up'|'on_break';
  login_at: number;
  returned_to_available_at?: number;
  sessions_assigned_today: number;
  last_assigned_at?: number;
  rank_at_login?: number;
};

function score(c: Clin, now: number) {
  const minutes_since_last = c.last_assigned_at ? (now - c.last_assigned_at)/60000 : 9999;
  const idle_minutes = c.returned_to_available_at
    ? (now - c.returned_to_available_at)/60000
    : (now - c.login_at)/60000;
  const login_bias = c.rank_at_login ?? 0;
  return 3*c.sessions_assigned_today + (-0.02*minutes_since_last) + (-0.01*idle_minutes) + 0.5*login_bias;
}

export async function GET() {
  const clinicians: Clin[] = await loadFromYourStore(); // implement
  const now = Date.now();

  const visible = clinicians
    .filter(c => c.status === 'online_available')
    .map(c => ({ ...c, score: score(c, now) }))
    .sort((a, b) => a.score - b.score);

  return NextResponse.json(visible);
}
