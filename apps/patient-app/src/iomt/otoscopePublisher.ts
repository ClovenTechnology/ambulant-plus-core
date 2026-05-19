import { LocalVideoTrack } from 'livekit-client';
import type { Room } from 'livekit-client';

/** Publish otoscope camera as a video track named "otoscope-cam". */
export async function publishOtoscopeVideo(
  room: Room,
  stream: MediaStream
): Promise<() => void> {
  const mediaTrack = stream.getVideoTracks()[0];

  if (!mediaTrack) {
    throw new Error('No video track found in otoscope MediaStream.');
  }

  const track = new LocalVideoTrack(mediaTrack);

  await room.localParticipant.publishTrack(track, {
    name: 'otoscope-cam',
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