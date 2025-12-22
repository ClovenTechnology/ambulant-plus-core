// apps/patient-app/components/context/ActiveEncounterContext.tsx
'use client';

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { encounters as mockEncounters, type Encounter } from '../../mock/encounters';

type ActiveEncounterContextType = {
  encounters: Encounter[];
  activeEncounter: Encounter | null;
  setActiveEncounter: (encounter: Encounter | null) => void;
};

const ActiveEncounterContext = createContext<ActiveEncounterContextType | undefined>(undefined);

export function ActiveEncounterProvider({ children }: { children: ReactNode }) {
  const [activeEncounter, setActiveEncounter] = useState<Encounter | null>(null);

  const value = useMemo(
    () => ({
      encounters: mockEncounters,
      activeEncounter,
      setActiveEncounter,
    }),
    [activeEncounter]
  );

  return <ActiveEncounterContext.Provider value={value}>{children}</ActiveEncounterContext.Provider>;
}

export function useActiveEncounter() {
  const context = useContext(ActiveEncounterContext);
  if (!context) throw new Error('useActiveEncounter must be used within ActiveEncounterProvider');
  return context;
}

// Utility: find encounter by id
export function getEncounterById(id: string): Encounter | undefined {
  return mockEncounters.find((e) => e.id === id);
}

export default ActiveEncounterProvider;
