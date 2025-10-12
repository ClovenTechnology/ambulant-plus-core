import { EventEmitter } from 'events';
const g = globalThis as any;
export const bus: EventEmitter = g.__IOMT_BUS__ || (g.__IOMT_BUS__ = new EventEmitter());
