import { redirect } from 'next/navigation';

type SearchParams =
  Record<string, string | string[] | undefined>;

function firstValue(
  ...values: Array<string | string[] | undefined>
) {
  for (const value of values) {
    const candidate = Array.isArray(value)
      ? value[0]
      : value;

    const clean = String(candidate || '').trim();
    if (clean) return clean;
  }

  return '';
}

export default function LegacyTelevisitRoute({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const appointmentId = firstValue(
    searchParams?.appointmentId,
    searchParams?.appointment,
    searchParams?.appt,
  );

  if (appointmentId) {
    redirect(
      `/lobby?appointmentId=${encodeURIComponent(
        appointmentId,
      )}`,
    );
  }

  redirect('/televisit');
}
