import {
  buildManualDraftDetails,
  EMPTY_MANUAL_PUBLICATION_DRAFT,
  type ManualPublicationDraft,
} from "@/lib/manual-publication-draft";
import { getManualPublicationKey } from "@/lib/manual-publication-sync";
import { buildVehicleTitleFromParts } from "@/lib/vehicle-title";
import type { EditorConfig, EditorVehicleDetails, ManualPublication, SectionId } from "@/types/editor";

const PLACEHOLDER_THUMBNAIL = "/placeholder-car.svg";

function cleanOptional(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export type ManualPublicationBundle = {
  manual: ManualPublication;
  itemKey: string;
  detailsDraft: EditorVehicleDetails;
};

export type BuildManualPublicationResult =
  | { ok: true; bundle: ManualPublicationBundle }
  | { ok: false; error: string };

export function buildManualPublicationFromDraft(
  draft: ManualPublicationDraft,
  options?: { id?: string; uploadedImages?: string[] },
): BuildManualPublicationResult {
  const patente = cleanOptional(draft.patente)?.toUpperCase().replace(/\s+/g, "").replace(/-/g, "") ?? "";
  const autoTitle = buildVehicleTitleFromParts(draft);
  const title = draft.title?.trim() || autoTitle || patente;
  if (!title && !patente) {
    return { ok: false, error: "Falta patente o titulo/marca-modelo." };
  }

  const imagesCsv = draft.imagesCsv ?? "";
  const cloudinaryImages = Array.from(
    new Set([
      ...(options?.uploadedImages ?? []),
      ...imagesCsv
        .split(/[\n,]+/)
        .map((url) => url.trim())
        .filter((url) => url.startsWith("http")),
    ]),
  );
  const sectionIds: SectionId[] = draft.sectionIds.length > 0 ? draft.sectionIds : ["catalogo"];
  const normalizedNormalPrice = cleanOptional(draft.normalPrice);
  const normalizedPromoPrice = cleanOptional(draft.promoPrice);
  if (draft.promoEnabled && !normalizedPromoPrice) {
    return { ok: false, error: "Precio promocional activo sin monto." };
  }
  const promoEnabled = Boolean(draft.promoEnabled && normalizedPromoPrice);
  const activePrice = promoEnabled ? normalizedPromoPrice : normalizedNormalPrice;
  const thumbnail =
    cleanOptional(draft.thumbnail) ?? cloudinaryImages[0] ?? PLACEHOLDER_THUMBNAIL;

  const manual: ManualPublication = {
    id: options?.id ?? crypto.randomUUID(),
    title,
    subtitle: cleanOptional(draft.subtitle),
    status: cleanOptional(draft.status) ?? "Disponible",
    location: cleanOptional(draft.location),
    lot: cleanOptional(draft.lot),
    auctionDate: cleanOptional(draft.auctionDate),
    description: cleanOptional(draft.description),
    patente: cleanOptional(patente),
    brand: cleanOptional(draft.brand),
    model: cleanOptional(draft.model),
    year: cleanOptional(draft.year),
    category: cleanOptional(draft.category),
    images: cloudinaryImages.length > 0 ? cloudinaryImages : [thumbnail],
    thumbnail,
    view3dUrl: cleanOptional(draft.view3dUrl),
    sectionIds,
    upcomingAuctionId: cleanOptional(draft.upcomingAuctionId),
    visible: draft.visible,
    price: activePrice,
    originalPrice: normalizedNormalPrice,
    promoPrice: normalizedPromoPrice,
    promoEnabled,
  };

  const detailsDraft = buildManualDraftDetails({
    ...draft,
    title,
    patente,
    status: manual.status ?? "Disponible",
    thumbnail,
    originalPrice: normalizedNormalPrice ?? "",
    promoPrice: normalizedPromoPrice ?? "",
    promoEnabled,
    imagesCsv: cloudinaryImages.join(", "),
  });

  return {
    ok: true,
    bundle: {
      manual,
      itemKey: getManualPublicationKey(manual),
      detailsDraft,
    },
  };
}

export function buildManualDraftFromAutoredFields(
  patente: string,
  fields: Partial<ManualPublicationDraft>,
  sectionIds: SectionId[],
): ManualPublicationDraft {
  const normalized = patente.toUpperCase().replace(/\s+/g, "").replace(/-/g, "");
  const autoTitle = buildVehicleTitleFromParts(fields);

  return {
    ...EMPTY_MANUAL_PUBLICATION_DRAFT,
    ...fields,
    patente: fields.patente ?? normalized,
    title: fields.title?.trim() || autoTitle || normalized,
    status: fields.status?.trim() || "Disponible",
    sectionIds: sectionIds.length > 0 ? sectionIds : ["catalogo"],
    visible: true,
    thumbnail: fields.thumbnail ?? PLACEHOLDER_THUMBNAIL,
  };
}

export function applyManualPublicationBundlesToConfig(
  config: EditorConfig,
  bundles: ManualPublicationBundle[],
): EditorConfig {
  if (bundles.length === 0) return config;

  const nextSectionVehicleIds = { ...config.sectionVehicleIds };
  const nextHidden = new Set(config.hiddenVehicleIds);
  const nextVehiclePrices = { ...config.vehiclePrices };
  const nextVehicleUpcomingAuctionIds = { ...config.vehicleUpcomingAuctionIds };
  const nextVehicleDetails = { ...config.vehicleDetails };
  const nextManualPublications = [...(config.manualPublications ?? [])];

  for (const { manual, itemKey, detailsDraft } of bundles) {
    for (const sectionId of manual.sectionIds ?? []) {
      const set = new Set(nextSectionVehicleIds[sectionId] ?? []);
      set.add(itemKey);
      nextSectionVehicleIds[sectionId] = Array.from(set);
    }
    if (!manual.visible) nextHidden.add(itemKey);
    else nextHidden.delete(itemKey);
    if (manual.price) nextVehiclePrices[itemKey] = manual.price;
    if (manual.upcomingAuctionId) {
      nextVehicleUpcomingAuctionIds[itemKey] = manual.upcomingAuctionId;
    }
    nextVehicleDetails[itemKey] = detailsDraft;
    nextManualPublications.push(manual);
  }

  return {
    ...config,
    sectionVehicleIds: nextSectionVehicleIds,
    hiddenVehicleIds: Array.from(nextHidden),
    vehiclePrices: nextVehiclePrices,
    vehicleUpcomingAuctionIds: nextVehicleUpcomingAuctionIds,
    vehicleDetails: nextVehicleDetails,
    manualPublications: nextManualPublications,
  };
}
