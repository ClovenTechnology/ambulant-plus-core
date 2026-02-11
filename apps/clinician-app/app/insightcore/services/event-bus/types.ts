// services/event-bus/types.ts
export type EventType =
  | 'VITAL_INGESTED'
  | 'INFERENCE_READY'
  | 'ALERT_CREATED'
  | 'INSIGHT_GENERATED'
  | 'ACTION_RECOMMENDED';

export type EventPayload<T = any> = {
  id: string;
  type: EventType;
  entityId: string; // patientId, alertId, insightId, etc
  source: string;   // service name
  timestamp: string;
  data: T;
};

export type EventHandler<T = any> = (event: EventPayload<T>) => void | Promise<void>;


// services/event-bus/interface.ts
import { EventType, EventPayload, EventHandler } from './types';

export interface EventBus {
  publish<T = any>(event: EventPayload<T>): Promise<void>;
  subscribe<T = any>(type: EventType, handler: EventHandler<T>): void;
  unsubscribe<T = any>(type: EventType, handler: EventHandler<T>): void;
}


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


// services/event-bus/ws.ts
import { EventPayload } from './types';

export class WebSocketEventBus {
  private sockets: Set<any> = new Set();

  registerSocket(ws: any) {
    this.sockets.add(ws);
    ws.on('close', () => this.sockets.delete(ws));
  }

  broadcast(event: EventPayload) {
    const msg = JSON.stringify(event);
    for (const ws of this.sockets) {
      try {
        ws.send(msg);
      } catch (e) {
        console.error('[WSBus] send failed', e);
      }
    }
  }
}


// services/event-bus/bridge.ts
// Bridges internal event bus -> websocket stream
import { eventBus } from './inmemory';
import { WebSocketEventBus } from './ws';
import { EventType } from './types';

export const wsBus = new WebSocketEventBus();

const STREAMED_EVENTS: EventType[] = [
  'ALERT_CREATED',
  'INSIGHT_GENERATED',
  'ACTION_RECOMMENDED',
];

STREAMED_EVENTS.forEach((type) => {
  eventBus.subscribe(type, async (event) => {
    wsBus.broadcast(event);
  });
});


// services/event-bus/index.ts
export * from './types';
export * from './interface';
export * from './inmemory';
export * from './ws';
export * from './bridge';
