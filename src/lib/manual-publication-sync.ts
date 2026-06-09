import type { CatalogItem } from "@/types/catalog";
import type { EditorConfig, ManualPublication, SectionId } from "@/types/editor";

const SECTION_IDS: SectionId[] = [
  "proximos-remates",
  "ventas-directas",
  "novedades",
  "catalogo",
];

export function normalizePatent(value?: string | null): string | null {
  if (!value?.trim()) return null;
  const normalized = value.toUpperCase().replace(/\s+/g, "").replace(/-/g, "");
  return normalized.length >= 4 ? normalized : null;
}

export function getCatalogItemPatent(item: CatalogItem): string | null {
  const raw = item.raw as Record<string, unknown>;
  const patent = [raw.patente, raw.PATENTE, raw.PPU, raw.stock_number].find(
    (value) => typeof value === "string" && value.trim().length > 0,
  ) as string | undefined;
  return normalizePatent(patent);
}

export function getManualPublicationKey(manual: ManualPublication): string {
  const patent = normalizePatent(manual.patente);
  return patent ?? `manual-${manual.id}`;
}

export function getCatalogVehicleKey(item: CatalogItem): string {
  return getCatalogItemPatent(item) ?? item.id;
}

export function isManualCatalogItem(item: CatalogItem): boolean {
  const raw = item.raw as Record<string, unknown>;
  return item.id.startsWith("manual-") || raw.source === "manual";
}

function moveSectionAssignment(
  sectionVehicleIds: Record<SectionId, string[]>,
  fromKey: string,
  toKey: string,
) {
  for (const sectionId of SECTION_IDS) {
    const current = sectionVehicleIds[sectionId] ?? [];
    if (!current.includes(fromKey)) continue;
    const without = current.filter((entry) => entry !== fromKey);
    const next = without.includes(toKey) ? without : [...without, toKey];
    sectionVehicleIds[sectionId] = next;
  }
}

function mergeManualPublicationIntoConfig(
  config: EditorConfig,
  manual: ManualPublication,
  manualKey: string,
  gloKey: string,
): EditorConfig {
  const nextSectionVehicleIds = { ...config.sectionVehicleIds };
  for (const sectionId of manual.sectionIds ?? []) {
    const set = new Set(nextSectionVehicleIds[sectionId] ?? []);
    set.delete(manualKey);
    set.add(gloKey);
    nextSectionVehicleIds[sectionId] = Array.from(set);
  }
  moveSectionAssignment(nextSectionVehicleIds, manualKey, gloKey);

  const nextHidden = new Set(config.hiddenVehicleIds.filter((entry) => entry !== manualKey));
  if (!manual.visible) nextHidden.add(gloKey);
  else nextHidden.delete(gloKey);

  const nextPrices = { ...config.vehiclePrices };
  if (manual.price) nextPrices[gloKey] = manual.price;
  delete nextPrices[manualKey];

  const nextAuctionMap = { ...config.vehicleUpcomingAuctionIds };
  if (manual.upcomingAuctionId) nextAuctionMap[gloKey] = manual.upcomingAuctionId;
  delete nextAuctionMap[manualKey];

  const manualDetails = config.vehicleDetails[manualKey] ?? {};
  const gloDetails = config.vehicleDetails[gloKey] ?? {};
  const nextDetails = {
    ...config.vehicleDetails,
    [gloKey]: {
      ...gloDetails,
      ...manualDetails,
      title: manualDetails.title ?? manual.title ?? gloDetails.title,
      patente: manual.patente ?? gloDetails.patente,
      brand: manual.brand ?? gloDetails.brand,
      model: manual.model ?? gloDetails.model,
      year: manual.year ?? gloDetails.year,
      description: manual.description ?? gloDetails.description,
      thumbnail: manual.thumbnail ?? gloDetails.thumbnail,
      view3dUrl: manual.view3dUrl ?? gloDetails.view3dUrl,
      originalPrice: manual.originalPrice ?? manual.price ?? gloDetails.originalPrice,
      promoPrice: manual.promoPrice ?? gloDetails.promoPrice,
      promoEnabled: manual.promoEnabled ?? gloDetails.promoEnabled,
      imagesCsv: manual.images?.join(", ") ?? gloDetails.imagesCsv,
    },
  };
  delete nextDetails[manualKey];

  return {
    ...config,
    sectionVehicleIds: nextSectionVehicleIds,
    hiddenVehicleIds: Array.from(nextHidden),
    vehiclePrices: nextPrices,
    vehicleUpcomingAuctionIds: nextAuctionMap,
    vehicleDetails: nextDetails,
  };
}

export function syncManualPublicationsWithCatalog(
  config: EditorConfig,
  catalogItems: CatalogItem[],
): { config: EditorConfig; mergedPatents: string[] } {
  const manuals = config.manualPublications ?? [];
  if (manuals.length === 0) {
    return { config, mergedPatents: [] };
  }

  const gloByPatent = new Map<string, CatalogItem>();
  for (const item of catalogItems) {
    if (isManualCatalogItem(item)) continue;
    const patent = getCatalogItemPatent(item);
    if (patent) gloByPatent.set(patent, item);
  }

  let nextConfig = config;
  const mergedPatents: string[] = [];
  const remainingManuals: ManualPublication[] = [];

  for (const manual of manuals) {
    const patent = normalizePatent(manual.patente);
    const gloItem = patent ? gloByPatent.get(patent) : undefined;
    if (!patent || !gloItem) {
      remainingManuals.push(manual);
      continue;
    }

    const manualKey = getManualPublicationKey(manual);
    const gloKey = getCatalogVehicleKey(gloItem);
    nextConfig = mergeManualPublicationIntoConfig(nextConfig, manual, manualKey, gloKey);
    mergedPatents.push(patent);
  }

  if (mergedPatents.length === 0) {
    return { config, mergedPatents: [] };
  }

  return {
    config: {
      ...nextConfig,
      manualPublications: remainingManuals,
    },
    mergedPatents,
  };
}

export function filterManualItemsWithoutGloDuplicate(
  manualItems: CatalogItem[],
  catalogItems: CatalogItem[],
): CatalogItem[] {
  const gloPatents = new Set<string>();
  for (const item of catalogItems) {
    if (isManualCatalogItem(item)) continue;
    const patent = getCatalogItemPatent(item);
    if (patent) gloPatents.add(patent);
  }

  return manualItems.filter((item) => {
    const patent = getCatalogItemPatent(item);
    return !patent || !gloPatents.has(patent);
  });
}
