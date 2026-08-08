import test from 'node:test';
import assert from 'node:assert/strict';
import type { EnterpriseFormDefinition } from './admin-forms-policy';
import {
  consentTextHash,
  derivePublicFormValues,
  evaluateFormCondition,
  formAvailability,
  pageSequence,
  publicFormAntiSpamPolicy,
  publicFormUploadPolicy,
  requiredEnterpriseFormFieldKeys,
  validatePublicFormAnswers,
  visibleEnterpriseFormFieldKeys,
} from './public-forms-policy';

const definition: EnterpriseFormDefinition = {
  pages: [
    {
      key: 'main',
      title: 'Main',
      order: 0,
      sections: [
        {
          key: 'identity',
          title: 'Identity',
          order: 0,
          fields: [
            { key: 'email', type: 'EMAIL', label: 'Email', order: 0, required: true },
            {
              key: 'kind',
              type: 'SINGLE_SELECT',
              label: 'Kind',
              order: 1,
              options: [
                { key: 'a', label: 'A', value: 'a', order: 0 },
                { key: 'b', label: 'B', value: 'b', order: 1 },
              ],
            },
            {
              key: 'license',
              type: 'SHORT_TEXT',
              label: 'Licence',
              order: 2,
              visibilityLogic: { field: 'kind', equals: 'a' },
            },
            {
              key: 'consent',
              type: 'CONSENT',
              label: 'I agree',
              order: 3,
              required: true,
            },
            {
              key: 'cv',
              type: 'FILE_UPLOAD',
              label: 'CV',
              order: 4,
              required: true,
              config: { maxFiles: 2, maxFileSizeBytes: 1000, allowedContentTypes: ['application/pdf'] },
            },
            {
              key: 'points',
              type: 'NUMBER',
              label: 'Points',
              order: 5,
              calculation: { op: 'sum', fields: ['x', 'y'] },
            },
          ],
        },
      ],
    },
    { key: 'secondary', title: 'Secondary', order: 1, sections: [] },
  ],
  rules: [
    {
      key: 'require_license',
      kind: 'REQUIREMENT',
      condition: { field: 'kind', equals: 'a' },
      effect: { require: 'license' },
    },
    {
      key: 'score_a',
      kind: 'SCORING',
      condition: { field: 'kind', equals: 'a' },
      effect: { add: 5 },
    },
    {
      key: 'skip_secondary',
      kind: 'NAVIGATION',
      condition: { field: 'kind', equals: 'b' },
      effect: { skipPage: 'secondary' },
    },
  ],
};

test('availability obeys inclusive open / exclusive close boundary', () => {
  const now = new Date('2026-08-08T12:00:00.000Z');
  assert.equal(formAvailability({}, now), 'OPEN');
  assert.equal(formAvailability({ acceptingFrom: '2026-08-08T12:01:00.000Z' }, now), 'NOT_STARTED');
  assert.equal(formAvailability({ acceptingUntil: '2026-08-08T12:00:00.000Z' }, now), 'CLOSED');
});

test('condition evaluator supports compound and scalar operators deterministically', () => {
  const answers = { kind: 'a', score: 7, tags: ['x', 'y'] };
  assert.equal(evaluateFormCondition({ field: 'kind', equals: 'a' }, answers), true);
  assert.equal(evaluateFormCondition({ field: 'score', gte: 7, lt: 8 }, answers), true);
  assert.equal(evaluateFormCondition({ all: [{ field: 'kind', equals: 'a' }, { field: 'score', gt: 5 }] }, answers), true);
  assert.equal(evaluateFormCondition({ field: 'tags', equals: 'y' }, answers), true);
});

test('visibility and requirement rules are server authoritative', () => {
  const visible = visibleEnterpriseFormFieldKeys(definition, { kind: 'a' });
  assert.equal(visible.has('license'), true);
  const required = requiredEnterpriseFormFieldKeys(definition, { kind: 'a' });
  assert.equal(required.has('license'), true);
  assert.equal(required.has('email'), true);
});

test('submit validation enforces conditional required, consent and files', () => {
  const issues = validatePublicFormAnswers({
    definition,
    mode: 'submit',
    answers: { email: 'bad', kind: 'a', consent: false, license: '' },
    availableFileFieldKeys: new Set(),
  });
  const codes = new Set(issues.map((issue) => `${issue.fieldKey}:${issue.code}`));
  assert.equal(codes.has('email:email_invalid'), true);
  assert.equal(codes.has('license:required'), true);
  assert.equal(codes.has('consent:consent_required'), true);
  assert.equal(codes.has('cv:file_required'), true);
});

test('choice values are rejected unless they belong to the published option set', () => {
  const issues = validatePublicFormAnswers({
    definition,
    mode: 'draft',
    answers: { kind: 'wrong' },
  });
  assert.equal(issues.some((issue) => issue.fieldKey === 'kind' && issue.code === 'option_invalid'), true);
});

test('unsafe validation regex constructs are rejected before execution', () => {
  const unsafe: EnterpriseFormDefinition = JSON.parse(JSON.stringify(definition));
  const email = unsafe.pages[0].sections[0].fields.find((field) => field.key === 'email')!;
  email.type = 'SHORT_TEXT';
  email.validation = { pattern: '(a+)+$' };
  const issues = validatePublicFormAnswers({
    definition: unsafe,
    mode: 'draft',
    answers: { email: 'aaaaaaaaaaaaaaaa!' },
  });
  assert.equal(issues.some((issue) => issue.code === 'validation_pattern_unsupported'), true);
});

test('calculations, scoring and navigation rules are deterministic', () => {
  const result = derivePublicFormValues(definition, { kind: 'a', x: 2, y: 3 });
  assert.equal(result.calculations.points, 5);
  assert.equal(result.score, 5);
  assert.deepEqual(pageSequence(definition.pages, definition.rules, { kind: 'b' }).map((page) => page.key), ['main']);
});

test('consent text hashes are stable and upload/anti-spam policies are bounded', () => {
  const consent = definition.pages[0].sections[0].fields.find((field) => field.key === 'consent')!;
  assert.equal(consentTextHash(consent), consentTextHash({ ...consent }));
  const upload = publicFormUploadPolicy(definition.pages[0].sections[0].fields.find((field) => field.key === 'cv')!);
  assert.equal(upload.maxFiles, 2);
  assert.equal(upload.maxFileSizeBytes, 1024);
  assert.equal(upload.allowedContentTypes.has('application/pdf'), true);
  const spam = publicFormAntiSpamPolicy({ maxStarts: 0, windowSeconds: 1, minSubmitSeconds: 999999 });
  assert.equal(spam.maxStarts, 1);
  assert.equal(spam.windowSeconds, 60);
  assert.equal(spam.minSubmitSeconds, 3600);
});
