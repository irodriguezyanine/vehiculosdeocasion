import {
  mapGlo3dEditorDetailsToRawFields,
  mapGlo3dSpecMapToEditorDetails,
  normalizeGlo3dSpecKey,
} from "@/lib/glo3d-field-map";
import type { EditorVehicleDetails } from "@/types/editor";

const SPEC_CONTAINER_KEYS = [
  "custom_specs",
  "customSpecs",
  "custom_fields",
  "customFields",
  "inventory_fields",
  "inventoryFields",
  "fields",
  "specs",
  "vehicle_specs",
  "vehicleSpecs",
  "additional_fields",
  "additionalFields",
  "user_fields",
  "userFields",
  "data_fields",
  "dataFields",
  "pins",
  "verticals",
  "custom",
  "metadata",
];

function pickScalarString(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "SI" : "NO";
  return undefined;
}

function extractScalarValue(value: unknown): string | undefined {
  const direct = pickScalarString(value);
  if (direct) return direct;
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    return (
      pickScalarString(record.value) ??
      pickScalarString(record.field_value) ??
      pickScalarString(record.val) ??
      pickScalarString(record.content) ??
      pickScalarString(record.text) ??
      pickScalarString(record.display_value) ??
      pickScalarString(record.label_value)
    );
  }
  return undefined;
}

function flattenNestedObject(obj: unknown, prefix = ""): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (obj == null || typeof obj !== "object" || Array.isArray(obj)) return out;

  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const flatKey = prefix ? `${prefix}_${key}` : key;
    if (value != null && typeof value === "object" && !Array.isArray(value)) {
      Object.assign(out, flattenNestedObject(value, flatKey));
    } else if (value != null && value !== "") {
      out[flatKey] = value;
    }
  }

  return out;
}

function assignSpecValue(
  result: Record<string, string>,
  key: string,
  value: string,
): void {
  const trimmed = value.trim();
  if (!key.trim() || !trimmed) return;

  const literal = key.trim();
  const normalized = normalizeGlo3dSpecKey(key);

  if (!(literal.toLowerCase() in result)) result[literal.toLowerCase()] = trimmed;
  if (literal !== literal.toLowerCase() && !(literal in result)) result[literal] = trimmed;
  if (normalized && !(normalized in result)) result[normalized] = trimmed;

  if (literal.startsWith("fields_") || literal.startsWith("field_")) {
    const suffix = literal.replace(/^fields?_/i, "");
    const suffixNorm = normalizeGlo3dSpecKey(suffix);
    if (suffix && !(suffix.toLowerCase() in result)) result[suffix.toLowerCase()] = trimmed;
    if (suffixNorm && !(suffixNorm in result)) result[suffixNorm] = trimmed;
  }
}

function parseSpecEntry(record: Record<string, unknown>, result: Record<string, string>): void {
  const keyRaw =
    pickScalarString(record.abbreviation) ??
    pickScalarString(record.abbrev) ??
    pickScalarString(record.short_name) ??
    pickScalarString(record.key) ??
    pickScalarString(record.code) ??
    pickScalarString(record.item) ??
    pickScalarString(record.name) ??
    pickScalarString(record.label) ??
    pickScalarString(record.title);

  const valueRaw = extractScalarValue(record.value ?? record);
  if (!keyRaw || !valueRaw) return;
  assignSpecValue(result, keyRaw, valueRaw);
}

function visitSpecNode(node: unknown, result: Record<string, string>, visited: Set<unknown>): void {
  if (node == null || typeof node !== "object") return;
  if (visited.has(node)) return;
  visited.add(node);

  if (Array.isArray(node)) {
    for (const entry of node) {
      if (entry && typeof entry === "object" && !Array.isArray(entry)) {
        parseSpecEntry(entry as Record<string, unknown>, result);
      }
      visitSpecNode(entry, result, visited);
    }
    return;
  }

  const record = node as Record<string, unknown>;
  for (const [key, value] of Object.entries(record)) {
    const scalar = extractScalarValue(value);
    if (scalar && !Array.isArray(value) && (typeof value !== "object" || value === null)) {
      assignSpecValue(result, key, scalar);
      continue;
    }

    if (value && typeof value === "object" && !Array.isArray(value)) {
      const nested = value as Record<string, unknown>;
      const nestedScalar = extractScalarValue(nested);
      if (nestedScalar) {
        assignSpecValue(result, key, nestedScalar);
      }
    }

    visitSpecNode(value, result, visited);
  }
}

/** Extrae todas las abreviaciones/valores custom spec desde un registro GLO3D. */
export function flattenGlo3dSpecMap(raw: Record<string, unknown>): Record<string, string> {
  const result: Record<string, string> = {};
  const visited = new Set<unknown>();

  visitSpecNode(raw, result, visited);

  for (const containerKey of SPEC_CONTAINER_KEYS) {
    const container = raw[containerKey];
    if (container == null) continue;
    visitSpecNode(container, result, visited);
  }

  const flat = flattenNestedObject(raw);
  for (const [key, value] of Object.entries(flat)) {
    const scalar = extractScalarValue(value);
    if (!scalar) continue;
    assignSpecValue(result, key, scalar);
  }

  return result;
}

export function extractGlo3dOperationDetailsFromRaw(
  raw: Record<string, unknown>,
): Partial<EditorVehicleDetails> {
  const specs = flattenGlo3dSpecMap(raw);
  return mapGlo3dSpecMapToEditorDetails(specs);
}

export function extractGlo3dTechnicalRawFromRecord(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const specs = flattenGlo3dSpecMap(raw);
  const details = mapGlo3dSpecMapToEditorDetails(specs);
  return mapGlo3dEditorDetailsToRawFields(details, specs);
}
