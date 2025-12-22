// apps/clinician-app/app/televisit/join/page.tsx
import { redirect } from 'next/navigation';

export default function TelevisitJoin({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const qs = new URLSearchParams();

  for (const [k, v] of Object.entries(searchParams ?? {})) {
    if (v == null) continue;
    if (Array.isArray(v)) v.forEach((item) => item != null && qs.append(k, String(item)));
    else qs.set(k, String(v));
  }

  const suffix = qs.toString();
  redirect(`/lobby${suffix ? `?${suffix}` : ''}`);
}
