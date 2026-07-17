'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

type LegalVersionStatus =
  | 'DRAFT'
  | 'IN_REVIEW'
  | 'APPROVED'
  | 'SCHEDULED'
  | 'PUBLISHED'
  | 'SUPERSEDED'
  | 'RETIRED';

type LegalVersion = {
  id: string;
  documentId: string;
  versionNumber: number;
  versionLabel?: string | null;
  locale?: string | null;
  contentFormat?: string | null;
  content: string;
  renderedHtml?: string | null;
  checksum?: string | null;
  status: LegalVersionStatus;
  changeSummary?: string | null;
  submittedAt?: string | null;
  approvedAt?: string | null;
  scheduledAt?: string | null;
  effectiveAt?: string | null;
  publishedAt?: string | null;
  supersededAt?: string | null;
  retiredAt?: string | null;
  retirementReason?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type PublicationEvent = {
  id: string;
  eventType: string;
  versionId?: string | null;
  actorUserId?: string | null;
  actorRole?: string | null;
  fromStatus?: string | null;
  toStatus?: string | null;
  reason?: string | null;
  createdAt?: string | null;
};

type LegalDocument = {
  id: string;
  key: string;
  title: string;
  category: string;
  ownerDepartment?: string | null;
  status: string;
  acknowledgementMode: string;
  audiences?: unknown;
  applications?: unknown;
  surfaces?: unknown;
  currentPublishedVersionId?: string | null;
  currentPublishedVersion?: LegalVersion | null;
  versions?: LegalVersion[];
  publicationEvents?: PublicationEvent[];
  createdAt?: string | null;
  updatedAt?: string | null;
};

type CatalogueEntry = {
  key: string;
  title: string;
  category: string;
  acknowledgementMode:
    | 'NOTICE'
    | 'REQUIRED'
    | 'NON_BLOCKING';
};

const CATALOGUE: readonly CatalogueEntry[] = [
  {
    key: 'PATIENT_TERMS_OF_SERVICE',
    title: 'Patient Terms of Service',
    category: 'terms',
    acknowledgementMode: 'REQUIRED',
  },
  {
    key: 'PATIENT_PRIVACY_NOTICE',
    title: 'Patient Privacy Notice',
    category: 'privacy',
    acknowledgementMode: 'REQUIRED',
  },
  {
    key: 'PATIENT_SIGNUP_DISCLOSURE',
    title: 'Patient Signup Disclosure',
    category: 'disclosure',
    acknowledgementMode: 'REQUIRED',
  },
  {
    key: 'CLINICIAN_TERMS_OF_SERVICE',
    title: 'Clinician Terms of Service',
    category: 'terms',
    acknowledgementMode: 'REQUIRED',
  },
  {
    key: 'CLINICIAN_PRIVACY_NOTICE',
    title: 'Clinician Privacy Notice',
    category: 'privacy',
    acknowledgementMode: 'REQUIRED',
  },
  {
    key: 'CLINICIAN_PROFESSIONAL_INDEMNITY_NOTICE',
    title: 'Clinician Professional Indemnity Notice',
    category: 'professional-indemnity',
    acknowledgementMode: 'NON_BLOCKING',
  },
  {
    key: 'CLINICIAN_ONBOARDING_PAYMENT_DISCLOSURE',
    title: 'Clinician Onboarding Payment Disclosure',
    category: 'payment-disclosure',
    acknowledgementMode: 'REQUIRED',
  },
  {
    key: 'PATIENT_TELEVISIT_CONSENT',
    title: 'Patient Televisit Informed Consent and Privacy Notice',
    category: 'televisit-consent',
    acknowledgementMode: 'REQUIRED',
  },
  {
    key: 'CLINICIAN_TELEVISIT_NOTICE',
    title: 'Clinician Televisit Notice',
    category: 'televisit-notice',
    acknowledgementMode: 'NOTICE',
  },
  {
    key: 'CAREPORT_PHARMACY_PARTNER_TERMS',
    title: 'CarePort Pharmacy Partner Terms',
    category: 'partner-terms',
    acknowledgementMode: 'REQUIRED',
  },
  {
    key: 'CAREPORT_RIDER_PARTNER_TERMS',
    title: 'CarePort Rider Partner Terms',
    category: 'partner-terms',
    acknowledgementMode: 'REQUIRED',
  },
  {
    key: 'MEDREACH_LAB_PARTNER_TERMS',
    title: 'MedReach Laboratory Partner Terms',
    category: 'partner-terms',
    acknowledgementMode: 'REQUIRED',
  },
  {
    key: 'MEDREACH_PHLEBOTOMIST_PARTNER_TERMS',
    title: 'MedReach Phlebotomist Partner Terms',
    category: 'partner-terms',
    acknowledgementMode: 'REQUIRED',
  },
  {
    key: 'PLATFORM_COOKIE_NOTICE',
    title: 'Platform Cookie Notice',
    category: 'cookie-notice',
    acknowledgementMode: 'NOTICE',
  },
  {
    key: 'PLATFORM_DATA_PROCESSING_NOTICE',
    title: 'Platform Data Processing Notice',
    category: 'data-processing',
    acknowledgementMode: 'REQUIRED',
  },
] as const;

function arrayValue(
  value: unknown,
) {
  return Array.isArray(
    value,
  )
    ? value
        .map(
          (entry) =>
            String(
              entry,
            ),
        )
        .filter(Boolean)
    : [];
}

function dateText(
  value?: string | null,
) {
  if (
    !value
  ) {
    return 'Not recorded';
  }

  const parsed =
    new Date(
      value,
    );

  if (
    Number.isNaN(
      parsed.getTime(),
    )
  ) {
    return value;
  }

  return parsed.toLocaleString(
    'en-ZA',
    {
      dateStyle:
        'medium',
      timeStyle:
        'short',
    },
  );
}

function statusClass(
  status: string,
) {
  const value =
    status.toUpperCase();

  if (
    value ===
      'PUBLISHED' ||
    value ===
      'ACTIVE'
  ) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  }

  if (
    value ===
      'APPROVED' ||
    value ===
      'SCHEDULED'
  ) {
    return 'border-sky-200 bg-sky-50 text-sky-800';
  }

  if (
    value ===
      'IN_REVIEW'
  ) {
    return 'border-amber-200 bg-amber-50 text-amber-800';
  }

  if (
    value ===
      'RETIRED' ||
    value ===
      'SUPERSEDED' ||
    value ===
      'ARCHIVED'
  ) {
    return 'border-slate-200 bg-slate-100 text-slate-700';
  }

  return 'border-violet-200 bg-violet-50 text-violet-800';
}

function errorMessage(
  error: unknown,
) {
  const text =
    error instanceof Error
      ? error.message
      : String(
          error ||
          '',
        );

  if (
    /does not exist|unknown table|migration|legalDocument/i.test(
      text,
    )
  ) {
    return 'The Legal workspace is ready, but the Legal database migration has not yet been applied.';
  }

  return text ||
    'The Legal operation could not be completed.';
}

async function readJson(
  response: Response,
) {
  const text =
    await response.text();

  let body: any =
    null;

  try {
    body =
      text
        ? JSON.parse(
            text,
          )
        : null;
  } catch {
    body = {
      error:
        text ||
        'invalid_server_response',
    };
  }

  if (
    !response.ok ||
    body?.ok ===
      false
  ) {
    throw new Error(
      body?.error ||
      'legal_request_failed',
    );
  }

  return body;
}

export default function LegalWorkspace() {
  const [
    documents,
    setDocuments,
  ] =
    useState<
      LegalDocument[]
    >([]);

  const [
    selectedDocumentId,
    setSelectedDocumentId,
  ] =
    useState('');

  const [
    selectedVersionId,
    setSelectedVersionId,
  ] =
    useState('');

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    busy,
    setBusy,
  ] =
    useState('');

  const [
    notice,
    setNotice,
  ] =
    useState<{
      tone:
        | 'ok'
        | 'err'
        | 'info';
      text:
        string;
    } | null>(
      null,
    );

  const [
    search,
    setSearch,
  ] =
    useState('');

  const [
    content,
    setContent,
  ] =
    useState('');

  const [
    versionLabel,
    setVersionLabel,
  ] =
    useState('');

  const [
    changeSummary,
    setChangeSummary,
  ] =
    useState('');

  const [
    effectiveAt,
    setEffectiveAt,
  ] =
    useState('');

  const [
    retirementReason,
    setRetirementReason,
  ] =
    useState('');

  const refresh =
    useCallback(
      async (
        preferredDocumentId?: string,
        preferredVersionId?: string,
      ) => {
        setLoading(
          true,
        );

        try {
          const response =
            await fetch(
              '/api/admin/legal/documents?includeEvents=true&limit=200',
              {
                cache:
                  'no-store',
                credentials:
                  'include',
              },
            );

          const body =
            await readJson(
              response,
            );

          const rows =
            Array.isArray(
              body?.documents,
            )
              ? body.documents as LegalDocument[]
              : [];

          setDocuments(
            rows,
          );

          const nextDocumentId =
            preferredDocumentId ||
            selectedDocumentId ||
            rows[0]?.id ||
            '';

          setSelectedDocumentId(
            rows.some(
              (
                row,
              ) =>
                row.id ===
                nextDocumentId,
            )
              ? nextDocumentId
              : rows[0]?.id ||
                '',
          );

          if (
            preferredVersionId
          ) {
            setSelectedVersionId(
              preferredVersionId,
            );
          }

          setNotice(
            null,
          );
        } catch (
          error
        ) {
          setDocuments(
            [],
          );

          setNotice({
            tone:
              'err',
            text:
              errorMessage(
                error,
              ),
          });
        } finally {
          setLoading(
            false,
          );
        }
      },
      [
        selectedDocumentId,
      ],
    );

  useEffect(
    () => {
      void refresh();
    },
    [],
  );

  const selectedDocument =
    useMemo(
      () =>
        documents.find(
          (
            document,
          ) =>
            document.id ===
            selectedDocumentId,
        ) ||
        null,
      [
        documents,
        selectedDocumentId,
      ],
    );

  const selectedVersion =
    useMemo(
      () => {
        if (
          !selectedDocument
        ) {
          return null;
        }

        return (
          selectedDocument.versions ||
          []
        ).find(
          (
            version,
          ) =>
            version.id ===
            selectedVersionId,
        ) ||
        selectedDocument.versions?.[0] ||
        null;
      },
      [
        selectedDocument,
        selectedVersionId,
      ],
    );

  useEffect(
    () => {
      if (
        !selectedVersion
      ) {
        setContent(
          '',
        );

        setVersionLabel(
          '',
        );

        setChangeSummary(
          '',
        );

        setSelectedVersionId(
          '',
        );

        return;
      }

      setSelectedVersionId(
        selectedVersion.id,
      );

      setContent(
        selectedVersion.content ||
        '',
      );

      setVersionLabel(
        selectedVersion.versionLabel ||
        '',
      );

      setChangeSummary(
        selectedVersion.changeSummary ||
        '',
      );
    },
    [
      selectedVersion?.id,
    ],
  );

  const filteredDocuments =
    useMemo(
      () => {
        const query =
          search
            .trim()
            .toLowerCase();

        if (
          !query
        ) {
          return documents;
        }

        return documents.filter(
          (
            document,
          ) =>
            [
              document.key,
              document.title,
              document.category,
              document.status,
            ].some(
              (
                value,
              ) =>
                String(
                  value ||
                  '',
                )
                  .toLowerCase()
                  .includes(
                    query,
                  ),
            ),
        );
      },
      [
        documents,
        search,
      ],
    );

  async function action(
    payload: Record<
      string,
      unknown
    >,
    successText: string,
    preferredDocumentId?: string,
  ) {
    const actionName =
      String(
        payload.action ||
        'legal-action',
      );

    setBusy(
      actionName,
    );

    setNotice(
      null,
    );

    try {
      const response =
        await fetch(
          '/api/admin/legal/documents',
          {
            method:
              'POST',
            credentials:
              'include',
            headers: {
              'content-type':
                'application/json',
            },
            body:
              JSON.stringify(
                payload,
              ),
          },
        );

      const body =
        await readJson(
          response,
        );

      const result =
        body?.result ||
        {};

      const documentId =
        preferredDocumentId ||
        result?.document?.id ||
        result?.version?.documentId ||
        selectedDocumentId;

      const versionId =
        result?.version?.id ||
        selectedVersionId;

      await refresh(
        documentId,
        versionId,
      );

      setNotice({
        tone:
          'ok',
        text:
          successText,
      });

      return body;
    } catch (
      error
    ) {
      setNotice({
        tone:
          'err',
        text:
          errorMessage(
            error,
          ),
      });

      return null;
    } finally {
      setBusy(
        '',
      );
    }
  }

  async function createEntireCatalogue() {
    setBusy(
      'seed-catalogue',
    );

    setNotice(
      null,
    );

    try {
      let created =
        0;

      for (
        const entry of
        CATALOGUE
      ) {
        const response =
          await fetch(
            '/api/admin/legal/documents',
            {
              method:
                'POST',
              credentials:
                'include',
              headers: {
                'content-type':
                  'application/json',
              },
              body:
                JSON.stringify({
                  action:
                    'create_document',
                  key:
                    entry.key,
                  title:
                    entry.title,
                  category:
                    entry.category,
                  acknowledgementMode:
                    entry.acknowledgementMode,
                }),
            },
          );

        const body =
          await readJson(
            response,
          );

        if (
          body?.result?.created
        ) {
          created +=
            1;
        }
      }

      await refresh();

      setNotice({
        tone:
          'ok',
        text:
          created
            ? String(created) + ' governed Legal document records were created.'
            : 'The complete governed Legal catalogue already exists.',
      });
    } catch (
      error
    ) {
      setNotice({
        tone:
          'err',
        text:
          errorMessage(
            error,
          ),
      });
    } finally {
      setBusy(
        '',
      );
    }
  }

  async function createVersion() {
    if (
      !selectedDocument
    ) {
      setNotice({
        tone:
          'err',
        text:
          'Select or create a Legal document first.',
      });

      return;
    }

    if (
      !content.trim()
    ) {
      setNotice({
        tone:
          'err',
        text:
          'Legal document content is required.',
      });

      return;
    }

    await action(
      {
        action:
          'create_version',
        documentId:
          selectedDocument.id,
        versionLabel:
          versionLabel ||
          null,
        locale:
          'en-ZA',
        contentFormat:
          'markdown',
        content,
        changeSummary:
          changeSummary ||
          null,
      },
      'A new immutable draft version was created.',
      selectedDocument.id,
    );
  }

  async function saveDraft() {
    if (
      !selectedVersion ||
      selectedVersion.status !==
        'DRAFT'
    ) {
      setNotice({
        tone:
          'err',
        text:
          'Only draft versions may be edited.',
      });

      return;
    }

    await action(
      {
        action:
          'update_version',
        versionId:
          selectedVersion.id,
        versionLabel:
          versionLabel ||
          null,
        content,
        changeSummary:
          changeSummary ||
          null,
      },
      'Draft changes were saved.',
      selectedDocument?.id,
    );
  }

  async function transition(
    transitionAction:
      | 'submit'
      | 'approve'
      | 'publish',
    message: string,
  ) {
    if (
      !selectedVersion
    ) {
      return;
    }

    await action(
      {
        action:
          transitionAction,
        versionId:
          selectedVersion.id,
      },
      message,
      selectedDocument?.id,
    );
  }

  async function schedule() {
    if (
      !selectedVersion
    ) {
      return;
    }

    if (
      !effectiveAt
    ) {
      setNotice({
        tone:
          'err',
        text:
          'Choose a future publication date and time.',
      });

      return;
    }

    const iso =
      new Date(
        effectiveAt,
      ).toISOString();

    await action(
      {
        action:
          'schedule',
        versionId:
          selectedVersion.id,
        effectiveAt:
          iso,
      },
      'The approved version was scheduled for publication.',
      selectedDocument?.id,
    );
  }

  async function retire() {
    if (
      !selectedVersion
    ) {
      return;
    }

    if (
      !retirementReason.trim()
    ) {
      setNotice({
        tone:
          'err',
        text:
          'A retirement reason is required.',
      });

      return;
    }

    if (
      !window.confirm(
        'Retire this Legal version? This action does not delete the historical record.',
      )
    ) {
      return;
    }

    await action(
      {
        action:
          'retire',
        versionId:
          selectedVersion.id,
        reason:
          retirementReason,
      },
      'The Legal version was retired and retained in the audit history.',
      selectedDocument?.id,
    );

    setRetirementReason(
      '',
    );
  }

  const stats =
    useMemo(
      () => {
        const versions =
          documents.flatMap(
            (
              document,
            ) =>
              document.versions ||
              [],
          );

        return {
          documents:
            documents.length,
          drafts:
            versions.filter(
              (
                version,
              ) =>
                version.status ===
                'DRAFT',
            ).length,
          review:
            versions.filter(
              (
                version,
              ) =>
                version.status ===
                'IN_REVIEW',
            ).length,
          published:
            versions.filter(
              (
                version,
              ) =>
                version.status ===
                'PUBLISHED',
            ).length,
        };
      },
      [
        documents,
      ],
    );

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 px-6 py-7 text-white sm:px-8">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-4xl">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-indigo-200">
                  Ambulant+ Legal Department
                </p>

                <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                  Legal publication and compliance workspace
                </h1>

                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-200 sm:text-base">
                  Draft, review, approve, schedule, publish, supersede and retire
                  governed Terms, Privacy Notices, consent documents, partner
                  terms and regulated disclosures.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void refresh()}
                  disabled={loading || Boolean(busy)}
                  className="rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Refresh
                </button>

                <button
                  type="button"
                  onClick={() => void createEntireCatalogue()}
                  disabled={loading || Boolean(busy)}
                  className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy === 'seed-catalogue'
                    ? 'Creating catalogue…'
                    : 'Create governed catalogue'}
                </button>
              </div>
            </div>
          </div>

          <div className="grid gap-3 border-t border-slate-200 bg-white p-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ['Governed documents', stats.documents],
              ['Draft versions', stats.drafts],
              ['Awaiting review', stats.review],
              ['Published versions', stats.published],
            ].map(([label, value]) => (
              <div
                key={String(label)}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {label}
                </p>

                <p className="mt-2 text-2xl font-bold text-slate-950">
                  {value}
                </p>
              </div>
            ))}
          </div>
        </section>

        {notice ? (
          <div
            className={[
              'rounded-2xl border px-4 py-3 text-sm font-medium',
              notice.tone === 'ok'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : notice.tone === 'err'
                  ? 'border-rose-200 bg-rose-50 text-rose-900'
                  : 'border-sky-200 bg-sky-50 text-sky-900',
            ].join(' ')}
          >
            {notice.text}
          </div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-950">
                  Document register
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  {documents.length} of {CATALOGUE.length} catalogue records
                </p>
              </div>
            </div>

            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search documents"
              className="mt-4 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
            />

            <div className="mt-4 max-h-[760px] space-y-2 overflow-y-auto pr-1">
              {loading ? (
                <div className="rounded-2xl border border-dashed border-slate-300 p-5 text-sm text-slate-500">
                  Loading governed Legal documents…
                </div>
              ) : filteredDocuments.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 p-5 text-sm text-slate-600">
                  No governed Legal documents are available yet. Apply the Legal
                  migration, then create the governed catalogue.
                </div>
              ) : (
                filteredDocuments.map((document) => (
                  <button
                    type="button"
                    key={document.id}
                    onClick={() => {
                      setSelectedDocumentId(document.id);
                      setSelectedVersionId(document.versions?.[0]?.id || '');
                    }}
                    className={[
                      'w-full rounded-2xl border p-3 text-left transition',
                      selectedDocumentId === document.id
                        ? 'border-indigo-300 bg-indigo-50 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50',
                    ].join(' ')}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-950">
                          {document.title}
                        </p>

                        <p className="mt-1 truncate text-[11px] font-medium text-slate-500">
                          {document.key}
                        </p>
                      </div>

                      <span
                        className={[
                          'rounded-full border px-2 py-1 text-[10px] font-bold',
                          statusClass(document.status),
                        ].join(' ')}
                      >
                        {document.status}
                      </span>
                    </div>

                    <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                      <span>{document.category}</span>
                      <span>{document.versions?.length || 0} version(s)</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </aside>

          <section className="space-y-6">
            {!selectedDocument ? (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
                <h2 className="text-xl font-bold text-slate-950">
                  Select a governed Legal document
                </h2>

                <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">
                  Create the governed catalogue or select an existing document to
                  draft and manage its publication lifecycle.
                </p>
              </div>
            ) : (
              <>
                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={[
                            'rounded-full border px-2.5 py-1 text-xs font-bold',
                            statusClass(selectedDocument.status),
                          ].join(' ')}
                        >
                          {selectedDocument.status}
                        </span>

                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
                          {selectedDocument.acknowledgementMode}
                        </span>
                      </div>

                      <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-950">
                        {selectedDocument.title}
                      </h2>

                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        {selectedDocument.key}
                      </p>
                    </div>

                    <div className="grid min-w-[260px] gap-2 text-xs text-slate-600">
                      <p>
                        <span className="font-semibold text-slate-900">
                          Audience:
                        </span>{' '}
                        {arrayValue(selectedDocument.audiences).join(', ') ||
                          'Not specified'}
                      </p>

                      <p>
                        <span className="font-semibold text-slate-900">
                          Applications:
                        </span>{' '}
                        {arrayValue(selectedDocument.applications).join(', ') ||
                          'Not specified'}
                      </p>

                      <p>
                        <span className="font-semibold text-slate-900">
                          Surfaces:
                        </span>{' '}
                        {arrayValue(selectedDocument.surfaces).join(', ') ||
                          'Not specified'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-6 2xl:grid-cols-[260px_minmax(0,1fr)]">
                  <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-950">
                      Version history
                    </h3>

                    <div className="mt-3 space-y-2">
                      {(selectedDocument.versions || []).length === 0 ? (
                        <p className="rounded-xl border border-dashed border-slate-300 p-3 text-xs leading-5 text-slate-600">
                          No version has been drafted yet.
                        </p>
                      ) : (
                        (selectedDocument.versions || []).map((version) => (
                          <button
                            type="button"
                            key={version.id}
                            onClick={() => setSelectedVersionId(version.id)}
                            className={[
                              'w-full rounded-xl border p-3 text-left transition',
                              selectedVersion?.id === version.id
                                ? 'border-indigo-300 bg-indigo-50'
                                : 'border-slate-200 hover:bg-slate-50',
                            ].join(' ')}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-bold text-slate-950">
                                v{version.versionNumber}
                              </span>

                              <span
                                className={[
                                  'rounded-full border px-2 py-0.5 text-[10px] font-bold',
                                  statusClass(version.status),
                                ].join(' ')}
                              >
                                {version.status}
                              </span>
                            </div>

                            <p className="mt-1 truncate text-xs text-slate-500">
                              {version.versionLabel || 'Unlabelled version'}
                            </p>

                            <p className="mt-2 text-[11px] text-slate-500">
                              {dateText(version.updatedAt || version.createdAt)}
                            </p>
                          </button>
                        ))
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedVersionId('');
                        setContent('');
                        setVersionLabel('');
                        setChangeSummary('');
                      }}
                      className="mt-4 w-full rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2.5 text-sm font-semibold text-indigo-800 transition hover:bg-indigo-100"
                    >
                      Start new draft
                    </button>
                  </div>

                  <div className="space-y-6">
                    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h3 className="text-lg font-bold text-slate-950">
                            {selectedVersion
                              ? 'Version ' + selectedVersion.versionNumber
                              : 'New draft version'}
                          </h3>

                          <p className="mt-1 text-sm text-slate-600">
                            Lawyer-approved wording belongs here rather than in
                            product source code.
                          </p>
                        </div>

                        {selectedVersion ? (
                          <span
                            className={[
                              'w-fit rounded-full border px-3 py-1 text-xs font-bold',
                              statusClass(selectedVersion.status),
                            ].join(' ')}
                          >
                            {selectedVersion.status}
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-5 grid gap-4 md:grid-cols-2">
                        <label className="text-sm font-semibold text-slate-800">
                          Version label
                          <input
                            value={versionLabel}
                            onChange={(event) =>
                              setVersionLabel(event.target.value)
                            }
                            disabled={
                              Boolean(selectedVersion) &&
                              selectedVersion?.status !== 'DRAFT'
                            }
                            placeholder="Example: 2026.1"
                            className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-normal outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 disabled:bg-slate-100"
                          />
                        </label>

                        <label className="text-sm font-semibold text-slate-800">
                          Change summary
                          <input
                            value={changeSummary}
                            onChange={(event) =>
                              setChangeSummary(event.target.value)
                            }
                            disabled={
                              Boolean(selectedVersion) &&
                              selectedVersion?.status !== 'DRAFT'
                            }
                            placeholder="Describe the material change"
                            className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-normal outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 disabled:bg-slate-100"
                          />
                        </label>
                      </div>

                      <label className="mt-4 block text-sm font-semibold text-slate-800">
                        Governed content
                        <textarea
                          value={content}
                          onChange={(event) => setContent(event.target.value)}
                          disabled={
                            Boolean(selectedVersion) &&
                            selectedVersion?.status !== 'DRAFT'
                          }
                          rows={22}
                          placeholder="Enter the complete lawyer-approved Legal document in Markdown."
                          className="mt-2 w-full resize-y rounded-2xl border border-slate-300 bg-white px-4 py-3 font-mono text-sm leading-6 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 disabled:bg-slate-100"
                        />
                      </label>

                      <div className="mt-4 flex flex-wrap gap-3">
                        {!selectedVersion ? (
                          <button
                            type="button"
                            onClick={() => void createVersion()}
                            disabled={Boolean(busy)}
                            className="rounded-xl bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-800 disabled:opacity-50"
                          >
                            Create draft version
                          </button>
                        ) : selectedVersion.status === 'DRAFT' ? (
                          <>
                            <button
                              type="button"
                              onClick={() => void saveDraft()}
                              disabled={Boolean(busy)}
                              className="rounded-xl bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-800 disabled:opacity-50"
                            >
                              Save draft
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                void transition(
                                  'submit',
                                  'The version was submitted for Legal review.',
                                )
                              }
                              disabled={Boolean(busy)}
                              className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-900 transition hover:bg-amber-100 disabled:opacity-50"
                            >
                              Submit for review
                            </button>
                          </>
                        ) : null}

                        {selectedVersion?.status === 'IN_REVIEW' ? (
                          <button
                            type="button"
                            onClick={() =>
                              void transition(
                                'approve',
                                'The Legal version was approved.',
                              )
                            }
                            disabled={Boolean(busy)}
                            className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:opacity-50"
                          >
                            Approve version
                          </button>
                        ) : null}

                        {selectedVersion?.status === 'APPROVED' ? (
                          <button
                            type="button"
                            onClick={() =>
                              void transition(
                                'publish',
                                'The approved Legal version was published.',
                              )
                            }
                            disabled={Boolean(busy)}
                            className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:opacity-50"
                          >
                            Publish now
                          </button>
                        ) : null}
                      </div>
                    </div>

                    {selectedVersion?.status === 'APPROVED' ? (
                      <div className="rounded-3xl border border-sky-200 bg-sky-50 p-5">
                        <h3 className="font-bold text-sky-950">
                          Schedule publication
                        </h3>

                        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                          <input
                            type="datetime-local"
                            value={effectiveAt}
                            onChange={(event) =>
                              setEffectiveAt(event.target.value)
                            }
                            className="rounded-xl border border-sky-300 bg-white px-3 py-2.5 text-sm outline-none focus:ring-4 focus:ring-sky-100"
                          />

                          <button
                            type="button"
                            onClick={() => void schedule()}
                            disabled={Boolean(busy)}
                            className="rounded-xl bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-800 disabled:opacity-50"
                          >
                            Schedule
                          </button>
                        </div>
                      </div>
                    ) : null}

                    {selectedVersion &&
                    ['APPROVED', 'SCHEDULED', 'PUBLISHED'].includes(
                      selectedVersion.status,
                    ) ? (
                      <div className="rounded-3xl border border-rose-200 bg-rose-50 p-5">
                        <h3 className="font-bold text-rose-950">
                          Retire version
                        </h3>

                        <p className="mt-1 text-sm text-rose-800">
                          Retirement preserves the immutable version and audit
                          trail. It does not delete the record.
                        </p>

                        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                          <input
                            value={retirementReason}
                            onChange={(event) =>
                              setRetirementReason(event.target.value)
                            }
                            placeholder="Mandatory retirement reason"
                            className="min-w-0 flex-1 rounded-xl border border-rose-300 bg-white px-3 py-2.5 text-sm outline-none focus:ring-4 focus:ring-rose-100"
                          />

                          <button
                            type="button"
                            onClick={() => void retire()}
                            disabled={Boolean(busy)}
                            className="rounded-xl bg-rose-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-800 disabled:opacity-50"
                          >
                            Retire version
                          </button>
                        </div>
                      </div>
                    ) : null}

                    {selectedVersion ? (
                      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                        <h3 className="font-bold text-slate-950">
                          Version provenance
                        </h3>

                        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-3">
                          {[
                            ['Checksum', selectedVersion.checksum || 'Not recorded'],
                            ['Created', dateText(selectedVersion.createdAt)],
                            ['Submitted', dateText(selectedVersion.submittedAt)],
                            ['Approved', dateText(selectedVersion.approvedAt)],
                            ['Scheduled', dateText(selectedVersion.scheduledAt)],
                            ['Published', dateText(selectedVersion.publishedAt)],
                          ].map(([label, value]) => (
                            <div
                              key={label}
                              className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                            >
                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                {label}
                              </p>

                              <p className="mt-1 break-all font-medium text-slate-900">
                                {value}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                      <h3 className="font-bold text-slate-950">
                        Publication audit trail
                      </h3>

                      <div className="mt-4 space-y-3">
                        {(selectedDocument.publicationEvents || []).length ===
                        0 ? (
                          <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-600">
                            No Legal lifecycle events have been recorded yet.
                          </p>
                        ) : (
                          (selectedDocument.publicationEvents || []).map(
                            (event) => (
                              <div
                                key={event.id}
                                className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="text-sm font-bold text-slate-950">
                                    {event.eventType}
                                  </span>

                                  <span className="text-xs text-slate-500">
                                    {dateText(event.createdAt)}
                                  </span>
                                </div>

                                <p className="mt-2 text-xs text-slate-600">
                                  {event.fromStatus || '—'} →{' '}
                                  {event.toStatus || '—'}
                                </p>

                                {event.reason ? (
                                  <p className="mt-2 text-sm text-slate-700">
                                    {event.reason}
                                  </p>
                                ) : null}
                              </div>
                            ),
                          )
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
