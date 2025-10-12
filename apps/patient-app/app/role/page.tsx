'use client';
import RoleSwitcher from '@/components/RoleSwitcher';
import { useAuth } from 'ambulant-mock-auth/context/AuthContext';

export default function RolePage() {
  const { role } = useAuth();

  return (
    <div className="min-h-screen bg-gray-100 p-6 space-y-6">
      <h1 className="text-2xl font-bold">Test RoleSwitcher</h1>
      <RoleSwitcher />
      {role === 'patient' && <p className="text-green-600">Showing patient view</p>}
      {role === 'clinician' && <p className="text-blue-600">Showing clinician view</p>}
    </div>
  );
}
