import type { ManualPublicationDraft } from "@/lib/manual-publication-draft";
import {
  getAutoredCooldownRemainingMs,
  registerAutoredRateLimit,
  runAutoredQueued,
} from "@/lib/autored-request-queue";

const AUTORED_V2_BASE = "https://app.autored.cl/api/v2";

type AutoredTokenCache = {
  token: string;
  expiresAt: number;
};

let autoredTokenCache: AutoredTokenCache | null = null;

const autoredPatentCache = new Map<string, { data: Record<string, unknown>; expiresAt: number }>();
const AUTORED_PATENT_CACHE_MS = 10 * 60_000;

export type AutoredLookupErrorCode =
  | "NOT_CONFIGURED"
  | "INVALID_PATENT"
  | "AUTH_FAILED"
  | "RATE_LIMITED"
  | "NOT_FOUND"
  | "UPSTREAM_ERROR";

export class AutoredLookupError extends Error {
  code: AutoredLookupErrorCode;
  status: number;

  constructor(code: AutoredLookupErrorCode, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function pickString(item: Record<string, unknown>, aliases: string[]): string | undefined {
  for (const key of aliases) {
    const value = item[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

function findNestedString(obj: unknown, aliases: string[]): string | undefined {
  if (obj == null || typeof obj !== "object") return undefined;
  const aliasSet = new Set(aliases.map((alias) => alias.toLowerCase()));
  const stack: unknown[] = [obj];
  const visited = new Set<unknown>();

  while (stack.length > 0) {
    const current = stack.pop();
    if (current == null || typeof current !== "object" || visited.has(current)) continue;
    visited.add(current);

    for (const [key, value] of Object.entries(current as Record<string, unknown>)) {
      if (aliasSet.has(key.toLowerCase())) {
        const picked = pickString({ [key]: value }, [key]);
        if (picked) return picked;
      }
      if (value && typeof value === "object") stack.push(value);
    }
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

function unwrapAutoredRecord(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== "object") return null;
  if (Array.isArray(payload)) {
    const first = payload[0];
    return first && typeof first === "object" ? (first as Record<string, unknown>) : null;
  }

  const record = payload as Record<string, unknown>;
  if (typeof record.error === "string" && record.error.trim()) return null;

  const nested =
    record.data ??
    record.vehicle ??
    record.vehiculo ??
    record.result ??
    record.item ??
    record.info;

  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    return { ...record, ...(nested as Record<string, unknown>) };
  }

  return record;
}

function extractRowsFromPayload(payload: unknown): Record<string, unknown>[] {
  const unwrapped = unwrapAutoredRecord(payload);
  if (unwrapped) return [unwrapped];

  if (!payload || typeof payload !== "object") return [];
  const record = payload as Record<string, unknown>;
  for (const key of ["data", "results", "items", "vehicles", "rows"]) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value.filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === "object");
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return [value as Record<string, unknown>];
    }
  }
  return [];
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

function inferTransmisionFromVersionText(...sources: (string | undefined)[]): string | undefined {
  for (const text of sources) {
    if (!text?.trim()) continue;
    const upper = text.toUpperCase();
    if (/\bMT\b|M\/T|MANUAL/.test(upper)) return "Manual";
    if (/\bAT\b|\bAUT\b|AUTOMAT/.test(upper)) return "Automatica";
  }
  return undefined;
}

function inferCombustibleFromVersionText(...sources: (string | undefined)[]): string | undefined {
  for (const text of sources) {
    if (!text?.trim()) continue;
    const upper = text.toUpperCase();
    if (/DIESEL|HDI|TDI|CDI|\bDT\b/.test(upper)) return "Diesel";
    if (/HYBRID|HIBRID|HEV|PHEV/.test(upper)) return "Hibrido";
    if (/ELECTRIC|\bEV\b|BEV/.test(upper)) return "Electrico";
    if (/MPI|GDI|TSI|FLEX|GASOLINA|BENCINA|NAFTA|GASOL/.test(upper)) return "Gasolina";
  }
  return undefined;
}

export function mapAutoredToDraftPartial(
  autoredRaw: Record<string, unknown>,
): Partial<ManualPublicationDraft> {
  const flat = flattenObject(autoredRaw);
  const merged = { ...autoredRaw, ...flat };
  const partial: Partial<ManualPublicationDraft> = {};

  const patente = pickString(merged, [
    "patente",
    "PPU",
    "ppu",
    "plate",
    "placa",
    "licensePlate",
    "license_plate",
    "fields_PPU",
  ]);
  const patenteVerifier = pickString(merged, [
    "dv",
    "verificador",
    "patente_dv",
    "ppu_dv",
    "patente_verifier",
  ]);
  const vin = pickString(merged, [
    "vin",
    "n_de_vin",
    "numero_vin",
    "vehicle_vin",
    "extracted_vin",
    "extractedVin",
  ]) ?? findNestedString(merged, ["vin", "extracted_vin", "n_de_vin"]);
  const nChasis = pickString(merged, [
    "n_de_chasis",
    "numero_chasis",
    "nro_chasis",
    "chasis",
    "ndc",
  ]) ?? findNestedString(merged, ["numero_chasis", "chassis", "ndc"]);
  const nMotor = pickString(merged, [
    "n_de_motor",
    "numero_motor",
    "motor_number",
    "ndm",
    "n°m",
    "engine_number",
    "engineNumber",
  ]) ?? findNestedString(merged, ["numero_motor", "engine_number", "ndm"]);
  const nSerie = pickString(merged, ["n_de_serie", "numero_serie", "serial_number", "nds", "ser"]);
  const brand = pickString(merged, [
    "marca",
    "brand",
    "make",
    "brand_name",
    "original_brand_name",
  ]);
  const model = pickString(merged, [
    "modelo",
    "model",
    "model_name",
    "original_model_name",
    "showName",
  ]);
  const year = pickString(merged, ["ano", "anio", "year", "fields_year", "manufacture_year"]);
  const version = pickString(merged, [
    "version",
    "ver",
    "trim",
    "fields_ver",
    "version_name",
    "original_extracted_version",
  ]);
  const tipoVehiculo = pickString(merged, [
    "tipo_de_vehiculo",
    "tipo_vehiculo",
    "vehicle_type",
    "vehicle_type_name",
    "tipo",
    "vehicleTypeName",
  ]);
  const categoryRaw = pickString(merged, ["categoria", "category", "tipo_unidad", "vehicle_category"]);
  const color = pickString(merged, [
    "color",
    "color_exterior",
    "exterior_color",
    "color_vehiculo",
    "colour",
    "paint_color",
  ]);
  const combustible = pickString(merged, [
    "combustible",
    "tipo_combustible",
    "fuel",
    "fuel_type",
    "fuelType",
    "fuelTypeName",
    "tipo_de_combustible",
  ]) ?? findNestedString(merged, ["combustible", "fuel", "fuel_type", "fuelTypeName"]);
  const transmision = pickString(merged, [
    "transmision",
    "transmisión",
    "caja",
    "tipo_caja",
    "transmission",
    "transmission_name",
    "transmissionName",
    "gearbox",
    "tipo_transmision",
  ]) ?? findNestedString(merged, ["transmision", "transmission", "transmission_name"]);
  const traccion = pickString(merged, [
    "traccion",
    "tracción",
    "tipo_traccion",
    "drivetrain",
    "traction",
    "drive_type",
    "driveType",
    "tipo_traccion",
    "traction_name",
    "tractionName",
  ]) ?? findNestedString(merged, ["traccion", "drive_type", "drivetrain", "traction"]);
  const aro = pickString(merged, [
    "aro",
    "aro_llanta",
    "rin",
    "rines",
    "wheel_size",
    "wheelSize",
    "rim_size",
    "rimSize",
    "tamano_rin",
    "tamanorin",
  ]) ?? findNestedString(merged, ["aro", "wheel_size", "rim_size", "rin"]);
  const cilindrada = pickString(merged, [
    "cilindrada",
    "cc",
    "motor_cc",
    "engine_cc",
    "engine",
    "engine_cylinder",
    "cylinder_capacity",
    "displacement",
    "capacidad_motor",
    "capacidad_cilindrada",
  ]) ?? findNestedString(merged, ["cilindrada", "engine_cylinder", "cylinder_capacity", "displacement"]);
  const versionTextSources = [
    version,
    pickString(merged, ["version_name"]),
    pickString(merged, ["original_extracted_version"]),
    pickString(merged, ["original_model_name"]),
    pickString(merged, ["showName"]),
  ];
  const resolvedCombustible =
    combustible ?? inferCombustibleFromVersionText(...versionTextSources);
  const resolvedTransmision =
    transmision ?? inferTransmisionFromVersionText(...versionTextSources);
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
  if (resolvedCombustible) partial.combustible = resolvedCombustible;
  if (resolvedTransmision) partial.transmision = resolvedTransmision;
  if (traccion) partial.traccion = traccion;
  if (aro) partial.aro = aro;
  if (cilindrada) partial.cilindrada = cilindrada;
  if (kilometraje) partial.kilometraje = kilometraje;

  const autoTitle = [brand, model, year].filter(Boolean).join(" ");
  if (autoTitle) partial.title = autoTitle;

  return partial;
}

async function getAutoredAccessToken(): Promise<string | null> {
  const email = process.env.AUTORED_EMAIL ?? process.env.VITE_AUTORED_EMAIL;
  const password = process.env.AUTORED_PASSWORD ?? process.env.VITE_AUTORED_PASSWORD;
  if (!email || !password) return null;

  if (autoredTokenCache && autoredTokenCache.expiresAt > Date.now()) {
    return autoredTokenCache.token;
  }

  const response = await fetch(`${AUTORED_V2_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    throw new AutoredLookupError(
      "AUTH_FAILED",
      "No se pudo autenticar con Autored. Revisa AUTORED_EMAIL y AUTORED_PASSWORD.",
      502,
    );
  }

  const payload = (await response.json()) as {
    accessToken?: string;
    expirationDate?: string;
  };
  if (!payload.accessToken) {
    throw new AutoredLookupError(
      "AUTH_FAILED",
      "Autored no devolvio token de acceso.",
      502,
    );
  }

  const expiresAt = payload.expirationDate
    ? new Date(payload.expirationDate).getTime() - 60_000
    : Date.now() + 25 * 60_000;

  autoredTokenCache = {
    token: payload.accessToken,
    expiresAt: Number.isFinite(expiresAt) ? expiresAt : Date.now() + 25 * 60_000,
  };
  return payload.accessToken;
}

async function fetchAutoredDirectV2(patent: string): Promise<Record<string, unknown> | null> {
  const token = await getAutoredAccessToken();
  if (!token) return null;

  const url = `${AUTORED_V2_BASE}/Vehicles/info?licensePlate=${encodeURIComponent(patent)}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (response.status === 404) {
    throw new AutoredLookupError(
      "NOT_FOUND",
      "No se encontraron datos para esta patente en Autored.",
      404,
    );
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    if (
      response.status === 429 ||
      response.status === 403 ||
      /banned|too many requests|rate limit/i.test(body)
    ) {
      registerAutoredRateLimit();
      throw new AutoredLookupError(
        "RATE_LIMITED",
        "Autored limito las consultas temporalmente. Espera unos minutos e intenta de nuevo.",
        429,
      );
    }
    throw new AutoredLookupError(
      "UPSTREAM_ERROR",
      "Autored rechazo la consulta de esta patente.",
      502,
    );
  }

  const payload = await response.json();
  const record = unwrapAutoredRecord(payload);
  if (!record || Object.keys(record).length === 0) {
    throw new AutoredLookupError(
      "NOT_FOUND",
      "No se encontraron datos para esta patente en Autored.",
      404,
    );
  }
  return record;
}

async function fetchAutoredSupabaseFunction(patent: string): Promise<Record<string, unknown> | null> {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.VITE_SUPABASE_URL ??
    process.env.SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.VITE_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_ANON_KEY;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) return null;

  const base = supabaseUrl.replace(/\/$/, "");
  const url = `${base}/functions/v1/autored-vehicle-info?licensePlate=${encodeURIComponent(patent)}`;
  const bearer = serviceRole ?? anonKey;

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      ...(anonKey ? { apikey: anonKey } : {}),
      ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
    },
    cache: "no-store",
  });
  if (!response.ok) return null;

  const payload = await response.json();
  return unwrapAutoredRecord(payload);
}

async function fetchAutoredConfiguredEndpoint(patent: string): Promise<Record<string, unknown> | null> {
  const apiUrl =
    process.env.CATALOG_SOURCE_AUTORED_API_URL ??
    process.env.VITE_CATALOG_SOURCE_AUTORED_API_URL;
  if (!apiUrl) return null;

  const token = process.env.CATALOG_SOURCE_API_TOKEN ?? process.env.VITE_CATALOG_SOURCE_API_TOKEN;
  const paramNames = ["patente", "licensePlate", "PPU", "ppu", "plate"];

  for (const paramName of paramNames) {
    const url = new URL(apiUrl);
    url.searchParams.set(paramName, patent);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(token ? { "x-api-key": token } : {}),
      },
      cache: "no-store",
    });
    if (!response.ok) continue;

    const payload = await response.json();
    const rows = extractRowsFromPayload(payload);
    if (rows.length > 0) return rows[0];
    const unwrapped = unwrapAutoredRecord(payload);
    if (unwrapped) return unwrapped;
  }

  return null;
}

export async function fetchAutoredPatentData(
  patent: string,
): Promise<Record<string, unknown> | null> {
  const normalized = patent.toUpperCase().replace(/\s+/g, "").replace(/-/g, "");
  if (normalized.length < 4) return null;

  const cached = autoredPatentCache.get(normalized);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const hasDirectCredentials = Boolean(
    (process.env.AUTORED_EMAIL ?? process.env.VITE_AUTORED_EMAIL) &&
      (process.env.AUTORED_PASSWORD ?? process.env.VITE_AUTORED_PASSWORD),
  );

  const strategies = hasDirectCredentials
    ? [fetchAutoredDirectV2]
    : [fetchAutoredDirectV2, fetchAutoredSupabaseFunction, fetchAutoredConfiguredEndpoint];

  for (const strategy of strategies) {
    try {
      const result = await runAutoredQueued(() => strategy(normalized));
      if (result && Object.keys(result).length > 0) {
        autoredPatentCache.set(normalized, {
          data: result,
          expiresAt: Date.now() + AUTORED_PATENT_CACHE_MS,
        });
        return result;
      }
    } catch (error) {
      if (error instanceof AutoredLookupError) throw error;
    }
  }

  return null;
}

export function getAutoredRateLimitStatus(): { blocked: boolean; retryAfterMs: number } {
  const retryAfterMs = getAutoredCooldownRemainingMs();
  return { blocked: retryAfterMs > 0, retryAfterMs };
}

export function isAutoredConfigured(): boolean {
  return Boolean(
    (process.env.AUTORED_EMAIL && process.env.AUTORED_PASSWORD) ||
      (process.env.VITE_AUTORED_EMAIL && process.env.VITE_AUTORED_PASSWORD) ||
      process.env.CATALOG_SOURCE_AUTORED_API_URL ||
      process.env.VITE_CATALOG_SOURCE_AUTORED_API_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.VITE_SUPABASE_URL ||
      process.env.SUPABASE_URL,
  );
}

export async function lookupAutoredDraftFields(
  patent: string,
): Promise<Partial<ManualPublicationDraft>> {
  const normalized = patent.toUpperCase().replace(/\s+/g, "").replace(/-/g, "");
  if (normalized.length < 4) {
    throw new AutoredLookupError(
      "INVALID_PATENT",
      "Patente invalida. Ingresa al menos 4 caracteres.",
      400,
    );
  }
  if (!isAutoredConfigured()) {
    throw new AutoredLookupError(
      "NOT_CONFIGURED",
      "Autored no esta configurado. Agrega AUTORED_EMAIL y AUTORED_PASSWORD en las variables de entorno.",
      503,
    );
  }

  const raw = await fetchAutoredPatentData(normalized);
  if (!raw) {
    throw new AutoredLookupError(
      "NOT_FOUND",
      "No se encontraron datos para esta patente en Autored.",
      404,
    );
  }
  const mapped = mapAutoredToDraftPartial(raw);
  if (Object.keys(mapped).length === 0) {
    throw new AutoredLookupError(
      "NOT_FOUND",
      "Autored respondio sin campos utilizables para esta patente.",
      404,
    );
  }
  return mapped;
}
