// apps/patient-app/mock/encounters.ts
export type Encounter = {
  id: string;
  date: string;
  reason: string;
  clinician: string;
};

export const encounters: Encounter[] = [
  {
    id: "enc-001",
    date: "2025-08-01",
    reason: "General Checkup",
    clinician: "Dr. Adeyemi",
  },
  {
    id: "enc-002",
    date: "2025-08-05",
    reason: "Follow-up on Hypertension",
    clinician: "Dr. Khumalo",
  },
  {
    id: "enc-003",
    date: "2025-08-10",
    reason: "Chest Pain",
    clinician: "Dr. Pillay",
  },
];
