'use client';

import { useCallback } from 'react';
import { toast as push } from './toast';

export type ToastKind = 'info' | 'success' | 'error';

export function useToast() {
  const toast   = useCallback((msg: string, type: ToastKind = 'info') => push(msg, { type }), []);
  const info    = useCallback((msg: string) => push(msg, { type: 'info' }), []);
  const success = useCallback((msg: string) => push(msg, { type: 'success' }), []);
  const error   = useCallback((msg: string) => push(msg, { type: 'error' }), []);
  return { toast, info, success, error };
}

// Optional: centralize common messages
export const ToastMsg = {
  genericFail: 'Something went wrong. Please try again.',
};
