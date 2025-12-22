// apps/patient-app/app/api/careport/track/message/route.ts
import { NextRequest } from 'next/server';

type ReqBody = {
  riderId?: string;
  message: string;
  protected?: boolean;
  meta?: any;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ReqBody;
    const text = String(body?.message || '').slice(0, 2000);

    // Simple server-side safety: if protected flag is true, we won't "log" or store
    const isProtected = !!body?.protected;

    // Simulated minimal processing delay (we don't actually sleep on the server; just return)
    // Create a simulated rider reply (demo)
    const reply = (() => {
      const lower = text.toLowerCase();
      if (/(where|arrival|eta|how long)/.test(lower)) return "I'm ~5 min away — see you soon.";
      if (/(thanks|thank)/.test(lower)) return "You're welcome — see you shortly.";
      if (/(wait|delay)/.test(lower)) return "There might be a short delay, I'll update you.";
      return "Got your message — on my way!";
    })();

    // Simulate server response shape
    const resp = {
      ok: true,
      received: {
        riderId: body.riderId ?? null,
        protected: isProtected,
        ts: Date.now(),
        message: text,
      },
      reply: {
        from: 'rider',
        text: reply,
        ts: Date.now() + 600, // slight offset so client can append it after send
      },
    };

    // Note: in a real system we might persist non-protected messages and relay to rider.
    // For demo, we just return the simulated reply.
    return new Response(JSON.stringify(resp), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
