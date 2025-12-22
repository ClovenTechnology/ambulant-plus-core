'use client';

import dynamic from 'next/dynamic';
import React from 'react';

// load client component (Placed earlier as components/PatientSignupForm.tsx)
const PatientSignupForm = dynamic(() => import('@/components/PatientSignupForm'), { ssr: false });

export default function PatientSignupPage() {
  return (
    <main className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-4">Create an Ambulant+ account</h1>
      <PatientSignupForm redirectOnSuccess="/welcome" />
    </main>
  );
}
