import { AsyncLocalStorage } from 'node:async_hooks';
import type { Who } from '../identity';
// Server-only request scope. Never populated from unsigned request headers.
export const partnerIdentity = new AsyncLocalStorage<Who>();
