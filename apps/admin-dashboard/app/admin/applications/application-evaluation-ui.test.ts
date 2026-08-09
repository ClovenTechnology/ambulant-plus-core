import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applicationEvaluationDecisionActions,
  canEditOwnInterviewEvaluation,
  interviewEvaluationStateLabel,
} from './application-evaluation-ui';

test('completed interviewed applications expose all C5B decision actions', () => {
  assert.deepEqual(
    applicationEvaluationDecisionActions('INTERVIEWED', 'COMPLETED'),
    ['SUCCESSFUL', 'OFFERED', 'DECLINED'],
  );
});

test('successful applications expose offered only', () => {
  assert.deepEqual(
    applicationEvaluationDecisionActions('SUCCESSFUL', 'COMPLETED'),
    ['OFFERED'],
  );
});

test('open or pre-interview cycles expose no decision actions', () => {
  assert.deepEqual(applicationEvaluationDecisionActions('INTERVIEWED', 'OPEN'), []);
  assert.deepEqual(applicationEvaluationDecisionActions('INTERVIEW_SCHEDULED', 'COMPLETED'), []);
});

test('self evaluation editing requires permission, draft state and open cycle', () => {
  assert.equal(
    canEditOwnInterviewEvaluation({
      canEvaluateSelf: true,
      evaluationState: 'DRAFT',
      cycleStatus: 'OPEN',
    }),
    true,
  );
  assert.equal(
    canEditOwnInterviewEvaluation({
      canEvaluateSelf: true,
      evaluationState: 'SUBMITTED',
      cycleStatus: 'COMPLETED',
    }),
    false,
  );
});

test('evaluation state labels are human readable', () => {
  assert.equal(interviewEvaluationStateLabel('DRAFT'), 'Awaiting evaluation');
  assert.equal(interviewEvaluationStateLabel('SUBMITTED'), 'Submitted');
  assert.equal(interviewEvaluationStateLabel('WAIVED'), 'Waived');
});
