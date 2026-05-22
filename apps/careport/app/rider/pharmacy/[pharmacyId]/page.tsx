import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function LegacyRiderPharmacyIdPage({
  params,
}: {
  params: { pharmacyId?: string };
}) {
  const pharmacyId = String(params?.pharmacyId || '').trim();

  if (pharmacyId) {
    redirect(`/pharmacy?pharmacyId=${encodeURIComponent(pharmacyId)}`);
  }

  redirect('/pharmacy');
}
