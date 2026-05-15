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