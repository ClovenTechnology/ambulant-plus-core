'use client';

import { useAuth } from 'ambulant-mock-auth/context/AuthContext';

export default function RoleSwitcher() {
  const { role, setRole } = useAuth();

  const toggleRole = () => {
    setRole(role === 'patient' ? 'clinician' : 'patient');
  };

  return (
    <div className="p-4 bg-white rounded shadow flex items-center justify-between">
      <span className="font-medium text-gray-800">Current Role: {role}</span>
      <button
        onClick={toggleRole}
        className="ml-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
      >
        Switch to {role === 'patient' ? 'Clinician' : 'Patient'}
      </button>
    </div>
  );
}
