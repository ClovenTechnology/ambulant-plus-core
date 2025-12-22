// apps/patient-app/mock/medical-aid/by-country.ts
import type { MedicalAidPlan } from './types';

export const MEDICAL_AIDS_BY_COUNTRY: Record<string, MedicalAidPlan[]> = {
  ZA: [
    { id: 'discovery', name: 'Discovery Health', tiers: ['KeyCare', 'Smart', 'Essential', 'Classic', 'Executive'], countryCode: 'ZA', kind: 'medical_aid' },
    { id: 'bonitas', name: 'Bonitas', tiers: ['BonStart', 'BonFit Select', 'BonSave', 'BonComplete', 'BonClassic'], countryCode: 'ZA', kind: 'medical_aid' },
    { id: 'momentum', name: 'Momentum Health', tiers: ['Evolve', 'Custom', 'Incentive', 'Extender', 'Summit'], countryCode: 'ZA', kind: 'medical_aid' },
    { id: 'medshield', name: 'Medshield', tiers: ['MediValue', 'MediCore', 'MediPlus', 'MediBonus', 'MediSaver'], countryCode: 'ZA', kind: 'medical_aid' },
    { id: 'gems', name: 'GEMS', tiers: ['Sapphire', 'Beryl', 'Ruby', 'Emerald Value', 'Onyx'], countryCode: 'ZA', kind: 'medical_aid' },
  ],

  NG: [
    { id: 'nhia', name: 'National Health Insurance (public)', tiers: ['Basic'], countryCode: 'NG', kind: 'public' },
    { id: 'hygeia', name: 'Hygeia HMO', tiers: ['Bronze', 'Silver', 'Gold', 'Platinum'], countryCode: 'NG', kind: 'hmo' },
    { id: 'axa_mansard', name: 'AXA Mansard', tiers: ['Essential', 'Standard', 'Premium'], countryCode: 'NG', kind: 'insurer' },
    { id: 'reliance_hmo', name: 'Reliance HMO', tiers: ['Basic', 'Plus', 'Family'], countryCode: 'NG', kind: 'hmo' },
    { id: 'leadway', name: 'Leadway Health', tiers: ['Standard', 'Enhanced'], countryCode: 'NG', kind: 'insurer' },
  ],

  KE: [
    { id: 'public_ke', name: 'Public health cover (national)', tiers: ['Basic'], countryCode: 'KE', kind: 'public' },
    { id: 'jubilee', name: 'Jubilee Health', tiers: ['Bronze', 'Silver', 'Gold'], countryCode: 'KE', kind: 'insurer' },
    { id: 'aar', name: 'AAR Health', tiers: ['Core', 'Plus', 'Premium'], countryCode: 'KE', kind: 'insurer' },
    { id: 'britam', name: 'Britam Health', tiers: ['Essential', 'Comprehensive'], countryCode: 'KE', kind: 'insurer' },
    { id: 'apa', name: 'APA Insurance', tiers: ['Standard', 'Enhanced'], countryCode: 'KE', kind: 'insurer' },
  ],

  GH: [
    { id: 'nhis_gh', name: 'National Health Insurance (public)', tiers: ['Basic'], countryCode: 'GH', kind: 'public' },
    { id: 'enterprise', name: 'Enterprise Health Cover', tiers: ['Standard', 'Plus'], countryCode: 'GH', kind: 'insurer' },
    { id: 'hollard', name: 'Hollard Health Cover', tiers: ['Standard', 'Premium'], countryCode: 'GH', kind: 'insurer' },
    { id: 'vanguard', name: 'Vanguard Health Cover', tiers: ['Basic', 'Enhanced'], countryCode: 'GH', kind: 'insurer' },
  ],

  BW: [
    { id: 'public_bw', name: 'Public health services (state)', tiers: ['Basic'], countryCode: 'BW', kind: 'public' },
    { id: 'bomaid', name: 'BOMAID', tiers: ['Standard', 'Comprehensive'], countryCode: 'BW', kind: 'medical_aid' },
    { id: 'pula_med', name: 'Pula Medical Cover', tiers: ['Basic', 'Plus'], countryCode: 'BW', kind: 'insurer' },
  ],

  ZW: [
    { id: 'public_zw', name: 'Public health services (state)', tiers: ['Basic'], countryCode: 'ZW', kind: 'public' },
    { id: 'cimas', name: 'CIMAS', tiers: ['Select', 'Comprehensive'], countryCode: 'ZW', kind: 'medical_aid' },
    { id: 'psmas', name: 'PSMAS', tiers: ['Standard', 'Plus'], countryCode: 'ZW', kind: 'medical_aid' },
    { id: 'first_mutual', name: 'First Mutual Health', tiers: ['Basic', 'Enhanced'], countryCode: 'ZW', kind: 'insurer' },
  ],

  CD: [
    { id: 'public_cd', name: 'Public health services (state)', tiers: ['Basic'], countryCode: 'CD', kind: 'public' },
    { id: 'mutuelle_cd', name: 'Mutuelle Santé (community)', tiers: ['Standard'], countryCode: 'CD', kind: 'other' },
    { id: 'private_cd', name: 'Private Health Cover', tiers: ['Standard', 'Premium'], countryCode: 'CD', kind: 'insurer' },
  ],

  BR: [
    { id: 'sus', name: 'SUS (public health system)', tiers: ['Basic'], countryCode: 'BR', kind: 'public' },
    { id: 'unimed', name: 'Unimed', tiers: ['Regional', 'National'], countryCode: 'BR', kind: 'insurer' },
    { id: 'bradesco', name: 'Bradesco Saúde', tiers: ['Standard', 'Premium'], countryCode: 'BR', kind: 'insurer' },
    { id: 'sulamerica', name: 'SulAmérica Saúde', tiers: ['Standard', 'Premium'], countryCode: 'BR', kind: 'insurer' },
    { id: 'amil', name: 'Amil', tiers: ['Bronze', 'Silver', 'Gold'], countryCode: 'BR', kind: 'insurer' },
  ],

  AR: [
    { id: 'public_ar', name: 'Public health cover', tiers: ['Basic'], countryCode: 'AR', kind: 'public' },
    { id: 'osde', name: 'OSDE', tiers: ['210', '310', '410', '510'], countryCode: 'AR', kind: 'insurer' },
    { id: 'swiss_med', name: 'Swiss Medical', tiers: ['SMG20', 'SMG30', 'SMG40'], countryCode: 'AR', kind: 'insurer' },
    { id: 'galeno', name: 'Galeno', tiers: ['Azul', 'Oro'], countryCode: 'AR', kind: 'insurer' },
  ],

  NZ: [
    { id: 'public_nz', name: 'Public health cover', tiers: ['Basic'], countryCode: 'NZ', kind: 'public' },
    { id: 'southern_cross', name: 'Southern Cross', tiers: ['Wellbeing One', 'Wellbeing Two'], countryCode: 'NZ', kind: 'insurer' },
    { id: 'nib_nz', name: 'nib', tiers: ['Basic', 'Standard', 'Premium'], countryCode: 'NZ', kind: 'insurer' },
    { id: 'aia_nz', name: 'AIA', tiers: ['Standard', 'Enhanced'], countryCode: 'NZ', kind: 'insurer' },
  ],

  GB: [
    { id: 'nhs', name: 'NHS (public)', tiers: ['Basic'], countryCode: 'GB', kind: 'public' },
    { id: 'bupa_gb', name: 'Bupa', tiers: ['Essential', 'Comprehensive'], countryCode: 'GB', kind: 'insurer' },
    { id: 'axa_gb', name: 'AXA Health', tiers: ['Standard', 'Premium'], countryCode: 'GB', kind: 'insurer' },
    { id: 'vitality_gb', name: 'Vitality', tiers: ['Core', 'Plus'], countryCode: 'GB', kind: 'insurer' },
    { id: 'aviva_gb', name: 'Aviva', tiers: ['Standard', 'Enhanced'], countryCode: 'GB', kind: 'insurer' },
  ],

  US: [
    { id: 'medicare', name: 'Medicare (public)', tiers: ['Part A', 'Part B', 'Part C', 'Part D'], countryCode: 'US', kind: 'public' },
    { id: 'medicaid', name: 'Medicaid (public)', tiers: ['State program'], countryCode: 'US', kind: 'public' },
    { id: 'bcbs', name: 'Blue Cross / Blue Shield', tiers: ['PPO', 'HMO', 'EPO'], countryCode: 'US', kind: 'insurer' },
    { id: 'uhc', name: 'UnitedHealthcare', tiers: ['Bronze', 'Silver', 'Gold'], countryCode: 'US', kind: 'insurer' },
    { id: 'aetna', name: 'Aetna', tiers: ['Bronze', 'Silver', 'Gold'], countryCode: 'US', kind: 'insurer' },
  ],

  CA: [
    { id: 'public_ca', name: 'Provincial health coverage (public)', tiers: ['Basic'], countryCode: 'CA', kind: 'public' },
    { id: 'sun_life', name: 'Sun Life', tiers: ['Standard', 'Enhanced'], countryCode: 'CA', kind: 'insurer' },
    { id: 'manulife', name: 'Manulife', tiers: ['Standard', 'Enhanced'], countryCode: 'CA', kind: 'insurer' },
    { id: 'blue_cross_ca', name: 'Blue Cross', tiers: ['Standard', 'Comprehensive'], countryCode: 'CA', kind: 'insurer' },
  ],

  AE: [
    { id: 'public_ae', name: 'Mandatory health insurance (regional/public)', tiers: ['Basic'], countryCode: 'AE', kind: 'public' },
    { id: 'daman', name: 'Daman', tiers: ['Basic', 'Enhanced', 'Premier'], countryCode: 'AE', kind: 'insurer' },
    { id: 'adnic', name: 'ADNIC', tiers: ['Standard', 'Premium'], countryCode: 'AE', kind: 'insurer' },
    { id: 'axa_gulf', name: 'AXA Gulf', tiers: ['Standard', 'Premium'], countryCode: 'AE', kind: 'insurer' },
  ],

  SA: [
    { id: 'public_sa', name: 'Public health services (state)', tiers: ['Basic'], countryCode: 'SA', kind: 'public' },
    { id: 'bupa_sa', name: 'Bupa Arabia', tiers: ['Standard', 'Premium'], countryCode: 'SA', kind: 'insurer' },
    { id: 'tawuniya', name: 'Tawuniya', tiers: ['Standard', 'Enhanced'], countryCode: 'SA', kind: 'insurer' },
    { id: 'medgulf', name: 'MedGulf', tiers: ['Standard', 'Premium'], countryCode: 'SA', kind: 'insurer' },
  ],

  AU: [
    { id: 'medicare_au', name: 'Medicare (public)', tiers: ['Basic'], countryCode: 'AU', kind: 'public' },
    { id: 'medibank', name: 'Medibank', tiers: ['Bronze', 'Silver', 'Gold'], countryCode: 'AU', kind: 'insurer' },
    { id: 'bupa_au', name: 'Bupa', tiers: ['Bronze', 'Silver', 'Gold'], countryCode: 'AU', kind: 'insurer' },
    { id: 'hcf', name: 'HCF', tiers: ['Bronze', 'Silver', 'Gold'], countryCode: 'AU', kind: 'insurer' },
  ],

  CU: [
    { id: 'public_cu', name: 'National health system (public)', tiers: ['Basic'], countryCode: 'CU', kind: 'public' },
    { id: 'visitor_cover', name: 'Visitor / travel health cover', tiers: ['Standard', 'Premium'], countryCode: 'CU', kind: 'other' },
  ],

  SG: [
    { id: 'medishield', name: 'MediShield Life (public)', tiers: ['Basic'], countryCode: 'SG', kind: 'public' },
    { id: 'aia_sg', name: 'AIA Integrated Shield', tiers: ['Standard', 'Enhanced'], countryCode: 'SG', kind: 'insurer' },
    { id: 'great_eastern', name: 'Great Eastern Integrated Shield', tiers: ['Standard', 'Enhanced'], countryCode: 'SG', kind: 'insurer' },
    { id: 'prudential', name: 'Prudential Integrated Shield', tiers: ['Standard', 'Enhanced'], countryCode: 'SG', kind: 'insurer' },
  ],

  JM: [
    { id: 'public_jm', name: 'Public health services (state)', tiers: ['Basic'], countryCode: 'JM', kind: 'public' },
    { id: 'sagicor_jm', name: 'Sagicor Health', tiers: ['Standard', 'Premium'], countryCode: 'JM', kind: 'insurer' },
    { id: 'guardian', name: 'Guardian Life Health', tiers: ['Standard', 'Enhanced'], countryCode: 'JM', kind: 'insurer' },
  ],

  DM: [
    { id: 'public_dm', name: 'Public health services (state)', tiers: ['Basic'], countryCode: 'DM', kind: 'public' },
    { id: 'caribbean_private', name: 'Private Caribbean Health Cover', tiers: ['Standard', 'Premium'], countryCode: 'DM', kind: 'insurer' },
  ],
};
