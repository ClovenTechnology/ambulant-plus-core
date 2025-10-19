// apps/patient-app/components/AllergiesBlock.tsx
'use client';

import React, { useState } from 'react';
import AllergiesPanel from './AllergiesPanel';
import type { Allergy } from '@/types';

interface AllergiesBlockProps {
  allergies?: Allergy[];
}

export default function AllergiesBlock({ allergies = [] }: AllergiesBlockProps) {
  const [data, setData] = useState<Allergy[]>(Array.isArray(allergies) ? allergies : []);

  const handleRefresh = () => {
    // This local wrapper provides a no-op refresh; prefer using AllergiesBlockWrapper which fetches from API.
    setData([...data]);
  };

  const handleExport = () => {
    console.log('Exporting allergies (local)');
    window.location.href = '/allergies/print';
  };

  return (
    <AllergiesPanel
      allergies={data}
      loading={false}
      onRefresh={handleRefresh}
      onExport={handleExport}
    />
  );
}
