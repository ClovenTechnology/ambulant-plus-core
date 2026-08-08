import { createHash } from 'node:crypto';
import type {
  EnterpriseFormDefinition,
  EnterpriseFormFieldDefinition,
  EnterpriseFormPageDefinition,
  EnterpriseFormRuleDefinition,
  EnterpriseFormSectionDefinition,
} from './admin-forms-policy';

export type PublicFormAvailability = 'OPEN' | 'NOT_STARTED' | 'CLOSED';

export type PublicFormValidationIssue = {
  fieldKey: string;
  code: string;
};

export type PublicFormAnswerMap = Record<string, unknown>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[+0-9() .-]{6,40}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;

const CHOICE_TYPES = new Set([
  'SINGLE_SELECT',
  'RADIO',
  'MULTI_SELECT',
  'CHECKBOX_GROUP',
]);

const ARRAY_TYPES = new Set(['MULTI_SELECT', 'CHECKBOX_GROUP']);
const BOOLEAN_TYPES = new Set(['BOOLEAN', 'CHECKBOX', 'CONSENT']);
const NUMBER_TYPES = new Set(['NUMBER', 'CURRENCY', 'RATING']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function compareValue(actual: unknown, expected: unknown) {
  if (Array.isArray(actual)) {
    return actual.some((item) => Object.is(item, expected));
  }
  return Object.is(actual, expected);
}

export function formAvailability(
  version: { acceptingFrom?: Date | string | null; acceptingUntil?: Date | string | null },
  now = new Date(),
): PublicFormAvailability {
  const from = version.acceptingFrom ? new Date(version.acceptingFrom) : null;
  const until = version.acceptingUntil ? new Date(version.acceptingUntil) : null;

  if (from && Number.isFinite(from.getTime()) && now.getTime() < from.getTime()) {
    return 'NOT_STARTED';
  }
  if (until && Number.isFinite(until.getTime()) && now.getTime() >= until.getTime()) {
    return 'CLOSED';
  }
  return 'OPEN';
}

export function evaluateFormCondition(
  condition: unknown,
  answers: PublicFormAnswerMap,
): boolean {
  if (!isRecord(condition)) return false;

  if (Array.isArray(condition.all)) {
    return condition.all.every((entry) => evaluateFormCondition(entry, answers));
  }
  if (Array.isArray(condition.any)) {
    return condition.any.some((entry) => evaluateFormCondition(entry, answers));
  }
  if (condition.not !== undefined) {
    return !evaluateFormCondition(condition.not, answers);
  }

  const field = asString(condition.field);
  if (!field) return false;
  const actual = answers[field];

  if ('equals' in condition) return compareValue(actual, condition.equals);
  if ('notEquals' in condition) return !compareValue(actual, condition.notEquals);
  if (Array.isArray(condition.in)) {
    return condition.in.some((entry) => compareValue(actual, entry));
  }
  if (Array.isArray(condition.notIn)) {
    return !condition.notIn.some((entry) => compareValue(actual, entry));
  }
  if (typeof condition.exists === 'boolean') {
    const exists = actual !== undefined && actual !== null && actual !== '';
    return condition.exists ? exists : !exists;
  }
  if (typeof condition.truthy === 'boolean') {
    return condition.truthy ? Boolean(actual) : !Boolean(actual);
  }

  const number = finiteNumber(actual);
  if (number != null) {
    const gt = finiteNumber(condition.gt);
    if (gt != null && !(number > gt)) return false;
    const gte = finiteNumber(condition.gte);
    if (gte != null && !(number >= gte)) return false;
    const lt = finiteNumber(condition.lt);
    if (lt != null && !(number < lt)) return false;
    const lte = finiteNumber(condition.lte);
    if (lte != null && !(number <= lte)) return false;
    if (gt != null || gte != null || lt != null || lte != null) return true;
  }

  return false;
}

function allFields(definition: EnterpriseFormDefinition) {
  const result: EnterpriseFormFieldDefinition[] = [];
  for (const page of definition.pages ?? []) {
    for (const section of page.sections ?? []) {
      for (const field of section.fields ?? []) result.push(field);
    }
  }
  return result;
}

function isFieldVisibleByOwnLogic(
  field: EnterpriseFormFieldDefinition,
  answers: PublicFormAnswerMap,
) {
  if (field.visibilityLogic == null) return true;
  return evaluateFormCondition(field.visibilityLogic, answers);
}

export function visibleEnterpriseFormFieldKeys(
  definition: EnterpriseFormDefinition,
  answers: PublicFormAnswerMap,
) {
  const visible = new Set<string>();
  const hidden = new Set<string>();

  for (const field of allFields(definition)) {
    if (isFieldVisibleByOwnLogic(field, answers)) visible.add(field.key);
  }

  const rules = [...(definition.rules ?? [])]
    .filter((rule) => rule.enabled !== false && rule.kind === 'VISIBILITY')
    .sort((a, b) => Number(a.priority ?? 0) - Number(b.priority ?? 0));

  for (const rule of rules) {
    if (!evaluateFormCondition(rule.condition, answers) || !isRecord(rule.effect)) continue;

    const show = asString(rule.effect.show);
    const hide = asString(rule.effect.hide);
    const showFields = Array.isArray(rule.effect.showFields)
      ? rule.effect.showFields.map(asString).filter(Boolean)
      : [];
    const hideFields = Array.isArray(rule.effect.hideFields)
      ? rule.effect.hideFields.map(asString).filter(Boolean)
      : [];

    if (show) {
      hidden.delete(show);
      visible.add(show);
    }
    if (hide) {
      visible.delete(hide);
      hidden.add(hide);
    }
    for (const key of showFields) {
      hidden.delete(key);
      visible.add(key);
    }
    for (const key of hideFields) {
      visible.delete(key);
      hidden.add(key);
    }
  }

  for (const key of hidden) visible.delete(key);
  return visible;
}

export function requiredEnterpriseFormFieldKeys(
  definition: EnterpriseFormDefinition,
  answers: PublicFormAnswerMap,
) {
  const visible = visibleEnterpriseFormFieldKeys(definition, answers);
  const required = new Set<string>();

  for (const field of allFields(definition)) {
    if (field.required && visible.has(field.key)) required.add(field.key);
  }

  const rules = [...(definition.rules ?? [])]
    .filter((rule) => rule.enabled !== false && rule.kind === 'REQUIREMENT')
    .sort((a, b) => Number(a.priority ?? 0) - Number(b.priority ?? 0));

  for (const rule of rules) {
    if (!evaluateFormCondition(rule.condition, answers) || !isRecord(rule.effect)) continue;

    const requireKey = asString(rule.effect.require);
    const optionalKey = asString(rule.effect.optional);
    const requireFields = Array.isArray(rule.effect.requireFields)
      ? rule.effect.requireFields.map(asString).filter(Boolean)
      : [];
    const optionalFields = Array.isArray(rule.effect.optionalFields)
      ? rule.effect.optionalFields.map(asString).filter(Boolean)
      : [];

    if (requireKey && visible.has(requireKey)) required.add(requireKey);
    if (optionalKey) required.delete(optionalKey);
    for (const key of requireFields) if (visible.has(key)) required.add(key);
    for (const key of optionalFields) required.delete(key);
  }

  return required;
}

function emptyAnswer(value: unknown) {
  if (value === undefined || value === null || value === '') return true;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function validateScalarField(
  field: EnterpriseFormFieldDefinition,
  value: unknown,
): string | null {
  if (field.type === 'INFORMATION' || field.type === 'FILE_UPLOAD') return null;

  if (BOOLEAN_TYPES.has(field.type)) {
    return typeof value === 'boolean' ? null : 'boolean_required';
  }

  if (NUMBER_TYPES.has(field.type)) {
    return finiteNumber(value) == null ? 'number_required' : null;
  }

  if (ARRAY_TYPES.has(field.type)) {
    if (!Array.isArray(value)) return 'array_required';
  } else if (field.type === 'ADDRESS' || field.type === 'MATRIX' || field.type === 'REPEATER') {
    if (!isRecord(value) && !Array.isArray(value)) return 'structured_value_required';
  } else if (typeof value !== 'string') {
    return 'text_required';
  }

  if (field.type === 'EMAIL' && !EMAIL_PATTERN.test(asString(value))) return 'email_invalid';
  if (field.type === 'PHONE' && !PHONE_PATTERN.test(asString(value))) return 'phone_invalid';
  if (field.type === 'URL') {
    try {
      const url = new URL(asString(value));
      if (!['http:', 'https:'].includes(url.protocol)) return 'url_invalid';
    } catch {
      return 'url_invalid';
    }
  }
  if (field.type === 'DATE' && !DATE_PATTERN.test(asString(value))) return 'date_invalid';
  if (field.type === 'TIME' && !TIME_PATTERN.test(asString(value))) return 'time_invalid';
  if (field.type === 'DATETIME') {
    const parsed = new Date(asString(value));
    if (!Number.isFinite(parsed.getTime())) return 'datetime_invalid';
  }

  if (CHOICE_TYPES.has(field.type)) {
    const allowed = new Set((field.options ?? []).map((option) => option.value));
    const values = Array.isArray(value) ? value : [value];
    if (values.some((item) => typeof item !== 'string' || !allowed.has(item))) {
      return 'option_invalid';
    }
  }

  const validation = isRecord(field.validation) ? field.validation : {};
  const text = typeof value === 'string' ? value : null;
  const array = Array.isArray(value) ? value : null;
  const numeric = finiteNumber(value);

  const minLength = finiteNumber(validation.minLength);
  if (text != null && minLength != null && text.length < minLength) return 'min_length';
  const maxLength = finiteNumber(validation.maxLength);
  if (text != null && maxLength != null && text.length > maxLength) return 'max_length';

  const pattern = asString(validation.pattern);
  if (text != null && pattern) {
    const unsafePattern =
      pattern.length > 200 ||
      /\\[1-9]/.test(pattern) ||
      /\(\?[=!<]/.test(pattern) ||
      /[+*}\]]\s*[+*{]/.test(pattern) ||
      /\([^)]*[+*][^)]*\)\s*[+*{]/.test(pattern) ||
      /\([^)]*\{[^)]*\)\s*[+*{]/.test(pattern);
    if (unsafePattern) return 'validation_pattern_unsupported';

    try {
      if (!new RegExp(pattern).test(text)) return 'pattern_mismatch';
    } catch {
      return 'validation_pattern_invalid';
    }
  }

  const min = finiteNumber(validation.min);
  if (numeric != null && min != null && numeric < min) return 'min_value';
  const max = finiteNumber(validation.max);
  if (numeric != null && max != null && numeric > max) return 'max_value';

  const minItems = finiteNumber(validation.minItems);
  if (array && minItems != null && array.length < minItems) return 'min_items';
  const maxItems = finiteNumber(validation.maxItems);
  if (array && maxItems != null && array.length > maxItems) return 'max_items';

  return null;
}

function repeatableSectionFieldValueValid(
  section: EnterpriseFormSectionDefinition,
  field: EnterpriseFormFieldDefinition,
  value: unknown,
) {
  if (!section.repeatable) return validateScalarField(field, value);
  if (!Array.isArray(value)) return 'repeat_array_required';

  const minRepeats = section.minRepeats ?? 0;
  const maxRepeats = section.maxRepeats ?? 100;
  if (value.length < minRepeats) return 'min_repeats';
  if (value.length > maxRepeats) return 'max_repeats';

  for (const entry of value) {
    if (emptyAnswer(entry)) continue;
    const issue = validateScalarField(field, entry);
    if (issue) return issue;
  }
  return null;
}

export function validatePublicFormAnswers(input: {
  definition: EnterpriseFormDefinition;
  answers: PublicFormAnswerMap;
  mode: 'draft' | 'submit';
  availableFileFieldKeys?: Set<string>;
}) {
  const issues: PublicFormValidationIssue[] = [];
  const visible = visibleEnterpriseFormFieldKeys(input.definition, input.answers);
  const required = requiredEnterpriseFormFieldKeys(input.definition, input.answers);
  const known = new Set(allFields(input.definition).map((field) => field.key));

  for (const key of Object.keys(input.answers)) {
    if (!known.has(key)) issues.push({ fieldKey: key, code: 'field_unknown' });
  }

  for (const page of input.definition.pages ?? []) {
    for (const section of page.sections ?? []) {
      for (const field of section.fields ?? []) {
        if (!visible.has(field.key)) continue;

        const value = input.answers[field.key];
        const isRequired = input.mode === 'submit' && required.has(field.key);

        if (field.type === 'FILE_UPLOAD') {
          if (isRequired && !input.availableFileFieldKeys?.has(field.key)) {
            issues.push({ fieldKey: field.key, code: 'file_required' });
          }
          continue;
        }

        if (isRequired && field.type === 'CONSENT' && value !== true) {
          issues.push({ fieldKey: field.key, code: 'consent_required' });
          continue;
        }

        if (isRequired && emptyAnswer(value)) {
          issues.push({ fieldKey: field.key, code: 'required' });
          continue;
        }

        if (emptyAnswer(value)) continue;

        if (section.repeatable && Array.isArray(value) && isRequired) {
          for (let index = 0; index < value.length; index += 1) {
            if (emptyAnswer(value[index])) {
              issues.push({ fieldKey: field.key, code: 'required_repeat_value' });
              break;
            }
          }
        }

        const issue = repeatableSectionFieldValueValid(section, field, value);
        if (issue) issues.push({ fieldKey: field.key, code: issue });
      }
    }
  }

  return issues;
}

function calculationValue(expression: unknown, answers: PublicFormAnswerMap): unknown {
  if (!isRecord(expression)) return undefined;

  const op = asString(expression.op).toLowerCase();
  if (op === 'literal') return expression.value;
  if (op === 'copy') return answers[asString(expression.field)];

  const fields = Array.isArray(expression.fields)
    ? expression.fields.map(asString).filter(Boolean)
    : [];
  const values = fields
    .map((key) => finiteNumber(answers[key]))
    .filter((value): value is number => value != null);

  if (op === 'sum') return values.reduce((sum, value) => sum + value, 0);
  if (op === 'average') return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  if (op === 'min') return values.length ? Math.min(...values) : 0;
  if (op === 'max') return values.length ? Math.max(...values) : 0;
  if (op === 'count') return values.length;

  const left = finiteNumber(answers[asString(expression.left)] ?? expression.leftValue);
  const right = finiteNumber(answers[asString(expression.right)] ?? expression.rightValue);
  if (left == null || right == null) return undefined;

  if (op === 'subtract') return left - right;
  if (op === 'multiply') return left * right;
  if (op === 'divide') return right === 0 ? undefined : left / right;
  return undefined;
}

export function derivePublicFormValues(
  definition: EnterpriseFormDefinition,
  answers: PublicFormAnswerMap,
) {
  const calculations: Record<string, unknown> = {};
  let score = 0;

  for (const field of allFields(definition)) {
    if (field.calculation != null) {
      const value = calculationValue(field.calculation, { ...answers, ...calculations });
      if (value !== undefined) calculations[field.key] = value;
    }

    if (isRecord(field.scoring)) {
      const map = isRecord(field.scoring.pointsByValue) ? field.scoring.pointsByValue : null;
      const answer = answers[field.key];
      const weight = finiteNumber(field.scoring.weight) ?? 1;
      if (map) {
        const values = Array.isArray(answer) ? answer : [answer];
        for (const value of values) {
          const points = finiteNumber(map[String(value)]);
          if (points != null) score += points * weight;
        }
      }
    }
  }

  const calculationRules = [...(definition.rules ?? [])]
    .filter((rule) => rule.enabled !== false && rule.kind === 'CALCULATION')
    .sort((a, b) => Number(a.priority ?? 0) - Number(b.priority ?? 0));

  for (const rule of calculationRules) {
    if (!evaluateFormCondition(rule.condition, { ...answers, ...calculations })) continue;
    if (!isRecord(rule.effect)) continue;
    const target = asString(rule.effect.target);
    if (!target) continue;
    const value = calculationValue(rule.effect.expression, { ...answers, ...calculations });
    if (value !== undefined) calculations[target] = value;
  }

  const scoringRules = [...(definition.rules ?? [])]
    .filter((rule) => rule.enabled !== false && rule.kind === 'SCORING')
    .sort((a, b) => Number(a.priority ?? 0) - Number(b.priority ?? 0));

  for (const rule of scoringRules) {
    if (!evaluateFormCondition(rule.condition, { ...answers, ...calculations })) continue;
    if (!isRecord(rule.effect)) continue;
    const add = finiteNumber(rule.effect.add ?? rule.effect.points);
    if (add != null) score += add;
  }

  return { calculations, score };
}

export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (isRecord(value)) {
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

export function consentTextHash(field: EnterpriseFormFieldDefinition) {
  return createHash('sha256')
    .update(
      stableJson({
        key: field.key,
        label: field.label,
        helpText: field.helpText ?? null,
        config: field.config ?? null,
      }),
    )
    .digest('hex');
}

export function publicFormAntiSpamPolicy(value: unknown) {
  const policy = isRecord(value) ? value : {};
  const integer = (candidate: unknown, fallback: number, min: number, max: number) => {
    const parsed = finiteNumber(candidate);
    if (parsed == null) return fallback;
    return Math.max(min, Math.min(max, Math.round(parsed)));
  };

  return {
    windowSeconds: integer(policy.windowSeconds, 3600, 60, 86400),
    maxStarts: integer(policy.maxStarts, 20, 1, 500),
    maxSaves: integer(policy.maxSaves, 180, 10, 2000),
    maxSubmits: integer(policy.maxSubmits, 30, 1, 500),
    minSubmitSeconds: integer(policy.minSubmitSeconds, 3, 0, 3600),
    honeypotField: asString(policy.honeypotField) || '__website',
  };
}

const DEFAULT_UPLOAD_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/webp',
  'text/plain',
]);

export function publicFormUploadPolicy(field: EnterpriseFormFieldDefinition) {
  const config = isRecord(field.config) ? field.config : {};
  const maximum = 25 * 1024 * 1024;
  const configuredSize = finiteNumber(config.maxFileSizeBytes);
  const maxFileSizeBytes = Math.max(
    1024,
    Math.min(maximum, Math.round(configuredSize ?? 10 * 1024 * 1024)),
  );
  const maxFiles = Math.max(1, Math.min(10, Math.round(finiteNumber(config.maxFiles) ?? 5)));
  const configuredTypes = Array.isArray(config.allowedContentTypes)
    ? config.allowedContentTypes.map(asString).filter(Boolean)
    : [];

  return {
    maxFileSizeBytes,
    maxFiles,
    allowedContentTypes: configuredTypes.length
      ? new Set(configuredTypes)
      : DEFAULT_UPLOAD_TYPES,
  };
}

export function pageSequence(
  pages: EnterpriseFormPageDefinition[],
  rules: EnterpriseFormRuleDefinition[] | undefined,
  answers: PublicFormAnswerMap,
) {
  const ordered = [...pages].sort((a, b) => a.order - b.order);
  const hiddenPages = new Set<string>();

  for (const rule of [...(rules ?? [])]
    .filter((entry) => entry.enabled !== false && entry.kind === 'NAVIGATION')
    .sort((a, b) => Number(a.priority ?? 0) - Number(b.priority ?? 0))) {
    if (!evaluateFormCondition(rule.condition, answers) || !isRecord(rule.effect)) continue;
    const skip = asString(rule.effect.skipPage);
    if (skip) hiddenPages.add(skip);
    if (Array.isArray(rule.effect.skipPages)) {
      for (const value of rule.effect.skipPages) {
        const key = asString(value);
        if (key) hiddenPages.add(key);
      }
    }
  }

  return ordered.filter((page) => !hiddenPages.has(page.key));
}
