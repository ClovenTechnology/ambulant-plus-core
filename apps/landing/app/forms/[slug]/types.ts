export type JsonRecord = Record<string, unknown>;

export type PublicFormOption = {
  key: string;
  label: string;
  value: string;
  order: number;
  metadata?: unknown;
};

export type PublicFormField = {
  key: string;
  type: string;
  label: string;
  helpText?: string | null;
  placeholder?: string | null;
  order: number;
  required?: boolean;
  defaultValue?: unknown;
  validation?: unknown;
  visibilityLogic?: unknown;
  config?: unknown;
  options?: PublicFormOption[];
};

export type PublicFormSection = {
  key: string;
  title: string;
  description?: string | null;
  order: number;
  repeatable?: boolean;
  minRepeats?: number | null;
  maxRepeats?: number | null;
  fields: PublicFormField[];
};

export type PublicFormPage = {
  key: string;
  title: string;
  description?: string | null;
  order: number;
  sections: PublicFormSection[];
};

export type PublicFormRule = {
  key: string;
  kind: 'VISIBILITY' | 'REQUIREMENT' | 'NAVIGATION' | string;
  priority?: number;
  enabled?: boolean;
  condition: unknown;
  effect: unknown;
};

export type PublicFormTranslation = {
  locale: string;
  targetType: string;
  targetKey: string;
  values: unknown;
};

export type PublicFormDefinition = {
  id: string;
  key: string;
  slug: string;
  name: string;
  description?: string | null;
  version: {
    id: string;
    versionNumber: number;
    title: string;
    description?: string | null;
    locale: string;
    fallbackLocale?: string | null;
    submitLabel?: string | null;
    allowSaveResume: boolean;
    acceptingFrom?: string | null;
    acceptingUntil?: string | null;
    branding?: unknown;
    settings?: unknown;
    availability: 'OPEN' | 'NOT_STARTED' | 'CLOSED';
    pages: PublicFormPage[];
    rules?: PublicFormRule[];
    translations?: PublicFormTranslation[];
  };
};

export type PublicSubmissionFile = {
  id: string;
  fieldKey: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  state: string;
  availableAt?: string | null;
};

export type PublicSubmission = {
  id: string;
  status: string;
  locale: string;
  startedAt: string;
  lastSavedAt?: string | null;
  expiresAt?: string | null;
  answers: Record<string, unknown>;
  files: PublicSubmissionFile[];
  application?: {
    referenceCode: string;
    status: string;
    opportunitySlug: string;
  } | null;
  form: PublicFormDefinition;
};

export type PublicSubmissionSession = {
  submissionId: string;
  token: string;
  expiresAt?: string | null;
  allowSaveResume: boolean;
  applicationReference?: string | null;
  opportunitySlug?: string | null;
};
