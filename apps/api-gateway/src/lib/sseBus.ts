// simple in-memory SSE room hub
import { EventEmitter } from 'node:events';

type Vital = { t: string; type: string; value: number; unit?: string; roomId: string };

const bus = new EventEmitter();
const history = new Map<string, Vital[]>(); // last ~50 per room

export function pushVital(v: Vital) {
  const arr = history.get(v.roomId) || [];
  arr.push(v);
  while (arr.length > 50) arr.shift();
  history.set(v.roomId, arr);
  bus.emit(`vital:${v.roomId}`, v);
}

export function getHistory(roomId: string) {
  return history.get(roomId) || [];
}

export function subscribe(roomId: string, onData: (v: Vital) => void) {
  const ch = `vital:${roomId}`;
  bus.on(ch, onData);
  return () => bus.off(ch, onData);
}
