'use client';
import { createContext, useContext, useMemo, useState, ReactNode } from 'react';

type Role = 'patient' | 'clinician' | 'admin';
type AuthCtx = { role: Role; setRole: (r: Role)=>void };

const AuthContext = createContext<AuthCtx>({ role: 'patient', setRole: ()=>{} });

export function MockAuthProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>('patient');
  const value = useMemo(()=>({ role, setRole }), [role]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useMockAuth(){ return useContext(AuthContext); }