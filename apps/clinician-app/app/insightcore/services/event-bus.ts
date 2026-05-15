// apps/clinician-app/app/insightcore/services/event-bus.ts

export type EventPayload = {
  type: string;
  data?: any;
  [key: string]: any;
};

type Handler<T = any> = (payload: T) => void;

class SimpleEventBus {
  private listeners: Record<string, Handler[]> = {};

  on<T = any>(event: string, handler: Handler<T>) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(handler as Handler);
  }

  off<T = any>(event: string, handler: Handler<T>) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(
      (h) => h !== (handler as Handler),
    );
  }

  emit<T = any>(event: string, payload: T) {
    if (!this.listeners[event]) return;
    this.listeners[event].forEach((handler) => handler(payload));
  }
}

export const eventBus = new SimpleEventBus();
export const EventBus = eventBus;