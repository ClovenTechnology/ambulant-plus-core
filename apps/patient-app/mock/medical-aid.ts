// apps/patient-app/mock/medical-aid.ts
export type MedicalAidPlan = { id: string; name: string; tiers: string[] };

export const MEDICAL_AIDS: MedicalAidPlan[] = [
  {
    id: 'discovery',
    name: 'Discovery Health',
    tiers: ['KeyCare', 'Smart', 'Essential', 'Classic', 'Executive'],
  },
  {
    id: 'bonitas',
    name: 'Bonitas',
    tiers: ['BonStart', 'BonFit Select', 'BonSave', 'BonComplete', 'BonClassic'],
  },
  {
    id: 'momentum',
    name: 'Momentum',
    tiers: ['Evolve', 'Custom', 'Incentive', 'Extender', 'Summit'],
  },
  {
    id: 'medshield',
    name: 'Medshield',
    tiers: ['MediValue', 'MediCore', 'MediPlus', 'MediBonus', 'MediSaver'],
  },
  {
    id: 'gems',
    name: 'GEMS',
    tiers: ['Sapphire', 'Beryl', 'Ruby', 'Emerald Value', 'Onyx'],
  },
];
