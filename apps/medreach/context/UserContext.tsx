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

export type MedReachRole =
  | 'admin'
  | 'system'
  | 'lab'
  | 'lab_staff'
  | 'phleb'
  | 'clinician'
  | 'patient'
  | 'guest';

export type User = {
  role: MedReachRole;
  id?: string;
  userId?: string;
  email?: string;
  name?: string;
  labId?: string;
  staffLabId?: string;
  phlebId?: string;
  isAuthenticated: boolean;
};

type UserContextValue = {
  user: User;
  isLoading: boolean;
  refresh: () => Promise<void>;
};

const guestUser: User = {
  role: 'guest',
  isAuthenticated: false,
};

const UserContext = createContext<UserContextValue | null>(null);

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeRole(value: unknown): MedReachRole {
  const role = clean(value).toLowerCase();

  if (
    role === 'admin' ||
    role === 'system' ||
    role === 'lab' ||
    role === 'lab_staff' ||
    role === 'phleb' ||
    role === 'clinician' ||
    role === 'patient'
  ) {
    return role;
  }

  return 'guest';
}

function unwrapIdentity(raw: any) {
  if (!raw || typeof raw !== 'object') return null;

  return raw.user || raw.identity || raw.data?.user || raw.data?.identity || raw.data || raw;
}

function normalizeIdentity(raw: any): User | null {
  const identity = unwrapIdentity(raw);

  if (!identity || typeof identity !== 'object') return null;

  const role = normalizeRole(
    identity.role ||
      identity.medreachRole ||
      identity.userRole ||
      identity.accountType ||
      identity.type,
  );

  const id = clean(identity.id || identity.uid || identity.userId || identity.sub);
  const labId = clean(identity.labId || identity.partnerId || identity.medreachLabId);
  const staffLabId = clean(identity.staffLabId || identity.staffLab || identity.medreachStaffLabId);
  const phlebId = clean(identity.phlebId || identity.phlebProfileId || identity.medreachPhlebId);

  if (role === 'guest' && !id && !labId && !phlebId) return null;

  return {
    role,
    id: id || undefined,
    userId: clean(identity.userId || identity.uid || id) || undefined,
    email: clean(identity.email) || undefined,
    name: clean(identity.name || identity.displayName || identity.fullName) || undefined,
    labId: labId || undefined,
    staffLabId: staffLabId || undefined,
    phlebId: phlebId || undefined,
    isAuthenticated: role !== 'guest',
  };
}

function devIdentity(): User | null {
  if (process.env.NODE_ENV === 'production') return null;

  const role = normalizeRole(process.env.NEXT_PUBLIC_MEDREACH_DEV_ROLE);
  if (role === 'guest') return null;

  return {
    role,
    id: process.env.NEXT_PUBLIC_MEDREACH_DEV_USER_ID || undefined,
    userId: process.env.NEXT_PUBLIC_MEDREACH_DEV_USER_ID || undefined,
    email: process.env.NEXT_PUBLIC_MEDREACH_DEV_EMAIL || undefined,
    name: process.env.NEXT_PUBLIC_MEDREACH_DEV_NAME || 'MedReach Operator',
    labId: process.env.NEXT_PUBLIC_MEDREACH_DEV_LAB_ID || undefined,
    staffLabId: process.env.NEXT_PUBLIC_MEDREACH_DEV_STAFF_LAB_ID || undefined,
    phlebId: process.env.NEXT_PUBLIC_MEDREACH_DEV_PHLEB_ID || undefined,
    isAuthenticated: true,
  };
}

async function tryReadIdentity(): Promise<User> {
  const endpoints = [
    '/api/auth/me',
    '/api/me',
    '/api/session',
    '/api/user',
    '/api/identity',
  ];

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
        cache: 'no-store',
        headers: { accept: 'application/json' },
      });

      if (!res.ok) continue;

      const json = await res.json().catch(() => null);
      const user = normalizeIdentity(json);

      if (user) return user;
    } catch {
      // Try next identity endpoint.
    }
  }

  return devIdentity() || guestUser;
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User>(guestUser);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      setUser(await tryReadIdentity());
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      refresh,
    }),
    [user, isLoading, refresh],
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUserContext() {
  const context = useContext(UserContext);

  if (!context) {
    throw new Error('useUserContext must be used within UserProvider');
  }

  return context;
}

export function useUser() {
  return useUserContext().user;
}