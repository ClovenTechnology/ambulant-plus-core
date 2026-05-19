// apps/patient-app/app/api/encounters/store.ts
/**
 * Production-safe compatibility module.
 *
 * The previous implementation contained in-memory seeded encounter/case mock
 * data. Mock clinical records must not be returned by patient-app.
 *
 * Keep these exports only so any legacy imports continue to compile while
 * returning no fake records.
 */

export type MockClinician = {
  id: string;
  name: string;
  specialty?: string;
};

export type MockEncounter = {
  id: string;
  caseId: string;
  start: string;
  stop?: string;
  mode?: 'chat' | 'audio' | 'video' | 'in-person';
  status?: 'Completed' | 'InProgress' | 'Scheduled';
  clinician?: MockClinician;
  notes?: string;
  devices?: string[];
  caseTitle?: string;
  caseStatus?: 'Open' | 'Closed' | 'Referred';
};

export type MockCase = {
  id: string;
  title?: string;
  status: 'Open' | 'Closed' | 'Referred';
  updatedAt: string;
  encounters: MockEncounter[];
};

export function listCases(): MockCase[] {
  return [];
}

export function listEncounters(): MockEncounter[] {
  return [];
}

export function getCase(_id: string): MockCase | undefined {
  return undefined;
}

export function getEncounter(_id: string): MockEncounter | undefined {
  return undefined;
}

export function addEncounter(_payload: Partial<MockEncounter>): MockEncounter {
  throw new Error('encounter_mock_store_disabled');
}