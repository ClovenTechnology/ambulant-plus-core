// apps/patient-app/mock/practices.ts
// ✅ Safe plug-and-play: returns mock practices per country

export const PRACTICES_BY_COUNTRY: Record<string, any[]> = {
  ZA: [
    { id: 'za1', name: 'Sunrise Clinic', kind: 'clinic', location: 'Cape Town' },
    { id: 'za2', name: 'Health Team SA', kind: 'team', location: 'Johannesburg' },
  ],
  NG: [
    { id: 'ng1', name: 'Lagos Clinic', kind: 'clinic', location: 'Lagos' },
  ],
  // Add more countries here if needed
};

export function getMockPracticesForCountry(country: string) {
  // Return practices if they exist, otherwise fallback to ZA
  return PRACTICES_BY_COUNTRY[country] ?? PRACTICES_BY_COUNTRY.ZA;
}
