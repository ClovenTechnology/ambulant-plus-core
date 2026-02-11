// apps/clinician-app/app/insightcore/hooks/useEventStream.ts
"use client"
import { useEffect, useState } from 'react';
import { EventBus, EventPayload } from '../services/event-bus';

export function useEventStream<T = any>(
  eventType: string
): T[] {
  const [events, setEvents] = useState<T[]>([]);

  useEffect(() => {
    const handler = (payload: EventPayload) => {
      if (payload.type === eventType) {
        setEvents((prev) => [payload.data as T, ...prev]);
      }
    };
    EventBus.on(eventType, handler);

    return () => {
      EventBus.off(eventType, handler);
    };
  }, [eventType]);

  return events;
}
