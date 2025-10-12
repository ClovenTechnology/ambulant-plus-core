// apps/patient-app/src/devices/audioCtx.ts
let _ctx: AudioContext | null = null;

export function getAudioContext(): AudioContext {
  if (_ctx && _ctx.state === 'closed') _ctx = null;
  if (!_ctx) {
    _ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return _ctx!;
}

// optional helper to close when all sessions finished
export function closeAudioContext() {
  if (_ctx) {
    try { _ctx.close(); } catch {}
    _ctx = null;
  }
}
