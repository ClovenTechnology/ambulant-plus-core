// apps/patient-app/app/room/[id]/page.tsx
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function LegacyRoomRedirectPage({
  params,
}: {
  params: { id: string };
}) {
  redirect(`/sfu/${encodeURIComponent(params.id)}`);
}