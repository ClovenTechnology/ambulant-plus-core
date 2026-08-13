import { mintAdminLiveKitAccess } from '@/src/lib/admin-livekit-access';

/**
 * RTC admission for immediate staff-to-staff calls.
 *
 * DIRECT_CALL records are currently stored in the Meeting table for schema
 * compatibility, but they are not scheduled meetings:
 *
 * - no meeting admission window;
 * - no lobby;
 * - no configured call-duration ceiling;
 * - RINGING is valid only for the caller;
 * - LIVE is valid for accepted/joined call participants;
 * - the call remains live until explicitly ended by a participant.
 *
 * LiveKit tokens remain short-lived and may be renewed while the call itself
 * remains in an admissible DIRECT_CALL state.
 */

function cleanRtcText(value: unknown, maxLength: number) {
  return String(value ?? '').trim().slice(0, maxLength);
}

export async function mintDirectCallRtcAccess(input: {
  meeting: any;
  participant: any;
  identity: string;
  displayName: string;
}) {
  const call = input.meeting;

  if (!call || String(call.kind) !== 'DIRECT_CALL') {
    throw new Error('direct_call_rtc_invalid_kind');
  }

  const callState = String(call.state || '');

  if (callState !== 'LIVE') {
    throw new Error('direct_call_not_available');
  }

  if (
    input.participant?.meetingId &&
    String(input.participant.meetingId) !== String(call.id)
  ) {
    throw new Error('direct_call_access_denied');
  }

  const participantState =
    String(input.participant?.state || '');

  const participantProfileId =
    String(input.participant?.staffProfileId || '');

  const hostProfileId =
    String(call.hostProfileId || '');

  if (
    !['ACCEPTED', 'JOINED'].includes(participantState)
  ) {
    throw new Error('direct_call_access_denied');
  }

  const roomId =
    cleanRtcText(
      call.roomId,
      180,
    );

  if (!roomId) {
    throw new Error('direct_call_rtc_room_missing');
  }

  const metadata = {
    kind: 'ambulant_direct_call',
    callId: call.id,
    conversationId: call.contextId || null,
    participantId: input.participant.id,
    participantType: input.participant.participantType,
    participantRole: input.participant.role,
  };

  return mintAdminLiveKitAccess({
    roomId,
    identity:
      cleanRtcText(
        input.identity,
        240,
      ),
    displayName:
      cleanRtcText(
        input.displayName,
        240,
      ),
    metadata,
    roomAdmin:
      participantProfileId === hostProfileId,
  });
}
