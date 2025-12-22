// fallbackMocks.ts

export const medReachMockData = [
  {
    id: 'MR-001',
    patient: 'Jane Doe',
    drug: 'Amoxicillin 500mg',
    sig: '1 tab, 3x/day, 7 days',
    status: 'Preparing',
    eta: '15 mins',
  },
  {
    id: 'MR-002',
    patient: 'John Smith',
    drug: 'Metformin 500mg',
    sig: '1 tab, 2x/day, 30 days',
    status: 'Out for delivery',
    eta: '5 mins',
  },
  {
    id: 'MR-003',
    patient: 'Mary Johnson',
    drug: 'Salbutamol Inhaler',
    sig: '2 puffs, as needed',
    status: 'Collected',
    eta: 'Delivered',
  },
];

export const carePortMockTimeline = [
  { t: '2025-08-08 09:12', msg: 'Pharmacy selected: MedCare Sandton (2.1km from patient)', lat: -26.082, lng: 28.034 },
  { t: '2025-08-08 09:18', msg: 'Rider assigned: Sipho R. (1.0km from pharmacy)', lat: -26.083, lng: 28.036 },
  { t: '2025-08-08 09:33', msg: 'Pharmacy preparing order', lat: -26.084, lng: 28.037 },
  { t: '2025-08-08 09:55', msg: 'Rider picked up order', lat: -26.085, lng: 28.039 },
  { t: '2025-08-08 10:20', msg: 'Out for delivery', lat: -26.086, lng: 28.041 },
];
