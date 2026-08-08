import { redirect } from 'next/navigation';

export default function LegacyClinicianDetailPage({ params }: { params: { id: string } }) {
  redirect(`/admin/clinicians/${encodeURIComponent(params.id)}`);
}
