"use client";

import { PlanProvider } from "@/components/context/PlanContext";
import { ActiveEncounterProvider } from "@/components/context/ActiveEncounterContext";

type Props = { children: React.ReactNode };

export default function Providers({ children }: Props) {
  return (
    <PlanProvider>
      <ActiveEncounterProvider>
        {children}
      </ActiveEncounterProvider>
    </PlanProvider>
  );
}
