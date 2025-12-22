// apps/patient-app/components/plan/PlanModalProvider.tsx
'use client';

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { Plan } from '../../lib/plans';
import PlanModal from './PlanModal';

type OpenArgs = {
  required?: Plan;
  feature?: string;
  reason?: string;
  redirectTo?: string;
};

type Ctx = {
  openPlanModal: (args?: OpenArgs) => void;
  closePlanModal: () => void;
};

const C = createContext<Ctx | null>(null);

export function PlanModalProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [args, setArgs] = useState<OpenArgs>({});

  const openPlanModal = useCallback((a?: OpenArgs) => {
    setArgs(a ?? {});
    setOpen(true);
  }, []);

  const closePlanModal = useCallback(() => setOpen(false), []);

  const value = useMemo(() => ({ openPlanModal, closePlanModal }), [openPlanModal, closePlanModal]);

  return (
    <C.Provider value={value}>
      {children}
      <PlanModal open={open} onClose={closePlanModal} {...args} />
    </C.Provider>
  );
}

export function usePlanModal() {
  const ctx = useContext(C);
  if (!ctx) throw new Error('usePlanModal must be used within PlanModalProvider');
  return ctx;
}
