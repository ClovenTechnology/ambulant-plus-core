// useLiveAppointments.ts
import { useEffect } from 'react';

/**
 * Stub hook for SSE / WebSocket live updates.
 * In production, connect to /api/events/appointments/stream?clinicianId=...
 */
export function useLiveAppointments(clinicianId: string) {
  useEffect(() => {
    console.log('Connecting live appointments for', clinicianId);
    return () => console.log('Disconnected live appointments');
  }, [clinicianId]);

  // Returns a subscription function
  return (callback: (update: any) => void) => {
    // Stub: nothing happens for now
    const interval = setInterval(() => {
      // Example: emit random update every 30s
      // callback({ id: 'stub-'+Date.now(), title: 'Live Appt', start: new Date(), end: new Date(), status: 'booked' });
    }, 30000);

    // unsubscribe
    return () => clearInterval(interval);
  };
}
