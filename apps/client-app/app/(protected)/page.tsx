import { cookies } from "next/headers";
import { redirect } from "next/navigation";

type SessionPayload = {
  workspace?: "payer_ops" | "corporate_sponsor" | "wellness_partner";
};

function safeParse(value: string | undefined): SessionPayload | null {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export default function HomeRedirect() {
  const cookieStore = cookies();
  const raw = cookieStore.get("ambulant_client_session")?.value;
  const session = safeParse(raw);

  if (!session?.workspace) {
    redirect("/auth/login");
  }

  if (session.workspace === "wellness_partner") {
    redirect("/wellness");
  }

  redirect("/dashboard");
}