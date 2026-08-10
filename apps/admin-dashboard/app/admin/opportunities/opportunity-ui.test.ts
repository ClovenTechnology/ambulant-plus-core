import assert from 'node:assert/strict';
import test from 'node:test';
import {
  datetimeLocalToIso,
  humanizeOpportunityError,
  opportunityAvailability,
  parseTags,
  toDatetimeLocal,
} from './opportunity-ui';

test('tag parsing normalises whitespace, deduplicates case-insensitively and caps at 12', () => {
  const source = ['Graduate', ' graduate ', 'Clinical   operations', ...Array.from({ length: 20 }, (_, index) => `Tag ${index + 1}`)].join(',');
  const tags = parseTags(source);
  assert.equal(tags[0], 'Graduate');
  assert.equal(tags[1], 'Clinical operations');
  assert.equal(tags.length, 12);
  assert.equal(new Set(tags.map((tag) => tag.toLowerCase())).size, 12);
});

test('published opportunity availability honours opening and closing windows', () => {
  const now = new Date('2026-08-08T12:00:00.000Z');
  assert.equal(opportunityAvailability({ status: 'PUBLISHED', opensAt: '2026-08-09T00:00:00.000Z', closesAt: null }, now), 'UPCOMING');
  assert.equal(opportunityAvailability({ status: 'PUBLISHED', opensAt: null, closesAt: '2026-08-09T00:00:00.000Z' }, now), 'OPEN');
  assert.equal(opportunityAvailability({ status: 'PUBLISHED', opensAt: null, closesAt: '2026-08-08T11:59:59.000Z' }, now), 'CLOSED');
});

test('non-published opportunity is never treated as publicly open', () => {
  assert.equal(opportunityAvailability({ status: 'PAUSED', opensAt: null, closesAt: null }), 'UNAVAILABLE');
});

test('datetime-local conversion returns an ISO instant and round-trips to a local control value', () => {
  const iso = datetimeLocalToIso('2026-08-08T14:30');
  assert.ok(iso?.endsWith('Z'));
  assert.equal(toDatetimeLocal(iso).length, 16);
});

test('domain errors are translated into actionable admin copy', () => {
  assert.equal(
    humanizeOpportunityError('opportunity_pause_before_edit'),
    'Pause this published opportunity before editing it.',
  );
  assert.match(humanizeOpportunityError('invalid_opportunity_image'), /supported image/i);
  assert.match(humanizeOpportunityError('opportunity_gallery_limit_reached'), /maximum of 8/i);
  assert.match(humanizeOpportunityError('opportunity_gallery_alt_required'), /alt text/i);
});
