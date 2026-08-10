import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canEditEnterpriseFormVersion,
  canPermanentlyDeleteEnterpriseForm,
  canPublishEnterpriseFormVersion,
  canRetireEnterpriseFormVersion,
  normaliseFormKey,
  normaliseFormSlug,
  validFormKey,
  validFormLocale,
  validFormSlug,
  validSubmissionWindow,
  validateEnterpriseFormDefinition,
  type EnterpriseFormDefinition,
} from './admin-forms-policy';

const validDefinition: EnterpriseFormDefinition = {
  pages: [
    {
      key: 'personal_details',
      title: 'Personal details',
      order: 0,
      sections: [
        {
          key: 'identity',
          title: 'Identity',
          order: 0,
          fields: [
            {
              key: 'email',
              type: 'EMAIL',
              label: 'Email address',
              order: 0,
              required: true,
            },
            {
              key: 'role_interest',
              type: 'SINGLE_SELECT',
              label: 'Role of interest',
              order: 1,
              options: [
                { key: 'clinical', label: 'Clinical', value: 'clinical', order: 0 },
                { key: 'operations', label: 'Operations', value: 'operations', order: 1 },
              ],
            },
          ],
        },
      ],
    },
  ],
  rules: [
    {
      key: 'show_clinical_registration',
      kind: 'VISIBILITY',
      condition: { field: 'role_interest', equals: 'clinical' },
      effect: { show: 'clinical_registration' },
    },
  ],
  translations: [
    {
      locale: 'zu-ZA',
      targetType: 'FIELD',
      targetKey: 'email',
      values: { label: 'Ikheli le-imeyili' },
    },
  ],
};

test('form key, slug and locale normalisation are deterministic', () => {
  assert.equal(normaliseFormKey(' Candidate Details '), 'candidate_details');
  assert.equal(normaliseFormSlug('Candidate Details 2026'), 'candidate-details-2026');
  assert.equal(validFormKey('candidate_details'), true);
  assert.equal(validFormKey('Candidate Details'), false);
  assert.equal(validFormSlug('candidate-details'), true);
  assert.equal(validFormSlug('Candidate Details'), false);
  assert.equal(validFormLocale('en-ZA'), true);
  assert.equal(validFormLocale('not a locale'), false);
});

test('published and retired versions are immutable by policy', () => {
  assert.equal(canEditEnterpriseFormVersion('DRAFT'), true);
  assert.equal(canEditEnterpriseFormVersion('PUBLISHED'), false);
  assert.equal(canEditEnterpriseFormVersion('RETIRED'), false);
  assert.equal(canPublishEnterpriseFormVersion('DRAFT'), true);
  assert.equal(canPublishEnterpriseFormVersion('PUBLISHED'), false);
  assert.equal(canRetireEnterpriseFormVersion('PUBLISHED'), true);
  assert.equal(canRetireEnterpriseFormVersion('DRAFT'), false);
});

test('draft may be empty but publish requires complete structure', () => {
  assert.deepEqual(validateEnterpriseFormDefinition({ pages: [] }, 'draft'), []);
  assert.equal(
    validateEnterpriseFormDefinition({ pages: [] }, 'publish').some(
      (issue) => issue.code === 'page_required',
    ),
    true,
  );
  assert.deepEqual(validateEnterpriseFormDefinition(validDefinition, 'publish'), []);
});

test('field keys are unique across the entire version', () => {
  const duplicate: EnterpriseFormDefinition = JSON.parse(JSON.stringify(validDefinition));
  duplicate.pages.push({
    key: 'second_page',
    title: 'Second page',
    order: 1,
    sections: [
      {
        key: 'second_section',
        title: 'Second section',
        order: 0,
        fields: [
          { key: 'email', type: 'SHORT_TEXT', label: 'Duplicate', order: 0 },
        ],
      },
    ],
  });

  assert.equal(
    validateEnterpriseFormDefinition(duplicate, 'publish').some(
      (issue) => issue.code === 'duplicate_field_key',
    ),
    true,
  );
});

test('choice fields require unique publishable options', () => {
  const invalid: EnterpriseFormDefinition = JSON.parse(JSON.stringify(validDefinition));
  const choice = invalid.pages[0].sections[0].fields[1];
  choice.options = [
    { key: 'same', label: 'One', value: 'same', order: 0 },
    { key: 'same', label: 'Two', value: 'same', order: 1 },
  ];

  const issues = validateEnterpriseFormDefinition(invalid, 'publish');
  assert.equal(issues.some((issue) => issue.code === 'duplicate_option_key'), true);
  assert.equal(issues.some((issue) => issue.code === 'duplicate_option_value'), true);
});

test('malformed draft arrays are rejected rather than interpreted as empty structure', () => {
  const malformed = { pages: [{ key: 'page', title: 'Page', order: 0 }] } as any;
  const issues = validateEnterpriseFormDefinition(malformed, 'draft');
  assert.equal(issues.some((issue) => issue.code === 'sections_array_required'), true);
});

test('submission window rejects an inverted interval', () => {
  assert.equal(
    validSubmissionWindow({
      acceptingFrom: new Date('2026-08-10T09:00:00Z'),
      acceptingUntil: new Date('2026-08-10T08:59:59Z'),
    }),
    false,
  );
  assert.equal(
    validSubmissionWindow({
      acceptingFrom: new Date('2026-08-10T09:00:00Z'),
      acceptingUntil: new Date('2026-08-10T10:00:00Z'),
    }),
    true,
  );
});


test('permanent form deletion is blocked by published history or downstream records', () => {
  assert.equal(
    canPermanentlyDeleteEnterpriseForm({
      submissionCount: 0,
      opportunityCount: 0,
      recruitmentTemplateCount: 0,
      versions: [{ state: 'DRAFT', applicationCount: 0, evaluationCycleCount: 0, recruitmentEvaluationTemplateCount: 0 }],
    }),
    true,
  );
  assert.equal(
    canPermanentlyDeleteEnterpriseForm({ submissionCount: 1, versions: [] }),
    false,
  );
  assert.equal(
    canPermanentlyDeleteEnterpriseForm({
      versions: [{ state: 'PUBLISHED', publishedAt: new Date(), applicationCount: 0, evaluationCycleCount: 0, recruitmentEvaluationTemplateCount: 0 }],
    }),
    false,
  );
  assert.equal(
    canPermanentlyDeleteEnterpriseForm({ opportunityCount: 1, versions: [] }),
    false,
  );
});
