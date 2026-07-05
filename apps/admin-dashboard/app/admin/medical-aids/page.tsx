import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

type Invitation = {
  id?: string;
  email?: string | null;
  status?: string | null;
  expiresAt?: string | null;
  token?: string | null;
  inviteUrl?: string | null;
};

type ClientOrg = {
  id: string;
  name: string;
  legalName?: string | null;
  orgType: string;
  status: string;
  country?: string | null;
  registrationNo?: string | null;
  createdAt?: string | null;
  metadata?: Record<string, any> | null;
  users?: Array<{
    id: string;
    email: string;
    name?: string | null;
    role: string;
    status: string;
  }>;
  invitations?: Invitation[];
};

type PayerListResult = {
  items: ClientOrg[];
  error?: string;
};

function apigwBase() {
  const value = String(process.env.APIGW_BASE || process.env.NEXT_PUBLIC_APIGW_BASE || "").trim();

  if (!value) {
    throw new Error("APIGW_BASE_required");
  }

  return value.replace(/\/+$/, "");
}

function clientAppBase() {
  return String(
    process.env.CLIENT_APP_BASE_URL ||
      process.env.NEXT_PUBLIC_CLIENT_APP_BASE_URL ||
      "https://clients.ambulantplus.co.za",
  ).replace(/\/+$/, "");
}

function adminSecretHeaders() {
  const secret = String(
    process.env.APIGW_ADMIN_SHARED_SECRET ||
      process.env.ADMIN_INTERNAL_TOKEN ||
      "",
  ).trim();

  return secret ? { "x-ambulant-admin-secret": secret } : {};
}

async function gateway(path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers as HeadersInit | undefined);

  headers.set("content-type", "application/json");
  headers.set("accept", "application/json");
  headers.set("x-ambulant-role", "SUPER_ADMIN");
  headers.set("x-role", "SUPER_ADMIN");
  headers.set("x-admin-role", "SUPER_ADMIN");
  headers.set("x-user-role", "SUPER_ADMIN");
  headers.set("x-ambulant-user-id", "admin-dashboard");

  for (const [key, value] of Object.entries(adminSecretHeaders() as Record<string, string>)) {
    if (value) headers.set(key, value);
  }

  const res = await fetch(`${apigwBase()}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  const text = await res.text().catch(() => "");
  let json: any = null;

  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!res.ok || !json?.ok) {
    const detail =
      json?.error ||
      text.slice(0, 500) ||
      `Gateway request failed with status ${res.status}`;
    throw new Error(detail);
  }

  return json;
}
async function listPayers(): Promise<PayerListResult> {
  try {
    const json = await gateway("/api/admin/payer-onboarding");
    return {
      items: Array.isArray(json.items) ? json.items : [],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "payer_list_failed";
    return {
      items: [],
      error: message,
    };
  }
}

function inviteUrl(invite: Invitation) {
  if (invite.inviteUrl) {
    if (invite.inviteUrl.startsWith("http")) return invite.inviteUrl;
    return `${clientAppBase()}${invite.inviteUrl.startsWith("/") ? "" : "/"}${invite.inviteUrl}`;
  }

  if (invite.token) {
    return `${clientAppBase()}/auth/accept-invite?token=${encodeURIComponent(invite.token)}`;
  }

  return "";
}

function primaryContact(org: ClientOrg) {
  const user = org.users?.[0];
  const meta = org.metadata || {};

  return {
    name: user?.name || meta.contactName || "Owner pending",
    email: user?.email || meta.contactEmail || "",
    status: user?.status || "INVITED",
  };
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
      selfLinkVerificationMode: String(formData.get("selfLinkVerificationMode") || "MANUAL_REVIEW"),
      integrationMode: String(formData.get("integrationMode") || "PORTAL"),
    }),
  });

  revalidatePath("/admin/medical-aids");
}

export default async function AdminMedicalAidsPage() {
  const payerResult = await listPayers();
  const payers = payerResult.items;
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
          Create medical aids manually or review public access requests. Portal access remains
          closed until Ambulant+ approves the payer and issues the first owner invitation.
        </p>
      </header>

      {payerResult.error ? (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <div className="font-semibold">Gateway/listing error</div>
          <p className="mt-1">
            {payerResult.error}
          </p>
          <p className="mt-2 text-xs">
            This is an operational error, not an empty payer list. Check APIGW_BASE, admin route
            authorization and API Gateway deployment.
          </p>
        </section>
      ) : null}

      <section className="rounded-3xl border bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Admin-led onboarding</h2>
        <form action={createPayer} className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="grid gap-1 text-sm font-semibold">
            Type
            <select name="orgType" className="rounded-2xl border px-4 py-3">
              <option value="MEDICAL_AID">Medical Aid</option>
              <option value="HMO">HMO</option>
              <option value="CORPORATE_SPONSOR">Corporate Sponsor</option>
              <option value="WELLNESS_PARTNER">Wellness Partner</option>
            </select>
          </label>

          <label className="grid gap-1 text-sm font-semibold">
            Name
            <input name="name" className="rounded-2xl border px-4 py-3" required />
          </label>

          <label className="grid gap-1 text-sm font-semibold">
            Legal name
            <input name="legalName" className="rounded-2xl border px-4 py-3" />
          </label>

          <label className="grid gap-1 text-sm font-semibold">
            Registration number
            <input name="registrationNo" className="rounded-2xl border px-4 py-3" />
          </label>

          <label className="grid gap-1 text-sm font-semibold">
            Owner name
            <input name="ownerName" className="rounded-2xl border px-4 py-3" required />
          </label>

          <label className="grid gap-1 text-sm font-semibold">
            Owner email
            <input name="ownerEmail" type="email" className="rounded-2xl border px-4 py-3" required />
          </label>

          <label className="grid gap-1 text-sm font-semibold">
            Phone
            <input name="contactPhone" className="rounded-2xl border px-4 py-3" />
          </label>

          <label className="grid gap-1 text-sm font-semibold">
            Country
            <input name="country" defaultValue="ZA" className="rounded-2xl border px-4 py-3" />
          </label>

          <div className="md:col-span-2 rounded-2xl border bg-slate-50 p-4 text-sm">
            <label className="mb-2 flex items-center gap-2">
              <input type="checkbox" name="marketplaceVisible" />
              Allow marketplace listing after approval
            </label>
            <label className="mb-2 flex items-center gap-2">
              <input type="checkbox" name="allowPatientSelfLinking" />
              Allow patient self-linking
            </label>
            <label className="mb-2 flex items-center gap-2">
              <input type="checkbox" name="allowPatientApplications" />
              Allow patient applications
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="allowPlanApplications" />
              Allow plan applications
            </label>
          </div>

          <div className="md:col-span-2">
            <button className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white">
              Create payer onboarding record
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-3xl border bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Pending review</h2>

        {pending.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed p-4 text-sm text-slate-500">
            No pending payer requests.
          </div>
        ) : (
          <div className="mt-4 grid gap-4">
            {pending.map((org) => {
              const contact = primaryContact(org);
              return (
                <article key={org.id} className="rounded-2xl border p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {org.orgType} - {org.status}
                      </div>
                      <h3 className="mt-1 text-lg font-semibold">{org.name}</h3>
                      <p className="text-sm text-slate-600">{org.legalName || "No legal name supplied"}</p>
                      <p className="mt-2 text-sm text-slate-700">
                        Contact: {contact.name}
                        {contact.email ? ` - ${contact.email}` : ""}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Org ID: {org.id}
                      </p>
                    </div>

                    <form action={approvePayer} className="min-w-[280px] rounded-2xl bg-slate-50 p-3 text-sm">
                      <input type="hidden" name="orgId" value={org.id} />
                      <label className="mb-2 flex items-center gap-2">
                        <input type="checkbox" name="marketplaceVisible" />
                        Marketplace visible
                      </label>
                      <label className="mb-2 flex items-center gap-2">
                        <input type="checkbox" name="allowPatientSelfLinking" />
                        Patient self-linking
                      </label>
                      <label className="mb-2 flex items-center gap-2">
                        <input type="checkbox" name="allowPatientApplications" />
                        Patient applications
                      </label>
                      <label className="mb-3 flex items-center gap-2">
                        <input type="checkbox" name="allowPlanApplications" />
                        Plan applications
                      </label>

                      <label className="mb-3 grid gap-1 text-xs font-semibold">
                        Verification mode
                        <select name="selfLinkVerificationMode" className="rounded-xl border px-3 py-2">
                          <option value="MANUAL_REVIEW">Manual review</option>
                          <option value="CSV_MATCH">CSV match</option>
                          <option value="LIVE_API">Live API</option>
                          <option value="DISABLED">Disabled</option>
                        </select>
                      </label>

                      <label className="mb-3 grid gap-1 text-xs font-semibold">
                        Integration mode
                        <select name="integrationMode" className="rounded-xl border px-3 py-2">
                          <option value="PORTAL">Portal</option>
                          <option value="CSV">CSV</option>
                          <option value="API">API</option>
                          <option value="HYBRID">Hybrid</option>
                        </select>
                      </label>

                      <button className="w-full rounded-xl bg-emerald-700 px-4 py-2 font-semibold text-white">
                        Approve and issue invite
                      </button>
                    </form>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-3xl border bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Active payer organizations</h2>

        {active.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed p-4 text-sm text-slate-500">
            No active payers yet.
          </div>
        ) : (
          <div className="mt-4 grid gap-4">
            {active.map((org) => {
              const contact = primaryContact(org);
              const invites = org.invitations || [];
              return (
                <article key={org.id} className="rounded-2xl border p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {org.orgType} - {org.status}
                  </div>
                  <h3 className="mt-1 text-lg font-semibold">{org.name}</h3>
                  <p className="text-sm text-slate-600">{org.legalName || "No legal name supplied"}</p>
                  <p className="mt-2 text-sm text-slate-700">
                    Owner: {contact.name}
                    {contact.email ? ` - ${contact.email}` : ""}
                    {contact.status ? ` - ${contact.status}` : ""}
                  </p>

                  <div className="mt-3 rounded-2xl bg-slate-50 p-3 text-sm">
                    <div className="font-semibold">Owner invite links</div>
                    {invites.length === 0 ? (
                      <p className="mt-1 text-slate-500">
                        No invitation token returned yet. Re-approve or create an org invitation from the client portal.
                      </p>
                    ) : (
                      <div className="mt-2 space-y-2">
                        {invites.map((invite, index) => {
                          const url = inviteUrl(invite);
                          return (
                            <div key={invite.id || `${org.id}-${index}`} className="rounded-xl border bg-white p-3">
                              <div className="text-xs text-slate-500">
                                {invite.email || contact.email || "Invite email unavailable"} - {invite.status || "INVITED"}
                              </div>
                              {url ? (
                                <a className="break-all text-sm font-semibold text-sky-700" href={url}>
                                  {url}
                                </a>
                              ) : (
                                <div className="text-sm text-slate-500">
                                  Invite token unavailable in API response.
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}