export type EvaluationDecision = 'SUCCESSFUL' | 'OFFERED' | 'DECLINED';

export function applicationEvaluationDecisionActions(
  applicationStatus: string,
  cycleStatus: string,
): EvaluationDecision[] {
  if (cycleStatus !== 'COMPLETED') return [];
  if (applicationStatus === 'INTERVIEWED') {
    return ['SUCCESSFUL', 'OFFERED', 'DECLINED'];
  }
  if (applicationStatus === 'SUCCESSFUL') return ['OFFERED'];
  return [];
}

export function canEditOwnInterviewEvaluation(input: {
  canEvaluateSelf: boolean;
  evaluationState?: string | null;
  cycleStatus?: string | null;
}) {
  return (
    input.canEvaluateSelf &&
    input.evaluationState === 'DRAFT' &&
    input.cycleStatus === 'OPEN'
  );
}

export function interviewEvaluationStateLabel(state: string) {
  const labels: Record<string, string> = {
    DRAFT: 'Awaiting evaluation',
    SUBMITTED: 'Submitted',
    WAIVED: 'Waived',
  };
  return labels[state] || state.replace(/_/g, ' ').toLowerCase();
}
