"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { Encounter, encounters } from "../../mock/encounters";

type ActiveEncounterContextType = {
  activeEncounter: Encounter | null;
  setActiveEncounter: (encounter: Encounter | null) => void;
};

const ActiveEncounterContext = createContext<ActiveEncounterContextType | undefined>(undefined);

export function ActiveEncounterProvider({ children }: { children: ReactNode }) {
  const [activeEncounter, setActiveEncounter] = useState<Encounter | null>(null);

  return (
    <ActiveEncounterContext.Provider value={{ activeEncounter, setActiveEncounter }}>
      {children}
    </ActiveEncounterContext.Provider>
  );
}

export function useActiveEncounter() {
  const context = useContext(ActiveEncounterContext);
  if (!context) throw new Error("useActiveEncounter must be used within ActiveEncounterProvider");
  return context;
}

// Utility: find encounter by id
export function getEncounterById(id: string): Encounter | undefined {
  return encounters.find((e) => e.id === id);
}
export default ActiveEncounterProvider;
