import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

type ClientOrg = {
  id: string;
  name: string;
  legalName?: string | null;
  orgType: string;
  status: string;
  country?: string | null;
  createdAt?: string | null;
  metadata?: Record<string, any> | null;
  users?: Array<{
    id: string;
    email: string;
    name?: string | null;
    role: string;
    status: string;
  }>;
  invitations?: Array<{
    id: string;
    email: string;
    status: string;
    expiresAt: string;
  }>;
};

function apigwBase() {
  const value = String(process.env.APIGW_BASE || process.env.NEXT_PUBLIC_APIGW_BASE || "").trim();

  if (!value) {
    throw new Error("APIGW_BASE_required");
  }

  return value.replace(/\/+$/, "");
}

async function gateway(path: string, init?: RequestInit) {
  const res = await fetch(`${apigwBase()}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      "x-ambulant-role": "SUPER_ADMIN",
      "x-role": "SUPER_ADMIN",
      "x-ambulant-user-id": "admin-dashboard",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  const json = await res.json().catch(() => null);

  if (!res.ok || !json?.ok) {
    throw new Error(json?.error || `Gateway request failed: ${res.status}`);
  }

  return json;
}

async function listPayers(): Promise<ClientOrg[]> {
  try {
    const json = await gateway("/api/admin/payer-onboarding");
    return Array.isArray(json.items) ? json.items : [];
  } catch {
    return [];
  }
}

async function createPayer(formData: FormData) {
  "use server";

  const payload = {
    orgType: String(formData.get("orgType") || "MEDICAL_AID"),
    name: String(formData.get("name") || "").trim(),
    legalName: String(formData.get("legalName") || "").trim(),
    ownerName: String(formData.get("ownerName") || "").trim(),
    ownerEmail: String(formData.get("ownerEmail") || "").trim().toLowerCase(),
    contactPhone: String(formData.get("contactPhone") || "").trim(),
    country: String(formData.get("country") || "ZA").trim().toUpperCase(),
    registrationNo: String(formData.get("registrationNo") || "").trim(),
    marketplaceVisible: formData.get("marketplaceVisible") === "on",
    allowPatientSelfLinking: formData.get("allowPatientSelfLinking") === "on",
    allowPatientApplications: formData.get("allowPatientApplications") === "on",
    allowPlanApplications: formData.get("allowPlanApplications") === "on",
  };

  await gateway("/api/admin/payer-onboarding", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  revalidatePath("/admin/medical-aids");
}

async function approvePayer(formData: FormData) {
  "use server";

  const orgId = String(formData.get("orgId") || "").trim();

  if (!orgId) {
    throw new Error("orgId_required");
  }

  await gateway(`/api/admin/payer-onboarding/${encodeURIComponent(orgId)}/approve`, {
    method: "POST",
    body: JSON.stringify({
      marketplaceVisible: formData.get("marketplaceVisible") === "on",
      allowPatientSelfLinking: formData.get("allowPatientSelfLinking") === "on",
      allowPatientApplications: formData.get("allowPatientApplications") === "on",
      allowPlanApplications: formData.get("allowPlanApplications") === "on",
      selfLinkVerificationMode:
        String(formData.get("selfLinkVerificationMode") || "MANUAL_REVIEW") ||
        "MANUAL_REVIEW",
      integrationMode: String(formData.get("integrationMode") || "PORTAL"),
    }),
  });

  revalidatePath("/admin/medical-aids");
}

export default async function AdminMedicalAidsPage() {
  const payers = await listPayers();
  const pending = payers.filter((p) => String(p.status).toUpperCase() !== "ACTIVE");
  const active = payers.filter((p) => String(p.status).toUpperCase() === "ACTIVE");

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-6">
      <header>
        <div className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">
          Ambulant+ payer onboarding
        </div>
        <h1 className="mt-2 text-3xl font-semibold">Medical Aids & Sponsors</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Create medical aids manually or review public access requests. Portal access remains closed
          until Ambulant+ approves the payer and issues the first owner invitation.
        </p>
      </header>

      <section className="rounded-3xl border bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Admin-led onboarding</h2>
        <form action={createPayer} className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="grid gap-1 text-sm font-semibold">
            Type
            <select name="orgType" className="rounded-xl border px-3 py-2" defaultValue="MEDICAL_AID">
              <option value="MEDICAL_AID">Medical Aid</option>
              <option value="HMO">HMO</option>
              <option value="CORPORATE_SPONSOR">Corporate Sponsor</option>
              <option value="WELLNESS_PARTNER">Wellness Partner</option>
            </select>
          </label>

          <label className="grid gap-1 text-sm font-semibold">
            Name
            <input name="name" required className="rounded-xl border px-3 py-2" />
          </label>

          <label className="grid gap-1 text-sm font-semibold">
            Legal name
            <input name="legalName" className="rounded-xl border px-3 py-2" />
          </label>

          <label className="grid gap-1 text-sm font-semibold">
            Registration number
            <input name="registrationNo" className="rounded-xl border px-3 py-2" />
          </label>

          <label className="grid gap-1 text-sm font-semibold">
            Owner name
            <input name="ownerName" className="rounded-xl border px-3 py-2" />
          </label>

          <label className="grid gap-1 text-sm font-semibold">
            Owner email
            <input name="ownerEmail" type="email" required className="rounded-xl border px-3 py-2" />
          </label>

          <label className="grid gap-1 text-sm font-semibold">
            Phone
            <input name="contactPhone" className="rounded-xl border px-3 py-2" />
          </label>

          <label className="grid gap-1 text-sm font-semibold">
            Country
            <input name="country" defaultValue="ZA" className="rounded-xl border px-3 py-2" />
          </label>

          <div className="md:col-span-2 grid gap-2 rounded-2xl border bg-slate-50 p-4 text-sm">
            <label><input type="checkbox" name="marketplaceVisible" className="mr-2" /> Allow marketplace listing after approval</label>
            <label><input type="checkbox" name="allowPatientSelfLinking" className="mr-2" /> Allow patient self-linking</label>
            <label><input type="checkbox" name="allowPatientApplications" className="mr-2" /> Allow patient applications</label>
            <label><input type="checkbox" name="allowPlanApplications" className="mr-2" /> Allow plan applications</label>
          </div>

          <div className="md:col-span-2">
            <button className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">
              Create payer onboarding record
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-3xl border bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Pending review</h2>
        <div className="mt-4 grid gap-3">
          {pending.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-4 text-sm text-slate-500">
              No pending payer requests.
            </div>
          ) : (
            pending.map((payer) => (
              <article key={payer.id} className="rounded-2xl border p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="text-sm font-semibold">{payer.name}</div>
                    <div className="text-xs text-slate-500">
                      {payer.orgType} Â· {payer.status} Â· {payer.country || "ZA"}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      Owner: {payer.users?.[0]?.email || payer.metadata?.contactEmail || "Not captured"}
                    </div>
                  </div>

                  <form action={approvePayer} className="grid gap-2 rounded-2xl bg-slate-50 p-3 text-xs">
                    <input type="hidden" name="orgId" value={payer.id} />
                    <label>
                      <input type="checkbox" name="marketplaceVisible" className="mr-2" />
                      Marketplace visible
                    </label>
                    <label>
                      <input type="checkbox" name="allowPatientSelfLinking" className="mr-2" />
                      Patient self-linking
                    </label>
                    <label>
                      <input type="checkbox" name="allowPatientApplications" className="mr-2" />
                      Patient applications
                    </label>
                    <label>
                      <input type="checkbox" name="allowPlanApplications" className="mr-2" />
                      Plan applications
                    </label>
                    <select name="selfLinkVerificationMode" className="rounded border px-2 py-1">
                      <option value="MANUAL_REVIEW">Manual review</option>
                      <option value="CSV_MATCH">CSV match</option>
                      <option value="LIVE_API">Live API</option>
                      <option value="DISABLED">Disabled</option>
                    </select>
                    <button className="rounded-xl bg-emerald-700 px-3 py-2 font-semibold text-white">
                      Approve & invite owner
                    </button>
                  </form>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="rounded-3xl border bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Active payer organizations</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {active.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-4 text-sm text-slate-500">
              No active payers yet.
            </div>
          ) : (
            active.map((payer) => (
              <article key={payer.id} className="rounded-2xl border p-4">
                <div className="text-sm font-semibold">{payer.name}</div>
                <div className="text-xs text-slate-500">
                  {payer.orgType} Â· {payer.status}
                </div>
                <div className="mt-2 text-xs text-slate-600">
                  Users: {payer.users?.length || 0} Â· Invitations: {payer.invitations?.length || 0}
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}