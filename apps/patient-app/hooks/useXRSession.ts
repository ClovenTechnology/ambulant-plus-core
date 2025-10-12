// apps/patient-app/hooks/useXRSession.ts
import { useEffect } from 'react';

export default function useXRSession({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled) return;
    const start = async () => {
      const session = await navigator.xr?.requestSession('immersive-vr', { optionalFeatures: ['local-floor'] });
      // Handle session start logic
    };
    start();
    return () => {
      // Handle session cleanup
    };
  }, [enabled]);
}
