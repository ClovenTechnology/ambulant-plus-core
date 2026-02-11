//apps/clinician-app/services/iomt-stream.ts

'use client';

type IoMTEvent = {
  patientId: string;
  type: 'hr' | 'spo2' | 'bp' | 'stress' | 'ecg';
  value: number;
  ts: number;
};

type Listener = (e: IoMTEvent) => void;

class IoMTStream {
  private listeners = new Set<Listener>();
  private timer: any;

  connect() {
    // 🔁 mock stream (replace with WebSocket later)
    this.timer = setInterval(() => {
      const evt: IoMTEvent = {
        patientId: Math.random() > 0.5 ? 'Jane Doe' : 'John Smith',
        type: 'hr',
        value: Math.floor(60 + Math.random() * 60),
        ts: Date.now(),
      };

      this.listeners.forEach(l => l(evt));
    }, 1200);
  }

  on(cb: Listener) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  disconnect() {
    clearInterval(this.timer);
  }
}

export const iomtStream = new IoMTStream();
