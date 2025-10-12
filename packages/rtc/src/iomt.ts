// packages/rtc/src/iomt.ts
import type { Room } from "livekit-client";

/**
 * Publishes demo vitals over the room data channel every `periodMs`.
 * Returns a stop() function.
 */
export function startWearableDemo(room: Room, periodMs = 3000) {
  let dead = false;

  const push = () => {
    if (dead) return;
    try {
      const msg = {
        type: "vitals",
        hr: clamp(randN(78, 8), 52, 120),
        spo2: clamp(randN(97, 1.2), 92, 100),
        sys: Math.round(clamp(randN(122, 8), 95, 160)),
        dia: Math.round(clamp(randN(78, 6), 55, 100)),
        temp: round1(clamp(randN(36.8, 0.3), 35.5, 39.0)),
        rr: Math.round(clamp(randN(16, 3), 8, 30)),
      };
      const payload = new TextEncoder().encode(JSON.stringify(msg));
      room?.localParticipant?.publishData?.(payload, { reliable: false });
    } catch {
      // ignore
    }
  };

  const id = setInterval(push, Math.max(800, periodMs));
  // kick one immediately so UI shows something
  push();

  return () => {
    dead = true;
    clearInterval(id);
  };
}

function randN(mean: number, sigma: number) {
  // Box–Muller
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return mean + z * sigma;
}
function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}
function round1(n: number) {
  return Math.round(n * 10) / 10;
}
