"use client";

import { AuthProvider } from "ambulant-mock-auth/context/AuthContext";

export default function AuthClientProvider({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
