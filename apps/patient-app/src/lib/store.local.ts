type Visit = { id: string; openAt: number; closeAt: number };
type Ticket = { token: string; issuedAt: number; expiresAt: number };

const JOIN_TTL_SEC = parseInt(process.env.JOIN_TOKEN_TTL_SEC || '90', 10);

const televisits = new Map<string, Visit>();
const tickets = new Map<string, Ticket>(); // key: `${visitId}:${userId}`

// Seed a demo visit so /api/televisit/status works immediately
if (!televisits.has('demo-visit')) {
  const now = Date.now();
  televisits.set('demo-visit', {
    id: 'demo-visit',
    openAt: now - 2 * 60_000,
    closeAt: now + 15 * 60_000,
  });
}

export const store = { televisits };

export function getJoinWindow(v: Visit) {
  return { openAt: v.openAt, closeAt: v.closeAt };
}

export function getTicket(visitId: string, userId: string): Ticket {
  const k = `${visitId}:${userId}`;
  const now = Date.now();
  const existing = tickets.get(k);
  if (existing && existing.expiresAt > now) return existing;

  const issuedAt = now;
  const expiresAt = issuedAt + JOIN_TTL_SEC * 1000;
  const token = [
    'TV',
    Buffer.from(visitId).toString('base64').replace(/=+$/, ''),
    Math.random().toString(36).slice(2, 8).toUpperCase(),
  ].join('.');

  const t = { token, issuedAt, expiresAt };
  tickets.set(k, t);
  return t;
}
