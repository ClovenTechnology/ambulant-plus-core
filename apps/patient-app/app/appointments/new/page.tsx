import { redirect } from 'next/navigation';

type SearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined) {
  const candidate = Array.isArray(value) ? value[0] : value;
  return String(candidate || '').trim();
}

function fundingValue(searchParams?: SearchParams) {
  const explicit = firstValue(searchParams?.funding).toLowerCase();
  if (['medical_aid', 'medical-aid', 'medicalaid'].includes(explicit)) {
    return 'medical_aid';
  }
  if (explicit === 'voucher') return 'voucher';
  if (explicit === 'card' || explicit === 'self_pay' || explicit === 'self-pay') {
    return 'card';
  }

  const medicalAid = firstValue(searchParams?.medicalAid).toLowerCase();
  if (['1', 'true', 'yes'].includes(medicalAid)) return 'medical_aid';

  return 'medical_aid';
}

export default function LegacyNewAppointmentRoute({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const clinicianId = firstValue(searchParams?.clinicianId);

  if (!clinicianId) {
    redirect('/clinicians');
  }

  const query = new URLSearchParams();
  query.set('type', firstValue(searchParams?.type) === 'followup' ? 'followup' : 'standard');
  query.set('country', firstValue(searchParams?.country) || 'ZA');
  query.set('funding', fundingValue(searchParams));

  const passthrough: Array<[string, string]> = [
    ['caseId', firstValue(searchParams?.caseId)],
    ['subjectPatientId', firstValue(searchParams?.subjectPatientId)],
    ['relationshipId', firstValue(searchParams?.relationshipId)],
  ];

  for (const [key, value] of passthrough) {
    if (value) query.set(key, value);
  }

  redirect(
    `/clinicians/${encodeURIComponent(clinicianId)}/calendar?${query.toString()}`,
  );
}
