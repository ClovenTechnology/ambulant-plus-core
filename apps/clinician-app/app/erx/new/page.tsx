// apps/clinician-app/app/erx/new/page.tsx
import Link from 'next/link';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;

function firstParam(
  searchParams: SearchParams | undefined,
  keys: string[],
): string {
  for (const key of keys) {
    const value = searchParams?.[key];

    if (Array.isArray(value)) {
      const first = value[0]?.trim();
      if (first) return first;
    }

    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
}

function withQuery(pathname: string, query: Record<string, string>) {
  const qs = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value) qs.set(key, value);
  });

  const suffix = qs.toString();

  return suffix ? `${pathname}?${suffix}` : pathname;
}

export default function NewErxPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const roomId = firstParam(searchParams, ['roomId', 'room', 'visitRoom']);
  const encounterId = firstParam(searchParams, ['encounterId', 'encounter', 'id']);
  const appointmentId = firstParam(searchParams, ['apt', 'appointmentId', 'appointment']);

  /*
   * Production rule:
   * eRx must be issued from an encounter/SFU context, not from a weak standalone form.
   *
   * If a caller already knows the SFU room, send them directly into the encounter
   * workspace where ErxComposer has RxNorm/ICD-10/allergy/claim context.
   */
  if (roomId) {
    redirect(
      withQuery(`/sfu/${encodeURIComponent(roomId)}`, {
        encounterId,
        appointmentId,
      }),
    );
  }

  return (
    <main className="mx-auto max-w-3xl space-y-5 p-6">
      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          eRx workflow updated
        </div>

        <h1 className="mt-2 text-xl font-semibold text-slate-950">
          Start eRx from an active consultation
        </h1>

        <p className="mt-2 text-sm leading-6 text-slate-600">
          Standalone eRx creation has been retired for production safety. Prescriptions
          should now be issued from the active televisit or encounter workspace so the
          system can include the patient, clinician, encounter, allergies, RxNorm,
          ICD-10, CarePort, MedReach and payer-context data.
        </p>

        {(appointmentId || encounterId) && (
          <div className="mt-4 rounded-xl border bg-slate-50 p-3 text-sm">
            <div className="font-medium text-slate-800">Request context received</div>

            <div className="mt-2 grid gap-1 text-xs text-slate-600">
              {appointmentId && (
                <div>
                  Appointment:{' '}
                  <span className="font-mono text-slate-900">{appointmentId}</span>
                </div>
              )}

              {encounterId && (
                <div>
                  Encounter:{' '}
                  <span className="font-mono text-slate-900">{encounterId}</span>
                </div>
              )}
            </div>

            <p className="mt-2 text-xs text-slate-500">
              Open the associated consultation/encounter and use the embedded eRx
              composer there.
            </p>
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href="/calendar"
            className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-black/90"
          >
            Open calendar
          </Link>

          <Link
            href="/encounters"
            className="rounded-lg border bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
          >
            Open encounters
          </Link>

          <Link
            href="/call-links"
            className="rounded-lg border bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
          >
            Open call links
          </Link>
        </div>
      </section>

      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <div className="font-semibold">Production note</div>
        <p className="mt-1 leading-6">
          This page no longer sends prescriptions directly to <span className="font-mono">/api/erx</span>.
          The active eRx path should remain encounter-scoped through the SFU composer.
        </p>
      </section>
    </main>
  );
}