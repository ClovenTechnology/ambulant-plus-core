import { createContext, useContext, ReactNode, useState, useEffect } from 'react';

type User = {
  role: 'admin' | 'lab' | 'phleb';
  id?: string;
  labId?: string;
};

const UserContext = createContext<User | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // Fetch user data from API or cookie
    // mock:
    setUser({ role: 'admin' });
  }, []);

  if (!user) return <div>Loading...</div>;

  return <UserContext.Provider value={user}>{children}</UserContext.Provider>;
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === null) throw new Error('useUser must be used within UserProvider');
  return context;
}
