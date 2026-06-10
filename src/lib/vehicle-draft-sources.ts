import { mapAutoredToDraftPartial } from "@/lib/autored-lookup";
import type { ManualPublicationDraft } from "@/lib/manual-publication-draft";
import type { CatalogItem } from "@/types/catalog";
import type { EditorVehicleDetails } from "@/types/editor";

export const AUTORED_MECHANICAL_FIELDS = [
  "kilometraje",
  "color",
  "combustible",
  "transmision",
  "traccion",
  "aro",
  "cilindrada",
] as const;

export type AutoredMechanicalField = (typeof AUTORED_MECHANICAL_FIELDS)[number];

function pickString(item: Record<string, unknown>, aliases: string[]): string | undefined {
  for (const key of aliases) {
    const value = item[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

function pickScalarString(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

function extractGlo3dCustomSpecMap(raw: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const visited = new Set<unknown>();

  const visit = (node: unknown): void => {
    if (node == null || typeof node !== "object") return;
    if (visited.has(node)) return;
    visited.add(node);

    if (Array.isArray(node)) {
      for (const entry of node) {
        if (entry && typeof entry === "object" && !Array.isArray(entry)) {
          const record = entry as Record<string, unknown>;
          const keyRaw =
            pickScalarString(record.abbreviation) ??
            pickScalarString(record.abbrev) ??
            pickScalarString(record.short_name) ??
            pickScalarString(record.key) ??
            pickScalarString(record.code) ??
            pickScalarString(record.name) ??
            pickScalarString(record.label);
          const valueRaw =
            pickScalarString(record.value) ??
            pickScalarString(record.field_value) ??
            pickScalarString(record.val) ??
            pickScalarString(record.content) ??
            pickScalarString(record.display_value);

          if (keyRaw && valueRaw) {
            const literalKey = keyRaw.trim().toLowerCase();
            if (!(literalKey in result)) result[literalKey] = valueRaw;
            result[keyRaw.trim()] = valueRaw;
          }
        }
        visit(entry);
      }
      return;
    }

    for (const value of Object.values(node as Record<string, unknown>)) {
      visit(value);
    }
  };

  visit(raw);
  return result;
}

function buildGlo3dMergedRaw(item: CatalogItem): Record<string, unknown> {
  const raw = (item.raw ?? {}) as Record<string, unknown>;
  const glo3dRaw = (raw.glo3d as Record<string, unknown> | undefined) ?? {};
  const customSpecs = extractGlo3dCustomSpecMap(glo3dRaw);
  return { ...customSpecs, ...glo3dRaw, ...raw };
}

const GLO3D_OPERATION_FIELDS: Array<{
  key: keyof EditorVehicleDetails;
  aliases: string[];
}> = [
  { key: "llaves", aliases: ["llaves", "lla", "keys", "has_keys", "tiene_llaves"] },
  { key: "aireAcondicionado", aliases: ["aire_acondicionado", "ac", "air_conditioning", "has_ac"] },
  { key: "unicoPropietario", aliases: ["unico_propietario", "dun", "DUN", "single_owner", "one_owner"] },
  { key: "condicionado", aliases: ["condicionado", "conditioned", "acondicionado"] },
  { key: "multas", aliases: ["multas", "mul", "Mul"] },
  { key: "tag", aliases: ["tag", "TAG"] },
  { key: "pruebaMotor", aliases: ["prueba_motor", "pdm"] },
  { key: "pruebaDesplazamiento", aliases: ["prueba_desplazamiento", "pdd"] },
  { key: "vencRevisionTecnica", aliases: ["vencimiento_revision_tecnica", "vrt"] },
  { key: "vencPermisoCirculacion", aliases: ["vencimiento_permiso_circulacion", "vpc"] },
  { key: "vencSeguroObligatorio", aliases: ["vencimiento_seguro_obligatorio", "vso"] },
  { key: "transportista", aliases: ["transportista", "tra"] },
  { key: "taller", aliases: ["taller", "tal"] },
  { key: "ubicacionFisica", aliases: ["ubicacion_fisica", "ubi", "location"] },
  { key: "nombrePropietarioAnterior", aliases: ["nombre_propietario_anterior", "npa"] },
  { key: "rutPropietarioAnterior", aliases: ["rut_propietario_anterior", "rpa"] },
  { key: "estadoAirbags", aliases: ["estado_airbags", "eda"] },
  { key: "nSiniestro", aliases: ["n_de_siniestro", "numero_siniestro", "n_s", "ns", "n°s"] },
  { key: "nMotor", aliases: ["n_de_motor", "numero_motor", "ndm", "n°m"] },
  { key: "nSerie", aliases: ["n_de_serie", "numero_serie", "nds", "ser"] },
  { key: "nChasis", aliases: ["n_de_chasis", "numero_chasis", "ndc", "chasis"] },
  { key: "vin", aliases: ["vin", "n_de_vin"] },
  { key: "version", aliases: ["version", "ver", "trim"] },
];

export function extractAutoredMechanicalDetails(
  item: CatalogItem,
): Pick<ManualPublicationDraft, AutoredMechanicalField> {
  const raw = (item.raw ?? {}) as Record<string, unknown>;
  const autoredNested = (raw.autored as Record<string, unknown> | undefined) ?? {};
  const fromNested = mapAutoredToDraftPartial(autoredNested);
  const fromMerged = mapAutoredToDraftPartial({ ...raw, ...autoredNested });
  const result: Partial<Pick<ManualPublicationDraft, AutoredMechanicalField>> = {};

  for (const field of AUTORED_MECHANICAL_FIELDS) {
    const value = fromNested[field] ?? fromMerged[field];
    if (value?.trim()) result[field] = value;
  }

  return result as Pick<ManualPublicationDraft, AutoredMechanicalField>;
}

export function extractGlo3dOperationDetails(item: CatalogItem): Partial<EditorVehicleDetails> {
  const merged = buildGlo3dMergedRaw(item);
  const details: Partial<EditorVehicleDetails> = {};

  for (const { key, aliases } of GLO3D_OPERATION_FIELDS) {
    const value = pickString(merged, aliases);
    if (value) (details as Record<string, string>)[key] = value;
  }

  const kilometraje = pickString(merged, ["mileage", "kilometraje", "km", "odometer"]);
  if (kilometraje && !details.kilometraje) details.kilometraje = kilometraje;

  return details;
}

export function mergeAutoredMechanicalIntoDraft<T extends ManualPublicationDraft>(
  draft: T,
  autored: Partial<Pick<ManualPublicationDraft, AutoredMechanicalField>>,
  preferAutored = true,
): T {
  const next = { ...draft };
  for (const field of AUTORED_MECHANICAL_FIELDS) {
    const incoming = autored[field]?.trim();
    if (!incoming) continue;
    const current = String(next[field] ?? "").trim();
    if (preferAutored || !current) {
      next[field] = incoming;
    }
  }
  return next;
}

export function mergeGlo3dOperationIntoDraft<T extends ManualPublicationDraft>(
  draft: T,
  glo3d: Partial<EditorVehicleDetails>,
  preferGlo3d = false,
): T {
  const next = { ...draft };
  for (const { key } of GLO3D_OPERATION_FIELDS) {
    const incoming = glo3d[key];
    if (typeof incoming !== "string" || !incoming.trim()) continue;
    const current = String(next[key as keyof ManualPublicationDraft] ?? "").trim();
    if (preferGlo3d || !current) {
      (next as ManualPublicationDraft)[key as keyof ManualPublicationDraft] = incoming as never;
    }
  }
  if (glo3d.kilometraje?.trim() && (preferGlo3d || !next.kilometraje?.trim())) {
    next.kilometraje = glo3d.kilometraje;
  }
  if (glo3d.estadoAirbags?.trim() && (preferGlo3d || !next.estadoAirbags?.trim())) {
    next.estadoAirbags = glo3d.estadoAirbags;
  }
  return next;
}

export const AUTORED_IDENTIFICATION_FIELDS = [
  "patente",
  "patenteVerifier",
  "vin",
  "nChasis",
  "nMotor",
  "nSerie",
  "nSiniestro",
  "brand",
  "model",
  "year",
  "version",
  "tipoVehiculo",
  "tipo",
  "category",
  "title",
] as const;

export function applyAutoredLookupToDraft(
  draft: ManualPublicationDraft,
  fields: Partial<ManualPublicationDraft>,
): ManualPublicationDraft {
  const next = { ...draft };

  for (const field of AUTORED_IDENTIFICATION_FIELDS) {
    const value = fields[field]?.trim();
    if (!value) continue;
    if (field === "title") {
      if (!next.title?.trim()) next.title = value;
      continue;
    }
    next[field] = value;
  }

  return mergeAutoredMechanicalIntoDraft(next, fields, true);
}
