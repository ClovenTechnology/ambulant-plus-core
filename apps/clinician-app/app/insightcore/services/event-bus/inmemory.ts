// services/event-bus/inmemory.ts
import { EventBus } from './interface';
import { EventType, EventPayload, EventHandler } from './types';

class InMemoryEventBus implements EventBus {
  private handlers: Map<EventType, Set<EventHandler>> = new Map();

  subscribe(type: EventType, handler: EventHandler) {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);
  }

  unsubscribe(type: EventType, handler: EventHandler) {
    this.handlers.get(type)?.delete(handler);
  }

  async publish(event: EventPayload) {
    const subs = this.handlers.get(event.type);
    if (!subs) return;

    for (const handler of subs) {
      try {
        await handler(event);
      } catch (err) {
        console.error('[EventBus] handler error:', err, event);
      }
    }
  }
}

export const eventBus = new InMemoryEventBus();