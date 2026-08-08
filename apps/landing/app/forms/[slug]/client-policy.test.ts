import assert from 'node:assert/strict';
import test from 'node:test';
import {
  evaluateCondition,
  parseResumeFragment,
  publicPageSequence,
  requiredFieldKeys,
  seedDefaultAnswers,
  translationText,
  visibleFieldKeys,
} from './client-policy';
import type { PublicFormDefinition } from './types';

function form(): PublicFormDefinition {
  return {
    id: 'f1',
    key: 'career_application',
    slug: 'career-application',
    name: 'Career application',
    version: {
      id: 'v1',
      versionNumber: 1,
      title: 'Apply',
      locale: 'en-ZA',
      allowSaveResume: true,
      availability: 'OPEN',
      pages: [
        {
          key: 'profile',
          title: 'Profile',
          order: 0,
          sections: [
            {
              key: 'main',
              title: 'Main',
              order: 0,
              fields: [
                { key: 'role', type: 'SINGLE_SELECT', label: 'Role', order: 0, options: [] },
                { key: 'portfolio', type: 'URL', label: 'Portfolio', order: 1, visibilityLogic: { field: 'role', equals: 'design' } },
                { key: 'consent', type: 'CONSENT', label: 'Consent', order: 2, required: true, defaultValue: false },
              ],
            },
          ],
        },
        { key: 'extra', title: 'Extra', order: 1, sections: [] },
      ],
      rules: [
        { key: 'req', kind: 'REQUIREMENT', condition: { field: 'role', equals: 'design' }, effect: { require: 'portfolio' } },
        { key: 'nav', kind: 'NAVIGATION', condition: { field: 'role', equals: 'skip' }, effect: { skipPage: 'extra' } },
      ],
      translations: [
        { locale: 'zu-ZA', targetType: 'FIELD', targetKey: 'role', values: { label: 'Indima' } },
      ],
    },
  };
}

test('condition evaluator mirrors compound and numeric public runtime semantics', () => {
  assert.equal(evaluateCondition({ all: [{ field: 'a', equals: 'yes' }, { field: 'n', gte: 2 }] }, { a: 'yes', n: 3 }), true);
  assert.equal(evaluateCondition({ not: { field: 'a', equals: 'yes' } }, { a: 'yes' }), false);
});

test('client visibility and requirement assistance follows published rules', () => {
  const definition = form();
  assert.equal(visibleFieldKeys(definition, { role: 'other' }).has('portfolio'), false);
  assert.equal(visibleFieldKeys(definition, { role: 'design' }).has('portfolio'), true);
  assert.equal(requiredFieldKeys(definition, { role: 'design' }).has('portfolio'), true);
  assert.equal(requiredFieldKeys(definition, { role: 'other' }).has('portfolio'), false);
});

test('navigation rules skip the configured page deterministically', () => {
  const definition = form();
  assert.deepEqual(publicPageSequence(definition, { role: 'skip' }).map((page) => page.key), ['profile']);
  assert.deepEqual(publicPageSequence(definition, { role: 'design' }).map((page) => page.key), ['profile', 'extra']);
});

test('default answers seed explicit defaults without inventing values', () => {
  assert.deepEqual(seedDefaultAnswers(form()), { consent: false });
});

test('translation lookup supports regional/base locale matching and fallback', () => {
  const definition = form();
  assert.equal(translationText({ translations: definition.version.translations, locale: 'zu', targetType: 'FIELD', targetKey: 'role', property: 'label', fallback: 'Role' }), 'Indima');
  assert.equal(translationText({ translations: definition.version.translations, locale: 'xh-ZA', targetType: 'FIELD', targetKey: 'role', property: 'label', fallback: 'Role' }), 'Role');
});

test('resume credential is accepted only from a fragment with an opaque bearer', () => {
  assert.deepEqual(parseResumeFragment('#submission=sub_1&token=abcdefghijklmnopqrstuvwxyzABCDEFGH1234_-'), {
    submissionId: 'sub_1',
    token: 'abcdefghijklmnopqrstuvwxyzABCDEFGH1234_-',
  });
  assert.equal(parseResumeFragment('#submission=sub_1&token=short'), null);
});
