'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

const AuthContext = createContext({
  role: 'patient',
  setRole: (role: string) => {}
});

export const useAuth = () => useContext(AuthContext);

export function MockAuthProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState('patient');

  return (
    <AuthContext.Provider value={{ role, setRole }}>
      {children}
    </AuthContext.Provider>
  );
}
