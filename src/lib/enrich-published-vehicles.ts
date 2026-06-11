import { extractGlo3dEditorDetails, mergeEditorDetailsPreferPrimary } from "@/lib/glo3d-editor-details";
import {
  isPlaceholderCatalogThumbnail,
  resolveCatalogItemThumbnail,
  resolveGlo3dThumbnailFromRecord,
} from "@/lib/catalog";
import {
  getManualPublicationKey,
  getCatalogItemPatent,
  getCatalogVehicleKey,
  normalizePatent,
} from "@/lib/manual-publication-sync";
import { normalizePatentToken } from "@/lib/patent-input";
import { buildVehicleTitleFromParts } from "@/lib/vehicle-title";
import {
  AUTORED_IDENTIFICATION_FIELDS,
  AUTORED_MECHANICAL_FIELDS,
  applyAutoredLookupToDraft,
  extractAutoredMechanicalDetails,
  extractGlo3dOperationDetails,
  mergeAutoredMechanicalIntoDraft,
  mergeGlo3dOperationIntoDraft,
} from "@/lib/vehicle-draft-sources";
import { EMPTY_MANUAL_PUBLICATION_DRAFT, type ManualPublicationDraft } from "@/lib/manual-publication-draft";
import type { CatalogItem } from "@/types/catalog";
import type { EditorConfig, EditorVehicleDetails, ManualPublication } from "@/types/editor";

const PLACEHOLDER_THUMBNAIL = "/placeholder-car.svg";

export type EnrichPublishedStats = {
  publishedCount: number;
  gloEnriched: number;
  autoredEnriched: number;
  manualMediaUpdated: number;
  fieldsFilled: number;
};

function isPlaceholderThumbnail(value?: string | null): boolean {
  return isPlaceholderCatalogThumbnail(value);
}

function collectPublishedVehicleKeys(config: EditorConfig): string[] {
  const keys = new Set<string>();
  for (const ids of Object.values(config.sectionVehicleIds)) {
    for (const id of ids) keys.add(id);
  }
  for (const category of config.managedCategories ?? []) {
    for (const id of category.vehicleIds ?? []) keys.add(id);
  }
  for (const manual of config.manualPublications ?? []) {
    keys.add(getManualPublicationKey(manual));
  }
  return Array.from(keys);
}

function buildCatalogLookup(catalogItems: CatalogItem[]): Map<string, CatalogItem> {
  const map = new Map<string, CatalogItem>();
  for (const item of catalogItems) {
    map.set(item.id, item);
    map.set(getCatalogVehicleKey(item), item);
    const patent = getCatalogItemPatent(item);
    if (patent) map.set(patent, item);
  }
  return map;
}

function resolveCatalogItem(
  vehicleKey: string,
  catalogLookup: Map<string, CatalogItem>,
): CatalogItem | undefined {
  if (catalogLookup.has(vehicleKey)) return catalogLookup.get(vehicleKey);
  const normalized = normalizePatentToken(vehicleKey);
  if (normalized && catalogLookup.has(normalized)) return catalogLookup.get(normalized);
  return undefined;
}

function editorDetailsToDraft(details: EditorVehicleDetails | undefined): ManualPublicationDraft {
  return {
    ...EMPTY_MANUAL_PUBLICATION_DRAFT,
    ...(details ?? {}),
  };
}

function draftToEditorDetails(draft: ManualPublicationDraft): EditorVehicleDetails {
  const details: EditorVehicleDetails = {};
  for (const [key, value] of Object.entries(draft)) {
    if (typeof value === "string" && value.trim()) {
      (details as Record<string, string>)[key] = value.trim();
    } else if (typeof value === "boolean") {
      (details as Record<string, boolean>)[key] = value;
    }
  }
  return details;
}

function countFilledFields(before: EditorVehicleDetails | undefined, after: EditorVehicleDetails): number {
  let count = 0;
  for (const [key, value] of Object.entries(after)) {
    if (typeof value !== "string" || !value.trim()) continue;
    const previous = before?.[key as keyof EditorVehicleDetails];
    if (typeof previous === "string" && previous.trim()) continue;
    count += 1;
  }
  return count;
}

function enrichDetailsFromCatalogItem(
  current: EditorVehicleDetails | undefined,
  item: CatalogItem,
): { details: EditorVehicleDetails; filled: number } {
  let draft = editorDetailsToDraft(current);
  const raw = item.raw as Record<string, unknown>;
  const preferGlo3d = Boolean(raw?.glo3d && typeof raw.glo3d === "object") || Boolean(item.view3dUrl?.trim());
  draft = mergeGlo3dOperationIntoDraft(draft, extractGlo3dOperationDetails(item), preferGlo3d);
  draft = mergeAutoredMechanicalIntoDraft(draft, extractAutoredMechanicalDetails(item), false);

  const gloEditor = extractGlo3dEditorDetails(item);
  const merged = mergeEditorDetailsPreferPrimary(draftToEditorDetails(draft), gloEditor);

  const images = item.images.filter((url) => url.startsWith("http"));
  const resolvedThumbnail = resolveCatalogItemThumbnail(item);
  if (isPlaceholderThumbnail(merged.thumbnail) && resolvedThumbnail) {
    merged.thumbnail = resolvedThumbnail;
  } else if (!merged.thumbnail?.trim() && (item.thumbnail || images[0])) {
    merged.thumbnail = item.thumbnail ?? images[0];
  }
  if (!merged.view3dUrl?.trim() && item.view3dUrl?.trim()) {
    merged.view3dUrl = item.view3dUrl.trim();
  }
  if (!merged.imagesCsv?.trim() && images.length > 0) {
    merged.imagesCsv = images.join(", ");
  }
  if (!merged.patente?.trim()) {
    const patent = getCatalogItemPatent(item);
    if (patent) merged.patente = patent;
  }

  return {
    details: merged,
    filled: countFilledFields(current, merged),
  };
}

function enrichDetailsFromAutored(
  current: EditorVehicleDetails | undefined,
  autored: Partial<ManualPublicationDraft>,
): { details: EditorVehicleDetails; filled: number } {
  const draft = applyAutoredLookupToDraft(editorDetailsToDraft(current), autored);
  const merged = draftToEditorDetails(draft);
  return {
    details: merged,
    filled: countFilledFields(current, merged),
  };
}

function needsAutoredLookup(details: EditorVehicleDetails | undefined, patent: string): boolean {
  if (!patent) return false;
  const mechanicalMissing = AUTORED_MECHANICAL_FIELDS.some(
    (field) => !String(details?.[field] ?? "").trim(),
  );
  const identificationMissing = AUTORED_IDENTIFICATION_FIELDS.some((field) => {
    if (field === "title" || field === "category" || field === "tipo" || field === "tipoVehiculo") {
      return false;
    }
    return !String(details?.[field as keyof EditorVehicleDetails] ?? "").trim();
  });
  return mechanicalMissing || identificationMissing;
}

function resolvePatentForKey(
  vehicleKey: string,
  details: EditorVehicleDetails | undefined,
  item: CatalogItem | undefined,
  manual?: ManualPublication,
): string | null {
  return (
    normalizePatent(details?.patente) ??
    normalizePatent(manual?.patente) ??
    (item ? getCatalogItemPatent(item) : null) ??
    normalizePatent(vehicleKey)
  );
}

function enrichManualPublicationFromSources(
  manual: ManualPublication,
  item: CatalogItem | undefined,
  autored?: Partial<ManualPublicationDraft>,
): { manual: ManualPublication; mediaUpdated: boolean } {
  const next = { ...manual };
  let mediaUpdated = false;

  if (item) {
    const images = item.images.filter((url) => url.startsWith("http"));
    const resolvedThumbnail = resolveCatalogItemThumbnail(item);
    if (isPlaceholderThumbnail(next.thumbnail) && resolvedThumbnail) {
      next.thumbnail = resolvedThumbnail;
      mediaUpdated = true;
    } else if (isPlaceholderThumbnail(next.thumbnail) && (item.thumbnail || images[0])) {
      next.thumbnail = item.thumbnail ?? images[0] ?? next.thumbnail;
      mediaUpdated = true;
    }
    if (!next.view3dUrl?.trim() && item.view3dUrl?.trim()) {
      next.view3dUrl = item.view3dUrl.trim();
      mediaUpdated = true;
    }
    if ((next.images?.length ?? 0) <= 1 && isPlaceholderThumbnail(next.thumbnail) && images.length > 0) {
      next.images = images;
      mediaUpdated = true;
    }
  }

  if (autored) {
    if (autored.brand?.trim()) next.brand = autored.brand.trim();
    if (autored.model?.trim()) next.model = autored.model.trim();
    if (autored.year?.trim()) next.year = autored.year.trim();
    const autoTitle = buildVehicleTitleFromParts({
      brand: next.brand,
      model: next.model,
      year: next.year,
      version: autored.version,
    });
    if (autoTitle) next.title = autoTitle;
  }

  return { manual: next, mediaUpdated };
}

export function collectAutoredLookupPatents(
  config: EditorConfig,
  catalogItems: CatalogItem[],
): string[] {
  const catalogLookup = buildCatalogLookup(catalogItems);
  const manualByKey = new Map(
    (config.manualPublications ?? []).map((manual) => [getManualPublicationKey(manual), manual]),
  );
  const patentes = new Set<string>();

  for (const vehicleKey of collectPublishedVehicleKeys(config)) {
    const item = resolveCatalogItem(vehicleKey, catalogLookup);
    const manual = manualByKey.get(vehicleKey);
    const current = config.vehicleDetails[vehicleKey];
    const patent = resolvePatentForKey(vehicleKey, current, item, manual);
    if (!patent) continue;

    const { details: afterGlo } = item
      ? enrichDetailsFromCatalogItem(current, item)
      : { details: current ?? {} };
    if (needsAutoredLookup(afterGlo, patent)) patentes.add(patent);
  }

  return Array.from(patentes);
}

export function collectPublishedPatentsMissingGlo3d(
  config: EditorConfig,
  catalogItems: CatalogItem[],
): string[] {
  const catalogLookup = buildCatalogLookup(catalogItems);
  const manualByKey = new Map(
    (config.manualPublications ?? []).map((manual) => [getManualPublicationKey(manual), manual]),
  );
  const patentes = new Set<string>();

  for (const vehicleKey of collectPublishedVehicleKeys(config)) {
    const item = resolveCatalogItem(vehicleKey, catalogLookup);
    const manual = manualByKey.get(vehicleKey);
    const current = config.vehicleDetails[vehicleKey];
    const patent = resolvePatentForKey(vehicleKey, current, item, manual);
    if (!patent) continue;

    const hasView3d = Boolean(item?.view3dUrl?.trim() || current?.view3dUrl?.trim());
    const raw = item?.raw as Record<string, unknown> | undefined;
    const hasGlo3dRaw = Boolean(raw?.glo3d && typeof raw.glo3d === "object");
    if (hasView3d && hasGlo3dRaw) continue;
    patentes.add(patent);
  }

  return Array.from(patentes);
}

export type Glo3dByPatentMap = Record<
  string,
  { view3dUrl?: string; technicalFields?: Record<string, unknown>; raw?: Record<string, unknown> }
>;

export function mergeGlo3dResponseIntoCatalogItems(
  catalogItems: CatalogItem[],
  byPatent: Glo3dByPatentMap,
): CatalogItem[] {
  if (Object.keys(byPatent).length === 0) return catalogItems;

  return catalogItems.map((item) => {
    const patent = getCatalogItemPatent(item);
    if (!patent) return item;
    const glo3d = byPatent[patent];
    if (!glo3d) return item;

    const raw = item.raw as Record<string, unknown>;
    const technicalFields = glo3d.technicalFields ?? {};
    const glo3dThumb = glo3d.raw ? resolveGlo3dThumbnailFromRecord(glo3d.raw) : undefined;
    return {
      ...item,
      view3dUrl: item.view3dUrl ?? glo3d.view3dUrl,
      thumbnail:
        !isPlaceholderCatalogThumbnail(item.thumbnail) && item.thumbnail
          ? item.thumbnail
          : glo3dThumb ?? item.thumbnail,
      raw: {
        ...raw,
        ...technicalFields,
        glo3d: glo3d.raw ?? raw.glo3d,
      },
    };
  });
}

function buildSyntheticCatalogItemFromGlo3d(
  patent: string,
  glo3d: Glo3dByPatentMap[string],
): CatalogItem {
  const technicalFields = glo3d.technicalFields ?? {};
  const raw = glo3d.raw ?? {};
  const thumb = resolveGlo3dThumbnailFromRecord(raw);

  return {
    id: patent,
    title: patent,
    thumbnail: thumb,
    images: thumb ? [thumb] : [],
    view3dUrl: glo3d.view3dUrl,
    raw: {
      patente: patent,
      PPU: patent,
      ...technicalFields,
      glo3d: raw,
    },
  };
}

function resolveEnrichmentCatalogItem(
  item: CatalogItem | undefined,
  patent: string | null,
  glo3dByPatent: Glo3dByPatentMap,
): CatalogItem | undefined {
  if (!patent) return item;
  const glo3d = glo3dByPatent[patent];
  if (!glo3d) return item;

  if (!item) {
    return buildSyntheticCatalogItemFromGlo3d(patent, glo3d);
  }

  const merged = mergeGlo3dResponseIntoCatalogItems([item], { [patent]: glo3d });
  return merged[0];
}

export function enrichPublishedVehiclesConfig(
  config: EditorConfig,
  catalogItems: CatalogItem[],
  autoredByPatent: Record<string, Partial<ManualPublicationDraft>> = {},
  glo3dByPatent: Glo3dByPatentMap = {},
): { config: EditorConfig; stats: EnrichPublishedStats } {
  const catalogLookup = buildCatalogLookup(catalogItems);
  const publishedKeys = collectPublishedVehicleKeys(config);
  const nextDetails = { ...config.vehicleDetails };
  const manualByKey = new Map(
    (config.manualPublications ?? []).map((manual) => [getManualPublicationKey(manual), manual]),
  );
  const nextManuals = [...(config.manualPublications ?? [])];

  let gloEnriched = 0;
  let autoredEnriched = 0;
  let manualMediaUpdated = 0;
  let fieldsFilled = 0;

  for (const vehicleKey of publishedKeys) {
    const item = resolveCatalogItem(vehicleKey, catalogLookup);
    const manual = manualByKey.get(vehicleKey);
    const current = nextDetails[vehicleKey];
    let working = current;

    const patent = resolvePatentForKey(vehicleKey, working, item, manual);
    const enrichmentItem = resolveEnrichmentCatalogItem(item, patent, glo3dByPatent);

    if (enrichmentItem) {
      const gloResult = enrichDetailsFromCatalogItem(working, enrichmentItem);
      if (gloResult.filled > 0) {
        gloEnriched += 1;
        fieldsFilled += gloResult.filled;
      }
      working = gloResult.details;
    }

    const autored = patent ? autoredByPatent[patent] : undefined;
    if (autored) {
      const autoredResult = enrichDetailsFromAutored(working, autored);
      if (autoredResult.filled > 0) {
        autoredEnriched += 1;
        fieldsFilled += autoredResult.filled;
      }
      working = autoredResult.details;
    }

    if (working && Object.keys(working).length > 0) {
      nextDetails[vehicleKey] = working;
    }

    if (manual) {
      const manualIndex = nextManuals.findIndex((entry) => entry.id === manual.id);
      if (manualIndex >= 0) {
        const enrichedManual = enrichManualPublicationFromSources(
          manual,
          enrichmentItem ?? item,
          autored,
        );
        nextManuals[manualIndex] = enrichedManual.manual;
        if (enrichedManual.mediaUpdated) manualMediaUpdated += 1;
      }
    }
  }

  return {
    config: {
      ...config,
      vehicleDetails: nextDetails,
      manualPublications: nextManuals,
    },
    stats: {
      publishedCount: publishedKeys.length,
      gloEnriched,
      autoredEnriched,
      manualMediaUpdated,
      fieldsFilled,
    },
  };
}
