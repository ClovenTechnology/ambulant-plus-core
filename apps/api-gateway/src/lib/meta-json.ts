// apps/api-gateway/src/lib/meta-json.ts

type JsonObject = Record<string, any>;

function parseJsonObject(raw: unknown): JsonObject {
  if (!raw) return {};

  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as JsonObject;
  }

  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed
        : {};
    } catch {
      return {};
    }
  }

  return {};
}

/**
 * Reads the profile JSON payload from ClinicianProfile.meta.
 *
 * Supports both:
 * - meta.rawProfileJson as a JSON string
 * - meta.rawProfile as an object/string
 *
 * If no nested raw profile exists, returns the meta object itself.
 */
export function readProfileJson(clinician: unknown): JsonObject {
  const row = parseJsonObject(clinician);
  const meta = parseJsonObject(row.meta);

  const rawProfileJson = meta.rawProfileJson ?? meta.rawProfile;

  if (!rawProfileJson) return meta;

  if (typeof rawProfileJson === 'object' && !Array.isArray(rawProfileJson)) {
    return rawProfileJson as JsonObject;
  }

  if (typeof rawProfileJson === 'string') {
    return parseJsonObject(rawProfileJson);
  }

  return {};
}

/**
 * Preserves existing ClinicianProfile.meta fields and updates rawProfileJson.
 * Use this when route logic edits the structured profile payload.
 */
export function buildMetaForSave(
  clinician: unknown,
  profileJson: JsonObject,
): JsonObject {
  const row = parseJsonObject(clinician);
  const currentMeta = parseJsonObject(row.meta);

  return {
    ...currentMeta,
    rawProfileJson: JSON.stringify(profileJson ?? {}),
  };
}