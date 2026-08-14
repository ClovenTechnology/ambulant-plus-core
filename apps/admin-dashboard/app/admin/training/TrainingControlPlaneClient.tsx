// apps/admin-dashboard/app/admin/training/TrainingControlPlaneClient.tsx
'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import TrainingContentManager from './TrainingContentManager';

type TrainingMode =
  | 'virtual'
  | 'in_person';

type SessionMode =
  | TrainingMode
  | 'both';

type TrainingMaterialKind =
  | 'module'
  | 'document'
  | 'video'
  | 'link'
  | 'handbook'
  | 'guide'
  | 'other';

type TrainingMaterial = {
  id: string;
  trainingSlotId?: string | null;
  title: string;
  kind: TrainingMaterialKind;
  url?: string | null;
  fileKey?: string | null;
  notes?: string | null;
  required: boolean;
  active: boolean;
  displayOrder: number;
};

type TrainingSession = {
  id: string;
  dayNumber: number;
  startAt: string;
  endAt: string;
  mode: SessionMode;
  trainerName?: string | null;
  venueName?: string | null;
  venueAddress?: string | null;
};

type Participant = {
  id: string;
  clinicianId: string;
  status: string;
  trainingMode?: TrainingMode | null;
};

type TrainingSlot = {
  id: string;
  title: string;
  summary?: string | null;
  status:
    | 'draft'
    | 'published'
    | 'cancelled'
    | 'completed'
    | string;
  startAt: string;
  endAt: string;
  timezone: string;
  durationDays: number;
  totalDurationMinutes: number;
  capacity: number;
  usedCount: number;
  seatsLeft: number;
  mode:
    | TrainingMode
    | 'both';
  allowedModes: TrainingMode[];
  sessions: TrainingSession[];
  trainerName?: string | null;
  venueName?: string | null;
  venueAddress?: string | null;
  virtualInstructions?: string | null;
  inPersonInstructions?: string | null;
  bookingOpensAt?: string | null;
  bookingClosesAt?: string | null;
  publishedAt?: string | null;
  participants?: Participant[];
};

type TrainingPolicy = {
  timezone: string;
  defaultDurationDays: number;
  defaultSessionDurationMinutes: number;
  allowedModes: TrainingMode[];
};

type SessionForm = {
  id: string;
  dayNumber: number;
  startLocal: string;
  endLocal: string;
  mode: SessionMode;
  trainerName: string;
  venueName: string;
  venueAddress: string;
};

type ProgrammeForm = {
  id: string | null;
  title: string;
  summary: string;
  timezone: string;
  durationDays: number;
  capacity: number;
  allowedModes: TrainingMode[];
  trainerName: string;
  venueName: string;
  venueAddress: string;
  virtualInstructions: string;
  inPersonInstructions: string;
  bookingOpensLocal: string;
  bookingClosesLocal: string;
  sessions: SessionForm[];
};

const FALLBACK_POLICY: TrainingPolicy = {
  timezone: 'Africa/Johannesburg',
  defaultDurationDays: 1,
  defaultSessionDurationMinutes: 60,
  allowedModes: [
    'virtual',
    'in_person',
  ],
};

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function toLocalInput(
  value?: string | Date | null,
) {
  if (!value) return '';

  const date =
    value instanceof Date
      ? value
      : new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return '';
  }

  return [
    date.getFullYear(),
    '-',
    pad(date.getMonth() + 1),
    '-',
    pad(date.getDate()),
    'T',
    pad(date.getHours()),
    ':',
    pad(date.getMinutes()),
  ].join('');
}

function toIso(value: string) {
  if (!value.trim()) return null;

  const date = new Date(value);

  return Number.isFinite(date.getTime())
    ? date.toISOString()
    : null;
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return 'Invalid date';
  }

  return new Intl.DateTimeFormat(
    'en-ZA',
    {
      dateStyle: 'medium',
      timeStyle: 'short',
    },
  ).format(date);
}

function formatHours(minutes: number) {
  const hours =
    Math.max(0, Number(minutes || 0)) /
    60;

  return Number.isInteger(hours)
    ? `${hours} hr`
    : `${hours.toFixed(1)} hrs`;
}

function humanError(value: unknown) {
  return String(
    value ||
    'The training service could not complete this action.',
  ).replace(/_/g, ' ');
}

function newSession(
  policy: TrainingPolicy,
): SessionForm {
  const start = new Date();
  start.setDate(start.getDate() + 1);
  start.setHours(9, 0, 0, 0);

  const end =
    new Date(
      start.getTime() +
      policy.defaultSessionDurationMinutes *
        60_000,
    );

  return {
    id: `session-${Date.now()}`,
    dayNumber: 1,
    startLocal: toLocalInput(start),
    endLocal: toLocalInput(end),
    mode:
      policy.allowedModes.length > 1
        ? 'both'
        : policy.allowedModes[0] ||
          'virtual',
    trainerName: '',
    venueName: '',
    venueAddress: '',
  };
}

function emptyProgramme(
  policy: TrainingPolicy,
): ProgrammeForm {
  return {
    id: null,
    title:
      'Mandatory Clinician Training',
    summary: '',
    timezone:
      policy.timezone ||
      'Africa/Johannesburg',
    durationDays:
      policy.defaultDurationDays || 1,
    capacity: 20,
    allowedModes:
      policy.allowedModes.length
        ? [...policy.allowedModes]
        : ['virtual'],
    trainerName: '',
    venueName: '',
    venueAddress: '',
    virtualInstructions: '',
    inPersonInstructions: '',
    bookingOpensLocal: '',
    bookingClosesLocal: '',
    sessions: [newSession(policy)],
  };
}

function slotToForm(
  slot: TrainingSlot,
): ProgrammeForm {
  const sessions =
    slot.sessions?.length
      ? slot.sessions
      : [
          {
            id: 'session-1',
            dayNumber: 1,
            startAt: slot.startAt,
            endAt: slot.endAt,
            mode: slot.mode,
          } as TrainingSession,
        ];

  return {
    id: slot.id,
    title: slot.title,
    summary: slot.summary || '',
    timezone:
      slot.timezone ||
      'Africa/Johannesburg',
    durationDays:
      Math.max(
        1,
        Number(slot.durationDays || 1),
      ),
    capacity:
      Math.max(
        Number(slot.capacity || 1),
        Number(slot.usedCount || 0),
      ),
    allowedModes:
      slot.allowedModes?.length
        ? [...slot.allowedModes]
        : slot.mode === 'both'
          ? ['virtual', 'in_person']
          : [
              slot.mode === 'in_person'
                ? 'in_person'
                : 'virtual',
            ],
    trainerName:
      slot.trainerName || '',
    venueName:
      slot.venueName || '',
    venueAddress:
      slot.venueAddress || '',
    virtualInstructions:
      slot.virtualInstructions || '',
    inPersonInstructions:
      slot.inPersonInstructions || '',
    bookingOpensLocal:
      toLocalInput(slot.bookingOpensAt),
    bookingClosesLocal:
      toLocalInput(slot.bookingClosesAt),
    sessions:
      sessions.map(
        (session, index) => ({
          id:
            session.id ||
            `session-${index + 1}`,
          dayNumber:
            Math.max(
              1,
              Number(
                session.dayNumber ||
                index + 1,
              ),
            ),
          startLocal:
            toLocalInput(
              session.startAt,
            ),
          endLocal:
            toLocalInput(
              session.endAt,
            ),
          mode:
            session.mode || slot.mode,
          trainerName:
            session.trainerName || '',
          venueName:
            session.venueName || '',
          venueAddress:
            session.venueAddress || '',
        }),
      ),
  };
}

async function readJson(
  response: Response,
) {
  return response
    .json()
    .catch(() => ({} as any));
}

export default function TrainingControlPlaneClient() {
  const [slots, setSlots] =
    useState<TrainingSlot[]>([]);

  const [policy, setPolicy] =
    useState<TrainingPolicy>(
      FALLBACK_POLICY,
    );

  const [form, setForm] =
    useState<ProgrammeForm>(
      () =>
        emptyProgramme(
          FALLBACK_POLICY,
        ),
    );

  const [policyLoaded, setPolicyLoaded] =
    useState(false);

  const [materials, setMaterials] =
    useState<TrainingMaterial[]>([]);

  const [materialsLoading, setMaterialsLoading] =
    useState(false);

  const [materialsSaving, setMaterialsSaving] =
    useState(false);

  const [filter, setFilter] =
    useState<
      | 'all'
      | 'draft'
      | 'published'
      | 'closed'
    >('all');

  const [loading, setLoading] =
    useState(true);

  const [busy, setBusy] =
    useState(false);

  const [notice, setNotice] =
    useState<{
      tone: 'ok' | 'err';
      text: string;
    } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const [
        slotsResponse,
        settingsResponse,
      ] = await Promise.all([
        fetch(
          '/api/admin/training/slots',
          {
            cache: 'no-store',
            headers: {
              accept: 'application/json',
            },
          },
        ),
        fetch(
          '/api/admin/clinicians/onboarding/settings',
          {
            cache: 'no-store',
            headers: {
              accept: 'application/json',
            },
          },
        ),
      ]);

      const slotsBody =
        await readJson(slotsResponse);

      if (
        !slotsResponse.ok ||
        slotsBody?.ok !== true
      ) {
        throw new Error(
          slotsBody?.error ||
          `HTTP ${slotsResponse.status}`,
        );
      }

      setSlots(
        Array.isArray(slotsBody.slots)
          ? slotsBody.slots
          : [],
      );

      const settingsBody =
        await readJson(settingsResponse);

      if (
        settingsResponse.ok &&
        settingsBody?.ok === true &&
        settingsBody?.settings
          ?.trainingPolicy
      ) {
        const raw =
          settingsBody.settings
            .trainingPolicy;

        const nextPolicy: TrainingPolicy = {
          timezone:
            String(
              raw.timezone ||
              FALLBACK_POLICY.timezone,
            ),
          defaultDurationDays:
            Math.max(
              1,
              Number(
                raw.defaultDurationDays ||
                FALLBACK_POLICY
                  .defaultDurationDays,
              ),
            ),
          defaultSessionDurationMinutes:
            Math.max(
              1,
              Number(
                raw
                  .defaultSessionDurationMinutes ||
                FALLBACK_POLICY
                  .defaultSessionDurationMinutes,
              ),
            ),
          allowedModes:
            Array.isArray(
              raw.allowedModes,
            ) &&
            raw.allowedModes.length
              ? raw.allowedModes
              : FALLBACK_POLICY
                  .allowedModes,
        };

        setPolicy(nextPolicy);

        if (!policyLoaded) {
          setForm(
            emptyProgramme(nextPolicy),
          );
          setPolicyLoaded(true);
        }
      }
    } catch (error: any) {
      setNotice({
        tone: 'err',
        text:
          error?.message ||
          'Unable to load training programmes.',
      });
    } finally {
      setLoading(false);
    }
  }, [policyLoaded]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadMaterials =
    useCallback(async (trainingSlotId: string) => {
      if (!trainingSlotId) {
        setMaterials([]);
        return;
      }

      setMaterialsLoading(true);

      try {
        const response =
          await fetch(
            `/api/admin/training/materials?trainingSlotId=${encodeURIComponent(trainingSlotId)}`,
            {
              cache: 'no-store',
              headers: {
                accept: 'application/json',
              },
            },
          );

        const body =
          await readJson(response);

        if (
          !response.ok ||
          body?.ok !== true
        ) {
          throw new Error(
            body?.error ||
            `HTTP ${response.status}`,
          );
        }

        setMaterials(
          Array.isArray(body.materials)
            ? body.materials
            : Array.isArray(body.items)
              ? body.items
              : [],
        );
      } catch (error: any) {
        setMaterials([]);
        setNotice({
          tone: 'err',
          text:
            humanError(
              error?.message ||
              'Unable to load training materials.',
            ),
        });
      } finally {
        setMaterialsLoading(false);
      }
    }, []);

  const metrics =
    useMemo(() => {
      const published =
        slots.filter(
          (slot) =>
            slot.status === 'published',
        );

      return {
        total: slots.length,
        drafts:
          slots.filter(
            (slot) =>
              slot.status === 'draft',
          ).length,
        published: published.length,
        seats:
          published.reduce(
            (sum, slot) =>
              sum +
              Math.max(
                0,
                Number(slot.seatsLeft || 0),
              ),
            0,
          ),
        booked:
          slots.reduce(
            (sum, slot) =>
              sum +
              Math.max(
                0,
                Number(slot.usedCount || 0),
              ),
            0,
          ),
      };
    }, [slots]);

  const visibleSlots =
    useMemo(
      () =>
        slots.filter((slot) => {
          if (filter === 'all') {
            return true;
          }

          if (filter === 'closed') {
            return (
              slot.status ===
                'cancelled' ||
              slot.status ===
                'completed'
            );
          }

          return slot.status === filter;
        }),
      [filter, slots],
    );

  const formDurationMinutes =
    useMemo(
      () =>
        form.sessions.reduce(
          (sum, session) => {
            const start =
              new Date(
                session.startLocal,
              );

            const end =
              new Date(
                session.endLocal,
              );

            if (
              !Number.isFinite(
                start.getTime(),
              ) ||
              !Number.isFinite(
                end.getTime(),
              ) ||
              end <= start
            ) {
              return sum;
            }

            return (
              sum +
              Math.round(
                (
                  end.getTime() -
                  start.getTime()
                ) /
                  60_000,
              )
            );
          },
          0,
        ),
      [form.sessions],
    );

  function patchForm(
    patch: Partial<ProgrammeForm>,
  ) {
    setForm((current) => ({
      ...current,
      ...patch,
    }));
  }

  function patchSession(
    id: string,
    patch: Partial<SessionForm>,
  ) {
    setForm((current) => ({
      ...current,
      sessions:
        current.sessions.map(
          (session) =>
            session.id === id
              ? {
                  ...session,
                  ...patch,
                }
              : session,
        ),
    }));
  }

  function patchMaterial(
    id: string,
    patch: Partial<TrainingMaterial>,
  ) {
    setMaterials((current) =>
      current.map((material) =>
        material.id === id
          ? {
              ...material,
              ...patch,
            }
          : material,
      ),
    );
  }

  function addMaterial() {
    setMaterials((current) => [
      ...current,
      {
        id:
          `material-${Date.now()}-${current.length + 1}`,
        trainingSlotId:
          form.id || null,
        title: '',
        kind: 'module',
        url: null,
        fileKey: null,
        notes: null,
        required: false,
        active: true,
        displayOrder:
          current.length + 1,
      },
    ]);
  }

  function removeMaterial(id: string) {
    setMaterials((current) =>
      current
        .filter(
          (material) =>
            material.id !== id,
        )
        .map((material, index) => ({
          ...material,
          displayOrder:
            index + 1,
        })),
    );
  }

  async function saveMaterials() {
    if (!form.id) {
      setNotice({
        tone: 'err',
        text:
          'Create the draft programme before adding training materials.',
      });
      return;
    }

    const invalid =
      materials.find(
        (material) =>
          !material.title.trim(),
      );

    if (invalid) {
      setNotice({
        tone: 'err',
        text:
          'Every training material requires a title.',
      });
      return;
    }

    setMaterialsSaving(true);
    setNotice(null);

    try {
      const response =
        await fetch(
          '/api/admin/training/materials',
          {
            method: 'PATCH',
            headers: {
              accept: 'application/json',
              'content-type':
                'application/json',
            },
            body: JSON.stringify({
              trainingSlotId: form.id,
              materials:
                materials.map(
                  (material, index) => ({
                    id:
                      material.id,
                    title:
                      material.title.trim(),
                    kind:
                      material.kind,
                    url:
                      material.url?.trim() ||
                      null,
                    fileKey:
                      material.fileKey?.trim() ||
                      null,
                    notes:
                      material.notes?.trim() ||
                      null,
                    required:
                      material.required === true,
                    active:
                      material.active !== false,
                    displayOrder:
                      Math.max(
                        1,
                        Number(
                          material.displayOrder ||
                          index + 1,
                        ),
                      ),
                  }),
                ),
            }),
          },
        );

      const body =
        await readJson(response);

      if (
        !response.ok ||
        body?.ok !== true
      ) {
        throw new Error(
          body?.error ||
          `HTTP ${response.status}`,
        );
      }

      setMaterials(
        Array.isArray(body.materials)
          ? body.materials
          : [],
      );

      setNotice({
        tone: 'ok',
        text:
          'Training materials published successfully. Clinicians assigned to this programme will now see this Admin-configured list.',
      });
    } catch (error: any) {
      setNotice({
        tone: 'err',
        text:
          humanError(
            error?.message ||
            'Unable to save training materials.',
          ),
      });
    } finally {
      setMaterialsSaving(false);
    }
  }

  function startNew() {
    setForm(emptyProgramme(policy));
    setMaterials([]);
    setNotice(null);

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }

  function editSlot(slot: TrainingSlot) {
    setForm(slotToForm(slot));
    setNotice(null);
    void loadMaterials(slot.id);

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }

  function toggleAllowedMode(
    mode: TrainingMode,
  ) {
    const next =
      form.allowedModes.includes(mode)
        ? form.allowedModes.filter(
            (item) => item !== mode,
          )
        : [...form.allowedModes, mode];

    if (next.length) {
      patchForm({
        allowedModes: next,
      });
    }
  }

  function addSession(nextDay: boolean) {
    setForm((current) => {
      const last =
        current.sessions[
          current.sessions.length - 1
        ];

      const fallback =
        newSession(policy);

      if (!last) {
        return {
          ...current,
          sessions: [fallback],
        };
      }

      const previousStart =
        new Date(last.startLocal);

      const previousEnd =
        new Date(last.endLocal);

      const start =
        Number.isFinite(
          previousStart.getTime(),
        )
          ? new Date(previousStart)
          : new Date();

      if (nextDay) {
        start.setDate(
          start.getDate() + 1,
        );
      } else if (
        Number.isFinite(
          previousEnd.getTime(),
        )
      ) {
        start.setTime(
          previousEnd.getTime() +
            30 * 60_000,
        );
      }

      const end =
        new Date(
          start.getTime() +
          policy
            .defaultSessionDurationMinutes *
            60_000,
        );

      const dayNumber =
        nextDay
          ? Math.min(
              365,
              Math.max(
                1,
                last.dayNumber + 1,
              ),
            )
          : last.dayNumber;

      return {
        ...current,
        durationDays:
          Math.max(
            current.durationDays,
            dayNumber,
          ),
        sessions: [
          ...current.sessions,
          {
            ...fallback,
            id:
              `session-${Date.now()}-${current.sessions.length + 1}`,
            dayNumber,
            startLocal:
              toLocalInput(start),
            endLocal:
              toLocalInput(end),
            mode:
              current.allowedModes.length >
              1
                ? 'both'
                : current
                    .allowedModes[0] ||
                  'virtual',
          },
        ],
      };
    });
  }

  function removeSession(id: string) {
    if (form.sessions.length <= 1) {
      return;
    }

    patchForm({
      sessions:
        form.sessions.filter(
          (session) =>
            session.id !== id,
        ),
    });
  }

  async function saveProgramme() {
    setNotice(null);

    const title =
      form.title.trim();

    if (!title) {
      setNotice({
        tone: 'err',
        text:
          'Programme title is required.',
      });
      return;
    }

    if (!form.allowedModes.length) {
      setNotice({
        tone: 'err',
        text:
          'Select at least one training mode.',
      });
      return;
    }

    if (!form.sessions.length) {
      setNotice({
        tone: 'err',
        text:
          'Add at least one training session.',
      });
      return;
    }

    const sessions =
      form.sessions
        .map((session, index) => {
          const startAt =
            toIso(
              session.startLocal,
            );

          const endAt =
            toIso(
              session.endLocal,
            );

          return {
            id:
              session.id ||
              `session-${index + 1}`,
            dayNumber:
              Math.max(
                1,
                Number(
                  session.dayNumber ||
                  index + 1,
                ),
              ),
            startAt,
            endAt,
            mode: session.mode,
            trainerName:
              session.trainerName.trim() ||
              null,
            venueName:
              session.venueName.trim() ||
              null,
            venueAddress:
              session.venueAddress.trim() ||
              null,
          };
        })
        .sort(
          (left, right) =>
            new Date(
              left.startAt || '',
            ).getTime() -
            new Date(
              right.startAt || '',
            ).getTime(),
        );

    const invalidSession =
      sessions.find(
        (session) =>
          !session.startAt ||
          !session.endAt ||
          new Date(
            session.endAt,
          ) <=
            new Date(
              session.startAt,
            ),
      );

    if (invalidSession) {
      setNotice({
        tone: 'err',
        text:
          'Every session requires a valid start and end time, with the end after the start.',
      });
      return;
    }

    const incompatibleMode =
      sessions.find((session) => {
        if (session.mode === 'both') {
          return (
            !form.allowedModes.includes(
              'virtual',
            ) ||
            !form.allowedModes.includes(
              'in_person',
            )
          );
        }

        return !form.allowedModes.includes(
          session.mode,
        );
      });

    if (incompatibleMode) {
      setNotice({
        tone: 'err',
        text:
          'Each session mode must be included in the programme’s available modes.',
      });
      return;
    }

    const maximumDay =
      Math.max(
        ...sessions.map(
          (session) =>
            Number(
              session.dayNumber || 1,
            ),
        ),
      );

    if (
      form.durationDays < maximumDay
    ) {
      setNotice({
        tone: 'err',
        text:
          'Programme duration cannot be shorter than its highest session day.',
      });
      return;
    }

    const firstStart =
      new Date(
        sessions[0]!.startAt!,
      );

    const bookingOpensAt =
      toIso(
        form.bookingOpensLocal,
      );

    const bookingClosesAt =
      toIso(
        form.bookingClosesLocal,
      );

    if (
      bookingOpensAt &&
      bookingClosesAt &&
      new Date(bookingClosesAt) <=
        new Date(bookingOpensAt)
    ) {
      setNotice({
        tone: 'err',
        text:
          'Booking close time must be after the booking open time.',
      });
      return;
    }

    if (
      bookingClosesAt &&
      new Date(bookingClosesAt) >
        firstStart
    ) {
      setNotice({
        tone: 'err',
        text:
          'Booking must close no later than the first training session.',
      });
      return;
    }

    setBusy(true);

    try {
      const payload = {
        ...(form.id
          ? {
              id: form.id,
              action: 'update',
            }
          : {}),
        title,
        summary:
          form.summary.trim() ||
          null,
        timezone:
          form.timezone.trim() ||
          policy.timezone,
        durationDays:
          Math.max(
            1,
            Number(
              form.durationDays || 1,
            ),
          ),
        capacity:
          Math.max(
            1,
            Number(form.capacity || 1),
          ),
        mode:
          form.allowedModes.length > 1
            ? 'both'
            : form.allowedModes[0],
        allowedModes:
          form.allowedModes,
        sessions,
        startsAt:
          sessions[0]!.startAt,
        endsAt:
          sessions[
            sessions.length - 1
          ]!.endAt,
        trainerName:
          form.trainerName.trim() ||
          null,
        venueName:
          form.venueName.trim() ||
          null,
        venueAddress:
          form.venueAddress.trim() ||
          null,
        virtualInstructions:
          form.virtualInstructions
            .trim() || null,
        inPersonInstructions:
          form.inPersonInstructions
            .trim() || null,
        bookingOpensAt,
        bookingClosesAt,
      };

      const response =
        await fetch(
          '/api/admin/training/slots',
          {
            method:
              form.id
                ? 'PATCH'
                : 'POST',
            headers: {
              accept: 'application/json',
              'content-type':
                'application/json',
            },
            body:
              JSON.stringify(payload),
          },
        );

      const body =
        await readJson(response);

      if (
        !response.ok ||
        body?.ok !== true
      ) {
        throw new Error(
          body?.error ||
          `HTTP ${response.status}`,
        );
      }

      setNotice({
        tone: 'ok',
        text:
          form.id
            ? 'Programme updated successfully.'
            : 'Draft programme created. Review it, then publish when ready.',
      });

      const savedSlot =
        body?.slot || null;

      setForm(
        savedSlot
          ? slotToForm(savedSlot)
          : emptyProgramme(policy),
      );

      if (savedSlot?.id) {
        await loadMaterials(
          String(savedSlot.id),
        );
      } else {
        setMaterials([]);
      }

      await load();
    } catch (error: any) {
      setNotice({
        tone: 'err',
        text: humanError(
          error?.message,
        ),
      });
    } finally {
      setBusy(false);
    }
  }

  async function programmeAction(
    slot: TrainingSlot,
    action:
      | 'publish'
      | 'unpublish'
      | 'cancel'
      | 'complete',
  ) {
    const descriptions = {
      publish:
        'Publish this programme to clinicians?',
      unpublish:
        'Remove this programme from clinician booking?',
      cancel:
        slot.usedCount > 0
          ? `Cancel this programme? ${slot.usedCount} confirmed booking(s) are affected.`
          : 'Cancel this programme?',
      complete:
        'Close this programme as completed? Individual clinician attendance and certification remain separate.',
    };

    if (
      !window.confirm(
        descriptions[action],
      )
    ) {
      return;
    }

    setBusy(true);
    setNotice(null);

    try {
      const response =
        await fetch(
          '/api/admin/training/slots',
          {
            method: 'PATCH',
            headers: {
              accept: 'application/json',
              'content-type':
                'application/json',
            },
            body: JSON.stringify({
              id: slot.id,
              action,
              confirmParticipantImpact:
                action === 'cancel' &&
                slot.usedCount > 0,
            }),
          },
        );

      const body =
        await readJson(response);

      if (
        !response.ok ||
        body?.ok !== true
      ) {
        throw new Error(
          body?.error ||
          `HTTP ${response.status}`,
        );
      }

      setNotice({
        tone: 'ok',
        text:
          `Programme ${action} action completed.`,
      });

      if (form.id === slot.id) {
        setForm(
          slotToForm(body.slot),
        );
      }

      await load();
    } catch (error: any) {
      setNotice({
        tone: 'err',
        text: humanError(
          error?.message,
        ),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {notice ? (
        <div
          className={[
            'rounded-2xl border p-4 text-sm',
            notice.tone === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
              : 'border-rose-200 bg-rose-50 text-rose-950',
          ].join(' ')}
        >
          {notice.text}
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ['Programmes', metrics.total],
          ['Drafts', metrics.drafts],
          ['Published', metrics.published],
          ['Available seats', metrics.seats],
          ['Confirmed bookings', metrics.booked],
        ].map(([label, value]) => (
          <div
            key={String(label)}
            className="rounded-2xl border bg-white p-4 shadow-sm"
          >
            <div className="text-xs font-bold text-slate-500">
              {label}
            </div>
            <div className="mt-2 text-2xl font-black text-slate-950">
              {value}
            </div>
          </div>
        ))}
      </section>

      <section className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(480px,0.9fr)]">
        <div className="space-y-4">
          <div className="flex flex-col gap-3 rounded-2xl border bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-black text-slate-950">
                Training programme catalogue
              </h2>
              <p className="mt-1 text-xs text-slate-600">
                Only published programmes with open capacity are visible to clinicians.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void load()}
                className="rounded-xl border px-3 py-2 text-xs font-bold disabled:opacity-50"
              >
                Refresh
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={startNew}
                className="rounded-xl bg-slate-950 px-4 py-2 text-xs font-black text-white disabled:opacity-50"
              >
                New programme
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              ['all', 'All'],
              ['draft', 'Drafts'],
              ['published', 'Published'],
              ['closed', 'Closed'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() =>
                  setFilter(
                    value as
                      typeof filter,
                  )
                }
                className={[
                  'rounded-full border px-3 py-1.5 text-xs font-bold',
                  filter === value
                    ? 'border-slate-950 bg-slate-950 text-white'
                    : 'bg-white text-slate-700',
                ].join(' ')}
              >
                {label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="rounded-2xl border bg-white p-6 text-sm text-slate-600">
              Loading programmes…
            </div>
          ) : visibleSlots.length ? (
            <div className="space-y-3">
              {visibleSlots.map((slot) => (
                <article
                  key={slot.id}
                  className={[
                    'rounded-2xl border bg-white p-4 shadow-sm',
                    form.id === slot.id
                      ? 'border-indigo-300 ring-2 ring-indigo-100'
                      : '',
                  ].join(' ')}
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-black text-slate-950">
                          {slot.title}
                        </h3>
                        <span
                          className={[
                            'rounded-full border px-2 py-0.5 text-[10px] font-black uppercase',
                            slot.status ===
                            'published'
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                              : slot.status ===
                                'draft'
                                ? 'border-amber-200 bg-amber-50 text-amber-800'
                                : 'border-slate-200 bg-slate-100 text-slate-700',
                          ].join(' ')}
                        >
                          {slot.status}
                        </span>
                      </div>

                      {slot.summary ? (
                        <p className="mt-2 text-sm leading-relaxed text-slate-600">
                          {slot.summary}
                        </p>
                      ) : null}

                      <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
                        <div>
                          <strong className="text-slate-900">
                            Starts:
                          </strong>{' '}
                          {formatDateTime(
                            slot.startAt,
                          )}
                        </div>
                        <div>
                          <strong className="text-slate-900">
                            Duration:
                          </strong>{' '}
                          {slot.durationDays}{' '}
                          day(s),{' '}
                          {formatHours(
                            slot.totalDurationMinutes,
                          )}
                        </div>
                        <div>
                          <strong className="text-slate-900">
                            Sessions:
                          </strong>{' '}
                          {slot.sessions?.length ||
                            1}
                        </div>
                        <div>
                          <strong className="text-slate-900">
                            Modes:
                          </strong>{' '}
                          {slot.allowedModes
                            .map((mode) =>
                              mode ===
                              'in_person'
                                ? 'In person'
                                : 'Virtual',
                            )
                            .join(' + ')}
                        </div>
                        <div>
                          <strong className="text-slate-900">
                            Capacity:
                          </strong>{' '}
                          {slot.usedCount}/
                          {slot.capacity} booked
                        </div>
                        <div>
                          <strong className="text-slate-900">
                            Timezone:
                          </strong>{' '}
                          {slot.timezone}
                        </div>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-wrap gap-2">
                      <a
                        href={`/admin/training/patients?slotId=${encodeURIComponent(slot.id)}`}
                        className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-black text-indigo-800"
                      >
                        Manage patients
                      </a>

                      <button
                        type="button"
                        disabled={
                          busy ||
                          slot.status ===
                            'cancelled' ||
                          slot.status ===
                            'completed'
                        }
                        onClick={() =>
                          editSlot(slot)
                        }
                        className="rounded-lg border px-3 py-1.5 text-xs font-bold disabled:opacity-40"
                      >
                        Edit
                      </button>

                      {slot.status ===
                      'draft' ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void programmeAction(
                              slot,
                              'publish',
                            )
                          }
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-black text-white disabled:opacity-40"
                        >
                          Publish
                        </button>
                      ) : null}

                      {slot.status ===
                      'published' &&
                      slot.usedCount === 0 ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void programmeAction(
                              slot,
                              'unpublish',
                            )
                          }
                          className="rounded-lg border px-3 py-1.5 text-xs font-bold disabled:opacity-40"
                        >
                          Unpublish
                        </button>
                      ) : null}

                      {slot.status ===
                      'published' ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void programmeAction(
                              slot,
                              'complete',
                            )
                          }
                          className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-800 disabled:opacity-40"
                        >
                          Close completed
                        </button>
                      ) : null}

                      {slot.status !==
                        'cancelled' &&
                      slot.status !==
                        'completed' ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void programmeAction(
                              slot,
                              'cancel',
                            )
                          }
                          className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 disabled:opacity-40"
                        >
                          Cancel
                        </button>
                      ) : null}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed bg-white p-8 text-center">
              <div className="font-black text-slate-950">
                No matching programmes
              </div>
              <p className="mt-1 text-sm text-slate-600">
                Create a draft, add its sessions, then publish it when ready.
              </p>
            </div>
          )}
        </div>

        <aside className="rounded-3xl border bg-white shadow-sm xl:sticky xl:top-4">
          <header className="border-b bg-gradient-to-r from-indigo-950 to-slate-950 p-5 text-white">
            <div className="text-xs font-black uppercase tracking-[0.18em] text-indigo-200">
              {form.id
                ? 'Edit programme'
                : 'New draft'}
            </div>
            <h2 className="mt-1 text-xl font-black">
              Programme and sessions
            </h2>
            <p className="mt-1 text-xs text-slate-300">
              {form.sessions.length}{' '}
              session(s) ·{' '}
              {formatHours(
                formDurationMinutes,
              )}{' '}
              total teaching time
            </p>
          </header>

          <div className="max-h-[calc(100vh-7rem)] space-y-5 overflow-y-auto p-5">
            {form.id &&
            slots.find(
              (slot) =>
                slot.id === form.id,
            )?.usedCount ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                This programme has confirmed bookings. Its core schedule and modes are locked; descriptive details and capacity may still be updated safely.
              </div>
            ) : null}

            <label className="block text-xs font-bold text-slate-700">
              Programme title
              <input
                value={form.title}
                onChange={(event) =>
                  patchForm({
                    title:
                      event.target.value,
                  })
                }
                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
              />
            </label>

            <label className="block text-xs font-bold text-slate-700">
              Summary
              <textarea
                value={form.summary}
                onChange={(event) =>
                  patchForm({
                    summary:
                      event.target.value,
                  })
                }
                rows={3}
                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-xs font-bold text-slate-700">
                Duration days
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={form.durationDays}
                  onChange={(event) =>
                    patchForm({
                      durationDays:
                        Number(
                          event.target.value,
                        ) || 1,
                    })
                  }
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                />
              </label>

              <label className="text-xs font-bold text-slate-700">
                Capacity
                <input
                  type="number"
                  min="1"
                  max="5000"
                  value={form.capacity}
                  onChange={(event) =>
                    patchForm({
                      capacity:
                        Number(
                          event.target.value,
                        ) || 1,
                    })
                  }
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                />
              </label>

              <label className="text-xs font-bold text-slate-700">
                Timezone
                <input
                  value={form.timezone}
                  onChange={(event) =>
                    patchForm({
                      timezone:
                        event.target.value,
                    })
                  }
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                />
              </label>
            </div>

            <div className="rounded-xl border bg-slate-50 p-3">
              <div className="text-xs font-black text-slate-900">
                Available modes
              </div>
              <div className="mt-2 flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={
                      form.allowedModes
                        .includes('virtual')
                    }
                    onChange={() =>
                      toggleAllowedMode(
                        'virtual',
                      )
                    }
                  />
                  Virtual
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={
                      form.allowedModes
                        .includes(
                          'in_person',
                        )
                    }
                    onChange={() =>
                      toggleAllowedMode(
                        'in_person',
                      )
                    }
                  />
                  In person
                </label>
              </div>
            </div>

            <section>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-black text-slate-950">
                    Daily sessions
                  </h3>
                  <p className="text-xs text-slate-500">
                    Multiple sessions can be allocated to the same day.
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      addSession(false)
                    }
                    className="rounded-lg border px-2 py-1.5 text-[11px] font-bold"
                  >
                    + Same day
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      addSession(true)
                    }
                    className="rounded-lg border px-2 py-1.5 text-[11px] font-bold"
                  >
                    + Next day
                  </button>
                </div>
              </div>

              <div className="mt-3 space-y-3">
                {form.sessions.map(
                  (session, index) => (
                    <div
                      key={session.id}
                      className="rounded-2xl border bg-slate-50 p-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-black text-slate-950">
                          Session {index + 1}
                        </div>
                        <button
                          type="button"
                          disabled={
                            form.sessions.length <=
                            1
                          }
                          onClick={() =>
                            removeSession(
                              session.id,
                            )
                          }
                          className="text-[11px] font-bold text-rose-700 disabled:opacity-30"
                        >
                          Remove
                        </button>
                      </div>

                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <label className="text-[11px] font-bold text-slate-700">
                          Programme day
                          <input
                            type="number"
                            min="1"
                            max={
                              Math.max(
                                form.durationDays,
                                1,
                              )
                            }
                            value={
                              session.dayNumber
                            }
                            onChange={(event) =>
                              patchSession(
                                session.id,
                                {
                                  dayNumber:
                                    Number(
                                      event.target
                                        .value,
                                    ) || 1,
                                },
                              )
                            }
                            className="mt-1 w-full rounded-lg border bg-white px-2 py-2 text-sm"
                          />
                        </label>

                        <label className="text-[11px] font-bold text-slate-700">
                          Mode
                          <select
                            value={session.mode}
                            onChange={(event) =>
                              patchSession(
                                session.id,
                                {
                                  mode:
                                    event.target
                                      .value as
                                      SessionMode,
                                },
                              )
                            }
                            className="mt-1 w-full rounded-lg border bg-white px-2 py-2 text-sm"
                          >
                            <option value="virtual">
                              Virtual
                            </option>
                            <option value="in_person">
                              In person
                            </option>
                            <option value="both">
                              Both
                            </option>
                          </select>
                        </label>

                        <label className="text-[11px] font-bold text-slate-700">
                          Starts
                          <input
                            type="datetime-local"
                            value={
                              session.startLocal
                            }
                            onChange={(event) =>
                              patchSession(
                                session.id,
                                {
                                  startLocal:
                                    event.target
                                      .value,
                                },
                              )
                            }
                            className="mt-1 w-full rounded-lg border bg-white px-2 py-2 text-sm"
                          />
                        </label>

                        <label className="text-[11px] font-bold text-slate-700">
                          Ends
                          <input
                            type="datetime-local"
                            value={
                              session.endLocal
                            }
                            onChange={(event) =>
                              patchSession(
                                session.id,
                                {
                                  endLocal:
                                    event.target
                                      .value,
                                },
                              )
                            }
                            className="mt-1 w-full rounded-lg border bg-white px-2 py-2 text-sm"
                          />
                        </label>

                        <label className="text-[11px] font-bold text-slate-700 sm:col-span-2">
                          Session trainer
                          <input
                            value={
                              session.trainerName
                            }
                            onChange={(event) =>
                              patchSession(
                                session.id,
                                {
                                  trainerName:
                                    event.target
                                      .value,
                                },
                              )
                            }
                            placeholder="Optional session override"
                            className="mt-1 w-full rounded-lg border bg-white px-2 py-2 text-sm"
                          />
                        </label>
                      </div>
                    </div>
                  ),
                )}
              </div>
            </section>

            <TrainingContentManager
              trainingSlotId={form.id}
              sessions={form.sessions}
            />

            <details className="rounded-2xl border border-amber-200 bg-amber-50/30">
              <summary className="cursor-pointer list-none p-4">
                <div className="text-sm font-black text-slate-900">
                  Legacy programme-only materials
                </div>
                <p className="mt-1 text-xs text-slate-600">
                  Existing P0 materials remain editable during migration. New content should normally be created once in the reusable library above and attached through module assignments.
                </p>
              </summary>

              <section className="border-t border-amber-100 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-black text-slate-950">
                      Legacy training materials
                    </h3>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">
                    Publish the exact modules, documents, videos and links clinicians assigned to this programme should see. No hardcoded fallback material is used.
                  </p>
                </div>

                <button
                  type="button"
                  disabled={
                    !form.id ||
                    materialsLoading ||
                    materialsSaving
                  }
                  onClick={addMaterial}
                  className="rounded-lg border border-indigo-200 bg-white px-3 py-2 text-xs font-black text-indigo-800 disabled:opacity-40"
                >
                  + Add material
                </button>
              </div>

              {!form.id ? (
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                  Create the draft programme first. You can then attach its Admin-configured training materials.
                </div>
              ) : materialsLoading ? (
                <div className="mt-3 rounded-xl border bg-white p-3 text-xs text-slate-500">
                  Loading training materials...
                </div>
              ) : materials.length === 0 ? (
                <div className="mt-3 rounded-xl border border-dashed bg-white p-4 text-center">
                  <div className="text-sm font-black text-slate-900">
                    No materials published
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Add the first material. Clinicians will see a clean empty state until Admin publishes content.
                  </p>
                </div>
              ) : (
                <div className="mt-3 space-y-3">
                  {materials.map(
                    (material, index) => (
                      <div
                        key={material.id}
                        className="rounded-2xl border bg-white p-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-xs font-black text-slate-900">
                            Material {index + 1}
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              removeMaterial(
                                material.id,
                              )
                            }
                            className="text-[11px] font-bold text-rose-700"
                          >
                            Remove
                          </button>
                        </div>

                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          <label className="text-[11px] font-bold text-slate-700 sm:col-span-2">
                            Title
                            <input
                              value={
                                material.title
                              }
                              onChange={(event) =>
                                patchMaterial(
                                  material.id,
                                  {
                                    title:
                                      event.target
                                        .value,
                                  },
                                )
                              }
                              placeholder="e.g. Contactless Medicine clinical workflow"
                              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                            />
                          </label>

                          <label className="text-[11px] font-bold text-slate-700">
                            Type
                            <select
                              value={
                                material.kind
                              }
                              onChange={(event) =>
                                patchMaterial(
                                  material.id,
                                  {
                                    kind:
                                      event.target
                                        .value as
                                        TrainingMaterialKind,
                                  },
                                )
                              }
                              className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm"
                            >
                              <option value="module">Module</option>
                              <option value="document">Document / PDF</option>
                              <option value="video">Video</option>
                              <option value="link">Web link</option>
                              <option value="handbook">Handbook</option>
                              <option value="guide">Guide</option>
                              <option value="other">Other</option>
                            </select>
                          </label>

                          <label className="text-[11px] font-bold text-slate-700">
                            Display order
                            <input
                              type="number"
                              min="1"
                              max="500"
                              value={
                                material.displayOrder
                              }
                              onChange={(event) =>
                                patchMaterial(
                                  material.id,
                                  {
                                    displayOrder:
                                      Math.max(
                                        1,
                                        Number(
                                          event.target
                                            .value,
                                        ) || 1,
                                      ),
                                  },
                                )
                              }
                              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                            />
                          </label>

                          <label className="text-[11px] font-bold text-slate-700 sm:col-span-2">
                            URL
                            <input
                              value={
                                material.url || ''
                              }
                              onChange={(event) =>
                                patchMaterial(
                                  material.id,
                                  {
                                    url:
                                      event.target
                                        .value,
                                  },
                                )
                              }
                              placeholder="https://... (PDF, video, document or web resource)"
                              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                            />
                          </label>

                          <label className="text-[11px] font-bold text-slate-700 sm:col-span-2">
                            Notes / learner guidance
                            <textarea
                              value={
                                material.notes || ''
                              }
                              onChange={(event) =>
                                patchMaterial(
                                  material.id,
                                  {
                                    notes:
                                      event.target
                                        .value,
                                  },
                                )
                              }
                              rows={3}
                              placeholder="What the clinician should review, learn or complete."
                              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                            />
                          </label>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-4">
                          <label className="flex items-center gap-2 text-xs font-bold text-slate-700">
                            <input
                              type="checkbox"
                              checked={
                                material.required
                              }
                              onChange={(event) =>
                                patchMaterial(
                                  material.id,
                                  {
                                    required:
                                      event.target
                                        .checked,
                                  },
                                )
                              }
                            />
                            Required
                          </label>

                          <label className="flex items-center gap-2 text-xs font-bold text-slate-700">
                            <input
                              type="checkbox"
                              checked={
                                material.active
                              }
                              onChange={(event) =>
                                patchMaterial(
                                  material.id,
                                  {
                                    active:
                                      event.target
                                        .checked,
                                  },
                                )
                              }
                            />
                            Published / visible
                          </label>
                        </div>
                      </div>
                    ),
                  )}
                </div>
              )}

              {form.id ? (
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    disabled={
                      materialsLoading ||
                      materialsSaving
                    }
                    onClick={() =>
                      void saveMaterials()
                    }
                    className="rounded-xl bg-indigo-700 px-4 py-2 text-xs font-black text-white hover:bg-indigo-800 disabled:opacity-50"
                  >
                    {materialsSaving
                      ? 'Saving materials...'
                      : 'Save & publish materials'}
                  </button>
                </div>
              ) : null}
            </section>

            </details>

            <section className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-bold text-slate-700">
                Booking opens
                <input
                  type="datetime-local"
                  value={
                    form.bookingOpensLocal
                  }
                  onChange={(event) =>
                    patchForm({
                      bookingOpensLocal:
                        event.target.value,
                    })
                  }
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                />
              </label>

              <label className="text-xs font-bold text-slate-700">
                Booking closes
                <input
                  type="datetime-local"
                  value={
                    form.bookingClosesLocal
                  }
                  onChange={(event) =>
                    patchForm({
                      bookingClosesLocal:
                        event.target.value,
                    })
                  }
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                />
              </label>
            </section>

            <section className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-bold text-slate-700">
                Lead trainer
                <input
                  value={form.trainerName}
                  onChange={(event) =>
                    patchForm({
                      trainerName:
                        event.target.value,
                    })
                  }
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                />
              </label>

              <label className="text-xs font-bold text-slate-700">
                Venue name
                <input
                  value={form.venueName}
                  onChange={(event) =>
                    patchForm({
                      venueName:
                        event.target.value,
                    })
                  }
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                />
              </label>

              <label className="text-xs font-bold text-slate-700 sm:col-span-2">
                Venue address
                <textarea
                  value={form.venueAddress}
                  onChange={(event) =>
                    patchForm({
                      venueAddress:
                        event.target.value,
                    })
                  }
                  rows={3}
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                />
              </label>

              <label className="text-xs font-bold text-slate-700">
                Virtual instructions
                <textarea
                  value={
                    form.virtualInstructions
                  }
                  onChange={(event) =>
                    patchForm({
                      virtualInstructions:
                        event.target.value,
                    })
                  }
                  rows={4}
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                />
              </label>

              <label className="text-xs font-bold text-slate-700">
                In-person instructions
                <textarea
                  value={
                    form.inPersonInstructions
                  }
                  onChange={(event) =>
                    patchForm({
                      inPersonInstructions:
                        event.target.value,
                    })
                  }
                  rows={4}
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                />
              </label>
            </section>

            <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:justify-end">
              {form.id ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={startNew}
                  className="rounded-xl border px-4 py-2 text-sm font-bold disabled:opacity-50"
                >
                  Discard edit
                </button>
              ) : null}

              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void saveProgramme()
                }
                className="rounded-xl bg-indigo-700 px-5 py-2 text-sm font-black text-white hover:bg-indigo-800 disabled:opacity-50"
              >
                {busy
                  ? 'Saving…'
                  : form.id
                    ? 'Save programme'
                    : 'Create draft programme'}
              </button>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
