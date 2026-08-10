import assert from 'node:assert/strict';
import test from 'node:test';

import {
  generateOpportunityDiscovery,
  opportunityDiscoveryGeneratorVersion,
} from '@/lib/opportunity-discovery';

test('opportunity discovery generates bounded SEO and visible answer-ready content', () => {
  const generated = generateOpportunityDiscovery({
    title: 'Senior Remote Clinical Operations Lead',
    type: 'CAREER_JOB',
    summary:
      'Lead Ambulant+ clinical operations across a technology-enabled distributed care network in South Africa.',
    description:
      'This role coordinates clinical quality, operational readiness and governed remote-care delivery across the platform.',
    tags: ['clinical operations', 'remote care'],
    audienceLabel: 'Experienced HPCSA-registered clinicians',
    commitmentLabel: 'Full-time',
    commercialLabel: 'Competitive salary and benefits',
    departmentLabel: 'Clinical Operations',
    locationMode: 'REMOTE',
    locationLabel: 'South Africa',
    countryCode: 'ZA',
    closesAt: '2026-09-30T21:59:59.000Z',
    ctaLabel: 'Apply now',
  });

  assert.equal(opportunityDiscoveryGeneratorVersion(), 'opportunity-discovery-v1');
  assert.ok(generated.seoTitle.includes('Senior Remote Clinical Operations Lead'));
  assert.ok(generated.seoTitle.length <= 70);
  assert.ok(generated.seoDescription.length <= 160);
  assert.match(generated.aeoSummary, /South Africa/i);
  assert.match(generated.aeoSummary, /applications close/i);
  assert.ok(generated.aeoQuestions.length >= 5);
  assert.ok(generated.aeoQuestions.length <= 8);
  assert.ok(generated.aeoQuestions.some((item) => item.question === 'How do I apply?'));
  assert.deepEqual(generated.discoveryMeta.principles, [
    'people-first',
    'visible-content-only',
    'structured-facts',
    'manual-edits-preserved',
  ]);
});

test('opportunity discovery strips markup and avoids inventing unavailable facts', () => {
  const generated = generateOpportunityDiscovery({
    title: 'Research Collaboration',
    type: 'RESEARCH_PILOT',
    description: '<strong>Evaluate a governed remote monitoring pilot.</strong>',
  });

  assert.doesNotMatch(generated.seoDescription, /<strong>/i);
  assert.doesNotMatch(generated.aeoSummary, /salary|Johannesburg|closing date/i);
  assert.ok(!generated.aeoQuestions.some((item) => item.question === 'When do applications close?'));
  assert.ok(!generated.aeoQuestions.some((item) => item.question === 'What are the compensation or commercial terms?'));
});
