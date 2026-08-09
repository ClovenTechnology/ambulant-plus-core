import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canStartCanonicalStaffOnboarding,
  canonicalDirectConversationKey,
  normalizeStaffMessageBody,
  validConversationShape,
  validDirectCallMode,
} from './enterprise-completion-policy';

test('successful applications may enter canonical staff onboarding', () => {
  assert.equal(canStartCanonicalStaffOnboarding('SUCCESSFUL'), true);
});

test('offered applications may enter canonical staff onboarding', () => {
  assert.equal(canStartCanonicalStaffOnboarding('OFFERED'), true);
});

test('non-decision application states cannot enter canonical staff onboarding', () => {
  assert.equal(canStartCanonicalStaffOnboarding('INTERVIEWED'), false);
  assert.equal(canStartCanonicalStaffOnboarding('DECLINED'), false);
});

test('direct conversation keys are deterministic regardless of caller order', () => {
  assert.equal(canonicalDirectConversationKey('staff-b', 'staff-a'), 'staff-a:staff-b');
});

test('direct conversation key rejects self-conversations', () => {
  assert.equal(canonicalDirectConversationKey('staff-a', 'staff-a'), null);
});

test('message bodies are trimmed and bounded', () => {
  assert.equal(normalizeStaffMessageBody('  hello  '), 'hello');
  assert.equal(normalizeStaffMessageBody(''), null);
  assert.equal(normalizeStaffMessageBody('abcd', 3), null);
});

test('direct conversations require exactly one other staff profile', () => {
  assert.equal(validConversationShape({ kind: 'DIRECT', otherProfileIds: ['b'] }), true);
  assert.equal(validConversationShape({ kind: 'DIRECT', otherProfileIds: ['b', 'c'] }), false);
});

test('group conversations require members and a title', () => {
  assert.equal(validConversationShape({ kind: 'GROUP', otherProfileIds: ['b'], title: 'Ops' }), true);
  assert.equal(validConversationShape({ kind: 'GROUP', otherProfileIds: [], title: 'Ops' }), false);
  assert.equal(validConversationShape({ kind: 'GROUP', otherProfileIds: ['b'], title: ' ' }), false);
});

test('direct call mode accepts only audio or video', () => {
  assert.equal(validDirectCallMode('audio'), 'audio');
  assert.equal(validDirectCallMode('video'), 'video');
  assert.equal(validDirectCallMode('screen'), null);
});

test('policy helpers do not create a parallel identity or meeting authority', () => {
  const source = [canonicalDirectConversationKey, canStartCanonicalStaffOnboarding, validDirectCallMode]
    .map((fn) => fn.toString())
    .join('\n');
  assert.equal(source.includes('AdminUserProfile'), false);
  assert.equal(source.includes('LiveKit'), false);
});
