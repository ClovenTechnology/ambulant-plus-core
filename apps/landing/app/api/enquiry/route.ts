import { NextRequest, NextResponse } from "next/server";

type EnquiryType =
  | "general"
  | "demo"
  | "partnerships"
  | "clinician_onboarding"
  | "patient_support"
  | "medreach_labs"
  | "medreach_phlebotomists"
  | "careport_pharmacies"
  | "careport_riders"
  | "training"
  | "careers"
  | "franchise";

type EnquiryPayload = {
  enquiryType?: EnquiryType;
  name?: string;
  email?: string;
  phone?: string;
  organisation?: string;
  role?: string;
  country?: string;
  message?: string;
  consent?: boolean;
  companyWebsite?: string;
};

const enquiryTypeLabels: Record<EnquiryType, string> = {
  general: "General enquiry",
  demo: "Demo request",
  partnerships: "Partnerships / enterprise",
  clinician_onboarding: "Clinician onboarding",
  patient_support: "Patient support",
  medreach_labs: "MedReach laboratory onboarding",
  medreach_phlebotomists: "MedReach phlebotomist onboarding",
  careport_pharmacies: "CarePort pharmacy onboarding",
  careport_riders: "CarePort rider onboarding",
  training: "Training",
  careers: "Careers",
  franchise: "Franchise / international expansion",
};

const recipients: Record<EnquiryType, string> = {
  general: process.env.CONTACT_GENERAL_TO || "hello@ambulantplus.co.za",
  demo: process.env.CONTACT_DEMO_TO || "demos@ambulantplus.co.za",
  partnerships: process.env.CONTACT_PARTNERS_TO || "partners@ambulantplus.co.za",
  clinician_onboarding:
    process.env.CONTACT_TRAINING_TO || "training@ambulantplus.co.za",
  patient_support: process.env.CONTACT_SUPPORT_TO || "support@ambulantplus.co.za",
  medreach_labs: process.env.CONTACT_PARTNERS_TO || "partners@ambulantplus.co.za",
  medreach_phlebotomists:
    process.env.CONTACT_PARTNERS_TO || "partners@ambulantplus.co.za",
  careport_pharmacies:
    process.env.CONTACT_PARTNERS_TO || "partners@ambulantplus.co.za",
  careport_riders:
    process.env.CONTACT_PARTNERS_TO || "partners@ambulantplus.co.za",
  training: process.env.CONTACT_TRAINING_TO || "training@ambulantplus.co.za",
  careers: process.env.CONTACT_CAREERS_TO || "careers@ambulantplus.co.za",
  franchise: process.env.CONTACT_FRANCHISE_TO || "partners@ambulantplus.co.za",
};

function clean(value: unknown, max = 2000): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

function cleanMultiline(value: unknown, max = 5000): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

function makeTextEmail(payload: Required<Omit<EnquiryPayload, "companyWebsite">>) {
  const label = enquiryTypeLabels[payload.enquiryType];

  return [
    `New Ambulant+ enquiry: ${label}`,
    "",
    `Name: ${payload.name}`,
    `Email: ${payload.email}`,
    `Phone: ${payload.phone || "Not provided"}`,
    `Organisation: ${payload.organisation || "Not provided"}`,
    `Role: ${payload.role || "Not provided"}`,
    `Country: ${payload.country || "Not provided"}`,
    "",
    "Message:",
    payload.message,
  ].join("\n");
}

function makeHtmlEmail(payload: Required<Omit<EnquiryPayload, "companyWebsite">>) {
  const label = enquiryTypeLabels[payload.enquiryType];

  const rows = [
    ["Enquiry type", label],
    ["Name", payload.name],
    ["Email", payload.email],
    ["Phone", payload.phone || "Not provided"],
    ["Organisation", payload.organisation || "Not provided"],
    ["Role", payload.role || "Not provided"],
    ["Country", payload.country || "Not provided"],
  ];

  return `
    <div style="font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f172a;line-height:1.6;font-size:14px;">
      <div style="max-width:680px;margin:0 auto;border:1px solid #e2e8f0;border-radius:20px;overflow:hidden;">
        <div style="background:#020617;color:white;padding:24px;">
          <div style="font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#67e8f9;font-weight:700;">
            Ambulant+ enquiry
          </div>
          <h1 style="margin:10px 0 0;font-size:24px;line-height:1.25;">${escapeHtml(label)}</h1>
        </div>

        <div style="padding:24px;background:#ffffff;">
          <table style="width:100%;border-collapse:collapse;">
            <tbody>
              ${rows
                .map(
                  ([key, value]) => `
                    <tr>
                      <td style="width:160px;padding:10px 0;border-bottom:1px solid #f1f5f9;color:#64748b;font-weight:700;">${escapeHtml(
                        key,
                      )}</td>
                      <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;color:#0f172a;">${escapeHtml(
                        value,
                      )}</td>
                    </tr>
                  `,
                )
                .join("")}
            </tbody>
          </table>

          <div style="margin-top:24px;">
            <div style="font-weight:700;color:#0f172a;margin-bottom:8px;">Message</div>
            <div style="white-space:pre-wrap;background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;padding:16px;color:#334155;">${escapeHtml(
              payload.message,
            )}</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

export async function POST(req: NextRequest) {
  try {
    const resendApiKey = process.env.RESEND_API_KEY;

    if (!resendApiKey) {
      return NextResponse.json(
        { ok: false, error: "Email service is not configured." },
        { status: 503 },
      );
    }

    const raw = (await req.json().catch(() => null)) as EnquiryPayload | null;

    if (!raw || typeof raw !== "object") {
      return NextResponse.json(
        { ok: false, error: "Invalid request." },
        { status: 400 },
      );
    }

    if (clean(raw.companyWebsite, 300)) {
      return NextResponse.json({ ok: true });
    }

    const enquiryType = raw.enquiryType && raw.enquiryType in enquiryTypeLabels
      ? raw.enquiryType
      : "general";

    const name = clean(raw.name, 120);
    const email = clean(raw.email, 180).toLowerCase();
    const phone = clean(raw.phone, 80);
    const organisation = clean(raw.organisation, 160);
    const role = clean(raw.role, 120);
    const country = clean(raw.country, 120);
    const message = cleanMultiline(raw.message, 5000);

    if (!name || name.length < 2) {
      return NextResponse.json(
        { ok: false, error: "Please enter your name." },
        { status: 400 },
      );
    }

    if (!email || !isEmail(email)) {
      return NextResponse.json(
        { ok: false, error: "Please enter a valid email address." },
        { status: 400 },
      );
    }

    if (!message || message.length < 20) {
      return NextResponse.json(
        { ok: false, error: "Please enter a message with at least 20 characters." },
        { status: 400 },
      );
    }

    if (!raw.consent) {
      return NextResponse.json(
        { ok: false, error: "Please confirm that Ambulant+ may contact you." },
        { status: 400 },
      );
    }

    const payload = {
      enquiryType,
      name,
      email,
      phone,
      organisation,
      role,
      country,
      message,
      consent: true,
    } satisfies Required<Omit<EnquiryPayload, "companyWebsite">>;

    const recipient = recipients[enquiryType];
    const label = enquiryTypeLabels[enquiryType];

    const from =
      process.env.CONTACT_EMAIL_FROM ||
      "Ambulant+ <no-reply@ambulantplus.co.za>";

    const auditBcc = process.env.CONTACT_AUDIT_BCC || "";
    const clientIp = getClientIp(req);

    const subject = `[Ambulant+] ${label} from ${name}`;

    const html =
      makeHtmlEmail(payload) +
      `<div style="font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#64748b;font-size:12px;margin-top:16px;">Client IP: ${escapeHtml(
        clientIp,
      )}</div>`;

    const text = `${makeTextEmail(payload)}\n\nClient IP: ${clientIp}`;

    const resendPayload: Record<string, unknown> = {
      from,
      to: [recipient],
      subject,
      html,
      text,
      reply_to: email,
      tags: [
        { name: "source", value: "landing_site" },
        { name: "type", value: enquiryType },
      ],
    };

    if (auditBcc) {
      resendPayload.bcc = auditBcc
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(resendPayload),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("[enquiry] resend failed", res.status, detail);

      return NextResponse.json(
        { ok: false, error: "Unable to send enquiry at the moment." },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[enquiry] unexpected error", error);

    return NextResponse.json(
      { ok: false, error: "Unexpected error while sending enquiry." },
      { status: 500 },
    );
  }
}