type VehicleTitleParts = {
  brand?: string | null;
  model?: string | null;
  year?: string | null;
  version?: string | null;
};

/** Titulo visible: Marca Modelo Año Version (sin patente). */
export function buildVehicleTitleFromParts(parts: VehicleTitleParts): string {
  return [parts.brand, parts.model, parts.year, parts.version]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(" ");
}
