// services/event-bus/interface.ts
import { EventType, EventPayload, EventHandler } from './types';

export interface EventBus {
  publish<T = any>(event: EventPayload<T>): Promise<void>;
  subscribe<T = any>(type: EventType, handler: EventHandler<T>): void;
  unsubscribe<T = any>(type: EventType, handler: EventHandler<T>): void;
}