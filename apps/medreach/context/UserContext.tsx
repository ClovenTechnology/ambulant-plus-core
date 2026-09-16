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

async function tryReadIdentity(): Promise<User> {
  try {
    const res = await fetch('/api/partner-auth/me', { cache: 'no-store' });
    if (!res.ok) return guestUser;
    const { account: a } = await res.json();
    if (!a || !['lab', 'phleb'].includes(a.role)) return guestUser;
    return { role: a.role, id: a.userId, userId: a.userId, email: a.email, labId: a.role === 'lab' ? a.actorRefId : undefined, phlebId: a.role === 'phleb' ? a.actorRefId : undefined, isAuthenticated: true };
  } catch { return guestUser; }
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