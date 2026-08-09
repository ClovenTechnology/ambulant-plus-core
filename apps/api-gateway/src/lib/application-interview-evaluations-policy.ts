import type { EnterpriseFormDefinition } from '@/src/lib/admin-forms-policy';

export const APPLICATION_INTERVIEW_EVALUATION_CONTEXT_TYPE =
  'APPLICATION_INTERVIEW_EVALUATION' as const;

export const APPLICATION_INTERVIEW_EVALUATION_ALLOWED_FIELD_TYPES = new Set([
  'SHORT_TEXT',
  'LONG_TEXT',
  'EMAIL',
  'PHONE',
  'NUMBER',
  'CURRENCY',
  'DATE',
  'DATETIME',
  'TIME',
  'BOOLEAN',
  'SINGLE_SELECT',
  'MULTI_SELECT',
  'RADIO',
  'CHECKBOX',
  'CHECKBOX_GROUP',
  'CONSENT',
  'URL',
  'COUNTRY',
  'RATING',
  'HIDDEN',
  'INFORMATION',
] as const);

export type ApplicationInterviewEvaluationDecision =
  | 'SUCCESSFUL'
  | 'OFFERED'
  | 'DECLINED';

export function cleanApplicationInterviewEvaluationText(
  value: unknown,
  max = 4000,
) {
  return String(value ?? '').trim().slice(0, Math.max(1, max));
}

export function evaluationFormCompatibility(
  definition: EnterpriseFormDefinition,
) {
  const issues: string[] = [];

  for (const page of definition.pages ?? []) {
    for (const section of page.sections ?? []) {
      if (section.repeatable) {
        issues.push(`repeatable_section:${section.key}`);
      }

      for (const field of section.fields ?? []) {
        if (!APPLICATION_INTERVIEW_EVALUATION_ALLOWED_FIELD_TYPES.has(field.type as any)) {
          issues.push(`unsupported_field:${field.key}:${field.type}`);
        }

        if (field.visibilityLogic != null) {
          issues.push(`field_visibility_logic:${field.key}`);
        }
      }
    }
  }

  for (const rule of definition.rules ?? []) {
    if (
      rule.enabled !== false &&
      !['SCORING', 'CALCULATION'].includes(String(rule.kind))
    ) {
      issues.push(`unsupported_rule:${rule.key}:${rule.kind}`);
    }
  }

  return Array.from(new Set(issues)).slice(0, 100);
}

export function canStartApplicationInterviewEvaluation(input: {
  applicationStatus: string;
  meetingState: string;
  intervieweeAttended: boolean;
  attendingEvaluatorCount: number;
}) {
  return (
    input.applicationStatus === 'INTERVIEW_SCHEDULED' &&
    input.meetingState === 'ENDED' &&
    input.intervieweeAttended &&
    input.attendingEvaluatorCount > 0
  );
}

export function canSubmitApplicationInterviewEvaluation(input: {
  applicationStatus: string;
  cycleStatus: string;
  evaluationState: string;
  meetingState: string;
}) {
  return (
    input.applicationStatus === 'INTERVIEW_SCHEDULED' &&
    input.cycleStatus === 'OPEN' &&
    input.evaluationState === 'DRAFT' &&
    input.meetingState === 'ENDED'
  );
}

export function canMakeApplicationInterviewDecision(
  fromStatus: string,
  decision: ApplicationInterviewEvaluationDecision,
) {
  if (fromStatus === 'INTERVIEWED') {
    return ['SUCCESSFUL', 'OFFERED', 'DECLINED'].includes(decision);
  }

  if (fromStatus === 'SUCCESSFUL') {
    return decision === 'OFFERED';
  }

  return false;
}

export function aggregateInterviewEvaluationScore(scores: Array<number | null | undefined>) {
  const finite = scores.filter(
    (value): value is number => typeof value === 'number' && Number.isFinite(value),
  );

  if (!finite.length) return null;
  return finite.reduce((sum, value) => sum + value, 0) / finite.length;
}
