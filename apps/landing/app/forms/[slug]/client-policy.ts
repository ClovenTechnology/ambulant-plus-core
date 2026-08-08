import type {
  JsonRecord,
  PublicFormDefinition,
  PublicFormField,
  PublicFormPage,
  PublicFormRule,
  PublicFormTranslation,
} from './types';

export function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function finiteNumber(value: unknown) {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function compareValue(left: unknown, right: unknown) {
  if (Array.isArray(left)) return left.some((entry) => compareValue(entry, right));
  if (typeof left === 'number' || typeof right === 'number') {
    const l = finiteNumber(left);
    const r = finiteNumber(right);
    return l != null && r != null && l === r;
  }
  return String(left ?? '') === String(right ?? '');
}

export function evaluateCondition(
  condition: unknown,
  answers: Record<string, unknown>,
): boolean {
  if (!isRecord(condition)) return false;

  if (Array.isArray(condition.all)) {
    return condition.all.every((entry) => evaluateCondition(entry, answers));
  }
  if (Array.isArray(condition.any)) {
    return condition.any.some((entry) => evaluateCondition(entry, answers));
  }
  if (condition.not !== undefined) {
    return !evaluateCondition(condition.not, answers);
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

function allFields(form: PublicFormDefinition) {
  return form.version.pages.flatMap((page) =>
    page.sections.flatMap((section) => section.fields),
  );
}

export function visibleFieldKeys(
  form: PublicFormDefinition,
  answers: Record<string, unknown>,
) {
  const visible = new Set<string>();
  const hidden = new Set<string>();

  for (const field of allFields(form)) {
    if (field.visibilityLogic == null || evaluateCondition(field.visibilityLogic, answers)) {
      visible.add(field.key);
    }
  }

  const rules = [...(form.version.rules ?? [])]
    .filter((rule) => rule.enabled !== false && rule.kind === 'VISIBILITY')
    .sort((a, b) => Number(a.priority ?? 0) - Number(b.priority ?? 0));

  for (const rule of rules) {
    if (!evaluateCondition(rule.condition, answers) || !isRecord(rule.effect)) continue;
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

export function requiredFieldKeys(
  form: PublicFormDefinition,
  answers: Record<string, unknown>,
) {
  const visible = visibleFieldKeys(form, answers);
  const required = new Set<string>();

  for (const field of allFields(form)) {
    if (field.required && visible.has(field.key)) required.add(field.key);
  }

  const rules = [...(form.version.rules ?? [])]
    .filter((rule) => rule.enabled !== false && rule.kind === 'REQUIREMENT')
    .sort((a, b) => Number(a.priority ?? 0) - Number(b.priority ?? 0));

  for (const rule of rules) {
    if (!evaluateCondition(rule.condition, answers) || !isRecord(rule.effect)) continue;
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

export function publicPageSequence(
  form: PublicFormDefinition,
  answers: Record<string, unknown>,
) {
  const ordered = [...form.version.pages].sort((a, b) => a.order - b.order);
  const hidden = new Set<string>();

  for (const rule of [...(form.version.rules ?? [])]
    .filter((entry) => entry.enabled !== false && entry.kind === 'NAVIGATION')
    .sort((a, b) => Number(a.priority ?? 0) - Number(b.priority ?? 0))) {
    if (!evaluateCondition(rule.condition, answers) || !isRecord(rule.effect)) continue;
    const skip = asString(rule.effect.skipPage);
    if (skip) hidden.add(skip);
    if (Array.isArray(rule.effect.skipPages)) {
      for (const value of rule.effect.skipPages) {
        const key = asString(value);
        if (key) hidden.add(key);
      }
    }
  }

  return ordered.filter((page) => !hidden.has(page.key));
}

export function emptyAnswer(value: unknown) {
  if (value === undefined || value === null || value === '') return true;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

export function seedDefaultAnswers(form: PublicFormDefinition) {
  const answers: Record<string, unknown> = {};
  for (const page of form.version.pages) {
    for (const section of page.sections) {
      for (const field of section.fields) {
        if (field.defaultValue === undefined || field.defaultValue === null) continue;
        if (section.repeatable) {
          const repeats = Math.max(0, Number(section.minRepeats ?? 0));
          if (repeats > 0) answers[field.key] = Array(repeats).fill(field.defaultValue);
        } else {
          answers[field.key] = field.defaultValue;
        }
      }
    }
  }
  return answers;
}

export function translationText(input: {
  translations?: PublicFormTranslation[];
  locale: string;
  targetType: string;
  targetKey: string;
  property: string;
  fallback?: string | null;
}) {
  const locale = input.locale.toLowerCase();
  const base = locale.split('-')[0];
  const matches = (input.translations ?? []).filter(
    (entry) =>
      entry.targetType === input.targetType &&
      entry.targetKey === input.targetKey &&
      (entry.locale.toLowerCase() === locale || entry.locale.toLowerCase().split('-')[0] === base),
  );

  for (const entry of matches) {
    if (!isRecord(entry.values)) continue;
    const value = entry.values[input.property];
    if (typeof value === 'string' && value.trim()) return value;
  }

  return input.fallback || '';
}

export function fieldIssueMessage(code: string, label: string) {
  const messages: Record<string, string> = {
    required: `${label} is required.`,
    required_repeat_value: `${label} has an incomplete repeated entry.`,
    consent_required: `Please confirm ${label}.`,
    file_required: `Please upload the required file for ${label}.`,
    email_invalid: `Enter a valid email address for ${label}.`,
    phone_invalid: `Enter a valid phone number for ${label}.`,
    url_invalid: `Enter a valid web address for ${label}.`,
    number_required: `${label} must be a number.`,
    option_invalid: `Choose one of the available options for ${label}.`,
    min_length: `${label} is shorter than allowed.`,
    max_length: `${label} is longer than allowed.`,
    min_value: `${label} is below the allowed minimum.`,
    max_value: `${label} is above the allowed maximum.`,
    min_items: `Select more options for ${label}.`,
    max_items: `Too many options are selected for ${label}.`,
    min_repeats: `Add more entries for ${label}.`,
    max_repeats: `Too many entries were added for ${label}.`,
    structured_value_required: `${label} needs structured information.`,
    validation_pattern_unsupported: `${label} uses a validation rule that cannot be completed safely.`,
  };
  return messages[code] || `${label} needs attention.`;
}

export function pageContainsField(page: PublicFormPage, fieldKey: string) {
  return page.sections.some((section) =>
    section.fields.some((field) => field.key === fieldKey),
  );
}

export function fieldByKey(form: PublicFormDefinition, key: string): PublicFormField | undefined {
  return allFields(form).find((field) => field.key === key);
}

export function parseResumeFragment(hash: string) {
  const params = new URLSearchParams(String(hash || '').replace(/^#/, ''));
  const submissionId = String(params.get('submission') || '').trim();
  const token = String(params.get('token') || '').trim();
  if (!submissionId || !/^[A-Za-z0-9_-]{32,500}$/.test(token)) return null;
  return { submissionId, token };
}

export function normaliseOpportunityContextSlug(value: unknown) {
  const slug = String(value ?? '').trim().toLowerCase().slice(0, 160);
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ? slug : '';
}

export function formSessionStorageKey(slug: string, opportunitySlug?: unknown) {
  const formSlug = String(slug || '').trim().toLowerCase();
  const opportunity = normaliseOpportunityContextSlug(opportunitySlug);
  return opportunity
    ? `ambulant.enterprise-form.${formSlug}.opportunity.${opportunity}`
    : `ambulant.enterprise-form.${formSlug}`;
}
