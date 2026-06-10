import { extractGlo3dEditorDetails, mergeEditorDetailsPreferPrimary } from "@/lib/glo3d-editor-details";
import {
  getManualPublicationKey,
  getCatalogItemPatent,
  getCatalogVehicleKey,
  normalizePatent,
} from "@/lib/manual-publication-sync";
import { normalizePatentToken } from "@/lib/patent-input";
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
  const trimmed = value?.trim();
  return !trimmed || trimmed === PLACEHOLDER_THUMBNAIL || trimmed.endsWith("/placeholder-car.svg");
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
  draft = mergeGlo3dOperationIntoDraft(draft, extractGlo3dOperationDetails(item), false);
  draft = mergeAutoredMechanicalIntoDraft(draft, extractAutoredMechanicalDetails(item), false);

  const gloEditor = extractGlo3dEditorDetails(item);
  const merged = mergeEditorDetailsPreferPrimary(draftToEditorDetails(draft), gloEditor);

  const images = item.images.filter((url) => url.startsWith("http"));
  if (!merged.thumbnail?.trim() && (item.thumbnail || images[0])) {
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
    if (isPlaceholderThumbnail(next.thumbnail) && (item.thumbnail || images[0])) {
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
    if (!next.brand?.trim() && autored.brand?.trim()) next.brand = autored.brand.trim();
    if (!next.model?.trim() && autored.model?.trim()) next.model = autored.model.trim();
    if (!next.year?.trim() && autored.year?.trim()) next.year = autored.year.trim();
    if (!next.title?.trim()) {
      const autoTitle = [autored.brand, autored.model, autored.year]
        .map((value) => value?.trim())
        .filter(Boolean)
        .join(" ");
      if (autoTitle) next.title = autoTitle;
    }
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

export function enrichPublishedVehiclesConfig(
  config: EditorConfig,
  catalogItems: CatalogItem[],
  autoredByPatent: Record<string, Partial<ManualPublicationDraft>> = {},
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
    const current = nextDetails[vehicleKey];
    let working = current;

    if (item) {
      const gloResult = enrichDetailsFromCatalogItem(working, item);
      if (gloResult.filled > 0) {
        gloEnriched += 1;
        fieldsFilled += gloResult.filled;
      }
      working = gloResult.details;
    }

    const manual = manualByKey.get(vehicleKey);
    const patent = resolvePatentForKey(vehicleKey, working, item, manual);
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
        const enrichedManual = enrichManualPublicationFromSources(manual, item, autored);
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
