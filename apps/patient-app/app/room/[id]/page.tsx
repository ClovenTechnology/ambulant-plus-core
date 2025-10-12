// apps/patient-app/app/room/[id]/page.tsx
import { LiveKitRoom } from '@livekit/components-react';
import { getToken } from '@/lib/getToken'; // calls /api/rtc/token
import { CaptionsOverlay } from '@/components/rtc/CaptionsOverlay'; // reuse from clinician

export default async function Room({ params }: { params: { id: string }}) {
  const { token, url } = await getToken({ roomName: params.id, identity: 'patient' });
  return (
    <LiveKitRoom token={token} serverUrl={url} connect={true}
      className="h-[calc(100vh-64px)] rounded-2xl overflow-hidden bg-black">
      {/* reuse shared UI: grid, toolbar, overlays */}
      <CaptionsOverlay />
    </LiveKitRoom>
  );
}
