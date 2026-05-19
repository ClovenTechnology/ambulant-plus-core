import { LocalAudioTrack } from 'livekit-client';
import type { Room } from 'livekit-client';

/**
 * Publish stethoscope audio in real time into the current LiveKit room.
 * Pass in a MediaStream produced by your native bridge / Web SDK.
 */
export async function publishStethAudio(
  room: Room,
  stream: MediaStream
): Promise<() => void> {
  const mediaTrack = stream.getAudioTracks()[0];

  if (!mediaTrack) {
    throw new Error('No audio track found in stethoscope MediaStream.');
  }

  const track = new LocalAudioTrack(mediaTrack);

  // Name it so clinicians can find/mute it separately.
  await room.localParticipant.publishTrack(track, {
    name: 'steth-audio',
  });

  return () => {
    try {
      room.localParticipant.unpublishTrack(track);
    } catch {
      // Ignore LiveKit unpublish failures.
    }

    try {
      track.stop();
    } catch {
      // Ignore LiveKit track stop failures.
    }

    try {
      mediaTrack.stop();
    } catch {
      // Ignore browser media track stop failures.
    }
  };
}