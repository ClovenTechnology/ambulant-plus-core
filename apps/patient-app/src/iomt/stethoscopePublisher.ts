import type { Room, LocalAudioTrack } from 'livekit-client';

/**
 * Publish stethoscope audio in real time into the current LiveKit room.
 * Pass in a MediaStream produced by your native bridge / Web SDK.
 */
export async function publishStethAudio(room: Room, stream: MediaStream) {
  const track = (await LocalAudioTrack.createFromStream(stream)) as LocalAudioTrack;
  // Name it so clinicians can find/mute it separately
  await room.localParticipant.publishTrack(track, { name: 'steth-audio' });
  return () => {
    try { room.localParticipant.unpublishTrack(track); track.stop(); } catch {}
  };
}
