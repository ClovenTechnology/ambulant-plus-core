import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canTransitionMeetingState,
  clampMeetingDurationMinutes,
  effectiveMeetingInvitationState,
  guestPinLocked,
  isMeetingState,
  meetingJoinWindow,
  normaliseMeetingEmail,
  validMeetingEmail,
  validMeetingTimezone,
  zonedLocalMeetingStart,
} from './admin-meetings-policy';

test('meeting state machine rejects reopening terminal meetings', () => {
  assert.equal(canTransitionMeetingState('SCHEDULED', 'LIVE'), true);
  assert.equal(canTransitionMeetingState('LIVE', 'ENDED'), true);
  assert.equal(canTransitionMeetingState('ENDED', 'LIVE'), false);
  assert.equal(canTransitionMeetingState('CANCELLED', 'SCHEDULED'), false);
  assert.equal(isMeetingState('scheduled'), true);
  assert.equal(isMeetingState('not-a-state'), false);
});

test('meeting join window opens 30 minutes before and closes one hour after', () => {
  const startsAt = new Date('2026-08-12T12:00:00.000Z');
  const endsAt = new Date('2026-08-12T13:00:00.000Z');

  assert.equal(meetingJoinWindow({
    state: 'SCHEDULED',
    startsAt,
    endsAt,
    now: new Date('2026-08-12T11:29:59.000Z'),
  }).open, false);

  assert.equal(meetingJoinWindow({
    state: 'SCHEDULED',
    startsAt,
    endsAt,
    now: new Date('2026-08-12T11:30:00.000Z'),
  }).open, true);

  assert.equal(meetingJoinWindow({
    state: 'SCHEDULED',
    startsAt,
    endsAt,
    now: new Date('2026-08-12T14:00:01.000Z'),
  }).open, false);
});

test('invitation expiry and revoke are authoritative', () => {
  const now = new Date('2026-08-12T12:00:00.000Z');
  assert.equal(effectiveMeetingInvitationState({
    state: 'PENDING',
    expiresAt: '2026-08-12T13:00:00.000Z',
  }, now), 'PENDING');

  assert.equal(effectiveMeetingInvitationState({
    state: 'PENDING',
    expiresAt: '2026-08-12T11:59:59.000Z',
  }, now), 'EXPIRED');

  assert.equal(effectiveMeetingInvitationState({
    state: 'VERIFIED',
    expiresAt: '2026-08-12T13:00:00.000Z',
    revokedAt: '2026-08-12T11:00:00.000Z',
  }, now), 'REVOKED');
});

test('email, duration and timezone validation are deterministic', () => {
  assert.equal(normaliseMeetingEmail('  Person@Example.COM  '), 'person@example.com');
  assert.equal(validMeetingEmail('person@example.com'), true);
  assert.equal(validMeetingEmail('invalid'), false);
  assert.equal(clampMeetingDurationMinutes(1), 5);
  assert.equal(clampMeetingDurationMinutes(90), 90);
  assert.equal(clampMeetingDurationMinutes(99999), 1440);
  assert.equal(validMeetingTimezone('Africa/Johannesburg'), true);
  assert.equal(validMeetingTimezone('Definitely/Not-A-Timezone'), false);
});

test('timezone conversion preserves the requested Johannesburg wall-clock time', () => {
  const converted = zonedLocalMeetingStart('2026-08-12T14:30:00', 'Africa/Johannesburg');
  assert.equal(converted?.toISOString(), '2026-08-12T12:30:00.000Z');
});

test('PIN lock obeys lockedUntil rather than attempt count alone', () => {
  const now = new Date('2026-08-12T12:00:00.000Z');
  assert.equal(guestPinLocked({ attemptCount: 8, lockedUntil: null }, now), false);
  assert.equal(guestPinLocked({ attemptCount: 5, lockedUntil: '2026-08-12T12:15:00.000Z' }, now), true);
  assert.equal(guestPinLocked({ attemptCount: 5, lockedUntil: '2026-08-12T11:59:59.000Z' }, now), false);
});
