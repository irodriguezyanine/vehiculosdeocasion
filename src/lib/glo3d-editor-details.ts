import type { CatalogItem } from "@/types/catalog";
import type { EditorVehicleDetails } from "@/types/editor";

function pickString(item: Record<string, unknown>, aliases: string[]): string | undefined {
  for (const key of aliases) {
    const value = item[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

function mergeRawSources(item: CatalogItem): Record<string, unknown> {
  const raw = (item.raw ?? {}) as Record<string, unknown>;
  const glo3d = (raw.glo3d as Record<string, unknown> | undefined) ?? {};
  const autored = (raw.autored as Record<string, unknown> | undefined) ?? {};
  return { ...glo3d, ...autored, ...raw };
}

export function extractGlo3dEditorDetails(item: CatalogItem): Partial<EditorVehicleDetails> {
  const merged = mergeRawSources(item);
  const details: Partial<EditorVehicleDetails> = {};

  const assign = (key: keyof EditorVehicleDetails, value?: string) => {
    if (value) (details as Record<string, string>)[key] = value;
  };

  assign("patente", pickString(merged, ["patente", "PPU", "ppu", "plate", "stock_number"]));
  assign("patenteVerifier", pickString(merged, ["patente_verifier", "ppu_dv", "dv", "verificador"]));
  assign("vin", pickString(merged, ["vin", "n_de_vin", "numero_vin"]));
  assign("nChasis", pickString(merged, ["n_de_chasis", "numero_chasis", "nro_chasis", "ndc", "chasis"]));
  assign("nMotor", pickString(merged, ["n_de_motor", "numero_motor", "ndm", "n°m"]));
  assign("nSerie", pickString(merged, ["n_de_serie", "numero_serie", "nds", "ser"]));
  assign("nSiniestro", pickString(merged, ["n_de_siniestro", "numero_siniestro", "n_s", "ns", "n°s"]));
  assign("brand", pickString(merged, ["marca", "brand", "make", "original_brand_name"]));
  assign("model", pickString(merged, ["modelo", "model", "model2", "original_model_name", "showName"]));
  assign("year", pickString(merged, ["ano", "anio", "year", "fields_year"]));
  assign("version", pickString(merged, ["version", "ver", "trim"]));
  assign("tipo", pickString(merged, ["tipo", "type", "tipo_unidad", "condition_type"]));
  assign("tipoVehiculo", pickString(merged, ["tipo_de_vehiculo", "tipo_vehiculo", "vehicle_type"]));
  assign("kilometraje", pickString(merged, ["kilometraje", "km", "mileage", "odometer"]));
  assign("color", pickString(merged, ["color", "color_exterior", "exterior_color"]));
  assign("combustible", pickString(merged, ["combustible", "fuel_type", "fuel", "tipo_combustible"]));
  assign("transmision", pickString(merged, ["transmision", "transmission", "caja", "gearbox"]));
  assign("traccion", pickString(merged, ["traccion", "drive_type", "drivetrain", "traction"]));
  assign("aro", pickString(merged, ["aro", "rin", "wheel_size"]));
  assign("cilindrada", pickString(merged, ["cilindrada", "cc", "engine_cc", "engine", "engin_description"]));
  assign("ubicacionFisica", pickString(merged, ["ubicacion_fisica", "ubi", "location"]));
  assign("transportista", pickString(merged, ["transportista", "tra"]));
  assign("taller", pickString(merged, ["taller", "tal"]));
  assign("llaves", pickString(merged, ["llaves", "lla", "keys", "has_keys"]));
  assign("unicoPropietario", pickString(merged, ["unico_propietario", "DUN", "single_owner", "one_owner"]));
  assign("multas", pickString(merged, ["multas", "mul", "Mul"]));
  assign("tag", pickString(merged, ["tag", "TAG"]));
  assign("vencRevisionTecnica", pickString(merged, ["vencimiento_revision_tecnica", "vrt"]));
  assign("vencPermisoCirculacion", pickString(merged, ["vencimiento_permiso_circulacion", "vpc"]));
  assign("vencSeguroObligatorio", pickString(merged, ["vencimiento_seguro_obligatorio", "vso"]));
  assign("pruebaMotor", pickString(merged, ["prueba_motor", "pdm"]));
  assign("pruebaDesplazamiento", pickString(merged, ["prueba_desplazamiento", "pdd"]));
  assign("estadoAirbags", pickString(merged, ["estado_airbags", "eda"]));
  assign("nombrePropietarioAnterior", pickString(merged, ["nombre_propietario_anterior", "npa"]));
  assign("rutPropietarioAnterior", pickString(merged, ["rut_propietario_anterior", "rpa"]));
  assign("location", pickString(merged, ["ubicacion", "location"]));

  if (item.view3dUrl) details.view3dUrl = item.view3dUrl;
  const images = item.images.filter((url) => url.startsWith("http"));
  if (images.length > 0) {
    details.imagesCsv = images.join(", ");
    details.thumbnail = item.thumbnail ?? images[0];
  }

  return details;
}

export function mergeEditorDetailsPreferPrimary(
  primary: EditorVehicleDetails,
  fallback: Partial<EditorVehicleDetails>,
): EditorVehicleDetails {
  const merged: EditorVehicleDetails = { ...fallback };
  for (const [key, value] of Object.entries(primary)) {
    if (value !== undefined && String(value).trim() !== "") {
      (merged as Record<string, unknown>)[key] = value;
    }
  }
  return merged;
}
