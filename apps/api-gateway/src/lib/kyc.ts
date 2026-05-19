// FILE: apps/api-gateway/src/lib/kyc.ts
import { z } from "zod";

export type CountryCode = "ZA" | "GH" | "KE" | "NG";
export type CurrencyCode = "ZAR" | "GHS" | "KES" | "NGN" | "USD" | "EUR";

export const COUNTRY_CONFIG: Record<CountryCode, { currency: CurrencyCode; regulator: string }> = {
  ZA: { currency: "ZAR", regulator: "SAPC" },
  GH: { currency: "GHS", regulator: "TBD_GH_REGULATOR" },
  KE: { currency: "KES", regulator: "TBD_KE_REGULATOR" },
  NG: { currency: "NGN", regulator: "TBD_NG_REGULATOR" },
};

export const ZA_SAPC_PHARMACY_v1 = z.object({
  sapcRegistrationNumber: z.string().min(3).max(64),
  practiceNumber: z.string().min(3).max(64),
  pharmacyNameLegal: z.string().min(2).max(160),
  ownerIdNumber: z.string().min(5).max(64),
  contactEmail: z.string().email(),
});

export const ZA_RIDER_KYI_v1 = z.object({
  idNumber: z.string().min(5).max(64),
  driverLicenseNumber: z.string().min(5).max(64),
  vehicleType: z.enum(["bike", "car", "scooter", "other"]),
  insurancePolicyNumber: z.string().min(3).max(64).optional(),
});

export type SchemaKey =
  | "ZA_SAPC_PHARMACY_v1"
  | "ZA_RIDER_KYI_v1";

export function listSchemas(country: CountryCode) {
  const cfg = COUNTRY_CONFIG[country];
  return {
    country,
    currency: cfg.currency,
    regulator: cfg.regulator,
    pharmacy: [
      {
        key: "ZA_SAPC_PHARMACY_v1",
        label: "South Africa (SAPC) Pharmacy KYC",
        fields: [
          { name: "sapcRegistrationNumber", label: "SAPC Registration Number", required: true },
          { name: "practiceNumber", label: "Practice Number", required: true },
          { name: "pharmacyNameLegal", label: "Legal Pharmacy Name", required: true },
          { name: "ownerIdNumber", label: "Owner/Responsible Pharmacist ID", required: true },
          { name: "contactEmail", label: "Contact Email", required: true },
        ],
      },
    ],
    rider: [
      {
        key: "ZA_RIDER_KYI_v1",
        label: "South Africa Rider KYI",
        fields: [
          { name: "idNumber", label: "ID Number", required: true },
          { name: "driverLicenseNumber", label: "Driver License Number", required: true },
          { name: "vehicleType", label: "Vehicle Type", required: true },
          { name: "insurancePolicyNumber", label: "Insurance Policy Number", required: false },
        ],
      },
    ],
  };
}

export function validatePharmacyKyc(country: CountryCode, schemaKey: SchemaKey, payload: unknown) {
  if (country !== "ZA" || schemaKey !== "ZA_SAPC_PHARMACY_v1") {
    return { ok: false, errors: [{ message: "unsupported_country_or_schema" }] };
  }
  const parsed = ZA_SAPC_PHARMACY_v1.safeParse(payload);
  return parsed.success ? { ok: true, data: parsed.data } : { ok: false, errors: parsed.error.issues };
}

export function validateRiderKyi(country: CountryCode, schemaKey: SchemaKey, payload: unknown) {
  if (country !== "ZA" || schemaKey !== "ZA_RIDER_KYI_v1") {
    return { ok: false, errors: [{ message: "unsupported_country_or_schema" }] };
  }
  const parsed = ZA_RIDER_KYI_v1.safeParse(payload);
  return parsed.success ? { ok: true, data: parsed.data } : { ok: false, errors: parsed.error.issues };
}