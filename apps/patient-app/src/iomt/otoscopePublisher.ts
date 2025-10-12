import type { Room, LocalVideoTrack } from 'livekit-client';

/** Publish otoscope camera as a video track named "otoscope-cam". */
export async function publishOtoscopeVideo(room: Room, stream: MediaStream) {
  const track = (await LocalVideoTrack.createFromStream(stream)) as LocalVideoTrack;
  await room.localParticipant.publishTrack(track, { name: 'otoscope-cam' });
  return () => {
    try { room.localParticipant.unpublishTrack(track); track.stop(); } catch {}
  };
}
