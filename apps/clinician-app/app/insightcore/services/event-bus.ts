// apps/clinician-app/app/insightcore/services/event-bus.ts

type Handler = (payload: any) => void;

class SimpleEventBus {
  private listeners: Record<string, Handler[]> = {};

  on(event: string, handler: Handler) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(handler);
  }

  off(event: string, handler: Handler) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(h => h !== handler);
  }

  emit(event: string, payload: any) {
    if (!this.listeners[event]) return;
    this.listeners[event].forEach(handler => handler(payload));
  }
}

export const EventBus = new SimpleEventBus();
