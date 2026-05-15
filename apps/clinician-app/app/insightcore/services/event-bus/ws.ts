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