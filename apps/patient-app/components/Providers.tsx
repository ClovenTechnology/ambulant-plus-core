"use client";

import type { ReactNode } from "react";
import { ToastProvider } from "../components/ToastMount";
import { ActiveEncounterProvider } from "../components/context/ActiveEncounterContext";
import { PlanProvider } from "../components/context/PlanContext";

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <PlanProvider>
        <ActiveEncounterProvider>{children}</ActiveEncounterProvider>
      </PlanProvider>
    </ToastProvider>
  );
}
