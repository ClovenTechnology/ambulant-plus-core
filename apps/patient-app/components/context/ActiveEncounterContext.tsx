// apps/patient-app/components/context/ActiveEncounterContext.tsx
'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type Encounter = {
  id: string;
  name?: string;
  title?: string;
  patientName?: string;
  clinicianName?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
};

type ActiveEncounterContextType = {
  encounters: Encounter[];
  activeEncounter: Encounter | null;
  setActiveEncounter: (encounter: Encounter | null) => void;
  refreshEncounters: () => Promise<void>;
  loading: boolean;
  error: string | null;
};

const ActiveEncounterContext = createContext<ActiveEncounterContextType | undefined>(
  undefined,
);

const ACTIVE_ENCOUNTER_STORAGE_KEY = 'ambulant.activeEncounterId';

async function readJsonSafe(res: Response): Promise<unknown> {
  return res.json().catch(() => null);
}

function getStoredUid(): string {
  if (typeof window === 'undefined') return '';

  try {
    return (
      localStorage.getItem('ambulant_uid') ||
      localStorage.getItem('ambulant.userId') ||
      localStorage.getItem('ambulant.patientId') ||
      ''
    ).trim();
  } catch {
    return '';
  }
}

function getStoredActiveEncounterId(): string {
  if (typeof window === 'undefined') return '';

  try {
    return localStorage.getItem(ACTIVE_ENCOUNTER_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

function storeActiveEncounterId(id: string | null): void {
  if (typeof window === 'undefined') return;

  try {
    if (id) {
      localStorage.setItem(ACTIVE_ENCOUNTER_STORAGE_KEY, id);
    } else {
      localStorage.removeItem(ACTIVE_ENCOUNTER_STORAGE_KEY);
    }
  } catch {
    // Storage is optional; encounter state still works in memory.
  }
}

function normaliseEncounterList(payload: unknown): Encounter[] {
  const raw = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as any)?.encounters)
      ? (payload as any).encounters
      : Array.isArray((payload as any)?.items)
        ? (payload as any).items
        : Array.isArray((payload as any)?.data)
          ? (payload as any).data
          : [];

  return raw
    .map((item: any): Encounter | null => {
      const id = String(item?.id ?? item?.encounterId ?? '').trim();
      if (!id) return null;

      const label =
        typeof item?.name === 'string' && item.name.trim()
          ? item.name.trim()
          : typeof item?.title === 'string' && item.title.trim()
            ? item.title.trim()
            : typeof item?.patientName === 'string' && item.patientName.trim()
              ? item.patientName.trim()
              : typeof item?.clinicianName === 'string' && item.clinicianName.trim()
                ? item.clinicianName.trim()
                : `Encounter ${id.slice(0, 8)}`;

      return {
        ...item,
        id,
        name: label,
      };
    })
    .filter((item): item is Encounter => Boolean(item));
}

function isAuthOrProfileUnavailable(status: number, payload: unknown): boolean {
  const errorText = String(
    (payload as any)?.error ||
      (payload as any)?.message ||
      (payload as any)?.code ||
      '',
  ).toLowerCase();

  return (
    status === 401 ||
    status === 403 ||
    status === 404 ||
    errorText.includes('unauth') ||
    errorText.includes('not authenticated') ||
    errorText.includes('no authenticated') ||
    errorText.includes('profile') ||
    errorText.includes('patient profile')
  );
}

export function ActiveEncounterProvider({ children }: { children: ReactNode }) {
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [activeEncounter, setActiveEncounterState] = useState<Encounter | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setActiveEncounter = useCallback((encounter: Encounter | null) => {
    setActiveEncounterState(encounter);
    storeActiveEncounterId(encounter?.id ?? null);
  }, []);

  const refreshEncounters = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const uid = getStoredUid();

      const res = await fetch('/api/encounters', {
        cache: 'no-store',
        credentials: 'include',
        headers: {
          'x-role': 'patient',
          ...(uid ? { 'x-uid': uid } : {}),
        },
      });

      const payload = await readJsonSafe(res);

      if (!res.ok) {
        if (isAuthOrProfileUnavailable(res.status, payload)) {
          setEncounters([]);
          setActiveEncounterState(null);
          storeActiveEncounterId(null);
          setError(null);
          return;
        }

        throw new Error(
          String(
            (payload as any)?.error ||
              (payload as any)?.message ||
              `Encounter request failed with HTTP ${res.status}`,
          ),
        );
      }

      const next = normaliseEncounterList(payload);
      const storedId = getStoredActiveEncounterId();

      setEncounters(next);

      setActiveEncounterState((current) => {
        const currentStillExists = current
          ? next.find((item) => item.id === current.id)
          : null;

        if (currentStillExists) {
          storeActiveEncounterId(currentStillExists.id);
          return currentStillExists;
        }

        const stored = storedId
          ? next.find((item) => item.id === storedId) ?? null
          : null;

        if (stored) {
          storeActiveEncounterId(stored.id);
          return stored;
        }

        const first = next[0] ?? null;
        storeActiveEncounterId(first?.id ?? null);
        return first;
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to load encounters';

      setEncounters([]);
      setActiveEncounterState(null);
      storeActiveEncounterId(null);

      /**
       * Keep the error in context for pages that explicitly need to inspect it,
       * but do not force a global top-bar warning. The picker renders this
       * silently so app chrome stays production-clean.
       */
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshEncounters();
  }, [refreshEncounters]);

  const value = useMemo(
    () => ({
      encounters,
      activeEncounter,
      setActiveEncounter,
      refreshEncounters,
      loading,
      error,
    }),
    [activeEncounter, encounters, error, loading, refreshEncounters, setActiveEncounter],
  );

  return (
    <ActiveEncounterContext.Provider value={value}>
      {children}
    </ActiveEncounterContext.Provider>
  );
}

export function useActiveEncounter() {
  const context = useContext(ActiveEncounterContext);

  if (!context) {
    throw new Error('useActiveEncounter must be used within ActiveEncounterProvider');
  }

  return context;
}

export function getEncounterById(_id: string): Encounter | undefined {
  return undefined;
}

export default ActiveEncounterProvider;