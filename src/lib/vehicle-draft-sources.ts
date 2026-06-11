import {
  extractGlo3dOperationDetailsFromRaw,
  flattenGlo3dSpecMap,
} from "@/lib/glo3d-custom-specs";
import { mapAutoredToDraftPartial } from "@/lib/autored-lookup";
import type { ManualPublicationDraft } from "@/lib/manual-publication-draft";
import { buildVehicleTitleFromParts } from "@/lib/vehicle-title";
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
  const map = new Map<string, unknown>();
  for (const [key, value] of Object.entries(item)) {
    map.set(key.toLowerCase(), value);
  }
  for (const alias of aliases) {
    const value = map.get(alias.toLowerCase());
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

function buildGlo3dMergedRaw(item: CatalogItem): Record<string, unknown> {
  const raw = (item.raw ?? {}) as Record<string, unknown>;
  const glo3dRaw = (raw.glo3d as Record<string, unknown> | undefined) ?? {};
  const specs = flattenGlo3dSpecMap({ ...glo3dRaw, ...raw });
  return { ...raw, ...glo3dRaw, ...specs };
}

const GLO3D_OPERATION_FIELDS: Array<{
  key: keyof EditorVehicleDetails;
  aliases: string[];
}> = [
  { key: "llaves", aliases: ["llaves", "lla", "fields_lla", "keys", "has_keys", "tiene_llaves"] },
  {
    key: "aireAcondicionado",
    aliases: ["aire_acondicionado", "ac", "air_conditioning", "has_ac", "fields_ac"],
  },
  {
    key: "unicoPropietario",
    aliases: ["unico_propietario", "dun", "DUN", "single_owner", "one_owner", "fields_dun"],
  },
  { key: "condicionado", aliases: ["condicionado", "conditioned", "acondicionado"] },
  { key: "multas", aliases: ["multas", "mul", "Mul", "fields_mul"] },
  { key: "tag", aliases: ["tag", "TAG", "fields_tag"] },
  { key: "pruebaMotor", aliases: ["prueba_motor", "pdm", "fields_pdm"] },
  { key: "pruebaDesplazamiento", aliases: ["prueba_desplazamiento", "pdd", "fields_pdd"] },
  {
    key: "vencRevisionTecnica",
    aliases: ["vencimiento_revision_tecnica", "vrt", "fields_vrt"],
  },
  {
    key: "vencPermisoCirculacion",
    aliases: ["vencimiento_permiso_circulacion", "vpc", "fields_vpc"],
  },
  {
    key: "vencSeguroObligatorio",
    aliases: ["vencimiento_seguro_obligatorio", "vso", "fields_vso"],
  },
  { key: "transportista", aliases: ["transportista", "tra", "fields_tra"] },
  { key: "taller", aliases: ["taller", "tal", "fields_tal"] },
  { key: "ubicacionFisica", aliases: ["ubicacion_fisica", "ubi", "location", "fields_ubi"] },
  {
    key: "nombrePropietarioAnterior",
    aliases: ["nombre_propietario_anterior", "npa", "fields_npa"],
  },
  {
    key: "rutPropietarioAnterior",
    aliases: ["rut_propietario_anterior", "rpa", "fields_rpa"],
  },
  { key: "estadoAirbags", aliases: ["estado_airbags", "eda", "fields_eda"] },
  {
    key: "nSiniestro",
    aliases: ["n_de_siniestro", "numero_siniestro", "n_s", "ns", "n°s", "fields_n_s"],
  },
  { key: "nMotor", aliases: ["n_de_motor", "numero_motor", "ndm", "n°m", "fields_ndm"] },
  { key: "nSerie", aliases: ["n_de_serie", "numero_serie", "nds", "ser", "fields_ser"] },
  { key: "nChasis", aliases: ["n_de_chasis", "numero_chasis", "ndc", "fields_ndc"] },
  { key: "vin", aliases: ["vin", "n_de_vin", "fields_vin"] },
  { key: "version", aliases: ["version", "ver", "trim", "fields_ver"] },
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
  const raw = (item.raw ?? {}) as Record<string, unknown>;
  const glo3dRaw = (raw.glo3d as Record<string, unknown> | undefined) ?? {};
  const details: Partial<EditorVehicleDetails> = {
    ...extractGlo3dOperationDetailsFromRaw(glo3dRaw),
    ...extractGlo3dOperationDetailsFromRaw(raw),
  };

  const merged = buildGlo3dMergedRaw(item);
  for (const { key, aliases } of GLO3D_OPERATION_FIELDS) {
    if (String(details[key] ?? "").trim()) continue;
    const value = pickString(merged, aliases);
    if (value) (details as Record<string, string>)[key] = value;
  }

  const kilometraje = pickString(merged, ["mileage", "kilometraje", "km", "odometer", "fields_mileage"]);
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
    if (field === "title") continue;
    next[field] = value;
  }

  const merged = mergeAutoredMechanicalIntoDraft(next, fields, true);
  const autoTitle = buildVehicleTitleFromParts({
    brand: merged.brand,
    model: merged.model,
    year: merged.year,
    version: merged.version,
  });
  if (autoTitle) merged.title = autoTitle;

  return merged;
}
