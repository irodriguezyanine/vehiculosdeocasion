import type { CatalogItem } from "@/types/catalog";
import type { EditorConfig } from "@/types/editor";

export function getVehicleKey(item: CatalogItem): string {
  const raw = item.raw as Record<string, unknown>;
  const patent = [raw.patente, raw.PATENTE, raw.PPU, raw.stock_number].find(
    (entry) => typeof entry === "string" && entry.trim().length > 0,
  ) as string | undefined;
  if (patent) return patent.toUpperCase().replace(/\s+/g, "").replace(/-/g, "");
  return item.id;
}

export function formatCatalogPrice(value?: string): string | null {
  if (!value?.trim()) return null;
  const sample = value.trim();
  const clean = sample.replace(/[^\d]/g, "");
  if (!clean) return null;
  const amount = Number(clean);
  if (!Number.isFinite(amount)) return null;
  const hasIva = /\biva\b/i.test(sample) && !/sin\s*iva/i.test(sample);
  const base = new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(amount);
  return hasIva ? `${base} + IVA` : base;
}

export function getVisibleCatalogItems(items: CatalogItem[], config: EditorConfig): CatalogItem[] {
  const soldSet = new Set(config.soldVehicleIds ?? []);
  const hiddenSet = new Set(config.hiddenVehicleIds ?? []);

  for (const soldVehicleId of config.soldVehicleIds ?? []) {
    hiddenSet.add(soldVehicleId);
  }
  for (const manual of config.manualPublications ?? []) {
    if (!manual.visible) hiddenSet.add(`manual-${manual.id}`);
  }

  return items.filter((item) => {
    const key = getVehicleKey(item);
    return !soldSet.has(key) && !hiddenSet.has(key);
  });
}

export function buildPriceLabelMap(config: EditorConfig): Record<string, string | null> {
  const map: Record<string, string | null> = {};
  for (const [key, value] of Object.entries(config.vehiclePrices ?? {})) {
    map[key] = formatCatalogPrice(value);
  }
  return map;
}

export function getVehicleMileage(item: CatalogItem): string | null {
  const raw = item.raw as Record<string, unknown>;
  const value = [raw.kilometraje, raw.km, raw.kms, raw.odometro, raw.mileage].find(
    (entry) => (typeof entry === "string" && entry.trim()) || typeof entry === "number",
  );
  if (typeof value === "number") return `${value.toLocaleString("es-CL")} km`;
  if (typeof value === "string") {
    const digits = value.replace(/[^\d]/g, "");
    if (digits) return `${Number(digits).toLocaleString("es-CL")} km`;
    return value.trim();
  }
  return null;
}

export function getVehicleImage(item: CatalogItem): string | null {
  if (item.thumbnail && item.thumbnail.startsWith("http")) return item.thumbnail;
  const fromList = item.images.find((url) => url.startsWith("http"));
  return fromList ?? null;
}
