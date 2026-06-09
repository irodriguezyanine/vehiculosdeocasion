import type { ManualPublicationDraft } from "@/lib/manual-publication-draft";

function pickString(item: Record<string, unknown>, aliases: string[]): string | undefined {
  for (const key of aliases) {
    const value = item[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

function flattenObject(obj: unknown, prefix = ""): Record<string, unknown> {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return {};
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const nextKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value, nextKey));
    } else {
      result[nextKey] = value;
      result[key] = value;
    }
  }
  return result;
}

function normalizeCategory(raw?: string): string | undefined {
  if (!raw?.trim()) return undefined;
  const normalized = raw.toLowerCase();
  if (normalized.includes("pesado") || normalized.includes("heavy") || normalized.includes("camion")) {
    return "vehiculo_pesado";
  }
  if (normalized.includes("maquin")) return "maquinaria";
  if (normalized.includes("chatarra") || normalized.includes("scrap")) return "chatarra";
  if (
    normalized.includes("livian") ||
    normalized.includes("auto") ||
    normalized.includes("car") ||
    normalized.includes("suv")
  ) {
    return "vehiculo_liviano";
  }
  return undefined;
}

export function mapAutoredToDraftPartial(
  autoredRaw: Record<string, unknown>,
): Partial<ManualPublicationDraft> {
  const flat = flattenObject(autoredRaw);
  const merged = { ...autoredRaw, ...flat };
  const partial: Partial<ManualPublicationDraft> = {};

  const patente = pickString(merged, ["patente", "PPU", "ppu", "plate", "placa", "fields_PPU"]);
  const patenteVerifier = pickString(merged, [
    "dv",
    "verificador",
    "patente_dv",
    "ppu_dv",
    "patente_verifier",
  ]);
  const vin = pickString(merged, ["vin", "n_de_vin", "numero_vin", "vehicle_vin"]);
  const nChasis = pickString(merged, [
    "n_de_chasis",
    "numero_chasis",
    "nro_chasis",
    "chasis",
    "ndc",
  ]);
  const nMotor = pickString(merged, ["n_de_motor", "numero_motor", "motor_number", "ndm", "n°m"]);
  const nSerie = pickString(merged, ["n_de_serie", "numero_serie", "serial_number", "nds", "ser"]);
  const brand = pickString(merged, ["marca", "brand", "make", "original_brand_name"]);
  const model = pickString(merged, ["modelo", "model", "original_model_name", "showName"]);
  const year = pickString(merged, ["ano", "anio", "year", "fields_year"]);
  const version = pickString(merged, ["version", "ver", "trim", "fields_ver"]);
  const tipoVehiculo = pickString(merged, [
    "tipo_de_vehiculo",
    "tipo_vehiculo",
    "vehicle_type",
    "vehicle_type_name",
    "tipo",
  ]);
  const categoryRaw = pickString(merged, ["categoria", "category", "tipo_unidad", "vehicle_category"]);
  const color = pickString(merged, ["color", "color_exterior", "exterior_color", "color_vehiculo"]);
  const combustible = pickString(merged, ["combustible", "tipo_combustible", "fuel", "fuel_type"]);
  const transmision = pickString(merged, [
    "transmision",
    "transmisión",
    "caja",
    "tipo_caja",
    "transmission",
    "gearbox",
  ]);
  const traccion = pickString(merged, [
    "traccion",
    "tracción",
    "tipo_traccion",
    "drivetrain",
    "traction",
    "drive_type",
  ]);
  const aro = pickString(merged, ["aro", "aro_llanta", "rin", "rines", "wheel_size"]);
  const cilindrada = pickString(merged, ["cilindrada", "cc", "motor_cc", "engine_cc", "engine"]);
  const kilometraje = pickString(merged, ["kilometraje", "km", "kms", "odometro", "mileage"]);

  if (patente) partial.patente = patente.toUpperCase().replace(/\s+/g, "").replace(/-/g, "");
  if (patenteVerifier) partial.patenteVerifier = patenteVerifier;
  if (vin) partial.vin = vin;
  if (nChasis) partial.nChasis = nChasis;
  if (nMotor) partial.nMotor = nMotor;
  if (nSerie) partial.nSerie = nSerie;
  if (brand) partial.brand = brand;
  if (model) partial.model = model;
  if (year) partial.year = year;
  if (version) partial.version = version;
  if (tipoVehiculo) partial.tipoVehiculo = tipoVehiculo;
  const category = normalizeCategory(categoryRaw) ?? categoryRaw;
  if (category) partial.category = category;
  if (color) partial.color = color;
  if (combustible) partial.combustible = combustible;
  if (transmision) partial.transmision = transmision;
  if (traccion) partial.traccion = traccion;
  if (aro) partial.aro = aro;
  if (cilindrada) partial.cilindrada = cilindrada;
  if (kilometraje) partial.kilometraje = kilometraje;

  const autoTitle = [brand, model, year].filter(Boolean).join(" ");
  if (autoTitle) partial.title = autoTitle;

  return partial;
}

function extractRowsFromPayload(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) {
    return payload.filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === "object");
  }
  if (!payload || typeof payload !== "object") return [];
  const record = payload as Record<string, unknown>;
  for (const key of ["data", "results", "items", "vehicles", "rows"]) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value.filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === "object");
    }
  }
  return [];
}

export async function fetchAutoredPatentData(
  patent: string,
): Promise<Record<string, unknown> | null> {
  const apiUrl =
    process.env.CATALOG_SOURCE_AUTORED_API_URL ??
    process.env.VITE_CATALOG_SOURCE_AUTORED_API_URL;
  if (!apiUrl) return null;

  const token = process.env.CATALOG_SOURCE_API_TOKEN ?? process.env.VITE_CATALOG_SOURCE_API_TOKEN;
  const url = new URL(apiUrl);
  url.searchParams.set("patente", patent);

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "x-api-key": token } : {}),
    },
    cache: "no-store",
  });
  if (!response.ok) return null;

  const payload = (await response.json()) as unknown;
  const rows = extractRowsFromPayload(payload);
  if (rows.length > 0) return rows[0];
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  return null;
}

export async function lookupAutoredDraftFields(
  patent: string,
): Promise<Partial<ManualPublicationDraft> | null> {
  const normalized = patent.toUpperCase().replace(/\s+/g, "").replace(/-/g, "");
  if (normalized.length < 4) return null;
  const raw = await fetchAutoredPatentData(normalized);
  if (!raw) return null;
  return mapAutoredToDraftPartial(raw);
}
