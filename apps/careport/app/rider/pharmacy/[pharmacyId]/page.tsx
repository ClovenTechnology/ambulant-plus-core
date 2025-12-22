import { notFound } from 'next/navigation';

type Pharmacy = {
  id: string;
  name: string;
  city?: string;
  contact?: string;
};

type Job = {
  id: string;
  patient: string;
  status: string;
  address: string;
  eta?: string;
};

async function loadPharmacy(pharmacyId: string): Promise<Pharmacy | null> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL ?? ''}/api/pharmacies/${pharmacyId}`,
    { cache: 'no-store' }
  ).catch(() => null);
  if (!res || !res.ok) return null;
  const data = await res.json();
  return data.pharmacy ?? data;
}

async function loadJobs(pharmacyId: string): Promise<Job[]> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL ?? ''}/api/jobs?pharmacyId=${encodeURIComponent(
      pharmacyId
    )}`,
    { cache: 'no-store' }
  ).catch(() => null);
  if (!res || !res.ok) return [];
  const data = await res.json();
  return Array.isArray(data.jobs) ? data.jobs : [];
}

export default async function PharmacyWorkspacePage({
  params
}: {
  params: { pharmacyId: string };
}) {
  const pharmacyId = params.pharmacyId;
  const [pharmacy, jobs] = await Promise.all([
    loadPharmacy(pharmacyId),
    loadJobs(pharmacyId)
  ]);

  if (!pharmacy) {
    notFound();
  }

  return (
    <main className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{pharmacy.name}</h2>
          <p className="text-xs text-gray-500 mt-1">
            Pharmacy workspace – accept incoming CarePort eRx and see rider status for
            this location.
          </p>
          <div className="text-xs text-gray-400 mt-1">
            Pharmacy ID: <span className="font-mono">{pharmacy.id}</span>
          </div>
        </div>
        <div className="text-right text-xs text-gray-500">
          <div>{pharmacy.city}</div>
          <div>{pharmacy.contact}</div>
        </div>
      </header>

      <section className="bg-white border rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-medium">In-flight orders</h3>
          <span className="text-xs text-gray-500">
            {jobs.length} order{jobs.length === 1 ? '' : 's'}
          </span>
        </div>

        {jobs.length === 0 ? (
          <div className="text-sm text-gray-500">
            No CarePort orders for this pharmacy yet.
          </div>
        ) : (
          <div className="space-y-2">
            {jobs.map((j) => (
              <article
                key={j.id}
                className="border rounded-md p-3 flex items-start justify-between gap-3"
              >
                <div className="text-sm">
                  <div className="font-medium">
                    {j.patient}{' '}
                    <span className="text-xs text-gray-400">• {j.id}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">{j.address}</div>
                </div>
                <div className="text-right text-xs text-gray-500">
                  <div className="uppercase tracking-wide text-[10px] text-gray-400">
                    Status
                  </div>
                  <div className="font-medium">{j.status}</div>
                  <div className="mt-1">ETA: {j.eta ?? '—'}</div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
