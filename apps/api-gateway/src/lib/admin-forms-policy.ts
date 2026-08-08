export const ENTERPRISE_FORM_FIELD_TYPES = [
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
  'FILE_UPLOAD',
  'CONSENT',
  'URL',
  'ADDRESS',
  'COUNTRY',
  'RATING',
  'MATRIX',
  'REPEATER',
  'HIDDEN',
  'INFORMATION',
] as const;

export type EnterpriseFormFieldType = (typeof ENTERPRISE_FORM_FIELD_TYPES)[number];

export const ENTERPRISE_FORM_RULE_KINDS = [
  'VISIBILITY',
  'REQUIREMENT',
  'NAVIGATION',
  'CALCULATION',
  'SCORING',
] as const;

export type EnterpriseFormRuleKind = (typeof ENTERPRISE_FORM_RULE_KINDS)[number];

export const ENTERPRISE_FORM_TRANSLATION_TARGETS = [
  'FORM',
  'PAGE',
  'SECTION',
  'FIELD',
  'OPTION',
] as const;

export type EnterpriseFormTranslationTarget =
  (typeof ENTERPRISE_FORM_TRANSLATION_TARGETS)[number];

export const ENTERPRISE_FORM_ACCESS_MODES = [
  'PUBLIC',
  'AUTHENTICATED',
  'INVITE_ONLY',
  'INTERNAL',
] as const;

export type EnterpriseFormAccessMode = (typeof ENTERPRISE_FORM_ACCESS_MODES)[number];

export const ENTERPRISE_FORM_VERSION_STATES = [
  'DRAFT',
  'PUBLISHED',
  'RETIRED',
] as const;

export type EnterpriseFormVersionState =
  (typeof ENTERPRISE_FORM_VERSION_STATES)[number];

export type EnterpriseFormOptionDefinition = {
  key: string;
  label: string;
  value: string;
  order: number;
  metadata?: unknown;
};

export type EnterpriseFormFieldDefinition = {
  key: string;
  type: EnterpriseFormFieldType;
  label: string;
  helpText?: string | null;
  placeholder?: string | null;
  order: number;
  required?: boolean;
  sensitive?: boolean;
  defaultValue?: unknown;
  validation?: unknown;
  visibilityLogic?: unknown;
  calculation?: unknown;
  scoring?: unknown;
  config?: unknown;
  options?: EnterpriseFormOptionDefinition[];
};

export type EnterpriseFormSectionDefinition = {
  key: string;
  title: string;
  description?: string | null;
  order: number;
  repeatable?: boolean;
  minRepeats?: number | null;
  maxRepeats?: number | null;
  fields: EnterpriseFormFieldDefinition[];
};

export type EnterpriseFormPageDefinition = {
  key: string;
  title: string;
  description?: string | null;
  order: number;
  sections: EnterpriseFormSectionDefinition[];
};

export type EnterpriseFormRuleDefinition = {
  key: string;
  kind: EnterpriseFormRuleKind;
  priority?: number;
  enabled?: boolean;
  condition: unknown;
  effect: unknown;
};

export type EnterpriseFormTranslationDefinition = {
  locale: string;
  targetType: EnterpriseFormTranslationTarget;
  targetKey: string;
  values: unknown;
};

export type EnterpriseFormDefinition = {
  pages: EnterpriseFormPageDefinition[];
  rules?: EnterpriseFormRuleDefinition[];
  translations?: EnterpriseFormTranslationDefinition[];
};

export type FormDefinitionValidationMode = 'draft' | 'publish';

export type FormDefinitionIssue = {
  path: string;
  code: string;
};

const CHOICE_TYPES = new Set<EnterpriseFormFieldType>([
  'SINGLE_SELECT',
  'MULTI_SELECT',
  'RADIO',
  'CHECKBOX_GROUP',
]);

const KEY_PATTERN = /^[a-z][a-z0-9_-]{0,119}$/;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function cleanFormText(value: unknown, maxLength: number) {
  return String(value ?? '').trim().slice(0, maxLength);
}

export function normaliseFormKey(value: unknown) {
  return cleanFormText(value, 120)
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_-]+/g, '')
    .replace(/^[^a-z]+/, '');
}

export function normaliseFormSlug(value: unknown) {
  return cleanFormText(value, 160)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
}

export function validFormKey(value: unknown) {
  return KEY_PATTERN.test(cleanFormText(value, 120));
}

export function validFormSlug(value: unknown) {
  const slug = cleanFormText(value, 160);
  return slug.length > 0 && slug.length <= 160 && SLUG_PATTERN.test(slug);
}

export function validFormLocale(value: unknown) {
  const locale = cleanFormText(value, 20);
  if (!locale) return false;

  try {
    return new Intl.Locale(locale).toString().length > 0;
  } catch {
    return false;
  }
}

export function isEnterpriseFormFieldType(value: unknown): value is EnterpriseFormFieldType {
  return ENTERPRISE_FORM_FIELD_TYPES.includes(value as EnterpriseFormFieldType);
}

export function isEnterpriseFormRuleKind(value: unknown): value is EnterpriseFormRuleKind {
  return ENTERPRISE_FORM_RULE_KINDS.includes(value as EnterpriseFormRuleKind);
}

export function isEnterpriseFormTranslationTarget(
  value: unknown,
): value is EnterpriseFormTranslationTarget {
  return ENTERPRISE_FORM_TRANSLATION_TARGETS.includes(
    value as EnterpriseFormTranslationTarget,
  );
}

export function isEnterpriseFormAccessMode(value: unknown): value is EnterpriseFormAccessMode {
  return ENTERPRISE_FORM_ACCESS_MODES.includes(value as EnterpriseFormAccessMode);
}

export function canEditEnterpriseFormVersion(state: EnterpriseFormVersionState) {
  return state === 'DRAFT';
}

export function canPublishEnterpriseFormVersion(state: EnterpriseFormVersionState) {
  return state === 'DRAFT';
}

export function canRetireEnterpriseFormVersion(state: EnterpriseFormVersionState) {
  return state === 'PUBLISHED';
}

export function validSubmissionWindow(input: {
  acceptingFrom?: Date | null;
  acceptingUntil?: Date | null;
}) {
  if (
    input.acceptingFrom &&
    input.acceptingUntil &&
    input.acceptingUntil.getTime() <= input.acceptingFrom.getTime()
  ) {
    return false;
  }
  return true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function validOrder(value: unknown) {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 100000;
}

function addDuplicateIssues(
  values: string[],
  path: string,
  code: string,
  issues: FormDefinitionIssue[],
) {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      issues.push({ path, code });
      return;
    }
    seen.add(value);
  }
}

function validateJsonObject(
  value: unknown,
  path: string,
  code: string,
  issues: FormDefinitionIssue[],
) {
  if (value != null && !isRecord(value)) {
    issues.push({ path, code });
  }
}

export function validateEnterpriseFormDefinition(
  definition: EnterpriseFormDefinition,
  mode: FormDefinitionValidationMode,
): FormDefinitionIssue[] {
  const issues: FormDefinitionIssue[] = [];
  const pages = Array.isArray(definition?.pages) ? definition.pages : [];
  const rules = Array.isArray(definition?.rules) ? definition.rules : [];
  const translations = Array.isArray(definition?.translations)
    ? definition.translations
    : [];

  if (!Array.isArray(definition?.pages)) {
    issues.push({ path: 'pages', code: 'pages_array_required' });
  }
  if (definition?.rules != null && !Array.isArray(definition.rules)) {
    issues.push({ path: 'rules', code: 'rules_array_invalid' });
  }
  if (definition?.translations != null && !Array.isArray(definition.translations)) {
    issues.push({ path: 'translations', code: 'translations_array_invalid' });
  }

  if (pages.length > 100) {
    issues.push({ path: 'pages', code: 'too_many_pages' });
  }

  if (mode === 'publish' && pages.length === 0) {
    issues.push({ path: 'pages', code: 'page_required' });
  }

  addDuplicateIssues(
    pages.map((page) => String(page?.key ?? '')),
    'pages',
    'duplicate_page_key',
    issues,
  );
  addDuplicateIssues(
    pages.map((page) => String(page?.order ?? '')),
    'pages',
    'duplicate_page_order',
    issues,
  );

  const sectionKeys: string[] = [];
  const fieldKeys: string[] = [];
  let sectionCount = 0;
  let fieldCount = 0;

  pages.forEach((page, pageIndex) => {
    const pagePath = `pages[${pageIndex}]`;
    const pageKey = cleanFormText(page?.key, 120);
    const title = cleanFormText(page?.title, 240);

    if (!validFormKey(pageKey)) {
      issues.push({ path: `${pagePath}.key`, code: 'invalid_page_key' });
    }
    if (!title) {
      issues.push({ path: `${pagePath}.title`, code: 'page_title_required' });
    }
    if (!validOrder(page?.order)) {
      issues.push({ path: `${pagePath}.order`, code: 'invalid_page_order' });
    }

    const sections = Array.isArray(page?.sections) ? page.sections : [];
    sectionCount += sections.length;

    if (!Array.isArray(page?.sections)) {
      issues.push({ path: `${pagePath}.sections`, code: 'sections_array_required' });
    }
    if (mode === 'publish' && sections.length === 0) {
      issues.push({ path: `${pagePath}.sections`, code: 'section_required' });
    }

    addDuplicateIssues(
      sections.map((section) => String(section?.order ?? '')),
      `${pagePath}.sections`,
      'duplicate_section_order',
      issues,
    );

    sections.forEach((section, sectionIndex) => {
      const sectionPath = `${pagePath}.sections[${sectionIndex}]`;
      const sectionKey = cleanFormText(section?.key, 120);
      sectionKeys.push(sectionKey);

      if (!validFormKey(sectionKey)) {
        issues.push({ path: `${sectionPath}.key`, code: 'invalid_section_key' });
      }
      if (!cleanFormText(section?.title, 240)) {
        issues.push({ path: `${sectionPath}.title`, code: 'section_title_required' });
      }
      if (!validOrder(section?.order)) {
        issues.push({ path: `${sectionPath}.order`, code: 'invalid_section_order' });
      }

      const repeatable = section?.repeatable === true;
      const minRepeats = section?.minRepeats;
      const maxRepeats = section?.maxRepeats;

      if (repeatable) {
        if (minRepeats != null && (!Number.isInteger(minRepeats) || minRepeats < 0)) {
          issues.push({ path: `${sectionPath}.minRepeats`, code: 'invalid_min_repeats' });
        }
        if (maxRepeats != null && (!Number.isInteger(maxRepeats) || maxRepeats < 1)) {
          issues.push({ path: `${sectionPath}.maxRepeats`, code: 'invalid_max_repeats' });
        }
        if (
          Number.isInteger(minRepeats) &&
          Number.isInteger(maxRepeats) &&
          Number(maxRepeats) < Number(minRepeats)
        ) {
          issues.push({ path: sectionPath, code: 'repeat_range_invalid' });
        }
      } else if (minRepeats != null || maxRepeats != null) {
        issues.push({ path: sectionPath, code: 'repeat_limits_require_repeatable_section' });
      }

      const fields = Array.isArray(section?.fields) ? section.fields : [];
      fieldCount += fields.length;

      if (!Array.isArray(section?.fields)) {
        issues.push({ path: `${sectionPath}.fields`, code: 'fields_array_required' });
      }
      if (mode === 'publish' && fields.length === 0) {
        issues.push({ path: `${sectionPath}.fields`, code: 'field_required' });
      }

      addDuplicateIssues(
        fields.map((field) => String(field?.order ?? '')),
        `${sectionPath}.fields`,
        'duplicate_field_order',
        issues,
      );

      fields.forEach((field, fieldIndex) => {
        const fieldPath = `${sectionPath}.fields[${fieldIndex}]`;
        const fieldKey = cleanFormText(field?.key, 120);
        fieldKeys.push(fieldKey);

        if (!validFormKey(fieldKey)) {
          issues.push({ path: `${fieldPath}.key`, code: 'invalid_field_key' });
        }
        if (!isEnterpriseFormFieldType(field?.type)) {
          issues.push({ path: `${fieldPath}.type`, code: 'invalid_field_type' });
        }
        if (!cleanFormText(field?.label, 240) && field?.type !== 'HIDDEN') {
          issues.push({ path: `${fieldPath}.label`, code: 'field_label_required' });
        }
        if (!validOrder(field?.order)) {
          issues.push({ path: `${fieldPath}.order`, code: 'invalid_field_order' });
        }

        validateJsonObject(field?.validation, `${fieldPath}.validation`, 'invalid_validation', issues);
        validateJsonObject(
          field?.visibilityLogic,
          `${fieldPath}.visibilityLogic`,
          'invalid_visibility_logic',
          issues,
        );
        validateJsonObject(
          field?.calculation,
          `${fieldPath}.calculation`,
          'invalid_calculation',
          issues,
        );
        validateJsonObject(field?.scoring, `${fieldPath}.scoring`, 'invalid_scoring', issues);
        validateJsonObject(field?.config, `${fieldPath}.config`, 'invalid_config', issues);

        const options = Array.isArray(field?.options) ? field.options : [];
        if (field?.options != null && !Array.isArray(field.options)) {
          issues.push({ path: `${fieldPath}.options`, code: 'options_array_invalid' });
        }
        if (CHOICE_TYPES.has(field?.type) && options.length === 0 && mode === 'publish') {
          issues.push({ path: `${fieldPath}.options`, code: 'choice_option_required' });
        }

        addDuplicateIssues(
          options.map((option) => String(option?.key ?? '')),
          `${fieldPath}.options`,
          'duplicate_option_key',
          issues,
        );
        addDuplicateIssues(
          options.map((option) => String(option?.value ?? '')),
          `${fieldPath}.options`,
          'duplicate_option_value',
          issues,
        );
        addDuplicateIssues(
          options.map((option) => String(option?.order ?? '')),
          `${fieldPath}.options`,
          'duplicate_option_order',
          issues,
        );

        options.forEach((option, optionIndex) => {
          const optionPath = `${fieldPath}.options[${optionIndex}]`;
          if (!validFormKey(option?.key)) {
            issues.push({ path: `${optionPath}.key`, code: 'invalid_option_key' });
          }
          if (!cleanFormText(option?.label, 240)) {
            issues.push({ path: `${optionPath}.label`, code: 'option_label_required' });
          }
          if (!cleanFormText(option?.value, 240)) {
            issues.push({ path: `${optionPath}.value`, code: 'option_value_required' });
          }
          if (!validOrder(option?.order)) {
            issues.push({ path: `${optionPath}.order`, code: 'invalid_option_order' });
          }
          validateJsonObject(
            option?.metadata,
            `${optionPath}.metadata`,
            'invalid_option_metadata',
            issues,
          );
        });
      });
    });
  });

  if (sectionCount > 500) {
    issues.push({ path: 'pages', code: 'too_many_sections' });
  }
  if (fieldCount > 2000) {
    issues.push({ path: 'pages', code: 'too_many_fields' });
  }

  addDuplicateIssues(sectionKeys, 'pages', 'duplicate_section_key', issues);
  addDuplicateIssues(fieldKeys, 'pages', 'duplicate_field_key', issues);

  if (rules.length > 1000) {
    issues.push({ path: 'rules', code: 'too_many_rules' });
  }
  addDuplicateIssues(
    rules.map((rule) => String(rule?.key ?? '')),
    'rules',
    'duplicate_rule_key',
    issues,
  );

  rules.forEach((rule, index) => {
    const rulePath = `rules[${index}]`;
    if (!validFormKey(rule?.key)) {
      issues.push({ path: `${rulePath}.key`, code: 'invalid_rule_key' });
    }
    if (!isEnterpriseFormRuleKind(rule?.kind)) {
      issues.push({ path: `${rulePath}.kind`, code: 'invalid_rule_kind' });
    }
    if (rule?.priority != null && !Number.isInteger(rule.priority)) {
      issues.push({ path: `${rulePath}.priority`, code: 'invalid_rule_priority' });
    }
    if (!isRecord(rule?.condition)) {
      issues.push({ path: `${rulePath}.condition`, code: 'invalid_rule_condition' });
    }
    if (!isRecord(rule?.effect)) {
      issues.push({ path: `${rulePath}.effect`, code: 'invalid_rule_effect' });
    }
  });

  if (translations.length > 5000) {
    issues.push({ path: 'translations', code: 'too_many_translations' });
  }

  const translationKeys: string[] = [];
  translations.forEach((translation, index) => {
    const path = `translations[${index}]`;
    if (!validFormLocale(translation?.locale)) {
      issues.push({ path: `${path}.locale`, code: 'invalid_translation_locale' });
    }
    if (!isEnterpriseFormTranslationTarget(translation?.targetType)) {
      issues.push({ path: `${path}.targetType`, code: 'invalid_translation_target' });
    }
    if (!validFormKey(translation?.targetKey)) {
      issues.push({ path: `${path}.targetKey`, code: 'invalid_translation_target_key' });
    }
    if (!isRecord(translation?.values)) {
      issues.push({ path: `${path}.values`, code: 'invalid_translation_values' });
    }
    translationKeys.push(
      `${translation?.locale}|${translation?.targetType}|${translation?.targetKey}`,
    );
  });
  addDuplicateIssues(
    translationKeys,
    'translations',
    'duplicate_translation_target',
    issues,
  );

  return issues;
}
