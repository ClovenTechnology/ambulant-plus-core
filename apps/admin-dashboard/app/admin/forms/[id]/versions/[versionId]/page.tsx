'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Copy,
  Eye,
  Plus,
  RefreshCw,
  Save,
  Send,
  Trash2,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

const FIELD_TYPES = [
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

const FIELD_TYPE_LABELS: Record<string, string> = {
  SHORT_TEXT: 'Short text',
  LONG_TEXT: 'Long text',
  EMAIL: 'Email',
  PHONE: 'Phone',
  NUMBER: 'Number',
  CURRENCY: 'Currency',
  DATE: 'Date',
  DATETIME: 'Date & time',
  TIME: 'Time',
  BOOLEAN: 'Yes / No',
  SINGLE_SELECT: 'Dropdown',
  MULTI_SELECT: 'Multi-select',
  RADIO: 'Radio buttons',
  CHECKBOX: 'Checkbox',
  CHECKBOX_GROUP: 'Checkbox group',
  FILE_UPLOAD: 'File upload',
  CONSENT: 'Consent',
  URL: 'Website URL',
  ADDRESS: 'Address',
  COUNTRY: 'Country',
  RATING: 'Rating',
  MATRIX: 'Matrix',
  REPEATER: 'Repeating group',
  HIDDEN: 'Hidden field',
  INFORMATION: 'Information block',
};

type OptionDefinition = {
  key: string;
  label: string;
  value: string;
  order: number;
  metadata?: unknown;
};

type FieldDefinition = {
  key: string;
  type: string;
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
  options?: OptionDefinition[];
};

type SectionDefinition = {
  key: string;
  title: string;
  description?: string | null;
  order: number;
  repeatable?: boolean;
  minRepeats?: number | null;
  maxRepeats?: number | null;
  fields: FieldDefinition[];
};

type PageDefinition = {
  key: string;
  title: string;
  description?: string | null;
  order: number;
  sections: SectionDefinition[];
};

type Definition = {
  pages: PageDefinition[];
  rules: any[];
  translations: any[];
};

type VersionRecord = {
  id: string;
  formId: string;
  versionNumber: number;
  state: 'DRAFT' | 'PUBLISHED' | 'RETIRED';
  accessMode: 'PUBLIC' | 'AUTHENTICATED' | 'INVITE_ONLY' | 'INTERNAL';
  title: string;
  description?: string | null;
  locale: string;
  fallbackLocale?: string | null;
  submitLabel: string;
  allowSaveResume: boolean;
  acceptingFrom?: string | null;
  acceptingUntil?: string | null;
  retentionDays?: number | null;
  branding?: unknown;
  settings?: unknown;
  notificationRules?: unknown;
  antiSpamPolicy?: unknown;
  pages?: any[];
  rules?: any[];
  translations?: any[];
};

function safeKey(prefix: string) {
  const suffix =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 10)
      : Math.random().toString(36).slice(2, 12);
  return `${prefix}_${suffix}`;
}

function reorder<T extends { order: number }>(items: T[]) {
  return items.map((item, index) => ({ ...item, order: index }));
}

function fromVersion(version: VersionRecord): Definition {
  return {
    pages: (version.pages || []).map((page: any, pageIndex: number) => ({
      key: page.key,
      title: page.title,
      description: page.description || null,
      order: page.order ?? pageIndex,
      sections: (page.sections || []).map((section: any, sectionIndex: number) => ({
        key: section.key,
        title: section.title,
        description: section.description || null,
        order: section.order ?? sectionIndex,
        repeatable: Boolean(section.repeatable),
        minRepeats: section.minRepeats ?? null,
        maxRepeats: section.maxRepeats ?? null,
        fields: (section.fields || []).map((field: any, fieldIndex: number) => ({
          key: field.key,
          type: field.type,
          label: field.label,
          helpText: field.helpText || null,
          placeholder: field.placeholder || null,
          order: field.order ?? fieldIndex,
          required: Boolean(field.required),
          sensitive: Boolean(field.sensitive),
          defaultValue: field.defaultValue ?? null,
          validation: field.validation ?? null,
          visibilityLogic: field.visibilityLogic ?? null,
          calculation: field.calculation ?? null,
          scoring: field.scoring ?? null,
          config: field.config ?? null,
          options: (field.options || []).map((option: any, optionIndex: number) => ({
            key: option.key,
            label: option.label,
            value: option.value,
            order: option.order ?? optionIndex,
            metadata: option.metadata ?? null,
          })),
        })),
      })),
    })),
    rules: Array.isArray(version.rules) ? version.rules.map((rule: any) => ({
      key: rule.key,
      kind: rule.kind,
      priority: rule.priority,
      enabled: rule.enabled,
      condition: rule.condition,
      effect: rule.effect,
    })) : [],
    translations: Array.isArray(version.translations)
      ? version.translations.map((translation: any) => ({
          locale: translation.locale,
          targetType: translation.targetType,
          targetKey: translation.targetKey,
          values: translation.values,
        }))
      : [],
  };
}

function toDateTimeLocal(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function renderPreviewField(field: FieldDefinition) {
  const base = 'w-full rounded-xl border bg-white px-3 py-2 text-sm';

  if (field.type === 'LONG_TEXT') return <textarea disabled className={`${base} min-h-24`} placeholder={field.placeholder || ''} />;
  if (field.type === 'BOOLEAN' || field.type === 'CHECKBOX' || field.type === 'CONSENT') {
    return (
      <label className="flex items-start gap-2 text-sm text-slate-600">
        <input type="checkbox" disabled className="mt-1" />
        <span>{field.type === 'CONSENT' ? field.label : 'Yes'}</span>
      </label>
    );
  }
  if (['SINGLE_SELECT', 'RADIO', 'MULTI_SELECT', 'CHECKBOX_GROUP'].includes(field.type)) {
    return (
      <div className="space-y-2">
        {(field.options || []).map((option) => (
          <label key={option.key} className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type={field.type === 'MULTI_SELECT' || field.type === 'CHECKBOX_GROUP' ? 'checkbox' : 'radio'}
              disabled
            />
            {option.label}
          </label>
        ))}
      </div>
    );
  }
  if (field.type === 'INFORMATION') {
    return <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{field.helpText || field.label}</div>;
  }
  if (field.type === 'FILE_UPLOAD') return <input type="file" disabled className={base} />;

  const inputType =
    field.type === 'EMAIL' ? 'email'
      : field.type === 'NUMBER' || field.type === 'CURRENCY' || field.type === 'RATING' ? 'number'
      : field.type === 'DATE' ? 'date'
      : field.type === 'DATETIME' ? 'datetime-local'
      : field.type === 'TIME' ? 'time'
      : field.type === 'URL' ? 'url'
      : 'text';

  return <input type={inputType} disabled className={base} placeholder={field.placeholder || ''} />;
}

export default function EnterpriseFormVersionBuilderPage({
  params,
}: {
  params: { id: string; versionId: string };
}) {
  const [version, setVersion] = useState<VersionRecord | null>(null);
  const [definition, setDefinition] = useState<Definition>({ pages: [], rules: [], translations: [] });
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [accessMode, setAccessMode] = useState<VersionRecord['accessMode']>('PUBLIC');
  const [locale, setLocale] = useState('en');
  const [fallbackLocale, setFallbackLocale] = useState('');
  const [submitLabel, setSubmitLabel] = useState('Submit');
  const [allowSaveResume, setAllowSaveResume] = useState(true);
  const [acceptingFrom, setAcceptingFrom] = useState('');
  const [acceptingUntil, setAcceptingUntil] = useState('');
  const [retentionDays, setRetentionDays] = useState('');
  const [brandingText, setBrandingText] = useState('{}');
  const [settingsText, setSettingsText] = useState('{}');
  const [notificationText, setNotificationText] = useState('{}');
  const [antiSpamText, setAntiSpamText] = useState('{}');
  const [rulesText, setRulesText] = useState('[]');
  const [translationsText, setTranslationsText] = useState('[]');
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [preview, setPreview] = useState(true);

  const editable = version?.state === 'DRAFT';

  async function load() {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch(
        `/api/admin/forms/${encodeURIComponent(params.id)}/versions/${encodeURIComponent(params.versionId)}`,
        { cache: 'no-store' },
      );
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok || !json?.version) {
        throw new Error(json?.error || 'Unable to load enterprise form version');
      }

      const next = json.version as VersionRecord;
      setVersion(next);
      const nextDefinition = fromVersion(next);
      setDefinition(nextDefinition);
      setTitle(next.title || '');
      setDescription(next.description || '');
      setAccessMode(next.accessMode || 'PUBLIC');
      setLocale(next.locale || 'en');
      setFallbackLocale(next.fallbackLocale || '');
      setSubmitLabel(next.submitLabel || 'Submit');
      setAllowSaveResume(Boolean(next.allowSaveResume));
      setAcceptingFrom(toDateTimeLocal(next.acceptingFrom));
      setAcceptingUntil(toDateTimeLocal(next.acceptingUntil));
      setRetentionDays(next.retentionDays == null ? '' : String(next.retentionDays));
      setBrandingText(JSON.stringify(next.branding ?? {}, null, 2));
      setSettingsText(JSON.stringify(next.settings ?? {}, null, 2));
      setNotificationText(JSON.stringify(next.notificationRules ?? {}, null, 2));
      setAntiSpamText(JSON.stringify(next.antiSpamPolicy ?? {}, null, 2));
      setRulesText(JSON.stringify(nextDefinition.rules, null, 2));
      setTranslationsText(JSON.stringify(nextDefinition.translations, null, 2));
      setDirty(false);
      setSettingsDirty(false);
    } catch (err: any) {
      setError(err?.message || 'Unable to load enterprise form version');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
  }, [params.id, params.versionId]);

  function mark(next: Definition) {
    setDefinition(next);
    setRulesText(JSON.stringify(next.rules || [], null, 2));
    setTranslationsText(JSON.stringify(next.translations || [], null, 2));
    setDirty(true);
  }

  function markSetting<T>(setter: (value: T) => void, value: T) {
    setter(value);
    setSettingsDirty(true);
  }

  function addPage() {
    const page: PageDefinition = {
      key: safeKey('page'),
      title: `Page ${definition.pages.length + 1}`,
      description: null,
      order: definition.pages.length,
      sections: [],
    };
    mark({ ...definition, pages: [...definition.pages, page] });
  }

  function updatePage(pageIndex: number, patch: Partial<PageDefinition>) {
    const pages = definition.pages.map((page, index) =>
      index === pageIndex ? { ...page, ...patch } : page,
    );
    mark({ ...definition, pages });
  }

  function removePage(pageIndex: number) {
    if (!window.confirm('Delete this page and every section/field inside it from the current draft?')) return;
    mark({
      ...definition,
      pages: reorder(definition.pages.filter((_, index) => index !== pageIndex)),
    });
  }

  function movePage(pageIndex: number, direction: -1 | 1) {
    const target = pageIndex + direction;
    if (target < 0 || target >= definition.pages.length) return;
    const pages = [...definition.pages];
    [pages[pageIndex], pages[target]] = [pages[target], pages[pageIndex]];
    mark({ ...definition, pages: reorder(pages) });
  }

  function duplicatePage(pageIndex: number) {
    const source = definition.pages[pageIndex];
    if (!source) return;
    const duplicate: PageDefinition = {
      ...source,
      key: safeKey('page'),
      title: `${source.title} copy`,
      order: pageIndex + 1,
      sections: source.sections.map((section, sectionIndex) => ({
        ...section,
        key: safeKey('section'),
        order: sectionIndex,
        fields: section.fields.map((field, fieldIndex) => ({
          ...field,
          key: safeKey('field'),
          order: fieldIndex,
          options: (field.options || []).map((option, optionIndex) => ({
            ...option,
            key: safeKey('option'),
            order: optionIndex,
          })),
        })),
      })),
    };
    const pages = [...definition.pages];
    pages.splice(pageIndex + 1, 0, duplicate);
    mark({ ...definition, pages: reorder(pages) });
  }

  function addSection(pageIndex: number) {
    const pages = definition.pages.map((page, index) => {
      if (index !== pageIndex) return page;
      const section: SectionDefinition = {
        key: safeKey('section'),
        title: `Section ${page.sections.length + 1}`,
        description: null,
        order: page.sections.length,
        repeatable: false,
        minRepeats: null,
        maxRepeats: null,
        fields: [],
      };
      return { ...page, sections: [...page.sections, section] };
    });
    mark({ ...definition, pages });
  }

  function updateSection(pageIndex: number, sectionIndex: number, patch: Partial<SectionDefinition>) {
    const pages = definition.pages.map((page, pIndex) => {
      if (pIndex !== pageIndex) return page;
      return {
        ...page,
        sections: page.sections.map((section, sIndex) =>
          sIndex === sectionIndex ? { ...section, ...patch } : section,
        ),
      };
    });
    mark({ ...definition, pages });
  }

  function removeSection(pageIndex: number, sectionIndex: number) {
    if (!window.confirm('Delete this section and all fields inside it from the current draft?')) return;
    const pages = definition.pages.map((page, pIndex) => {
      if (pIndex !== pageIndex) return page;
      return {
        ...page,
        sections: reorder(page.sections.filter((_, index) => index !== sectionIndex)),
      };
    });
    mark({ ...definition, pages });
  }

  function moveSection(pageIndex: number, sectionIndex: number, direction: -1 | 1) {
    const page = definition.pages[pageIndex];
    const target = sectionIndex + direction;
    if (!page || target < 0 || target >= page.sections.length) return;
    const sections = [...page.sections];
    [sections[sectionIndex], sections[target]] = [sections[target], sections[sectionIndex]];
    const pages = definition.pages.map((item, index) =>
      index === pageIndex ? { ...item, sections: reorder(sections) } : item,
    );
    mark({ ...definition, pages });
  }

  function duplicateSection(pageIndex: number, sectionIndex: number) {
    const page = definition.pages[pageIndex];
    const source = page?.sections[sectionIndex];
    if (!page || !source) return;
    const duplicate: SectionDefinition = {
      ...source,
      key: safeKey('section'),
      title: `${source.title} copy`,
      order: sectionIndex + 1,
      fields: source.fields.map((field, fieldIndex) => ({
        ...field,
        key: safeKey('field'),
        order: fieldIndex,
        options: (field.options || []).map((option, optionIndex) => ({
          ...option,
          key: safeKey('option'),
          order: optionIndex,
        })),
      })),
    };
    const sections = [...page.sections];
    sections.splice(sectionIndex + 1, 0, duplicate);
    const pages = definition.pages.map((item, index) =>
      index === pageIndex ? { ...item, sections: reorder(sections) } : item,
    );
    mark({ ...definition, pages });
  }

  function addField(pageIndex: number, sectionIndex: number) {
    const pages = definition.pages.map((page, pIndex) => {
      if (pIndex !== pageIndex) return page;
      return {
        ...page,
        sections: page.sections.map((section, sIndex) => {
          if (sIndex !== sectionIndex) return section;
          const field: FieldDefinition = {
            key: safeKey('field'),
            type: 'SHORT_TEXT',
            label: `Question ${section.fields.length + 1}`,
            helpText: null,
            placeholder: null,
            order: section.fields.length,
            required: false,
            sensitive: false,
            defaultValue: null,
            validation: null,
            visibilityLogic: null,
            calculation: null,
            scoring: null,
            config: null,
            options: [],
          };
          return { ...section, fields: [...section.fields, field] };
        }),
      };
    });
    mark({ ...definition, pages });
  }

  function updateField(
    pageIndex: number,
    sectionIndex: number,
    fieldIndex: number,
    patch: Partial<FieldDefinition>,
  ) {
    const pages = definition.pages.map((page, pIndex) => {
      if (pIndex !== pageIndex) return page;
      return {
        ...page,
        sections: page.sections.map((section, sIndex) => {
          if (sIndex !== sectionIndex) return section;
          return {
            ...section,
            fields: section.fields.map((field, fIndex) =>
              fIndex === fieldIndex ? { ...field, ...patch } : field,
            ),
          };
        }),
      };
    });
    mark({ ...definition, pages });
  }

  function removeField(pageIndex: number, sectionIndex: number, fieldIndex: number) {
    const pages = definition.pages.map((page, pIndex) => {
      if (pIndex !== pageIndex) return page;
      return {
        ...page,
        sections: page.sections.map((section, sIndex) => {
          if (sIndex !== sectionIndex) return section;
          return {
            ...section,
            fields: reorder(section.fields.filter((_, index) => index !== fieldIndex)),
          };
        }),
      };
    });
    mark({ ...definition, pages });
  }

  function moveField(pageIndex: number, sectionIndex: number, fieldIndex: number, direction: -1 | 1) {
    const section = definition.pages[pageIndex]?.sections[sectionIndex];
    const target = fieldIndex + direction;
    if (!section || target < 0 || target >= section.fields.length) return;
    const fields = [...section.fields];
    [fields[fieldIndex], fields[target]] = [fields[target], fields[fieldIndex]];
    const pages = definition.pages.map((page, pIndex) => {
      if (pIndex !== pageIndex) return page;
      return {
        ...page,
        sections: page.sections.map((item, sIndex) =>
          sIndex === sectionIndex ? { ...item, fields: reorder(fields) } : item,
        ),
      };
    });
    mark({ ...definition, pages });
  }

  function duplicateField(pageIndex: number, sectionIndex: number, fieldIndex: number) {
    const section = definition.pages[pageIndex]?.sections[sectionIndex];
    const source = section?.fields[fieldIndex];
    if (!section || !source) return;
    const duplicate: FieldDefinition = {
      ...source,
      key: safeKey('field'),
      label: `${source.label} copy`,
      order: fieldIndex + 1,
      options: (source.options || []).map((option, optionIndex) => ({
        ...option,
        key: safeKey('option'),
        order: optionIndex,
      })),
    };
    const fields = [...section.fields];
    fields.splice(fieldIndex + 1, 0, duplicate);
    const pages = definition.pages.map((page, pIndex) => {
      if (pIndex !== pageIndex) return page;
      return {
        ...page,
        sections: page.sections.map((item, sIndex) =>
          sIndex === sectionIndex ? { ...item, fields: reorder(fields) } : item,
        ),
      };
    });
    mark({ ...definition, pages });
  }

  function editFieldAdvanced(pageIndex: number, sectionIndex: number, fieldIndex: number) {
    const field = definition.pages[pageIndex]?.sections[sectionIndex]?.fields[fieldIndex];
    if (!field || !editable) return;

    const current = JSON.stringify(
      {
        defaultValue: field.defaultValue ?? null,
        validation: field.validation ?? null,
        visibilityLogic: field.visibilityLogic ?? null,
        calculation: field.calculation ?? null,
        scoring: field.scoring ?? null,
        config: field.config ?? null,
      },
      null,
      2,
    );

    const entered = window.prompt(
      'Advanced field JSON. Keys: defaultValue, validation, visibilityLogic, calculation, scoring, config.',
      current,
    );

    if (entered == null) return;

    try {
      const parsed = JSON.parse(entered);
      if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
        throw new Error('Advanced field JSON must be an object');
      }

      updateField(pageIndex, sectionIndex, fieldIndex, {
        defaultValue: Object.prototype.hasOwnProperty.call(parsed, 'defaultValue')
          ? parsed.defaultValue
          : field.defaultValue,
        validation: Object.prototype.hasOwnProperty.call(parsed, 'validation')
          ? parsed.validation
          : field.validation,
        visibilityLogic: Object.prototype.hasOwnProperty.call(parsed, 'visibilityLogic')
          ? parsed.visibilityLogic
          : field.visibilityLogic,
        calculation: Object.prototype.hasOwnProperty.call(parsed, 'calculation')
          ? parsed.calculation
          : field.calculation,
        scoring: Object.prototype.hasOwnProperty.call(parsed, 'scoring')
          ? parsed.scoring
          : field.scoring,
        config: Object.prototype.hasOwnProperty.call(parsed, 'config')
          ? parsed.config
          : field.config,
      });
    } catch (err: any) {
      setError(err?.message || 'Advanced field JSON is invalid');
    }
  }

  function addOption(pageIndex: number, sectionIndex: number, fieldIndex: number) {
    const field = definition.pages[pageIndex]?.sections[sectionIndex]?.fields[fieldIndex];
    if (!field) return;
    const option: OptionDefinition = {
      key: safeKey('option'),
      label: `Option ${(field.options || []).length + 1}`,
      value: `option_${(field.options || []).length + 1}`,
      order: (field.options || []).length,
      metadata: null,
    };
    updateField(pageIndex, sectionIndex, fieldIndex, {
      options: [...(field.options || []), option],
    });
  }

  function updateOption(
    pageIndex: number,
    sectionIndex: number,
    fieldIndex: number,
    optionIndex: number,
    patch: Partial<OptionDefinition>,
  ) {
    const field = definition.pages[pageIndex]?.sections[sectionIndex]?.fields[fieldIndex];
    if (!field) return;
    updateField(pageIndex, sectionIndex, fieldIndex, {
      options: (field.options || []).map((option, index) =>
        index === optionIndex ? { ...option, ...patch } : option,
      ),
    });
  }

  function removeOption(
    pageIndex: number,
    sectionIndex: number,
    fieldIndex: number,
    optionIndex: number,
  ) {
    const field = definition.pages[pageIndex]?.sections[sectionIndex]?.fields[fieldIndex];
    if (!field) return;
    updateField(pageIndex, sectionIndex, fieldIndex, {
      options: reorder((field.options || []).filter((_, index) => index !== optionIndex)),
    });
  }

  function addSimpleRule(kind: 'VISIBILITY' | 'REQUIREMENT') {
    const firstField = definition.pages.flatMap((page) => page.sections).flatMap((section) => section.fields)[0];
    if (!firstField) {
      setError('Add at least one field before creating form logic.');
      return;
    }
    const rule = {
      key: safeKey('rule'),
      kind,
      priority: definition.rules.length,
      enabled: true,
      condition: { field: firstField.key, exists: true },
      effect: kind === 'VISIBILITY' ? { showFields: [firstField.key] } : { requireFields: [firstField.key] },
    };
    mark({ ...definition, rules: [...definition.rules, rule] });
  }

  function removeRule(ruleIndex: number) {
    mark({ ...definition, rules: definition.rules.filter((_, index) => index !== ruleIndex) });
  }

  function updateSimpleRule(ruleIndex: number, patch: {
    kind?: 'VISIBILITY' | 'REQUIREMENT';
    conditionField?: string;
    operator?: 'exists' | 'truthy' | 'equals' | 'notEquals';
    conditionValue?: string;
    action?: 'show' | 'hide' | 'require' | 'optional';
    targetField?: string;
    enabled?: boolean;
  }) {
    const rules = definition.rules.map((rule: any, index) => {
      if (index !== ruleIndex) return rule;
      const kind = patch.kind || rule.kind || 'VISIBILITY';
      const conditionField = patch.conditionField || rule.condition?.field || '';
      const operator = patch.operator || (
        Object.prototype.hasOwnProperty.call(rule.condition || {}, 'equals') ? 'equals'
          : Object.prototype.hasOwnProperty.call(rule.condition || {}, 'notEquals') ? 'notEquals'
          : Object.prototype.hasOwnProperty.call(rule.condition || {}, 'truthy') ? 'truthy'
          : 'exists'
      );
      const previousValue = rule.condition?.[operator];
      const conditionValue = patch.conditionValue !== undefined ? patch.conditionValue : String(previousValue ?? '');
      const condition: any = { field: conditionField };
      if (operator === 'exists' || operator === 'truthy') condition[operator] = true;
      else condition[operator] = conditionValue;

      const existingAction = rule.effect?.showFields ? 'show'
        : rule.effect?.hideFields ? 'hide'
        : rule.effect?.requireFields ? 'require'
        : rule.effect?.optionalFields ? 'optional'
        : kind === 'REQUIREMENT' ? 'require' : 'show';
      const kindChanged = patch.kind !== undefined && patch.kind !== rule.kind;
      const action = patch.action
        || (kindChanged ? (kind === 'REQUIREMENT' ? 'require' : 'show') : existingAction);
      const previousTarget = rule.effect?.showFields?.[0] || rule.effect?.hideFields?.[0]
        || rule.effect?.requireFields?.[0] || rule.effect?.optionalFields?.[0] || conditionField;
      const targetField = patch.targetField || previousTarget;
      const effect = action === 'show' ? { showFields: [targetField] }
        : action === 'hide' ? { hideFields: [targetField] }
        : action === 'require' ? { requireFields: [targetField] }
        : { optionalFields: [targetField] };

      return {
        ...rule,
        kind,
        enabled: patch.enabled ?? rule.enabled ?? true,
        condition,
        effect,
      };
    });
    mark({ ...definition, rules });
  }

  function addTranslation() {
    const firstPage = definition.pages[0];
    if (!firstPage) {
      setError('Add a page before creating a translation.');
      return;
    }
    mark({
      ...definition,
      translations: [
        ...definition.translations,
        { locale: locale === 'en' ? 'fr' : 'en', targetType: 'PAGE', targetKey: firstPage.key, values: { title: firstPage.title } },
      ],
    });
  }

  function updateTranslation(index: number, patch: Record<string, unknown>) {
    const translations = definition.translations.map((translation: any, translationIndex) =>
      translationIndex === index ? { ...translation, ...patch } : translation,
    );
    mark({ ...definition, translations });
  }

  function removeTranslation(index: number) {
    mark({ ...definition, translations: definition.translations.filter((_, translationIndex) => translationIndex !== index) });
  }

  function parseObject(text: string, label: string) {
    const parsed = JSON.parse(text || '{}');
    if (parsed == null || Array.isArray(parsed) || typeof parsed !== 'object') {
      throw new Error(`${label} must be a JSON object`);
    }
    return parsed;
  }

  function parseArray(text: string, label: string) {
    const parsed = JSON.parse(text || '[]');
    if (!Array.isArray(parsed)) throw new Error(`${label} must be a JSON array`);
    return parsed;
  }

  async function saveMetadata(event?: FormEvent) {
    event?.preventDefault();
    if (!editable) return;
    setBusy(true);
    setError('');
    setNotice('');

    try {
      const branding = parseObject(brandingText, 'Branding');
      const settings = parseObject(settingsText, 'Settings');
      const notificationRules = parseObject(notificationText, 'Notification rules');
      const antiSpamPolicy = parseObject(antiSpamText, 'Anti-spam policy');

      const response = await fetch(
        `/api/admin/forms/${encodeURIComponent(params.id)}/versions/${encodeURIComponent(params.versionId)}`,
        {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            title,
            description,
            accessMode,
            locale,
            fallbackLocale: fallbackLocale || null,
            submitLabel,
            allowSaveResume,
            acceptingFrom: acceptingFrom ? new Date(acceptingFrom).toISOString() : null,
            acceptingUntil: acceptingUntil ? new Date(acceptingUntil).toISOString() : null,
            retentionDays: retentionDays ? Number(retentionDays) : null,
            branding,
            settings,
            notificationRules,
            antiSpamPolicy,
          }),
        },
      );

      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || 'Unable to save version settings');
      }
      setSettingsDirty(false);
      setNotice('Version settings saved.');
    } catch (err: any) {
      setError(err?.message || 'Unable to save version settings');
    } finally {
      setBusy(false);
    }
  }

  async function saveStructure() {
    if (!editable) return;
    setBusy(true);
    setError('');
    setNotice('');

    try {
      const rules = parseArray(rulesText, 'Rules');
      const translations = parseArray(translationsText, 'Translations');
      const next = { ...definition, rules, translations };

      const response = await fetch(
        `/api/admin/forms/${encodeURIComponent(params.id)}/versions/${encodeURIComponent(params.versionId)}/structure`,
        {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ definition: next }),
        },
      );

      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) {
        const detail = Array.isArray(json?.issues)
          ? `: ${json.issues.map((issue: any) => `${issue.path} ${issue.code}`).join('; ')}`
          : '';
        throw new Error((json?.error || 'Unable to save form structure') + detail);
      }

      setDefinition(next);
      setDirty(false);
      await load();
      setNotice('Changes saved.');
    } catch (err: any) {
      setError(err?.message || 'Unable to save form structure');
      setBusy(false);
    }
  }

  async function publish() {
    if (!editable) return;
    if (dirty || settingsDirty) {
      setError('Save both version settings and draft structure before publishing.');
      return;
    }
    if (!window.confirm('Publishing locks this version for live use. Future changes can be made in a new draft without changing existing submissions. Continue?')) return;

    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch(
        `/api/admin/forms/${encodeURIComponent(params.id)}/versions/${encodeURIComponent(params.versionId)}/publish`,
        { method: 'POST' },
      );
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) {
        const detail = Array.isArray(json?.issues)
          ? `: ${json.issues.map((issue: any) => `${issue.path} ${issue.code}`).join('; ')}`
          : '';
        throw new Error((json?.error || 'Unable to publish form version') + detail);
      }
      await load();
      setNotice('Version published.');
    } catch (err: any) {
      setError(err?.message || 'Unable to publish form version');
      setBusy(false);
    }
  }

  async function retire() {
    if (version?.state !== 'PUBLISHED') return;
    if (!window.confirm('Retire this published version? New submissions will no longer target it.')) return;

    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch(
        `/api/admin/forms/${encodeURIComponent(params.id)}/versions/${encodeURIComponent(params.versionId)}/retire`,
        { method: 'POST' },
      );
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || 'Unable to retire form version');
      }
      await load();
      setNotice('Version retired.');
    } catch (err: any) {
      setError(err?.message || 'Unable to retire form version');
      setBusy(false);
    }
  }

  const counts = useMemo(() => {
    let sections = 0;
    let fields = 0;
    for (const page of definition.pages) {
      sections += page.sections.length;
      for (const section of page.sections) fields += section.fields.length;
    }
    return { pages: definition.pages.length, sections, fields };
  }, [definition]);

  const fieldOptions = useMemo(() =>
    definition.pages.flatMap((page) =>
      page.sections.flatMap((section) =>
        section.fields.map((field) => ({ key: field.key, label: field.label || field.key })),
      ),
    ), [definition.pages]);

  const translationTargets = useMemo(() => {
    const targets: Array<{ type: string; key: string; label: string; properties: string[] }> = [];
    for (const page of definition.pages) {
      targets.push({ type: 'PAGE', key: page.key, label: `Page · ${page.title}`, properties: ['title', 'description'] });
      for (const section of page.sections) {
        targets.push({ type: 'SECTION', key: section.key, label: `Section · ${section.title}`, properties: ['title', 'description'] });
        for (const field of section.fields) {
          targets.push({ type: 'FIELD', key: field.key, label: `Field · ${field.label}`, properties: ['label', 'helpText', 'placeholder'] });
          for (const option of field.options || []) {
            targets.push({ type: 'OPTION', key: option.key, label: `Option · ${option.label}`, properties: ['label'] });
          }
        }
      }
    }
    return targets;
  }, [definition.pages]);

  return (
    <main className="space-y-6 p-4 lg:p-6">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <Link
            href={`/admin/forms/${encodeURIComponent(params.id)}`}
            className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Form versions
          </Link>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
            {title || 'Form builder'}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            v{version?.versionNumber || '—'} · {version?.state || 'Loading'} · {counts.pages} pages · {counts.sections} sections · {counts.fields} fields
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setPreview((value) => !value)}
            className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm"
          >
            <Eye className="h-4 w-4" />
            {preview ? 'Hide preview' : 'Show preview'}
          </button>
          <button
            type="button"
            onClick={load}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm"
          >
            <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </header>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {notice ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          {notice}
        </div>
      ) : null}

      {!editable && version ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          This version is {version.state}. Published and retired versions are locked; create a new draft to make further changes.
        </div>
      ) : null}

      <section className="grid gap-5 2xl:grid-cols-[1.25fr_0.75fr]">
        <div className="space-y-5">
          <form onSubmit={saveMetadata} className="space-y-4 rounded-3xl border bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Version settings</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Access, submission window, retention, branding, notifications and anti-spam policy.
                </p>
              </div>
              {editable ? (
                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold"
                >
                  <Save className="h-4 w-4" />
                  Save settings
                </button>
              ) : null}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="font-medium">Title</span>
                <input value={title} onChange={(e) => markSetting(setTitle, e.target.value)} disabled={!editable} className="w-full rounded-xl border px-3 py-2 disabled:bg-slate-50" />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Access mode</span>
                <select value={accessMode} onChange={(e) => markSetting(setAccessMode, e.target.value as VersionRecord['accessMode'])} disabled={!editable} className="w-full rounded-xl border px-3 py-2 disabled:bg-slate-50">
                  <option value="PUBLIC">Public</option>
                  <option value="AUTHENTICATED">Authenticated</option>
                  <option value="INVITE_ONLY">Invite only</option>
                  <option value="INTERNAL">Internal</option>
                </select>
              </label>
            </div>

            <label className="block space-y-1 text-sm">
              <span className="font-medium">Description</span>
              <textarea value={description} onChange={(e) => markSetting(setDescription, e.target.value)} disabled={!editable} className="min-h-24 w-full rounded-xl border p-3 disabled:bg-slate-50" />
            </label>

            <div className="grid gap-3 md:grid-cols-3">
              <label className="space-y-1 text-sm">
                <span className="font-medium">Locale</span>
                <input value={locale} onChange={(e) => markSetting(setLocale, e.target.value)} disabled={!editable} className="w-full rounded-xl border px-3 py-2 disabled:bg-slate-50" />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Fallback locale</span>
                <input value={fallbackLocale} onChange={(e) => markSetting(setFallbackLocale, e.target.value)} disabled={!editable} className="w-full rounded-xl border px-3 py-2 disabled:bg-slate-50" />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Submit label</span>
                <input value={submitLabel} onChange={(e) => markSetting(setSubmitLabel, e.target.value)} disabled={!editable} className="w-full rounded-xl border px-3 py-2 disabled:bg-slate-50" />
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <label className="space-y-1 text-sm">
                <span className="font-medium">Accept from</span>
                <input type="datetime-local" value={acceptingFrom} onChange={(e) => markSetting(setAcceptingFrom, e.target.value)} disabled={!editable} className="w-full rounded-xl border px-3 py-2 disabled:bg-slate-50" />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Accept until</span>
                <input type="datetime-local" value={acceptingUntil} onChange={(e) => markSetting(setAcceptingUntil, e.target.value)} disabled={!editable} className="w-full rounded-xl border px-3 py-2 disabled:bg-slate-50" />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Retention days</span>
                <input type="number" min={1} max={3650} value={retentionDays} onChange={(e) => markSetting(setRetentionDays, e.target.value)} disabled={!editable} className="w-full rounded-xl border px-3 py-2 disabled:bg-slate-50" />
              </label>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={allowSaveResume} onChange={(e) => markSetting(setAllowSaveResume, e.target.checked)} disabled={!editable} />
              Allow save and resume
            </label>

            <details className="rounded-2xl border p-4">
              <summary className="cursor-pointer text-sm font-semibold">Advanced JSON settings</summary>
              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                {[
                  ['Branding', brandingText, setBrandingText],
                  ['Settings', settingsText, setSettingsText],
                  ['Notification rules', notificationText, setNotificationText],
                  ['Anti-spam policy', antiSpamText, setAntiSpamText],
                ].map(([label, value, setter]) => (
                  <label key={String(label)} className="space-y-1 text-sm">
                    <span className="font-medium">{String(label)}</span>
                    <textarea
                      value={String(value)}
                      onChange={(event) => {
                        (setter as (value: string) => void)(event.target.value);
                        setSettingsDirty(true);
                      }}
                      disabled={!editable}
                      spellCheck={false}
                      className="min-h-40 w-full rounded-xl border p-3 font-mono text-xs disabled:bg-slate-50"
                    />
                  </label>
                ))}
              </div>
            </details>
          </form>

          <section className="space-y-4 rounded-3xl border bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Form structure</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Pages, sections, fields and options. Ordering is explicit and persisted.
                </p>
              </div>
              {editable ? (
                <div className="flex gap-2">
                  <button type="button" onClick={addPage} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm">
                    <Plus className="h-4 w-4" />
                    Add page
                  </button>
                  <button
                    type="button"
                    onClick={saveStructure}
                    disabled={busy}
                    className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    <Save className="h-4 w-4" />
                    Save structure{dirty ? ' *' : ''}
                  </button>
                </div>
              ) : null}
            </div>

            {definition.pages.length === 0 ? (
              <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-slate-500">
                This draft has no pages yet.
              </div>
            ) : null}

            {definition.pages.map((page, pageIndex) => (
              <div key={page.key} className="rounded-3xl border border-slate-200 bg-slate-50/60 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
                  <div className="grid flex-1 gap-3 md:grid-cols-2">
                    <label className="space-y-1 text-sm">
                      <span className="font-medium">Page title</span>
                      <input value={page.title} onChange={(e) => updatePage(pageIndex, { title: e.target.value })} disabled={!editable} className="w-full rounded-xl border bg-white px-3 py-2 disabled:bg-slate-100" />
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="font-medium">Page key</span>
                      <input value={page.key} onChange={(e) => updatePage(pageIndex, { key: e.target.value })} disabled={!editable} className="w-full rounded-xl border bg-white px-3 py-2 font-mono text-xs disabled:bg-slate-100" />
                    </label>
                    <label className="space-y-1 text-sm md:col-span-2">
                      <span className="font-medium">Description</span>
                      <textarea value={page.description || ''} onChange={(e) => updatePage(pageIndex, { description: e.target.value || null })} disabled={!editable} className="min-h-20 w-full rounded-xl border bg-white p-3 disabled:bg-slate-100" />
                    </label>
                  </div>

                  {editable ? (
                    <div className="flex gap-1">
                      <button type="button" onClick={() => movePage(pageIndex, -1)} className="rounded-lg border bg-white p-2" aria-label="Move page up"><ArrowUp className="h-4 w-4" /></button>
                      <button type="button" onClick={() => movePage(pageIndex, 1)} className="rounded-lg border bg-white p-2" aria-label="Move page down"><ArrowDown className="h-4 w-4" /></button>
                      <button type="button" onClick={() => duplicatePage(pageIndex)} className="rounded-lg border bg-white p-2" aria-label="Duplicate page"><Copy className="h-4 w-4" /></button>
                      <button type="button" onClick={() => removePage(pageIndex)} className="rounded-lg border border-rose-200 bg-white p-2 text-rose-700" aria-label="Delete page"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  ) : null}
                </div>

                <div className="mt-4 space-y-4">
                  {page.sections.map((section, sectionIndex) => (
                    <div key={section.key} className="rounded-2xl border bg-white p-4">
                      <div className="flex flex-col gap-3 xl:flex-row xl:items-start">
                        <div className="grid flex-1 gap-3 md:grid-cols-2">
                          <label className="space-y-1 text-sm">
                            <span className="font-medium">Section title</span>
                            <input value={section.title} onChange={(e) => updateSection(pageIndex, sectionIndex, { title: e.target.value })} disabled={!editable} className="w-full rounded-xl border px-3 py-2 disabled:bg-slate-50" />
                          </label>
                          <label className="space-y-1 text-sm">
                            <span className="font-medium">Section key</span>
                            <input value={section.key} onChange={(e) => updateSection(pageIndex, sectionIndex, { key: e.target.value })} disabled={!editable} className="w-full rounded-xl border px-3 py-2 font-mono text-xs disabled:bg-slate-50" />
                          </label>
                          <label className="space-y-1 text-sm md:col-span-2">
                            <span className="font-medium">Description</span>
                            <textarea value={section.description || ''} onChange={(e) => updateSection(pageIndex, sectionIndex, { description: e.target.value || null })} disabled={!editable} className="min-h-16 w-full rounded-xl border p-3 disabled:bg-slate-50" />
                          </label>
                          <label className="flex items-center gap-2 text-sm">
                            <input type="checkbox" checked={Boolean(section.repeatable)} onChange={(e) => updateSection(pageIndex, sectionIndex, { repeatable: e.target.checked })} disabled={!editable} />
                            Repeatable section
                          </label>
                          {section.repeatable ? (
                            <div className="grid grid-cols-2 gap-2">
                              <input type="number" min={0} value={section.minRepeats ?? ''} onChange={(e) => updateSection(pageIndex, sectionIndex, { minRepeats: e.target.value === '' ? null : Number(e.target.value) })} disabled={!editable} placeholder="Min repeats" className="rounded-xl border px-3 py-2 text-sm disabled:bg-slate-50" />
                              <input type="number" min={1} value={section.maxRepeats ?? ''} onChange={(e) => updateSection(pageIndex, sectionIndex, { maxRepeats: e.target.value === '' ? null : Number(e.target.value) })} disabled={!editable} placeholder="Max repeats" className="rounded-xl border px-3 py-2 text-sm disabled:bg-slate-50" />
                            </div>
                          ) : null}
                        </div>

                        {editable ? (
                          <div className="flex gap-1">
                            <button type="button" onClick={() => moveSection(pageIndex, sectionIndex, -1)} className="rounded-lg border p-2"><ArrowUp className="h-4 w-4" /></button>
                            <button type="button" onClick={() => moveSection(pageIndex, sectionIndex, 1)} className="rounded-lg border p-2"><ArrowDown className="h-4 w-4" /></button>
                            <button type="button" onClick={() => duplicateSection(pageIndex, sectionIndex)} className="rounded-lg border p-2" aria-label="Duplicate section"><Copy className="h-4 w-4" /></button>
                            <button type="button" onClick={() => removeSection(pageIndex, sectionIndex)} className="rounded-lg border border-rose-200 p-2 text-rose-700"><Trash2 className="h-4 w-4" /></button>
                          </div>
                        ) : null}
                      </div>

                      <div className="mt-4 space-y-3">
                        {section.fields.map((field, fieldIndex) => (
                          <div key={field.key} className="rounded-2xl border border-slate-200 p-4">
                            <div className="grid gap-3 xl:grid-cols-[1fr_220px_auto]">
                              <div className="grid gap-3 md:grid-cols-2">
                                <label className="space-y-1 text-sm">
                                  <span className="font-medium">Label</span>
                                  <input value={field.label} onChange={(e) => updateField(pageIndex, sectionIndex, fieldIndex, { label: e.target.value })} disabled={!editable} className="w-full rounded-xl border px-3 py-2 disabled:bg-slate-50" />
                                </label>
                                <label className="space-y-1 text-sm">
                                  <span className="font-medium">Field key</span>
                                  <input value={field.key} onChange={(e) => updateField(pageIndex, sectionIndex, fieldIndex, { key: e.target.value })} disabled={!editable} className="w-full rounded-xl border px-3 py-2 font-mono text-xs disabled:bg-slate-50" />
                                </label>
                                <label className="space-y-1 text-sm">
                                  <span className="font-medium">Help text</span>
                                  <input value={field.helpText || ''} onChange={(e) => updateField(pageIndex, sectionIndex, fieldIndex, { helpText: e.target.value || null })} disabled={!editable} className="w-full rounded-xl border px-3 py-2 disabled:bg-slate-50" />
                                </label>
                                <label className="space-y-1 text-sm">
                                  <span className="font-medium">Placeholder</span>
                                  <input value={field.placeholder || ''} onChange={(e) => updateField(pageIndex, sectionIndex, fieldIndex, { placeholder: e.target.value || null })} disabled={!editable} className="w-full rounded-xl border px-3 py-2 disabled:bg-slate-50" />
                                </label>
                              </div>

                              <div className="space-y-3">
                                <select value={field.type} onChange={(e) => updateField(pageIndex, sectionIndex, fieldIndex, { type: e.target.value })} disabled={!editable} className="w-full rounded-xl border px-3 py-2 text-sm disabled:bg-slate-50">
                                  {FIELD_TYPES.map((type) => <option key={type} value={type}>{FIELD_TYPE_LABELS[type] || type}</option>)}
                                </select>
                                <label className="flex items-center gap-2 text-sm">
                                  <input type="checkbox" checked={Boolean(field.required)} onChange={(e) => updateField(pageIndex, sectionIndex, fieldIndex, { required: e.target.checked })} disabled={!editable} />
                                  Required
                                </label>
                                <label className="flex items-center gap-2 text-sm">
                                  <input type="checkbox" checked={Boolean(field.sensitive)} onChange={(e) => updateField(pageIndex, sectionIndex, fieldIndex, { sensitive: e.target.checked })} disabled={!editable} />
                                  Sensitive
                                </label>
                              </div>

                              {editable ? (
                                <div className="flex gap-1">
                                  <button type="button" onClick={() => moveField(pageIndex, sectionIndex, fieldIndex, -1)} className="rounded-lg border p-2"><ArrowUp className="h-4 w-4" /></button>
                                  <button type="button" onClick={() => moveField(pageIndex, sectionIndex, fieldIndex, 1)} className="rounded-lg border p-2"><ArrowDown className="h-4 w-4" /></button>
                                  <button type="button" onClick={() => duplicateField(pageIndex, sectionIndex, fieldIndex)} className="rounded-lg border p-2" aria-label="Duplicate field"><Copy className="h-4 w-4" /></button>
                                  <button type="button" onClick={() => editFieldAdvanced(pageIndex, sectionIndex, fieldIndex)} className="rounded-lg border px-2 py-1 text-[10px] font-semibold">Advanced</button>
                                  <button type="button" onClick={() => removeField(pageIndex, sectionIndex, fieldIndex)} className="rounded-lg border border-rose-200 p-2 text-rose-700"><Trash2 className="h-4 w-4" /></button>
                                </div>
                              ) : null}
                            </div>

                            {['SINGLE_SELECT', 'MULTI_SELECT', 'RADIO', 'CHECKBOX_GROUP'].includes(field.type) ? (
                              <div className="mt-4 rounded-xl bg-slate-50 p-3">
                                <div className="mb-2 flex items-center justify-between">
                                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Options</div>
                                  {editable ? (
                                    <button type="button" onClick={() => addOption(pageIndex, sectionIndex, fieldIndex)} className="rounded-lg border bg-white px-2 py-1 text-xs font-semibold">
                                      Add option
                                    </button>
                                  ) : null}
                                </div>
                                <div className="space-y-2">
                                  {(field.options || []).map((option, optionIndex) => (
                                    <div key={option.key} className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                                      <input value={option.label} onChange={(e) => updateOption(pageIndex, sectionIndex, fieldIndex, optionIndex, { label: e.target.value })} disabled={!editable} className="rounded-lg border bg-white px-2 py-1.5 text-sm disabled:bg-slate-100" placeholder="Label" />
                                      <input value={option.value} onChange={(e) => updateOption(pageIndex, sectionIndex, fieldIndex, optionIndex, { value: e.target.value })} disabled={!editable} className="rounded-lg border bg-white px-2 py-1.5 font-mono text-xs disabled:bg-slate-100" placeholder="Value" />
                                      {editable ? (
                                        <button type="button" onClick={() => removeOption(pageIndex, sectionIndex, fieldIndex, optionIndex)} className="rounded-lg border border-rose-200 bg-white p-2 text-rose-700"><Trash2 className="h-4 w-4" /></button>
                                      ) : null}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        ))}

                        {editable ? (
                          <button type="button" onClick={() => addField(pageIndex, sectionIndex)} className="inline-flex items-center gap-2 rounded-xl border border-dashed px-3 py-2 text-sm">
                            <Plus className="h-4 w-4" />
                            Add field
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}

                  {editable ? (
                    <button type="button" onClick={() => addSection(pageIndex)} className="inline-flex items-center gap-2 rounded-xl border border-dashed bg-white px-3 py-2 text-sm">
                      <Plus className="h-4 w-4" />
                      Add section
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </section>

          <section className="space-y-4 rounded-3xl border bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Form logic</h2>
                <p className="mt-1 text-sm text-slate-500">Show, hide, require or make fields optional based on earlier answers.</p>
              </div>
              {editable ? (
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => addSimpleRule('VISIBILITY')} className="rounded-xl border px-3 py-2 text-sm font-semibold">Add visibility rule</button>
                  <button type="button" onClick={() => addSimpleRule('REQUIREMENT')} className="rounded-xl border px-3 py-2 text-sm font-semibold">Add requirement rule</button>
                </div>
              ) : null}
            </div>

            {definition.rules.length ? (
              <div className="space-y-3">
                {definition.rules.map((rule: any, ruleIndex) => {
                  const supportedKind = rule.kind === 'VISIBILITY' || rule.kind === 'REQUIREMENT';
                  const conditionKeys = Object.keys(rule.condition || {}).filter((key) => key !== 'field');
                  const supportedCondition = Boolean(rule.condition?.field) && conditionKeys.length === 1 && ['exists', 'truthy', 'equals', 'notEquals'].includes(conditionKeys[0]);
                  const action = rule.effect?.showFields ? 'show'
                    : rule.effect?.hideFields ? 'hide'
                    : rule.effect?.requireFields ? 'require'
                    : rule.effect?.optionalFields ? 'optional'
                    : '';
                  const targetField = rule.effect?.showFields?.[0] || rule.effect?.hideFields?.[0] || rule.effect?.requireFields?.[0] || rule.effect?.optionalFields?.[0] || '';
                  const isSimple = supportedKind && supportedCondition && Boolean(action) && Boolean(targetField);
                  const operator = supportedCondition ? conditionKeys[0] : 'exists';
                  const conditionValue = operator === 'equals' || operator === 'notEquals' ? String(rule.condition?.[operator] ?? '') : '';

                  return (
                    <div key={rule.key || ruleIndex} className="rounded-2xl border p-4">
                      {isSimple ? (
                        <div className="grid gap-3 xl:grid-cols-[150px_1fr_150px_1fr_150px_1fr_auto] xl:items-end">
                          <label className="space-y-1 text-xs font-medium text-slate-600">
                            Type
                            <select value={rule.kind} onChange={(event) => updateSimpleRule(ruleIndex, { kind: event.target.value as 'VISIBILITY' | 'REQUIREMENT' })} disabled={!editable} className="w-full rounded-lg border px-2 py-2 text-sm disabled:bg-slate-50">
                              <option value="VISIBILITY">Visibility</option>
                              <option value="REQUIREMENT">Requirement</option>
                            </select>
                          </label>
                          <label className="space-y-1 text-xs font-medium text-slate-600">
                            If field
                            <select value={rule.condition.field} onChange={(event) => updateSimpleRule(ruleIndex, { conditionField: event.target.value })} disabled={!editable} className="w-full rounded-lg border px-2 py-2 text-sm disabled:bg-slate-50">
                              {fieldOptions.map((field) => <option key={field.key} value={field.key}>{field.label}</option>)}
                            </select>
                          </label>
                          <label className="space-y-1 text-xs font-medium text-slate-600">
                            Condition
                            <select value={operator} onChange={(event) => updateSimpleRule(ruleIndex, { operator: event.target.value as any })} disabled={!editable} className="w-full rounded-lg border px-2 py-2 text-sm disabled:bg-slate-50">
                              <option value="exists">Has an answer</option>
                              <option value="truthy">Is yes / true</option>
                              <option value="equals">Equals</option>
                              <option value="notEquals">Does not equal</option>
                            </select>
                          </label>
                          <label className="space-y-1 text-xs font-medium text-slate-600">
                            Value
                            <input value={conditionValue} onChange={(event) => updateSimpleRule(ruleIndex, { conditionValue: event.target.value })} disabled={!editable || !['equals', 'notEquals'].includes(operator)} className="w-full rounded-lg border px-2 py-2 text-sm disabled:bg-slate-50" placeholder={['equals', 'notEquals'].includes(operator) ? 'Answer value' : 'Not required'} />
                          </label>
                          <label className="space-y-1 text-xs font-medium text-slate-600">
                            Then
                            <select value={action} onChange={(event) => updateSimpleRule(ruleIndex, { action: event.target.value as any })} disabled={!editable} className="w-full rounded-lg border px-2 py-2 text-sm disabled:bg-slate-50">
                              {rule.kind === 'REQUIREMENT' ? <><option value="require">Require</option><option value="optional">Make optional</option></> : <><option value="show">Show</option><option value="hide">Hide</option></>}
                            </select>
                          </label>
                          <label className="space-y-1 text-xs font-medium text-slate-600">
                            Target field
                            <select value={targetField} onChange={(event) => updateSimpleRule(ruleIndex, { targetField: event.target.value })} disabled={!editable} className="w-full rounded-lg border px-2 py-2 text-sm disabled:bg-slate-50">
                              {fieldOptions.map((field) => <option key={field.key} value={field.key}>{field.label}</option>)}
                            </select>
                          </label>
                          {editable ? <button type="button" onClick={() => removeRule(ruleIndex)} className="rounded-lg border border-rose-200 p-2 text-rose-700" aria-label="Delete rule"><Trash2 className="h-4 w-4" /></button> : null}
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="font-semibold text-slate-800">Advanced rule</div>
                            <div className="mt-1 text-xs text-slate-500">This rule uses advanced logic. Edit it in Advanced logic & translation JSON below.</div>
                          </div>
                          {editable ? <button type="button" onClick={() => removeRule(ruleIndex)} className="rounded-lg border border-rose-200 p-2 text-rose-700" aria-label="Delete rule"><Trash2 className="h-4 w-4" /></button> : null}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">No form logic configured.</div>}
          </section>

          <section className="space-y-4 rounded-3xl border bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Translations</h2>
                <p className="mt-1 text-sm text-slate-500">Provide translated labels, descriptions, help text and option names for additional languages.</p>
              </div>
              {editable ? <button type="button" onClick={addTranslation} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold"><Plus className="h-4 w-4" />Add translation</button> : null}
            </div>

            {definition.translations.length ? (
              <div className="space-y-3">
                {definition.translations.map((translation: any, translationIndex) => {
                  const target = translationTargets.find((item) => item.type === translation.targetType && item.key === translation.targetKey);
                  const supported = Boolean(target);
                  const properties = target?.properties || Object.keys(translation.values || {});
                  return (
                    <div key={`${translation.locale}:${translation.targetType}:${translation.targetKey}:${translationIndex}`} className="rounded-2xl border p-4">
                      {supported ? (
                        <div className="space-y-3">
                          <div className="grid gap-3 md:grid-cols-[160px_1fr_auto]">
                            <label className="space-y-1 text-xs font-medium text-slate-600">Language / locale<input value={translation.locale || ''} onChange={(event) => updateTranslation(translationIndex, { locale: event.target.value })} disabled={!editable} className="w-full rounded-lg border px-2 py-2 text-sm disabled:bg-slate-50" placeholder="en-ZA" /></label>
                            <label className="space-y-1 text-xs font-medium text-slate-600">Translate<select value={`${translation.targetType}:${translation.targetKey}`} onChange={(event) => { const [targetType, ...rest] = event.target.value.split(':'); updateTranslation(translationIndex, { targetType, targetKey: rest.join(':'), values: {} }); }} disabled={!editable} className="w-full rounded-lg border px-2 py-2 text-sm disabled:bg-slate-50">{translationTargets.map((item) => <option key={`${item.type}:${item.key}`} value={`${item.type}:${item.key}`}>{item.label}</option>)}</select></label>
                            {editable ? <button type="button" onClick={() => removeTranslation(translationIndex)} className="self-end rounded-lg border border-rose-200 p-2 text-rose-700" aria-label="Delete translation"><Trash2 className="h-4 w-4" /></button> : null}
                          </div>
                          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                            {properties.map((property) => <label key={property} className="space-y-1 text-xs font-medium text-slate-600">{property.replaceAll(/([A-Z])/g, ' $1').replace(/^./, (letter: string) => letter.toUpperCase())}<input value={String(translation.values?.[property] || '')} onChange={(event) => updateTranslation(translationIndex, { values: { ...(translation.values || {}), [property]: event.target.value } })} disabled={!editable} className="w-full rounded-lg border px-2 py-2 text-sm disabled:bg-slate-50" /></label>)}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="font-semibold text-slate-800">Advanced translation</div>
                            <div className="mt-1 text-xs text-slate-500">This translation targets a form-level or advanced key. Edit it in Advanced logic & translation JSON below.</div>
                          </div>
                          {editable ? <button type="button" onClick={() => removeTranslation(translationIndex)} className="rounded-lg border border-rose-200 p-2 text-rose-700"><Trash2 className="h-4 w-4" /></button> : null}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">No translations configured.</div>}
          </section>

          <details className="rounded-3xl border bg-white p-5 shadow-sm">
            <summary className="cursor-pointer font-semibold">Advanced logic & translation JSON</summary>
            <p className="mt-2 text-sm text-slate-500">Use this area for complex navigation, calculation, scoring or translation definitions that are not represented by the visual editors.</p>
            <div className="mt-4 grid gap-4 xl:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-semibold">Rules JSON</span>
                <textarea value={rulesText} onChange={(event) => { setRulesText(event.target.value); setDirty(true); }} disabled={!editable} spellCheck={false} className="min-h-72 w-full rounded-xl border p-3 font-mono text-xs disabled:bg-slate-50" />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold">Translations JSON</span>
                <textarea value={translationsText} onChange={(event) => { setTranslationsText(event.target.value); setDirty(true); }} disabled={!editable} spellCheck={false} className="min-h-72 w-full rounded-xl border p-3 font-mono text-xs disabled:bg-slate-50" />
              </label>
            </div>
          </details>

          <div className="flex flex-wrap gap-2">
            {editable ? (
              <>
                <button type="button" onClick={saveStructure} disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                  <Save className="h-4 w-4" />
                  Save changes
                </button>
                <button type="button" onClick={publish} disabled={busy || dirty || settingsDirty} className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 px-4 py-2 text-sm font-semibold text-emerald-800 disabled:opacity-40">
                  <Send className="h-4 w-4" />
                  Publish version
                </button>
              </>
            ) : null}

            {version?.state === 'PUBLISHED' ? (
              <button type="button" onClick={retire} disabled={busy} className="rounded-xl border border-amber-200 px-4 py-2 text-sm font-semibold text-amber-800">
                Retire version
              </button>
            ) : null}
          </div>
        </div>

        {preview ? (
          <aside className="self-start rounded-3xl border bg-white p-5 shadow-sm 2xl:sticky 2xl:top-5">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">
              Builder preview
            </div>
            <h2 className="mt-2 text-2xl font-semibold">{title || 'Untitled form'}</h2>
            {description ? <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p> : null}

            <div className="mt-6 space-y-6">
              {definition.pages.map((page) => (
                <div key={page.key} className="space-y-4">
                  <div>
                    <div className="text-lg font-semibold">{page.title}</div>
                    {page.description ? <p className="mt-1 text-sm text-slate-500">{page.description}</p> : null}
                  </div>

                  {page.sections.map((section) => (
                    <div key={section.key} className="space-y-4 rounded-2xl border p-4">
                      <div>
                        <div className="font-semibold">{section.title}</div>
                        {section.description ? <p className="mt-1 text-sm text-slate-500">{section.description}</p> : null}
                      </div>

                      {section.fields.map((field) => (
                        <div key={field.key} className="space-y-1.5">
                          {field.type !== 'CONSENT' && field.type !== 'INFORMATION' ? (
                            <div className="text-sm font-medium">
                              {field.label}
                              {field.required ? <span className="ml-1 text-rose-600">*</span> : null}
                              {field.sensitive ? <span className="ml-2 text-xs text-amber-700">Sensitive</span> : null}
                            </div>
                          ) : null}
                          {field.helpText && field.type !== 'INFORMATION' ? (
                            <div className="text-xs text-slate-500">{field.helpText}</div>
                          ) : null}
                          {renderPreviewField(field)}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <button type="button" disabled className="mt-6 w-full rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white opacity-70">
              {submitLabel || 'Submit'}
            </button>

            <div className="mt-4 rounded-xl bg-cyan-50 p-3 text-xs leading-5 text-cyan-900">
              Preview mode — changes are not public until this version is published.
            </div>
          </aside>
        ) : null}
      </section>
    </main>
  );
}
