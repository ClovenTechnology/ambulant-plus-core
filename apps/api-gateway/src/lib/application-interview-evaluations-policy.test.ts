import test from 'node:test';
import assert from 'node:assert/strict';
import {
  aggregateInterviewEvaluationScore,
  canMakeApplicationInterviewDecision,
  canStartApplicationInterviewEvaluation,
  canSubmitApplicationInterviewEvaluation,
  evaluationFormCompatibility,
} from './application-interview-evaluations-policy';

test('evaluation cycle starts only after an attended ended interview', () => {
  assert.equal(
    canStartApplicationInterviewEvaluation({
      applicationStatus: 'INTERVIEW_SCHEDULED',
      meetingState: 'ENDED',
      intervieweeAttended: true,
      attendingEvaluatorCount: 2,
    }),
    true,
  );
  assert.equal(
    canStartApplicationInterviewEvaluation({
      applicationStatus: 'INTERVIEW_SCHEDULED',
      meetingState: 'LIVE',
      intervieweeAttended: true,
      attendingEvaluatorCount: 2,
    }),
    false,
  );
});

test('evaluation requires interviewee and evaluator attendance', () => {
  assert.equal(
    canStartApplicationInterviewEvaluation({
      applicationStatus: 'INTERVIEW_SCHEDULED',
      meetingState: 'ENDED',
      intervieweeAttended: false,
      attendingEvaluatorCount: 2,
    }),
    false,
  );
  assert.equal(
    canStartApplicationInterviewEvaluation({
      applicationStatus: 'INTERVIEW_SCHEDULED',
      meetingState: 'ENDED',
      intervieweeAttended: true,
      attendingEvaluatorCount: 0,
    }),
    false,
  );
});

test('only draft open-cycle evaluations can be submitted', () => {
  assert.equal(
    canSubmitApplicationInterviewEvaluation({
      applicationStatus: 'INTERVIEW_SCHEDULED',
      cycleStatus: 'OPEN',
      evaluationState: 'DRAFT',
      meetingState: 'ENDED',
    }),
    true,
  );
  assert.equal(
    canSubmitApplicationInterviewEvaluation({
      applicationStatus: 'INTERVIEWED',
      cycleStatus: 'COMPLETED',
      evaluationState: 'SUBMITTED',
      meetingState: 'ENDED',
    }),
    false,
  );
});

test('interviewed applications support successful, offered or declined decisions', () => {
  assert.equal(canMakeApplicationInterviewDecision('INTERVIEWED', 'SUCCESSFUL'), true);
  assert.equal(canMakeApplicationInterviewDecision('INTERVIEWED', 'OFFERED'), true);
  assert.equal(canMakeApplicationInterviewDecision('INTERVIEWED', 'DECLINED'), true);
});

test('successful applications can move only to offered in C5B', () => {
  assert.equal(canMakeApplicationInterviewDecision('SUCCESSFUL', 'OFFERED'), true);
  assert.equal(canMakeApplicationInterviewDecision('SUCCESSFUL', 'DECLINED'), false);
});

test('evaluation compatibility rejects branching and unsupported upload/repeater structures', () => {
  const issues = evaluationFormCompatibility({
    pages: [
      {
        key: 'p1',
        title: 'Page',
        order: 0,
        sections: [
          {
            key: 's1',
            title: 'Section',
            order: 0,
            repeatable: true,
            fields: [
              {
                key: 'evidence',
                type: 'FILE_UPLOAD',
                label: 'Evidence',
                order: 0,
                visibilityLogic: { field: 'x' },
              },
            ],
          },
        ],
      },
    ],
    rules: [
      {
        key: 'branch',
        kind: 'VISIBILITY',
        priority: 0,
        enabled: true,
        condition: {},
        effect: {},
      },
    ],
    translations: [],
  } as any);

  assert.equal(issues.some((value) => value.startsWith('repeatable_section:')), true);
  assert.equal(issues.some((value) => value.startsWith('unsupported_field:')), true);
  assert.equal(issues.some((value) => value.startsWith('field_visibility_logic:')), true);
  assert.equal(issues.some((value) => value.startsWith('unsupported_rule:')), true);
});

test('scoring/calculation-only forms remain compatible', () => {
  const issues = evaluationFormCompatibility({
    pages: [
      {
        key: 'p1',
        title: 'Page',
        order: 0,
        sections: [
          {
            key: 's1',
            title: 'Section',
            order: 0,
            repeatable: false,
            fields: [
              {
                key: 'rating',
                type: 'RATING',
                label: 'Rating',
                order: 0,
                scoring: { pointsByValue: { '5': 5 } },
              },
            ],
          },
        ],
      },
    ],
    rules: [
      {
        key: 'score',
        kind: 'SCORING',
        priority: 0,
        enabled: true,
        condition: {},
        effect: { points: 1 },
      },
    ],
    translations: [],
  } as any);

  assert.deepEqual(issues, []);
});

test('aggregate score averages submitted finite scores only', () => {
  assert.equal(aggregateInterviewEvaluationScore([8, 6, null, undefined]), 7);
  assert.equal(aggregateInterviewEvaluationScore([null, undefined]), null);
});
