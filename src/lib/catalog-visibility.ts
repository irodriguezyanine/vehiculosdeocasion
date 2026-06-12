import type { CatalogItem } from "@/types/catalog";
import type { EditorConfig } from "@/types/editor";
import { normalizePatentToken } from "@/lib/patent-input";

export function getPatentFromItem(item: CatalogItem): string {
  const raw = item.raw as Record<string, unknown>;
  const patent = [raw.patente, raw.PATENTE, raw.PPU, raw.stock_number].find(
    (entry) => typeof entry === "string" && entry.trim().length > 0,
  ) as string | undefined;
  return patent?.trim() ?? "-";
}

export function buildItemsByKey(items: CatalogItem[]): Map<string, CatalogItem> {
  const map = new Map<string, CatalogItem>();
  for (const item of items) {
    map.set(getVehicleKey(item), item);
  }
  return map;
}

export function resolveInventoryItemKey(
  assignmentKey: string,
  itemsByKey: Map<string, CatalogItem>,
): string | null {
  if (itemsByKey.has(assignmentKey)) return assignmentKey;
  const normalized = normalizePatentToken(assignmentKey);
  if (normalized && itemsByKey.has(normalized)) return normalized;
  for (const [key, item] of itemsByKey) {
    if (item.id === assignmentKey) return key;
    const itemPatent = normalizePatentToken(getPatentFromItem(item));
    if (itemPatent && itemPatent !== "-" && itemPatent === normalized) return key;
  }
  return null;
}

export function resolveInventoryItem(
  assignmentKey: string,
  itemsByKey: Map<string, CatalogItem>,
): CatalogItem | undefined {
  const key = resolveInventoryItemKey(assignmentKey, itemsByKey);
  return key ? itemsByKey.get(key) : undefined;
}

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

const HOME_SECTION_LABELS: Record<string, string> = {
  "proximos-remates": "Destacados",
  "ventas-directas": "Venta directa",
  novedades: "Novedad",
  catalogo: "Catalogo",
};

function assignmentKeysMatch(storedId: string, vehicleKey: string): boolean {
  if (storedId === vehicleKey) return true;
  const normalizedStored = storedId.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const normalizedVehicle = vehicleKey.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return normalizedStored.length > 0 && normalizedStored === normalizedVehicle;
}

export function isVehicleInAssignmentList(ids: string[], vehicleKey: string): boolean {
  return ids.some((storedId) => assignmentKeysMatch(storedId, vehicleKey));
}

/** Igual que en el modal de alta: reconoce IDs antiguos, patentes e item.id. */
export function isVehicleAssignedInSectionList(
  sectionIds: string[],
  vehicleKey: string,
  itemsByKey?: Map<string, CatalogItem>,
): boolean {
  if (isVehicleInAssignmentList(sectionIds, vehicleKey)) return true;
  if (!itemsByKey || itemsByKey.size === 0) return false;
  const resolvedVehicleKey = resolveInventoryItemKey(vehicleKey, itemsByKey);
  if (resolvedVehicleKey && isVehicleInAssignmentList(sectionIds, resolvedVehicleKey)) return true;
  return sectionIds.some(
    (assignedId) => resolveInventoryItemKey(assignedId, itemsByKey) === vehicleKey,
  );
}

/** Un vehiculo asignado a alguna seccion o categoria gestionada del home. */
export function isVehicleAssignedToHomeEditorChannels(
  config: EditorConfig,
  vehicleKey: string,
  itemsByKey?: Map<string, CatalogItem>,
): boolean {
  for (const ids of Object.values(config.sectionVehicleIds)) {
    if (isVehicleAssignedInSectionList(ids, vehicleKey, itemsByKey)) return true;
  }
  for (const category of config.managedCategories ?? []) {
    if (isVehicleAssignedInSectionList(category.vehicleIds ?? [], vehicleKey, itemsByKey)) return true;
  }
  return false;
}

export function getHomeEditorChannelLabels(
  config: EditorConfig,
  vehicleKey: string,
  itemsByKey?: Map<string, CatalogItem>,
): string[] {
  const labels: string[] = [];
  for (const [sectionId, ids] of Object.entries(config.sectionVehicleIds)) {
    if (isVehicleAssignedInSectionList(ids, vehicleKey, itemsByKey)) {
      labels.push(HOME_SECTION_LABELS[sectionId] ?? sectionId);
    }
  }
  for (const category of config.managedCategories ?? []) {
    if (isVehicleAssignedInSectionList(category.vehicleIds ?? [], vehicleKey, itemsByKey)) {
      labels.push(category.name);
    }
  }
  return labels;
}

/** Vehiculos visibles y asignados a alguna seccion del home (stock publicado). */
export function getHomeEditorStockItems(items: CatalogItem[], config: EditorConfig): CatalogItem[] {
  const itemsByKey = buildItemsByKey(items);
  return getVisibleCatalogItems(items, config).filter((item) =>
    isVehicleAssignedToHomeEditorChannels(config, getVehicleKey(item), itemsByKey),
  );
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
