import type { EditorVehicleDetails } from "@/types/editor";

/** Abreviaciones GLO3D y nombres en ingles → campo del editor (español). */
export const GLO3D_SPEC_KEY_TO_EDITOR: Record<string, keyof EditorVehicleDetails> = {
  // Operacion y documentacion (diccionario VDO)
  lla: "llaves",
  pdm: "pruebaMotor",
  pdd: "pruebaDesplazamiento",
  mul: "multas",
  tag: "tag",
  vrt: "vencRevisionTecnica",
  vpc: "vencPermisoCirculacion",
  vso: "vencSeguroObligatorio",
  tra: "transportista",
  tal: "taller",
  ubi: "ubicacionFisica",
  npa: "nombrePropietarioAnterior",
  rpa: "rutPropietarioAnterior",
  eda: "estadoAirbags",
  ppu: "patente",
  ndc: "nChasis",
  ser: "nSerie",
  ndm: "nMotor",
  nm: "nMotor",
  ns: "nSiniestro",
  n_s: "nSiniestro",
  n_m: "nMotor",
  ver: "version",
  aro: "aro",
  dun: "unicoPropietario",
  vin: "vin",
  // Identificacion / ficha (ingles en GLO3D)
  year: "year",
  make: "brand",
  model: "model",
  trim: "version",
  mileage: "kilometraje",
  transmission: "transmision",
  drive_type: "traccion",
  exterior_color: "color",
  fuel_type: "combustible",
  engine: "cilindrada",
  engin_description: "cilindrada",
  location: "ubicacionFisica",
  stock_number: "patente",
  // Alias en ingles frecuentes
  keys: "llaves",
  has_keys: "llaves",
  air_conditioning: "aireAcondicionado",
  has_ac: "aireAcondicionado",
  ac: "aireAcondicionado",
  conditioned: "condicionado",
  acondicionado: "condicionado",
  single_owner: "unicoPropietario",
  one_owner: "unicoPropietario",
  previous_owner_name: "nombrePropietarioAnterior",
  previous_owner_rut: "rutPropietarioAnterior",
  llaves: "llaves",
  multas: "multas",
  transportista: "transportista",
  taller: "taller",
  patente: "patente",
  version: "version",
  prueba_motor: "pruebaMotor",
  prueba_desplazamiento: "pruebaDesplazamiento",
  vencimiento_revision_tecnica: "vencRevisionTecnica",
  vencimiento_permiso_circulacion: "vencPermisoCirculacion",
  vencimiento_seguro_obligatorio: "vencSeguroObligatorio",
  nombre_propietario_anterior: "nombrePropietarioAnterior",
  rut_propietario_anterior: "rutPropietarioAnterior",
  estado_airbags: "estadoAirbags",
  ubicacion_fisica: "ubicacionFisica",
  unico_propietario: "unicoPropietario",
  aire_acondicionado: "aireAcondicionado",
  condicionado: "condicionado",
  n_de_motor: "nMotor",
  n_de_serie: "nSerie",
  n_de_chasis: "nChasis",
  n_de_siniestro: "nSiniestro",
  n_de_vin: "vin",
  kilometraje: "kilometraje",
  km: "kilometraje",
  marca: "brand",
  modelo: "model",
  ano: "year",
  anio: "year",
  combustible: "combustible",
  transmision: "transmision",
  traccion: "traccion",
  color: "color",
  cilindrada: "cilindrada",
};

/** Claves raw canonicas que se guardan en item.raw ademas de la abreviacion. */
export const EDITOR_TO_RAW_CANONICAL: Partial<Record<keyof EditorVehicleDetails, string[]>> = {
  llaves: ["llaves", "lla", "fields_lla"],
  aireAcondicionado: ["aire_acondicionado", "air_conditioning", "has_ac", "ac"],
  unicoPropietario: ["unico_propietario", "dun", "DUN"],
  condicionado: ["condicionado", "conditioned", "acondicionado"],
  multas: ["multas", "mul", "Mul"],
  tag: ["tag", "TAG"],
  pruebaMotor: ["prueba_motor", "pdm", "fields_pdm"],
  pruebaDesplazamiento: ["prueba_desplazamiento", "pdd", "fields_pdd"],
  vencRevisionTecnica: ["vencimiento_revision_tecnica", "vrt", "fields_vrt"],
  vencPermisoCirculacion: ["vencimiento_permiso_circulacion", "vpc", "fields_vpc"],
  vencSeguroObligatorio: ["vencimiento_seguro_obligatorio", "vso", "fields_vso"],
  transportista: ["transportista", "tra", "fields_tra"],
  taller: ["taller", "tal", "fields_tal"],
  ubicacionFisica: ["ubicacion_fisica", "ubi", "location", "fields_ubi"],
  nombrePropietarioAnterior: ["nombre_propietario_anterior", "npa", "fields_npa"],
  rutPropietarioAnterior: ["rut_propietario_anterior", "rpa", "fields_rpa"],
  estadoAirbags: ["estado_airbags", "eda", "fields_eda"],
  patente: ["patente", "PPU", "ppu", "fields_PPU", "fields_ppu"],
  vin: ["vin", "n_de_vin", "fields_vin"],
  nChasis: ["n_de_chasis", "ndc", "fields_ndc"],
  nMotor: ["n_de_motor", "ndm", "n_m", "fields_ndm"],
  nSerie: ["n_de_serie", "ser", "nds", "fields_ser"],
  nSiniestro: ["n_de_siniestro", "n_s", "ns", "fields_n_s"],
  version: ["version", "ver", "trim", "fields_ver"],
  brand: ["marca", "brand", "make", "fields_make"],
  model: ["modelo", "model", "fields_model"],
  year: ["ano", "anio", "year", "fields_year"],
  kilometraje: ["kilometraje", "km", "mileage", "fields_mileage"],
  transmision: ["transmision", "caja", "transmission", "fields_transmission"],
  traccion: ["traccion", "drive_type", "fields_drive_type"],
  color: ["color", "exterior_color", "fields_exterior_color"],
  combustible: ["combustible", "fuel_type", "fuel", "fields_fuel_type"],
  aro: ["aro", "fields_aro"],
  cilindrada: ["cilindrada", "engine", "engin_description", "fields_engine"],
};

export function normalizeGlo3dSpecKey(key: string): string {
  return key
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[°º]/g, "")
    .toLowerCase()
    .replace(/^fields_/, "")
    .replace(/^field_/, "")
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function resolveGlo3dEditorField(key: string): keyof EditorVehicleDetails | undefined {
  const literal = key.trim();
  const normalized = normalizeGlo3dSpecKey(key);
  const direct =
    GLO3D_SPEC_KEY_TO_EDITOR[literal] ??
    GLO3D_SPEC_KEY_TO_EDITOR[literal.toLowerCase()] ??
    GLO3D_SPEC_KEY_TO_EDITOR[normalized];
  if (direct) return direct;

  const sample = literal
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (/llaves|keys/.test(sample)) return "llaves";
  if (/prueba.*motor|motor.*arranca|engine test/.test(sample)) return "pruebaMotor";
  if (/desplazamiento|se mueve|movement/.test(sample)) return "pruebaDesplazamiento";
  if (/unico propietario|single owner|one owner|dun/.test(sample)) return "unicoPropietario";
  if (/aire acondicionado|air conditioning|a\/c/.test(sample)) return "aireAcondicionado";
  if (/condicionado|conditioned/.test(sample)) return "condicionado";
  if (/multas|fines/.test(sample)) return "multas";
  if (/\btag\b/.test(sample)) return "tag";
  if (/revision tecnica|technical inspection/.test(sample)) return "vencRevisionTecnica";
  if (/permiso de circulacion|circulation permit/.test(sample)) return "vencPermisoCirculacion";
  if (/seguro obligatorio|mandatory insurance/.test(sample)) return "vencSeguroObligatorio";
  if (/transportista|carrier/.test(sample)) return "transportista";
  if (/taller|workshop/.test(sample)) return "taller";
  if (/propietario anterior|previous owner name/.test(sample)) return "nombrePropietarioAnterior";
  if (/rut propietario|rut.*anterior|previous owner rut/.test(sample)) return "rutPropietarioAnterior";
  if (/airbags/.test(sample)) return "estadoAirbags";
  if (/ubicacion fisica|physical location/.test(sample)) return "ubicacionFisica";
  if (/patente|license plate|ppu/.test(sample)) return "patente";
  if (/\bvin\b|chasis/.test(sample)) return sample.includes("chasis") ? "nChasis" : "vin";

  return undefined;
}

export function mapGlo3dSpecMapToEditorDetails(
  specs: Record<string, string>,
): Partial<EditorVehicleDetails> {
  const details: Partial<EditorVehicleDetails> = {};

  for (const [key, value] of Object.entries(specs)) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    const editorKey = resolveGlo3dEditorField(key);
    if (!editorKey) continue;
    const current = details[editorKey];
    if (typeof current === "string" && current.trim()) continue;
    (details as Record<string, string>)[editorKey] = trimmed;
  }

  return details;
}

export function mapGlo3dEditorDetailsToRawFields(
  details: Partial<EditorVehicleDetails>,
  specs: Record<string, string>,
): Record<string, unknown> {
  const raw: Record<string, unknown> = { ...specs };

  for (const [editorKey, aliases] of Object.entries(EDITOR_TO_RAW_CANONICAL) as Array<
    [keyof EditorVehicleDetails, string[] | undefined]
  >) {
    const value = typeof details[editorKey] === "string" ? details[editorKey]?.trim() : undefined;
    if (!value) continue;
    for (const alias of aliases ?? []) {
      raw[alias] = value;
    }
  }

  return raw;
}
