// apps/patient-app/app/call/[roomId]/page.tsx
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;

function toQueryString(searchParams?: SearchParams) {
  const qs = new URLSearchParams();

  Object.entries(searchParams ?? {}).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item) qs.append(key, item);
      });
      return;
    }

    if (value) qs.set(key, value);
  });

  const out = qs.toString();
  return out ? `?${out}` : '';
}

export default function LegacyCallRedirectPage({
  params,
  searchParams,
}: {
  params: { roomId: string };
  searchParams?: SearchParams;
}) {
  const roomId = encodeURIComponent(params.roomId);
  redirect(`/sfu/${roomId}${toQueryString(searchParams)}`);
}