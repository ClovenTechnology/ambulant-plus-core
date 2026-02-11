//apps/clinician-app/lib/insightcore-client.ts
export async function getClinicianAlerts(clinicianId: string) {
  const res = await fetch(
    `/api/insightcore/alerts?clinicianId=${encodeURIComponent(clinicianId)}`,
    { cache: 'no-store' }
  );
  return res.json();
}

export async function getClinicianInsights(clinicianId: string) {
  const res = await fetch(
    `/api/insightcore/insights?clinicianId=${encodeURIComponent(clinicianId)}`,
    { cache: 'no-store' }
  );
  return res.json();
}

export async function getClinicianRisks(clinicianId: string) {
  const res = await fetch(
    `/api/insightcore/risks?clinicianId=${encodeURIComponent(clinicianId)}`,
    { cache: 'no-store' }
  );
  return res.json();
}
