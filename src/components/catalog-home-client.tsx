"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type WheelEvent as ReactWheelEvent,
} from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CatalogCard } from "@/components/catalog-card";
import { InstagramSection } from "@/components/instagram-section";
import { BulkManualPublicationsModal } from "@/components/bulk-manual-publications-modal";
import { ManualPublicationModal } from "@/components/manual-publication-modal";
import { SiteHeader } from "@/components/site-header";
import {
  INSTAGRAM_HANDLE,
  INSTAGRAM_PROFILE_URL,
} from "@/lib/instagram";
import {
  CONTACT_PHONE,
  CONTACT_WHATSAPP_DIGITS,
  WHATSAPP_API_BASE,
  WHATSAPP_DEFAULT_LINK,
  WHATSAPP_WA_ME_BASE,
} from "@/lib/contact";
import {
  EMPTY_MANUAL_PUBLICATION_DRAFT,
  buildManualDraftDetails,
  type ManualPublicationDraft,
} from "@/lib/manual-publication-draft";
import {
  isManualCatalogItem,
  getManualPublicationKey,
  filterManualItemsWithoutGloDuplicate,
  syncManualPublicationsWithCatalog,
} from "@/lib/manual-publication-sync";
import { COMMERCIAL_EMAIL } from "@/lib/site-content";
import {
  filterHiddenVehicleIdsForVehicle,
  getHomeEditorChannelLabels,
  isVehicleAssignedInSectionList,
  isVehicleAssignedToHomeEditorChannels,
  isVehicleInAssignmentList,
  registerHiddenKeyAliases,
  resolveInventoryItem,
  resolveInventoryItemKey,
  unhideVehiclesInConfig,
} from "@/lib/catalog-visibility";
import {
  applyAutoredLookupToDraft,
  extractAutoredMechanicalDetails,
  extractGlo3dOperationDetails,
  mergeAutoredMechanicalIntoDraft,
  mergeGlo3dOperationIntoDraft,
} from "@/lib/vehicle-draft-sources";
import {
  applyManualPublicationBundlesToConfig,
  buildManualPublicationFromDraft,
} from "@/lib/create-manual-publication";
import { buildVehicleTitleFromParts } from "@/lib/vehicle-title";
import {
  extractPatentTokens,
  normalizePatentToken,
} from "@/lib/patent-input";
import { SITE_EDITOR_SCOPE } from "@/lib/editor-config";
import {
  collectAutoredLookupPatents,
  collectPublishedPatentsMissingGlo3d,
  enrichPublishedVehiclesConfig,
  mergeGlo3dResponseIntoCatalogItems,
} from "@/lib/enrich-published-vehicles";
import {
  isPlaceholderCatalogThumbnail,
  resolveCatalogItemThumbnail,
  resolveGlo3dThumbnailFromRecord,
} from "@/lib/catalog";
import {
  getAutoredClientCooldownMs,
  lookupAutoredPatentClient,
  lookupAutoredPatentsSequential,
} from "@/lib/autored-client-queue";
import type { CatalogFeed, CatalogItem } from "@/types/catalog";
import type { OfferRecord } from "@/types/offers";
import {
  DEFAULT_EDITOR_CONFIG,
  type EditorConfig,
  type EditorVehicleDetails,
  type HomeSectionOrderId,
  type ManagedCategory,
  type ManualPublication,
  type SoldVehicleRecord,
  type UpcomingAuction,
  type SectionId,
  type VehicleTypeId,
} from "@/types/editor";

const EDITOR_STORAGE_KEY = "vehiculosdeocasion_editor_config_local";
const FAVORITES_STORAGE_KEY = "vehiculosdeocasion_client_favorites";
const HOME_QUICK_FILTERS_STORAGE_KEY = "vehiculosdeocasion_home_quick_filters";
const HOME_CARD_DENSITY_STORAGE_KEY = "vehiculosdeocasion_home_card_density";
const EDITOR_PAGE_SIZE = 20;
const EDITOR_PATENT_PAGE_SIZE = 100;
/** Este sitio no opera remates; solo venta directa y secciones del home. */
const AUCTION_ADMIN_ENABLED = false;

function AdminIconBtn({
  label,
  onClick,
  disabled,
  tone = "neutral",
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "neutral" | "success" | "warn" | "danger" | "active";
  children: ReactNode;
}) {
  const toneClass =
    tone === "success"
      ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
      : tone === "warn"
        ? "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
        : tone === "danger"
          ? "border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100"
          : tone === "active"
            ? "border-slate-900 bg-slate-900 text-white hover:bg-slate-800"
            : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`ui-focus inline-flex h-8 w-8 items-center justify-center rounded-md border transition disabled:cursor-not-allowed disabled:opacity-40 ${toneClass}`}
    >
      {children}
    </button>
  );
}

type AdminTabId = "vehiculos" | "categorias" | "layout" | "analytics" | "ofertas";
type InventorySubtabId = "actual" | "vendidas";
type EditorGroupFilter = "all" | "home" | "unassigned" | SectionId | `managed:${string}`;
type EditorVisibilityFilter = "all" | "visible" | "hidden";
type EditorVehicleCategoryFilter = "all" | "livianos" | "pesados" | "maquinaria" | "chatarra" | "otros";
type BatchAssignTarget =
  | { type: "section"; sectionId: SectionId }
  | { type: "auction"; auctionId: string };
type SortOption = "recomendado" | "relevancia" | "fecha-remate" | "precio-asc" | "precio-desc" | "titulo";
type QuickFilterId =
  | "livianos"
  | "pesados"
  | "con3d"
  | "conPrecio"
  | "recientes"
  | "manuales"
  | "proximoRemate"
  | "categoriaOtros";
type CardDensity = "compact" | "detailed";
type DetailEditorTabId = "general" | "tecnica";
type OfferFormState = {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  offerAmount: string;
};
type OfferFilterField = "all" | "vehicleTitle" | "patent" | "customerName" | "customerEmail" | "customerPhone";
type SoldFilterField = "all" | "patent" | "title" | "soldCategory" | "auctionName";
type AnalyticsChartType = "bar" | "line" | "area";
type AnalyticsTimelineMetric = "eventos" | "visitas" | "detalle" | "whatsapp" | "leads";
type VehicleDetailTabId = "general" | "descripcion" | "tecnica" | "fotos";
type VehicleDetailTabDef = {
  id: VehicleDetailTabId;
  label: string;
  shortLabel: string;
};

const FIELD_DISPLAY_LABELS: Record<string, string> = {
  "Patente verificador": "Verificador",
  "N° de chasis": "Chasis",
  "Tipo de vehiculo": "Tipo",
  Kilometraje: "Km",
  "N° de siniestro": "Siniestro",
  "N° de motor": "N° motor",
  "N° de serie": "N° serie",
  "Ubicacion fisica": "Ubicacion",
  "Unico propietario": "Unico dueño",
  "Aire acondicionado": "A/C",
  "Prueba de motor (arranca)": "Motor",
  "Prueba de desplazamiento (se mueve)": "Desplazamiento",
  "Estado de airbags": "Airbags",
  "Nombre propietario anterior": "Prop. anterior",
  "Vencimiento revision tecnica": "Rev. tecnica",
  "Vencimiento permiso circulacion": "Permiso circ.",
  "Vencimiento seguro obligatorio": "Seguro oblig.",
  "Descripcion ampliada": "Descripcion",
  "Precio referencial": "Precio ref.",
};

const FULL_WIDTH_DETAIL_FIELDS = new Set([
  "VIN",
  "N° de chasis",
  "N° de motor",
  "N° de serie",
  "Nombre propietario anterior",
]);

const MONO_DETAIL_FIELDS = new Set(["VIN", "N° de chasis", "N° de motor", "N° de serie"]);

function getFieldDisplayLabel(label: string): string {
  return FIELD_DISPLAY_LABELS[label] ?? label;
}

function isFullWidthDetailField(label: string): boolean {
  return FULL_WIDTH_DETAIL_FIELDS.has(label);
}

function isMonoDetailField(label: string): boolean {
  return MONO_DETAIL_FIELDS.has(label);
}

type CalendarPdfRow = {
  vehiclePrimary: string;
  vehicleSecondary: string;
  patent: string;
  model: string;
  priceLabel: string;
  thumbnailUrls: string[];
};
type CalendarPdfSection = {
  categoryTitle: string;
  categorySubtitle: string;
  rows: CalendarPdfRow[];
};
type SystemNotice = {
  id: number;
  tone: "success" | "error" | "info";
  title: string;
  message: string;
};

function EditorAddVehicleMenu({
  onAddNew,
  onAddFromStock,
  onAddBulk,
  compact = false,
  className = "",
  menuLabel = "Agregar unidad",
}: {
  onAddNew: () => void;
  onAddFromStock: () => void;
  onAddBulk?: () => void;
  compact?: boolean;
  className?: string;
  menuLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: Event) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={
          compact
            ? "ui-focus inline-flex h-8 w-8 items-center justify-center rounded border border-emerald-300 bg-emerald-50 text-lg font-bold leading-none text-emerald-700 transition hover:bg-emerald-100"
            : "ui-focus inline-flex h-full min-h-10 items-center justify-center rounded-md border border-amber-300 bg-amber-700 px-3 text-white transition hover:bg-amber-600"
        }
        aria-label={menuLabel}
        aria-expanded={open}
        title={menuLabel}
      >
        {compact ? (
          "+"
        ) : (
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/15 text-sm font-bold">
            +
          </span>
        )}
      </button>
      {open ? (
        <div className="absolute right-0 top-[calc(100%+0.35rem)] z-[80] min-w-[15rem] overflow-hidden rounded-lg border border-amber-200 bg-white py-1 shadow-xl">
          <button
            type="button"
            className="ui-focus block w-full px-3 py-2 text-left text-sm text-slate-800 transition hover:bg-amber-50"
            onClick={() => {
              setOpen(false);
              onAddNew();
            }}
          >
            Agregar auto nuevo
          </button>
          <button
            type="button"
            className="ui-focus block w-full px-3 py-2 text-left text-sm text-slate-800 transition hover:bg-amber-50"
            onClick={() => {
              setOpen(false);
              onAddFromStock();
            }}
          >
            Agregar auto desde stock
          </button>
          {onAddBulk ? (
            <button
              type="button"
              className="ui-focus block w-full px-3 py-2 text-left text-sm text-slate-800 transition hover:bg-amber-50"
              onClick={() => {
                setOpen(false);
                onAddBulk();
              }}
            >
              Alta masiva por patente (nuevos)
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

type AnalyticsEventPayload = Record<string, unknown> & {
  event?: string;
  timestamp?: string;
  itemKey?: string;
  section?: string;
  sessionId?: string;
  visitorId?: string;
};
type AnalyticsTimelineRow = {
  date: string;
  total: number;
  visits: number;
  detailOpens: number;
  whatsappClicks: number;
  leads: number;
};

const QUICK_FILTER_LABELS: Record<QuickFilterId, string> = {
  livianos: "Livianos",
  pesados: "Pesados",
  con3d: "Con 3D",
  conPrecio: "Con precio",
  recientes: "Recientes",
  manuales: "Manuales",
  proximoRemate: "Destacados",
  categoriaOtros: "Categoria: Otros",
};

const HOME_SORT_OPTIONS: Array<[SortOption, string]> = [
  ["recomendado", "Recomendado"],
  ["relevancia", "Relevancia"],
  ["fecha-remate", "Fecha publicacion"],
  ["precio-asc", "Precio menor"],
  ["precio-desc", "Precio mayor"],
  ["titulo", "Titulo A-Z"],
];

const VEHICLE_CONDITION_OPTIONS = [
  "Vehiculo 100% operativo",
  "No arranca",
  "Con problemas",
  "Desarme",
  "Recuperado por robo sin registrar en la Cia de seguros",
] as const;
const VEHICLE_CATEGORY_OPTIONS = [
  { value: "vehiculo_liviano", label: "Vehiculo liviano" },
  { value: "vehiculo_pesado", label: "Vehiculo pesado" },
  { value: "maquinaria", label: "Maquinaria" },
  { value: "chatarra", label: "Chatarra" },
  { value: "otros", label: "Otros" },
] as const;

const WHATSAPP_CTA_URL = WHATSAPP_DEFAULT_LINK;
const WHATSAPP_PHONE = CONTACT_WHATSAPP_DIGITS;
const CONTACT_EMAIL = COMMERCIAL_EMAIL;
const MAX_COMPARE_ITEMS = 4;
const ANALYTICS_STORAGE_KEY = "vehiculosdeocasion_analytics_events";
const ANALYTICS_VISITOR_ID_KEY = "vehiculosdeocasion_analytics_visitor_id";
const ANALYTICS_SESSION_ID_KEY = "vehiculosdeocasion_analytics_session_id";
const ANALYTICS_SESSION_PAGEVIEW_KEY = "vehiculosdeocasion_analytics_pageview_home";
const OBSERVATIONS_TEMPLATE_STORAGE_KEY = "vehiculosdeocasion_observations_template_html";
const DEFAULT_OBSERVATIONS_TEMPLATE_HTML = `<h3><strong>¿Te interesa esta unidad?</strong></h3>
<p>En Vehiculos de Ocasion te acompanamos durante todo el proceso de compra.</p>
<ul>
  <li>Solicita detalles y apoyo comercial por WhatsApp al <a href="${WHATSAPP_WA_ME_BASE}" target="_blank" rel="noreferrer" style="color:#7c4a25"><strong>${CONTACT_PHONE}</strong></a>.</li>
  <li>Revisa fotos, ficha tecnica y visor 3D cuando este disponible.</li>
  <li>Coordinamos reserva, documentacion y cierre comercial de forma simple y segura.</li>
</ul>`;

const SECTION_LABELS: Record<SectionId, string> = {
  "proximos-remates": "Destacados",
  "ventas-directas": "Ventas directas",
  novedades: "Novedades",
  catalogo: "Catalogo",
};
const BASE_HOME_SECTION_ORDER: SectionId[] = [
  "proximos-remates",
  "ventas-directas",
  "novedades",
  "catalogo",
];
const sectionCategoryKey = (sectionId: SectionId) => `section:${sectionId}` as const;
const auctionCategoryKey = (auctionId: string) => `auction:${auctionId}`;
const managedCategoryKey = (categoryId: string) => `managed:${categoryId}`;

function normalizeEditorConfigClient(
  value?: Partial<EditorConfig> | null,
): EditorConfig {
  const defaults = DEFAULT_EDITOR_CONFIG;
  const legacyHeroTitles = new Set([
    "Inventario de vehiculos para remate y venta directa",
    "Inventario de vehiculos",
    "Inventario de vehiculos",
  ]);
  const legacyHeroKickers = new Set([
    "Catalogo oficial de Vedisa Remates",
    "Catálogo oficial de Vedisa Remates",
  ]);
  const legacySecondaryCtas = new Set([
    "Explorar secciones",
    "Como participar en el remate",
    "Cómo participar en el remate",
  ]);
  const requestedHeroTitle = "Encuentra tu proximo vehiculo en Vehiculos de Ocasion";
  const requestedHeroDescription =
    "Somos la automotora de vehiculos seminuevos de la empresa VEDISA REMATES.";
  const legacyHeroDescriptions = new Set([
    "Plataforma oficial de ofertas online en vedisaremates.cl. Revisa cada unidad con informacion clara, fotos y trazabilidad comercial para tomar decisiones con confianza.",
    "Vehiculos de Ocasion es una empresa especializada en la comercializacion de vehiculos a precios competitivos, por debajo del promedio del mercado.",
    "Vehículos de Ocasión es una empresa especializada en la comercialización de vehículos a precios competitivos, por debajo del promedio del mercado.",
    "Vehiculos de Ocasion es la automotora de vehiculos seminuevos de la empresa VEDISA REMATES especializada en la comercializacion de todo tipo de vehiculos a precios competitivos y por debajo del promedio del mercado.",
    "Vehículos de Ocasión es la automotora de vehículos seminuevos de la empresa VEDISA REMATES especializada en la comercializacion de todo tipo de vehículos a precios competitivos y por debajo del promedio del mercado.",
  ]);
  const requestedHeroKicker = "Automotora y compraventa";
  const requestedPrimaryCta = "Ver catalogo disponible";
  const requestedSecondaryCta = "Contactar por WhatsApp";
  const requestedSecondaryHref = "/contacto";
  const incomingHeroTitle = value?.homeLayout?.heroTitle;
  const normalizedHeroTitle =
    !incomingHeroTitle ||
    legacyHeroTitles.has(incomingHeroTitle.trim())
      ? requestedHeroTitle
      : incomingHeroTitle;
  const incomingHeroDescription = value?.homeLayout?.heroDescription?.trim();
  const normalizedHeroDescription =
    !incomingHeroDescription || legacyHeroDescriptions.has(incomingHeroDescription)
      ? requestedHeroDescription
      : value?.homeLayout?.heroDescription ?? defaults.homeLayout.heroDescription;
  const incomingHeroKicker = value?.homeLayout?.heroKicker?.trim();
  const normalizedHeroKicker =
    !incomingHeroKicker ||
    legacyHeroKickers.has(incomingHeroKicker)
      ? requestedHeroKicker
      : value?.homeLayout?.heroKicker ?? defaults.homeLayout.heroKicker;
  const incomingPrimaryCta = value?.homeLayout?.heroPrimaryCtaLabel?.trim();
  const normalizedPrimaryCta =
    !incomingPrimaryCta || incomingPrimaryCta === "Ver catalogo completo"
      ? requestedPrimaryCta
      : value?.homeLayout?.heroPrimaryCtaLabel ?? defaults.homeLayout.heroPrimaryCtaLabel;
  const incomingSecondaryCta = value?.homeLayout?.heroSecondaryCtaLabel?.trim();
  const normalizedSecondaryCta =
    !incomingSecondaryCta ||
    legacySecondaryCtas.has(incomingSecondaryCta)
      ? requestedSecondaryCta
      : value?.homeLayout?.heroSecondaryCtaLabel ?? defaults.homeLayout.heroSecondaryCtaLabel;
  const incomingSecondaryHref = value?.homeLayout?.heroSecondaryCtaHref?.trim();
  const normalizedSecondaryHref =
    !incomingSecondaryHref ||
    incomingSecondaryHref === "#proximos-remates" ||
    incomingSecondaryHref === "#como-participar" ||
    incomingSecondaryHref === "#contacto"
      ? requestedSecondaryHref
      : value?.homeLayout?.heroSecondaryCtaHref ?? defaults.homeLayout.heroSecondaryCtaHref;
  return {
    sectionVehicleIds: {
      "proximos-remates":
        value?.sectionVehicleIds?.["proximos-remates"] ??
        defaults.sectionVehicleIds["proximos-remates"],
      "ventas-directas":
        value?.sectionVehicleIds?.["ventas-directas"] ??
        defaults.sectionVehicleIds["ventas-directas"],
      novedades:
        value?.sectionVehicleIds?.novedades ?? defaults.sectionVehicleIds.novedades,
      catalogo: value?.sectionVehicleIds?.catalogo ?? defaults.sectionVehicleIds.catalogo,
    },
    hiddenVehicleIds: value?.hiddenVehicleIds ?? defaults.hiddenVehicleIds,
    hiddenCategoryIds: value?.hiddenCategoryIds ?? defaults.hiddenCategoryIds,
    soldVehicleIds: value?.soldVehicleIds ?? defaults.soldVehicleIds,
    soldVehicleHistory: value?.soldVehicleHistory ?? defaults.soldVehicleHistory,
    vehiclePrices: value?.vehiclePrices ?? defaults.vehiclePrices,
    vehicleDetails: value?.vehicleDetails ?? defaults.vehicleDetails,
    upcomingAuctions: value?.upcomingAuctions ?? defaults.upcomingAuctions,
    vehicleUpcomingAuctionIds:
      value?.vehicleUpcomingAuctionIds ?? defaults.vehicleUpcomingAuctionIds,
    sectionTexts: {
      "proximos-remates":
        value?.sectionTexts?.["proximos-remates"] ??
        defaults.sectionTexts["proximos-remates"],
      "ventas-directas":
        value?.sectionTexts?.["ventas-directas"] ??
        defaults.sectionTexts["ventas-directas"],
      novedades: value?.sectionTexts?.novedades ?? defaults.sectionTexts.novedades,
      catalogo: value?.sectionTexts?.catalogo ?? defaults.sectionTexts.catalogo,
    },
    homeLayout: {
      heroKicker: normalizedHeroKicker,
      heroTitle: normalizedHeroTitle,
      heroDescription: normalizedHeroDescription,
      heroPrimaryCtaLabel: normalizedPrimaryCta,
      heroPrimaryCtaHref:
        value?.homeLayout?.heroPrimaryCtaHref ?? defaults.homeLayout.heroPrimaryCtaHref,
      heroSecondaryCtaLabel: normalizedSecondaryCta,
      heroSecondaryCtaHref: normalizedSecondaryHref,
      heroAlignment: value?.homeLayout?.heroAlignment ?? defaults.homeLayout.heroAlignment,
      heroTheme: value?.homeLayout?.heroTheme ?? defaults.homeLayout.heroTheme,
      heroMaxWidth: value?.homeLayout?.heroMaxWidth ?? defaults.homeLayout.heroMaxWidth,
      showHeroChips: value?.homeLayout?.showHeroChips ?? defaults.homeLayout.showHeroChips,
      showHeroCtas: value?.homeLayout?.showHeroCtas ?? defaults.homeLayout.showHeroCtas,
      showFeaturedStrip:
        value?.homeLayout?.showFeaturedStrip ?? defaults.homeLayout.showFeaturedStrip,
      showRecentPublications:
        value?.homeLayout?.showRecentPublications ??
        defaults.homeLayout.showRecentPublications,
      showFavoritesSection:
        value?.homeLayout?.showFavoritesSection ??
        defaults.homeLayout.showFavoritesSection,
      showHowToSection:
        false,
      showSearchBar: value?.homeLayout?.showSearchBar ?? defaults.homeLayout.showSearchBar,
      showQuickFilters:
        value?.homeLayout?.showQuickFilters ?? defaults.homeLayout.showQuickFilters,
      showSortSelector:
        value?.homeLayout?.showSortSelector ?? defaults.homeLayout.showSortSelector,
      showStickySearchBar:
        value?.homeLayout?.showStickySearchBar ?? defaults.homeLayout.showStickySearchBar,
      showCommercialPanel:
        value?.homeLayout?.showCommercialPanel ?? defaults.homeLayout.showCommercialPanel,
      defaultCardDensity:
        value?.homeLayout?.defaultCardDensity ?? defaults.homeLayout.defaultCardDensity,
      sectionSpacing: value?.homeLayout?.sectionSpacing ?? defaults.homeLayout.sectionSpacing,
      sectionOrder: value?.homeLayout?.sectionOrder ?? defaults.homeLayout.sectionOrder,
    },
    manualPublications: value?.manualPublications ?? defaults.manualPublications,
    managedCategories: value?.managedCategories ?? defaults.managedCategories,
  };
}

function normalizeText(value?: string): string {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function toCsvCell(value: unknown): string {
  const text = String(value ?? "").replace(/"/g, "\"\"");
  return `"${text}"`;
}

function isSubsequenceMatch(source: string, query: string): boolean {
  if (!query) return true;
  let qi = 0;
  for (let i = 0; i < source.length && qi < query.length; i += 1) {
    if (source[i] === query[qi]) qi += 1;
  }
  return qi === query.length;
}

function fuzzyMatches(source: string, query: string): boolean {
  if (!query) return true;
  if (source.includes(query)) return true;
  const sourceTokens = source.split(/\s+/).filter(Boolean);
  const queryTokens = query.split(/\s+/).filter(Boolean);
  if (queryTokens.length === 0) return true;
  return queryTokens.every((token) =>
    sourceTokens.some(
      (sourceToken) =>
        sourceToken.startsWith(token) ||
        isSubsequenceMatch(sourceToken, token),
    ),
  );
}

function normalizeLookupKey(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]/g, "");
}

function buildVehicleLookup(
  source: unknown,
  lookup: Map<string, unknown> = new Map(),
  path = "",
): Map<string, unknown> {
  if (!source || typeof source !== "object") return lookup;

  for (const [key, value] of Object.entries(source as Record<string, unknown>)) {
    const currentPath = path ? `${path}.${key}` : key;
    const normalizedPath = normalizeLookupKey(currentPath);
    const normalizedLeaf = normalizeLookupKey(key);

    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      buildVehicleLookup(value, lookup, currentPath);
      continue;
    }

    if (!lookup.has(normalizedPath)) lookup.set(normalizedPath, value);
    if (!lookup.has(normalizedLeaf)) lookup.set(normalizedLeaf, value);
  }

  return lookup;
}

function getLookupValue(
  lookup: Map<string, unknown>,
  aliases: string[],
): unknown {
  for (const alias of aliases) {
    const value = lookup.get(normalizeLookupKey(alias));
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return undefined;
}

function hasValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("No se pudo convertir el logo a DataURL."));
    };
    reader.onerror = () => reject(reader.error ?? new Error("Error leyendo imagen."));
    reader.readAsDataURL(blob);
  });
}

function getImageDimensionsFromDataUrl(dataUrl: string): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const img = document.createElement("img");
    img.onload = () => {
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
        return;
      }
      resolve(null);
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

function fitDimensionsByAspect(
  aspectRatio: number,
  maxWidth: number,
  maxHeight: number,
): { width: number; height: number } {
  let width = maxWidth;
  let height = width / aspectRatio;
  if (height > maxHeight) {
    height = maxHeight;
    width = height * aspectRatio;
  }
  return { width, height };
}

async function loadLogoForPdfAsDataUrl(): Promise<string | null> {
  const candidates = ["/vehiculos-ocasion-logo.png", "https://vehiculosdeocasion.vercel.app/vehiculos-ocasion-logo.png"];
  for (const url of candidates) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) continue;
      const blob = await response.blob();
      return await blobToDataUrl(blob);
    } catch {
      // intenta la siguiente URL sin interrumpir la descarga del PDF
    }
  }
  return null;
}

function isBaseHomeSectionOrderId(value: string): value is SectionId {
  return (BASE_HOME_SECTION_ORDER as string[]).includes(value);
}

function getVehicleKey(item: CatalogItem): string {
  const raw = item.raw as Record<string, unknown>;
  const patent = [raw.patente, raw.PATENTE, raw.PPU, raw.stock_number]
    .find((value) => typeof value === "string" && value.trim().length > 0) as string | undefined;
  if (patent) return patent.toUpperCase().replace(/\s+/g, "").replace(/-/g, "");
  return item.id;
}

function resolvePatenteFromRaw(raw: Record<string, unknown>): string {
  const patent = [raw.patente, raw.PATENTE, raw.PPU, raw.stock_number]
    .find((value) => typeof value === "string" && value.trim().length > 0) as string | undefined;
  return patent?.toUpperCase().replace(/\s+/g, "").replace(/-/g, "") ?? "";
}

function getPatent(item: CatalogItem): string {
  const patent = resolvePatenteFromRaw(item.raw as Record<string, unknown>);
  return patent || "-";
}

function getModel(item: CatalogItem): string {
  const raw = item.raw as Record<string, unknown>;
  const model = [raw.modelo, raw.model, item.title]
    .find((value) => typeof value === "string" && value.trim().length > 0) as string | undefined;
  return model?.trim() ?? item.title;
}

function getVehicleDisplayTitle(item: CatalogItem): string {
  const raw = item.raw as Record<string, unknown>;
  const fromParts = buildVehicleTitleFromParts({
    brand: String(raw.marca ?? raw.brand ?? "").trim() || undefined,
    model: String(raw.modelo ?? raw.model ?? "").trim() || undefined,
    year: String(raw.ano ?? raw.anio ?? raw.year ?? "").trim() || undefined,
    version: String(raw.version ?? raw.ver ?? raw.trim ?? "").trim() || undefined,
  });
  if (fromParts) return fromParts;
  return item.title?.trim() || getModel(item) || "Vehiculo sin titulo";
}

function normalizePdfImageUrl(value?: string | null): string | null {
  if (!value || typeof value !== "string") return null;
  let url = value.trim();
  if (!url) return null;
  if (url.startsWith("//")) url = `https:${url}`;
  if (url.startsWith("/")) url = `https://glo3d.net${url}`;
  if (!url.startsWith("http")) return null;
  return url.replace(/\$.*$/, "");
}

function isLikelyPdfImageUrl(url: string): boolean {
  const normalized = url.toLowerCase();
  if (normalized.includes("glo3d.net/iframe") || normalized.includes("<iframe")) return false;
  if (/\.(jpg|jpeg|png|webp|gif|bmp|avif)(\?|$)/i.test(normalized)) return true;
  return /cdn\.|cloudfront|amazonaws|supabase|cloudinary|img|image|media|glo3d|foto|photo|thumb/i.test(
    normalized,
  );
}

function collectVehicleImageCandidates(item: CatalogItem): string[] {
  const raw = item.raw as Record<string, unknown>;
  const lookup = buildVehicleLookup(raw);
  const glo3dRaw = raw.glo3d as Record<string, unknown> | undefined;
  const glo3dLookup = glo3dRaw ? buildVehicleLookup(glo3dRaw) : null;
  const staticCandidates = [
    item.thumbnail,
    ...item.images,
    getLookupValue(lookup, [
      "thumbnail",
      "thumb",
      "thumbnail_url",
      "image",
      "image_url",
      "foto",
      "imagen_principal",
      "foto_portada",
    ]),
    getLookupValue(lookup, ["src_with_params", "src"]),
    glo3dLookup
      ? getLookupValue(glo3dLookup, [
          "thumbnail",
          "thumb",
          "thumbnail_url",
          "image",
          "image_url",
          "src_with_params",
          "src",
        ])
      : null,
    typeof raw.thumbnail === "string" ? raw.thumbnail : null,
    typeof raw.thumb === "string" ? raw.thumb : null,
    typeof raw.image_url === "string" ? raw.image_url : null,
    typeof raw.foto === "string" ? raw.foto : null,
  ];

  const seen = new Set<string>();
  const result: string[] = [];
  for (const candidate of staticCandidates) {
    if (typeof candidate !== "string") continue;
    const normalized = normalizePdfImageUrl(candidate);
    if (!normalized || seen.has(normalized)) continue;
    if (!isLikelyPdfImageUrl(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result.slice(0, PDF_THUMBNAIL_CANDIDATES_PER_VEHICLE);
}

function getPdfVehicleDisplay(item: CatalogItem): { primary: string; secondary: string } {
  const subtitle = item.subtitle?.trim();
  const rawTitle = item.title?.trim() || "Vehiculo sin titulo";
  const cleaned = rawTitle.replace(/^vedisa\s+remates\s*-\s*/i, "").trim();
  const commaParts = cleaned.split(",").map((part) => part.trim()).filter(Boolean);

  if (commaParts.length >= 2) {
    return {
      primary: commaParts[0] ?? rawTitle,
      secondary: commaParts.slice(1).join(", "),
    };
  }

  const raw = item.raw as Record<string, unknown>;
  const lookup = buildVehicleLookup(raw);
  const brand = String(
    getLookupValue(lookup, ["marca", "brand", "make", "glo3d.make"]) ?? raw.marca ?? raw.brand ?? "",
  ).trim();
  const model = String(
    getLookupValue(lookup, ["modelo", "model", "model2", "glo3d.model2"]) ?? raw.modelo ?? raw.model ?? "",
  ).trim();
  const year = String(
    getLookupValue(lookup, ["ano", "anio", "year", "glo3d.year"]) ?? raw.ano ?? raw.anio ?? raw.year ?? "",
  ).trim();
  const composed = [brand, model].filter(Boolean).join(" ");
  const primary = composed
    ? `${composed}${year ? ` · ${year}` : ""}`.trim()
    : cleaned;

  return {
    primary,
    secondary: subtitle && normalizeText(subtitle) !== normalizeText(primary) ? subtitle : "",
  };
}

type PdfImageAsset = {
  dataUrl: string;
  format: "PNG" | "JPEG";
  aspectRatio: number;
};

const MAX_PDF_IMAGE_EDGE = 160;
const PDF_IMAGE_LOAD_CONCURRENCY = 6;
const PDF_IMAGE_FETCH_TIMEOUT_MS = 7_000;
const PDF_THUMBNAIL_CANDIDATES_PER_VEHICLE = 1;

type JsPdfDocument = {
  output(type: "blob"): Blob;
  save(filename: string): void;
};

function isIosPdfDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /iPad|iPhone|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

async function downloadPdfDocument(doc: JsPdfDocument, fileName: string): Promise<"download" | "opened"> {
  const blob = doc.output("blob");
  const blobUrl = URL.createObjectURL(blob);

  if (isIosPdfDevice()) {
    const opened = window.open(blobUrl, "_blank");
    if (!opened) {
      window.location.assign(blobUrl);
    }
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    return "opened";
  }

  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = fileName;
  link.rel = "noopener";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000);
  return "download";
}

async function mapWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  if (items.length === 0) return;
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      await worker(items[index] as T);
    }
  });
  await Promise.all(runners);
}

async function convertImageDataUrlToJpegAsset(
  dataUrl: string,
  maxEdge = MAX_PDF_IMAGE_EDGE,
): Promise<PdfImageAsset | null> {
  return new Promise((resolve) => {
    const img = document.createElement("img");
    img.onload = () => {
      if (img.naturalWidth <= 0 || img.naturalHeight <= 0) {
        resolve(null);
        return;
      }
      const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
      const width = Math.max(1, Math.round(img.naturalWidth * scale));
      const height = Math.max(1, Math.round(img.naturalHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(null);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      try {
        resolve({
          dataUrl: canvas.toDataURL("image/jpeg", 0.82),
          format: "JPEG",
          aspectRatio: width / height,
        });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

async function normalizePdfImageAsset(
  dataUrl: string,
  format: "PNG" | "JPEG",
  aspectRatio: number,
): Promise<PdfImageAsset | null> {
  const dimensions = await getImageDimensionsFromDataUrl(dataUrl);
  if (!dimensions || dimensions.width <= 0 || dimensions.height <= 0) return null;
  const maxEdge = Math.max(dimensions.width, dimensions.height);
  if (format === "JPEG" && maxEdge <= MAX_PDF_IMAGE_EDGE) {
    return { dataUrl, format, aspectRatio };
  }
  return convertImageDataUrlToJpegAsset(dataUrl);
}

async function buildPdfImageAsset(dataUrl: string, contentType = ""): Promise<PdfImageAsset | null> {
  const dimensions = await getImageDimensionsFromDataUrl(dataUrl);
  if (!dimensions || dimensions.width <= 0 || dimensions.height <= 0) return null;

  const mime = contentType.toLowerCase();
  const isJpeg = mime.includes("jpeg") || mime.includes("jpg") || dataUrl.startsWith("data:image/jp");
  const isPng = mime.includes("png") || dataUrl.startsWith("data:image/png");
  if (isJpeg) {
    return normalizePdfImageAsset(dataUrl, "JPEG", dimensions.width / dimensions.height);
  }
  if (isPng) {
    return normalizePdfImageAsset(dataUrl, "PNG", dimensions.width / dimensions.height);
  }
  return convertImageDataUrlToJpegAsset(dataUrl);
}

async function fetchWithPdfTimeout(input: RequestInfo, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), PDF_IMAGE_FETCH_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function fetchPdfImageDirect(url: string): Promise<PdfImageAsset | null> {
  try {
    const response = await fetchWithPdfTimeout(url, { cache: "no-store", mode: "cors" });
    if (!response.ok) return null;
    const blob = await response.blob();
    const dataUrl = await blobToDataUrl(blob);
    return buildPdfImageAsset(dataUrl, blob.type);
  } catch {
    return null;
  }
}

async function fetchPdfImageViaProxy(url: string): Promise<PdfImageAsset | null> {
  try {
    const response = await fetchWithPdfTimeout(`/api/pdf-image?url=${encodeURIComponent(url)}`, {
      cache: "no-store",
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as { dataUrl?: string; contentType?: string };
    if (!payload.dataUrl) return null;
    return buildPdfImageAsset(payload.dataUrl, payload.contentType ?? "");
  } catch {
    return null;
  }
}

async function loadImageForPdfAsDataUrl(url: string): Promise<PdfImageAsset | null> {
  const normalizedUrl = normalizePdfImageUrl(url);
  if (!normalizedUrl) return null;
  const proxyAsset = await fetchPdfImageViaProxy(normalizedUrl);
  if (proxyAsset) return proxyAsset;
  return fetchPdfImageDirect(normalizedUrl);
}

function inferVehicleType(item: CatalogItem): VehicleTypeId {
  const raw = item.raw as Record<string, unknown>;
  const lookup = buildVehicleLookup(raw);
  const normalizedCategory = normalizeVehicleCategoryValue(
    String(
      getLookupValue(lookup, [
        "categoria",
        "category",
        "tipo_vehiculo",
        "tipo",
        "vehicle_type",
        "aws.categoria",
        "aws.tipo_vehiculo",
        "aws_campos.categoria",
      ]) ?? "",
    ),
  );
  if (normalizedCategory === "vehiculo_liviano") return "livianos";
  if (normalizedCategory === "vehiculo_pesado") return "pesados";
  if (normalizedCategory === "maquinaria") return "maquinaria";

  const sample = normalizeText(
    [item.title, item.subtitle, raw.categoria, raw.tipo_vehiculo, raw.description]
      .filter(Boolean)
      .join(" "),
  );

  if (/(retro|excav|motoniv|bulldo|cargador|grua horquilla|maquinaria)/.test(sample)) return "maquinaria";
  if (/(auto|suv|sedan|hatch|pickup|camioneta|station)/.test(sample)) return "livianos";
  if (/\b(camion(?!eta)|bus|tracto|tolva|pesad|semi|rampla|grua)\b/.test(sample)) return "pesados";
  return "otros";
}

function inferVehicleCategoryForAdmin(item: CatalogItem): EditorVehicleCategoryFilter {
  const raw = item.raw as Record<string, unknown>;
  const lookup = buildVehicleLookup(raw);
  const normalizedCategory = normalizeVehicleCategoryValue(
    String(
      getLookupValue(lookup, [
        "categoria",
        "category",
        "tipo_vehiculo",
        "tipo",
        "vehicle_type",
        "aws.categoria",
        "aws.tipo_vehiculo",
        "aws_campos.categoria",
      ]) ?? "",
    ),
  );

  if (normalizedCategory === "vehiculo_liviano") return "livianos";
  if (normalizedCategory === "vehiculo_pesado") return "pesados";
  if (normalizedCategory === "maquinaria") return "maquinaria";
  if (normalizedCategory === "chatarra") return "chatarra";
  if (normalizedCategory === "otros") return "otros";

  const sample = normalizeText(
    [item.title, item.subtitle, raw.categoria, raw.tipo_vehiculo, raw.description]
      .filter(Boolean)
      .join(" "),
  );
  if (/chatarra|scrap/.test(sample)) return "chatarra";
  return inferVehicleType(item);
}

function formatPrice(value?: string): string | null {
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

function isPromoEnabledValue(value: unknown): boolean {
  return value === true || value === 1 || value === "1" || value === "true";
}

function pickFirstTextValue(values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function getRawPromoMeta(raw: Record<string, unknown>): {
  promoEnabled: boolean;
  originalPriceLabel: string | null;
  promoPriceLabel: string | null;
} {
  const promoEnabled = isPromoEnabledValue(raw.promo_enabled);
  const originalPriceLabel = pickFirstTextValue([raw.precio_normal, raw.original_price]);
  const promoPriceLabel = pickFirstTextValue([raw.precio_promocional, raw.promo_price]);
  return { promoEnabled, originalPriceLabel, promoPriceLabel };
}

function getRawExpenseMeta(raw: Record<string, unknown>): {
  taxFeeLabel: string | null;
  transferFeeLabel: string | null;
} {
  const taxFeeLabel = pickFirstTextValue([
    raw.gasto_impuesto,
    raw.gastos_impuesto,
    raw.impuesto,
    raw.impuestos,
    raw.tax_fee,
    raw.tax_cost,
  ]);
  const transferFeeLabel = pickFirstTextValue([
    raw.gasto_transferencia,
    raw.gastos_transferencia,
    raw.transferencia,
    raw.transfer_fee,
    raw.transfer_cost,
  ]);
  return { taxFeeLabel, transferFeeLabel };
}

function getConditionBadgeClasses(condition?: string | null): string {
  const sample = normalizeText(condition ?? "");
  if (!sample) return "border-amber-200 bg-[#f6ebe1] text-[#6f4a2e]";
  if (/100% operativo|operativo/.test(sample)) {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }
  if (/no arranca|desarme/.test(sample)) {
    return "border-rose-200 bg-rose-50 text-rose-800";
  }
  if (/problema|recuperado|robo/.test(sample)) {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }
  return "border-amber-300 bg-[#f4e2d2] text-[#6d3f1f]";
}

function normalizeVehicleCategoryValue(value?: string): string {
  const sample = normalizeText(value ?? "");
  if (!sample) return "";
  if (/livian|vehiculoliviano/.test(sample)) return "vehiculo_liviano";
  if (/pesad|vehiculopesado/.test(sample)) return "vehiculo_pesado";
  if (/maquinaria|maquina/.test(sample)) return "maquinaria";
  if (/chatarra|scrap/.test(sample)) return "chatarra";
  if (/otros|other/.test(sample)) return "otros";
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, "_");
}

function getVehicleCategoryLabel(value?: string): string {
  const normalized = normalizeVehicleCategoryValue(value);
  const known = VEHICLE_CATEGORY_OPTIONS.find((option) => option.value === normalized);
  if (known) return known.label;
  if (!value) return "-";
  return value.replace(/_/g, " ");
}

function formatAuctionDateLabel(value?: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatDateDash(value: Date): string {
  const dd = String(value.getDate()).padStart(2, "0");
  const mm = String(value.getMonth() + 1).padStart(2, "0");
  const yyyy = value.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

function getTimeZoneOffsetMinutes(timeZone: string, date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
    hour: "2-digit",
  }).formatToParts(date);
  const zonePart = parts.find((part) => part.type === "timeZoneName")?.value ?? "GMT+0";
  const match = zonePart.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/i);
  if (!match) return 0;
  const sign = match[1] === "-" ? -1 : 1;
  const hours = Number(match[2] ?? "0");
  const minutes = Number(match[3] ?? "0");
  return sign * (hours * 60 + minutes);
}

function buildDateInTimeZone(
  year: number,
  month: number,
  day: number,
  hours: number,
  minutes: number,
  timeZone: string,
): Date {
  let utcMs = Date.UTC(year, month - 1, day, hours, minutes, 0, 0);
  for (let i = 0; i < 2; i += 1) {
    const offsetMinutes = getTimeZoneOffsetMinutes(timeZone, new Date(utcMs));
    utcMs = Date.UTC(year, month - 1, day, hours, minutes, 0, 0) - offsetMinutes * 60 * 1000;
  }
  return new Date(utcMs);
}

function parseAuctionDateTime(auction: UpcomingAuction): Date | null {
  const rawDate = (auction.date ?? "").trim();
  if (!rawDate) return null;
  const dateMatch = rawDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  let year = 0;
  let month = 0;
  let day = 0;
  if (dateMatch) {
    year = Number(dateMatch[1]);
    month = Number(dateMatch[2]);
    day = Number(dateMatch[3]);
  } else {
    const fallback = new Date(rawDate);
    if (Number.isNaN(fallback.getTime())) return null;
    year = fallback.getFullYear();
    month = fallback.getMonth() + 1;
    day = fallback.getDate();
  }
  const timeMatch = auction.name.match(/(\d{1,2}):(\d{2})/);
  let hours = 0;
  let minutes = 0;
  if (timeMatch) {
    hours = Number(timeMatch[1]);
    minutes = Number(timeMatch[2]);
  }

  return buildDateInTimeZone(year, month, day, hours, minutes, "America/Santiago");
}

function formatAuctionCountdownClock(diffMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(diffMs / 1000));
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

function formatAuctionCountdownHours(targetDate: Date | null, nowMs: number): string {
  if (!targetDate) return "Proximo remate en 0 (Cuenta regresiva) horas";
  const diffMs = targetDate.getTime() - nowMs;
  const diffHours = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60)));
  const clock = formatAuctionCountdownClock(diffMs);
  return `Proximo remate en ${diffHours} (${clock}) horas`;
}

function isRecentAuctionDate(value?: string): boolean {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  const diff = Math.abs(now.getTime() - date.getTime());
  const days = diff / (1000 * 60 * 60 * 24);
  return days <= 45;
}

function getPriceAmount(value?: string): number {
  if (!value?.trim()) return Number.POSITIVE_INFINITY;
  const clean = value.replace(/[^\d]/g, "");
  const amount = Number(clean);
  return Number.isFinite(amount) && amount > 0 ? amount : Number.POSITIVE_INFINITY;
}

function parseAnalyticsTimestamp(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getAnalyticsEventLabel(eventName: string): string {
  const labels: Record<string, string> = {
    page_view_home: "Vista al home",
    vehicle_detail_open: "Apertura de detalle de vehiculo",
    home_search_change: "Busqueda en home",
    quick_filter_toggle: "Uso de filtro rapido",
    compare_toggle: "Comparar vehiculos",
    whatsapp_click_modal_mobile: "Click WhatsApp desde modal (movil)",
    whatsapp_click_modal: "Click WhatsApp desde modal",
    whatsapp_click_card: "Click WhatsApp en tarjeta",
    whatsapp_click_floating: "Click WhatsApp en boton flotante",
    home_sort_change: "Cambio de orden en listado",
    calendar_pdf_download: "Descarga de PDF del calendario",
    login_modal_open: "Apertura de modal de login",
    offer_modal_open: "Apertura de modal de oferta",
    favorite_toggle: "Agregar/quitar favorito",
    top_filter_click: "Click en seccion superior",
    vehicle_share: "Compartir vehiculo",
    lead_form_submit: "Envio de formulario de contacto",
    card_open: "Apertura de tarjeta de vehiculo",
  };
  if (labels[eventName]) return labels[eventName];
  return eventName
    .replace(/_/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getAnalyticsSectionLabel(sectionName: string): string {
  const labels: Record<string, string> = {
    "sin-seccion": "Sin seccion",
    all: "Todas las secciones",
    "proximos-remates": "Destacados",
    "ventas-directas": "Ventas directas",
    novedades: "Novedades",
    catalogo: "Catalogo",
    favoritos: "Favoritos",
    "recien-publicados": "Recien publicados",
  };
  if (labels[sectionName]) return labels[sectionName];
  if (sectionName.startsWith("managed:")) return "Categoria personalizada";
  if (sectionName.startsWith("categoria-")) return "Categoria personalizada";
  return sectionName
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat("es-CL").format(value);
}

function formatMileageValue(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const digits = raw.replace(/[^\d]/g, "");
  const amount = Number(digits);
  if (!Number.isFinite(amount) || amount <= 0) return raw;
  return new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 }).format(Math.round(amount));
}

function parseCurrencyAmount(value?: string | null): number {
  if (!value?.trim()) return 0;
  const digits = value.replace(/[^\d]/g, "");
  const amount = Number(digits);
  return Number.isFinite(amount) ? amount : 0;
}

function formatCurrencyAmount(value: number): string {
  if (!Number.isFinite(value) || value < 0) return "";
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(Math.round(value));
}

function formatSignedCurrencyAmount(value: number): string {
  if (!Number.isFinite(value)) return "";
  const absolute = formatCurrencyAmount(Math.abs(value));
  if (!absolute) return "";
  if (value > 0) return `+${absolute}`;
  if (value < 0) return `-${absolute}`;
  return absolute;
}

function toCurrencyInput(value: string): string {
  const amount = parseCurrencyAmount(value);
  if (amount <= 0) return "";
  return formatCurrencyAmount(amount);
}

function buildEmptyOfferForm(): OfferFormState {
  return {
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    offerAmount: "",
  };
}

function isValidEmailAddress(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function getOrCreateAnalyticsIds(): { visitorId: string; sessionId: string } {
  if (typeof window === "undefined") return { visitorId: "ssr", sessionId: "ssr" };
  let visitorId = window.localStorage.getItem(ANALYTICS_VISITOR_ID_KEY) ?? "";
  if (!visitorId) {
    visitorId = crypto.randomUUID();
    window.localStorage.setItem(ANALYTICS_VISITOR_ID_KEY, visitorId);
  }
  let sessionId = window.sessionStorage.getItem(ANALYTICS_SESSION_ID_KEY) ?? "";
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    window.sessionStorage.setItem(ANALYTICS_SESSION_ID_KEY, sessionId);
  }
  return { visitorId, sessionId };
}

function trackEvent(eventName: string, payload?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  if (eventName === "page_view_home") {
    const alreadyTracked = window.sessionStorage.getItem(ANALYTICS_SESSION_PAGEVIEW_KEY);
    if (alreadyTracked === "1") return;
    window.sessionStorage.setItem(ANALYTICS_SESSION_PAGEVIEW_KEY, "1");
  }
  const { visitorId, sessionId } = getOrCreateAnalyticsIds();
  const eventPayload = {
    event: eventName,
    timestamp: new Date().toISOString(),
    visitorId,
    sessionId,
    ...(payload ?? {}),
  };
  try {
    const gtag = (window as Window & { gtag?: (...args: unknown[]) => void }).gtag;
    if (typeof gtag === "function") {
      gtag("event", eventName, payload ?? {});
    }
    const dataLayer = (window as Window & { dataLayer?: unknown[] }).dataLayer;
    if (Array.isArray(dataLayer)) dataLayer.push(eventPayload);
    const raw = window.localStorage.getItem(ANALYTICS_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Array<Record<string, unknown>>) : [];
    const next = [eventPayload, ...parsed].slice(0, 120);
    window.localStorage.setItem(ANALYTICS_STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("vedisa-analytics-updated"));
    void fetch("/api/analytics/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: eventName,
        timestamp: eventPayload.timestamp,
        itemKey:
          typeof payload?.itemKey === "string" ? payload.itemKey : undefined,
        section:
          typeof payload?.section === "string" ? payload.section : undefined,
        payload: {
          ...(payload ?? {}),
          visitorId: eventPayload.visitorId,
          sessionId: eventPayload.sessionId,
        },
      }),
      keepalive: true,
    }).catch(() => {
      // noop: local analytics remains available even if server tracking fails
    });
  } catch {
    // avoid breaking UX if analytics fails
  }
}

function cleanOptional(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function decodeBasicHtmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

function sanitizeRichHtml(value: string): string {
  let html = value;
  html = html.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "");
  html = html.replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "");
  html = html.replace(/<\/?(iframe|object|embed|link|meta)[^>]*>/gi, "");
  html = html.replace(/\son\w+\s*=\s*"[^"]*"/gi, "");
  html = html.replace(/\son\w+\s*=\s*'[^']*'/gi, "");
  html = html.replace(/\son\w+\s*=\s*[^\s>]+/gi, "");
  html = html.replace(/\s(href|src)\s*=\s*(['"])\s*javascript:[\s\S]*?\2/gi, "");
  return html;
}

function formatExtendedDescriptionHtml(value?: string | null): string {
  const normalized = String(value ?? "")
    .replace(/\/n/g, "\n")
    .trim();
  if (!normalized) return "Sin descripcion adicional para este vehiculo.";
  const maybeDecoded =
    /&lt;[a-z][\s\S]*&gt;/i.test(normalized) && !/<[a-z][\s\S]*>/i.test(normalized)
      ? decodeBasicHtmlEntities(normalized)
      : normalized;
  if (/<[a-z][\s\S]*>/i.test(maybeDecoded)) return sanitizeRichHtml(maybeDecoded);
  return escapeHtml(decodeBasicHtmlEntities(normalized)).replace(/\n/g, "<br />");
}

function formatHomeHeroHtml(value?: string | null): string {
  const normalized = String(value ?? "")
    .replace(/\/n/g, "\n")
    .trim();
  if (!normalized) return "";
  const maybeDecoded =
    /&lt;[a-z][\s\S]*&gt;/i.test(normalized) && !/<[a-z][\s\S]*>/i.test(normalized)
      ? decodeBasicHtmlEntities(normalized)
      : normalized;
  if (/<[a-z][\s\S]*>/i.test(maybeDecoded)) return sanitizeRichHtml(maybeDecoded);
  return escapeHtml(decodeBasicHtmlEntities(normalized)).replace(/\n/g, "<br />");
}

function normalizeCssColorToHex(value?: string | null): string {
  const sample = String(value ?? "").trim();
  if (!sample) return "#0f172a";
  const hexMatch = sample.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hexMatch) {
    if (hexMatch[1].length === 3) {
      const [r, g, b] = hexMatch[1].split("");
      return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
    }
    return sample.toLowerCase();
  }
  const rgbMatch = sample.match(
    /^rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})(?:[\s,\/]+[\d.]+)?\s*\)$/i,
  );
  if (!rgbMatch) return "#0f172a";
  const toHex = (raw: string) => {
    const bounded = Math.max(0, Math.min(255, Number(raw)));
    return bounded.toString(16).padStart(2, "0");
  };
  return `#${toHex(rgbMatch[1])}${toHex(rgbMatch[2])}${toHex(rgbMatch[3])}`;
}

function normalizeFontFamilyName(value?: string | null): string {
  const normalized = String(value ?? "")
    .replace(/["']/g, "")
    .split(",")[0]
    ?.trim()
    .toLowerCase();
  if (!normalized) return "Inter";
  if (normalized.includes("inter")) return "Inter";
  if (normalized.includes("arial")) return "Arial";
  if (normalized.includes("georgia")) return "Georgia";
  if (normalized.includes("times new roman")) return "Times New Roman";
  if (normalized.includes("courier new")) return "Courier New";
  return normalized
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function stripHtmlToText(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeBinaryToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function isValidBinaryValue(value?: string): boolean {
  if (!value?.trim()) return true;
  const normalized = normalizeBinaryToken(value);
  return [
    "si",
    "no",
    "yes",
    "true",
    "false",
    "1",
    "0",
    "s",
    "n",
  ].includes(normalized);
}

function isValidDateValue(value?: string): boolean {
  if (!value?.trim()) return true;
  const sample = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(sample)) {
    const date = new Date(`${sample}T00:00:00`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === sample;
  }
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(sample)) {
    const [dd, mm, yyyy] = sample.split("/").map(Number);
    const date = new Date(yyyy, mm - 1, dd);
    return (
      !Number.isNaN(date.getTime()) &&
      date.getFullYear() === yyyy &&
      date.getMonth() === mm - 1 &&
      date.getDate() === dd
    );
  }
  return false;
}

function parseImagesCsv(value?: string): string[] {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.startsWith("http"));
}

function normalizeCloudinaryImages(value?: string): string[] {
  return parseImagesCsv(value).filter((url) => /cloudinary\.com|res\.cloudinary\.com/i.test(url));
}

function mapManualPublicationToCatalogItem(entry: ManualPublication): CatalogItem {
  const images = (entry.images ?? []).filter((url) => url.startsWith("http"));
  const thumbnail = entry.thumbnail ?? images[0];
  return {
    id: `manual-${entry.id}`,
    title: entry.title,
    subtitle: entry.subtitle,
    status: entry.status,
    location: entry.location,
    lot: entry.lot,
    auctionDate: entry.auctionDate,
    images,
    thumbnail,
    view3dUrl: entry.view3dUrl,
    raw: {
      source: "manual",
      patente: entry.patente,
      marca: entry.brand,
      modelo: entry.model,
      ano: entry.year,
      categoria: entry.category,
      descripcion: entry.description,
      precio_normal: entry.originalPrice ?? entry.price,
      precio_promocional: entry.promoPrice ?? (entry.promoEnabled ? entry.price : undefined),
      promo_enabled: entry.promoEnabled ?? false,
      manual_id: entry.id,
    },
  };
}

function buildDetailsDraft(item: CatalogItem, override?: EditorVehicleDetails): EditorVehicleDetails {
  const raw = item.raw as Record<string, unknown>;
  const lookup = buildVehicleLookup(raw);
  const glo3dOps = extractGlo3dOperationDetails(item);
  const cav = (raw.cav_campos as Record<string, unknown> | undefined) ?? {};
  const rawPromoMeta = getRawPromoMeta(raw);
  const baseImages = item.images.filter((url) => url.startsWith("http")).join(", ");
  const pickOp = (
    key: keyof EditorVehicleDetails,
    aliases: string[],
  ): string => {
    const fromOverride = String(override?.[key] ?? "").trim();
    if (fromOverride) return fromOverride;
    const fromGlo3d = String(glo3dOps[key] ?? "").trim();
    if (fromGlo3d) return fromGlo3d;
    return String(getLookupValue(lookup, aliases) ?? "").trim();
  };
  return {
    title: override?.title ?? item.title,
    subtitle: override?.subtitle ?? (item.subtitle ?? ""),
    patente: override?.patente ?? resolvePatenteFromRaw(raw),
    patenteVerifier:
      override?.patenteVerifier ??
      String(
        getLookupValue(lookup, [
          "patente_verifier",
          "patente_dv",
          "ppu_dv",
          "dv",
          "glo3d.patente_verifier",
          "glo3d.ppu_dv",
        ]) ?? "",
      ),
    vin:
      override?.vin ??
      String(getLookupValue(lookup, ["vin", "n_de_vin", "numero_chasis", "nro_chasis", "glo3d.n_de_vin"]) ?? raw.vin ?? cav.vin ?? cav.numero_chasis ?? ""),
    nChasis:
      override?.nChasis ??
      String(
        getLookupValue(lookup, ["n_de_chasis", "numero_chasis", "nro_chasis", "chasis", "glo3d.n_de_chasis"]) ?? "",
      ),
    nMotor:
      override?.nMotor ??
      String(getLookupValue(lookup, ["n_de_motor", "numero_motor", "motor_number", "ndm", "glo3d.n_de_motor", "glo3d.ndm"]) ?? ""),
    nSerie:
      override?.nSerie ??
      String(getLookupValue(lookup, ["n_de_serie", "numero_serie", "serial_number", "nds", "glo3d.n_de_serie", "glo3d.nds"]) ?? ""),
    nSiniestro:
      override?.nSiniestro ??
      String(getLookupValue(lookup, ["n_de_siniestro", "numero_siniestro", "n_s", "ns", "glo3d.n_de_siniestro", "glo3d.n_s"]) ?? ""),
    version:
      override?.version ??
      String(getLookupValue(lookup, ["version", "ver", "trim", "glo3d.version", "glo3d.trim"]) ?? ""),
    tipo:
      override?.tipo ??
      String(getLookupValue(lookup, ["tipo", "type", "tipo_unidad", "glo3d.tipo"]) ?? ""),
    tipoVehiculo:
      override?.tipoVehiculo ??
      String(getLookupValue(lookup, ["tipo_de_vehiculo", "tipo_vehiculo", "vehicle_type", "glo3d.tipo_de_vehiculo"]) ?? ""),
    vehicleCondition:
      override?.vehicleCondition ??
      String(
        getLookupValue(lookup, [
          "condicion",
          "condicion",
          "condicion_vehiculo",
          "estado_vehiculo",
          "estado",
          "status",
          "aws.condicion",
          "aws.estado",
        ]) ??
          item.status ??
          "",
      ),
    status: override?.status ?? (item.status ?? ""),
    location: override?.location ?? (item.location ?? ""),
    ubicacionFisica: pickOp("ubicacionFisica", [
      "ubicacion_fisica",
      "ubi",
      "ubicacion",
      "location",
      "glo3d.ubicacion_fisica",
      "glo3d.ubi",
    ]),
    transportista: pickOp("transportista", ["transportista", "tra", "glo3d.transportista", "glo3d.tra"]),
    taller: pickOp("taller", ["taller", "tal", "glo3d.taller", "glo3d.tal"]),
    lot: override?.lot ?? (item.lot ?? ""),
    auctionDate: override?.auctionDate ?? (item.auctionDate ?? ""),
    description: override?.description ?? String(raw.descripcion ?? raw.description ?? ""),
    extendedDescription:
      override?.extendedDescription ??
      String(
        getLookupValue(lookup, [
          "descripcion_ampliada",
          "observaciones",
          "detalle",
          "descripcion",
          "description",
          "aws.observaciones",
          "aws.descripcion",
          "aws.description",
          "cav_campos.observaciones",
          "cav_campos.descripcion",
        ]) ?? "",
      ),
    brand: override?.brand ?? String(getLookupValue(lookup, ["marca", "brand", "make", "glo3d.make"]) ?? raw.marca ?? raw.brand ?? ""),
    model: override?.model ?? String(getLookupValue(lookup, ["modelo", "model", "model2", "glo3d.model2"]) ?? raw.modelo ?? raw.model ?? ""),
    year: override?.year ?? String(getLookupValue(lookup, ["ano", "anio", "year", "glo3d.year"]) ?? raw.ano ?? raw.anio ?? raw.year ?? ""),
    category: override?.category ?? String(raw.categoria ?? ""),
    kilometraje:
      override?.kilometraje ??
      String(
        getLookupValue(lookup, [
          "autored.kilometraje",
          "autored.km",
          "autored.mileage",
          "kilometraje",
          "km",
          "mileage",
        ]) ?? cav.kilometraje ?? cav.km ?? "",
      ),
    color:
      override?.color ??
      String(
        getLookupValue(lookup, [
          "autored.color",
          "autored.color_exterior",
          "autored.exterior_color",
          "color",
        ]) ?? cav.color ?? "",
      ),
    combustible:
      override?.combustible ??
      String(
        getLookupValue(lookup, [
          "autored.combustible",
          "autored.tipo_combustible",
          "autored.fuel",
          "autored.fuel_type",
          "combustible",
        ]) ?? cav.combustible ?? "",
      ),
    transmision:
      override?.transmision ??
      String(
        getLookupValue(lookup, [
          "autored.transmision",
          "autored.transmission",
          "autored.caja",
          "autored.tipo_caja",
          "transmision",
          "caja",
        ]) ?? cav.transmision ?? cav.caja ?? "",
      ),
    traccion:
      override?.traccion ??
      String(
        getLookupValue(lookup, [
          "autored.traccion",
          "autored.drive_type",
          "autored.tipo_traccion",
          "traccion",
        ]) ?? cav.traccion ?? "",
      ),
    aro:
      override?.aro ??
      String(
        getLookupValue(lookup, [
          "autored.aro",
          "autored.rin",
          "autored.rines",
          "autored.wheel_size",
          "aro",
        ]) ?? cav.aro ?? "",
      ),
    cilindrada:
      override?.cilindrada ??
      String(
        getLookupValue(lookup, [
          "autored.cilindrada",
          "autored.cc",
          "autored.motor_cc",
          "autored.engine_cc",
          "cilindrada",
        ]) ?? cav.cilindrada ?? "",
      ),
    llaves: pickOp("llaves", ["llaves", "lla", "keys", "has_keys", "tiene_llaves", "glo3d.llaves", "glo3d.lla"]),
    aireAcondicionado: pickOp("aireAcondicionado", [
      "aire_acondicionado",
      "air_conditioning",
      "has_ac",
      "ac",
      "glo3d.aire_acondicionado",
    ]),
    unicoPropietario: pickOp("unicoPropietario", [
      "unico_propietario",
      "dun",
      "DUN",
      "single_owner",
      "one_owner",
      "glo3d.unico_propietario",
      "glo3d.dun",
    ]),
    condicionado: pickOp("condicionado", [
      "condicionado",
      "conditioned",
      "acondicionado",
      "glo3d.condicionado",
    ]),
    multas: pickOp("multas", ["multas", "mul", "Mul", "glo3d.multas", "glo3d.mul"]),
    tag: pickOp("tag", ["tag", "TAG", "glo3d.tag"]),
    vencRevisionTecnica: pickOp("vencRevisionTecnica", [
      "vencimiento_revision_tecnica",
      "vrt",
      "glo3d.vencimiento_revision_tecnica",
      "glo3d.vrt",
    ]),
    vencPermisoCirculacion: pickOp("vencPermisoCirculacion", [
      "vencimiento_permiso_circulacion",
      "vpc",
      "glo3d.vencimiento_permiso_circulacion",
      "glo3d.vpc",
    ]),
    vencSeguroObligatorio: pickOp("vencSeguroObligatorio", [
      "vencimiento_seguro_obligatorio",
      "vso",
      "glo3d.vencimiento_seguro_obligatorio",
      "glo3d.vso",
    ]),
    pruebaMotor: pickOp("pruebaMotor", ["prueba_motor", "pdm", "glo3d.prueba_motor", "glo3d.pdm"]),
    pruebaDesplazamiento: pickOp("pruebaDesplazamiento", [
      "prueba_desplazamiento",
      "pdd",
      "glo3d.prueba_desplazamiento",
      "glo3d.pdd",
    ]),
    estadoAirbags: pickOp("estadoAirbags", ["estado_airbags", "eda", "glo3d.estado_airbags", "glo3d.eda"]),
    nombrePropietarioAnterior: pickOp("nombrePropietarioAnterior", [
      "nombre_propietario_anterior",
      "npa",
      "glo3d.nombre_propietario_anterior",
      "glo3d.npa",
    ]),
    rutPropietarioAnterior: pickOp("rutPropietarioAnterior", [
      "rut_propietario_anterior",
      "rpa",
      "glo3d.rut_propietario_anterior",
      "glo3d.rpa",
    ]),
    rutVerificador:
      override?.rutVerificador ??
      String(getLookupValue(lookup, ["rut_verificador", "verifier_rut", "glo3d.rut_verificador"]) ?? ""),
    thumbnail:
      (override?.thumbnail?.trim() && !isPlaceholderCatalogThumbnail(override.thumbnail)
        ? override.thumbnail.trim()
        : undefined) ??
      resolveCatalogItemThumbnail(item) ??
      item.thumbnail ??
      "",
    view3dUrl: override?.view3dUrl ?? (item.view3dUrl ?? ""),
    imagesCsv: override?.imagesCsv ?? baseImages,
    originalPrice: override?.originalPrice ?? rawPromoMeta.originalPriceLabel ?? "",
    promoPrice: override?.promoPrice ?? rawPromoMeta.promoPriceLabel ?? "",
    promoEnabled:
      typeof override?.promoEnabled === "boolean" ? override.promoEnabled : rawPromoMeta.promoEnabled,
    taxFee:
      override?.taxFee ??
      String(
        getLookupValue(lookup, ["gasto_impuesto", "gastos_impuesto", "impuesto", "impuestos", "tax_fee"]) ??
          "",
      ),
    transferFee:
      override?.transferFee ??
      String(
        getLookupValue(lookup, [
          "gasto_transferencia",
          "gastos_transferencia",
          "transferencia",
          "transfer_fee",
        ]) ?? "",
      ),
  };
}

const PUBLICATION_SECTION_IDS: SectionId[] = [
  "proximos-remates",
  "ventas-directas",
  "novedades",
  "catalogo",
];

function buildPublicationDraftFromItem(
  item: CatalogItem,
  config: EditorConfig,
  vehicleKey: string,
): ManualPublicationDraft {
  const details = buildDetailsDraft(item, config.vehicleDetails[vehicleKey]);
  const sectionIds = PUBLICATION_SECTION_IDS.filter((sectionId) =>
    isVehicleInAssignmentList(config.sectionVehicleIds[sectionId] ?? [], vehicleKey),
  );
  const visible = !config.hiddenVehicleIds.includes(vehicleKey);
  const configuredPrice = config.vehiclePrices[vehicleKey] ?? "";
  const images = item.images.filter((url) => url.startsWith("http"));

  let draft: ManualPublicationDraft = {
    ...EMPTY_MANUAL_PUBLICATION_DRAFT,
    ...details,
    status: details.status || item.status || "Disponible",
    location: details.location ?? item.location ?? "",
    lot: details.lot ?? item.lot ?? "",
    auctionDate: details.auctionDate ?? item.auctionDate ?? "",
    normalPrice: details.originalPrice?.trim()
      ? toCurrencyInput(details.originalPrice)
      : toCurrencyInput(configuredPrice),
    promoEnabled: details.promoEnabled ?? false,
    promoPrice: details.promoPrice?.trim() ? toCurrencyInput(details.promoPrice) : "",
    taxFee: details.taxFee?.trim() ? toCurrencyInput(details.taxFee) : "",
    transferFee: details.transferFee?.trim() ? toCurrencyInput(details.transferFee) : "",
    upcomingAuctionId: config.vehicleUpcomingAuctionIds[vehicleKey] ?? "",
    visible,
    sectionIds: sectionIds.length > 0 ? sectionIds : ["catalogo"],
    imagesCsv: details.imagesCsv ?? images.join(", "),
    thumbnail: details.thumbnail ?? item.thumbnail ?? images[0] ?? "",
    view3dUrl: details.view3dUrl ?? item.view3dUrl ?? "",
  };

  draft = mergeGlo3dOperationIntoDraft(draft, extractGlo3dOperationDetails(item));
  draft = mergeAutoredMechanicalIntoDraft(draft, extractAutoredMechanicalDetails(item), true);

  return draft;
}

function sanitizeDetails(details: EditorVehicleDetails): EditorVehicleDetails | undefined {
  const clean: EditorVehicleDetails = {
    title: cleanOptional(details.title),
    subtitle: cleanOptional(details.subtitle),
    patente: cleanOptional(details.patente),
    patenteVerifier: cleanOptional(details.patenteVerifier),
    vin: cleanOptional(details.vin),
    nChasis: cleanOptional(details.nChasis),
    nMotor: cleanOptional(details.nMotor),
    nSerie: cleanOptional(details.nSerie),
    nSiniestro: cleanOptional(details.nSiniestro),
    version: cleanOptional(details.version),
    tipo: cleanOptional(details.tipo),
    tipoVehiculo: cleanOptional(details.tipoVehiculo),
    vehicleCondition: cleanOptional(details.vehicleCondition),
    status: cleanOptional(details.status),
    location: cleanOptional(details.location),
    ubicacionFisica: cleanOptional(details.ubicacionFisica),
    transportista: cleanOptional(details.transportista),
    taller: cleanOptional(details.taller),
    lot: cleanOptional(details.lot),
    auctionDate: cleanOptional(details.auctionDate),
    description: cleanOptional(details.description),
    extendedDescription: cleanOptional(details.extendedDescription),
    brand: cleanOptional(details.brand),
    model: cleanOptional(details.model),
    year: cleanOptional(details.year),
    category: cleanOptional(details.category),
    kilometraje: cleanOptional(details.kilometraje),
    color: cleanOptional(details.color),
    combustible: cleanOptional(details.combustible),
    transmision: cleanOptional(details.transmision),
    traccion: cleanOptional(details.traccion),
    aro: cleanOptional(details.aro),
    cilindrada: cleanOptional(details.cilindrada),
    llaves: cleanOptional(details.llaves),
    aireAcondicionado: cleanOptional(details.aireAcondicionado),
    unicoPropietario: cleanOptional(details.unicoPropietario),
    condicionado: cleanOptional(details.condicionado),
    multas: cleanOptional(details.multas),
    tag: cleanOptional(details.tag),
    vencRevisionTecnica: cleanOptional(details.vencRevisionTecnica),
    vencPermisoCirculacion: cleanOptional(details.vencPermisoCirculacion),
    vencSeguroObligatorio: cleanOptional(details.vencSeguroObligatorio),
    pruebaMotor: cleanOptional(details.pruebaMotor),
    pruebaDesplazamiento: cleanOptional(details.pruebaDesplazamiento),
    estadoAirbags: cleanOptional(details.estadoAirbags),
    nombrePropietarioAnterior: cleanOptional(details.nombrePropietarioAnterior),
    rutPropietarioAnterior: cleanOptional(details.rutPropietarioAnterior),
    rutVerificador: cleanOptional(details.rutVerificador),
    thumbnail: cleanOptional(details.thumbnail),
    view3dUrl: cleanOptional(details.view3dUrl),
    imagesCsv: cleanOptional(details.imagesCsv),
    originalPrice: cleanOptional(details.originalPrice),
    promoPrice: cleanOptional(details.promoPrice),
    promoEnabled: typeof details.promoEnabled === "boolean" ? details.promoEnabled : undefined,
    taxFee: cleanOptional(details.taxFee),
    transferFee: cleanOptional(details.transferFee),
  };

  if (Object.values(clean).every((value) => !value)) return undefined;
  return clean;
}

function applyDetailsOverride(item: CatalogItem, override?: EditorVehicleDetails): CatalogItem {
  if (!override) {
    const resolvedThumbnail = resolveCatalogItemThumbnail(item);
    if (!resolvedThumbnail || !isPlaceholderCatalogThumbnail(item.thumbnail)) return item;
    return {
      ...item,
      thumbnail: resolvedThumbnail,
      images: item.images.length > 0 ? item.images : [resolvedThumbnail],
    };
  }
  const images = parseImagesCsv(override.imagesCsv);
  const resolvedThumbnail = resolveCatalogItemThumbnail(item);
  const overrideThumbnail = override.thumbnail?.trim();
  const thumbnail =
    overrideThumbnail && !isPlaceholderCatalogThumbnail(overrideThumbnail)
      ? overrideThumbnail
      : resolvedThumbnail ?? item.thumbnail;
  return {
    ...item,
    title: override.title ?? item.title,
    subtitle: override.subtitle ?? item.subtitle,
    status: override.status ?? item.status,
    location: override.location ?? item.location,
    lot: override.lot ?? item.lot,
    auctionDate: override.auctionDate ?? item.auctionDate,
    thumbnail,
    view3dUrl: override.view3dUrl?.trim() || item.view3dUrl,
    images: images.length > 0 ? images : item.images,
    raw: {
      ...item.raw,
      ...(override.patente ? { patente: override.patente, PPU: override.patente } : {}),
      ...(override.patenteVerifier ? { patente_verifier: override.patenteVerifier, ppu_dv: override.patenteVerifier, dv: override.patenteVerifier } : {}),
      ...(override.vin ? { vin: override.vin } : {}),
      ...(override.nChasis ? { n_de_chasis: override.nChasis, numero_chasis: override.nChasis, nro_chasis: override.nChasis, chasis: override.nChasis } : {}),
      ...(override.nMotor ? { n_de_motor: override.nMotor, numero_motor: override.nMotor, ndm: override.nMotor } : {}),
      ...(override.nSerie ? { n_de_serie: override.nSerie, numero_serie: override.nSerie, nds: override.nSerie } : {}),
      ...(override.nSiniestro ? { n_de_siniestro: override.nSiniestro, numero_siniestro: override.nSiniestro, n_s: override.nSiniestro, ns: override.nSiniestro } : {}),
      ...(override.version ? { version: override.version, ver: override.version, trim: override.version } : {}),
      ...(override.tipo ? { tipo: override.tipo, type: override.tipo } : {}),
      ...(override.tipoVehiculo ? { tipo_de_vehiculo: override.tipoVehiculo, tipo_vehiculo: override.tipoVehiculo, vehicle_type: override.tipoVehiculo } : {}),
      ...(override.vehicleCondition
        ? {
            condicion: override.vehicleCondition,
            condicion_vehiculo: override.vehicleCondition,
            estado_vehiculo: override.vehicleCondition,
          }
        : {}),
      ...(override.description ? { descripcion: override.description, description: override.description } : {}),
      ...(override.extendedDescription
        ? { descripcion_ampliada: override.extendedDescription, observaciones: override.extendedDescription }
        : {}),
      ...(override.brand ? { marca: override.brand, brand: override.brand } : {}),
      ...(override.model ? { modelo: override.model, model: override.model } : {}),
      ...(override.year ? { ano: override.year, anio: override.year, year: override.year } : {}),
      ...(override.category ? { categoria: override.category } : {}),
      ...(override.kilometraje ? { kilometraje: override.kilometraje, km: override.kilometraje } : {}),
      ...(override.color ? { color: override.color } : {}),
      ...(override.combustible ? { combustible: override.combustible } : {}),
      ...(override.transmision ? { transmision: override.transmision, caja: override.transmision } : {}),
      ...(override.traccion ? { traccion: override.traccion } : {}),
      ...(override.aro ? { aro: override.aro } : {}),
      ...(override.cilindrada ? { cilindrada: override.cilindrada } : {}),
      ...(override.location ? { ubicacion: override.location } : {}),
      ...(override.ubicacionFisica ? { ubicacion_fisica: override.ubicacionFisica, ubi: override.ubicacionFisica } : {}),
      ...(override.transportista ? { transportista: override.transportista, tra: override.transportista } : {}),
      ...(override.taller ? { taller: override.taller, tal: override.taller } : {}),
      ...(override.llaves ? { llaves: override.llaves } : {}),
      ...(override.aireAcondicionado ? { aire_acondicionado: override.aireAcondicionado } : {}),
      ...(override.unicoPropietario ? { unico_propietario: override.unicoPropietario } : {}),
      ...(override.condicionado ? { condicionado: override.condicionado } : {}),
      ...(override.multas ? { multas: override.multas, mul: override.multas } : {}),
      ...(override.tag ? { tag: override.tag } : {}),
      ...(override.vencRevisionTecnica ? { vencimiento_revision_tecnica: override.vencRevisionTecnica, vrt: override.vencRevisionTecnica } : {}),
      ...(override.vencPermisoCirculacion ? { vencimiento_permiso_circulacion: override.vencPermisoCirculacion, vpc: override.vencPermisoCirculacion } : {}),
      ...(override.vencSeguroObligatorio ? { vencimiento_seguro_obligatorio: override.vencSeguroObligatorio, vso: override.vencSeguroObligatorio } : {}),
      ...(override.pruebaMotor ? { prueba_motor: override.pruebaMotor, pdm: override.pruebaMotor } : {}),
      ...(override.pruebaDesplazamiento ? { prueba_desplazamiento: override.pruebaDesplazamiento, pdd: override.pruebaDesplazamiento } : {}),
      ...(override.estadoAirbags ? { estado_airbags: override.estadoAirbags, eda: override.estadoAirbags } : {}),
      ...(override.nombrePropietarioAnterior ? { nombre_propietario_anterior: override.nombrePropietarioAnterior, npa: override.nombrePropietarioAnterior } : {}),
      ...(override.rutPropietarioAnterior ? { rut_propietario_anterior: override.rutPropietarioAnterior, rpa: override.rutPropietarioAnterior } : {}),
      ...(override.rutVerificador ? { rut_verificador: override.rutVerificador, verifier_rut: override.rutVerificador } : {}),
      ...(override.taxFee
        ? {
            gasto_impuesto: override.taxFee,
            gastos_impuesto: override.taxFee,
            impuesto: override.taxFee,
            tax_fee: override.taxFee,
          }
        : {}),
      ...(override.transferFee
        ? {
            gasto_transferencia: override.transferFee,
            gastos_transferencia: override.transferFee,
            transferencia: override.transferFee,
            transfer_fee: override.transferFee,
          }
        : {}),
    },
  };
}

type FeaturedStripProps = {
  items: CatalogItem[];
  onOpenVehicle: (item: CatalogItem) => void;
};

function FeaturedStrip({ items, onOpenVehicle }: FeaturedStripProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const dragStartXRef = useRef(0);
  const dragStartScrollLeftRef = useRef(0);
  const draggedRef = useRef(false);

  const updateScrollArrows = useCallback(() => {
    const node = scrollRef.current;
    if (!node) return;
    const maxScrollLeft = Math.max(0, node.scrollWidth - node.clientWidth);
    const hasOverflow = maxScrollLeft > 4;
    setCanScrollLeft(hasOverflow && node.scrollLeft > 4);
    setCanScrollRight(hasOverflow && node.scrollLeft < maxScrollLeft - 4);
  }, []);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    const raf = window.requestAnimationFrame(() => updateScrollArrows());
    const onScroll = () => updateScrollArrows();
    const onResize = () => updateScrollArrows();
    node.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      window.cancelAnimationFrame(raf);
      node.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, [items.length, updateScrollArrows]);

  const scrollByAmount = (direction: "left" | "right") => {
    const node = scrollRef.current;
    if (!node) return;
    const amount = Math.max(280, Math.round(node.clientWidth * 0.72));
    const offset = direction === "left" ? -amount : amount;
    node.scrollBy({ left: offset, behavior: "smooth" });
    window.setTimeout(() => updateScrollArrows(), 320);
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const node = scrollRef.current;
    if (!node) return;
    setIsDragging(true);
    draggedRef.current = false;
    dragStartXRef.current = event.clientX;
    dragStartScrollLeftRef.current = node.scrollLeft;
    node.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const node = scrollRef.current;
    if (!node || !isDragging) return;
    const delta = event.clientX - dragStartXRef.current;
    if (Math.abs(delta) > 6) draggedRef.current = true;
    node.scrollLeft = dragStartScrollLeftRef.current - delta;
  };

  const endPointerDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setIsDragging(false);
    scrollRef.current?.releasePointerCapture(event.pointerId);
    window.setTimeout(() => {
      draggedRef.current = false;
    }, 20);
  };

  const onMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    const node = scrollRef.current;
    if (!node) return;
    setIsDragging(true);
    draggedRef.current = false;
    dragStartXRef.current = event.clientX;
    dragStartScrollLeftRef.current = node.scrollLeft;
  };

  const onMouseMove = (event: MouseEvent<HTMLDivElement>) => {
    const node = scrollRef.current;
    if (!node || !isDragging) return;
    const delta = event.clientX - dragStartXRef.current;
    if (Math.abs(delta) > 6) draggedRef.current = true;
    node.scrollLeft = dragStartScrollLeftRef.current - delta;
  };

  const endDrag = () => {
    setIsDragging(false);
    window.setTimeout(() => {
      draggedRef.current = false;
    }, 20);
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      scrollByAmount("left");
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      scrollByAmount("right");
    }
  };

  if (items.length === 0) return null;

  return (
    <section className="section-shell mb-8">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="premium-kicker">Selecciones premium</p>
          <h2 className="text-2xl font-bold text-[#2f1e13]">Vitrina destacada</h2>
        </div>
        <p className="mobile-scroll-hint hidden sm:block">Desliza con mouse o flechas</p>
        <p className="mobile-scroll-hint sm:hidden">Desliza para ver mas</p>
      </div>
      <div className="featured-strip-shell relative">
        <button
          type="button"
          onClick={() => scrollByAmount("left")}
          className={`ui-focus absolute left-2 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-amber-200/50 bg-[#4d301d]/70 text-amber-50 backdrop-blur-sm transition hover:bg-[#4d301d] md:inline-flex ${
            canScrollLeft ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
          aria-label="Desplazar vitrina hacia la izquierda"
          title="Anterior"
        >
          <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M12.78 4.22a.75.75 0 0 1 0 1.06L8.06 10l4.72 4.72a.75.75 0 1 1-1.06 1.06l-5.25-5.25a.75.75 0 0 1 0-1.06l5.25-5.25a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => scrollByAmount("right")}
          className={`ui-focus absolute right-2 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-amber-200/50 bg-[#4d301d]/70 text-amber-50 backdrop-blur-sm transition hover:bg-[#4d301d] md:inline-flex ${
            canScrollRight ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
          aria-label="Desplazar vitrina hacia la derecha"
          title="Siguiente"
        >
          <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M7.22 15.78a.75.75 0 0 1 0-1.06L11.94 10 7.22 5.28a.75.75 0 1 1 1.06-1.06l5.25 5.25a.75.75 0 0 1 0 1.06l-5.25 5.25a.75.75 0 0 1-1.06 0Z" clipRule="evenodd" />
          </svg>
        </button>
        <div
          ref={scrollRef}
          className={`featured-strip select-none max-md:cursor-default ${isDragging ? "cursor-grabbing" : "md:cursor-grab"}`}
          tabIndex={0}
          role="region"
          aria-label="Vitrina destacada: desliza horizontalmente para ver mas"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endPointerDrag}
          onPointerCancel={endPointerDrag}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={endDrag}
          onMouseLeave={endDrag}
          onKeyDown={onKeyDown}
        >
          {items.map((item) => (
            <button
              key={`featured-${item.id}`}
              type="button"
              className="featured-item text-left"
              onClick={() => {
                if (draggedRef.current) return;
                onOpenVehicle(item);
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.thumbnail ?? item.images[0] ?? "/placeholder-car.svg"}
                alt={item.title}
                className="featured-image"
                loading="lazy"
              />
              <div className="featured-overlay" />
              <div className="featured-content">
                <p className="line-clamp-1 text-sm font-semibold uppercase tracking-wide text-white">
                  {item.status ?? "Unidad disponible"}
                </p>
                <h3 className="line-clamp-2 text-xl font-bold text-white">{item.title}</h3>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-amber-100">
                  {item.subtitle ? <span className="featured-chip">{item.subtitle}</span> : null}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

type MinimizableSectionHeaderProps = {
  kicker?: string;
  title: string;
  subtitle?: string;
  count: number;
  countLabel?: string;
  isMinimized: boolean;
  onToggleMinimize: () => void;
  titleClassName?: string;
  subtitleClassName?: string;
  trailing?: ReactNode;
};

function MinimizableSectionHeader({
  kicker,
  title,
  subtitle,
  count,
  countLabel = "publicaciones",
  isMinimized,
  onToggleMinimize,
  titleClassName = "text-2xl font-bold text-[#2f1e13]",
  subtitleClassName = "mt-1 text-sm text-[#6f563f]",
  trailing,
}: MinimizableSectionHeaderProps) {
  return (
    <header
      className={`flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between ${
        isMinimized ? "mb-0" : "mb-4"
      }`}
    >
      <div className="min-w-0 flex-1">
        {isMinimized ? (
          <h2 className="text-xl font-bold text-[#2f1e13]">{title}</h2>
        ) : (
          <>
            {kicker ? <p className="premium-kicker">{kicker}</p> : null}
            <h2 className={titleClassName}>{title}</h2>
            {subtitle ? <p className={subtitleClassName}>{subtitle}</p> : null}
          </>
        )}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <span className="inline-flex w-fit rounded-full border border-amber-300/70 bg-[#f3e3d4] px-3 py-1 text-xs font-semibold text-[#6b3d1e]">
          {count} {countLabel}
        </span>
        <button
          type="button"
          onClick={onToggleMinimize}
          className="ui-focus inline-flex rounded-full border border-amber-300/70 bg-white px-3 py-1 text-xs font-semibold text-[#6b3d1e] transition hover:bg-[#fff6ec]"
          aria-expanded={!isMinimized}
          aria-label={`${isMinimized ? "Expandir" : "Minimizar"} seccion ${title}`}
        >
          {isMinimized ? "Expandir" : "Minimizar"}
        </button>
        {!isMinimized ? trailing : null}
      </div>
    </header>
  );
}

type SectionProps = {
  id: string;
  title: string;
  subtitle: string;
  items: CatalogItem[];
  priceMap: Record<string, string>;
  upcomingAuctionByVehicleKey?: Record<string, string>;
  favoriteKeys: string[];
  onToggleFavorite: (itemKey: string) => void;
  compareKeys: string[];
  onToggleCompare: (itemKey: string) => void;
  onOpenVehicle: (item: CatalogItem) => void;
  cardDensity: CardDensity;
  canInlineEdit?: boolean;
  onInlineSaveItem?: (
    item: CatalogItem,
    changes: { title?: string; subtitle?: string; price?: string },
  ) => void;
};

type HorizontalCardsRailProps = {
  sectionKey: string;
  items: CatalogItem[];
  priceMap: Record<string, string>;
  upcomingAuctionByVehicleKey?: Record<string, string>;
  favoriteKeys: string[];
  onToggleFavorite: (itemKey: string) => void;
  compareKeys: string[];
  onToggleCompare: (itemKey: string) => void;
  onOpenVehicle: (item: CatalogItem) => void;
  cardDensity: CardDensity;
  canInlineEdit?: boolean;
  onInlineSaveItem?: (
    item: CatalogItem,
    changes: { title?: string; subtitle?: string; price?: string },
  ) => void;
};

function HorizontalCardsRail({
  sectionKey,
  items,
  priceMap,
  upcomingAuctionByVehicleKey,
  favoriteKeys,
  onToggleFavorite,
  compareKeys,
  onToggleCompare,
  onOpenVehicle,
  cardDensity,
  canInlineEdit = false,
  onInlineSaveItem,
}: HorizontalCardsRailProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const dragStartXRef = useRef(0);
  const dragStartScrollLeftRef = useRef(0);
  const draggedRef = useRef(false);

  const updateScrollArrows = useCallback(() => {
    const node = scrollRef.current;
    if (!node) return;
    const maxScrollLeft = Math.max(0, node.scrollWidth - node.clientWidth);
    const hasOverflow = maxScrollLeft > 4;
    setCanScrollLeft(hasOverflow && node.scrollLeft > 4);
    setCanScrollRight(hasOverflow && node.scrollLeft < maxScrollLeft - 4);
  }, []);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    const raf = window.requestAnimationFrame(() => updateScrollArrows());
    const onScroll = () => updateScrollArrows();
    const onResize = () => updateScrollArrows();
    node.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      window.cancelAnimationFrame(raf);
      node.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, [items.length, updateScrollArrows]);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    // Evita "espacios en blanco" cuando cambia el set de tarjetas y el rail
    // conserva un scroll horizontal previo fuera de rango.
    node.scrollLeft = 0;
    const raf = window.requestAnimationFrame(() => updateScrollArrows());
    return () => window.cancelAnimationFrame(raf);
  }, [sectionKey, items, updateScrollArrows]);

  const scrollByAmount = (direction: "left" | "right") => {
    const node = scrollRef.current;
    if (!node) return;
    const firstCard = node.firstElementChild as HTMLElement | null;
    const cardWidth = firstCard?.getBoundingClientRect().width ?? 300;
    const cardsPerStep = typeof window !== "undefined" && window.innerWidth >= 1200 ? 6 : 1;
    const gap = 16;
    const amount = Math.max(cardWidth + gap, Math.round((cardWidth + gap) * cardsPerStep));
    const offset = direction === "left" ? -amount : amount;
    node.scrollBy({ left: offset, behavior: "smooth" });
    window.setTimeout(() => updateScrollArrows(), 320);
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const node = scrollRef.current;
    if (!node) return;
    setIsDragging(true);
    draggedRef.current = false;
    dragStartXRef.current = event.clientX;
    dragStartScrollLeftRef.current = node.scrollLeft;
    node.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const node = scrollRef.current;
    if (!node || !isDragging) return;
    const delta = event.clientX - dragStartXRef.current;
    if (Math.abs(delta) > 6) draggedRef.current = true;
    node.scrollLeft = dragStartScrollLeftRef.current - delta;
  };

  const endPointerDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setIsDragging(false);
    scrollRef.current?.releasePointerCapture(event.pointerId);
    window.setTimeout(() => {
      draggedRef.current = false;
    }, 20);
  };

  const onMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    const node = scrollRef.current;
    if (!node) return;
    setIsDragging(true);
    draggedRef.current = false;
    dragStartXRef.current = event.clientX;
    dragStartScrollLeftRef.current = node.scrollLeft;
  };

  const onMouseMove = (event: MouseEvent<HTMLDivElement>) => {
    const node = scrollRef.current;
    if (!node || !isDragging) return;
    const delta = event.clientX - dragStartXRef.current;
    if (Math.abs(delta) > 6) draggedRef.current = true;
    node.scrollLeft = dragStartScrollLeftRef.current - delta;
  };

  const endDrag = () => {
    setIsDragging(false);
    window.setTimeout(() => {
      draggedRef.current = false;
    }, 20);
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      scrollByAmount("left");
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      scrollByAmount("right");
    }
  };

  return (
    <div className="catalog-rail-shell relative">
      <button
        type="button"
        onClick={() => scrollByAmount("left")}
        className={`ui-focus absolute left-2 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/40 bg-slate-900/25 text-white backdrop-blur-sm transition hover:bg-slate-900/45 md:inline-flex ${
          canScrollLeft ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-label="Desplazar tarjetas hacia la izquierda"
        title="Anterior"
      >
        <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor" aria-hidden="true">
          <path fillRule="evenodd" d="M12.78 4.22a.75.75 0 0 1 0 1.06L8.06 10l4.72 4.72a.75.75 0 1 1-1.06 1.06l-5.25-5.25a.75.75 0 0 1 0-1.06l5.25-5.25a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => scrollByAmount("right")}
        className={`ui-focus absolute right-2 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/40 bg-slate-900/25 text-white backdrop-blur-sm transition hover:bg-slate-900/45 md:inline-flex ${
          canScrollRight ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-label="Desplazar tarjetas hacia la derecha"
        title="Siguiente"
      >
        <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor" aria-hidden="true">
          <path fillRule="evenodd" d="M7.22 15.78a.75.75 0 0 1 0-1.06L11.94 10 7.22 5.28a.75.75 0 1 1 1.06-1.06l5.25 5.25a.75.75 0 0 1 0 1.06l-5.25 5.25a.75.75 0 0 1-1.06 0Z" clipRule="evenodd" />
        </svg>
      </button>
      <div
        ref={scrollRef}
        className={`catalog-rail select-none max-md:cursor-default ${isDragging ? "cursor-grabbing" : "md:cursor-grab"}`}
        tabIndex={0}
        role="region"
        aria-label={`Carrusel ${sectionKey}: desliza horizontalmente para ver mas vehiculos`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointerDrag}
        onPointerCancel={endPointerDrag}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={endDrag}
        onMouseLeave={endDrag}
        onKeyDown={onKeyDown}
      >
        {items.map((item, index) => (
          <div key={`${sectionKey}-${item.id}`} className="catalog-rail-item">
            <CatalogCard
              item={item}
              imageLoading={index < 4 ? "eager" : "lazy"}
              priceLabel={formatPrice(priceMap[getVehicleKey(item)])}
              upcomingAuctionLabel={upcomingAuctionByVehicleKey?.[getVehicleKey(item)]}
              density={cardDensity}
              onOpen={() => {
                if (draggedRef.current) return;
                onOpenVehicle(item);
              }}
              isFavorite={favoriteKeys.includes(getVehicleKey(item))}
              onToggleFavorite={() => onToggleFavorite(getVehicleKey(item))}
              isCompared={compareKeys.includes(getVehicleKey(item))}
              onToggleCompare={() => onToggleCompare(getVehicleKey(item))}
              onWhatsappClick={() =>
                trackEvent("whatsapp_click_card", {
                  section: sectionKey,
                  itemKey: getVehicleKey(item),
                })
              }
              canInlineEdit={canInlineEdit}
              editablePriceValue={priceMap[getVehicleKey(item)]}
              onInlineSave={
                onInlineSaveItem
                  ? (changes) => onInlineSaveItem(item, changes)
                  : undefined
              }
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function Section({
  id,
  title,
  subtitle,
  items,
  priceMap,
  upcomingAuctionByVehicleKey,
  favoriteKeys,
  onToggleFavorite,
  compareKeys,
  onToggleCompare,
  onOpenVehicle,
  cardDensity,
  canInlineEdit = false,
  onInlineSaveItem,
}: SectionProps) {
  const [isMinimized, setIsMinimized] = useState(false);

  return (
    <section
      id={id}
      className={`section-shell scroll-mt-24 ${isMinimized ? "py-4 sm:py-4" : ""}`}
    >
      <MinimizableSectionHeader
        kicker="Seccion destacada"
        title={title}
        subtitle={subtitle}
        count={items.length}
        isMinimized={isMinimized}
        onToggleMinimize={() => setIsMinimized((prev) => !prev)}
      />

      {isMinimized ? null : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-amber-300/70 bg-[#f9efe5] p-6 text-sm text-[#7a614d]">
          No encontramos unidades en esta seccion. Prueba limpiar filtros o cambiar el tipo de vehiculo.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((item, index) => (
            <CatalogCard
              key={`${id}-expanded-${item.id}`}
              item={item}
              imageLoading={index < 8 ? "eager" : "lazy"}
              priceLabel={formatPrice(priceMap[getVehicleKey(item)])}
              upcomingAuctionLabel={upcomingAuctionByVehicleKey?.[getVehicleKey(item)]}
              density={cardDensity}
              onOpen={() => onOpenVehicle(item)}
              isFavorite={favoriteKeys.includes(getVehicleKey(item))}
              onToggleFavorite={() => onToggleFavorite(getVehicleKey(item))}
              isCompared={compareKeys.includes(getVehicleKey(item))}
              onToggleCompare={() => onToggleCompare(getVehicleKey(item))}
              onWhatsappClick={() =>
                trackEvent("whatsapp_click_card", {
                  section: id,
                  itemKey: getVehicleKey(item),
                })
              }
              canInlineEdit={canInlineEdit}
              editablePriceValue={priceMap[getVehicleKey(item)]}
              onInlineSave={
                onInlineSaveItem
                  ? (changes) => onInlineSaveItem(item, changes)
                  : undefined
              }
            />
          ))}
        </div>
      )}
    </section>
  );
}

type UpcomingAuctionsSectionProps = {
  groups: Array<{ auction: UpcomingAuction; items: CatalogItem[] }>;
  priceMap: Record<string, string>;
  upcomingAuctionByVehicleKey: Record<string, string>;
  favoriteKeys: string[];
  onToggleFavorite: (itemKey: string) => void;
  compareKeys: string[];
  onToggleCompare: (itemKey: string) => void;
  onOpenVehicle: (item: CatalogItem) => void;
  cardDensity: CardDensity;
  canInlineEdit?: boolean;
  onInlineSaveItem?: (
    item: CatalogItem,
    changes: { title?: string; subtitle?: string; price?: string },
  ) => void;
};

function UpcomingAuctionsSection({
  groups,
  priceMap,
  upcomingAuctionByVehicleKey,
  favoriteKeys,
  onToggleFavorite,
  compareKeys,
  onToggleCompare,
  onOpenVehicle,
  cardDensity,
  canInlineEdit = false,
  onInlineSaveItem,
}: UpcomingAuctionsSectionProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const visibleGroups = groups.filter((group) => group.items.length > 0);
  if (visibleGroups.length === 0) return null;
  const totalItems = visibleGroups.reduce((sum, group) => sum + group.items.length, 0);

  return (
    <section
      id="proximos-remates"
      className={`section-shell scroll-mt-24 ${isMinimized ? "py-4 sm:py-4" : ""}`}
    >
      <MinimizableSectionHeader
        kicker="Vitrina destacada"
        title="Destacados"
        subtitle="Unidades priorizadas y organizadas para facilitar tu decision de compra."
        count={totalItems}
        countLabel={totalItems === 1 ? "publicacion" : "publicaciones"}
        isMinimized={isMinimized}
        onToggleMinimize={() => setIsMinimized((prev) => !prev)}
      />
      {isMinimized ? null : (
      <div className="space-y-8">
        {visibleGroups.map(({ auction, items }) => (
          <div key={auction.id}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-300/70 bg-[#f4e7da] px-3 py-2">
              <h3 className="text-base font-semibold text-[#62391f]">{auction.name}</h3>
              <span className="rounded-full border border-amber-300/70 bg-[#fff8f1] px-3 py-1 text-xs font-semibold text-[#744322]">
                {formatAuctionDateLabel(auction.date)}  ·  {items.length} vehiculos
              </span>
            </div>
            <HorizontalCardsRail
              sectionKey={`proximos-remates-${auction.id}`}
              items={items}
              priceMap={priceMap}
              upcomingAuctionByVehicleKey={upcomingAuctionByVehicleKey}
              favoriteKeys={favoriteKeys}
              onToggleFavorite={onToggleFavorite}
              compareKeys={compareKeys}
              onToggleCompare={onToggleCompare}
              onOpenVehicle={onOpenVehicle}
              cardDensity={cardDensity}
              canInlineEdit={canInlineEdit}
              onInlineSaveItem={onInlineSaveItem}
            />
          </div>
        ))}
      </div>
      )}
    </section>
  );
}

type Props = {
  feed: CatalogFeed;
  initialConfig: EditorConfig;
  scrollToCatalogOnLoad?: boolean;
};

export function CatalogHomeClient({ feed, initialConfig, scrollToCatalogOnLoad = false }: Props) {
  const router = useRouter();
  const [config, setConfig] = useState<EditorConfig>(() =>
    normalizeEditorConfigClient(initialConfig),
  );
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminView, setAdminView] = useState<"editor" | "home">("home");
  const searchParams = useSearchParams();
  const [showLogin, setShowLogin] = useState(false);
  const [saving, setSaving] = useState(false);
  const [autoSaveState, setAutoSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [lastAutoSaveAt, setLastAutoSaveAt] = useState<string>("");
  const [serverSaveStatus, setServerSaveStatus] = useState<"checking" | "ready" | "offline">(
    "checking",
  );
  const [serverSaveMessage, setServerSaveMessage] = useState("");
  const [activeTypeTab, setActiveTypeTab] = useState<VehicleTypeId>("livianos");
  const [homeSearchTerm, setHomeSearchTerm] = useState("");
  const [homeSort, setHomeSort] = useState<SortOption>("recomendado");
  const [topSectionFilter, setTopSectionFilter] = useState<"all" | SectionId>("all");
  const [heroVisible, setHeroVisible] = useState(true);
  const [quickFilters, setQuickFilters] = useState<QuickFilterId[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(HOME_QUICK_FILTERS_STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as QuickFilterId[]) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [cardDensity, setCardDensity] = useState<CardDensity>(() => {
    if (typeof window === "undefined") return "detailed";
    return window.localStorage.getItem(HOME_CARD_DENSITY_STORAGE_KEY) === "compact"
      ? "compact"
      : "detailed";
  });
  const [favoriteKeys, setFavoriteKeys] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    const saved = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved) as string[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [compareKeys, setCompareKeys] = useState<string[]>([]);
  const [showComparePanel, setShowComparePanel] = useState(false);
  const [systemNotice, setSystemNotice] = useState<SystemNotice | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [adminTab, setAdminTab] = useState<AdminTabId>("vehiculos");
  const [inventorySubtab, setInventorySubtab] = useState<InventorySubtabId>("actual");
  const [auctionFilterId, setAuctionFilterId] = useState("");
  const [editorGroupFilter, setEditorGroupFilter] = useState<EditorGroupFilter>("home");
  const [editorVisibilityFilter, setEditorVisibilityFilter] =
    useState<EditorVisibilityFilter>("all");
  const [editorVehicleCategoryFilter, setEditorVehicleCategoryFilter] =
    useState<EditorVehicleCategoryFilter>("all");
  const [showEditorFiltersMenu, setShowEditorFiltersMenu] = useState(false);
  const [editorSelectedKeys, setEditorSelectedKeys] = useState<string[]>([]);
  const [showEditorBulkMenu, setShowEditorBulkMenu] = useState(false);
  const [showEditorBulkGroupMenu, setShowEditorBulkGroupMenu] = useState(false);
  const [editorPage, setEditorPage] = useState(1);
  const [editingVehicleKey, setEditingVehicleKey] = useState<string | null>(null);
  const [editingDetails, setEditingDetails] = useState<EditorVehicleDetails | null>(null);
  const [publicationModalMode, setPublicationModalMode] = useState<"create" | "edit" | null>(null);
  const [editingPublicationKey, setEditingPublicationKey] = useState<string | null>(null);
  const [publicationInitialTab, setPublicationInitialTab] = useState<"general" | "tecnica" | "medios" | "publicacion">("general");
  const [autoredLookupLoading, setAutoredLookupLoading] = useState(false);
  const [newAuctionName, setNewAuctionName] = useState("");
  const [newAuctionDate, setNewAuctionDate] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryDescription, setNewCategoryDescription] = useState("");
  const [showCreateCategoryForm, setShowCreateCategoryForm] = useState(false);
  const [createGroupKind, setCreateGroupKind] = useState<"categoria" | "remate">("categoria");
  const [editingSectionTextId, setEditingSectionTextId] = useState<SectionId | null>(null);
  const [assignCategoryId, setAssignCategoryId] = useState<string | null>(null);
  const [assignSearchTerm, setAssignSearchTerm] = useState("");
  const [finalizeAuctionId, setFinalizeAuctionId] = useState<string | null>(null);
  const [finalizeAuctionSearchTerm, setFinalizeAuctionSearchTerm] = useState("");
  const [finalizeSoldVehicleKeys, setFinalizeSoldVehicleKeys] = useState<string[]>([]);
  const [batchAssignTarget, setBatchAssignTarget] = useState<BatchAssignTarget | null>(null);
  const pendingAddStockTargetRef = useRef<BatchAssignTarget | null>(null);
  const [batchAssignSearchTerm, setBatchAssignSearchTerm] = useState("");
  const [batchAssignSelectedKeys, setBatchAssignSelectedKeys] = useState<string[]>([]);
  const [manualDraft, setManualDraft] = useState<ManualPublicationDraft>(
    EMPTY_MANUAL_PUBLICATION_DRAFT,
  );
  const [showManualCreateModal, setShowManualCreateModal] = useState(false);
  const [showBulkManualModal, setShowBulkManualModal] = useState(false);
  const [bulkDefaultSectionIds, setBulkDefaultSectionIds] = useState<SectionId[]>(["catalogo"]);
  const [manualUploadedImages, setManualUploadedImages] = useState<string[]>([]);
  const [manualUploading, setManualUploading] = useState(false);
  const [manualDropActive, setManualDropActive] = useState(false);
  const [draggedImageIndex, setDraggedImageIndex] = useState<number | null>(null);
  const manualFileInputRef = useRef<HTMLInputElement | null>(null);
  const glo3dSyncSignatureRef = useRef("");
  const [loginEmail, setLoginEmail] = useState("jpmontero@vedisaremates.cl");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [selectedVehicle, setSelectedVehicle] = useState<CatalogItem | null>(null);
  const [selectedVehicleImageIndex, setSelectedVehicleImageIndex] = useState(0);
  const [selectedVehicleLightboxIndex, setSelectedVehicleLightboxIndex] = useState<number | null>(null);
  const [selectedVehicleLightboxZoom, setSelectedVehicleLightboxZoom] = useState(1);
  const [detailEditorTab, setDetailEditorTab] = useState<DetailEditorTabId>("general");
  const [selectedVehicleTab, setSelectedVehicleTab] = useState<VehicleDetailTabId>("general");
  const vehicleTabRefs = useRef<Partial<Record<VehicleDetailTabId, HTMLButtonElement | null>>>({});
  const [inlineSummaryField, setInlineSummaryField] = useState<string | null>(null);
  const [inlineSummaryValue, setInlineSummaryValue] = useState("");
  const [inlinePriceEditing, setInlinePriceEditing] = useState(false);
  const [inlinePriceDraft, setInlinePriceDraft] = useState({
    referencePrice: "",
    originalPrice: "",
    taxFee: "",
    transferFee: "",
    promoEnabled: false,
    promoPrice: "",
  });
  const [revalidating, setRevalidating] = useState(false);
  const [inventoryUpdateProgress, setInventoryUpdateProgress] = useState("");
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>(() => feed.items);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [analyticsRangeDays, setAnalyticsRangeDays] = useState<7 | 30 | 90>(30);
  const [analyticsEvents, setAnalyticsEvents] = useState<AnalyticsEventPayload[]>([]);
  const [serverAnalyticsEvents, setServerAnalyticsEvents] = useState<AnalyticsEventPayload[]>([]);
  const [analyticsSource, setAnalyticsSource] = useState<"local" | "server">("local");
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsViewMode, setAnalyticsViewMode] = useState<"simple" | "advanced">("simple");
  const [analyticsEventFilter, setAnalyticsEventFilter] = useState("all");
  const [analyticsSectionFilter, setAnalyticsSectionFilter] = useState("all");
  const [analyticsVehicleQuery, setAnalyticsVehicleQuery] = useState("");
  const [analyticsChartType, setAnalyticsChartType] = useState<AnalyticsChartType>("bar");
  const [analyticsTimelineMetric, setAnalyticsTimelineMetric] =
    useState<AnalyticsTimelineMetric>("eventos");
  const [analyticsDateFrom, setAnalyticsDateFrom] = useState("");
  const [analyticsDateTo, setAnalyticsDateTo] = useState("");
  const [showAnalyticsScopeMenu, setShowAnalyticsScopeMenu] = useState(false);
  const [showAnalyticsChartMenu, setShowAnalyticsChartMenu] = useState(false);
  const [analyticsChartZoom, setAnalyticsChartZoom] = useState(1);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [offerForm, setOfferForm] = useState<OfferFormState>(buildEmptyOfferForm);
  const [offerSending, setOfferSending] = useState(false);
  const [offersRows, setOffersRows] = useState<OfferRecord[]>([]);
  const [offersLoading, setOffersLoading] = useState(false);
  const [offersError, setOffersError] = useState("");
  const [offersSearch, setOffersSearch] = useState("");
  const [offersSearchField, setOffersSearchField] = useState<OfferFilterField>("all");
  const [offersVehicleFilter, setOffersVehicleFilter] = useState("all");
  const [offersClientFilter, setOffersClientFilter] = useState("all");
  const [offersDateFrom, setOffersDateFrom] = useState("");
  const [offersDateTo, setOffersDateTo] = useState("");
  const [showOffersFiltersMenu, setShowOffersFiltersMenu] = useState(false);
  const [soldSearch, setSoldSearch] = useState("");
  const [soldSearchField, setSoldSearchField] = useState<SoldFilterField>("all");
  const [soldAuctionFilter, setSoldAuctionFilter] = useState("all");
  const [soldDateFrom, setSoldDateFrom] = useState("");
  const [soldDateTo, setSoldDateTo] = useState("");
  const [showSoldFiltersMenu, setShowSoldFiltersMenu] = useState(false);
  const [pendingRevertSale, setPendingRevertSale] = useState<SoldVehicleRecord | null>(null);
  const [draggedLayoutSectionId, setDraggedLayoutSectionId] = useState<HomeSectionOrderId | null>(null);
  const [activeHeroRichEditor, setActiveHeroRichEditor] = useState<"kicker" | "title" | "subtitle">("subtitle");
  const [isDownloadingCalendarPdf, setIsDownloadingCalendarPdf] = useState(false);
  const [showHomeFiltersPanel, setShowHomeFiltersPanel] = useState(false);
  const [catalogSectionMinimized, setCatalogSectionMinimized] = useState(false);
  const homeSearchShellRef = useRef<HTMLDivElement | null>(null);
  const [heroToolbarState, setHeroToolbarState] = useState(() => ({
    formatBlock: "p" as "p" | "h2" | "h3",
    fontFamily: "Inter",
    fontSize: "16px",
    foreColor: "#0f172a",
    hiliteColor: "#ffffff",
    bold: false,
    italic: false,
    underline: false,
    align: "left" as "left" | "center" | "right",
    unorderedList: false,
    orderedList: false,
  }));
  const [countdownNowMs, setCountdownNowMs] = useState(() => Date.now());
  const manualObservationsEditorRef = useRef<HTMLDivElement | null>(null);
  const heroKickerEditorRef = useRef<HTMLDivElement | null>(null);
  const heroTitleEditorRef = useRef<HTMLDivElement | null>(null);
  const heroSubtitleEditorRef = useRef<HTMLDivElement | null>(null);
  const heroSavedSelectionRef = useRef<Range | null>(null);
  const heroSavedSelectionEditorRef = useRef<"kicker" | "title" | "subtitle" | null>(null);
  const [observationsTemplateHtml, setObservationsTemplateHtml] = useState(
    DEFAULT_OBSERVATIONS_TEMPLATE_HTML,
  );
  const autoSaveReadyRef = useRef(false);
  const lastPersistedConfigRef = useRef("");
  const previousAdminViewRef = useRef<"editor" | "home">("home");

  const editingValidationErrors = useMemo(() => {
    const errors: Partial<Record<keyof EditorVehicleDetails, string>> = {};
    if (!editingDetails) return errors;

    const binaryFields: Array<keyof EditorVehicleDetails> = [
      "llaves",
      "aireAcondicionado",
      "unicoPropietario",
      "condicionado",
      "pruebaMotor",
      "pruebaDesplazamiento",
    ];
    for (const field of binaryFields) {
      if (!isValidBinaryValue(String(editingDetails[field] ?? ""))) {
        errors[field] = "Usa SI o NO.";
      }
    }

    const dateFields: Array<keyof EditorVehicleDetails> = [
      "auctionDate",
      "vencRevisionTecnica",
      "vencPermisoCirculacion",
      "vencSeguroObligatorio",
    ];
    for (const field of dateFields) {
      if (!isValidDateValue(String(editingDetails[field] ?? ""))) {
        errors[field] = "Formato valido: YYYY-MM-DD o DD/MM/YYYY.";
      }
    }

    return errors;
  }, [editingDetails]);

  const setEditingDetailField = (
    field: keyof EditorVehicleDetails,
    value: string,
  ) => {
    setEditingDetails((prev) => ({ ...(prev ?? {}), [field]: value }));
  };

  const getEditorInputClass = (field: keyof EditorVehicleDetails): string =>
    `rounded border px-3 py-2 text-sm ${
      editingValidationErrors[field]
        ? "border-rose-400 bg-rose-50"
        : "border-slate-300"
    }`;

  const getEditorFieldError = (field: keyof EditorVehicleDetails): string | null =>
    editingValidationErrors[field] ?? null;

  const blockingValidationErrors = useMemo(() => {
    if (detailEditorTab === "general") {
      const errors: Partial<Record<keyof EditorVehicleDetails, string>> = {};
      if (editingValidationErrors.auctionDate) {
        errors.auctionDate = editingValidationErrors.auctionDate;
      }
      return errors;
    }
    const errors = { ...editingValidationErrors };
    delete errors.auctionDate;
    return errors;
  }, [detailEditorTab, editingValidationErrors]);

  const syncManualObservations = useCallback((html: string) => {
    const text = stripHtmlToText(html);
    setEditingDetails((prev) => ({
      ...(prev ?? {}),
      extendedDescription: html,
      description: text,
    }));
  }, []);

  const runObservationsCommand = useCallback((command: string, value?: string) => {
    const editor = manualObservationsEditorRef.current;
    if (!editor || typeof document === "undefined") return;
    editor.focus();
    document.execCommand("styleWithCSS", false, "true");
    document.execCommand(command, false, value);
    syncManualObservations(editor.innerHTML);
  }, [syncManualObservations]);

  const applyObservationsTemplate = useCallback((html: string) => {
    const editor = manualObservationsEditorRef.current;
    if (!editor) return;
    editor.innerHTML = html;
    syncManualObservations(html);
  }, [syncManualObservations]);

  useEffect(() => {
    if (!editingDetails || detailEditorTab !== "general") return;
    const editor = manualObservationsEditorRef.current;
    if (!editor) return;
    const desiredHtml =
      editingDetails.extendedDescription?.trim() ||
      escapeHtml(editingDetails.description ?? "").replace(/\n/g, "<br />");
    const normalized = desiredHtml || "";
    if (editor.innerHTML !== normalized) {
      editor.innerHTML = normalized;
    }
  }, [editingVehicleKey, detailEditorTab, editingDetails]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(OBSERVATIONS_TEMPLATE_STORAGE_KEY);
    if (saved?.trim()) {
      setObservationsTemplateHtml(saved);
    }
  }, []);

  useEffect(() => {
    if (searchParams.get("login") !== "1" || isAdmin) return;
    setShowLogin(true);
    trackEvent("login_modal_open");
  }, [searchParams, isAdmin]);

  const getActiveHeroEditor = useCallback(() => (
    activeHeroRichEditor === "kicker"
      ? heroKickerEditorRef.current
      : activeHeroRichEditor === "title"
      ? heroTitleEditorRef.current
      : heroSubtitleEditorRef.current
  ), [activeHeroRichEditor]);

  const rememberHeroSelection = useCallback(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    const anchorNode = selection.anchorNode;
    const anchorElement =
      anchorNode && anchorNode.nodeType === Node.ELEMENT_NODE
        ? (anchorNode as Element)
        : anchorNode?.parentElement ?? null;
    const kickerEditor = heroKickerEditorRef.current;
    const titleEditor = heroTitleEditorRef.current;
    const subtitleEditor = heroSubtitleEditorRef.current;
    const editorType = kickerEditor && anchorElement && kickerEditor.contains(anchorElement)
      ? "kicker"
      : titleEditor && anchorElement && titleEditor.contains(anchorElement)
        ? "title"
        : subtitleEditor && anchorElement && subtitleEditor.contains(anchorElement)
          ? "subtitle"
          : null;
    if (!editorType) return;
    heroSavedSelectionRef.current = range.cloneRange();
    heroSavedSelectionEditorRef.current = editorType;
  }, []);

  const syncHeroToolbarState = useCallback(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      rememberHeroSelection();
    }
    const kickerEditor = heroKickerEditorRef.current;
    const titleEditor = heroTitleEditorRef.current;
    const subtitleEditor = heroSubtitleEditorRef.current;
    const anchorNode = selection?.anchorNode ?? null;
    const anchorElement =
      anchorNode && anchorNode.nodeType === Node.ELEMENT_NODE
        ? (anchorNode as Element)
        : anchorNode?.parentElement ?? null;
    const isInKicker = Boolean(kickerEditor && anchorElement && kickerEditor.contains(anchorElement));
    const isInTitle = Boolean(titleEditor && anchorElement && titleEditor.contains(anchorElement));
    const isInSubtitle = Boolean(subtitleEditor && anchorElement && subtitleEditor.contains(anchorElement));
    if (isInKicker && activeHeroRichEditor !== "kicker") {
      setActiveHeroRichEditor("kicker");
    } else if (isInTitle && activeHeroRichEditor !== "title") {
      setActiveHeroRichEditor("title");
    } else if (isInSubtitle && activeHeroRichEditor !== "subtitle") {
      setActiveHeroRichEditor("subtitle");
    }
    const editor =
      (
        isInKicker
          ? kickerEditor
          : isInTitle
            ? titleEditor
            : isInSubtitle
              ? subtitleEditor
              : getActiveHeroEditor()
      ) ?? titleEditor;
    if (!editor) return;
    const styleTarget = (anchorElement && editor.contains(anchorElement))
      ? anchorElement
      : editor;
    const computedStyle = window.getComputedStyle(styleTarget);
    const formatBlockRaw = String(document.queryCommandValue("formatBlock") ?? "")
      .replace(/[<>]/g, "")
      .toLowerCase();
    const formatBlock: "p" | "h2" | "h3" =
      formatBlockRaw === "h2" || formatBlockRaw === "h3" ? formatBlockRaw : "p";
    const align: "left" | "center" | "right" =
      document.queryCommandState("justifyCenter")
        ? "center"
        : document.queryCommandState("justifyRight")
          ? "right"
          : "left";
    const fontNameFromCommand = String(document.queryCommandValue("fontName") ?? "").trim();
    const nextState = {
      formatBlock,
      fontFamily: normalizeFontFamilyName(fontNameFromCommand || computedStyle.fontFamily),
      fontSize: computedStyle.fontSize || "16px",
      foreColor: normalizeCssColorToHex(
        String(document.queryCommandValue("foreColor") || computedStyle.color),
      ),
      hiliteColor: normalizeCssColorToHex(
        String(
          document.queryCommandValue("hiliteColor") ||
          document.queryCommandValue("backColor") ||
          computedStyle.backgroundColor ||
          "#ffffff",
        ),
      ),
      bold: Boolean(document.queryCommandState("bold")),
      italic: Boolean(document.queryCommandState("italic")),
      underline: Boolean(document.queryCommandState("underline")),
      align,
      unorderedList: Boolean(document.queryCommandState("insertUnorderedList")),
      orderedList: Boolean(document.queryCommandState("insertOrderedList")),
    };
    setHeroToolbarState((prev) =>
      JSON.stringify(prev) === JSON.stringify(nextState) ? prev : nextState,
    );
  }, [activeHeroRichEditor, getActiveHeroEditor, rememberHeroSelection]);

  const runHeroHtmlCommand = useCallback((command: string, value?: string) => {
    const editor =
      getActiveHeroEditor();
    if (!editor || typeof window === "undefined" || typeof document === "undefined") return;
    editor.focus();
    const selection = window.getSelection();
    if (
      selection &&
      heroSavedSelectionRef.current &&
      heroSavedSelectionEditorRef.current === activeHeroRichEditor
    ) {
      selection.removeAllRanges();
      selection.addRange(heroSavedSelectionRef.current);
    }
    // Fallback UX: if no text is selected, color/background affects full current block.
    const currentSelection = window.getSelection();
    if (
      (command === "foreColor" || command === "hiliteColor" || command === "backColor") &&
      (!currentSelection || currentSelection.rangeCount === 0 || currentSelection.isCollapsed)
    ) {
      const fallbackRange = document.createRange();
      fallbackRange.selectNodeContents(editor);
      currentSelection?.removeAllRanges();
      currentSelection?.addRange(fallbackRange);
    }
    const applyInlineStyleToSelection = (cssProperty: "color" | "backgroundColor", cssValue: string) => {
      const activeSelection = window.getSelection();
      const activeRange = activeSelection && activeSelection.rangeCount > 0
        ? activeSelection.getRangeAt(0)
        : null;
      const hasTextSelection = Boolean(
        activeRange &&
        !activeRange.collapsed &&
        editor.contains(activeRange.commonAncestorContainer),
      );
      if (hasTextSelection && activeRange) {
        const fragment = activeRange.extractContents();
        const span = document.createElement("span");
        span.style.setProperty(cssProperty, cssValue);
        span.appendChild(fragment);
        activeRange.insertNode(span);
        const newRange = document.createRange();
        newRange.selectNodeContents(span);
        activeSelection?.removeAllRanges();
        activeSelection?.addRange(newRange);
        return;
      }
      editor.style.setProperty(cssProperty, cssValue);
    };

    document.execCommand("styleWithCSS", false, "true");
    if (command === "foreColor" && value) {
      applyInlineStyleToSelection("color", value);
    } else if ((command === "hiliteColor" || command === "backColor") && value) {
      applyInlineStyleToSelection("backgroundColor", value);
    } else {
      document.execCommand(command, false, value);
    }
    rememberHeroSelection();
    setConfig((prev) => ({
      ...prev,
      homeLayout: {
        ...prev.homeLayout,
        [activeHeroRichEditor === "kicker"
          ? "heroKicker"
          : activeHeroRichEditor === "title"
            ? "heroTitle"
            : "heroDescription"]: editor.innerHTML,
      },
    }));
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => syncHeroToolbarState());
    }
  }, [activeHeroRichEditor, getActiveHeroEditor, rememberHeroSelection, syncHeroToolbarState]);

  useEffect(() => {
    if (adminTab !== "layout" || typeof document === "undefined") return;
    const handleSelectionChange = () => syncHeroToolbarState();
    document.addEventListener("selectionchange", handleSelectionChange);
    return () => document.removeEventListener("selectionchange", handleSelectionChange);
  }, [adminTab, syncHeroToolbarState]);

  useEffect(() => {
    if (adminTab !== "layout") return;
    const kickerEditor = heroKickerEditorRef.current;
    if (kickerEditor) {
      const normalizedKicker = formatHomeHeroHtml(config.homeLayout.heroKicker);
      const isEditingKicker =
        typeof document !== "undefined" && document.activeElement === kickerEditor;
      if (!isEditingKicker && kickerEditor.innerHTML !== normalizedKicker) {
        kickerEditor.innerHTML = normalizedKicker;
      }
    }
    const titleEditor = heroTitleEditorRef.current;
    if (titleEditor) {
      const normalizedTitle = formatHomeHeroHtml(config.homeLayout.heroTitle);
      const isEditingTitle =
        typeof document !== "undefined" && document.activeElement === titleEditor;
      if (!isEditingTitle && titleEditor.innerHTML !== normalizedTitle) {
        titleEditor.innerHTML = normalizedTitle;
      }
    }
    const subtitleEditor = heroSubtitleEditorRef.current;
    if (subtitleEditor) {
      const normalizedSubtitle = formatHomeHeroHtml(config.homeLayout.heroDescription);
      const isEditingSubtitle =
        typeof document !== "undefined" && document.activeElement === subtitleEditor;
      if (!isEditingSubtitle && subtitleEditor.innerHTML !== normalizedSubtitle) {
        subtitleEditor.innerHTML = normalizedSubtitle;
      }
    }
    syncHeroToolbarState();
  }, [
    adminTab,
    config.homeLayout.heroKicker,
    config.homeLayout.heroTitle,
    config.homeLayout.heroDescription,
    syncHeroToolbarState,
  ]);

  const heroToolbarIconButtonClass = useCallback((isActive: boolean) => (
    `ui-focus inline-flex h-8 w-8 items-center justify-center rounded border transition ${
      isActive
        ? "border-amber-400 bg-stone-200 text-amber-900"
        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
    }`
  ), []);

  const rawItems = catalogItems;

  useEffect(() => {
    setCatalogItems(feed.items);
  }, [feed.items]);
  const updateVehicleUrlParam = useCallback((vehicleKey?: string) => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (vehicleKey) {
      url.searchParams.set("vehiculo", vehicleKey);
      if (!url.hash) url.hash = "catalogo";
    } else {
      url.searchParams.delete("vehiculo");
    }
    window.history.replaceState(null, "", url.toString());
  }, []);
  const openVehicleDetail = useCallback(
    (item: CatalogItem) => {
      setSelectedVehicle(item);
      updateVehicleUrlParam(getVehicleKey(item));
      trackEvent("vehicle_detail_open", {
        itemKey: getVehicleKey(item),
        section: topSectionFilter,
      });
    },
    [updateVehicleUrlParam, topSectionFilter],
  );
  const closeSelectedVehicle = useCallback(() => {
    setSelectedVehicle(null);
    updateVehicleUrlParam();
  }, [updateVehicleUrlParam]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeSelectedVehicle();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeSelectedVehicle]);

  useEffect(() => {
    setSelectedVehicleImageIndex(0);
  }, [selectedVehicle]);

  useEffect(() => {
    if (!selectedVehicle || typeof window === "undefined") return;
    const scrollY = window.scrollY;
    const { style } = document.body;
    const previous = {
      position: style.position,
      top: style.top,
      width: style.width,
      overflow: style.overflow,
    };
    style.position = "fixed";
    style.top = `-${scrollY}px`;
    style.width = "100%";
    style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      style.position = previous.position;
      style.top = previous.top;
      style.width = previous.width;
      style.overflow = previous.overflow;
      document.documentElement.style.overflow = "";
      window.scrollTo({ top: scrollY, behavior: "auto" });
    };
  }, [selectedVehicle]);

  useEffect(() => {
    if (selectedVehicle) return;
    setShowOfferModal(false);
    setOfferForm(buildEmptyOfferForm());
    setOfferSending(false);
  }, [selectedVehicle]);

  useEffect(() => {
    if (!showOfferModal) return;
    const selectedKey = selectedVehicle ? getVehicleKey(selectedVehicle) : "";
    const selectedPriceLabel = selectedKey ? formatPrice(config.vehiclePrices[selectedKey]) : null;
    const selectedReferenceAmount = parseCurrencyAmount(selectedPriceLabel);
    if (selectedReferenceAmount <= 0) return;
    setOfferForm((prev) => {
      if (prev.offerAmount.trim()) return prev;
      return { ...prev, offerAmount: formatCurrencyAmount(selectedReferenceAmount) };
    });
  }, [showOfferModal, selectedVehicle, config.vehiclePrices]);

  const verifyServerPersistence = useCallback(async () => {
    setServerSaveStatus("checking");
    setServerSaveMessage("");
    try {
      const response = await fetch("/api/admin/editor-config/health", {
        cache: "no-store",
        credentials: "include",
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        if (response.status === 401) {
          setIsAdmin(false);
          setAdminView("home");
          setShowLogin(true);
        }
        const errorMessage =
          payload.error ??
          "No se pudo conectar con el guardado global en servidor. Los cambios se guardan en este navegador.";
        setServerSaveStatus("offline");
        setServerSaveMessage(errorMessage);
        setAutoSaveState("error");
        return { ok: false as const, error: errorMessage };
      }
      setServerSaveStatus("ready");
      setServerSaveMessage("");
      setAutoSaveState("idle");
      return { ok: true as const };
    } catch {
      const errorMessage =
        "Sin conexion al guardado global. Los cambios se guardan en este navegador hasta recuperar el servidor.";
      setServerSaveStatus("offline");
      setServerSaveMessage(errorMessage);
      setAutoSaveState("error");
      return { ok: false as const, error: errorMessage };
    }
  }, []);

  useEffect(() => {
    void (async () => {
      let localFallbackConfig: EditorConfig | null = null;
      try {
        const local = localStorage.getItem(EDITOR_STORAGE_KEY);
        if (local) {
          const parsed = JSON.parse(local) as Partial<EditorConfig>;
          localFallbackConfig = normalizeEditorConfigClient(parsed);
        }

        const sessionRes = await fetch("/api/admin/session", {
          cache: "no-store",
          credentials: "include",
        });
        const session = (await sessionRes.json()) as { loggedIn?: boolean };
        const loggedIn = Boolean(session.loggedIn);
        setIsAdmin(loggedIn);
        setAdminView("home");

        let resolvedConfig = localFallbackConfig ?? normalizeEditorConfigClient(initialConfig);
        const configRes = await fetch("/api/admin/editor-config", {
          cache: "no-store",
          credentials: "include",
        });
        if (configRes.ok) {
          const payload = (await configRes.json()) as { config?: EditorConfig };
          if (payload.config) {
            const normalized = normalizeEditorConfigClient(payload.config);
            resolvedConfig = normalized;
            setConfig(normalized);
            localStorage.setItem(EDITOR_STORAGE_KEY, JSON.stringify(normalized));
          }
        }
        if (!configRes.ok && localFallbackConfig) {
          resolvedConfig = localFallbackConfig;
          setConfig(localFallbackConfig);
        } else if (!configRes.ok && !localFallbackConfig) {
          setConfig(resolvedConfig);
        }

        if (loggedIn) {
          await verifyServerPersistence();
        } else {
          setServerSaveStatus("checking");
          setServerSaveMessage("");
        }
      } finally {
        setIsBootstrapping(false);
      }
    })();
  }, [initialConfig, verifyServerPersistence]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setHeroVisible(false);
      if (typeof window !== "undefined" && window.location.hash === "#catalogo") {
        window.requestAnimationFrame(() => {
          document.getElementById("catalogo")?.scrollIntoView({ block: "start" });
        });
      }
    }, 20_000);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const closeOpenMenus = (target: EventTarget | null) => {
      const openDetails = Array.from(
        document.querySelectorAll<HTMLDetailsElement>("details[open]"),
      );
      for (const detail of openDetails) {
        if (target instanceof Node && detail.contains(target)) continue;
        detail.removeAttribute("open");
      }
    };

    const onPointerDown = (event: globalThis.MouseEvent | globalThis.TouchEvent) => {
      closeOpenMenus(event.target);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      closeOpenMenus(null);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown, { passive: true });
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favoriteKeys));
  }, [favoriteKeys]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(HOME_QUICK_FILTERS_STORAGE_KEY, JSON.stringify(quickFilters));
  }, [quickFilters]);

  useEffect(() => {
    if (!showHomeFiltersPanel) return;
    const handlePointerDown = (event: Event) => {
      if (homeSearchShellRef.current?.contains(event.target as Node)) return;
      setShowHomeFiltersPanel(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [showHomeFiltersPanel]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(HOME_CARD_DENSITY_STORAGE_KEY, cardDensity);
  }, [cardDensity]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const loadEvents = () => {
      try {
        const raw = window.localStorage.getItem(ANALYTICS_STORAGE_KEY);
        const parsed = raw ? (JSON.parse(raw) as AnalyticsEventPayload[]) : [];
        setAnalyticsEvents(Array.isArray(parsed) ? parsed : []);
      } catch {
        setAnalyticsEvents([]);
      }
    };
    loadEvents();
    const onStorage = (event: StorageEvent) => {
      if (event.key === ANALYTICS_STORAGE_KEY) loadEvents();
    };
    const onAnalyticsUpdated = () => loadEvents();
    window.addEventListener("storage", onStorage);
    window.addEventListener("vedisa-analytics-updated", onAnalyticsUpdated);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("vedisa-analytics-updated", onAnalyticsUpdated);
    };
  }, []);

  useEffect(() => {
    const shouldLoadServerAnalytics = isAdmin && adminView === "editor" && adminTab === "analytics";
    if (!shouldLoadServerAnalytics) return;
    let cancelled = false;
    const fetchServerAnalytics = async () => {
      setAnalyticsLoading(true);
      try {
        const response = await fetch(
          `/api/admin/analytics?days=${analyticsRangeDays}&limit=5000`,
          { cache: "no-store" },
        );
        if (!response.ok) {
          if (!cancelled) {
            setAnalyticsSource("local");
            setServerAnalyticsEvents([]);
          }
          return;
        }
        const payload = (await response.json()) as {
          ok?: boolean;
          events?: AnalyticsEventPayload[];
        };
        if (!cancelled && payload.ok && Array.isArray(payload.events)) {
          setServerAnalyticsEvents(payload.events);
          setAnalyticsSource("server");
        } else if (!cancelled) {
          setAnalyticsSource("local");
          setServerAnalyticsEvents([]);
        }
      } catch {
        if (!cancelled) {
          setAnalyticsSource("local");
          setServerAnalyticsEvents([]);
        }
      } finally {
        if (!cancelled) setAnalyticsLoading(false);
      }
    };
    void fetchServerAnalytics();
    return () => {
      cancelled = true;
    };
  }, [isAdmin, adminView, adminTab, analyticsRangeDays]);

  useEffect(() => {
    const shouldLoadOffers = isAdmin && adminView === "editor" && adminTab === "ofertas";
    if (!shouldLoadOffers) return;
    let cancelled = false;
    const fetchOffers = async () => {
      setOffersLoading(true);
      setOffersError("");
      try {
        const response = await fetch("/api/admin/offers?limit=5000", {
          cache: "no-store",
          credentials: "include",
        });
        const payload = (await response.json().catch(() => ({}))) as {
          ok?: boolean;
          offers?: OfferRecord[];
          error?: string;
        };
        if (!response.ok || !payload.ok || !Array.isArray(payload.offers)) {
          if (!cancelled) {
            if (response.status === 401) {
              setIsAdmin(false);
              setAdminView("home");
              setShowLogin(true);
              showSystemNotice(
                "error",
                "Sesion expirada",
                "Tu sesion de administrador expiro. Inicia sesion nuevamente para ver ofertas y guardar cambios en servidor.",
              );
            }
            setOffersRows([]);
            setOffersError(payload.error ?? "No se pudieron cargar las ofertas.");
          }
          return;
        }
        if (!cancelled) {
          setOffersRows(payload.offers);
        }
      } catch {
        if (!cancelled) {
          setOffersRows([]);
          setOffersError("No se pudieron cargar las ofertas.");
        }
      } finally {
        if (!cancelled) setOffersLoading(false);
      }
    };
    void fetchOffers();
    return () => {
      cancelled = true;
    };
  }, [isAdmin, adminView, adminTab]);

  useEffect(() => {
    if (adminTab !== "vehiculos" || inventorySubtab !== "vendidas") {
      setShowSoldFiltersMenu(false);
      setPendingRevertSale(null);
    }
  }, [adminTab, inventorySubtab]);

  useEffect(() => {
    if (adminTab !== "analytics") {
      setShowAnalyticsScopeMenu(false);
      setShowAnalyticsChartMenu(false);
    }
  }, [adminTab]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hasPersistedDensity = window.localStorage.getItem(HOME_CARD_DENSITY_STORAGE_KEY);
    if (hasPersistedDensity) return;
    setCardDensity(config.homeLayout.defaultCardDensity);
  }, [config.homeLayout.defaultCardDensity]);

  useEffect(() => {
    trackEvent("page_view_home", { mode: "catalogo" });
  }, []);

  useEffect(() => {
    if (!scrollToCatalogOnLoad || typeof window === "undefined") return;
    setHeroVisible(false);
    window.requestAnimationFrame(() => {
      document.getElementById("catalogo")?.scrollIntoView({ block: "start" });
    });
  }, [scrollToCatalogOnLoad]);

  useEffect(() => {
    if (!systemNotice) return;
    const timeout = window.setTimeout(() => setSystemNotice(null), 3200);
    return () => window.clearTimeout(timeout);
  }, [systemNotice]);

  const showSystemNotice = useCallback(
    (tone: SystemNotice["tone"], title: string, message: string) => {
      setSystemNotice({ id: Date.now(), tone, title, message });
    },
    [],
  );

  const manualItems = useMemo(
    () => (config.manualPublications ?? []).map(mapManualPublicationToCatalogItem),
    [config.manualPublications],
  );

  const manualItemsForDisplay = useMemo(
    () => filterManualItemsWithoutGloDuplicate(manualItems, rawItems),
    [manualItems, rawItems],
  );

  const items = useMemo(
    () =>
      [...rawItems, ...manualItemsForDisplay].map((item) =>
        applyDetailsOverride(item, config.vehicleDetails[getVehicleKey(item)]),
      ),
    [rawItems, manualItemsForDisplay, config.vehicleDetails],
  );

  const itemsByKey = useMemo(() => {
    const map = new Map<string, CatalogItem>();
    for (const item of items) {
      map.set(getVehicleKey(item), item);
    }
    return map;
  }, [items]);

  const existingPatents = useMemo(() => {
    const set = new Set<string>();
    for (const item of items) {
      const patent = normalizePatentToken(getPatent(item));
      if (patent && patent !== "-") set.add(patent);
    }
    for (const manual of config.manualPublications ?? []) {
      const patent = normalizePatentToken(manual.patente ?? "");
      if (patent) set.add(patent);
    }
    return set;
  }, [items, config.manualPublications]);

  useEffect(() => {
    if (itemsByKey.size === 0) return;
    setConfig((prev) => {
      let changed = false;
      const nextSectionVehicleIds = { ...prev.sectionVehicleIds };
      for (const sectionId of PUBLICATION_SECTION_IDS) {
        const canonical = Array.from(
          new Set(
            (prev.sectionVehicleIds[sectionId] ?? [])
              .map((id) => resolveInventoryItemKey(id, itemsByKey) ?? id)
              .filter(Boolean),
          ),
        );
        const previous = prev.sectionVehicleIds[sectionId] ?? [];
        if (
          canonical.length !== previous.length ||
          canonical.some((id, index) => id !== previous[index])
        ) {
          changed = true;
          nextSectionVehicleIds[sectionId] = canonical;
        }
      }
      if (!changed) return prev;
      return { ...prev, sectionVehicleIds: nextSectionVehicleIds };
    });
  }, [itemsByKey]);

  const soldVehicleIdsSet = useMemo(
    () => new Set(config.soldVehicleIds ?? []),
    [config.soldVehicleIds],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (itemsByKey.size === 0) return;
    if (selectedVehicle) return;
    const requestedKey = new URLSearchParams(window.location.search).get("vehiculo");
    if (!requestedKey) return;
    const directMatch = itemsByKey.get(requestedKey);
    const normalizedMatch =
      directMatch ??
      itemsByKey.get(requestedKey.toUpperCase()) ??
      itemsByKey.get(requestedKey.toLowerCase());
    if (normalizedMatch) setSelectedVehicle(normalizedMatch);
  }, [itemsByKey, selectedVehicle]);

  const mergedHiddenVehicleIds = useMemo(() => {
    const set = new Set<string>();
    for (const id of config.hiddenVehicleIds) {
      registerHiddenKeyAliases(set, id, itemsByKey);
    }
    for (const soldVehicleId of config.soldVehicleIds ?? []) {
      registerHiddenKeyAliases(set, soldVehicleId, itemsByKey);
    }
    for (const manual of config.manualPublications ?? []) {
      if (!manual.visible) registerHiddenKeyAliases(set, getManualPublicationKey(manual), itemsByKey);
    }
    return set;
  }, [config.hiddenVehicleIds, config.manualPublications, config.soldVehicleIds, itemsByKey]);

  const activeInventoryItems = useMemo(
    () => items.filter((item) => !soldVehicleIdsSet.has(getVehicleKey(item))),
    [items, soldVehicleIdsSet],
  );

  const visibleItems = useMemo(
    () => activeInventoryItems.filter((item) => !mergedHiddenVehicleIds.has(getVehicleKey(item))),
    [activeInventoryItems, mergedHiddenVehicleIds],
  );

  const homeFilteredItems = useMemo(() => {
    const query = normalizeText(homeSearchTerm);
    if (!query) return visibleItems;
    const patentTokens = extractPatentTokens(homeSearchTerm);
    if (patentTokens.length > 0) {
      return visibleItems.filter((item) => {
        const itemPatent = normalizePatentToken(getPatent(item));
        if (itemPatent !== "-") {
          return patentTokens.includes(itemPatent);
        }
        return patentTokens.includes(normalizePatentToken(getVehicleKey(item)));
      });
    }
    return visibleItems.filter((item) => {
      const raw = item.raw as Record<string, unknown>;
      const source = [
        item.title,
        getVehicleDisplayTitle(item),
        item.subtitle,
        item.status,
        item.location,
        item.lot,
        raw.patente,
        raw.PATENTE,
        raw.PPU,
        raw.stock_number,
        raw.marca,
        raw.brand,
        raw.modelo,
        raw.model,
        raw.ano,
        raw.anio,
        raw.year,
        raw.version,
        raw.categoria,
        raw.tipo_vehiculo,
        inferVehicleType(item),
      ]
        .filter((value) => typeof value === "string" || typeof value === "number")
        .join(" ");
      return fuzzyMatches(normalizeText(source), query);
    });
  }, [visibleItems, homeSearchTerm]);

  const homeQuickFilteredItems = useMemo(() => {
    const byTopSection =
      topSectionFilter === "all"
        ? homeFilteredItems
        : homeFilteredItems.filter((item) => {
            const key = getVehicleKey(item);
            if (topSectionFilter === "proximos-remates") {
              return Boolean(config.vehicleUpcomingAuctionIds[key]);
            }
            return isVehicleInAssignmentList(config.sectionVehicleIds[topSectionFilter] ?? [], key);
          });
    if (quickFilters.length === 0) return byTopSection;
    return byTopSection.filter((item) => {
      const key = getVehicleKey(item);
      const vehicleType = inferVehicleType(item);
      const isManual = String((item.raw as Record<string, unknown>).source ?? "") === "manual";
      const detailsCategory = normalizeVehicleCategoryValue(config.vehicleDetails[key]?.category);
      const inferredCategory = inferVehicleCategoryForAdmin(item);
      const isOtrosCategory =
        detailsCategory.length > 0 ? detailsCategory === "otros" : inferredCategory === "otros";
      for (const filter of quickFilters) {
        if (filter === "livianos" && vehicleType !== "livianos") return false;
        if (filter === "pesados" && vehicleType !== "pesados") return false;
        if (filter === "con3d" && !item.view3dUrl) return false;
        if (filter === "conPrecio" && !formatPrice(config.vehiclePrices[key])) return false;
        if (filter === "recientes" && !isRecentAuctionDate(item.auctionDate)) return false;
        if (filter === "manuales" && !isManual) return false;
        if (filter === "proximoRemate" && !config.vehicleUpcomingAuctionIds[key]) return false;
        if (filter === "categoriaOtros" && !isOtrosCategory) return false;
      }
      return true;
    });
  }, [
    homeFilteredItems,
    topSectionFilter,
    quickFilters,
    config.vehiclePrices,
    config.vehicleDetails,
    config.vehicleUpcomingAuctionIds,
    config.sectionVehicleIds,
  ]);

  const homeVisibleItems = useMemo(() => {
    const sorted = [...homeQuickFilteredItems];
    if (homeSort === "recomendado") {
      sorted.sort((a, b) => {
        const score = (item: CatalogItem): number => {
          const key = getVehicleKey(item);
          const hasPrice = formatPrice(config.vehiclePrices[key]) ? 1 : 0;
          const has3d = item.view3dUrl ? 1 : 0;
          const isRecent = isRecentAuctionDate(item.auctionDate) ? 1 : 0;
          const isFav = favoriteKeys.includes(key) ? 1 : 0;
          return hasPrice * 3 + has3d * 2 + isRecent + isFav;
        };
        return score(b) - score(a);
      });
      return sorted;
    }
    if (homeSort === "fecha-remate") {
      sorted.sort(
        (a, b) =>
          new Date(b.auctionDate ?? "1900-01-01").getTime() -
          new Date(a.auctionDate ?? "1900-01-01").getTime(),
      );
      return sorted;
    }
    if (homeSort === "precio-asc") {
      sorted.sort(
        (a, b) =>
          getPriceAmount(config.vehiclePrices[getVehicleKey(a)]) -
          getPriceAmount(config.vehiclePrices[getVehicleKey(b)]),
      );
      return sorted;
    }
    if (homeSort === "precio-desc") {
      sorted.sort(
        (a, b) =>
          getPriceAmount(config.vehiclePrices[getVehicleKey(b)]) -
          getPriceAmount(config.vehiclePrices[getVehicleKey(a)]),
      );
      return sorted;
    }
    if (homeSort === "titulo") {
      sorted.sort((a, b) => a.title.localeCompare(b.title, "es"));
      return sorted;
    }
    return sorted;
  }, [homeQuickFilteredItems, homeSort, config.vehiclePrices, favoriteKeys]);

  const homeVisibleKeys = useMemo(
    () => new Set(homeVisibleItems.map((item) => getVehicleKey(item))),
    [homeVisibleItems],
  );
  const hiddenHomeCategoryIds = useMemo(
    () => new Set(config.hiddenCategoryIds ?? []),
    [config.hiddenCategoryIds],
  );

  const getAssignedSectionItems = useCallback(
    (sectionId: SectionId, options?: { visibleOnly?: boolean }): CatalogItem[] => {
      const selected = config.sectionVehicleIds[sectionId] ?? [];
      const resolved = selected
        .map((id) => resolveInventoryItem(id, itemsByKey))
        .filter((item): item is CatalogItem => !!item);
      if (!options?.visibleOnly) return resolved;
      return resolved.filter((item) => !mergedHiddenVehicleIds.has(getVehicleKey(item)));
    },
    [config.sectionVehicleIds, itemsByKey, mergedHiddenVehicleIds],
  );

  const getSectionItems = (sectionId: SectionId): CatalogItem[] =>
    getAssignedSectionItems(sectionId, { visibleOnly: true });

  const upcomingAuctionByVehicleKey = useMemo(() => {
    if (!AUCTION_ADMIN_ENABLED) return {} as Record<string, string>;
    const labels: Record<string, string> = {};
    const auctionsById = new Map(
      (config.upcomingAuctions ?? []).map((auction) => [auction.id, auction] as const),
    );
    for (const [vehicleKey, auctionId] of Object.entries(config.vehicleUpcomingAuctionIds ?? {})) {
      const auction = auctionsById.get(auctionId);
      if (!auction) continue;
      const dateLabel = formatAuctionDateLabel(auction.date);
      labels[vehicleKey] = dateLabel ? `${auction.name}  ·  ${dateLabel}` : auction.name;
    }
    return labels;
  }, [config.upcomingAuctions, config.vehicleUpcomingAuctionIds]);

  const sortedUpcomingAuctions = useMemo(
    () =>
      AUCTION_ADMIN_ENABLED
        ? [...(config.upcomingAuctions ?? [])].sort((a, b) =>
            (a.date ?? "").localeCompare(b.date ?? "", "es"),
          )
        : [],
    [config.upcomingAuctions],
  );

  const upcomingAuctionGroups = useMemo(
    () =>
      sortedUpcomingAuctions.map((auction) => ({
        auction,
        items: homeVisibleItems.filter((item) => {
          const key = getVehicleKey(item);
          return (
            (config.vehicleUpcomingAuctionIds[key] ?? "") === auction.id &&
            isVehicleInAssignmentList(config.sectionVehicleIds["proximos-remates"] ?? [], key)
          );
        }),
      })),
    [sortedUpcomingAuctions, homeVisibleItems, config.vehicleUpcomingAuctionIds, config.sectionVehicleIds],
  );
  const visibleUpcomingAuctionGroups = useMemo(
    () =>
      upcomingAuctionGroups.filter(
        (group) => !hiddenHomeCategoryIds.has(auctionCategoryKey(group.auction.id)),
      ),
    [upcomingAuctionGroups, hiddenHomeCategoryIds],
  );

  const hasUpcomingAuctionCategories =
    sortedUpcomingAuctions.length > 0 &&
    visibleUpcomingAuctionGroups.some((group) => group.items.length > 0);

  const proximosRematesAll = getSectionItems("proximos-remates");
  const ventasDirectasAll = getSectionItems("ventas-directas");
  const novedadesAll = getSectionItems("novedades");
  const catalogoItemsAll = getSectionItems("catalogo");
  const hasHomePreFilter =
    homeSearchTerm.trim().length > 0 ||
    quickFilters.length > 0 ||
    topSectionFilter !== "all";
  const filterSectionByHomeVisibility = (sectionItems: CatalogItem[]) =>
    hasHomePreFilter
      ? sectionItems.filter((item) => homeVisibleKeys.has(getVehicleKey(item)))
      : sectionItems;
  const proximosRemates = filterSectionByHomeVisibility(proximosRematesAll);
  const ventasDirectas = filterSectionByHomeVisibility(ventasDirectasAll);
  const novedades = filterSectionByHomeVisibility(novedadesAll);
  const filteredCatalogItems = hasHomePreFilter
    ? filterSectionByHomeVisibility(catalogoItemsAll)
    : catalogoItemsAll.filter((item) => inferVehicleType(item) === activeTypeTab);
  const managedCategorySections = useMemo(
    () =>
      (config.managedCategories ?? [])
        .filter((category) => {
          const categoryHidden = hiddenHomeCategoryIds.has(managedCategoryKey(category.id));
          return category.visible !== false && !categoryHidden;
        })
        .map((category) => ({
          ...category,
          items: (category.vehicleIds ?? [])
            .map((vehicleId) => itemsByKey.get(vehicleId))
            .filter((item): item is CatalogItem => !!item)
            .filter((item) => homeVisibleKeys.has(getVehicleKey(item))),
        }))
        .filter((category) => category.items.length > 0),
    [config.managedCategories, itemsByKey, homeVisibleKeys, hiddenHomeCategoryIds],
  );

  const homeEditorStockItems = useMemo(
    () =>
      activeInventoryItems.filter((item) => {
        const key = getVehicleKey(item);
        return !mergedHiddenVehicleIds.has(key) && isVehicleAssignedToHomeEditorChannels(config, key, itemsByKey);
      }),
    [activeInventoryItems, mergedHiddenVehicleIds, config, itemsByKey],
  );

  const unassignedVisibleItems = useMemo(
    () =>
      visibleItems.filter(
        (item) => !isVehicleAssignedToHomeEditorChannels(config, getVehicleKey(item), itemsByKey),
      ),
    [visibleItems, config],
  );

  const homeStockStats = useMemo(() => {
    const managedVisibleCount = managedCategorySections.reduce(
      (sum, section) => sum + section.items.length,
      0,
    );
    return {
      feedTotal: activeInventoryItems.length,
      uniqueOnHome: homeEditorStockItems.length,
      sectionSlotTotal:
        proximosRemates.length +
        ventasDirectas.length +
        novedades.length +
        catalogoItemsAll.length +
        managedVisibleCount,
      unassignedVisible: unassignedVisibleItems.length,
      hiddenCount: activeInventoryItems.filter((item) =>
        mergedHiddenVehicleIds.has(getVehicleKey(item)),
      ).length,
      bySection: {
        ventasDirectas: ventasDirectas.length,
        novedades: novedades.length,
        catalogo: catalogoItemsAll.length,
        proximosRemates: proximosRemates.length,
        managed: managedVisibleCount,
      },
    };
  }, [
    activeInventoryItems,
    homeEditorStockItems.length,
    managedCategorySections,
    mergedHiddenVehicleIds,
    proximosRemates.length,
    ventasDirectas.length,
    novedades.length,
    catalogoItemsAll.length,
    unassignedVisibleItems.length,
  ]);
  const managedCategoryOrderEntries = useMemo(
    () =>
      (config.managedCategories ?? []).map((category) => ({
        id: `managed:${category.id}` as HomeSectionOrderId,
        name: category.name,
      })),
    [config.managedCategories],
  );
  const managedCategoryOrderLabelById = useMemo(
    () => new Map(managedCategoryOrderEntries.map((entry) => [entry.id, entry.name])),
    [managedCategoryOrderEntries],
  );
  const managedCategoryCountById = useMemo(
    () => new Map(managedCategorySections.map((section) => [`managed:${section.id}`, section.items.length])),
    [managedCategorySections],
  );
  const resolvedHomeSectionOrder = useMemo(() => {
    const managedIds = managedCategoryOrderEntries.map((entry) => entry.id);
    const validManagedIds = new Set(managedIds);
    const unique: HomeSectionOrderId[] = [];
    for (const rawSectionId of config.homeLayout.sectionOrder ?? []) {
      const sectionId = rawSectionId as HomeSectionOrderId;
      const isValidBase = isBaseHomeSectionOrderId(sectionId);
      const isValidManaged =
        sectionId.startsWith("managed:") && validManagedIds.has(sectionId as HomeSectionOrderId);
      if (!isValidBase && !isValidManaged) continue;
      if (!unique.includes(sectionId)) unique.push(sectionId);
    }
    for (const baseId of BASE_HOME_SECTION_ORDER) {
      if (!unique.includes(baseId)) unique.push(baseId);
    }
    for (const managedId of managedIds) {
      if (!unique.includes(managedId)) unique.push(managedId);
    }
    return unique;
  }, [config.homeLayout.sectionOrder, managedCategoryOrderEntries]);
  const homeSectionCountById = useMemo(() => {
    const map = new Map<HomeSectionOrderId, number>();
    map.set("proximos-remates", hasUpcomingAuctionCategories ? visibleUpcomingAuctionGroups.reduce((acc, group) => acc + group.items.length, 0) : proximosRemates.length);
    map.set("ventas-directas", ventasDirectas.length);
    map.set("novedades", novedades.length);
    map.set("catalogo", filteredCatalogItems.length);
    for (const [managedId, count] of managedCategoryCountById.entries()) {
      map.set(managedId as HomeSectionOrderId, count);
    }
    return map;
  }, [
    hasUpcomingAuctionCategories,
    visibleUpcomingAuctionGroups,
    proximosRemates.length,
    ventasDirectas.length,
    novedades.length,
    filteredCatalogItems.length,
    managedCategoryCountById,
  ]);

  const calendarPdfSections = useMemo<CalendarPdfSection[]>(() => {
    const buildRow = (item: CatalogItem): CalendarPdfRow => {
      const key = getVehicleKey(item);
      const vehicleDisplay = getPdfVehicleDisplay(item);
      return {
        vehiclePrimary: vehicleDisplay.primary,
        vehicleSecondary: vehicleDisplay.secondary,
        patent: getPatent(item),
        model: getModel(item),
        priceLabel: formatPrice(config.vehiclePrices[key]) ?? "Sin precio",
        thumbnailUrls: collectVehicleImageCandidates(item),
      };
    };

    const sections: CalendarPdfSection[] = [];

    if (hasUpcomingAuctionCategories) {
      for (const group of visibleUpcomingAuctionGroups) {
        if (group.items.length === 0) continue;
        sections.push({
          categoryTitle: `Destacados - ${group.auction.name}`,
          categorySubtitle: formatAuctionDateLabel(group.auction.date) || "Fecha por confirmar",
          rows: group.items.map(buildRow),
        });
      }
    } else if (proximosRemates.length > 0) {
      sections.push({
        categoryTitle: "Destacados",
        categorySubtitle: "Vehiculos recomendados para gestion comercial inmediata.",
        rows: proximosRemates.map(buildRow),
      });
    }

    if (ventasDirectas.length > 0) {
      sections.push({
        categoryTitle: "Ventas directas",
        categorySubtitle: config.sectionTexts["ventas-directas"].subtitle || "Stock disponible para cierre rapido.",
        rows: ventasDirectas.map(buildRow),
      });
    }

    const excludedKeys = new Set([
      ...proximosRemates.map((item) => getVehicleKey(item)),
      ...ventasDirectas.map((item) => getVehicleKey(item)),
    ]);
    const otrosRematesItems = homeVisibleItems.filter((item) => (
      inferVehicleType(item) === "otros" && !excludedKeys.has(getVehicleKey(item))
    ));
    if (otrosRematesItems.length > 0) {
      sections.push({
        categoryTitle: "Otros vehiculos",
        categorySubtitle: "Publicaciones activas clasificadas en otras categorias.",
        rows: otrosRematesItems.map(buildRow),
      });
    }
    return sections;
  }, [
    hasUpcomingAuctionCategories,
    visibleUpcomingAuctionGroups,
    proximosRemates,
    ventasDirectas,
    homeVisibleItems,
    config.vehiclePrices,
    config.sectionTexts,
  ]);

  const favoritesItems = useMemo(
    () => homeVisibleItems.filter((item) => favoriteKeys.includes(getVehicleKey(item))).slice(0, 12),
    [homeVisibleItems, favoriteKeys],
  );

  const downloadVisibleCalendarPdf = useCallback(async () => {
    if (isDownloadingCalendarPdf) return;
    if (calendarPdfSections.length === 0) {
      showSystemNotice(
        "info",
        "Sin publicaciones visibles",
        "No hay publicaciones visibles para incluir en el PDF con los filtros actuales.",
      );
      return;
    }
    setIsDownloadingCalendarPdf(true);
    try {
      const [{ jsPDF }, logoDataUrl] = await Promise.all([
        import("jspdf"),
        loadLogoForPdfAsDataUrl(),
      ]);
      const logoDimensions = logoDataUrl
        ? await getImageDimensionsFromDataUrl(logoDataUrl)
        : null;
      const logoAspectRatio =
        logoDimensions && logoDimensions.width > 0 && logoDimensions.height > 0
          ? logoDimensions.width / logoDimensions.height
          : 3.6;
      const doc = new jsPDF({ unit: "pt", format: "a4", compress: true });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const marginX = 40;
      const usableWidth = pageWidth - marginX * 2;
      const now = new Date();
      const y2 = String(now.getFullYear()).slice(-2);
      const m2 = String(now.getMonth() + 1).padStart(2, "0");
      const d2 = String(now.getDate()).padStart(2, "0");
      const filenameDate = `${y2}${m2}${d2}`;
      const exportFileName = `${filenameDate}_CatalogoVehiculosDeOcasion.pdf`;
      const todayLabel = now.toLocaleString("es-CL", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      const totalRows = calendarPdfSections.reduce((acc, section) => acc + section.rows.length, 0);
      const BRAND = {
        espresso: [44, 28, 19] as const,
        cacao: [78, 49, 30] as const,
        copper: [157, 98, 53] as const,
        cream: [252, 247, 241] as const,
        sand: [245, 236, 226] as const,
        text: [61, 43, 30] as const,
        muted: [115, 90, 71] as const,
        border: [214, 191, 169] as const,
        borderSoft: [233, 218, 201] as const,
        white: [255, 255, 255] as const,
      };
      // Portada minimalista comercial
      doc.setFillColor(...BRAND.cream);
      doc.rect(0, 0, pageWidth, pageHeight, "F");

      doc.setFillColor(...BRAND.espresso);
      doc.rect(0, 0, pageWidth, 10, "F");
      doc.setFillColor(...BRAND.copper);
      doc.rect(0, 10, pageWidth, 4, "F");

      doc.setFillColor(...BRAND.white);
      doc.setDrawColor(...BRAND.borderSoft);
      doc.setLineWidth(1);
      doc.roundedRect(marginX + 6, 36, usableWidth - 12, pageHeight - 72, 22, 22, "FD");

      doc.setFillColor(...BRAND.sand);
      doc.roundedRect(marginX + 18, 48, usableWidth - 36, pageHeight - 96, 18, 18, "F");

      const coverCenterY = pageHeight * 0.46;
      let catalogTitleY = coverCenterY + 36;

      if (logoDataUrl) {
        const { width: logoWidth, height: logoHeight } = fitDimensionsByAspect(
          logoAspectRatio,
          300,
          96,
        );
        const logoY = coverCenterY - logoHeight / 2 - 28;
        doc.addImage(
          logoDataUrl,
          "PNG",
          (pageWidth - logoWidth) / 2,
          logoY,
          logoWidth,
          logoHeight,
        );
        catalogTitleY = logoY + logoHeight + 52;
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(46);
      doc.setTextColor(...BRAND.espresso);
      doc.text("Catalogo", pageWidth / 2, catalogTitleY, { align: "center" });

      const coverDate = now.toLocaleDateString("es-CL", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
      const coverTime = now.toLocaleTimeString("es-CL", {
        hour: "2-digit",
        minute: "2-digit",
      });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(12);
      doc.setTextColor(...BRAND.muted);
      doc.text(`Actualizado ${coverDate} - ${coverTime}`, pageWidth / 2, catalogTitleY + 34, {
        align: "center",
      });

      const vehicleCountLabel = `${totalRows} vehiculo${totalRows === 1 ? "" : "s"}`;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(24);
      doc.setTextColor(...BRAND.copper);
      doc.text(vehicleCountLabel, pageWidth / 2, catalogTitleY + 68, { align: "center" });

      const coverContactCardY = catalogTitleY + 108;
      const coverContactCardWidth = Math.min(usableWidth - 72, 430);
      const coverContactCardX = (pageWidth - coverContactCardWidth) / 2;
      const coverContactPadX = 28;
      const coverContactInnerWidth = coverContactCardWidth - coverContactPadX * 2;
      const coverAppointmentLead = "Agenda tu cita";
      const coverAppointmentIntro =
        "Ven a revisar los vehiculos presencialmente en nuestras oficinas.";
      const coverAppointmentAddress = "Américo Vespucio 288";
      const coverContactLabel = "Contact Center";
      const coverContactPhone = CONTACT_PHONE;

      const COVER_CARD_PAD_TOP = 22;
      const COVER_CARD_PAD_BOTTOM = 24;
      const COVER_BODY_LINE_H = 14;
      const COVER_TITLE_SIZE = 13;
      const COVER_BODY_SIZE = 10.5;
      const COVER_ADDRESS_SIZE = 11;
      const COVER_LABEL_SIZE = 9;
      const COVER_PHONE_SIZE = 16;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(COVER_BODY_SIZE);
      const coverIntroLines = doc.splitTextToSize(coverAppointmentIntro, coverContactInnerWidth);

      let coverLayoutY = coverContactCardY + COVER_CARD_PAD_TOP + 18;
      coverLayoutY += 20;
      coverLayoutY += coverIntroLines.length * COVER_BODY_LINE_H + 10;
      coverLayoutY += COVER_ADDRESS_SIZE + 8;
      const coverSeparatorY = coverLayoutY + 10;
      const coverFooterSectionY = coverSeparatorY + 1;
      const coverLabelY = coverFooterSectionY + 18;
      const coverPhoneY = coverLabelY + 18;
      const coverContactCardHeight = coverPhoneY + COVER_CARD_PAD_BOTTOM - coverContactCardY;

      doc.setFillColor(...BRAND.white);
      doc.setDrawColor(...BRAND.border);
      doc.setLineWidth(0.8);
      doc.roundedRect(coverContactCardX, coverContactCardY, coverContactCardWidth, coverContactCardHeight, 12, 12, "FD");

      doc.setFillColor(...BRAND.sand);
      doc.roundedRect(
        coverContactCardX + 1,
        coverFooterSectionY,
        coverContactCardWidth - 2,
        coverContactCardY + coverContactCardHeight - coverFooterSectionY - 1,
        0,
        11,
        "F",
      );

      doc.setDrawColor(...BRAND.copper);
      doc.setLineWidth(2);
      doc.line(
        coverContactCardX + coverContactCardWidth / 2 - 28,
        coverContactCardY + 16,
        coverContactCardX + coverContactCardWidth / 2 + 28,
        coverContactCardY + 16,
      );

      let coverContactTextY = coverContactCardY + COVER_CARD_PAD_TOP + 18;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(COVER_TITLE_SIZE);
      doc.setTextColor(...BRAND.cacao);
      doc.text(coverAppointmentLead, pageWidth / 2, coverContactTextY, { align: "center" });

      coverContactTextY += 20;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(COVER_BODY_SIZE);
      doc.setTextColor(...BRAND.muted);
      doc.text(coverIntroLines, pageWidth / 2, coverContactTextY, {
        align: "center",
        maxWidth: coverContactInnerWidth,
      });

      coverContactTextY += coverIntroLines.length * COVER_BODY_LINE_H + 10;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(COVER_ADDRESS_SIZE);
      doc.setTextColor(...BRAND.copper);
      doc.text(coverAppointmentAddress, pageWidth / 2, coverContactTextY, { align: "center" });

      doc.setDrawColor(...BRAND.borderSoft);
      doc.setLineWidth(0.6);
      doc.line(
        coverContactCardX + coverContactPadX,
        coverSeparatorY,
        coverContactCardX + coverContactCardWidth - coverContactPadX,
        coverSeparatorY,
      );

      doc.setFont("helvetica", "normal");
      doc.setFontSize(COVER_LABEL_SIZE);
      doc.setTextColor(...BRAND.muted);
      doc.text(coverContactLabel.toUpperCase(), pageWidth / 2, coverLabelY, { align: "center" });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(COVER_PHONE_SIZE);
      doc.setTextColor(...BRAND.espresso);
      doc.text(coverContactPhone, pageWidth / 2, coverPhoneY, { align: "center" });

      doc.setFillColor(...BRAND.espresso);
      doc.rect(0, pageHeight - 10, pageWidth, 10, "F");
      doc.setFillColor(...BRAND.copper);
      doc.rect(0, pageHeight - 14, pageWidth, 4, "F");

      // Seccion detallada
      doc.addPage();
      let y = 42;

      const drawPageHeader = () => {
        const headerHeight = 64;
        const headerContentHeight = 58;
        doc.setFillColor(...BRAND.espresso);
        doc.rect(0, 0, pageWidth, headerHeight, "F");
        doc.setFillColor(...BRAND.copper);
        doc.rect(0, headerContentHeight, pageWidth, 6, "F");
        let titleOffsetX = marginX;
        if (logoDataUrl) {
          const { width: headerLogoWidth, height: headerLogoHeight } = fitDimensionsByAspect(
            logoAspectRatio,
            180,
            46,
          );
          const logoY = (headerContentHeight - headerLogoHeight) / 2;
          doc.addImage(
            logoDataUrl,
            "PNG",
            marginX,
            logoY,
            headerLogoWidth,
            headerLogoHeight,
          );
          titleOffsetX = marginX + headerLogoWidth + 14;
        }
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(...BRAND.white);
        doc.text("Detalle de vehiculos visibles", titleOffsetX, 31);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(245, 224, 205);
        doc.text(todayLabel, pageWidth - marginX, 31, { align: "right" });
        y = 82;
      };

      const cellPaddingX = 8;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      let maxPriceTextWidth = doc.getTextWidth("Precio");
      for (const section of calendarPdfSections) {
        for (const row of section.rows) {
          maxPriceTextWidth = Math.max(maxPriceTextWidth, doc.getTextWidth(row.priceLabel));
        }
      }
      const priceColWidth = Math.ceil(maxPriceTextWidth) + cellPaddingX * 2;
      const thumbColWidth = 72;
      const patentColWidth = 68;
      const modelColWidth = 84;
      const vehicleColWidth = usableWidth - priceColWidth - thumbColWidth - patentColWidth - modelColWidth;

      const tableColumns = [
        { key: "vehicle" as const, label: "Vehiculo", width: vehicleColWidth, align: "left" as const },
        { key: "patent" as const, label: "Patente", width: patentColWidth, align: "left" as const },
        { key: "model" as const, label: "Modelo", width: modelColWidth, align: "left" as const },
        { key: "thumbnail" as const, label: "Foto", width: thumbColWidth, align: "center" as const },
        { key: "priceLabel" as const, label: "Precio", width: priceColWidth, align: "right" as const },
      ];
      const vehicleColIndex = 0;
      const patentColIndex = 1;
      const modelColIndex = 2;
      const thumbnailColIndex = 3;
      const priceColIndex = 4;
      const thumbMaxWidth = 58;
      const thumbMaxHeight = 40;

      const thumbnailCache = new Map<string, PdfImageAsset>();
      const uniqueThumbnailUrls = [
        ...new Set(
          calendarPdfSections.flatMap((section) =>
            section.rows.flatMap((row) => row.thumbnailUrls),
          ),
        ),
      ];
      await mapWithConcurrency(uniqueThumbnailUrls, PDF_IMAGE_LOAD_CONCURRENCY, async (url) => {
        const asset = await loadImageForPdfAsDataUrl(url);
        if (asset) thumbnailCache.set(url, asset);
      });

      const resolveRowImageAsset = (urls: string[]) => {
        for (const url of urls) {
          const asset = thumbnailCache.get(url);
          if (asset) return asset;
        }
        return null;
      };

      const getColumnX = (columnIndex: number) =>
        marginX + tableColumns.slice(0, columnIndex).reduce((acc, column) => acc + column.width, 0);

      const drawTableHeader = () => {
        doc.setFillColor(...BRAND.cacao);
        doc.rect(marginX, y, usableWidth, 20, "F");
        let x = marginX;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(...BRAND.white);
        for (const column of tableColumns) {
          if (column.align === "right") {
            doc.text(column.label, x + column.width - 8, y + 13, { align: "right" });
          } else if (column.align === "center") {
            doc.text(column.label, x + column.width / 2, y + 13, { align: "center" });
          } else {
            doc.text(column.label, x + 8, y + 13);
          }
          x += column.width;
        }
        y += 24;
      };

      const ensureSpace = (requiredHeight: number, drawHeaderIfNewPage = false) => {
        if (y + requiredHeight <= pageHeight - 52) return;
        doc.addPage();
        drawPageHeader();
        if (drawHeaderIfNewPage) drawTableHeader();
      };

      drawPageHeader();
      for (const section of calendarPdfSections) {
        const rawTitle = section.categoryTitle.trim();
        const destacadosPrefix = "Destacados - ";
        const sectionTitlePrimary = rawTitle.startsWith(destacadosPrefix)
          ? "Destacados"
          : rawTitle;
        const sectionTitleSecondary = rawTitle.startsWith(destacadosPrefix)
          ? rawTitle.slice(destacadosPrefix.length).trim()
          : "";
        const subtitle = section.categorySubtitle.trim();
        const sectionDate = /^\d{2}-\d{2}-\d{4}$/.test(subtitle) ? subtitle : "";
        const sectionSupportText = sectionDate ? "" : subtitle;
        const headerHeight = sectionTitleSecondary ? 50 : 36;

        const countLabel = `${section.rows.length} veh.`;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        const countWidth = Math.max(58, doc.getTextWidth(countLabel) + 16);
        const countX = marginX + usableWidth - countWidth - 8;

        ensureSpace(headerHeight + 26);
        doc.setFillColor(...BRAND.sand);
        doc.roundedRect(marginX, y, usableWidth, headerHeight, 6, 6, "F");

        const titleBaseX = marginX + 10;
        const titleBaseY = y + 19;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        doc.setTextColor(...BRAND.cacao);
        doc.text(sectionTitlePrimary, titleBaseX, titleBaseY);

        if (sectionSupportText && !sectionTitleSecondary) {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(13);
          const primaryWidth = doc.getTextWidth(sectionTitlePrimary);
          const supportStartX = titleBaseX + primaryWidth;
          const supportMaxWidth = Math.max(48, countX - supportStartX - 8);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(10);
          doc.setTextColor(...BRAND.muted);
          doc.text(` · ${sectionSupportText}`, supportStartX, titleBaseY, { maxWidth: supportMaxWidth });
        }

        if (sectionTitleSecondary) {
          const secondaryBaseY = y + 37;
          doc.setFont("helvetica", "bold");
          doc.setFontSize(12);
          doc.setTextColor(...BRAND.text);
          doc.text(sectionTitleSecondary, titleBaseX, secondaryBaseY);
          if (sectionSupportText) {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(12);
            const secondaryWidth = doc.getTextWidth(sectionTitleSecondary);
            const supportStartX = titleBaseX + secondaryWidth;
            const supportMaxWidth = Math.max(48, countX - supportStartX - 8);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(10);
            doc.setTextColor(...BRAND.muted);
            doc.text(` · ${sectionSupportText}`, supportStartX, secondaryBaseY, { maxWidth: supportMaxWidth });
          }
        }

        doc.setFillColor(...BRAND.copper);
        doc.roundedRect(countX, y + 8, countWidth, 18, 5, 5, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(...BRAND.white);
        doc.text(countLabel, countX + countWidth / 2, y + 20, { align: "center" });

        if (sectionDate) {
          const dateWidth = Math.max(84, doc.getTextWidth(sectionDate) + 14);
          const dateX = marginX + usableWidth - dateWidth - 8;
          doc.setFillColor(...BRAND.white);
          doc.setDrawColor(...BRAND.border);
          doc.roundedRect(dateX, y + headerHeight - 21, dateWidth, 16, 4, 4, "FD");
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8.5);
          doc.setTextColor(...BRAND.muted);
          doc.text(sectionDate, dateX + dateWidth / 2, y + headerHeight - 10, { align: "center" });
        }

        y += headerHeight + 8;

        drawTableHeader();
        for (const [rowIndex, row] of section.rows.entries()) {
          const linePaddingY = 6;
          const lineHeight = 10;
          const vehicleInnerWidth = Math.max(16, tableColumns[vehicleColIndex].width - cellPaddingX * 2);
          const patentInnerWidth = Math.max(16, tableColumns[patentColIndex].width - cellPaddingX * 2);
          const modelInnerWidth = Math.max(16, tableColumns[modelColIndex].width - cellPaddingX * 2);
          const priceInnerWidth = Math.max(16, tableColumns[priceColIndex].width - cellPaddingX * 2);

          doc.setFont("helvetica", "bold");
          doc.setFontSize(9);
          const vehiclePrimaryLines = doc.splitTextToSize(row.vehiclePrimary, vehicleInnerWidth);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
          const vehicleSecondaryLines = row.vehicleSecondary
            ? doc.splitTextToSize(row.vehicleSecondary, vehicleInnerWidth)
            : [];
          doc.setFont("helvetica", "normal");
          doc.setFontSize(9);
          const patentLines = doc.splitTextToSize(row.patent, patentInnerWidth);
          const modelLines = doc.splitTextToSize(row.model, modelInnerWidth);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9);
          const priceLines = doc.splitTextToSize(row.priceLabel, priceInnerWidth);

          const vehicleLineCount = Math.max(1, vehiclePrimaryLines.length + vehicleSecondaryLines.length);
          const textBlockLines = Math.max(
            vehicleLineCount,
            patentLines.length,
            modelLines.length,
            priceLines.length,
          );
          const rowHeight = Math.max(thumbMaxHeight + linePaddingY * 2, textBlockLines * lineHeight + linePaddingY * 2);

          ensureSpace(rowHeight + 2, true);
          const rowFill = rowIndex % 2 === 0 ? BRAND.white : BRAND.cream;
          doc.setFillColor(rowFill[0], rowFill[1], rowFill[2]);
          doc.rect(marginX, y, usableWidth, rowHeight, "F");
          doc.setDrawColor(...BRAND.borderSoft);
          doc.rect(marginX, y, usableWidth, rowHeight);

          for (let columnIndex = 1; columnIndex < tableColumns.length; columnIndex += 1) {
            doc.line(getColumnX(columnIndex), y, getColumnX(columnIndex), y + rowHeight);
          }

          const vehicleX = getColumnX(vehicleColIndex) + cellPaddingX;
          let textY = y + linePaddingY + 8;
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9);
          doc.setTextColor(...BRAND.text);
          doc.text(vehiclePrimaryLines, vehicleX, textY, { maxWidth: vehicleInnerWidth });
          textY += vehiclePrimaryLines.length * lineHeight;
          if (vehicleSecondaryLines.length > 0) {
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8);
            doc.setTextColor(...BRAND.muted);
            doc.text(vehicleSecondaryLines, vehicleX, textY, { maxWidth: vehicleInnerWidth });
          }

          doc.setFont("helvetica", "normal");
          doc.setFontSize(9);
          doc.setTextColor(...BRAND.text);
          doc.text(
            patentLines,
            getColumnX(patentColIndex) + cellPaddingX,
            y + linePaddingY + 8,
            { maxWidth: patentInnerWidth },
          );
          doc.text(
            modelLines,
            getColumnX(modelColIndex) + cellPaddingX,
            y + linePaddingY + 8,
            { maxWidth: modelInnerWidth },
          );
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9);
          doc.setTextColor(...BRAND.text);
          doc.text(
            priceLines,
            getColumnX(priceColIndex) + tableColumns[priceColIndex].width - cellPaddingX,
            y + linePaddingY + 8,
            { align: "right", maxWidth: priceInnerWidth },
          );

          const thumbColX = getColumnX(thumbnailColIndex);
          const thumbColWidth = tableColumns[thumbnailColIndex].width;
          const imageAsset = resolveRowImageAsset(row.thumbnailUrls);
          if (imageAsset) {
            const { width: thumbWidth, height: thumbHeight } = fitDimensionsByAspect(
              imageAsset.aspectRatio,
              thumbMaxWidth,
              thumbMaxHeight,
            );
            const imgX = thumbColX + (thumbColWidth - thumbWidth) / 2;
            const imgY = y + (rowHeight - thumbHeight) / 2;
            doc.setDrawColor(...BRAND.borderSoft);
            doc.setFillColor(...BRAND.white);
            doc.roundedRect(imgX - 2, imgY - 2, thumbWidth + 4, thumbHeight + 4, 3, 3, "FD");
            doc.addImage(imageAsset.dataUrl, imageAsset.format, imgX, imgY, thumbWidth, thumbHeight);
          } else {
            const placeholderWidth = 44;
            const placeholderHeight = 28;
            const placeholderX = thumbColX + (thumbColWidth - placeholderWidth) / 2;
            const placeholderY = y + (rowHeight - placeholderHeight) / 2;
            doc.setFillColor(...BRAND.sand);
            doc.setDrawColor(...BRAND.borderSoft);
            doc.roundedRect(placeholderX, placeholderY, placeholderWidth, placeholderHeight, 3, 3, "FD");
            doc.setFont("helvetica", "normal");
            doc.setFontSize(7);
            doc.setTextColor(...BRAND.muted);
            doc.text("Sin foto", thumbColX + thumbColWidth / 2, placeholderY + placeholderHeight / 2 + 2, {
              align: "center",
            });
          }

          y += rowHeight;
        }
        y += 16;
      }

      const totalPages = doc.getNumberOfPages();
      for (let page = 1; page <= totalPages; page += 1) {
        doc.setPage(page);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(...BRAND.muted);
        doc.text(
          `VehiculosDeOcasion | Pagina ${page} de ${totalPages}`,
          pageWidth / 2,
          pageHeight - 18,
          { align: "center" },
        );
      }

      const downloadMode = await downloadPdfDocument(doc, exportFileName);
      trackEvent("calendar_pdf_download", {
        categories: calendarPdfSections.length,
        publications: totalRows,
        pages: doc.getNumberOfPages(),
        mode: downloadMode,
      });
      showSystemNotice(
        "success",
        "PDF generado",
        downloadMode === "opened"
          ? "Se abrio el PDF en una nueva pestana. Usa Compartir para guardarlo en tu celular."
          : `Se descargo correctamente: ${exportFileName}`,
      );
    } catch (error) {
      console.error("[calendar-pdf]", error);
      showSystemNotice(
        "error",
        "No se pudo generar el PDF",
        isIosPdfDevice()
          ? "Intenta nuevamente. Si tu navegador bloquea ventanas emergentes, permitelas para este sitio."
          : "Intenta nuevamente. Si el problema persiste, recarga la pagina.",
      );
    } finally {
      setIsDownloadingCalendarPdf(false);
    }
  }, [calendarPdfSections, isDownloadingCalendarPdf, showSystemNotice]);

  const latestItems = useMemo(
    () =>
      [...novedades]
        .sort(
          (a, b) =>
            new Date(b.auctionDate ?? "1900-01-01").getTime() -
            new Date(a.auctionDate ?? "1900-01-01").getTime(),
        )
        .slice(0, 6),
    [novedades],
  );

  const nextAuction = useMemo(() => {
    const today = new Date();
    const upcoming = sortedUpcomingAuctions
      .map((auction) => ({ auction, date: parseAuctionDateTime(auction) }))
      .filter((entry): entry is { auction: UpcomingAuction; date: Date } => !!entry.date)
      .filter((entry) => !Number.isNaN(entry.date.getTime()) && entry.date.getTime() >= today.getTime())
      .sort((a, b) => a.date.getTime() - b.date.getTime());
    return upcoming[0] ?? null;
  }, [sortedUpcomingAuctions]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCountdownNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const nextAuctionUrgencyLabel = useMemo(
    () => formatAuctionCountdownHours(nextAuction?.date ?? null, countdownNowMs),
    [nextAuction, countdownNowMs],
  );

  const toggleQuickFilter = (filterId: QuickFilterId) => {
    trackEvent("quick_filter_toggle", { filterId });
    setQuickFilters((prev) => {
      const set = new Set(prev);
      if (set.has(filterId)) set.delete(filterId);
      else set.add(filterId);
      return Array.from(set) as QuickFilterId[];
    });
  };

  const toggleFavorite = (itemKey: string) => {
    trackEvent("favorite_toggle", { itemKey });
    setFavoriteKeys((prev) => {
      const set = new Set(prev);
      if (set.has(itemKey)) set.delete(itemKey);
      else set.add(itemKey);
      return Array.from(set);
    });
  };

  const toggleCompare = (itemKey: string) => {
    trackEvent("compare_toggle", { itemKey });
    setCompareKeys((prev) => {
      const set = new Set(prev);
      if (set.has(itemKey)) {
        set.delete(itemKey);
        return Array.from(set);
      }
      if (set.size >= MAX_COMPARE_ITEMS) return prev;
      set.add(itemKey);
      return Array.from(set);
    });
  };

  const compareItems = useMemo(
    () => homeVisibleItems.filter((item) => compareKeys.includes(getVehicleKey(item))),
    [homeVisibleItems, compareKeys],
  );

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (selectedVehicle) {
      document.body.setAttribute("data-vehicle-detail-open", "true");
      document.body.removeAttribute("data-compare-open");
    } else {
      document.body.removeAttribute("data-vehicle-detail-open");
      if (compareItems.length > 0) {
        document.body.setAttribute("data-compare-open", "true");
      } else {
        document.body.removeAttribute("data-compare-open");
      }
    }
    return () => {
      document.body.removeAttribute("data-vehicle-detail-open");
      document.body.removeAttribute("data-compare-open");
    };
  }, [selectedVehicle, compareItems.length]);

  const selectedVehicleLookup = useMemo(
    () =>
      selectedVehicle
        ? buildVehicleLookup(selectedVehicle.raw as Record<string, unknown>)
        : new Map<string, unknown>(),
    [selectedVehicle],
  );

  const selectedVehicleKey = useMemo(
    () => (selectedVehicle ? getVehicleKey(selectedVehicle) : ""),
    [selectedVehicle],
  );

  const selectedVehicleOverride = useMemo(
    () => (selectedVehicleKey ? config.vehicleDetails[selectedVehicleKey] : undefined),
    [config.vehicleDetails, selectedVehicleKey],
  );

  const selectedVehiclePriceLabel = useMemo(
    () => (selectedVehicleKey ? formatPrice(config.vehiclePrices[selectedVehicleKey]) : null),
    [config.vehiclePrices, selectedVehicleKey],
  );
  const selectedVehicleReferencePriceAmount = useMemo(
    () => parseCurrencyAmount(selectedVehiclePriceLabel),
    [selectedVehiclePriceLabel],
  );
  const selectedVehiclePromoMeta = useMemo(() => {
    if (!selectedVehicle) {
      return {
        promoEnabled: false,
        originalPriceLabel: null as string | null,
        taxFeeLabel: null as string | null,
        transferFeeLabel: null as string | null,
      };
    }
    const raw = selectedVehicle.raw as Record<string, unknown>;
    const rawMeta = getRawPromoMeta(raw);
    const rawExpenseMeta = getRawExpenseMeta(raw);
    const override = selectedVehicleOverride;
    const promoEnabled =
      typeof override?.promoEnabled === "boolean" ? override.promoEnabled : rawMeta.promoEnabled;
    const originalPriceLabel = override?.originalPrice?.trim()
      ? override.originalPrice.trim()
      : rawMeta.originalPriceLabel;
    const taxFeeLabel = override?.taxFee?.trim()
      ? override.taxFee.trim()
      : rawExpenseMeta.taxFeeLabel;
    const transferFeeLabel = override?.transferFee?.trim()
      ? override.transferFee.trim()
      : rawExpenseMeta.transferFeeLabel;
    return { promoEnabled, originalPriceLabel, taxFeeLabel, transferFeeLabel };
  }, [selectedVehicle, selectedVehicleOverride]);
  const selectedVehicleTaxFeeAmount = useMemo(
    () => parseCurrencyAmount(selectedVehiclePromoMeta.taxFeeLabel),
    [selectedVehiclePromoMeta.taxFeeLabel],
  );
  const selectedVehicleTransferFeeAmount = useMemo(
    () => parseCurrencyAmount(selectedVehiclePromoMeta.transferFeeLabel),
    [selectedVehiclePromoMeta.transferFeeLabel],
  );
  const selectedVehicleTotalWithFeesAmount = useMemo(
    () =>
      selectedVehicleReferencePriceAmount +
      selectedVehicleTaxFeeAmount +
      selectedVehicleTransferFeeAmount,
    [
      selectedVehicleReferencePriceAmount,
      selectedVehicleTaxFeeAmount,
      selectedVehicleTransferFeeAmount,
    ],
  );
  const selectedVehicleHasFeeBreakdown = useMemo(
    () => selectedVehicleTaxFeeAmount > 0 || selectedVehicleTransferFeeAmount > 0,
    [selectedVehicleTaxFeeAmount, selectedVehicleTransferFeeAmount],
  );
  const selectedVehicleHasTaxFee = useMemo(
    () => selectedVehicleTaxFeeAmount > 0,
    [selectedVehicleTaxFeeAmount],
  );
  const selectedVehicleHasTransferFee = useMemo(
    () => selectedVehicleTransferFeeAmount > 0,
    [selectedVehicleTransferFeeAmount],
  );

  const selectedVehicleShareUrl = useMemo(() => {
    if (!selectedVehicle || typeof window === "undefined") return "";
    const url = new URL(window.location.href);
    url.searchParams.set("vehiculo", selectedVehicleKey);
    if (!url.hash) url.hash = "catalogo";
    return url.toString();
  }, [selectedVehicle, selectedVehicleKey]);

  const selectedVehicleWhatsappUrl = useMemo(() => {
    if (!selectedVehicle) return "";
    const patent = getPatent(selectedVehicle);
    const label = getModel(selectedVehicle);
    const shareLink = selectedVehicleShareUrl || "https://vehiculosdeocasion.vercel.app/#catalogo";
    const text = `Hola, me interesa este vehiculo: ${patent} - ${label}. ¿Me puedes asesorar? ${shareLink}`;
    return `https://api.whatsapp.com/send/?phone=${WHATSAPP_PHONE}&text=${encodeURIComponent(
      text,
    )}&type=phone_number&app_absent=0`;
  }, [selectedVehicle, selectedVehicleShareUrl]);

  const selectedVehicleConditionLabel = useMemo(() => {
    if (!selectedVehicle) return null;
    const overrideValue = selectedVehicleOverride?.vehicleCondition;
    if (overrideValue?.trim()) return overrideValue.trim();
    const rawValue = getLookupValue(selectedVehicleLookup, [
      "condicion",
      "condicion",
      "condicion_vehiculo",
      "estado_vehiculo",
      "estado",
      "status",
      "aws.condicion",
      "aws.estado",
    ]);
    return hasValue(rawValue) ? String(rawValue) : null;
  }, [selectedVehicle, selectedVehicleLookup, selectedVehicleOverride]);

  const selectedVehicleConditionClasses = useMemo(
    () => getConditionBadgeClasses(selectedVehicleConditionLabel),
    [selectedVehicleConditionLabel],
  );
  const selectedVehiclePrimaryCtaLabel = useMemo(() => {
    const sample = normalizeText(selectedVehicleConditionLabel ?? "");
    if (!sample) return "Solicitar asesoria por WhatsApp";
    if (/100% operativo|operativo/.test(sample)) return "Me interesa este vehiculo";
    if (/no arranca|desarme/.test(sample)) return "Consultar condicion y retiro";
    return "Quiero mas informacion de esta unidad";
  }, [selectedVehicleConditionLabel]);

  const selectedVehicleReferencePriceDisplay = useMemo(
    () => formatCurrencyAmount(selectedVehicleReferencePriceAmount),
    [selectedVehicleReferencePriceAmount],
  );
  const selectedVehicleTaxFeeDisplay = useMemo(
    () => formatCurrencyAmount(selectedVehicleTaxFeeAmount),
    [selectedVehicleTaxFeeAmount],
  );
  const selectedVehicleTransferFeeDisplay = useMemo(
    () => formatCurrencyAmount(selectedVehicleTransferFeeAmount),
    [selectedVehicleTransferFeeAmount],
  );
  const selectedVehicleTotalWithFeesDisplay = useMemo(
    () => formatCurrencyAmount(selectedVehicleTotalWithFeesAmount),
    [selectedVehicleTotalWithFeesAmount],
  );

  const selectedVehicleGalleryImages = useMemo(() => {
    if (!selectedVehicle) return [] as string[];
    const list = [selectedVehicle.thumbnail, ...selectedVehicle.images].filter(
      (entry): entry is string => typeof entry === "string" && entry.startsWith("http"),
    );
    return Array.from(new Set(list));
  }, [selectedVehicle]);

  const selectedVehicleMainImage = useMemo(() => {
    if (selectedVehicleGalleryImages.length === 0) return "/placeholder-car.svg";
    const idx = Math.min(selectedVehicleImageIndex, selectedVehicleGalleryImages.length - 1);
    return selectedVehicleGalleryImages[idx] ?? "/placeholder-car.svg";
  }, [selectedVehicleGalleryImages, selectedVehicleImageIndex]);

  const selectedVehicleLightboxImage = useMemo(() => {
    if (
      selectedVehicleLightboxIndex === null ||
      selectedVehicleLightboxIndex < 0 ||
      selectedVehicleLightboxIndex >= selectedVehicleGalleryImages.length
    ) {
      return null;
    }
    return selectedVehicleGalleryImages[selectedVehicleLightboxIndex] ?? null;
  }, [selectedVehicleGalleryImages, selectedVehicleLightboxIndex]);

  const selectedVehicleExpandedDescription = useMemo(() => {
    if (!selectedVehicle) return null;
    const overrideText =
      selectedVehicleOverride?.extendedDescription ?? selectedVehicleOverride?.description;
    if (overrideText?.trim()) return overrideText.trim();
    const rawText = getLookupValue(selectedVehicleLookup, [
      "descripcion_ampliada",
      "observaciones",
      "detalle",
      "descripcion",
      "description",
      "aws.observaciones",
      "aws.descripcion",
      "aws.description",
      "cav_campos.observaciones",
      "cav_campos.descripcion",
      "comentarios",
      "notas",
    ]);
    return hasValue(rawText) ? String(rawText) : null;
  }, [selectedVehicle, selectedVehicleLookup, selectedVehicleOverride]);

  const selectedVehicleTabs = useMemo(
    () => {
      const tabs: VehicleDetailTabDef[] = [
        { id: "general", label: "Informacion del vehiculo", shortLabel: "General" },
        { id: "descripcion", label: "Descripcion", shortLabel: "Desc." },
        { id: "tecnica", label: "Detalles tecnicos", shortLabel: "Tecnica" },
      ];
      if (selectedVehicleGalleryImages.length > 0) {
        tabs.push({ id: "fotos", label: "Fotos", shortLabel: "Fotos" });
      }
      return tabs;
    },
    [selectedVehicleGalleryImages.length],
  );

  const closeSelectedVehicleLightbox = useCallback(() => {
    setSelectedVehicleLightboxIndex(null);
    setSelectedVehicleLightboxZoom(1);
  }, []);

  const openSelectedVehicleLightboxAt = useCallback(
    (index: number) => {
      if (selectedVehicleGalleryImages.length === 0) return;
      const boundedIndex = Math.max(0, Math.min(index, selectedVehicleGalleryImages.length - 1));
      setSelectedVehicleLightboxIndex(boundedIndex);
      setSelectedVehicleImageIndex(boundedIndex);
      setSelectedVehicleLightboxZoom(1);
    },
    [selectedVehicleGalleryImages.length],
  );

  const moveSelectedVehicleLightbox = useCallback(
    (direction: "prev" | "next") => {
      if (selectedVehicleGalleryImages.length <= 1) return;
      setSelectedVehicleLightboxIndex((prev) => {
        const current = prev ?? 0;
        const delta = direction === "next" ? 1 : -1;
        const next =
          (current + delta + selectedVehicleGalleryImages.length) %
          selectedVehicleGalleryImages.length;
        setSelectedVehicleImageIndex(next);
        return next;
      });
      setSelectedVehicleLightboxZoom(1);
    },
    [selectedVehicleGalleryImages.length],
  );

  const zoomSelectedVehicleLightbox = useCallback((direction: "in" | "out" | "reset") => {
    setSelectedVehicleLightboxZoom((prev) => {
      if (direction === "reset") return 1;
      const next = direction === "in" ? prev + 0.2 : prev - 0.2;
      return Math.max(1, Math.min(next, 3));
    });
  }, []);

  const onSelectedVehicleLightboxWheel = useCallback(
    (event: ReactWheelEvent<HTMLDivElement>) => {
      event.preventDefault();
      if (event.deltaY < 0) {
        zoomSelectedVehicleLightbox("in");
      } else {
        zoomSelectedVehicleLightbox("out");
      }
    },
    [zoomSelectedVehicleLightbox],
  );

  useEffect(() => {
    if (selectedVehicle) {
      setSelectedVehicleTab("general");
      setSelectedVehicleLightboxIndex(null);
      setSelectedVehicleLightboxZoom(1);
      setInlineSummaryField(null);
      setInlineSummaryValue("");
      setInlinePriceEditing(false);
    }
  }, [selectedVehicle]);

  useEffect(() => {
    if (selectedVehicleLightboxIndex === null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeSelectedVehicleLightbox();
      else if (event.key === "ArrowLeft") moveSelectedVehicleLightbox("prev");
      else if (event.key === "ArrowRight") moveSelectedVehicleLightbox("next");
      else if (event.key === "+" || event.key === "=") zoomSelectedVehicleLightbox("in");
      else if (event.key === "-" || event.key === "_") zoomSelectedVehicleLightbox("out");
      else if (event.key.toLowerCase() === "0") zoomSelectedVehicleLightbox("reset");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    selectedVehicleLightboxIndex,
    closeSelectedVehicleLightbox,
    moveSelectedVehicleLightbox,
    zoomSelectedVehicleLightbox,
  ]);

  useEffect(() => {
    if (!selectedVehicle) return;
    const activeTab = vehicleTabRefs.current[selectedVehicleTab];
    activeTab?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [selectedVehicle, selectedVehicleTab]);

  const selectedVehicleFieldsByTab = useMemo(() => {
    if (!selectedVehicle) {
      return {
        general: [] as Array<[string, string]>,
        descripcion: [] as Array<[string, string]>,
        tecnica: [] as Array<[string, string]>,
      };
    }

    const raw = selectedVehicle.raw as Record<string, unknown>;
    const toPairs = (
      entries: Array<{
        label: string;
        value: unknown;
        formatter?: (value: unknown) => string;
      }>,
    ): Array<[string, string]> =>
      entries
        .filter((entry) => hasValue(entry.value))
        .map((entry) => [
          entry.label,
          entry.formatter ? entry.formatter(entry.value) : String(entry.value),
        ]);

    const formatYesNo = (value: unknown): string => {
      const sample = String(value ?? "").trim().toLowerCase();
      if (["si", "si", "yes", "y", "true", "1"].includes(sample)) return "Si";
      if (["no", "false", "0", "n"].includes(sample)) return "No";
      return String(value);
    };

    return {
      general: toPairs([
        { label: "Patente", value: getPatent(selectedVehicle) },
        {
          label: "Patente verificador",
          value: getLookupValue(selectedVehicleLookup, [
            "patente_verifier",
            "patente_dv",
            "ppu_dv",
            "dv",
            "verificador_patente",
            "glo3d.patente_verifier",
            "glo3d.patente_dv",
            "glo3d.ppu_dv",
            "glo3d.dv",
          ]),
        },
        {
          label: "VIN",
          value: getLookupValue(selectedVehicleLookup, [
            "vin",
            "n_de_vin",
            "numero_chasis",
            "nro_chasis",
            "chasis",
            "glo3d.n_de_vin",
            "glo3d.vin",
          ]),
        },
        {
          label: "N° de chasis",
          value: getLookupValue(selectedVehicleLookup, [
            "n_de_chasis",
            "numero_chasis",
            "nro_chasis",
            "chasis",
            "glo3d.n_de_chasis",
          ]),
        },
        { label: "Marca", value: getLookupValue(selectedVehicleLookup, ["marca", "brand", "make", "glo3d.make"]) ?? raw.marca },
        { label: "Modelo", value: getLookupValue(selectedVehicleLookup, ["modelo", "model"]) ?? getModel(selectedVehicle) },
        { label: "Ano", value: getLookupValue(selectedVehicleLookup, ["ano", "anio", "year", "glo3d.year"]) },
        {
          label: "Tipo de vehiculo",
          value: getLookupValue(selectedVehicleLookup, [
            "tipo_de_vehiculo",
            "tipo_vehiculo",
            "vehicle_type",
            "vehicle_type_name",
            "glo3d.tipo_de_vehiculo",
            "glo3d.tipo_vehiculo",
            "glo3d.vehicle_type",
          ]),
        },
        {
          label: "Kilometraje",
          value: getLookupValue(selectedVehicleLookup, [
            "kilometraje",
            "km",
            "kms",
            "odometro",
            "odometro",
            "mileage",
            "odometer",
            "cav_campos.kilometraje",
            "cav_campos.km",
            "autored.kilometraje",
            "autored.km",
            "autored.odometro",
            "autored.odometer",
          ]),
          formatter: formatMileageValue,
        },
        {
          label: "Condicion",
          value:
            selectedVehicleOverride?.vehicleCondition ??
            getLookupValue(selectedVehicleLookup, [
              "condicion",
              "condicion",
              "condicion_vehiculo",
              "estado_vehiculo",
              "estado",
              "status",
            ]),
        },
      ]),
      descripcion: [] as Array<[string, string]>,
      tecnica: toPairs([
        {
          label: "Color",
          value: getLookupValue(selectedVehicleLookup, [
            "color",
            "color_exterior",
            "color_vehiculo",
            "cav_campos.color",
            "autored.color",
            "autored.color_exterior",
            "autored.exterior_color",
          ]),
        },
        {
          label: "Combustible",
          value: getLookupValue(selectedVehicleLookup, [
            "combustible",
            "tipo_combustible",
            "fuel",
            "fuel_type",
            "cav_campos.combustible",
            "autored.combustible",
            "autored.tipo_combustible",
            "autored.fuel",
            "autored.fuel_type",
          ]),
        },
        {
          label: "Transmision",
          value: getLookupValue(selectedVehicleLookup, [
            "transmision",
            "transmision",
            "caja",
            "tipo_caja",
            "transmission",
            "gearbox",
            "cav_campos.transmision",
            "cav_campos.caja",
            "autored.transmision",
            "autored.transmission",
            "autored.caja",
            "autored.tipo_caja",
            "glo3d.transmission",
          ]),
        },
        {
          label: "Traccion",
          value: getLookupValue(selectedVehicleLookup, [
            "traccion",
            "traccion",
            "tipo_traccion",
            "drivetrain",
            "traction",
            "cav_campos.traccion",
            "autored.traccion",
            "autored.tipo_traccion",
            "autored.drivetrain",
            "drive_type",
            "glo3d.drive_type",
          ]),
        },
        {
          label: "Llaves",
          value: getLookupValue(selectedVehicleLookup, [
            "llaves",
            "keys",
            "has_keys",
            "tiene_llaves",
            "glo3d.llaves",
            "glo3d.keys",
            "glo3d.has_keys",
          ]),
          formatter: formatYesNo,
        },
        {
          label: "Aire acondicionado",
          value: getLookupValue(selectedVehicleLookup, [
            "aire_acondicionado",
            "air_conditioning",
            "has_ac",
            "ac",
            "glo3d.aire_acondicionado",
            "glo3d.air_conditioning",
            "glo3d.has_ac",
          ]),
          formatter: formatYesNo,
        },
        {
          label: "Unico propietario",
          value: getLookupValue(selectedVehicleLookup, [
            "unico_propietario",
            "unico_propietario",
            "single_owner",
            "one_owner",
            "glo3d.unico_propietario",
            "glo3d.single_owner",
          ]),
          formatter: formatYesNo,
        },
        {
          label: "Condicionado",
          value: getLookupValue(selectedVehicleLookup, [
            "condicionado",
            "conditioned",
            "acondicionado",
            "glo3d.condicionado",
          ]),
          formatter: formatYesNo,
        },
        {
          label: "Aro",
          value: getLookupValue(selectedVehicleLookup, [
            "aro",
            "aro_llanta",
            "rin",
            "rines",
            "wheel_size",
            "cav_campos.aro",
            "autored.aro",
            "autored.rin",
            "autored.rines",
            "autored.wheel_size",
            "glo3d.aro",
          ]),
        },
        {
          label: "Cilindrada",
          value: getLookupValue(selectedVehicleLookup, [
            "cilindrada",
            "cc",
            "motor_cc",
            "engine_cc",
            "cav_campos.cilindrada",
            "autored.cilindrada",
            "autored.cc",
            "autored.motor_cc",
            "autored.engine_cc",
            "glo3d.engine",
          ]),
        },
        {
          label: "Tipo",
          value: getLookupValue(selectedVehicleLookup, [
            "tipo",
            "type",
            "tipo_unidad",
            "condition_type",
            "glo3d.tipo",
            "glo3d.type",
          ]),
        },
        {
          label: "Version",
          value: getLookupValue(selectedVehicleLookup, [
            "version",
            "ver",
            "trim",
            "glo3d.version",
            "glo3d.ver",
            "glo3d.trim",
          ]),
        },
        {
          label: "N° de siniestro",
          value: getLookupValue(selectedVehicleLookup, [
            "n_de_siniestro",
            "numero_siniestro",
            "n_s",
            "ns",
            "n°s",
            "glo3d.n_de_siniestro",
            "glo3d.n_s",
            "glo3d.ns",
          ]),
        },
        {
          label: "N° de motor",
          value: getLookupValue(selectedVehicleLookup, [
            "n_de_motor",
            "numero_motor",
            "motor_number",
            "ndm",
            "glo3d.n_de_motor",
            "glo3d.ndm",
          ]),
        },
        {
          label: "N° de serie",
          value: getLookupValue(selectedVehicleLookup, [
            "n_de_serie",
            "numero_serie",
            "serial_number",
            "nds",
            "glo3d.n_de_serie",
            "glo3d.nds",
          ]),
        },
        {
          label: "Ubicacion fisica",
          value: getLookupValue(selectedVehicleLookup, [
            "ubicacion_fisica",
            "ubicacion",
            "ubi",
            "location",
            "glo3d.ubicacion_fisica",
            "glo3d.ubi",
          ]),
        },
        {
          label: "Transportista",
          value: getLookupValue(selectedVehicleLookup, [
            "transportista",
            "tra",
            "glo3d.transportista",
            "glo3d.tra",
          ]),
        },
        {
          label: "Taller",
          value: getLookupValue(selectedVehicleLookup, [
            "taller",
            "tal",
            "glo3d.taller",
            "glo3d.tal",
          ]),
        },
        {
          label: "Multas",
          value: getLookupValue(selectedVehicleLookup, [
            "multas",
            "mul",
            "glo3d.multas",
            "glo3d.mul",
          ]),
        },
        {
          label: "TAG",
          value: getLookupValue(selectedVehicleLookup, [
            "tag",
            "glo3d.tag",
          ]),
        },
        {
          label: "Vencimiento revision tecnica",
          value: getLookupValue(selectedVehicleLookup, [
            "vencimiento_revision_tecnica",
            "revision_tecnica_vencimiento",
            "vrt",
            "glo3d.vencimiento_revision_tecnica",
            "glo3d.vrt",
          ]),
        },
        {
          label: "Vencimiento permiso circulacion",
          value: getLookupValue(selectedVehicleLookup, [
            "vencimiento_permiso_circulacion",
            "permiso_circulacion_vencimiento",
            "vpc",
            "glo3d.vencimiento_permiso_circulacion",
            "glo3d.vpc",
          ]),
        },
        {
          label: "Vencimiento seguro obligatorio",
          value: getLookupValue(selectedVehicleLookup, [
            "vencimiento_seguro_obligatorio",
            "seguro_obligatorio_vencimiento",
            "vso",
            "glo3d.vencimiento_seguro_obligatorio",
            "glo3d.vso",
          ]),
        },
        {
          label: "Prueba de motor (arranca)",
          value: getLookupValue(selectedVehicleLookup, [
            "prueba_motor",
            "prueba_motor_arranca",
            "pdm",
            "glo3d.prueba_motor",
            "glo3d.pdm",
          ]),
          formatter: formatYesNo,
        },
        {
          label: "Prueba de desplazamiento (se mueve)",
          value: getLookupValue(selectedVehicleLookup, [
            "prueba_desplazamiento",
            "prueba_desplazamiento_mueve",
            "pdd",
            "glo3d.prueba_desplazamiento",
            "glo3d.pdd",
          ]),
          formatter: formatYesNo,
        },
        {
          label: "Estado de airbags",
          value: getLookupValue(selectedVehicleLookup, [
            "estado_airbags",
            "airbags_estado",
            "eda",
            "glo3d.estado_airbags",
            "glo3d.eda",
          ]),
        },
        {
          label: "Nombre propietario anterior",
          value: getLookupValue(selectedVehicleLookup, [
            "nombre_propietario_anterior",
            "previous_owner_name",
            "owner_previous_name",
            "npa",
            "glo3d.nombre_propietario_anterior",
            "glo3d.previous_owner_name",
            "glo3d.npa",
          ]),
        },
        {
          label: "RUT propietario anterior",
          value: getLookupValue(selectedVehicleLookup, [
            "rut_propietario_anterior",
            "previous_owner_rut",
            "owner_previous_rut",
            "rpa",
            "glo3d.rut_propietario_anterior",
            "glo3d.previous_owner_rut",
            "glo3d.rpa",
          ]),
        },
        {
          label: "RUT verificador",
          value: getLookupValue(selectedVehicleLookup, [
            "rut_verificador",
            "verifier_rut",
            "rut_verifier",
            "glo3d.rut_verificador",
            "glo3d.verifier_rut",
          ]),
        },
      ]),
    };
  }, [selectedVehicle, selectedVehicleLookup, selectedVehicleOverride]);

  const openOfferModal = useCallback(() => {
    if (!selectedVehicle) return;
    if (selectedVehicleReferencePriceAmount <= 0) {
      showSystemNotice(
        "info",
        "Precio no disponible",
        "Este vehiculo no tiene precio referencial cargado. Contactanos por WhatsApp para ofertar.",
      );
      return;
    }
    setShowOfferModal(true);
    trackEvent("offer_modal_open", { itemKey: selectedVehicleKey });
  }, [selectedVehicle, selectedVehicleKey, selectedVehicleReferencePriceAmount, showSystemNotice]);

  const closeOfferModal = useCallback(() => {
    setShowOfferModal(false);
    setOfferSending(false);
    setOfferForm(buildEmptyOfferForm());
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (selectedVehicleLightboxIndex !== null) {
        closeSelectedVehicleLightbox();
        return;
      }
      if (showOfferModal) {
        closeOfferModal();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeOfferModal, closeSelectedVehicleLightbox, selectedVehicleLightboxIndex, showOfferModal]);

  const submitOffer = useCallback(async () => {
    if (!selectedVehicle) return;
    const customerName = offerForm.customerName.trim();
    const customerEmail = offerForm.customerEmail.trim();
    const customerPhone = offerForm.customerPhone.trim();
    const offerAmount = parseCurrencyAmount(offerForm.offerAmount);

    if (!customerName || !customerEmail || !customerPhone || offerAmount <= 0) {
      showSystemNotice("error", "Campos obligatorios", "Completa nombre, mail, telefono y oferta para enviar.");
      trackEvent("offer_submit_invalid", { itemKey: selectedVehicleKey });
      return;
    }
    if (!isValidEmailAddress(customerEmail)) {
      showSystemNotice("error", "Correo invalido", "Ingresa un mail valido para contactarte.");
      trackEvent("offer_submit_invalid_email", { itemKey: selectedVehicleKey });
      return;
    }
    if (selectedVehicleReferencePriceAmount <= 0) {
      showSystemNotice(
        "error",
        "Precio referencial no disponible",
        "No podemos registrar la oferta porque falta el precio referencial de este vehiculo.",
      );
      return;
    }

    setOfferSending(true);
    try {
      const response = await fetch("/api/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemKey: selectedVehicleKey,
          vehicleTitle: getModel(selectedVehicle),
          patent: getPatent(selectedVehicle),
          referencePrice: selectedVehicleReferencePriceAmount,
          offerAmount,
          customerName,
          customerEmail,
          customerPhone,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        showSystemNotice(
          "error",
          "No pudimos registrar tu oferta",
          payload.error ?? "Intenta nuevamente en unos segundos.",
        );
        trackEvent("offer_submit_error", { itemKey: selectedVehicleKey });
        return;
      }
      trackEvent("offer_submit_success", { itemKey: selectedVehicleKey, offerAmount });
      showSystemNotice(
        "success",
        "Oferta recibida",
        "Ya recibimos tu oferta y nos pondremos en contacto contigo en caso de adjudicarse.",
      );
      setOfferForm(buildEmptyOfferForm());
      setShowOfferModal(false);
    } catch {
      showSystemNotice(
        "error",
        "No pudimos registrar tu oferta",
        "Intenta nuevamente en unos segundos.",
      );
      trackEvent("offer_submit_error", { itemKey: selectedVehicleKey });
    } finally {
      setOfferSending(false);
    }
  }, [
    offerForm,
    selectedVehicle,
    selectedVehicleKey,
    selectedVehicleReferencePriceAmount,
    showSystemNotice,
  ]);

  const editorPatentTokens = useMemo(() => extractPatentTokens(searchTerm), [searchTerm]);
  const editorPatentFilterActive = editorPatentTokens.length > 0;

  const filteredEditorItems = useMemo(() => {
    const query = normalizeText(searchTerm);
    const patentTokens = editorPatentTokens;
    const matchesPatentItem = (item: CatalogItem) => {
      const itemPatent = normalizePatentToken(getPatent(item));
      const itemKey = normalizePatentToken(getVehicleKey(item));
      return patentTokens.some(
        (token) => token === itemPatent || token === itemKey,
      );
    };
    const source = patentTokens.length > 0
      ? activeInventoryItems.filter(matchesPatentItem)
      : query
        ? activeInventoryItems.filter((item) =>
            normalizeText(
              `${getPatent(item)} ${getVehicleDisplayTitle(item)} ${getModel(item)} ${item.title} ${item.subtitle ?? ""}`,
            ).includes(query),
          )
        : activeInventoryItems;
    const hideHiddenInGroup = editorVisibilityFilter === "visible";
    const byGroup =
      patentTokens.length > 0
        ? source
        : editorGroupFilter === "all"
        ? source
        : editorGroupFilter === "home"
          ? source.filter((item) => {
              const key = getVehicleKey(item);
              if (hideHiddenInGroup && mergedHiddenVehicleIds.has(key)) return false;
              return isVehicleAssignedToHomeEditorChannels(config, key, itemsByKey);
            })
          : editorGroupFilter === "unassigned"
            ? source.filter((item) => {
                const key = getVehicleKey(item);
                if (hideHiddenInGroup && mergedHiddenVehicleIds.has(key)) return false;
                return !isVehicleAssignedToHomeEditorChannels(config, key, itemsByKey);
              })
            : editorGroupFilter === "proximos-remates"
          ? source.filter((item) =>
              Boolean(config.vehicleUpcomingAuctionIds[getVehicleKey(item)]),
            )
          : editorGroupFilter.startsWith("managed:")
            ? source.filter((item) => {
                const managedCategoryId = editorGroupFilter.replace("managed:", "");
                const managedCategory = (config.managedCategories ?? []).find(
                  (category) => category.id === managedCategoryId,
                );
                if (!managedCategory) return false;
                return isVehicleInAssignmentList(
                  managedCategory.vehicleIds ?? [],
                  getVehicleKey(item),
                );
              })
          : source.filter((item) => {
              const sectionGroup = editorGroupFilter as Exclude<
                EditorGroupFilter,
                "all" | "home" | "unassigned" | `managed:${string}`
              >;
              return isVehicleAssignedInSectionList(
                config.sectionVehicleIds[sectionGroup] ?? [],
                getVehicleKey(item),
                itemsByKey,
              );
            });
    const byVisibility =
      editorVisibilityFilter === "all"
        ? byGroup
        : byGroup.filter((item) => {
            const isHidden = mergedHiddenVehicleIds.has(getVehicleKey(item));
            return editorVisibilityFilter === "hidden" ? isHidden : !isHidden;
          });
    const byVehicleCategory =
      editorVehicleCategoryFilter === "all"
        ? byVisibility
        : byVisibility.filter(
            (item) =>
              inferVehicleCategoryForAdmin(item) === editorVehicleCategoryFilter,
          );
    if (!auctionFilterId) return byVehicleCategory;
    return byVehicleCategory.filter(
      (item) =>
        (config.vehicleUpcomingAuctionIds[getVehicleKey(item)] ?? "") === auctionFilterId,
    );
  }, [
    activeInventoryItems,
    searchTerm,
    editorPatentTokens,
    auctionFilterId,
    editorGroupFilter,
    editorVisibilityFilter,
    editorVehicleCategoryFilter,
    mergedHiddenVehicleIds,
    config.vehicleUpcomingAuctionIds,
    config.sectionVehicleIds,
    config.managedCategories,
    itemsByKey,
  ]);

  const editorPageSize = editorPatentFilterActive ? EDITOR_PATENT_PAGE_SIZE : EDITOR_PAGE_SIZE;
  const totalEditorPages = Math.max(1, Math.ceil(filteredEditorItems.length / editorPageSize));
  const currentEditorPage = Math.min(editorPage, totalEditorPages);
  const paginatedEditorItems = useMemo(() => {
    const start = (currentEditorPage - 1) * editorPageSize;
    return filteredEditorItems.slice(start, start + editorPageSize);
  }, [filteredEditorItems, currentEditorPage, editorPageSize]);

  const editorMissingPatentTokens = useMemo(() => {
    if (editorPatentTokens.length === 0) return [] as string[];
    const found = new Set(
      activeInventoryItems
        .filter((item) => {
          const itemPatent = normalizePatentToken(getPatent(item));
          const itemKey = normalizePatentToken(getVehicleKey(item));
          return editorPatentTokens.some(
            (token) => token === itemPatent || token === itemKey,
          );
        })
        .flatMap((item) => {
          const itemPatent = normalizePatentToken(getPatent(item));
          const itemKey = normalizePatentToken(getVehicleKey(item));
          return [itemPatent, itemKey].filter(Boolean);
        }),
    );
    return editorPatentTokens.filter((token) => !found.has(token));
  }, [editorPatentTokens, activeInventoryItems]);

  const editorSelectedCount = editorSelectedKeys.length;
  const allFilteredEditorSelected =
    filteredEditorItems.length > 0 &&
    filteredEditorItems.every((item) => editorSelectedKeys.includes(getVehicleKey(item)));

  const editorHiddenPatentMatches = useMemo(() => {
    const patentTokens = extractPatentTokens(searchTerm);
    if (patentTokens.length === 0) return [] as CatalogItem[];
    return activeInventoryItems.filter((item) => {
      const key = getVehicleKey(item);
      const itemPatent = normalizePatentToken(getPatent(item));
      const matchesPatent = patentTokens.some(
        (token) => token === itemPatent || token === normalizePatentToken(key),
      );
      return matchesPatent && mergedHiddenVehicleIds.has(key);
    });
  }, [searchTerm, activeInventoryItems, mergedHiddenVehicleIds]);

  const activeManagedCategory = useMemo(
    () =>
      assignCategoryId
        ? (config.managedCategories ?? []).find((category) => category.id === assignCategoryId) ?? null
        : null,
    [assignCategoryId, config.managedCategories],
  );

  const managedCategoryAssignCandidates = useMemo(() => {
    if (!activeManagedCategory) return [] as CatalogItem[];
    const query = normalizeText(assignSearchTerm);
    const source = items.filter((item) => {
      if (!query) return true;
      const sample = normalizeText(
        `${getPatent(item)} ${getModel(item)} ${item.title} ${item.subtitle ?? ""}`,
      );
      return sample.includes(query);
    });
    return source;
  }, [activeManagedCategory, assignSearchTerm, items]);

  const batchAssignCandidates = useMemo(() => {
    if (!batchAssignTarget) return [] as CatalogItem[];
    const query = normalizeText(batchAssignSearchTerm);
    const patentTokens = extractPatentTokens(batchAssignSearchTerm);
    const source = activeInventoryItems.filter((item) => {
      const key = getVehicleKey(item);
      const patent = normalizePatentToken(getPatent(item));
      if (patentTokens.length > 0) {
        return patentTokens.some(
          (token) => token === patent || token === normalizePatentToken(key),
        );
      }
      if (!query) return true;
      const sample = normalizeText(`${getPatent(item)} ${getModel(item)} ${item.title} ${item.subtitle ?? ""}`);
      return sample.includes(query);
    });
    return source;
  }, [batchAssignSearchTerm, batchAssignTarget, activeInventoryItems]);

  const batchAssignMissingPatents = useMemo(() => {
    const patentTokens = extractPatentTokens(batchAssignSearchTerm);
    if (patentTokens.length === 0) return [] as string[];
    const found = new Set(
      batchAssignCandidates.map((item) => normalizePatentToken(getPatent(item))),
    );
    return patentTokens.filter((token) => !found.has(token));
  }, [batchAssignSearchTerm, batchAssignCandidates]);

  const batchAssignTargetLabel = useMemo(() => {
    if (!batchAssignTarget) return "";
    if (batchAssignTarget.type === "auction") {
      const auction = sortedUpcomingAuctions.find((entry) => entry.id === batchAssignTarget.auctionId);
      return auction
        ? `${auction.name} (${formatAuctionDateLabel(auction.date)})`
        : "Remate seleccionado";
    }
    return SECTION_LABELS[batchAssignTarget.sectionId];
  }, [batchAssignTarget, sortedUpcomingAuctions]);

  const sectionVehicleCounts = useMemo(
    () =>
      ({
        "proximos-remates": getAssignedSectionItems("proximos-remates", { visibleOnly: true }).length,
        "ventas-directas": getAssignedSectionItems("ventas-directas", { visibleOnly: true }).length,
        novedades: getAssignedSectionItems("novedades", { visibleOnly: true }).length,
        catalogo: getAssignedSectionItems("catalogo", { visibleOnly: true }).length,
      }) satisfies Record<SectionId, number>,
    [getAssignedSectionItems],
  );

  const resetAdminInventoryFilters = useCallback(() => {
    setEditorGroupFilter("home");
    setEditorVisibilityFilter("all");
    setEditorVehicleCategoryFilter("all");
    setAuctionFilterId("");
    setSearchTerm("");
    setEditorPage(1);
    setEditorSelectedKeys([]);
    setShowEditorBulkMenu(false);
    setShowEditorBulkGroupMenu(false);
  }, []);

  const toggleEditorItemSelection = useCallback((vehicleKey: string) => {
    setEditorSelectedKeys((prev) =>
      prev.includes(vehicleKey)
        ? prev.filter((key) => key !== vehicleKey)
        : [...prev, vehicleKey],
    );
  }, []);

  const toggleSelectAllFilteredEditorItems = useCallback(() => {
    setEditorSelectedKeys((prev) => {
      const filteredKeys = filteredEditorItems.map((item) => getVehicleKey(item));
      const allSelected =
        filteredKeys.length > 0 && filteredKeys.every((key) => prev.includes(key));
      if (allSelected) {
        const filteredSet = new Set(filteredKeys);
        return prev.filter((key) => !filteredSet.has(key));
      }
      return Array.from(new Set([...prev, ...filteredKeys]));
    });
  }, [filteredEditorItems]);

  const clearEditorSelection = useCallback(() => {
    setEditorSelectedKeys([]);
    setShowEditorBulkMenu(false);
    setShowEditorBulkGroupMenu(false);
  }, []);

  const stripVehicleFromAssignmentIds = useCallback(
    (ids: string[], vehicleKey: string) => {
      const target = resolveInventoryItemKey(vehicleKey, itemsByKey) ?? vehicleKey;
      return ids.filter((id) => {
        const resolved = resolveInventoryItemKey(id, itemsByKey) ?? id;
        return resolved !== target && !isVehicleInAssignmentList([id], target);
      });
    },
    [itemsByKey],
  );

  const toggleItemInSection = (sectionId: SectionId, itemKey: string) => {
    setConfig((prev) => {
      const current = new Set(prev.sectionVehicleIds[sectionId] ?? []);
      if (current.has(itemKey)) current.delete(itemKey);
      else current.add(itemKey);
      return {
        ...prev,
        sectionVehicleIds: { ...prev.sectionVehicleIds, [sectionId]: Array.from(current) },
      };
    });
  };

  const toggleHidden = (itemKey: string) => {
    const canonicalKey = resolveInventoryItemKey(itemKey, itemsByKey) ?? itemKey;
    setConfig((prev) => {
      const currentlyHidden = filterHiddenVehicleIdsForVehicle(
        prev.hiddenVehicleIds,
        canonicalKey,
        itemsByKey,
      ).length < prev.hiddenVehicleIds.length;
      const nextHidden = currentlyHidden
        ? filterHiddenVehicleIdsForVehicle(prev.hiddenVehicleIds, canonicalKey, itemsByKey)
        : [...prev.hiddenVehicleIds, canonicalKey];
      const manualPublications = (prev.manualPublications ?? []).map((entry) => {
        const manualKey = getManualPublicationKey(entry);
        if (manualKey !== itemKey && manualKey !== canonicalKey) return entry;
        return { ...entry, visible: currentlyHidden };
      });
      return { ...prev, hiddenVehicleIds: nextHidden, manualPublications };
    });
  };

  const toggleCategoryHidden = useCallback(
    (categoryKey: string, label: string) => {
      setConfig((prev) => {
        const set = new Set(prev.hiddenCategoryIds ?? []);
        const willHide = !set.has(categoryKey);
        if (willHide) set.add(categoryKey);
        else set.delete(categoryKey);
        showSystemNotice(
          "success",
          willHide ? "Categoria oculta del home" : "Categoria visible en home",
          willHide
            ? `${label} quedo oculta del home sin eliminar vehiculos.`
            : `${label} volvio a mostrarse en el home.`,
        );
        return { ...prev, hiddenCategoryIds: Array.from(set) };
      });
    },
    [showSystemNotice],
  );

  const resolveSoldCategory = useCallback(
    (
      vehicleKey: string,
      currentConfig: EditorConfig,
      context?: {
        auctionId?: string;
        auctionName?: string;
        soldCategory?: string;
      },
    ): string => {
      const explicit = context?.soldCategory?.trim();
      if (explicit) return explicit;

      if (
        context?.auctionId ||
        context?.auctionName ||
        Boolean(currentConfig.vehicleUpcomingAuctionIds[vehicleKey])
      ) {
        return "Remate";
      }

      if (isVehicleInAssignmentList(currentConfig.sectionVehicleIds["ventas-directas"] ?? [], vehicleKey)) {
        return "Venta directa";
      }
      if (isVehicleInAssignmentList(currentConfig.sectionVehicleIds.novedades ?? [], vehicleKey)) {
        return "Novedades";
      }
      if (isVehicleInAssignmentList(currentConfig.sectionVehicleIds.catalogo ?? [], vehicleKey)) {
        return "Catalogo";
      }

      const managedCategory = (currentConfig.managedCategories ?? []).find((category) =>
        isVehicleInAssignmentList(category.vehicleIds ?? [], vehicleKey),
      );
      if (managedCategory) {
        return managedCategory.name?.trim()
          ? `Categoria: ${managedCategory.name.trim()}`
          : "Categoria personalizada";
      }

      return "Sin categoria";
    },
    [],
  );

  const buildSoldVehicleRecord = useCallback(
    (
      item: CatalogItem,
      context?: {
        auctionId?: string;
        auctionName?: string;
        soldCategory?: string;
      },
    ): SoldVehicleRecord => ({
      vehicleKey: getVehicleKey(item),
      patent: getPatent(item),
      title: getModel(item),
      soldAt: new Date().toISOString(),
      soldCategory: context?.soldCategory,
      auctionId: context?.auctionId,
      auctionName: context?.auctionName,
    }),
    [],
  );

  const markVehicleAsSold = useCallback(
    (
      vehicleKey: string,
      context?: {
        auctionId?: string;
        auctionName?: string;
        soldCategory?: string;
      },
    ) => {
      const item = itemsByKey.get(vehicleKey);
      if (!item) return;
      setConfig((prev) => {
        const soldRecord = buildSoldVehicleRecord(item, {
          ...context,
          soldCategory: resolveSoldCategory(vehicleKey, prev, context),
        });
        const soldSet = new Set(prev.soldVehicleIds ?? []);
        soldSet.add(vehicleKey);

        const hiddenSet = new Set(prev.hiddenVehicleIds ?? []);
        hiddenSet.add(vehicleKey);

        const nextAssignments = { ...prev.vehicleUpcomingAuctionIds };
        delete nextAssignments[vehicleKey];

        const nextSectionVehicleIds = {
          "proximos-remates": (prev.sectionVehicleIds["proximos-remates"] ?? []).filter(
            (id) => id !== vehicleKey,
          ),
          "ventas-directas": (prev.sectionVehicleIds["ventas-directas"] ?? []).filter(
            (id) => id !== vehicleKey,
          ),
          novedades: (prev.sectionVehicleIds.novedades ?? []).filter((id) => id !== vehicleKey),
          catalogo: (prev.sectionVehicleIds.catalogo ?? []).filter((id) => id !== vehicleKey),
        };

        const nextManagedCategories = (prev.managedCategories ?? []).map((category) => ({
          ...category,
          vehicleIds: (category.vehicleIds ?? []).filter((id) => id !== vehicleKey),
        }));

        const existingHistory = prev.soldVehicleHistory ?? [];
        const nextHistory = [soldRecord, ...existingHistory.filter((entry) => entry.vehicleKey !== vehicleKey)];

        return {
          ...prev,
          soldVehicleIds: Array.from(soldSet),
          soldVehicleHistory: nextHistory,
          hiddenVehicleIds: Array.from(hiddenSet),
          vehicleUpcomingAuctionIds: nextAssignments,
          sectionVehicleIds: nextSectionVehicleIds,
          managedCategories: nextManagedCategories,
        };
      });
    },
    [buildSoldVehicleRecord, itemsByKey, resolveSoldCategory],
  );

  const revertVehicleSale = useCallback((vehicleKey: string) => {
    setConfig((prev) => {
      const soldSet = new Set(prev.soldVehicleIds ?? []);
      soldSet.delete(vehicleKey);

      const hiddenSet = new Set(prev.hiddenVehicleIds ?? []);
      hiddenSet.delete(vehicleKey);

      const manualPublications = (prev.manualPublications ?? []).map((entry) => {
        if (getManualPublicationKey(entry) !== vehicleKey) return entry;
        return { ...entry, visible: true };
      });

      return {
        ...prev,
        soldVehicleIds: Array.from(soldSet),
        soldVehicleHistory: (prev.soldVehicleHistory ?? []).filter(
          (entry) => entry.vehicleKey !== vehicleKey,
        ),
        hiddenVehicleIds: Array.from(hiddenSet),
        manualPublications,
      };
    });
  }, []);

  const setPrice = (itemKey: string, value: string) => {
    setConfig((prev) => {
      const nextVehiclePrices = { ...prev.vehiclePrices, [itemKey]: value };
      const nextManualPublications = (prev.manualPublications ?? []).map((entry) => {
        if (getManualPublicationKey(entry) !== itemKey) return entry;
        const promoEnabled = Boolean(entry.promoEnabled && (entry.promoPrice ?? "").trim());
        return {
          ...entry,
          price: value,
          promoPrice: promoEnabled ? value : entry.promoPrice,
        };
      });
      return {
        ...prev,
        vehiclePrices: nextVehiclePrices,
        manualPublications: nextManualPublications,
      };
    });
  };

  const updateVehiclePromoSettings = (
    itemKey: string,
    patch: Partial<
      Pick<
        EditorVehicleDetails,
        "originalPrice" | "promoPrice" | "promoEnabled" | "taxFee" | "transferFee"
      >
    >,
  ) => {
    setConfig((prev) => {
      const nextDetails = { ...prev.vehicleDetails };
      const currentDetails = { ...(nextDetails[itemKey] ?? {}) };
      const nextPromoEnabled =
        typeof patch.promoEnabled === "boolean"
          ? patch.promoEnabled
          : typeof currentDetails.promoEnabled === "boolean"
            ? currentDetails.promoEnabled
            : false;
      const nextOriginalPriceRaw =
        typeof patch.originalPrice === "string"
          ? patch.originalPrice
          : (currentDetails.originalPrice ?? "");
      const nextPromoPriceRaw =
        typeof patch.promoPrice === "string" ? patch.promoPrice : (currentDetails.promoPrice ?? "");
      const nextTaxFeeRaw =
        typeof patch.taxFee === "string" ? patch.taxFee : (currentDetails.taxFee ?? "");
      const nextTransferFeeRaw =
        typeof patch.transferFee === "string"
          ? patch.transferFee
          : (currentDetails.transferFee ?? "");
      const nextOriginalPrice = nextOriginalPriceRaw.trim();
      const nextPromoPrice = nextPromoPriceRaw.trim();
      const activePrice = nextPromoEnabled && nextPromoPrice ? nextPromoPriceRaw : nextOriginalPriceRaw;

      currentDetails.originalPrice = nextOriginalPriceRaw;
      currentDetails.promoPrice = nextPromoPriceRaw;
      currentDetails.promoEnabled = nextPromoEnabled;
      currentDetails.taxFee = nextTaxFeeRaw;
      currentDetails.transferFee = nextTransferFeeRaw;
      nextDetails[itemKey] = currentDetails;

      const nextVehiclePrices = { ...prev.vehiclePrices, [itemKey]: activePrice };
      const nextManualPublications = (prev.manualPublications ?? []).map((entry) => {
        if (getManualPublicationKey(entry) !== itemKey) return entry;
        return {
          ...entry,
          originalPrice: nextOriginalPrice || undefined,
          promoPrice: nextPromoPrice || undefined,
          promoEnabled: nextPromoEnabled,
          price: activePrice,
        };
      });

      return {
        ...prev,
        vehicleDetails: nextDetails,
        vehiclePrices: nextVehiclePrices,
        manualPublications: nextManualPublications,
      };
    });
  };

  const setVehicleCategory = (itemKey: string, value: string) => {
    setConfig((prev) => {
      const nextDetails = { ...prev.vehicleDetails };
      const current = { ...(nextDetails[itemKey] ?? {}) };
      const normalized = normalizeVehicleCategoryValue(value);
      if (normalized) current.category = normalized;
      else delete current.category;
      if (Object.values(current).every((fieldValue) => !fieldValue)) {
        delete nextDetails[itemKey];
      } else {
        nextDetails[itemKey] = current;
      }
      return { ...prev, vehicleDetails: nextDetails };
    });
  };

  const setSectionText = (sectionId: SectionId, field: "title" | "subtitle", value: string) => {
    setConfig((prev) => ({
      ...prev,
      sectionTexts: {
        ...prev.sectionTexts,
        [sectionId]: {
          ...prev.sectionTexts[sectionId],
          [field]: value,
        },
      },
    }));
  };

  const setHomeLayout = (
    field: keyof EditorConfig["homeLayout"],
    value: string | boolean | HomeSectionOrderId[],
  ) => {
    setConfig((prev) => ({
      ...prev,
      homeLayout: {
        ...prev.homeLayout,
        [field]: value,
      },
    }));
  };

  const toggleHomeLayoutFlag = (
    field:
      | "showFeaturedStrip"
      | "showCommercialPanel"
      | "showHowToSection"
      | "showFavoritesSection"
      | "showRecentPublications"
      | "showSearchBar"
      | "showStickySearchBar"
      | "showQuickFilters"
      | "showSortSelector",
    checked: boolean,
  ) => {
    setHomeLayout(field, checked);
    if (field === "showSearchBar" && !checked) {
      setHomeSearchTerm("");
      setQuickFilters([]);
      setTopSectionFilter("all");
    }
    if (field === "showQuickFilters" && !checked) {
      setQuickFilters([]);
    }
  };

  const resetHomeLayoutToDefault = () => {
    setConfig((prev) => ({
      ...prev,
      homeLayout: {
        ...DEFAULT_EDITOR_CONFIG.homeLayout,
      },
    }));
    showSystemNotice(
      "info",
      "Layout restablecido",
      "Se restauro la configuracion base del Home Layout.",
    );
  };

  const moveSectionOrder = (sectionId: HomeSectionOrderId, direction: "up" | "down") => {
    setConfig((prev) => {
      const order = [...resolvedHomeSectionOrder];
      const index = order.indexOf(sectionId);
      if (index < 0) return prev;
      const target = direction === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= order.length) return prev;
      const [item] = order.splice(index, 1);
      order.splice(target, 0, item);
      return {
        ...prev,
        homeLayout: {
          ...prev.homeLayout,
          sectionOrder: order,
        },
      };
    });
  };

  const reorderHomeSectionOrder = useCallback(
    (fromSectionId: HomeSectionOrderId, toSectionId: HomeSectionOrderId) => {
      if (fromSectionId === toSectionId) return;
      setConfig((prev) => {
        const order = [...resolvedHomeSectionOrder];
        const fromIndex = order.indexOf(fromSectionId);
        const toIndex = order.indexOf(toSectionId);
        if (fromIndex < 0 || toIndex < 0) return prev;
        const [dragged] = order.splice(fromIndex, 1);
        order.splice(toIndex, 0, dragged);
        return {
          ...prev,
          homeLayout: {
            ...prev.homeLayout,
            sectionOrder: order,
          },
        };
      });
    },
    [resolvedHomeSectionOrder],
  );

  const createUpcomingAuction = () => {
    const name = newAuctionName.trim();
    const date = newAuctionDate.trim();
    if (!name || !date) {
      showSystemNotice("error", "Datos incompletos", "Debes completar nombre y fecha del remate.");
      return;
    }
    const id = `remate-${crypto.randomUUID()}`;
    setConfig((prev) => ({
      ...prev,
      upcomingAuctions: [...prev.upcomingAuctions, { id, name, date }],
    }));
    setNewAuctionName("");
    setNewAuctionDate("");
  };

  const createManagedCategory = (openAssign = false) => {
    const name = newCategoryName.trim();
    const description = newCategoryDescription.trim();
    if (!name) {
      showSystemNotice("error", "Categoria", "Ingresa un nombre para la nueva categoria.");
      return;
    }
    const normalizedName = normalizeText(name);
    const exists = (config.managedCategories ?? []).some(
      (category) => normalizeText(category.name) === normalizedName,
    );
    if (exists) {
      showSystemNotice("error", "Categoria duplicada", "Ya existe una categoria con ese nombre.");
      return;
    }
    const next: ManagedCategory = {
      id: `cat-${crypto.randomUUID()}`,
      name,
      description: description || "Categoria personalizada",
      vehicleIds: [],
      visible: true,
    };
    setConfig((prev) => ({
      ...prev,
      managedCategories: [...(prev.managedCategories ?? []), next],
    }));
    if (openAssign) {
      setAssignCategoryId(next.id);
      setAssignSearchTerm("");
    }
    setNewCategoryName("");
    setNewCategoryDescription("");
    setShowCreateCategoryForm(false);
    showSystemNotice(
      "success",
      "Categoria creada",
      openAssign ? "Selecciona las unidades para esta categoria." : "Ahora puedes asignar vehiculos.",
    );
  };

  const updateManagedCategory = (
    categoryId: string,
    patch: Partial<Pick<ManagedCategory, "name" | "description" | "visible">>,
  ) => {
    setConfig((prev) => ({
      ...prev,
      managedCategories: (prev.managedCategories ?? []).map((category) =>
        category.id === categoryId ? { ...category, ...patch } : category,
      ),
    }));
  };

  const deleteManagedCategory = (categoryId: string) => {
    setConfig((prev) => {
      const hidden = new Set(prev.hiddenCategoryIds ?? []);
      hidden.delete(managedCategoryKey(categoryId));
      return {
        ...prev,
        managedCategories: (prev.managedCategories ?? []).filter((category) => category.id !== categoryId),
        hiddenCategoryIds: Array.from(hidden),
      };
    });
    if (assignCategoryId === categoryId) setAssignCategoryId(null);
  };

  const toggleVehicleInManagedCategory = (categoryId: string, vehicleKey: string) => {
    setConfig((prev) => ({
      ...prev,
      managedCategories: (prev.managedCategories ?? []).map((category) => {
        if (category.id !== categoryId) return category;
        const set = new Set(category.vehicleIds ?? []);
        if (set.has(vehicleKey)) set.delete(vehicleKey);
        else set.add(vehicleKey);
        return { ...category, vehicleIds: Array.from(set) };
      }),
    }));
  };

  const toggleBatchAssignVehicle = (vehicleKey: string) => {
    setBatchAssignSelectedKeys((prev) => {
      if (prev.includes(vehicleKey)) return prev.filter((key) => key !== vehicleKey);
      return [...prev, vehicleKey];
    });
  };

  const openBatchAssignModal = (target: BatchAssignTarget) => {
    pendingAddStockTargetRef.current = target;
    setBatchAssignTarget(target);
    setBatchAssignSearchTerm("");
    setBatchAssignSelectedKeys([]);
  };

  const changeBatchAssignTarget = (value: string) => {
    const target: BatchAssignTarget = value.startsWith("auction:")
      ? { type: "auction", auctionId: value.slice("auction:".length) }
      : {
          type: "section",
          sectionId: value.slice("section:".length) as SectionId,
        };
    pendingAddStockTargetRef.current = target;
    setBatchAssignTarget(target);
  };

  const batchAssignTargetSelectValue = batchAssignTarget
    ? batchAssignTarget.type === "auction"
      ? `auction:${batchAssignTarget.auctionId}`
      : `section:${batchAssignTarget.sectionId}`
    : "section:catalogo";

  const closeBatchAssignModal = () => {
    setBatchAssignTarget(null);
    setBatchAssignSearchTerm("");
    setBatchAssignSelectedKeys([]);
    pendingAddStockTargetRef.current = null;
  };

  const resolveBatchAssignTargetFromEditor = (): BatchAssignTarget | null => {
    if (
      editorGroupFilter === "ventas-directas" ||
      editorGroupFilter === "novedades" ||
      editorGroupFilter === "catalogo"
    ) {
      return { type: "section", sectionId: editorGroupFilter };
    }
    if (editorGroupFilter === "proximos-remates" && auctionFilterId) {
      return { type: "auction", auctionId: auctionFilterId };
    }
    return pendingAddStockTargetRef.current;
  };

  const openAddVehicleFromStock = (explicitTarget?: BatchAssignTarget) => {
    const target =
      explicitTarget ??
      resolveBatchAssignTargetFromEditor() ?? {
        type: "section",
        sectionId: "catalogo",
      };
    openBatchAssignModal(target);
  };

  const openAddVehicleNew = (sectionIds?: SectionId[]) => {
    if (adminTab !== "vehiculos") {
      setAdminTab("vehiculos");
    }
    if (sectionIds && sectionIds.length > 0) {
      setPublicationModalMode("create");
      setEditingPublicationKey(null);
      setPublicationInitialTab("general");
      setManualDraft({
        ...EMPTY_MANUAL_PUBLICATION_DRAFT,
        sectionIds,
      });
      setManualUploadedImages([]);
      setShowManualCreateModal(true);
      return;
    }
    openCreateManualModal();
  };

  const resolveDefaultBulkSections = (sectionIds?: SectionId[]): SectionId[] => {
    if (sectionIds && sectionIds.length > 0) return sectionIds;
    if (
      editorGroupFilter === "ventas-directas" ||
      editorGroupFilter === "novedades" ||
      editorGroupFilter === "catalogo" ||
      editorGroupFilter === "proximos-remates"
    ) {
      return [editorGroupFilter];
    }
    return ["catalogo"];
  };

  const openAddVehicleBulk = (sectionIds?: SectionId[]) => {
    if (adminTab !== "vehiculos") {
      setAdminTab("vehiculos");
    }
    setBulkDefaultSectionIds(resolveDefaultBulkSections(sectionIds));
    setShowBulkManualModal(true);
  };

  const addBatchVehiclesToTarget = () => {
    if (!batchAssignTarget) return;
    if (batchAssignSelectedKeys.length === 0) {
      showSystemNotice("info", "Sin seleccion", "Selecciona al menos un vehiculo para agregar.");
      return;
    }

    const canonicalKeys = Array.from(
      new Set(
        batchAssignSelectedKeys
          .map((key) => resolveInventoryItemKey(key, itemsByKey) ?? key)
          .filter(Boolean),
      ),
    );

    const focusInventoryAfterAssign = () => {
      setEditorVisibilityFilter("all");
      setEditorGroupFilter("home");
      setEditorPage(1);
      if (canonicalKeys.length === 1) {
        const item = resolveInventoryItem(canonicalKeys[0]!, itemsByKey);
        if (item) setSearchTerm(getPatent(item));
      }
    };

    if (batchAssignTarget.type === "auction") {
      setConfig((prev) => {
        const nextAuctionMap = { ...prev.vehicleUpcomingAuctionIds };
        for (const vehicleKey of canonicalKeys) {
          nextAuctionMap[vehicleKey] = batchAssignTarget.auctionId;
        }
        return { ...prev, vehicleUpcomingAuctionIds: nextAuctionMap };
      });
    } else {
      const sectionId = batchAssignTarget.sectionId;
      const alreadyAssigned = canonicalKeys.filter((vehicleKey) =>
        isVehicleAssignedInSectionList(
          config.sectionVehicleIds[sectionId] ?? [],
          vehicleKey,
          itemsByKey,
        ),
      );
      const newlyAdded = canonicalKeys.filter(
        (vehicleKey) => !alreadyAssigned.includes(vehicleKey),
      );

      if (newlyAdded.length === 0) {
        if (alreadyAssigned.length > 0) {
          const hiddenButAssigned = alreadyAssigned.filter((vehicleKey) =>
            mergedHiddenVehicleIds.has(vehicleKey),
          );
          setConfig((prev) => {
            const current = new Set(
              (prev.sectionVehicleIds[sectionId] ?? [])
                .map((id) => resolveInventoryItemKey(id, itemsByKey) ?? id)
                .filter(Boolean),
            );
            for (const vehicleKey of alreadyAssigned) current.add(vehicleKey);
            return {
              ...prev,
              hiddenVehicleIds: unhideVehiclesInConfig(
                prev.hiddenVehicleIds,
                alreadyAssigned,
                itemsByKey,
              ),
              sectionVehicleIds: {
                ...prev.sectionVehicleIds,
                [sectionId]: Array.from(current),
              },
            };
          });
          showSystemNotice(
            "success",
            "Unidades confirmadas",
            hiddenButAssigned.length > 0
              ? `${alreadyAssigned.length} vehiculo(s) ya estaban en ${batchAssignTargetLabel}. Se normalizo la asignacion y ${hiddenButAssigned.length} quedo visible en el home.`
              : `${alreadyAssigned.length} vehiculo(s) ya estaban en ${batchAssignTargetLabel}. Se normalizo la asignacion para que aparezcan en el listado.`,
          );
          focusInventoryAfterAssign();
          closeBatchAssignModal();
          return;
        }

        showSystemNotice(
          "info",
          "Sin cambios",
          "No se pudo agregar ninguna unidad seleccionada.",
        );
        return;
      }

      setConfig((prev) => {
        const current = new Set(
          (prev.sectionVehicleIds[sectionId] ?? [])
            .map((id) => resolveInventoryItemKey(id, itemsByKey) ?? id)
            .filter(Boolean),
        );
        for (const vehicleKey of newlyAdded) current.add(vehicleKey);
        return {
          ...prev,
          hiddenVehicleIds: unhideVehiclesInConfig(
            prev.hiddenVehicleIds,
            [...newlyAdded, ...alreadyAssigned],
            itemsByKey,
          ),
          sectionVehicleIds: {
            ...prev.sectionVehicleIds,
            [sectionId]: Array.from(current),
          },
        };
      });

      const skippedMessage =
        alreadyAssigned.length > 0
          ? ` ${alreadyAssigned.length} ya estaban en la categoria.`
          : batchAssignMissingPatents.length > 0
            ? ` ${batchAssignMissingPatents.length} patente(s) no estan en inventario activo.`
            : "";

      showSystemNotice(
        "success",
        "Unidades agregadas",
        `${newlyAdded.length} vehiculo(s) agregado(s) en ${batchAssignTargetLabel}.${skippedMessage}`,
      );
      focusInventoryAfterAssign();
      closeBatchAssignModal();
      return;
    }

    showSystemNotice(
      "success",
      "Unidades agregadas",
      `${canonicalKeys.length} vehiculos agregados en ${batchAssignTargetLabel}.`,
    );
    closeBatchAssignModal();
  };

  const toggleManualDraftSection = (sectionId: SectionId) => {
    setManualDraft((prev) => {
      const set = new Set(prev.sectionIds);
      if (set.has(sectionId)) set.delete(sectionId);
      else set.add(sectionId);
      return { ...prev, sectionIds: Array.from(set) as SectionId[] };
    });
  };

  const uploadManualFiles = async (files: File[]) => {
    const validFiles = files.filter((file) => file.type.startsWith("image/"));
    if (validFiles.length === 0) {
      showSystemNotice("error", "Archivos invalidos", "Selecciona archivos de imagen validos.");
      return;
    }
    setManualUploading(true);
    try {
      const payload = new FormData();
      for (const file of validFiles) {
        payload.append("files", file);
      }
      const response = await fetch("/api/admin/cloudinary-upload", {
        method: "POST",
        body: payload,
      });
      const body = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        urls?: string[];
        error?: string;
      };
      if (!response.ok || !body.ok) {
        showSystemNotice(
          "error",
          "Error subiendo imagenes",
          body.error ?? "No fue posible subir imagenes a Cloudinary.",
        );
        return;
      }
      const urls = body.urls ?? [];
      setManualUploadedImages((prev) => Array.from(new Set([...prev, ...urls])));
      showSystemNotice("success", "Imagenes cargadas", `${urls.length} imagen(es) subida(s) correctamente.`);
    } finally {
      setManualUploading(false);
      if (manualFileInputRef.current) manualFileInputRef.current.value = "";
    }
  };

  const handleManualDropFiles = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setManualDropActive(false);
    const dropped = Array.from(event.dataTransfer.files ?? []);
    if (dropped.length === 0) return;
    await uploadManualFiles(dropped);
  };

  const reorderManualImage = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
    setManualUploadedImages((prev) => {
      const list = [...prev];
      if (fromIndex >= list.length || toIndex >= list.length) return prev;
      const [moved] = list.splice(fromIndex, 1);
      list.splice(toIndex, 0, moved);
      return list;
    });
  };

  const resetPublicationModal = () => {
    setManualDraft(EMPTY_MANUAL_PUBLICATION_DRAFT);
    setManualUploadedImages([]);
    setManualDropActive(false);
    setDraggedImageIndex(null);
    setShowManualCreateModal(false);
    setPublicationModalMode(null);
    setEditingPublicationKey(null);
    setPublicationInitialTab("general");
    setAutoredLookupLoading(false);
  };

  const lookupAutoredPatent = async (patente: string) => {
    const normalized = patente.toUpperCase().replace(/\s+/g, "").replace(/-/g, "");
    if (normalized.length < 4) {
      showSystemNotice(
        "error",
        "Autored",
        "Ingresa una patente valida (al menos 4 caracteres) en Datos principales antes de consultar.",
      );
      return;
    }
    const cooldown = getAutoredClientCooldownMs();
    if (cooldown > 0) {
      showSystemNotice(
        "error",
        "Autored",
        `Autored en pausa por limite de consultas. Espera ${Math.ceil(cooldown / 60_000)} minuto(s) e intenta de nuevo.`,
      );
      return;
    }
    setAutoredLookupLoading(true);
    try {
      const payload = await lookupAutoredPatentClient(normalized);
      if (!payload.ok || !payload.fields) {
        if (payload.code === "AUTORED_NOT_CONFIGURED") {
          showSystemNotice(
            "error",
            "Autored no configurado",
            payload.error ??
              "Agrega AUTORED_EMAIL y AUTORED_PASSWORD en Vercel o .env.local para autocompletar la ficha tecnica.",
          );
        } else if (payload.status === 429 || payload.code === "RATE_LIMITED") {
          showSystemNotice(
            "error",
            "Autored",
            payload.error ?? "Autored limito las consultas. Espera unos minutos e intenta de nuevo.",
          );
        } else {
          showSystemNotice(
            "error",
            "Autored",
            payload.error ??
              (payload.status === 404
                ? `No se encontraron datos de mecanica para ${normalized} en Autored.`
                : "No se pudo consultar Autored para esta patente."),
          );
        }
        return;
      }
      const fields = payload.fields;
      const mechanicalFilled = [
        fields.color,
        fields.combustible,
        fields.transmision,
        fields.traccion,
        fields.aro,
        fields.cilindrada,
      ].filter((value) => value?.trim()).length;
      setManualDraft((prev) =>
        applyAutoredLookupToDraft(
          {
            ...prev,
            patente: fields.patente ?? normalized,
          },
          fields,
        ),
      );
      if (mechanicalFilled > 0) {
        showSystemNotice(
          "success",
          "Autored",
          payload.fromCache
            ? `Datos de mecanica cargados desde cache local para ${normalized}.`
            : `Se completaron ${mechanicalFilled} campo(s) de mecanica para ${normalized}.`,
        );
      }
    } finally {
      setAutoredLookupLoading(false);
    }
  };

  const openEditVehicleModal = (
    item: CatalogItem,
    initialTab: "general" | "tecnica" | "medios" | "publicacion" = "general",
  ) => {
    if (!isAdmin || isBootstrapping) return;
    const key = getVehicleKey(item);
    const draft = buildPublicationDraftFromItem(item, config, key);
    const images = draft.imagesCsv
      ? normalizeCloudinaryImages(draft.imagesCsv)
      : item.images.filter((url) => url.startsWith("http"));
    setEditingPublicationKey(key);
    setPublicationModalMode("edit");
    setPublicationInitialTab(initialTab);
    setManualDraft(draft);
    setManualUploadedImages(images);
    setShowManualCreateModal(true);

    const patente = normalizePatentToken(draft.patente || getPatent(item));
    if (!draft.view3dUrl?.trim() && patente) {
      void (async () => {
        try {
          const glo3dResponse = await fetch("/api/admin/glo3d-lookup", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ patentes: [patente] }),
          });
          const glo3dPayload = (await glo3dResponse.json().catch(() => ({}))) as {
            ok?: boolean;
            byPatent?: Record<
              string,
              {
                view3dUrl?: string;
                technicalFields?: Record<string, unknown>;
                raw?: Record<string, unknown>;
              }
            >;
          };
          const entry = glo3dPayload.byPatent?.[patente];
          if (!glo3dResponse.ok || !glo3dPayload.ok || !entry) return;

          const syntheticItem: CatalogItem = {
            id: patente,
            title: patente,
            images: [],
            view3dUrl: entry.view3dUrl,
            raw: {
              patente,
              PPU: patente,
              ...(entry.technicalFields ?? {}),
              glo3d: entry.raw ?? {},
            },
          };
          const glo3dOps = extractGlo3dOperationDetails(syntheticItem);
          const resolvedThumb = entry.raw ? resolveGlo3dThumbnailFromRecord(entry.raw) : undefined;

          setManualDraft((prev) =>
            mergeGlo3dOperationIntoDraft(
              {
                ...prev,
                view3dUrl: entry.view3dUrl?.trim() ?? prev.view3dUrl,
                thumbnail:
                  prev.thumbnail?.trim() && !isPlaceholderCatalogThumbnail(prev.thumbnail)
                    ? prev.thumbnail
                    : resolvedThumb ?? prev.thumbnail,
              },
              glo3dOps,
              true,
            ),
          );
        } catch {
          // Ignorar errores de red al buscar GLO3D bajo demanda.
        }
      })();
    }
  };

  const openCreateManualModal = () => {
    const defaultSections: SectionId[] =
      editorGroupFilter === "ventas-directas" ||
      editorGroupFilter === "novedades" ||
      editorGroupFilter === "catalogo" ||
      editorGroupFilter === "proximos-remates"
        ? [editorGroupFilter]
        : ["catalogo"];
    setPublicationModalMode("create");
    setEditingPublicationKey(null);
    setPublicationInitialTab("general");
    setManualDraft({
      ...EMPTY_MANUAL_PUBLICATION_DRAFT,
      sectionIds: defaultSections,
    });
    setManualUploadedImages([]);
    setShowManualCreateModal(true);
  };

  const createManualPublication = () => {
    const patente = cleanOptional(manualDraft.patente)?.toUpperCase().replace(/\s+/g, "").replace(/-/g, "") ?? "";
    const autoTitle = buildVehicleTitleFromParts(manualDraft);
    const title = manualDraft.title?.trim() || autoTitle || patente;
    if (!title && !patente) {
      showSystemNotice(
        "error",
        "Publicacion manual",
        "Ingresa al menos patente o titulo/marca-modelo para crear la publicacion.",
      );
      return;
    }
    const cloudinaryImages = Array.from(
      new Set([...manualUploadedImages, ...normalizeCloudinaryImages(manualDraft.imagesCsv)]),
    );
    const id = crypto.randomUUID();
    const sectionIds: SectionId[] =
      manualDraft.sectionIds.length > 0 ? manualDraft.sectionIds : ["catalogo"];
    const normalizedNormalPrice = cleanOptional(manualDraft.normalPrice);
    const normalizedPromoPrice = cleanOptional(manualDraft.promoPrice);
    if (manualDraft.promoEnabled && !normalizedPromoPrice) {
      showSystemNotice(
        "error",
        "Precio promocional",
        "Activa un precio de oferta antes de crear la publicacion.",
      );
      return;
    }
    const promoEnabled = Boolean(manualDraft.promoEnabled && normalizedPromoPrice);
    const activePrice = promoEnabled ? normalizedPromoPrice : normalizedNormalPrice;
    const thumbnail =
      cleanOptional(manualDraft.thumbnail) ?? cloudinaryImages[0] ?? "/placeholder-car.svg";

    const manual: ManualPublication = {
      id,
      title,
      subtitle: cleanOptional(manualDraft.subtitle),
      status: cleanOptional(manualDraft.status),
      location: cleanOptional(manualDraft.location),
      lot: cleanOptional(manualDraft.lot),
      auctionDate: cleanOptional(manualDraft.auctionDate),
      description: cleanOptional(manualDraft.description),
      patente: cleanOptional(patente),
      brand: cleanOptional(manualDraft.brand),
      model: cleanOptional(manualDraft.model),
      year: cleanOptional(manualDraft.year),
      category: cleanOptional(manualDraft.category),
      images: cloudinaryImages.length > 0 ? cloudinaryImages : [thumbnail],
      thumbnail,
      view3dUrl: cleanOptional(manualDraft.view3dUrl),
      sectionIds,
      upcomingAuctionId: cleanOptional(manualDraft.upcomingAuctionId),
      visible: manualDraft.visible,
      price: activePrice,
      originalPrice: normalizedNormalPrice,
      promoPrice: normalizedPromoPrice,
      promoEnabled,
    };

    const itemKey = getManualPublicationKey(manual);
    const detailsDraft = buildManualDraftDetails({
      ...manualDraft,
      title,
      patente,
      thumbnail,
      originalPrice: normalizedNormalPrice ?? "",
      promoPrice: normalizedPromoPrice ?? "",
      promoEnabled,
      imagesCsv: cloudinaryImages.join(", "),
    });

    setConfig((prev) => {
      const nextSectionVehicleIds = { ...prev.sectionVehicleIds };
      for (const sectionId of sectionIds) {
        const set = new Set(nextSectionVehicleIds[sectionId] ?? []);
        set.add(itemKey);
        nextSectionVehicleIds[sectionId] = Array.from(set);
      }
      const nextHidden = new Set(prev.hiddenVehicleIds);
      if (!manual.visible) nextHidden.add(itemKey);
      const nextVehiclePrices = { ...prev.vehiclePrices };
      if (manual.price) nextVehiclePrices[itemKey] = manual.price;
      const nextVehicleUpcomingAuctionIds = { ...prev.vehicleUpcomingAuctionIds };
      if (manual.upcomingAuctionId) nextVehicleUpcomingAuctionIds[itemKey] = manual.upcomingAuctionId;

      return {
        ...prev,
        sectionVehicleIds: nextSectionVehicleIds,
        hiddenVehicleIds: Array.from(nextHidden),
        vehiclePrices: nextVehiclePrices,
        vehicleUpcomingAuctionIds: nextVehicleUpcomingAuctionIds,
        vehicleDetails: {
          ...prev.vehicleDetails,
          [itemKey]: detailsDraft,
        },
        manualPublications: [...(prev.manualPublications ?? []), manual],
      };
    });

    resetPublicationModal();
    showSystemNotice(
      "success",
      "Unidad creada",
      patente
        ? `Publicacion manual creada. Se sincronizara automaticamente si GLO3D recibe la patente ${patente}.`
        : "La nueva unidad se agrego correctamente al inventario.",
    );
  };

  const saveVehiclePublication = () => {
    if (publicationModalMode === "create") {
      createManualPublication();
      return;
    }
    if (!editingPublicationKey) return;

    const patente =
      cleanOptional(manualDraft.patente)?.toUpperCase().replace(/\s+/g, "").replace(/-/g, "") ?? "";
    const autoTitle = buildVehicleTitleFromParts(manualDraft);
    const title = manualDraft.title?.trim() || autoTitle || patente;
    if (!title && !patente) {
      showSystemNotice(
        "error",
        "Publicacion",
        "Ingresa al menos patente o titulo/marca-modelo para guardar la unidad.",
      );
      return;
    }

    const cloudinaryImages = Array.from(
      new Set([...manualUploadedImages, ...normalizeCloudinaryImages(manualDraft.imagesCsv)]),
    );
    const sectionIds: SectionId[] =
      manualDraft.sectionIds.length > 0 ? manualDraft.sectionIds : ["catalogo"];
    const normalizedNormalPrice = cleanOptional(manualDraft.normalPrice);
    const normalizedPromoPrice = cleanOptional(manualDraft.promoPrice);
    if (manualDraft.promoEnabled && !normalizedPromoPrice) {
      showSystemNotice(
        "error",
        "Precio promocional",
        "Activa un precio de oferta antes de guardar la publicacion.",
      );
      return;
    }
    const promoEnabled = Boolean(manualDraft.promoEnabled && normalizedPromoPrice);
    const activePrice = promoEnabled ? normalizedPromoPrice : normalizedNormalPrice;
    const thumbnail =
      cleanOptional(manualDraft.thumbnail) ?? cloudinaryImages[0] ?? "/placeholder-car.svg";
    const detailsDraft = buildManualDraftDetails({
      ...manualDraft,
      title,
      patente,
      thumbnail,
      originalPrice: normalizedNormalPrice ?? "",
      promoPrice: normalizedPromoPrice ?? "",
      promoEnabled,
      imagesCsv: cloudinaryImages.join(", "),
    });
    const vehicleKey = editingPublicationKey;
    const editingItem = itemsByKey.get(vehicleKey) ?? null;

    setConfig((prev) => {
      const nextSectionVehicleIds = { ...prev.sectionVehicleIds };
      for (const sectionId of PUBLICATION_SECTION_IDS) {
        const current = nextSectionVehicleIds[sectionId] ?? [];
        const shouldInclude = sectionIds.includes(sectionId);
        if (shouldInclude && !current.includes(vehicleKey)) {
          nextSectionVehicleIds[sectionId] = [...current, vehicleKey];
        } else if (!shouldInclude && current.includes(vehicleKey)) {
          nextSectionVehicleIds[sectionId] = current.filter((entry) => entry !== vehicleKey);
        }
      }

      const nextHidden = new Set(prev.hiddenVehicleIds);
      if (!manualDraft.visible) nextHidden.add(vehicleKey);
      else nextHidden.delete(vehicleKey);

      const nextVehiclePrices = { ...prev.vehiclePrices };
      if (activePrice) nextVehiclePrices[vehicleKey] = activePrice;
      else delete nextVehiclePrices[vehicleKey];

      const nextVehicleUpcomingAuctionIds = { ...prev.vehicleUpcomingAuctionIds };
      if (manualDraft.upcomingAuctionId) {
        nextVehicleUpcomingAuctionIds[vehicleKey] = manualDraft.upcomingAuctionId;
      } else {
        delete nextVehicleUpcomingAuctionIds[vehicleKey];
      }

      let nextManualPublications = prev.manualPublications ?? [];
      if (editingItem && isManualCatalogItem(editingItem)) {
        const manualId = String((editingItem.raw as Record<string, unknown>).manual_id ?? "");
        nextManualPublications = nextManualPublications.map((entry) => {
          if (entry.id !== manualId) return entry;
          return {
            ...entry,
            title,
            subtitle: cleanOptional(manualDraft.subtitle),
            status: cleanOptional(manualDraft.status),
            location: cleanOptional(manualDraft.location),
            lot: cleanOptional(manualDraft.lot),
            auctionDate: cleanOptional(manualDraft.auctionDate),
            description: cleanOptional(manualDraft.description),
            patente: cleanOptional(patente),
            brand: cleanOptional(manualDraft.brand),
            model: cleanOptional(manualDraft.model),
            year: cleanOptional(manualDraft.year),
            category: cleanOptional(manualDraft.category),
            images: cloudinaryImages.length > 0 ? cloudinaryImages : [thumbnail],
            thumbnail,
            view3dUrl: cleanOptional(manualDraft.view3dUrl),
            sectionIds,
            upcomingAuctionId: cleanOptional(manualDraft.upcomingAuctionId),
            visible: manualDraft.visible,
            price: activePrice,
            originalPrice: normalizedNormalPrice,
            promoPrice: normalizedPromoPrice,
            promoEnabled,
          };
        });
      }

      return {
        ...prev,
        sectionVehicleIds: nextSectionVehicleIds,
        hiddenVehicleIds: Array.from(nextHidden),
        vehiclePrices: nextVehiclePrices,
        vehicleUpcomingAuctionIds: nextVehicleUpcomingAuctionIds,
        vehicleDetails: {
          ...prev.vehicleDetails,
          [vehicleKey]: detailsDraft,
        },
        manualPublications: nextManualPublications,
      };
    });

    resetPublicationModal();
    showSystemNotice(
      "success",
      "Unidad actualizada",
      patente
        ? `Los cambios de ${patente} se guardaron correctamente.`
        : "Los cambios se guardaron correctamente.",
    );
  };

  const deleteManualPublication = (manualId: string) => {
    setConfig((prev) => {
      const manual = (prev.manualPublications ?? []).find((entry) => entry.id === manualId);
      if (!manual) return prev;
      const key = getManualPublicationKey(manual);
      const nextSectionVehicleIds: Record<SectionId, string[]> = {
        "proximos-remates": (prev.sectionVehicleIds["proximos-remates"] ?? []).filter((id) => id !== key),
        "ventas-directas": (prev.sectionVehicleIds["ventas-directas"] ?? []).filter((id) => id !== key),
        novedades: (prev.sectionVehicleIds.novedades ?? []).filter((id) => id !== key),
        catalogo: (prev.sectionVehicleIds.catalogo ?? []).filter((id) => id !== key),
      };
      const nextHidden = prev.hiddenVehicleIds.filter((id) => id !== key);
      const nextPrices = { ...prev.vehiclePrices };
      delete nextPrices[key];
      const nextAssignments = { ...prev.vehicleUpcomingAuctionIds };
      delete nextAssignments[key];
      const nextDetails = { ...prev.vehicleDetails };
      delete nextDetails[key];

      return {
        ...prev,
        manualPublications: (prev.manualPublications ?? []).filter((entry) => entry.id !== manualId),
        sectionVehicleIds: nextSectionVehicleIds,
        hiddenVehicleIds: nextHidden,
        vehiclePrices: nextPrices,
        vehicleUpcomingAuctionIds: nextAssignments,
        vehicleDetails: nextDetails,
      };
    });
  };

  const removeVehicleFromHomeEditor = useCallback(
    (vehicleKey: string) => {
      const item = itemsByKey.get(vehicleKey);
      if (item && isManualCatalogItem(item)) {
        const manual = (config.manualPublications ?? []).find(
          (entry) => getManualPublicationKey(entry) === vehicleKey,
        );
        if (manual) deleteManualPublication(manual.id);
        return;
      }
      const canonicalKey = resolveInventoryItemKey(vehicleKey, itemsByKey) ?? vehicleKey;
      setConfig((prev) => {
        const nextAssignments = { ...prev.vehicleUpcomingAuctionIds };
        delete nextAssignments[canonicalKey];
        delete nextAssignments[vehicleKey];
        const nextPrices = { ...prev.vehiclePrices };
        delete nextPrices[canonicalKey];
        delete nextPrices[vehicleKey];
        const nextDetails = { ...prev.vehicleDetails };
        delete nextDetails[canonicalKey];
        delete nextDetails[vehicleKey];
        const nextHidden = new Set(prev.hiddenVehicleIds);
        nextHidden.add(canonicalKey);
        return {
          ...prev,
          hiddenVehicleIds: Array.from(nextHidden),
          vehicleUpcomingAuctionIds: nextAssignments,
          vehiclePrices: nextPrices,
          vehicleDetails: nextDetails,
          sectionVehicleIds: {
            "proximos-remates": stripVehicleFromAssignmentIds(
              prev.sectionVehicleIds["proximos-remates"] ?? [],
              vehicleKey,
            ),
            "ventas-directas": stripVehicleFromAssignmentIds(
              prev.sectionVehicleIds["ventas-directas"] ?? [],
              vehicleKey,
            ),
            novedades: stripVehicleFromAssignmentIds(
              prev.sectionVehicleIds.novedades ?? [],
              vehicleKey,
            ),
            catalogo: stripVehicleFromAssignmentIds(
              prev.sectionVehicleIds.catalogo ?? [],
              vehicleKey,
            ),
          },
          managedCategories: (prev.managedCategories ?? []).map((category) => ({
            ...category,
            vehicleIds: stripVehicleFromAssignmentIds(category.vehicleIds ?? [], vehicleKey),
          })),
        };
      });
    },
    [config.manualPublications, itemsByKey, stripVehicleFromAssignmentIds],
  );

  const applyBulkEditorInventoryAction = useCallback(
    (action: "show" | "hide" | "sold" | "remove") => {
      if (editorSelectedKeys.length === 0) return;
      const keys = [...editorSelectedKeys];
      if (action === "show") {
        setConfig((prev) => ({
          ...prev,
          hiddenVehicleIds: unhideVehiclesInConfig(prev.hiddenVehicleIds, keys, itemsByKey),
        }));
        showSystemNotice(
          "success",
          "Visibilidad",
          `${keys.length} unidad(es) visible(s) en home.`,
        );
      } else if (action === "hide") {
        setConfig((prev) => {
          const nextHidden = new Set(prev.hiddenVehicleIds);
          for (const key of keys) {
            nextHidden.add(resolveInventoryItemKey(key, itemsByKey) ?? key);
          }
          return { ...prev, hiddenVehicleIds: Array.from(nextHidden) };
        });
        showSystemNotice(
          "success",
          "Visibilidad",
          `${keys.length} unidad(es) oculta(s) del home.`,
        );
      } else if (action === "sold") {
        for (const key of keys) markVehicleAsSold(key);
        showSystemNotice(
          "success",
          "Vendidas",
          `${keys.length} unidad(es) movida(s) a historial.`,
        );
      } else {
        for (const key of keys) removeVehicleFromHomeEditor(key);
        showSystemNotice(
          "success",
          "Eliminadas",
          `${keys.length} unidad(es) quitada(s) del home.`,
        );
      }
      clearEditorSelection();
    },
    [
      clearEditorSelection,
      editorSelectedKeys,
      itemsByKey,
      markVehicleAsSold,
      removeVehicleFromHomeEditor,
      showSystemNotice,
    ],
  );

  const assignVehicleKeysToSection = useCallback(
    (sectionId: SectionId, rawKeys: string[]) => {
      const canonicalKeys = Array.from(
        new Set(
          rawKeys
            .map((key) => resolveInventoryItemKey(key, itemsByKey) ?? key)
            .filter(Boolean),
        ),
      );
      if (canonicalKeys.length === 0) return 0;

      setConfig((prev) => {
        const current = new Set(
          (prev.sectionVehicleIds[sectionId] ?? [])
            .map((id) => resolveInventoryItemKey(id, itemsByKey) ?? id)
            .filter(Boolean),
        );
        for (const vehicleKey of canonicalKeys) current.add(vehicleKey);
        return {
          ...prev,
          hiddenVehicleIds: unhideVehiclesInConfig(prev.hiddenVehicleIds, canonicalKeys, itemsByKey),
          sectionVehicleIds: {
            ...prev.sectionVehicleIds,
            [sectionId]: Array.from(current),
          },
        };
      });
      return canonicalKeys.length;
    },
    [itemsByKey],
  );

  const applyBulkAssignToSection = useCallback(
    (sectionId: SectionId) => {
      if (editorSelectedKeys.length === 0) return;
      const count = assignVehicleKeysToSection(sectionId, editorSelectedKeys);
      if (count === 0) return;
      showSystemNotice(
        "success",
        "Grupo actualizado",
        `${count} unidad(es) agregada(s) a ${SECTION_LABELS[sectionId]}.`,
      );
      setEditorVisibilityFilter("all");
      setEditorGroupFilter(sectionId);
      setEditorPage(1);
      setShowEditorBulkGroupMenu(false);
      setShowEditorBulkMenu(false);
      clearEditorSelection();
    },
    [
      assignVehicleKeysToSection,
      clearEditorSelection,
      editorSelectedKeys,
      showSystemNotice,
    ],
  );

  const removeUpcomingAuction = (auctionId: string) => {
    setConfig((prev) => {
      const nextAssignments = { ...prev.vehicleUpcomingAuctionIds };
      for (const [vehicleKey, value] of Object.entries(nextAssignments)) {
        if (value === auctionId) delete nextAssignments[vehicleKey];
      }
      const assignedVehicleKeys = new Set(Object.keys(nextAssignments));
      const hidden = new Set(prev.hiddenCategoryIds ?? []);
      hidden.delete(auctionCategoryKey(auctionId));
      return {
        ...prev,
        upcomingAuctions: prev.upcomingAuctions.filter((auction) => auction.id !== auctionId),
        vehicleUpcomingAuctionIds: nextAssignments,
        hiddenCategoryIds: Array.from(hidden),
        sectionVehicleIds: {
          ...prev.sectionVehicleIds,
          "proximos-remates": (prev.sectionVehicleIds["proximos-remates"] ?? []).filter((key) =>
            assignedVehicleKeys.has(key),
          ),
        },
      };
    });
  };

  const finalizeUpcomingAuction = useCallback(
    (auctionId: string, soldVehicleKeys: string[]) => {
      const auction = (config.upcomingAuctions ?? []).find((entry) => entry.id === auctionId);
      const assignedNow = Object.entries(config.vehicleUpcomingAuctionIds ?? {})
        .filter(([, value]) => value === auctionId)
        .map(([vehicleKey]) => vehicleKey);
      const soldNowCount = assignedNow.filter((vehicleKey) => soldVehicleKeys.includes(vehicleKey)).length;
      const unsoldNowCount = Math.max(0, assignedNow.length - soldNowCount);
      const soldSetInput = new Set(soldVehicleKeys);
      setConfig((prev) => {
        const assignedVehicleKeys = Object.entries(prev.vehicleUpcomingAuctionIds)
          .filter(([, value]) => value === auctionId)
          .map(([vehicleKey]) => vehicleKey);
        const assignedSet = new Set(assignedVehicleKeys);
        const validSoldKeys = assignedVehicleKeys.filter((vehicleKey) => soldSetInput.has(vehicleKey));
        const unsoldKeys = assignedVehicleKeys.filter((vehicleKey) => !soldSetInput.has(vehicleKey));

        const soldSet = new Set(prev.soldVehicleIds ?? []);
        const hiddenSet = new Set(prev.hiddenVehicleIds ?? []);
        const nextAssignments = { ...prev.vehicleUpcomingAuctionIds };
        const nextHistory = [...(prev.soldVehicleHistory ?? [])];

        for (const vehicleKey of validSoldKeys) {
          soldSet.add(vehicleKey);
          hiddenSet.add(vehicleKey);
          delete nextAssignments[vehicleKey];
          const item = itemsByKey.get(vehicleKey);
          if (item) {
            const soldRecord = buildSoldVehicleRecord(item, {
              auctionId,
              auctionName: auction?.name ?? "Remate finalizado",
              soldCategory: "Remate",
            });
            nextHistory.unshift(soldRecord);
          }
        }

        for (const vehicleKey of unsoldKeys) {
          hiddenSet.add(vehicleKey);
          delete nextAssignments[vehicleKey];
        }

        const uniqueHistory = nextHistory.filter(
          (entry, index, list) =>
            list.findIndex((candidate) => candidate.vehicleKey === entry.vehicleKey) === index,
        );

        return {
          ...prev,
          upcomingAuctions: prev.upcomingAuctions.filter((entry) => entry.id !== auctionId),
          soldVehicleIds: Array.from(soldSet),
          soldVehicleHistory: uniqueHistory,
          hiddenVehicleIds: Array.from(hiddenSet),
          vehicleUpcomingAuctionIds: nextAssignments,
          sectionVehicleIds: {
            "proximos-remates": (prev.sectionVehicleIds["proximos-remates"] ?? []).filter(
              (key) => !assignedSet.has(key),
            ),
            "ventas-directas": prev.sectionVehicleIds["ventas-directas"] ?? [],
            novedades: prev.sectionVehicleIds.novedades ?? [],
            catalogo: prev.sectionVehicleIds.catalogo ?? [],
          },
        };
      });
      setFinalizeAuctionId(null);
      setFinalizeAuctionSearchTerm("");
      setFinalizeSoldVehicleKeys([]);
      showSystemNotice(
        "success",
        "Remate finalizado",
        `${soldNowCount} unidad(es) vendidas y ${unsoldNowCount} unidad(es) ocultas sin venta.`,
      );
    },
    [buildSoldVehicleRecord, config.upcomingAuctions, config.vehicleUpcomingAuctionIds, itemsByKey, showSystemNotice],
  );

  const assignVehicleToUpcomingAuction = (itemKey: string, auctionId: string) => {
    setConfig((prev) => {
      const nextAssignments = { ...prev.vehicleUpcomingAuctionIds };
      if (auctionId) nextAssignments[itemKey] = auctionId;
      else delete nextAssignments[itemKey];

      const sectionSet = new Set(prev.sectionVehicleIds["proximos-remates"] ?? []);
      if (auctionId) sectionSet.add(itemKey);
      else sectionSet.delete(itemKey);

      return {
        ...prev,
        vehicleUpcomingAuctionIds: nextAssignments,
        sectionVehicleIds: {
          ...prev.sectionVehicleIds,
          "proximos-remates": Array.from(sectionSet),
        },
      };
    });
  };

  const openDetailsEditor = (item: CatalogItem, initialTab: DetailEditorTabId = "general") => {
    openEditVehicleModal(item, initialTab === "tecnica" ? "tecnica" : "general");
  };

  const saveDetailsEditor = () => {
    if (!editingVehicleKey || !editingDetails) return;
    if (Object.keys(blockingValidationErrors).length > 0) {
      showSystemNotice(
        "error",
        "Campos invalidos",
        "Corrige los campos marcados en rojo antes de guardar.",
      );
      return;
    }
    const sanitized = sanitizeDetails(editingDetails);
    setConfig((prev) => {
      const nextDetails = { ...prev.vehicleDetails };
      if (sanitized) nextDetails[editingVehicleKey] = sanitized;
      else delete nextDetails[editingVehicleKey];
      return { ...prev, vehicleDetails: nextDetails };
    });
    setEditingVehicleKey(null);
    setEditingDetails(null);
  };

  const cancelDetailsEditor = () => {
    setEditingVehicleKey(null);
    setEditingDetails(null);
  };

  const persistEditorConfig = useCallback(async (nextConfig: EditorConfig) => {
    localStorage.setItem(EDITOR_STORAGE_KEY, JSON.stringify(nextConfig));
    setSaving(true);
    setAutoSaveState("saving");
    try {
      const response = await fetch("/api/admin/editor-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ config: nextConfig }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setAutoSaveState("error");
        if (response.status === 401) {
          setIsAdmin(false);
          setAdminView("home");
          setShowLogin(true);
          setServerSaveStatus("offline");
          setServerSaveMessage("Sesion vencida. Inicia sesion para sincronizar con el servidor.");
          showSystemNotice(
            "error",
            "Sesion expirada",
            "Inicia sesion nuevamente para volver a sincronizar con el guardado global.",
          );
          return;
        }
        const errorMessage =
          payload.error ??
          "No se pudo guardar en servidor. Los cambios quedaron en este navegador.";
        setServerSaveStatus("offline");
        setServerSaveMessage(errorMessage);
        return;
      }
      setServerSaveStatus("ready");
      setServerSaveMessage("");
      setAutoSaveState("saved");
      setLastAutoSaveAt(new Date().toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }));
      lastPersistedConfigRef.current = JSON.stringify(nextConfig);
    } catch {
      const errorMessage =
        "Sin conexion al guardar en servidor. Los cambios quedaron en este navegador.";
      setServerSaveStatus("offline");
      setServerSaveMessage(errorMessage);
      setAutoSaveState("error");
    } finally {
      setSaving(false);
    }
  }, [showSystemNotice]);

  useEffect(() => {
    setConfig((prev) => {
      const { config: synced, mergedPatents } = syncManualPublicationsWithCatalog(prev, rawItems);
      if (mergedPatents.length === 0) return prev;
      const signature = mergedPatents.slice().sort().join("|");
      if (glo3dSyncSignatureRef.current === signature) return prev;
      glo3dSyncSignatureRef.current = signature;
      window.setTimeout(() => {
        showSystemNotice(
          "success",
          "Sincronizacion GLO3D",
          `${mergedPatents.length} publicacion(es) manual(es) enlazada(s) con GLO3D: ${mergedPatents.join(", ")}.`,
        );
      }, 0);
      return synced;
    });
  }, [rawItems, showSystemNotice]);

  useEffect(() => {
    if (isBootstrapping || !isAdmin) return;
    localStorage.setItem(EDITOR_STORAGE_KEY, JSON.stringify(config));
  }, [config, isAdmin, isBootstrapping]);

  useEffect(() => {
    if (isBootstrapping || !isAdmin) return;
    const serializedConfig = JSON.stringify(config);
    if (!autoSaveReadyRef.current) {
      autoSaveReadyRef.current = true;
      lastPersistedConfigRef.current = serializedConfig;
      return;
    }
    if (serializedConfig === lastPersistedConfigRef.current) return;
    const timeout = window.setTimeout(() => {
      void persistEditorConfig(config);
    }, 550);
    return () => window.clearTimeout(timeout);
  }, [config, isAdmin, isBootstrapping, persistEditorConfig]);

  useEffect(() => {
    const previousAdminView = previousAdminViewRef.current;
    previousAdminViewRef.current = adminView;
    const leavingEditor = previousAdminView === "editor" && adminView !== "editor";
    if (!leavingEditor || isBootstrapping || !isAdmin) return;
    const serializedConfig = JSON.stringify(config);
    if (serializedConfig === lastPersistedConfigRef.current) return;
    void persistEditorConfig(config);
  }, [adminView, config, isAdmin, isBootstrapping, persistEditorConfig]);

  useEffect(() => {
    if (!isAdmin || serverSaveStatus !== "offline" || isBootstrapping) return;
    const interval = window.setInterval(() => {
      void verifyServerPersistence().then((result) => {
        if (!result.ok) return;
        const serializedConfig = JSON.stringify(config);
        if (serializedConfig !== lastPersistedConfigRef.current) {
          void persistEditorConfig(config);
        }
      });
    }, 30000);
    return () => window.clearInterval(interval);
  }, [config, isAdmin, isBootstrapping, persistEditorConfig, serverSaveStatus, verifyServerPersistence]);

  useEffect(() => {
    if (autoSaveState !== "saved") return;
    const timeout = window.setTimeout(() => {
      setAutoSaveState("idle");
    }, 2400);
    return () => window.clearTimeout(timeout);
  }, [autoSaveState]);

  const revalidateInventory = async () => {
    setRevalidating(true);
    setInventoryUpdateProgress("Actualizando catalogo GLO3D...");
    try {
      const revalidateResponse = await fetch("/api/admin/revalidate", {
        method: "POST",
        credentials: "include",
      });
      if (!revalidateResponse.ok) throw new Error("Error al revalidar");

      setInventoryUpdateProgress("Descargando inventario de bodega...");
      const catalogResponse = await fetch(`/api/catalogo?_=${Date.now()}`, {
        cache: "no-store",
      });
      if (!catalogResponse.ok) throw new Error("Error al cargar catalogo");
      const freshFeed = (await catalogResponse.json()) as CatalogFeed;
      let freshItems = freshFeed.items ?? [];

      let workingConfig = config;
      const { config: syncedConfig, mergedPatents } = syncManualPublicationsWithCatalog(
        workingConfig,
        freshItems,
      );
      workingConfig = syncedConfig;

      let glo3dByPatent: Record<
        string,
        { view3dUrl?: string; technicalFields?: Record<string, unknown>; raw?: Record<string, unknown> }
      > = {};
      const missingGlo3dPatents = collectPublishedPatentsMissingGlo3d(workingConfig, freshItems);
      if (missingGlo3dPatents.length > 0) {
        setInventoryUpdateProgress(
          `GLO3D ${missingGlo3dPatents.length} patente(s) sin visor 3D...`,
        );
        const glo3dResponse = await fetch("/api/admin/glo3d-lookup", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ patentes: missingGlo3dPatents }),
        });
        const glo3dPayload = (await glo3dResponse.json().catch(() => ({}))) as {
          ok?: boolean;
          byPatent?: Record<
            string,
            { view3dUrl?: string; technicalFields?: Record<string, unknown>; raw?: Record<string, unknown> }
          >;
          matched?: number;
          missing?: string[];
          error?: string;
          code?: string;
        };
        if (glo3dResponse.ok && glo3dPayload.ok && glo3dPayload.byPatent) {
          glo3dByPatent = glo3dPayload.byPatent;
          freshItems = mergeGlo3dResponseIntoCatalogItems(freshItems, glo3dByPatent);
        } else if (glo3dPayload.code === "GLO3D_NOT_CONFIGURED") {
          showSystemNotice(
            "error",
            "GLO3D no configurado",
            "Agrega GLO3D_API_USERNAME y GLO3D_API_PASSWORD en Vercel para sincronizar visores 3D.",
          );
        }
      }

      setCatalogItems(freshItems);

      const patentes = collectAutoredLookupPatents(workingConfig, freshItems);
      const autoredByPatent: Record<string, Partial<ManualPublicationDraft>> = {};
      let stoppedByRateLimit = false;

      if (patentes.length > 0) {
        const sequential = await lookupAutoredPatentsSequential(patentes, (current, total, patente) => {
          setInventoryUpdateProgress(`Autored ${current}/${total}: ${patente} (1 consulta cada 3s)...`);
        });
        stoppedByRateLimit = sequential.stoppedByRateLimit;
        for (const [patente, fields] of sequential.results.entries()) {
          autoredByPatent[patente] = fields;
        }
      }

      setInventoryUpdateProgress("Completando fichas publicadas...");
      const { config: enrichedConfig, stats } = enrichPublishedVehiclesConfig(
        workingConfig,
        freshItems,
        autoredByPatent,
        glo3dByPatent,
      );
      setConfig(enrichedConfig);
      await persistEditorConfig(enrichedConfig);
      router.refresh();

      const summaryParts = [
        `${freshItems.length} unidades en bodega`,
        `${stats.publishedCount} publicadas revisadas`,
      ];
      if (mergedPatents.length > 0) {
        summaryParts.push(`${mergedPatents.length} manual(es) enlazada(s) con GLO3D`);
      }
      if (stats.gloEnriched > 0) {
        summaryParts.push(`${stats.gloEnriched} completada(s) con datos GLO3D`);
      }
      if (stats.autoredEnriched > 0) {
        summaryParts.push(`${stats.autoredEnriched} completada(s) con Autored`);
      }
      if (stats.manualMediaUpdated > 0) {
        summaryParts.push(`${stats.manualMediaUpdated} con fotos/visor 3D actualizados`);
      }
      if (stats.fieldsFilled > 0) {
        summaryParts.push(`${stats.fieldsFilled} campo(s) de ficha rellenados`);
      }
      if (stoppedByRateLimit) {
        summaryParts.push(
          "Autored pauso consultas por limite: vuelve a pulsar Actualizar inventario en unos minutos para continuar",
        );
      }

      showSystemNotice(
        stoppedByRateLimit ? "info" : "success",
        stoppedByRateLimit ? "Inventario parcialmente actualizado" : "Inventario actualizado",
        `${summaryParts.join(". ")}.`,
      );
    } catch {
      showSystemNotice(
        "error",
        "Error al actualizar",
        "No se pudo actualizar el inventario. Intenta nuevamente.",
      );
    } finally {
      setRevalidating(false);
      setInventoryUpdateProgress("");
    }
  };

  const login = async () => {
    trackEvent("admin_login_attempt");
    setLoginError("");
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email: loginEmail, password: loginPassword }),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({ error: "No se pudo iniciar sesion." }))) as { error?: string };
      setLoginError(payload.error ?? "No se pudo iniciar sesion.");
      trackEvent("admin_login_failed");
      return;
    }
    const sessionRes = await fetch("/api/admin/session", {
      cache: "no-store",
      credentials: "include",
    });
    const sessionPayload = (await sessionRes.json().catch(() => ({}))) as { loggedIn?: boolean };
    if (!sessionPayload.loggedIn) {
      setLoginError("No se pudo crear la sesion del navegador. Revisa cookies/permisos y vuelve a intentar.");
      trackEvent("admin_login_failed");
      return;
    }
    const persistenceCheck = await verifyServerPersistence();
    setShowLogin(false);
    setLoginPassword("");
    setIsAdmin(true);
    setAdminView("editor");
    resetAdminInventoryFilters();
    if (!persistenceCheck.ok) {
      showSystemNotice(
        "info",
        "Guardado local activo",
        persistenceCheck.error ??
          "Puedes editar con normalidad. Los cambios se sincronizaran cuando el servidor este disponible.",
      );
    }
    trackEvent("admin_login_success");
  };

  const logout = async () => {
    await fetch("/api/admin/logout", { method: "POST", credentials: "include" });
    setIsAdmin(false);
    setAdminView("home");
    setServerSaveStatus("checking");
    setServerSaveMessage("");
    trackEvent("admin_logout");
  };

  const openAdminEditorView = () => {
    if (!isAdmin) return;
    setAdminView("editor");
    resetAdminInventoryFilters();
    if (serverSaveStatus === "offline") {
      showSystemNotice(
        "info",
        "Sincronizacion pendiente",
        serverSaveMessage ||
          "Puedes editar con normalidad. Los cambios se guardan en este navegador y se sincronizaran al recuperar el servidor.",
      );
    }
  };

  const retryServerSaveCheck = async () => {
    if (!isAdmin) return;
    const result = await verifyServerPersistence();
    if (!result.ok) {
      showSystemNotice(
        "error",
        "Servidor no disponible",
        result.error ?? "No se pudo reconectar al guardado global.",
      );
      return;
    }
    const serializedConfig = JSON.stringify(config);
    if (serializedConfig !== lastPersistedConfigRef.current) {
      await persistEditorConfig(config);
    }
    showSystemNotice(
      "success",
      "Guardado global activo",
      "La configuracion quedo sincronizada con el servidor.",
    );
  };

  const canAdminEditNow = isAdmin && !isBootstrapping;
  const showAdminEditor = isAdmin && adminView === "editor";
  const showPublicHome = !isAdmin || adminView === "home";
  const shouldShowSaveIndicator =
    serverSaveStatus === "offline" ||
    autoSaveState === "saving" ||
    autoSaveState === "saved" ||
    autoSaveState === "error" ||
    saving;
  const hasActiveSearch = homeSearchTerm.trim().length > 0;
  const hasActiveSearchOrQuickFilters =
    hasActiveSearch || quickFilters.length > 0 || topSectionFilter !== "all";

  const editingPublicationItem = editingPublicationKey
    ? itemsByKey.get(editingPublicationKey) ?? null
    : null;

  const saveInlineCardChanges = useCallback(
    (item: CatalogItem, changes: { title?: string; subtitle?: string; price?: string }) => {
      if (!canAdminEditNow) return;
      const key = getVehicleKey(item);
      const nextTitle = changes.title?.trim();
      if (typeof nextTitle === "string" && !nextTitle) {
        showSystemNotice("error", "Titulo requerido", "El titulo no puede quedar vacio.");
        return;
      }
      const nextSubtitle = changes.subtitle?.trim();
      const nextPrice = typeof changes.price === "string" ? toCurrencyInput(changes.price) : undefined;
      setConfig((prev) => {
        const nextDetails = { ...prev.vehicleDetails };
        const currentDetails = { ...(nextDetails[key] ?? {}) };
        if (typeof nextTitle === "string") currentDetails.title = nextTitle;
        if (typeof nextSubtitle === "string") currentDetails.subtitle = nextSubtitle;
        if (Object.keys(currentDetails).length > 0) nextDetails[key] = currentDetails;
        const nextPrices = { ...prev.vehiclePrices };
        if (typeof nextPrice === "string") nextPrices[key] = nextPrice;
        return {
          ...prev,
          vehicleDetails: nextDetails,
          vehiclePrices: nextPrices,
        };
      });
      showSystemNotice("success", "Actualizado", "Se guardo la edicion rapida de la publicacion.");
    },
    [canAdminEditNow, showSystemNotice],
  );

  const mapSummaryLabelToDetailField = useCallback((label: string): keyof EditorVehicleDetails | null => {
    const normalized = label
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "");
    const map: Record<string, keyof EditorVehicleDetails> = {
      titulo: "title",
      subtitulo: "subtitle",
      patente: "patente",
      "patente verificador": "patenteVerifier",
      vin: "vin",
      "n° de chasis": "nChasis",
      marca: "brand",
      modelo: "model",
      ano: "year",
      "tipo de vehiculo": "tipoVehiculo",
      tipo: "tipo",
      "estado del vehiculo": "vehicleCondition",
      "estado comercial": "status",
      ubicacion: "location",
      lote: "lot",
      "fecha de remate": "auctionDate",
      kilometraje: "kilometraje",
      color: "color",
      combustible: "combustible",
      transmision: "transmision",
      traccion: "traccion",
      aro: "aro",
      cilindrada: "cilindrada",
      llaves: "llaves",
      "aire acondicionado": "aireAcondicionado",
      "unico propietario": "unicoPropietario",
      condicionado: "condicionado",
      multas: "multas",
      tag: "tag",
      "vencimiento revision tecnica": "vencRevisionTecnica",
      "vencimiento permiso circulacion": "vencPermisoCirculacion",
      "vencimiento seguro obligatorio": "vencSeguroObligatorio",
      "prueba de motor": "pruebaMotor",
      "prueba de desplazamiento": "pruebaDesplazamiento",
      "estado airbags": "estadoAirbags",
      "n° de serie": "nSerie",
      "n° de motor": "nMotor",
      "n° de siniestro": "nSiniestro",
      version: "version",
      categoria: "category",
      "ubicacion fisica": "ubicacionFisica",
      transportista: "transportista",
      taller: "taller",
      "nombre propietario anterior": "nombrePropietarioAnterior",
      "rut propietario anterior": "rutPropietarioAnterior",
      "rut verificador": "rutVerificador",
      "descripcion ampliada": "extendedDescription",
    };
    return map[normalized] ?? null;
  }, []);

  const beginInlineSummaryFieldEdit = useCallback(
    (label: string, value: string) => {
      if (!canAdminEditNow) return;
      setInlineSummaryField(`${selectedVehicleTab}:${label}`);
      setInlineSummaryValue(value);
    },
    [canAdminEditNow, selectedVehicleTab],
  );

  const cancelInlineSummaryFieldEdit = useCallback(() => {
    setInlineSummaryField(null);
    setInlineSummaryValue("");
  }, []);

  const saveInlineSummaryFieldEdit = useCallback(
    (label: string) => {
      if (!selectedVehicle || !canAdminEditNow) return;
      const mappedField = mapSummaryLabelToDetailField(label);
      if (!mappedField) return;
      const key = getVehicleKey(selectedVehicle);
      const nextValue = inlineSummaryValue.trim();
      setConfig((prev) => {
        const nextDetails = { ...prev.vehicleDetails };
        const current = { ...(nextDetails[key] ?? {}) };
        (current as Record<string, unknown>)[mappedField] = nextValue;
        nextDetails[key] = current;
        return { ...prev, vehicleDetails: nextDetails };
      });
      showSystemNotice("success", "Campo actualizado", `${label} se guardo correctamente.`);
      cancelInlineSummaryFieldEdit();
    },
    [
      cancelInlineSummaryFieldEdit,
      canAdminEditNow,
      inlineSummaryValue,
      mapSummaryLabelToDetailField,
      selectedVehicle,
      showSystemNotice,
    ],
  );

  const startInlinePriceEdit = useCallback(() => {
    if (!selectedVehicle || !canAdminEditNow) return;
    setInlinePriceDraft({
      referencePrice: toCurrencyInput(selectedVehiclePriceLabel ?? ""),
      originalPrice: toCurrencyInput(selectedVehiclePromoMeta.originalPriceLabel ?? ""),
      taxFee: toCurrencyInput(selectedVehiclePromoMeta.taxFeeLabel ?? ""),
      transferFee: toCurrencyInput(selectedVehiclePromoMeta.transferFeeLabel ?? ""),
      promoEnabled: selectedVehiclePromoMeta.promoEnabled,
      promoPrice: toCurrencyInput(selectedVehiclePriceLabel ?? ""),
    });
    setInlinePriceEditing(true);
  }, [canAdminEditNow, selectedVehicle, selectedVehiclePriceLabel, selectedVehiclePromoMeta]);

  const saveInlinePriceEdit = useCallback(() => {
    if (!selectedVehicle || !canAdminEditNow) return;
    const key = getVehicleKey(selectedVehicle);
    const normalizedPrice = toCurrencyInput(inlinePriceDraft.referencePrice);
    const normalizedOriginal = toCurrencyInput(inlinePriceDraft.originalPrice);
    const normalizedPromo = toCurrencyInput(inlinePriceDraft.promoPrice);
    const normalizedTax = toCurrencyInput(inlinePriceDraft.taxFee);
    const normalizedTransfer = toCurrencyInput(inlinePriceDraft.transferFee);
    setConfig((prev) => {
      const nextPrices = { ...prev.vehiclePrices };
      nextPrices[key] = normalizedPrice;
      const nextDetails = { ...prev.vehicleDetails };
      const current = { ...(nextDetails[key] ?? {}) };
      current.originalPrice = normalizedOriginal;
      current.promoEnabled = inlinePriceDraft.promoEnabled;
      current.promoPrice = inlinePriceDraft.promoEnabled ? normalizedPromo : "";
      current.taxFee = normalizedTax;
      current.transferFee = normalizedTransfer;
      nextDetails[key] = current;
      return { ...prev, vehiclePrices: nextPrices, vehicleDetails: nextDetails };
    });
    setInlinePriceEditing(false);
    showSystemNotice("success", "Precio actualizado", "La informacion de precio se guardo correctamente.");
  }, [canAdminEditNow, inlinePriceDraft, selectedVehicle, showSystemNotice]);
  const finalizeAuction = useMemo(
    () =>
      finalizeAuctionId
        ? (config.upcomingAuctions ?? []).find((auction) => auction.id === finalizeAuctionId) ?? null
        : null,
    [config.upcomingAuctions, finalizeAuctionId],
  );
  const finalizeAuctionItems = useMemo(() => {
    if (!finalizeAuctionId) return [];
    const baseItems = activeInventoryItems.filter(
      (item) => (config.vehicleUpcomingAuctionIds[getVehicleKey(item)] ?? "") === finalizeAuctionId,
    );
    const query = normalizeText(finalizeAuctionSearchTerm);
    if (!query) return baseItems;
    return baseItems.filter((item) => {
      const patent = normalizeText(getPatent(item));
      const model = normalizeText(getModel(item));
      return patent.includes(query) || model.includes(query);
    });
  }, [
    activeInventoryItems,
    config.vehicleUpcomingAuctionIds,
    finalizeAuctionId,
    finalizeAuctionSearchTerm,
  ]);
  const soldHistoryRows = useMemo(
    () =>
      [...(config.soldVehicleHistory ?? [])].sort(
        (a, b) => new Date(b.soldAt).getTime() - new Date(a.soldAt).getTime(),
      ),
    [config.soldVehicleHistory],
  );
  const soldAuctionOptions = useMemo(
    () =>
      Array.from(
        new Set(
          soldHistoryRows
            .map((row) => row.auctionName?.trim() ?? "Venta individual")
            .filter((value) => value.length > 0),
        ),
      ).sort((a, b) => a.localeCompare(b, "es-CL")),
    [soldHistoryRows],
  );
  const getSoldCategoryLabel = useCallback(
    (row: SoldVehicleRecord): string =>
      row.soldCategory?.trim() || (row.auctionName?.trim() ? "Remate" : "Venta individual"),
    [],
  );
  const soldFilteredRows = useMemo(() => {
    const query = normalizeText(soldSearch);
    const from = soldDateFrom ? new Date(`${soldDateFrom}T00:00:00`) : null;
    const to = soldDateTo ? new Date(`${soldDateTo}T23:59:59`) : null;
    const hasValidFrom = from && !Number.isNaN(from.getTime());
    const hasValidTo = to && !Number.isNaN(to.getTime());

    return soldHistoryRows.filter((row) => {
      const auctionLabel = row.auctionName?.trim() || "Venta individual";
      if (soldAuctionFilter !== "all" && auctionLabel !== soldAuctionFilter) return false;

      const soldAtDate = new Date(row.soldAt);
      if (hasValidFrom && !Number.isNaN(soldAtDate.getTime()) && soldAtDate < from!) return false;
      if (hasValidTo && !Number.isNaN(soldAtDate.getTime()) && soldAtDate > to!) return false;

      if (!query) return true;
      const columns = {
        patent: normalizeText(row.patent),
        title: normalizeText(row.title),
        soldCategory: normalizeText(getSoldCategoryLabel(row)),
        auctionName: normalizeText(auctionLabel),
      };
      if (soldSearchField === "all") {
        return Object.values(columns).some((value) => value.includes(query));
      }
      return columns[soldSearchField].includes(query);
    });
  }, [
    soldHistoryRows,
    soldSearch,
    soldSearchField,
    soldAuctionFilter,
    soldDateFrom,
    soldDateTo,
    getSoldCategoryLabel,
  ]);
  const soldFiltersActiveCount = useMemo(() => {
    let count = 0;
    if (soldSearchField !== "all") count += 1;
    if (soldAuctionFilter !== "all") count += 1;
    if (soldDateFrom) count += 1;
    if (soldDateTo) count += 1;
    return count;
  }, [soldSearchField, soldAuctionFilter, soldDateFrom, soldDateTo]);
  const downloadSoldRowsExcel = useCallback(
    (rows: SoldVehicleRecord[], scope: "filtrado" | "total") => {
      if (rows.length === 0) {
        showSystemNotice(
          "info",
          "Sin datos para exportar",
          "No hay unidades vendidas que coincidan con los filtros actuales.",
        );
        return;
      }
      const header = ["Patente", "Modelo", "Categoria venta", "Origen", "Fecha venta", "ID vehiculo"];
      const lines = rows.map((row) => [
        toCsvCell(row.patent),
        toCsvCell(row.title),
        toCsvCell(getSoldCategoryLabel(row)),
        toCsvCell(row.auctionName?.trim() || "Venta individual"),
        toCsvCell(new Date(row.soldAt).toLocaleString("es-CL")),
        toCsvCell(row.vehicleKey),
      ]);
      const csv = `\uFEFF${header.map(toCsvCell).join(",")}\n${lines.map((line) => line.join(",")).join("\n")}`;
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const dateTag = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `unidades-vendidas-${scope}-${dateTag}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showSystemNotice(
        "success",
        "Exportacion lista",
        `Se descargo el archivo para Excel (${scope}) con ${rows.length} registro(s).`,
      );
    },
    [getSoldCategoryLabel, showSystemNotice],
  );
  const analyticsBaseEvents = analyticsSource === "server" ? serverAnalyticsEvents : analyticsEvents;

  const offersVehicleOptions = useMemo(
    () =>
      Array.from(
        new Set(
          offersRows
            .map((row) => row.vehicleTitle.trim())
            .filter((value) => value.length > 0),
        ),
      ).sort((a, b) => a.localeCompare(b, "es-CL")),
    [offersRows],
  );
  const offersClientOptions = useMemo(
    () =>
      Array.from(
        new Set(
          offersRows
            .map((row) => row.customerName.trim())
            .filter((value) => value.length > 0),
        ),
      ).sort((a, b) => a.localeCompare(b, "es-CL")),
    [offersRows],
  );
  const offersFilteredRows = useMemo(() => {
    const query = normalizeText(offersSearch);
    const from = offersDateFrom ? new Date(`${offersDateFrom}T00:00:00`) : null;
    const to = offersDateTo ? new Date(`${offersDateTo}T23:59:59`) : null;
    const hasValidFrom = from && !Number.isNaN(from.getTime());
    const hasValidTo = to && !Number.isNaN(to.getTime());

    return offersRows.filter((row) => {
      if (offersVehicleFilter !== "all" && row.vehicleTitle !== offersVehicleFilter) return false;
      if (offersClientFilter !== "all" && row.customerName !== offersClientFilter) return false;

      const createdAtDate = new Date(row.createdAt);
      if (hasValidFrom && !Number.isNaN(createdAtDate.getTime()) && createdAtDate < from!) return false;
      if (hasValidTo && !Number.isNaN(createdAtDate.getTime()) && createdAtDate > to!) return false;

      if (!query) return true;
      const columns = {
        vehicleTitle: normalizeText(row.vehicleTitle),
        patent: normalizeText(row.patent),
        customerName: normalizeText(row.customerName),
        customerEmail: normalizeText(row.customerEmail),
        customerPhone: normalizeText(row.customerPhone),
      };
      if (offersSearchField === "all") {
        return Object.values(columns).some((value) => value.includes(query));
      }
      return columns[offersSearchField].includes(query);
    });
  }, [
    offersRows,
    offersSearch,
    offersSearchField,
    offersVehicleFilter,
    offersClientFilter,
    offersDateFrom,
    offersDateTo,
  ]);
  const offersFiltersActiveCount = useMemo(() => {
    let count = 0;
    if (offersSearchField !== "all") count += 1;
    if (offersVehicleFilter !== "all") count += 1;
    if (offersClientFilter !== "all") count += 1;
    if (offersDateFrom) count += 1;
    if (offersDateTo) count += 1;
    return count;
  }, [
    offersSearchField,
    offersVehicleFilter,
    offersClientFilter,
    offersDateFrom,
    offersDateTo,
  ]);

  const analyticsFilteredEvents = useMemo(() => {
    if (analyticsSource === "server") return analyticsBaseEvents;
    const now = Date.now();
    const cutoff = now - analyticsRangeDays * 24 * 60 * 60 * 1000;
    return analyticsBaseEvents.filter((event) => {
      const timestamp = parseAnalyticsTimestamp(event.timestamp);
      return timestamp ? timestamp.getTime() >= cutoff : false;
    });
  }, [analyticsBaseEvents, analyticsRangeDays, analyticsSource]);

  const analyticsScopedEvents = useMemo(() => {
    const query = normalizeText(analyticsVehicleQuery);
    return analyticsFilteredEvents.filter((event) => {
      const eventName = typeof event.event === "string" ? event.event : "";
      if (analyticsEventFilter !== "all" && eventName !== analyticsEventFilter) return false;
      const section = typeof event.section === "string" ? event.section : "sin-seccion";
      if (analyticsSectionFilter !== "all" && section !== analyticsSectionFilter) return false;
      if (!query) return true;
      const itemKey = typeof event.itemKey === "string" ? event.itemKey : "";
      const item = itemKey ? itemsByKey.get(itemKey) : undefined;
      const sample = normalizeText(
        `${itemKey} ${item ? getPatent(item) : ""} ${item ? getModel(item) : ""}`,
      );
      return sample.includes(query);
    });
  }, [
    analyticsFilteredEvents,
    analyticsEventFilter,
    analyticsSectionFilter,
    analyticsVehicleQuery,
    itemsByKey,
  ]);

  const analyticsOverview = useMemo(() => {
    const eventCount = analyticsScopedEvents.length;
    const visitSessionIds = new Set(
      analyticsScopedEvents
        .filter((event) => event.event === "page_view_home")
        .map((event) => (typeof event.sessionId === "string" ? event.sessionId : ""))
        .filter(Boolean),
    );
    const visits =
      visitSessionIds.size > 0
        ? visitSessionIds.size
        : analyticsScopedEvents.filter((event) => event.event === "page_view_home").length;
    const uniqueVisitors = new Set(
      analyticsScopedEvents
        .map((event) => (typeof event.visitorId === "string" ? event.visitorId : ""))
        .filter(Boolean),
    ).size;
    const detailOpens = analyticsScopedEvents.filter((event) => event.event === "vehicle_detail_open").length;
    const whatsappClicks = analyticsScopedEvents.filter((event) =>
      String(event.event).startsWith("whatsapp_click"),
    ).length;
    const shares = analyticsScopedEvents.filter((event) => event.event === "vehicle_share").length;
    const leads = analyticsScopedEvents.filter((event) => event.event === "lead_form_submit").length;
    const uniqueVehicles = new Set(
      analyticsScopedEvents
        .map((event) => event.itemKey)
        .filter((value): value is string => typeof value === "string" && value.trim().length > 0),
    ).size;

    return {
      eventCount,
      visits,
      detailOpens,
      whatsappClicks,
      shares,
      leads,
      uniqueVehicles,
      uniqueVisitors,
      whatsappRate: detailOpens > 0 ? Math.round((whatsappClicks / detailOpens) * 100) : 0,
      leadRate: detailOpens > 0 ? Math.round((leads / detailOpens) * 100) : 0,
    };
  }, [analyticsScopedEvents]);

  const analyticsTopVehicles = useMemo(() => {
    const counts = new Map<string, number>();
    for (const event of analyticsScopedEvents) {
      const key = typeof event.itemKey === "string" ? event.itemKey : "";
      if (!key) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([itemKey, total]) => {
        const item = itemsByKey.get(itemKey);
        return {
          itemKey,
          total,
          patent: item ? getPatent(item) : itemKey,
          model: item ? getModel(item) : "Vehiculo no disponible",
        };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [analyticsScopedEvents, itemsByKey]);

  const analyticsTopEvents = useMemo(() => {
    const counts = new Map<string, number>();
    for (const event of analyticsScopedEvents) {
      const name = typeof event.event === "string" ? event.event : "sin_evento";
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([eventName, total]) => ({ eventName, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 12);
  }, [analyticsScopedEvents]);

  const analyticsTopSections = useMemo(() => {
    const counts = new Map<string, number>();
    for (const event of analyticsScopedEvents) {
      const section = typeof event.section === "string" ? event.section : "sin-seccion";
      counts.set(section, (counts.get(section) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([section, total]) => ({ section, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [analyticsScopedEvents]);

  const analyticsTimeline = useMemo<AnalyticsTimelineRow[]>(() => {
    const buckets = new Map<
      string,
      {
        total: number;
        pageViews: number;
        detailOpens: number;
        whatsappClicks: number;
        leads: number;
        sessionIds: Set<string>;
      }
    >();
    for (const event of analyticsScopedEvents) {
      const timestamp = parseAnalyticsTimestamp(event.timestamp);
      if (!timestamp) continue;
      const key = timestamp.toISOString().slice(0, 10);
      const current = buckets.get(key) ?? {
        total: 0,
        pageViews: 0,
        detailOpens: 0,
        whatsappClicks: 0,
        leads: 0,
        sessionIds: new Set<string>(),
      };
      current.total += 1;
      if (event.event === "page_view_home") {
        current.pageViews += 1;
        if (typeof event.sessionId === "string" && event.sessionId.trim().length > 0) {
          current.sessionIds.add(event.sessionId.trim());
        }
      }
      if (event.event === "vehicle_detail_open") current.detailOpens += 1;
      if (String(event.event).startsWith("whatsapp_click")) current.whatsappClicks += 1;
      if (event.event === "lead_form_submit") current.leads += 1;
      buckets.set(key, current);
    }
    return Array.from(buckets.entries())
      .map(([date, entry]) => ({
        date,
        total: entry.total,
        visits: entry.sessionIds.size > 0 ? entry.sessionIds.size : entry.pageViews,
        detailOpens: entry.detailOpens,
        whatsappClicks: entry.whatsappClicks,
        leads: entry.leads,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [analyticsScopedEvents]);

  const analyticsTimelineFiltered = useMemo(
    () =>
      analyticsTimeline.filter((row) => {
        if (analyticsDateFrom && row.date < analyticsDateFrom) return false;
        if (analyticsDateTo && row.date > analyticsDateTo) return false;
        return true;
      }),
    [analyticsTimeline, analyticsDateFrom, analyticsDateTo],
  );

  const analyticsChartRows = useMemo(() => {
    const addDaysIso = (iso: string, days: number): string => {
      const date = new Date(`${iso}T00:00:00Z`);
      if (Number.isNaN(date.getTime())) return iso;
      date.setUTCDate(date.getUTCDate() + days);
      return date.toISOString().slice(0, 10);
    };
    const diffDaysInclusive = (startIso: string, endIso: string): number => {
      const start = new Date(`${startIso}T00:00:00Z`);
      const end = new Date(`${endIso}T00:00:00Z`);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 1;
      const diff = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      return Math.max(1, diff + 1);
    };

    const sourceMap = new Map(analyticsTimelineFiltered.map((row) => [row.date, row]));
    const todayIso = new Date().toISOString().slice(0, 10);
    const lastKnownIso =
      analyticsTimelineFiltered.length > 0
        ? analyticsTimelineFiltered[analyticsTimelineFiltered.length - 1]?.date ?? todayIso
        : analyticsDateTo || todayIso;
    const firstKnownIso =
      analyticsTimelineFiltered.length > 0
        ? analyticsTimelineFiltered[0]?.date ?? addDaysIso(lastKnownIso, -6)
        : analyticsDateFrom || addDaysIso(lastKnownIso, -6);

    let startIso = analyticsDateFrom || firstKnownIso;
    let endIso = analyticsDateTo || lastKnownIso;
    if (startIso > endIso) {
      const tmp = startIso;
      startIso = endIso;
      endIso = tmp;
    }
    const rangeDays = diffDaysInclusive(startIso, endIso);
    if (rangeDays < 7) {
      startIso = addDaysIso(endIso, -6);
    }

    const horizonRows: AnalyticsTimelineRow[] = [];
    let cursorIso = startIso;
    let safety = 0;
    while (cursorIso <= endIso && safety < 400) {
      const existing = sourceMap.get(cursorIso);
      horizonRows.push(
        existing ?? {
          date: cursorIso,
          total: 0,
          visits: 0,
          detailOpens: 0,
          whatsappClicks: 0,
          leads: 0,
        },
      );
      cursorIso = addDaysIso(cursorIso, 1);
      safety += 1;
    }

    return horizonRows.map((row) => {
      let value = row.total;
      if (analyticsTimelineMetric === "visitas") value = row.visits;
      else if (analyticsTimelineMetric === "detalle") value = row.detailOpens;
      else if (analyticsTimelineMetric === "whatsapp") value = row.whatsappClicks;
      else if (analyticsTimelineMetric === "leads") value = row.leads;
      return { ...row, value };
    });
  }, [analyticsTimelineFiltered, analyticsTimelineMetric, analyticsDateFrom, analyticsDateTo]);

  const analyticsChartMax = useMemo(
    () => analyticsChartRows.reduce((max, row) => Math.max(max, row.value), 0),
    [analyticsChartRows],
  );

  const analyticsEventOptions = useMemo(() => {
    const names = Array.from(
      new Set(
        analyticsFilteredEvents
          .map((event) => (typeof event.event === "string" ? event.event : ""))
          .filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b));
    return names;
  }, [analyticsFilteredEvents]);

  const analyticsSectionOptions = useMemo(() => {
    const names = Array.from(
      new Set(
        analyticsFilteredEvents
          .map((event) => (typeof event.section === "string" ? event.section : "sin-seccion"))
          .filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b));
    return names;
  }, [analyticsFilteredEvents]);

  const analyticsChartMetricLabel = useMemo(() => {
    if (analyticsTimelineMetric === "visitas") return "Visitas";
    if (analyticsTimelineMetric === "detalle") return "Detalle abierto";
    if (analyticsTimelineMetric === "whatsapp") return "Clicks WhatsApp";
    if (analyticsTimelineMetric === "leads") return "Leads";
    return "Eventos";
  }, [analyticsTimelineMetric]);

  const downloadAnalyticsTimelineExcel = useCallback(
    (rows: Array<AnalyticsTimelineRow & { value: number }>) => {
      if (rows.length === 0) {
        showSystemNotice(
          "info",
          "Sin datos para exportar",
          "No hay actividad diaria para los filtros seleccionados.",
        );
        return;
      }
      const header = [
        "Fecha",
        "Eventos",
        "Visitas",
        "Detalle abierto",
        "Clicks WhatsApp",
        "Leads",
        analyticsChartMetricLabel,
      ];
      const lines = rows.map((row) => [
        toCsvCell(formatAuctionDateLabel(row.date)),
        toCsvCell(row.total),
        toCsvCell(row.visits),
        toCsvCell(row.detailOpens),
        toCsvCell(row.whatsappClicks),
        toCsvCell(row.leads),
        toCsvCell(row.value),
      ]);
      const csv = `\uFEFF${header.map(toCsvCell).join(",")}\n${lines.map((line) => line.join(",")).join("\n")}`;
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const dateTag = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `analytics-actividad-diaria-${dateTag}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showSystemNotice(
        "success",
        "Exportacion lista",
        `Se descargo el archivo para Excel con ${rows.length} registro(s).`,
      );
    },
    [analyticsChartMetricLabel, showSystemNotice],
  );

  const analyticsChartPoints = useMemo(() => {
    const total = analyticsChartRows.length;
    const zoomFactor = Math.max(1, analyticsChartZoom);
    const compressedWidth = total <= 1 ? 0 : 920 / zoomFactor;
    const xStart = total <= 1 ? 500 : 40 + (920 - compressedWidth) / 2;
    return analyticsChartRows.map((row, index) => {
      const x = total <= 1 ? 500 : xStart + (index * compressedWidth) / (total - 1);
      const y = 220 - (analyticsChartMax > 0 ? (row.value / analyticsChartMax) * 170 : 0);
      return { ...row, x, y };
    });
  }, [analyticsChartRows, analyticsChartMax, analyticsChartZoom]);

  const analyticsChartLabelStep = useMemo(
    () => Math.max(1, Math.ceil(analyticsChartPoints.length / 12)),
    [analyticsChartPoints.length],
  );

  const handleAnalyticsChartWheel = useCallback(
    (event: ReactWheelEvent<HTMLDivElement>) => {
      if (analyticsChartPoints.length === 0) return;
      event.preventDefault();
      const direction = event.deltaY < 0 ? 1 : -1;
      setAnalyticsChartZoom((prev) =>
        Math.min(6, Math.max(1, Number((prev + direction * 0.2).toFixed(2)))),
      );
    },
    [analyticsChartPoints.length],
  );

  return (
    <main
      className={`premium-bg min-h-screen text-[#2d2118] ${
        showPublicHome ? "front-public overflow-x-hidden" : "admin-editor-mode overflow-visible"
      }`}
    >
      {showPublicHome ? (
        <>
          <div className="premium-glow premium-glow-cyan" />
          <div className="premium-glow premium-glow-gold" />
        </>
      ) : null}

      <SiteHeader
        onLogoClick={(event) => {
          if (isAdmin && adminView === "editor") {
            event.preventDefault();
            setAdminView("home");
          }
          setTopSectionFilter("all");
          setHomeSearchTerm("");
          setQuickFilters([]);
          if (typeof window !== "undefined") {
            window.scrollTo({ top: 0, behavior: "smooth" });
          }
        }}
        onLoginClick={() => {
          setShowLogin(true);
          trackEvent("login_modal_open");
        }}
        isAdmin={isAdmin}
        adminView={adminView}
        onViewHome={() => setAdminView("home")}
        onOpenEditor={openAdminEditorView}
        onLogout={logout}
      >
        {feed.warning ? (
          <p className="rounded-md border border-amber-300/60 bg-amber-100 px-3 py-2 text-sm text-amber-900">{feed.warning}</p>
        ) : null}
        {isAdmin && serverSaveStatus === "offline" ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
            <span>{`Sincronizacion pendiente: ${serverSaveMessage || "servidor no disponible"}. Puedes seguir editando; los cambios se guardan en este navegador.`}</span>
            <button
              type="button"
              onClick={() => {
                void retryServerSaveCheck();
              }}
              className="ui-focus rounded-full border border-current px-3 py-1 text-[11px] font-bold"
            >
              Reintentar conexion
            </button>
          </div>
        ) : null}
      </SiteHeader>

      {showAdminEditor ? (
        <section className="admin-editor-shell relative z-10 w-full space-y-5 overflow-visible px-4 pb-10 pt-4 sm:px-8 lg:px-10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Modo editor administrador</h3>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {shouldShowSaveIndicator ? (
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                      serverSaveStatus === "offline" || autoSaveState === "error"
                        ? "border border-amber-200 bg-amber-50 text-amber-800"
                        : autoSaveState === "saving" || saving
                          ? "border border-amber-200 bg-amber-50 text-amber-700"
                          : "border border-emerald-200 bg-emerald-50 text-emerald-700"
                    }`}
                  >
                    {serverSaveStatus === "offline" || autoSaveState === "error" ? (
                      <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm0-11a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V7.75A.75.75 0 0 1 10 7Zm0 7a.875.875 0 1 0 0-1.75.875.875 0 0 0 0 1.75Z" clipRule="evenodd" />
                      </svg>
                    ) : autoSaveState === "saving" || saving ? (
                      <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 animate-spin" fill="none" aria-hidden="true">
                        <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="2" strokeOpacity="0.28" />
                        <path d="M17 10a7 7 0 0 0-7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M16.704 5.29a1 1 0 0 1 .006 1.414l-7.2 7.263a1 1 0 0 1-1.42.005L4.3 10.196a1 1 0 1 1 1.4-1.43l3.084 3.019 6.52-6.571a1 1 0 0 1 1.4-.006Z" clipRule="evenodd" />
                      </svg>
                    )}
                    <span>
                      {serverSaveStatus === "offline"
                        ? "Guardado local (sin servidor)"
                        : autoSaveState === "error"
                          ? "Error al sincronizar con servidor"
                        : autoSaveState === "saving" || saving
                          ? "Guardando cambios..."
                          : `Guardado ${lastAutoSaveAt ? `· ${lastAutoSaveAt}` : ""}`}
                    </span>
                  </span>
                ) : null}
                <button
                  onClick={revalidateInventory}
                  disabled={revalidating}
                  className="ui-focus inline-flex items-center gap-1.5 rounded-md border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 shadow-sm transition hover:bg-emerald-100 disabled:opacity-60"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={`h-4 w-4 ${revalidating ? "animate-spin" : ""}`}>
                    <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466l-.312-.311h2.433a.75.75 0 0 0 0-1.5H4.598a.75.75 0 0 0-.75.75v3.634a.75.75 0 0 0 1.5 0v-2.033l.262.263A7 7 0 0 0 17.25 10a.75.75 0 0 0-1.5 0 5.48 5.48 0 0 1-.438 1.424ZM4.688 8.576a5.5 5.5 0 0 1 9.201-2.466l.312.311h-2.433a.75.75 0 0 0 0 1.5h3.634a.75.75 0 0 0 .75-.75V3.537a.75.75 0 0 0-1.5 0v2.033l-.262-.263A7 7 0 0 0 2.75 10a.75.75 0 0 0 1.5 0c0-.51.07-1.003.438-1.424Z" clipRule="evenodd" />
                  </svg>
                  {revalidating
                    ? inventoryUpdateProgress || "Actualizando..."
                    : "Actualizar inventario"}
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
              {([
                ["vehiculos", "Inventario"],
                ["categorias", "Categorias"],
                ["layout", "Editar Home"],
                ["analytics", "Analytics"],
                ["ofertas", "Ofertas recibidas"],
              ] as Array<[AdminTabId, string]>).map(([tabId, label]) => (
                <button
                  key={tabId}
                  type="button"
                  onClick={() => setAdminTab(tabId)}
                  className={`ui-focus rounded-full px-3 py-1 text-xs font-semibold transition ${
                    adminTab === tabId
                      ? "bg-amber-700 text-white"
                      : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {adminTab === "vehiculos" ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  {([
                    ["actual", "Inventario actual"],
                    ["vendidas", "Unidades vendidas"],
                  ] as Array<[InventorySubtabId, string]>).map(([tabId, label]) => (
                    <button
                      key={`inventory-subtab-${tabId}`}
                      type="button"
                      onClick={() => setInventorySubtab(tabId)}
                      className={`ui-focus rounded-full px-3 py-1 text-xs font-semibold transition ${
                        inventorySubtab === tabId
                          ? "bg-slate-900 text-white"
                          : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {inventorySubtab === "actual" ? (
                  <>
                <p className="text-xs leading-relaxed text-slate-700">
                  <strong className="text-slate-900">Stock alineado con el home:</strong>{" "}
                  {homeStockStats.uniqueOnHome} unidades visibles en home
                  {" · "}
                  Ventas directas {homeStockStats.bySection.ventasDirectas}
                  {" · "}
                  Novedades {homeStockStats.bySection.novedades}
                  {" · "}
                  Catalogo {homeStockStats.bySection.catalogo}
                  {homeStockStats.bySection.proximosRemates > 0
                    ? ` · Destacados ${homeStockStats.bySection.proximosRemates}`
                    : ""}
                  {homeStockStats.bySection.managed > 0
                    ? ` · Otras ventas ${homeStockStats.bySection.managed}`
                    : ""}
                </p>
                <div className="space-y-2 overflow-visible">
                  <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                    <input
                      value={searchTerm}
                      onChange={(event) => {
                        setSearchTerm(event.target.value);
                        setEditorPage(1);
                      }}
                      placeholder="Patentes (espacio/coma), modelo o texto..."
                      className="ui-focus w-full rounded-md border border-slate-300/80 bg-white/90 px-3 py-2 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowEditorFiltersMenu((prev) => !prev)}
                      className={`ui-focus inline-flex h-full min-h-10 items-center justify-center gap-1.5 rounded-md border px-3 text-xs font-semibold transition ${
                        showEditorFiltersMenu
                          ? "border-amber-400 bg-amber-50 text-amber-900"
                          : "border-slate-300 bg-white/90 text-slate-700 hover:bg-slate-50"
                      }`}
                      aria-label="Abrir filtros del inventario"
                      aria-expanded={showEditorFiltersMenu}
                      title="Filtros"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        aria-hidden="true"
                      >
                        <path d="M3 5h18M6 12h12M10 19h4" strokeLinecap="round" />
                      </svg>
                      Filtros
                    </button>
                    <EditorAddVehicleMenu
                      onAddNew={() => {
                        if (adminTab !== "vehiculos") {
                          showSystemNotice(
                            "info",
                            "Inventario",
                            "La creacion manual de publicaciones esta disponible en la pestana Inventario.",
                          );
                          return;
                        }
                        openAddVehicleNew();
                      }}
                      onAddFromStock={() => openAddVehicleFromStock()}
                      onAddBulk={() => {
                        if (adminTab !== "vehiculos") {
                          showSystemNotice(
                            "info",
                            "Inventario",
                            "La alta masiva por patente esta disponible en la pestana Inventario.",
                          );
                          return;
                        }
                        openAddVehicleBulk();
                      }}
                      menuLabel="Agregar unidad al inventario"
                    />
                  </div>
                  {showEditorFiltersMenu ? (
                    <div className="admin-editor-filters grid gap-3 border-y border-slate-300/50 py-3 sm:grid-cols-2 lg:grid-cols-4">
                      <label className="block space-y-1">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          Visibilidad
                        </span>
                        <select
                          value={editorVisibilityFilter}
                          onChange={(event) => {
                            setEditorVisibilityFilter(
                              event.target.value as EditorVisibilityFilter,
                            );
                            setEditorPage(1);
                          }}
                          className="ui-focus w-full rounded-md border border-slate-300/80 bg-white/90 px-3 py-2 text-sm"
                        >
                          <option value="all">Visibles y ocultas</option>
                          <option value="visible">Solo visibles en home</option>
                          <option value="hidden">Solo ocultas</option>
                        </select>
                      </label>
                      <label className="block space-y-1">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          Tipo de vehiculo
                        </span>
                        <select
                          value={editorVehicleCategoryFilter}
                          onChange={(event) => {
                            setEditorVehicleCategoryFilter(
                              event.target.value as EditorVehicleCategoryFilter,
                            );
                            setEditorPage(1);
                          }}
                          className="ui-focus w-full rounded-md border border-slate-300/80 bg-white/90 px-3 py-2 text-sm"
                        >
                          <option value="all">Todas las categorias</option>
                          <option value="livianos">Vehiculos livianos</option>
                          <option value="pesados">Vehiculos pesados</option>
                          <option value="maquinaria">Maquinaria</option>
                          <option value="chatarra">Chatarra</option>
                          <option value="otros">Otros</option>
                        </select>
                      </label>
                      {AUCTION_ADMIN_ENABLED ? (
                        <label className="block space-y-1">
                          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                            Remate
                          </span>
                          <select
                            value={auctionFilterId}
                            onChange={(event) => {
                              setAuctionFilterId(event.target.value);
                              if (event.target.value) setEditorGroupFilter("proximos-remates");
                              setEditorPage(1);
                            }}
                            className="ui-focus w-full rounded-md border border-slate-300/80 bg-white/90 px-3 py-2 text-sm"
                          >
                            <option value="">Todos los remates</option>
                            {sortedUpcomingAuctions.map((auction) => (
                              <option key={auction.id} value={auction.id}>
                                {auction.name} ({formatAuctionDateLabel(auction.date)})
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : null}
                      <label className="block space-y-1">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          Grupo / seccion
                        </span>
                        <select
                          value={editorGroupFilter}
                          onChange={(event) => {
                            const next = event.target.value as EditorGroupFilter;
                            setEditorGroupFilter(next);
                            if (next !== "proximos-remates") setAuctionFilterId("");
                            setEditorPage(1);
                          }}
                          className="ui-focus w-full rounded-md border border-slate-300/80 bg-white/90 px-3 py-2 text-sm"
                        >
                          <option value="home">Stock visible en home</option>
                          <option value="unassigned">Sin asignar al home</option>
                          <option value="all">Inventario completo</option>
                          <option value="proximos-remates">Destacados</option>
                          <option value="ventas-directas">Ventas directas</option>
                          <option value="novedades">Novedades</option>
                          <option value="catalogo">Catalogo</option>
                          {(config.managedCategories ?? []).map((category) => (
                            <option key={`group-filter-${category.id}`} value={`managed:${category.id}`}>
                              {category.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  ) : null}
                  {editorPatentFilterActive ? (
                    <p className="text-[11px] tabular-nums text-slate-500">
                      {editorPatentTokens.length} patentes · {filteredEditorItems.length} encontradas
                      {editorMissingPatentTokens.length > 0
                        ? ` · ${editorMissingPatentTokens.length} sin match`
                        : ""}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-2">
                    <AdminIconBtn
                      label={allFilteredEditorSelected ? "Desmarcar filtradas" : "Seleccionar filtradas"}
                      onClick={toggleSelectAllFilteredEditorItems}
                      tone={allFilteredEditorSelected ? "active" : "neutral"}
                      disabled={filteredEditorItems.length === 0}
                    >
                      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                        <path
                          fillRule="evenodd"
                          d="M16.704 5.29a1 1 0 0 1 .006 1.414l-7.2 7.25a1 1 0 0 1-1.42.001l-3-3.015a1 1 0 1 1 1.418-1.41l2.29 2.3 6.49-6.534a1 1 0 0 1 1.416-.006Z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </AdminIconBtn>
                    {editorSelectedCount > 0 ? (
                      <>
                        <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-md bg-slate-900 px-2 text-xs font-semibold tabular-nums text-white">
                          {editorSelectedCount}
                        </span>
                        <div className="relative">
                          <AdminIconBtn
                            label="Agregar a grupo"
                            tone={showEditorBulkGroupMenu ? "active" : "success"}
                            onClick={() => {
                              setShowEditorBulkGroupMenu((prev) => !prev);
                              setShowEditorBulkMenu(false);
                            }}
                          >
                            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                              <path d="M10 3a1 1 0 0 1 1 1v5h5a1 1 0 1 1 0 2h-5v5a1 1 0 1 1-2 0v-5H4a1 1 0 1 1 0-2h5V4a1 1 0 0 1 1-1Z" />
                            </svg>
                          </AdminIconBtn>
                          {showEditorBulkGroupMenu ? (
                            <div className="absolute left-0 top-full z-50 mt-1 min-w-[10.5rem] rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
                              {BASE_HOME_SECTION_ORDER.map((sectionId) => (
                                <button
                                  key={`bulk-group-${sectionId}`}
                                  type="button"
                                  onClick={() => applyBulkAssignToSection(sectionId)}
                                  className="ui-focus flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-semibold text-slate-700 transition hover:bg-amber-50"
                                  title={`Agregar a ${SECTION_LABELS[sectionId]}`}
                                >
                                  <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded bg-slate-100 text-[10px] font-bold uppercase text-slate-600">
                                    {sectionId === "proximos-remates"
                                      ? "★"
                                      : sectionId === "ventas-directas"
                                        ? "VD"
                                        : sectionId === "novedades"
                                          ? "N"
                                          : "C"}
                                  </span>
                                  {SECTION_LABELS[sectionId]}
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </div>
                        <div className="relative">
                          <AdminIconBtn
                            label="Acciones masivas"
                            tone={showEditorBulkMenu ? "active" : "neutral"}
                            onClick={() => {
                              setShowEditorBulkMenu((prev) => !prev);
                              setShowEditorBulkGroupMenu(false);
                            }}
                          >
                            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                              <path d="M4 10a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Zm4.5 0a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Zm4.5 0a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Z" />
                            </svg>
                          </AdminIconBtn>
                          {showEditorBulkMenu ? (
                            <div className="absolute left-0 top-full z-40 mt-1 flex gap-1 rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg">
                              <AdminIconBtn
                                label="Mostrar en home"
                                tone="success"
                                onClick={() => {
                                  applyBulkEditorInventoryAction("show");
                                  setShowEditorBulkMenu(false);
                                }}
                              >
                                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                                  <path d="M10 4c3.38 0 6.63 2 8.37 5.42a1.3 1.3 0 0 1 0 1.16C16.63 14 13.38 16 10 16s-6.63-2-8.37-5.42a1.3 1.3 0 0 1 0-1.16C3.37 6 6.62 4 10 4Zm0 2c-2.6 0-5.16 1.5-6.71 4 .01.02.02.04.03.05C4.84 12.5 7.4 14 10 14s5.16-1.5 6.71-4a.63.63 0 0 0-.03-.05C15.16 7.5 12.6 6 10 6Zm0 1.75A2.25 2.25 0 1 1 10 12.25 2.25 2.25 0 0 1 10 7.75Z" />
                                </svg>
                              </AdminIconBtn>
                              <AdminIconBtn
                                label="Ocultar del home"
                                onClick={() => {
                                  applyBulkEditorInventoryAction("hide");
                                  setShowEditorBulkMenu(false);
                                }}
                              >
                                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                                  <path d="M10 4c3.38 0 6.63 2 8.37 5.42a1.3 1.3 0 0 1 0 1.16C16.63 14 13.38 16 10 16c-1.72 0-3.42-.52-4.95-1.5l1.5-1.5c1.06.63 2.24.97 3.45.97 2.6 0 5.16-1.5 6.71-4a.63.63 0 0 0-.03-.05C15.16 7.5 12.6 6 10 6c-1.2 0-2.38.34-3.43.96L5.1 5.49A9.85 9.85 0 0 1 10 4Zm7.2 13.6a.75.75 0 0 1-1.06 0l-13-13a.75.75 0 1 1 1.06-1.06l13 13a.75.75 0 0 1 0 1.06ZM10 7.75c.7 0 1.33.32 1.75.83L8.58 11.75A2.25 2.25 0 0 1 10 7.75Z" />
                                </svg>
                              </AdminIconBtn>
                              <AdminIconBtn
                                label="Marcar vendidas"
                                tone="warn"
                                onClick={() => {
                                  applyBulkEditorInventoryAction("sold");
                                  setShowEditorBulkMenu(false);
                                }}
                              >
                                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                                  <path fillRule="evenodd" d="M16.704 5.29a1 1 0 0 1 .006 1.414l-7.2 7.25a1 1 0 0 1-1.42.001l-3-3.015a1 1 0 1 1 1.418-1.41l2.29 2.3 6.49-6.534a1 1 0 0 1 1.416-.006Z" clipRule="evenodd" />
                                </svg>
                              </AdminIconBtn>
                              <AdminIconBtn
                                label="Quitar del home"
                                tone="danger"
                                onClick={() => {
                                  applyBulkEditorInventoryAction("remove");
                                  setShowEditorBulkMenu(false);
                                }}
                              >
                                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                                  <path fillRule="evenodd" d="M8.75 2A2.75 2.75 0 0 0 6 4.75V5H3.75a.75.75 0 0 0 0 1.5h.38l.96 10.04A2.75 2.75 0 0 0 7.87 19h4.26a2.75 2.75 0 0 0 2.73-2.46l.96-10.04h.38a.75.75 0 0 0 0-1.5H14v-.25A2.75 2.75 0 0 0 11.25 2h-2.5Zm1.5 3V4.75c0-.69.56-1.25 1.25-1.25h.5c.69 0 1.25.56 1.25 1.25V5h-3Zm-2.16 1.5h6.82l-.9 9.4a1.25 1.25 0 0 1-1.24 1.12H7.87a1.25 1.25 0 0 1-1.24-1.12l-.9-9.4Z" clipRule="evenodd" />
                                </svg>
                              </AdminIconBtn>
                            </div>
                          ) : null}
                        </div>
                        <AdminIconBtn label="Limpiar seleccion" onClick={clearEditorSelection}>
                          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                            <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                          </svg>
                        </AdminIconBtn>
                      </>
                    ) : null}
                  </div>
                </div>
                {filteredEditorItems.length === 0 &&
                editorHiddenPatentMatches.length > 0 &&
                editorVisibilityFilter === "visible" ? (
                  <p className="rounded-md border border-amber-300/60 bg-amber-50/80 px-3 py-2 text-xs text-amber-900">
                    {editorHiddenPatentMatches.length === 1
                      ? `${getPatent(editorHiddenPatentMatches[0]!)} esta en inventario pero oculta del home.`
                      : `${editorHiddenPatentMatches.length} unidades coinciden pero estan ocultas del home.`}{" "}
                    Cambia visibilidad a <strong>Visibles y ocultas</strong>, o vuelve a agregarla desde «Agregar
                    desde inventario» para restaurar la visibilidad.
                  </p>
                ) : null}
                <div className="space-y-1.5">
                  {paginatedEditorItems.map((item) => {
                    const key = getVehicleKey(item);
                    const hidden = mergedHiddenVehicleIds.has(key);
                    const selected = editorSelectedKeys.includes(key);
                    const channelLabels = getHomeEditorChannelLabels(config, key, itemsByKey);
                    const auctionLabel = upcomingAuctionByVehicleKey[key];
                    const priceLabel = formatPrice(config.vehiclePrices[key]);
                    return (
                      <article
                        key={`editor-${key}`}
                        className={`grid grid-cols-1 items-center gap-2 rounded-lg border px-2 py-1.5 sm:grid-cols-[auto_1.5fr_auto_1fr_auto] ${
                          selected
                            ? "border-amber-400 bg-amber-50/40"
                            : "border-slate-200/80 bg-slate-50/20"
                        }`}
                      >
                        <label className="flex items-center justify-center px-1">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleEditorItemSelection(key)}
                            className="ui-focus h-4 w-4 rounded border-slate-300"
                            aria-label={`Seleccionar ${getPatent(item)}`}
                          />
                        </label>
                        <div className="min-w-0">
                          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                            {getPatent(item)}
                            <span
                              className={`inline-flex h-1.5 w-1.5 rounded-full ${
                                hidden ? "bg-rose-500" : "bg-emerald-500"
                              }`}
                              title={hidden ? "Oculto" : "Visible"}
                              aria-hidden="true"
                            />
                          </p>
                          <p className="line-clamp-1 text-sm font-semibold leading-tight text-slate-900">
                            {getVehicleDisplayTitle(item)}
                          </p>
                          {channelLabels.length > 0 ? (
                            <p className="mt-0.5 line-clamp-1 text-[10px] text-slate-500">
                              {channelLabels.join(" · ")}
                            </p>
                          ) : null}
                        </div>
                        <div className="mx-auto h-11 w-[4.5rem] overflow-hidden rounded-md border border-slate-200 bg-slate-100">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={item.thumbnail ?? item.images[0] ?? "/placeholder-car.svg"}
                            alt=""
                            className="h-full w-full object-cover"
                            loading="lazy"
                            onError={(event) => {
                              event.currentTarget.src = "/placeholder-car.svg";
                            }}
                          />
                        </div>
                        <div className="min-w-0 text-[11px] text-slate-600 sm:text-right">
                          {auctionLabel ? (
                            <p className="line-clamp-1">{auctionLabel}</p>
                          ) : null}
                          <p className="line-clamp-1 font-medium text-slate-800">
                            {priceLabel ?? "—"}
                          </p>
                        </div>
                        <div className="flex items-center justify-end gap-1">
                          <AdminIconBtn label="Editar" onClick={() => openEditVehicleModal(item)}>
                            <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
                              <path d="M13.586 2.586a2 2 0 0 1 2.828 2.828l-8.2 8.2a1 1 0 0 1-.475.264l-3 0.75a1 1 0 0 1-1.212-1.213l.75-3a1 1 0 0 1 .264-.474l8.2-8.2ZM12.172 4 5.24 10.932l-.39 1.56 1.56-.39L13.344 5.17 12.172 4Z" />
                            </svg>
                          </AdminIconBtn>
                          <AdminIconBtn
                            label={hidden ? "Mostrar en home" : "Ocultar del home"}
                            tone={hidden ? "success" : "neutral"}
                            onClick={() => toggleHidden(key)}
                          >
                            {hidden ? (
                              <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
                                <path d="M10 4c3.38 0 6.63 2 8.37 5.42a1.3 1.3 0 0 1 0 1.16C16.63 14 13.38 16 10 16s-6.63-2-8.37-5.42a1.3 1.3 0 0 1 0-1.16C3.37 6 6.62 4 10 4Zm0 2c-2.6 0-5.16 1.5-6.71 4 .01.02.02.04.03.05C4.84 12.5 7.4 14 10 14s5.16-1.5 6.71-4a.63.63 0 0 0-.03-.05C15.16 7.5 12.6 6 10 6Zm0 1.75A2.25 2.25 0 1 1 10 12.25 2.25 2.25 0 0 1 10 7.75Z" />
                              </svg>
                            ) : (
                              <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
                                <path d="M10 4c3.38 0 6.63 2 8.37 5.42a1.3 1.3 0 0 1 0 1.16C16.63 14 13.38 16 10 16c-1.72 0-3.42-.52-4.95-1.5l1.5-1.5c1.06.63 2.24.97 3.45.97 2.6 0 5.16-1.5 6.71-4a.63.63 0 0 0-.03-.05C15.16 7.5 12.6 6 10 6c-1.2 0-2.38.34-3.43.96L5.1 5.49A9.85 9.85 0 0 1 10 4Zm7.2 13.6a.75.75 0 0 1-1.06 0l-13-13a.75.75 0 1 1 1.06-1.06l13 13a.75.75 0 0 1 0 1.06ZM10 7.75c.7 0 1.33.32 1.75.83L8.58 11.75A2.25 2.25 0 0 1 10 7.75Z" />
                              </svg>
                            )}
                          </AdminIconBtn>
                          <AdminIconBtn
                            label="Marcar vendida"
                            tone="warn"
                            onClick={() => markVehicleAsSold(key)}
                          >
                            <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
                              <path fillRule="evenodd" d="M16.704 5.29a1 1 0 0 1 .006 1.414l-7.2 7.25a1 1 0 0 1-1.42.001l-3-3.015a1 1 0 1 1 1.418-1.41l2.29 2.3 6.49-6.534a1 1 0 0 1 1.416-.006Z" clipRule="evenodd" />
                            </svg>
                          </AdminIconBtn>
                        </div>
                      </article>
                    );
                  })}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-300/40 pt-3">
                  <p className="text-[11px] tabular-nums text-slate-500">
                    {paginatedEditorItems.length}/{filteredEditorItems.length}
                    {editorPatentFilterActive ? " patentes" : ""}
                  </p>
                  <div className="flex items-center gap-1">
                    <AdminIconBtn
                      label="Pagina anterior"
                      onClick={() => setEditorPage((prev) => Math.max(1, prev - 1))}
                      disabled={currentEditorPage === 1}
                    >
                      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M11.78 4.22a.75.75 0 0 1 0 1.06L8.06 9l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
                      </svg>
                    </AdminIconBtn>
                    <span className="min-w-[3rem] text-center text-[11px] font-semibold tabular-nums text-slate-600">
                      {currentEditorPage}/{totalEditorPages}
                    </span>
                    <AdminIconBtn
                      label="Pagina siguiente"
                      onClick={() => setEditorPage((prev) => Math.min(totalEditorPages, prev + 1))}
                      disabled={currentEditorPage >= totalEditorPages}
                    >
                      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M8.22 4.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 11 8.22 7.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                      </svg>
                    </AdminIconBtn>
                  </div>
                </div>
                  </>
                ) : null}
                {inventorySubtab === "vendidas" ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                      Unidades vendidas (tabla dinamica)
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      Busca, filtra y exporta el historial de ventas. Puedes revertir una venta desde esta tabla.
                    </p>
                    <div className="relative mt-3 flex flex-wrap items-center gap-2">
                      <input
                        value={soldSearch}
                        onChange={(event) => setSoldSearch(event.target.value)}
                        placeholder="Buscar en tabla..."
                        className="ui-focus min-w-[16rem] flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSoldFiltersMenu((prev) => !prev)}
                        className="ui-focus inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-50"
                        aria-label="Abrir filtros de unidades vendidas"
                        title="Filtros"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          aria-hidden="true"
                        >
                          <path d="M3 5h18M6 12h12M10 19h4" strokeLinecap="round" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          downloadSoldRowsExcel(
                            soldFilteredRows,
                            soldSearch.trim().length > 0 || soldFiltersActiveCount > 0
                              ? "filtrado"
                              : "total",
                          )
                        }
                        className="ui-focus inline-flex h-9 w-9 items-center justify-center rounded-md border border-emerald-300 bg-emerald-50 text-emerald-700 transition hover:bg-emerald-100"
                        aria-label="Descargar Excel de unidades vendidas"
                        title={
                          soldSearch.trim().length > 0 || soldFiltersActiveCount > 0
                            ? "Descargar Excel filtrado"
                            : "Descargar Excel completo"
                        }
                      >
                        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                          <path d="M10 2a1 1 0 0 1 1 1v6.59l1.3-1.3a1 1 0 1 1 1.4 1.42l-3 2.97a1 1 0 0 1-1.4 0l-3-2.97a1 1 0 0 1 1.4-1.42l1.3 1.3V3a1 1 0 0 1 1-1Z" />
                          <path d="M3 13a1 1 0 0 1 1 1v1h12v-1a1 1 0 1 1 2 0v2a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1Z" />
                        </svg>
                      </button>
                      <div className="inline-flex h-9 items-center rounded-md border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700">
                        {formatCompactNumber(soldFilteredRows.length)} resultado(s)
                      </div>
                      {showSoldFiltersMenu ? (
                        <div className="absolute right-0 top-full z-20 mt-2 w-full max-w-3xl rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Filtros de unidades vendidas
                          </p>
                          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                            <select
                              value={soldSearchField}
                              onChange={(event) => setSoldSearchField(event.target.value as SoldFilterField)}
                              className="ui-focus rounded-md border border-slate-300 bg-white px-3 py-2 text-xs"
                            >
                              <option value="all">Buscar en todas las columnas</option>
                              <option value="patent">Patente</option>
                              <option value="title">Modelo</option>
                              <option value="soldCategory">Categoria de venta</option>
                              <option value="auctionName">Origen de venta</option>
                            </select>
                            <select
                              value={soldAuctionFilter}
                              onChange={(event) => setSoldAuctionFilter(event.target.value)}
                              className="ui-focus rounded-md border border-slate-300 bg-white px-3 py-2 text-xs"
                            >
                              <option value="all">Todos los origenes</option>
                              {soldAuctionOptions.map((option) => (
                                <option key={`sold-origin-${option}`} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                            <input
                              type="date"
                              value={soldDateFrom}
                              onChange={(event) => setSoldDateFrom(event.target.value)}
                              className="ui-focus rounded-md border border-slate-300 bg-white px-3 py-2 text-xs"
                            />
                            <input
                              type="date"
                              value={soldDateTo}
                              onChange={(event) => setSoldDateTo(event.target.value)}
                              className="ui-focus rounded-md border border-slate-300 bg-white px-3 py-2 text-xs"
                            />
                          </div>
                          <div className="mt-2 flex flex-wrap justify-between gap-2">
                            <span className="inline-flex items-center rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                              {soldFiltersActiveCount} filtro(s) activo(s)
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setSoldSearchField("all");
                                setSoldAuctionFilter("all");
                                setSoldDateFrom("");
                                setSoldDateTo("");
                              }}
                              className="ui-focus rounded-md border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                            >
                              Limpiar filtros
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-3 overflow-auto rounded-xl border border-slate-200 bg-white">
                      {soldFilteredRows.length === 0 ? (
                        <p className="p-4 text-sm text-slate-500">No hay unidades vendidas para los filtros actuales.</p>
                      ) : (
                        <table className="min-w-[980px] w-full text-left text-xs">
                          <thead className="bg-slate-50 text-slate-600">
                            <tr>
                              {["Fecha venta", "Patente", "Modelo", "Categoria venta", "Origen", "ID vehiculo", "Acciones"].map((label) => (
                                <th key={`sold-col-${label}`} className="px-3 py-2 font-semibold uppercase tracking-wide">
                                  {label}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {soldFilteredRows.map((entry) => (
                              <tr key={`${entry.vehicleKey}-${entry.soldAt}`} className="border-b border-slate-100 align-top">
                                <td className="whitespace-nowrap px-3 py-2 text-slate-700">
                                  {new Date(entry.soldAt).toLocaleString("es-CL")}
                                </td>
                                <td className="whitespace-nowrap px-3 py-2 font-semibold text-slate-800">
                                  {entry.patent}
                                </td>
                                <td className="px-3 py-2 text-slate-800">{entry.title}</td>
                                <td className="px-3 py-2 text-slate-700">{getSoldCategoryLabel(entry)}</td>
                                <td className="px-3 py-2 text-slate-700">
                                  {entry.auctionName?.trim() || "Venta individual"}
                                </td>
                                <td className="px-3 py-2 font-mono text-[11px] text-slate-500">
                                  {entry.vehicleKey}
                                </td>
                                <td className="px-3 py-2">
                                  <button
                                    type="button"
                                    onClick={() => setPendingRevertSale(entry)}
                                    className="ui-focus inline-flex h-7 w-7 items-center justify-center rounded border border-amber-300 bg-stone-100 text-amber-800 transition hover:bg-stone-200"
                                    aria-label={`Revertir venta ${entry.patent}`}
                                    title="Revertir venta"
                                  >
                                    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                                      <path d="M10 3a7 7 0 1 1-6.2 10.25.75.75 0 1 1 1.32-.72A5.5 5.5 0 1 0 4.5 10H6a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 10.75V7.5a.75.75 0 0 1 1.5 0v1.3A7 7 0 0 1 10 3Z" />
                                    </svg>
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}

            {adminTab === "categorias" ? (
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Secciones base del home
                    </p>
                    <p className="text-sm text-slate-600">
                      Gestiona las secciones base del home y las categorias personalizadas.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCreateCategoryForm((prev) => !prev)}
                    className="ui-focus inline-flex h-8 w-8 items-center justify-center rounded-full bg-amber-700 text-lg font-bold leading-none text-white transition hover:bg-amber-600"
                    aria-label={showCreateCategoryForm ? "Cerrar creacion de grupo" : "Abrir creacion de grupo"}
                    title={showCreateCategoryForm ? "Cerrar" : "Crear grupo"}
                  >
                    {showCreateCategoryForm ? "-" : "+"}
                  </button>
                </div>

                {showCreateCategoryForm ? (
                  <div className="mt-3 grid gap-2 rounded-lg border border-stone-200 bg-stone-100/40 p-2 md:grid-cols-[1fr_1fr_auto_auto]">
                    <input
                      value={newCategoryName}
                      onChange={(event) => setNewCategoryName(event.target.value)}
                      placeholder="Nombre categoria"
                      className="ui-focus rounded-md border border-stone-300 bg-white px-3 py-2 text-sm"
                    />
                    <input
                      value={newCategoryDescription}
                      onChange={(event) => setNewCategoryDescription(event.target.value)}
                      placeholder="Descripcion categoria"
                      className="ui-focus rounded-md border border-stone-300 bg-white px-3 py-2 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => createManagedCategory(false)}
                      className="ui-focus rounded-md border border-amber-300 bg-white px-3 py-2 text-sm font-semibold text-amber-800 transition hover:bg-stone-100"
                    >
                      Guardar
                    </button>
                    <button
                      type="button"
                      onClick={() => createManagedCategory(true)}
                      className="ui-focus rounded-md bg-amber-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-amber-600"
                    >
                      Agregar unidades
                    </button>
                  </div>
                ) : null}

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                      Recien publicados
                    </p>
                    <p className="text-xs text-slate-500">
                      Seccion opcional del home para destacar ultimas unidades.
                    </p>
                  </div>
                  <label className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={config.homeLayout.showRecentPublications}
                      onChange={(event) =>
                        setHomeLayout("showRecentPublications", event.target.checked)
                      }
                    />
                    {config.homeLayout.showRecentPublications ? "Activado" : "Desactivado"}
                  </label>
                </div>

                <div className="mt-3 space-y-2">
                  <div className="hidden gap-2 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 md:grid md:grid-cols-[minmax(170px,1.1fr)_minmax(300px,1.8fr)_72px_228px]">
                    <span>Grupo</span>
                    <span>Descripcion / textos</span>
                    <span className="text-center">Unidades</span>
                    <span className="text-right">Acciones</span>
                  </div>

                  <p className="px-2 text-[11px] font-semibold uppercase tracking-wide text-indigo-600">
                    Secciones base
                  </p>
                  {(["proximos-remates", "ventas-directas", "novedades", "catalogo"] as SectionId[]).map(
                    (sectionId) => {
                      const isEditingTexts = editingSectionTextId === sectionId;
                      const sectionHidden = hiddenHomeCategoryIds.has(sectionCategoryKey(sectionId));
                      return (
                        <article
                          key={sectionId}
                          className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 bg-slate-50/30 px-2.5 py-2 md:grid-cols-[minmax(170px,1.1fr)_minmax(300px,1.8fr)_72px_228px] md:items-center"
                        >
                          <div className="min-h-8 md:flex md:items-center">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                              {SECTION_LABELS[sectionId]}
                            </p>
                          </div>
                          <div className="min-h-12 rounded-md border border-slate-200 bg-white px-2.5 py-1.5">
                            {isEditingTexts ? (
                              <div className="grid gap-1 md:grid-cols-[1fr_1fr_auto]">
                                <input
                                  value={config.sectionTexts[sectionId]?.title ?? ""}
                                  onChange={(event) => setSectionText(sectionId, "title", event.target.value)}
                                  placeholder="Titulo"
                                  className="ui-focus rounded-md border border-slate-200 bg-white px-2 py-1 text-xs"
                                />
                                <input
                                  value={config.sectionTexts[sectionId]?.subtitle ?? ""}
                                  onChange={(event) => setSectionText(sectionId, "subtitle", event.target.value)}
                                  placeholder="Descripcion"
                                  className="ui-focus rounded-md border border-slate-200 bg-white px-2 py-1 text-xs"
                                />
                                <button
                                  type="button"
                                  onClick={() => setEditingSectionTextId(null)}
                                  className="ui-focus inline-flex h-8 w-8 items-center justify-center rounded border border-emerald-300 bg-emerald-50 text-emerald-700"
                                  aria-label={`Cerrar edicion de ${SECTION_LABELS[sectionId]}`}
                                  title="Listo"
                                >
                                  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                                    <path fillRule="evenodd" d="M16.704 5.29a1 1 0 0 1 .006 1.414l-7.2 7.25a1 1 0 0 1-1.42.001l-3-3.015a1 1 0 1 1 1.418-1.41l2.29 2.3 6.49-6.534a1 1 0 0 1 1.416-.006Z" clipRule="evenodd" />
                                  </svg>
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="line-clamp-1 text-sm font-semibold text-slate-700">
                                    {config.sectionTexts[sectionId]?.title ?? SECTION_LABELS[sectionId]}
                                  </p>
                                  <p className="line-clamp-1 text-xs text-slate-500">
                                    {config.sectionTexts[sectionId]?.subtitle ?? "Sin descripcion"}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setEditingSectionTextId(sectionId)}
                                  className="ui-focus inline-flex h-7 w-7 items-center justify-center rounded border border-slate-300 bg-slate-50 text-slate-700 transition hover:bg-slate-100"
                                  aria-label={`Editar textos de ${SECTION_LABELS[sectionId]}`}
                                  title="Editar textos"
                                >
                                  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                                    <path d="M13.586 2.586a2 2 0 0 1 2.828 2.828l-8.2 8.2a1 1 0 0 1-.475.264l-3 0.75a1 1 0 0 1-1.212-1.213l.75-3a1 1 0 0 1 .264-.474l8.2-8.2ZM12.172 4 5.24 10.932l-.39 1.56 1.56-.39L13.344 5.17 12.172 4Z" />
                                  </svg>
                                </button>
                              </div>
                            )}
                          </div>
                        <div className="mx-auto flex h-8 w-14 items-center justify-center rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700">
                          {sectionVehicleCounts[sectionId]}
                        </div>
                        <div className="flex items-center justify-end gap-1.5 md:w-56">
                          <button
                            type="button"
                            onClick={() =>
                              toggleCategoryHidden(sectionCategoryKey(sectionId), SECTION_LABELS[sectionId])
                            }
                            className={`ui-focus inline-flex h-8 w-8 items-center justify-center rounded border transition ${
                              sectionHidden
                                ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                            }`}
                            aria-label={`${sectionHidden ? "Mostrar" : "Ocultar"} ${SECTION_LABELS[sectionId]} en home`}
                            title={sectionHidden ? "Mostrar en home" : "Ocultar del home"}
                          >
                            {sectionHidden ? (
                              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                                <path d="M10 4c3.38 0 6.63 2 8.37 5.42a1.3 1.3 0 0 1 0 1.16C16.63 14 13.38 16 10 16s-6.63-2-8.37-5.42a1.3 1.3 0 0 1 0-1.16C3.37 6 6.62 4 10 4Zm0 2c-2.6 0-5.16 1.5-6.71 4 .01.02.02.04.03.05C4.84 12.5 7.4 14 10 14s5.16-1.5 6.71-4a.63.63 0 0 0-.03-.05C15.16 7.5 12.6 6 10 6Zm0 1.75A2.25 2.25 0 1 1 10 12.25 2.25 2.25 0 0 1 10 7.75Z" />
                              </svg>
                            ) : (
                              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                                <path d="M10 4c3.38 0 6.63 2 8.37 5.42a1.3 1.3 0 0 1 0 1.16C16.63 14 13.38 16 10 16c-1.72 0-3.42-.52-4.95-1.5l1.5-1.5c1.06.63 2.24.97 3.45.97 2.6 0 5.16-1.5 6.71-4a.63.63 0 0 0-.03-.05C15.16 7.5 12.6 6 10 6c-1.2 0-2.38.34-3.43.96L5.1 5.49A9.85 9.85 0 0 1 10 4Zm7.2 13.6a.75.75 0 0 1-1.06 0l-13-13a.75.75 0 1 1 1.06-1.06l13 13a.75.75 0 0 1 0 1.06ZM10 7.75c.7 0 1.33.32 1.75.83L8.58 11.75A2.25 2.25 0 0 1 10 7.75Z" />
                              </svg>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditorGroupFilter(sectionId);
                              if (sectionId !== "proximos-remates") setAuctionFilterId("");
                              setEditorPage(1);
                              setAdminTab("vehiculos");
                            }}
                            className="ui-focus inline-flex h-8 w-8 items-center justify-center rounded border border-amber-300 bg-stone-100 text-amber-800"
                            aria-label={`Ver y gestionar ${SECTION_LABELS[sectionId]}`}
                            title="Ver y gestionar"
                          >
                            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                              <path d="M10 4c4.5 0 7.8 3.16 8.9 5.5.13.28.13.62 0 .9C17.8 12.74 14.5 15.9 10 15.9S2.2 12.74 1.1 10.4a1.06 1.06 0 0 1 0-.9C2.2 7.16 5.5 4 10 4Zm0 2c-3.42 0-6.06 2.31-7.08 4 .99 1.69 3.64 4 7.08 4s6.09-2.31 7.08-4C16.06 8.31 13.42 6 10 6Zm0 1.5A2.5 2.5 0 1 1 7.5 10 2.5 2.5 0 0 1 10 7.5Z" />
                            </svg>
                          </button>
                          {sectionId !== "proximos-remates" || !AUCTION_ADMIN_ENABLED ? (
                            <EditorAddVehicleMenu
                              compact
                              menuLabel={`Agregar unidades a ${SECTION_LABELS[sectionId]}`}
                              onAddNew={() => openAddVehicleNew([sectionId])}
                              onAddFromStock={() =>
                                openAddVehicleFromStock({
                                  type: "section",
                                  sectionId,
                                })
                              }
                              onAddBulk={() => openAddVehicleBulk([sectionId])}
                            />
                          ) : null}
                        </div>
                      </article>
                      );
                    },
                  )}

                  <p className="px-2 pt-2 text-[11px] font-semibold uppercase tracking-wide text-indigo-600">
                    Categorias personalizadas
                  </p>
                  {(config.managedCategories ?? []).length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-500">
                      No hay categorias personalizadas aun.
                    </div>
                  ) : (
                    (config.managedCategories ?? []).map((category) => {
                      const categoryHidden = hiddenHomeCategoryIds.has(managedCategoryKey(category.id));
                      return (
                        <article
                          key={category.id}
                          className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 bg-slate-50/30 px-2.5 py-2 md:grid-cols-[minmax(170px,1.1fr)_minmax(300px,1.8fr)_72px_228px] md:items-center"
                        >
                          <input
                            value={category.name}
                            onChange={(event) =>
                              updateManagedCategory(category.id, { name: event.target.value })
                            }
                            className="ui-focus rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-semibold"
                          />
                          <input
                            value={category.description}
                            onChange={(event) =>
                              updateManagedCategory(category.id, { description: event.target.value })
                            }
                            className="ui-focus rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm"
                          />
                          <div className="mx-auto flex h-8 w-14 items-center justify-center rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700">
                            {category.vehicleIds.length}
                          </div>
                          <div className="flex items-center justify-end gap-1.5 md:w-56">
                            <button
                              type="button"
                              onClick={() =>
                                toggleCategoryHidden(managedCategoryKey(category.id), category.name)
                              }
                              className={`ui-focus inline-flex h-8 w-8 items-center justify-center rounded border transition ${
                                categoryHidden
                                  ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                              }`}
                              aria-label={`${categoryHidden ? "Mostrar" : "Ocultar"} ${category.name} en home`}
                              title={categoryHidden ? "Mostrar en home" : "Ocultar del home"}
                            >
                              {categoryHidden ? (
                                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                                  <path d="M10 4c3.38 0 6.63 2 8.37 5.42a1.3 1.3 0 0 1 0 1.16C16.63 14 13.38 16 10 16s-6.63-2-8.37-5.42a1.3 1.3 0 0 1 0-1.16C3.37 6 6.62 4 10 4Zm0 2c-2.6 0-5.16 1.5-6.71 4 .01.02.02.04.03.05C4.84 12.5 7.4 14 10 14s5.16-1.5 6.71-4a.63.63 0 0 0-.03-.05C15.16 7.5 12.6 6 10 6Zm0 1.75A2.25 2.25 0 1 1 10 12.25 2.25 2.25 0 0 1 10 7.75Z" />
                                </svg>
                              ) : (
                                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                                  <path d="M10 4c3.38 0 6.63 2 8.37 5.42a1.3 1.3 0 0 1 0 1.16C16.63 14 13.38 16 10 16c-1.72 0-3.42-.52-4.95-1.5l1.5-1.5c1.06.63 2.24.97 3.45.97 2.6 0 5.16-1.5 6.71-4a.63.63 0 0 0-.03-.05C15.16 7.5 12.6 6 10 6c-1.2 0-2.38.34-3.43.96L5.1 5.49A9.85 9.85 0 0 1 10 4Zm7.2 13.6a.75.75 0 0 1-1.06 0l-13-13a.75.75 0 1 1 1.06-1.06l13 13a.75.75 0 0 1 0 1.06ZM10 7.75c.7 0 1.33.32 1.75.83L8.58 11.75A2.25 2.25 0 0 1 10 7.75Z" />
                                </svg>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setAssignCategoryId(category.id);
                                setAssignSearchTerm("");
                              }}
                              className="ui-focus inline-flex h-8 w-8 items-center justify-center rounded border border-amber-300 bg-stone-100 text-amber-800"
                              aria-label={`Asignar vehiculos a ${category.name}`}
                              title="Asignar vehiculos"
                            >
                              +
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteManagedCategory(category.id)}
                              className="ui-focus inline-flex h-8 w-8 items-center justify-center rounded border border-rose-300 bg-rose-50 text-rose-700"
                              aria-label={`Eliminar ${category.name}`}
                              title="Eliminar"
                            >
                              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                                <path d="M7 2.5A1.5 1.5 0 0 0 5.5 4v.5H3.75a.75.75 0 0 0 0 1.5h.56l.75 9.02A2 2 0 0 0 7.06 17h5.88a2 2 0 0 0 1.99-1.98l.75-9.02h.57a.75.75 0 0 0 0-1.5H14.5V4A1.5 1.5 0 0 0 13 2.5H7Zm6 .5a.5.5 0 0 1 .5.5v.5h-7V3.5a.5.5 0 0 1 .5-.5h6ZM8 8.25a.75.75 0 0 1 1.5 0v5a.75.75 0 0 1-1.5 0v-5Zm3 0a.75.75 0 0 1 1.5 0v5a.75.75 0 0 1-1.5 0v-5Z" />
                              </svg>
                            </button>
                          </div>
                        </article>
                      );
                    })
                  )}
                </div>
              </div>
            ) : null}

            {adminTab === "layout" ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Constructor del Home
                    </p>
                    <h4 className="text-base font-bold text-slate-900">
                      Simulacion del home (edicion directa)
                    </h4>
                    <p className="mt-1 text-sm text-slate-600">
                      Todo se edita desde esta unica vista: textos HTML, visibilidad de bloques y orden de secciones.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={resetHomeLayoutToDefault}
                      className="ui-focus rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
                    >
                      Restaurar base
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Simulacion del home (tiempo real)
                    </p>
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                      Auto guardado activo
                    </span>
                  </div>

                  <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3">
                    <div
                      className={`rounded-lg border p-3 ${
                        config.homeLayout.heroTheme === "indigo"
                          ? "border-indigo-200 bg-indigo-50"
                          : config.homeLayout.heroTheme === "slate"
                            ? "border-slate-300 bg-slate-100"
                            : "border-stone-300 bg-stone-100"
                      }`}
                    >
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Hero editable (admite HTML)
                      </p>
                      <div className="grid gap-2">
                        <div className="rounded-md border border-slate-300 bg-white p-2">
                          <div className="mb-2 space-y-2 rounded-md border border-slate-200 bg-slate-50 p-2">
                            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
                              <span className="rounded-full border border-slate-300 bg-white px-2 py-0.5 font-semibold">
                                Editor: {activeHeroRichEditor === "kicker" ? "Encabezado" : activeHeroRichEditor === "title" ? "Titulo" : "Subtitulo"}
                              </span>
                              <span className="rounded-full border border-slate-300 bg-white px-2 py-0.5 font-semibold">
                                Fuente: {heroToolbarState.fontFamily}
                              </span>
                              <span className="rounded-full border border-slate-300 bg-white px-2 py-0.5 font-semibold">
                                Formato: {heroToolbarState.formatBlock.toUpperCase()}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <select
                                value={heroToolbarState.formatBlock}
                                onChange={(event) => {
                                  const value = event.target.value;
                                  if (value === "p") runHeroHtmlCommand("formatBlock", "<p>");
                                  if (value === "h2") runHeroHtmlCommand("formatBlock", "<h2>");
                                  if (value === "h3") runHeroHtmlCommand("formatBlock", "<h3>");
                                }}
                                className="ui-focus rounded border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700"
                                title="Tipo de bloque"
                              >
                                <option value="p">Parrafo</option>
                                <option value="h2">Titulo H2</option>
                                <option value="h3">Subtitulo H3</option>
                              </select>
                              <select
                                value={heroToolbarState.fontFamily}
                                onChange={(event) => runHeroHtmlCommand("fontName", event.target.value)}
                                className="ui-focus rounded border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700"
                                title="Fuente del texto"
                              >
                                {["Inter", "Arial", "Georgia", "Times New Roman", "Courier New"].includes(heroToolbarState.fontFamily) ? null : (
                                  <option value={heroToolbarState.fontFamily}>{heroToolbarState.fontFamily}</option>
                                )}
                                <option value="Inter">Inter</option>
                                <option value="Arial">Arial</option>
                                <option value="Georgia">Georgia</option>
                                <option value="Times New Roman">Times New Roman</option>
                                <option value="Courier New">Courier New</option>
                              </select>
                              <button type="button" onClick={() => runHeroHtmlCommand("bold")} className={heroToolbarIconButtonClass(heroToolbarState.bold)} title="Negrita" aria-label="Negrita">
                                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden="true"><path d="M6 4.5h5a3 3 0 0 1 0 6H6V4.5Zm0 6h5.4a3 3 0 1 1 0 6H6v-6Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /></svg>
                              </button>
                              <button type="button" onClick={() => runHeroHtmlCommand("italic")} className={heroToolbarIconButtonClass(heroToolbarState.italic)} title="Cursiva" aria-label="Cursiva">
                                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden="true"><path d="M12.5 4.5h-5m5 11h-5m4-11-3 11" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
                              </button>
                              <button type="button" onClick={() => runHeroHtmlCommand("underline")} className={heroToolbarIconButtonClass(heroToolbarState.underline)} title="Subrayado" aria-label="Subrayado">
                                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden="true"><path d="M6 4.5v4.2a4 4 0 1 0 8 0V4.5M4.5 15.5h11" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
                              </button>
                              <button type="button" onClick={() => runHeroHtmlCommand("justifyLeft")} className={heroToolbarIconButtonClass(heroToolbarState.align === "left")} title="Alinear izquierda" aria-label="Alinear izquierda">
                                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden="true"><path d="M4.5 5h11M4.5 8.5h8M4.5 12h11M4.5 15.5h8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
                              </button>
                              <button type="button" onClick={() => runHeroHtmlCommand("justifyCenter")} className={heroToolbarIconButtonClass(heroToolbarState.align === "center")} title="Centrar" aria-label="Centrar">
                                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden="true"><path d="M4.5 5h11M6 8.5h8M4.5 12h11M6 15.5h8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
                              </button>
                              <button type="button" onClick={() => runHeroHtmlCommand("justifyRight")} className={heroToolbarIconButtonClass(heroToolbarState.align === "right")} title="Alinear derecha" aria-label="Alinear derecha">
                                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden="true"><path d="M4.5 5h11M7.5 8.5h8M4.5 12h11M7.5 15.5h8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
                              </button>
                              <button type="button" onClick={() => runHeroHtmlCommand("insertUnorderedList")} className={heroToolbarIconButtonClass(heroToolbarState.unorderedList)} title="Lista con puntos" aria-label="Lista con puntos">
                                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden="true"><circle cx="5" cy="6" r="1.1" fill="currentColor" /><circle cx="5" cy="10" r="1.1" fill="currentColor" /><circle cx="5" cy="14" r="1.1" fill="currentColor" /><path d="M8 6h7M8 10h7M8 14h7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
                              </button>
                              <button type="button" onClick={() => runHeroHtmlCommand("insertOrderedList")} className={heroToolbarIconButtonClass(heroToolbarState.orderedList)} title="Lista numerada" aria-label="Lista numerada">
                                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden="true"><path d="M3.5 5h2v2h-2m0 3h2v2h-2m0 3h2v2h-2M8 6h8M8 10h8M8 14h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
                              </button>
                              <label className="inline-flex h-8 items-center justify-center rounded border border-slate-300 bg-white px-2 text-slate-700 hover:bg-slate-100" title="Color del texto">
                                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden="true"><path d="M6 14h8m-6.8-1.5 2.8-8h.1l2.8 8M8.7 8.5h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
                                <input type="color" value={heroToolbarState.foreColor} onChange={(event) => runHeroHtmlCommand("foreColor", event.target.value)} className="ml-1 h-5 w-5 cursor-pointer border-0 bg-transparent p-0" aria-label="Color del texto" />
                              </label>
                              <label className="inline-flex h-8 items-center justify-center rounded border border-slate-300 bg-white px-2 text-slate-700 hover:bg-slate-100" title="Color de fondo">
                                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden="true"><path d="M4.5 13.5h11M8.2 12.5l2.8-8h.1l2.8 8M9.7 8.5h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
                                <input type="color" value={heroToolbarState.hiliteColor} onChange={(event) => runHeroHtmlCommand("hiliteColor", event.target.value)} className="ml-1 h-5 w-5 cursor-pointer border-0 bg-transparent p-0" aria-label="Color de fondo" />
                              </label>
                              <button
                                type="button"
                                onClick={() => {
                                  const url = typeof window !== "undefined"
                                    ? window.prompt("URL del enlace (https://...)")
                                    : null;
                                  if (url?.trim()) runHeroHtmlCommand("createLink", url.trim());
                                }}
                                className={heroToolbarIconButtonClass(false)}
                                title="Insertar enlace"
                                aria-label="Insertar enlace"
                              >
                                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden="true"><path d="M8 12.5l4-4M6.5 14a3 3 0 0 1 0-4.2l1.3-1.3a3 3 0 0 1 4.2 0M13.5 6a3 3 0 0 1 0 4.2l-1.3 1.3a3 3 0 0 1-4.2 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
                              </button>
                              <button type="button" onClick={() => runHeroHtmlCommand("removeFormat")} className={heroToolbarIconButtonClass(false)} title="Limpiar formato" aria-label="Limpiar formato">
                                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden="true"><path d="M4.5 15.5h11M6.5 4.5h7l-1.5 5h-4zM4.5 4.5l11 11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                              </button>
                            </div>
                            <details className="relative">
                              <summary
                                className={`${heroToolbarIconButtonClass(false)} list-none cursor-pointer`}
                                title="Mas herramientas"
                                aria-label="Mas herramientas"
                              >
                                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden="true">
                                  <circle cx="5" cy="10" r="1.2" fill="currentColor" />
                                  <circle cx="10" cy="10" r="1.2" fill="currentColor" />
                                  <circle cx="15" cy="10" r="1.2" fill="currentColor" />
                                </svg>
                              </summary>
                              <div className="absolute right-0 z-20 mt-1 flex items-center gap-1.5 rounded-md border border-slate-200 bg-white p-1.5 shadow-lg">
                                <button type="button" onClick={() => runHeroHtmlCommand("unlink")} className={heroToolbarIconButtonClass(false)} title="Quitar enlace" aria-label="Quitar enlace">
                                  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden="true"><path d="M8 12.5l4-4M4.5 4.5l11 11M6.5 14a3 3 0 0 1 0-4.2l1.3-1.3M13.5 6a3 3 0 0 1 0 4.2l-1.3 1.3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
                                </button>
                                <button type="button" onClick={() => runHeroHtmlCommand("undo")} className={heroToolbarIconButtonClass(false)} title="Deshacer" aria-label="Deshacer">
                                  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden="true"><path d="M7 6H4v3M4.2 6.2A6 6 0 1 1 4 12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                </button>
                                <button type="button" onClick={() => runHeroHtmlCommand("redo")} className={heroToolbarIconButtonClass(false)} title="Rehacer" aria-label="Rehacer">
                                  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden="true"><path d="M13 6h3v3M15.8 6.2A6 6 0 1 0 16 12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                </button>
                              </div>
                            </details>
                          </div>
                          <div className="mb-2 rounded-md border border-slate-200 bg-slate-50 p-2">
                            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Encabezado</p>
                            <div
                              ref={heroKickerEditorRef}
                              contentEditable
                              suppressContentEditableWarning
                              onFocus={() => {
                                setActiveHeroRichEditor("kicker");
                                syncHeroToolbarState();
                                rememberHeroSelection();
                              }}
                              onKeyUp={() => {
                                rememberHeroSelection();
                                syncHeroToolbarState();
                              }}
                              onMouseUp={() => {
                                rememberHeroSelection();
                                syncHeroToolbarState();
                              }}
                              onInput={(event) => {
                                setHomeLayout("heroKicker", event.currentTarget.innerHTML);
                                rememberHeroSelection();
                                syncHeroToolbarState();
                              }}
                              className={`ui-focus w-full min-h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] ${
                                config.homeLayout.heroTheme === "indigo"
                                  ? "text-indigo-700"
                                  : config.homeLayout.heroTheme === "slate"
                                    ? "text-slate-700"
                                    : "text-amber-800"
                              }`}
                            />
                          </div>
                          <div className="mb-2 rounded-md border border-slate-200 bg-slate-50 p-2">
                            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Titulo</p>
                            <div
                              ref={heroTitleEditorRef}
                              contentEditable
                              suppressContentEditableWarning
                              onFocus={() => {
                                setActiveHeroRichEditor("title");
                                syncHeroToolbarState();
                                rememberHeroSelection();
                              }}
                              onKeyUp={() => {
                                rememberHeroSelection();
                                syncHeroToolbarState();
                              }}
                              onMouseUp={() => {
                                rememberHeroSelection();
                                syncHeroToolbarState();
                              }}
                              onInput={(event) => {
                                setHomeLayout("heroTitle", event.currentTarget.innerHTML);
                                rememberHeroSelection();
                                syncHeroToolbarState();
                              }}
                              className="ui-focus w-full min-h-12 rounded-md border border-slate-300 bg-white px-3 py-2 text-3xl font-black leading-tight text-slate-900 md:text-[2.7rem] [&_a]:text-amber-800 [&_a]:underline [&_b]:font-black [&_strong]:font-black [&_em]:italic [&_i]:italic [&_u]:underline"
                            />
                          </div>
                          <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
                            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Subtitulo</p>
                            <div
                              ref={heroSubtitleEditorRef}
                              contentEditable
                              suppressContentEditableWarning
                              onFocus={() => {
                                setActiveHeroRichEditor("subtitle");
                                syncHeroToolbarState();
                                rememberHeroSelection();
                              }}
                              onKeyUp={() => {
                                rememberHeroSelection();
                                syncHeroToolbarState();
                              }}
                              onMouseUp={() => {
                                rememberHeroSelection();
                                syncHeroToolbarState();
                              }}
                              onInput={(event) => {
                                setHomeLayout("heroDescription", event.currentTarget.innerHTML);
                                rememberHeroSelection();
                                syncHeroToolbarState();
                              }}
                              className="ui-focus w-full min-h-20 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm leading-relaxed text-slate-600 md:text-[15px] [&_a]:text-amber-800 [&_a]:underline [&_b]:font-bold [&_strong]:font-bold [&_em]:italic [&_i]:italic [&_u]:underline [&_li]:ml-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5 [&_p]:mb-2"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Orden de secciones (arrastrar y soltar)
                      </p>
                      <div className="space-y-2">
                        {resolvedHomeSectionOrder.map((sectionId) => {
                          const label = isBaseHomeSectionOrderId(sectionId)
                            ? SECTION_LABELS[sectionId]
                            : managedCategoryOrderLabelById.get(sectionId) ?? "Categoria personalizada";
                          const count = homeSectionCountById.get(sectionId) ?? 0;
                          const isDragging = draggedLayoutSectionId === sectionId;
                          return (
                            <button
                              key={`layout-sort-${sectionId}`}
                              type="button"
                              draggable
                              onDragStart={() => setDraggedLayoutSectionId(sectionId)}
                              onDragEnd={() => setDraggedLayoutSectionId(null)}
                              onDragOver={(event) => event.preventDefault()}
                              onDrop={(event) => {
                                event.preventDefault();
                                if (!draggedLayoutSectionId) return;
                                reorderHomeSectionOrder(draggedLayoutSectionId, sectionId);
                                setDraggedLayoutSectionId(null);
                              }}
                              className={`ui-focus flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition ${
                                isDragging
                                  ? "border-amber-400 bg-stone-200 text-cyan-900"
                                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                              }`}
                            >
                              <span className="inline-flex items-center gap-2">
                                <span aria-hidden="true" className="text-base leading-none text-slate-400">::</span>
                                <span className="font-semibold">{label}</span>
                              </span>
                              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold">
                                {count}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {adminTab === "analytics" ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Analytics
                      </p>
                      <p className="text-sm text-slate-600">
                        Analiza visitas, interacciones, ranking de vehiculos y efectividad comercial.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {([7, 30, 90] as const).map((days) => (
                        <button
                          key={`analytics-range-${days}`}
                          type="button"
                          onClick={() => setAnalyticsRangeDays(days)}
                          className={`ui-focus rounded-full px-3 py-1 text-xs font-semibold ${
                            analyticsRangeDays === days
                              ? "bg-amber-700 text-white"
                              : "border border-slate-300 bg-white text-slate-700"
                          }`}
                        >
                          {days} dias
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="mt-3 inline-flex rounded-full border border-slate-300 bg-white p-1">
                    <button
                      type="button"
                      onClick={() => setAnalyticsViewMode("simple")}
                      className={`ui-focus rounded-full px-3 py-1 text-xs font-semibold ${
                        analyticsViewMode === "simple" ? "bg-amber-700 text-white" : "text-slate-700"
                      }`}
                    >
                      Vista simple
                    </button>
                    <button
                      type="button"
                      onClick={() => setAnalyticsViewMode("advanced")}
                      className={`ui-focus rounded-full px-3 py-1 text-xs font-semibold ${
                        analyticsViewMode === "advanced" ? "bg-amber-700 text-white" : "text-slate-700"
                      }`}
                    >
                      Vista avanzada
                    </button>
                  </div>
                  {analyticsLoading ? (
                    <p className="mt-2 text-xs text-slate-500">Actualizando datos...</p>
                  ) : null}
                  <div className="relative mt-3 flex flex-wrap items-center gap-2">
                    <input
                      value={analyticsVehicleQuery}
                      onChange={(event) => setAnalyticsVehicleQuery(event.target.value)}
                      placeholder="Filtrar por patente o key"
                      className="ui-focus min-w-[16rem] flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAnalyticsScopeMenu((prev) => !prev)}
                      className="ui-focus inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-50"
                      aria-label="Abrir filtros de analytics"
                      title="Filtros"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        aria-hidden="true"
                      >
                        <path d="M3 5h18M6 12h12M10 19h4" strokeLinecap="round" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAnalyticsEventFilter("all");
                        setAnalyticsSectionFilter("all");
                        setAnalyticsVehicleQuery("");
                        setShowAnalyticsScopeMenu(false);
                      }}
                      className="ui-focus inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 bg-slate-50 text-slate-700 transition hover:bg-slate-100"
                      aria-label="Limpiar filtros de analytics"
                      title="Limpiar filtros"
                    >
                      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                        <path d="M10 3a7 7 0 1 1-6.2 10.25.75.75 0 1 1 1.32-.72A5.5 5.5 0 1 0 4.5 10H6a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 10.75V7.5a.75.75 0 0 1 1.5 0v1.3A7 7 0 0 1 10 3Z" />
                      </svg>
                    </button>
                    {showAnalyticsScopeMenu ? (
                      <div className="absolute right-0 top-full z-20 mt-2 w-full max-w-lg rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Filtros de analytics
                        </p>
                        <div className="grid gap-2 md:grid-cols-2">
                          <select
                            value={analyticsEventFilter}
                            onChange={(event) => setAnalyticsEventFilter(event.target.value)}
                            className="ui-focus rounded-md border border-slate-300 bg-white px-3 py-2 text-xs"
                          >
                            <option value="all">Todos los eventos</option>
                            {analyticsEventOptions.map((eventName) => (
                              <option key={`event-filter-${eventName}`} value={eventName}>
                                {eventName}
                              </option>
                            ))}
                          </select>
                          <select
                            value={analyticsSectionFilter}
                            onChange={(event) => setAnalyticsSectionFilter(event.target.value)}
                            className="ui-focus rounded-md border border-slate-300 bg-white px-3 py-2 text-xs"
                          >
                            <option value="all">Todas las secciones</option>
                            {analyticsSectionOptions.map((sectionName) => (
                              <option key={`section-filter-${sectionName}`} value={sectionName}>
                                {sectionName}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {[
                    ["Visitas", formatCompactNumber(analyticsOverview.visits)],
                    ["Visitantes unicos", formatCompactNumber(analyticsOverview.uniqueVisitors)],
                    ["Clicks WhatsApp", formatCompactNumber(analyticsOverview.whatsappClicks)],
                    ["Leads", formatCompactNumber(analyticsOverview.leads)],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg border border-slate-200 bg-white px-3 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                      <p className="mt-1 text-2xl font-black text-slate-900">{value}</p>
                    </div>
                  ))}
                </div>

                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <div className="grid gap-2 text-sm text-slate-700 md:grid-cols-2 xl:grid-cols-4">
                    <p><span className="font-semibold text-slate-900">WhatsApp / detalle:</span> {analyticsOverview.whatsappRate}%</p>
                    <p><span className="font-semibold text-slate-900">Lead / detalle:</span> {analyticsOverview.leadRate}%</p>
                    <p><span className="font-semibold text-slate-900">Eventos:</span> {formatCompactNumber(analyticsOverview.eventCount)}</p>
                    <p><span className="font-semibold text-slate-900">Eventos por visita:</span> {analyticsOverview.visits > 0 ? (analyticsOverview.eventCount / analyticsOverview.visits).toFixed(1) : "0.0"}</p>
                  </div>
                </div>

                <div className={`grid gap-4 ${analyticsViewMode === "advanced" ? "xl:grid-cols-3" : "xl:grid-cols-2"}`}>
                  <div className="rounded-xl border border-slate-200 bg-white p-3 xl:col-span-1">
                    <div className="mb-2 grid grid-cols-[1fr_112px] items-center gap-2 px-1">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Top vehiculos
                      </p>
                      <p className="text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Interacciones
                      </p>
                    </div>
                    {analyticsTopVehicles.length === 0 ? (
                      <p className="text-sm text-slate-500">Aun no hay datos de vehiculos para este rango.</p>
                    ) : (
                      <div className="space-y-2">
                        {analyticsTopVehicles.slice(0, analyticsViewMode === "simple" ? 5 : 10).map((row, index) => (
                          <div
                            key={`top-vehicle-${row.itemKey}`}
                            className="grid grid-cols-[1fr_112px] items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2"
                          >
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-slate-500">#{index + 1}  ·  {row.patent}</p>
                              <p className="line-clamp-1 text-sm font-semibold text-slate-900">{row.model}</p>
                            </div>
                            <span className="text-right text-base font-black text-slate-900">
                              {formatCompactNumber(row.total)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Actividad diaria
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Horizonte minimo de 7 dias siempre visible. Usa rueda del mouse para ajustar zoom temporal.
                        </p>
                      </div>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setShowAnalyticsChartMenu((prev) => !prev)}
                          className={`ui-focus inline-flex h-9 w-9 items-center justify-center rounded-md border transition ${
                            showAnalyticsChartMenu
                              ? "border-amber-400 bg-stone-100 text-amber-800"
                              : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                          }`}
                          aria-label="Opciones del grafico de actividad diaria"
                          title="Opciones del grafico"
                        >
                          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                            <path d="M4 7h9M4 17h5M14 17h6M17 7h3" strokeLinecap="round" />
                            <circle cx="15" cy="7" r="2.5" />
                            <circle cx="11" cy="17" r="2.5" />
                          </svg>
                        </button>
                        {showAnalyticsChartMenu ? (
                          <div className="absolute right-0 z-20 mt-2 w-[19rem] rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
                            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                              Opciones del grafico
                            </p>
                            <div className="space-y-2">
                              <select
                                value={analyticsChartType}
                                onChange={(event) =>
                                  setAnalyticsChartType(event.target.value as AnalyticsChartType)
                                }
                                className="ui-focus w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs"
                              >
                                <option value="bar">Grafico de barras</option>
                                <option value="line">Grafico de linea</option>
                                <option value="area">Grafico de area</option>
                              </select>
                              <select
                                value={analyticsTimelineMetric}
                                onChange={(event) =>
                                  setAnalyticsTimelineMetric(event.target.value as AnalyticsTimelineMetric)
                                }
                                className="ui-focus w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs"
                              >
                                <option value="eventos">Metrica: Eventos</option>
                                <option value="visitas">Metrica: Visitas</option>
                                <option value="detalle">Metrica: Detalle abierto</option>
                                <option value="whatsapp">Metrica: Clicks WhatsApp</option>
                                <option value="leads">Metrica: Leads</option>
                              </select>
                              <div className="grid grid-cols-2 gap-2">
                                <input
                                  type="date"
                                  value={analyticsDateFrom}
                                  onChange={(event) => setAnalyticsDateFrom(event.target.value)}
                                  className="ui-focus rounded-md border border-slate-300 bg-white px-3 py-2 text-xs"
                                  title="Fecha desde"
                                />
                                <input
                                  type="date"
                                  value={analyticsDateTo}
                                  onChange={(event) => setAnalyticsDateTo(event.target.value)}
                                  className="ui-focus rounded-md border border-slate-300 bg-white px-3 py-2 text-xs"
                                  title="Fecha hasta"
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setAnalyticsChartZoom((prev) => Math.max(1, Number((prev - 0.25).toFixed(2))))
                                  }
                                  className="ui-focus inline-flex h-8 w-8 items-center justify-center rounded border border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100"
                                  title="Alejar"
                                >
                                  -
                                </button>
                                <span className="min-w-16 text-center text-xs font-semibold text-slate-700">
                                  Zoom {Math.round(analyticsChartZoom * 100)}%
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setAnalyticsChartZoom((prev) => Math.min(6, Number((prev + 0.25).toFixed(2))))
                                  }
                                  className="ui-focus inline-flex h-8 w-8 items-center justify-center rounded border border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100"
                                  title="Acercar"
                                >
                                  +
                                </button>
                              </div>
                              <div className="flex items-center gap-2 pt-1">
                                <button
                                  type="button"
                                  onClick={() => downloadAnalyticsTimelineExcel(analyticsChartRows)}
                                  className="ui-focus inline-flex h-9 flex-1 items-center justify-center rounded-md border border-emerald-300 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
                                >
                                  Descargar Excel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setAnalyticsDateFrom("");
                                    setAnalyticsDateTo("");
                                    setAnalyticsTimelineMetric("eventos");
                                    setAnalyticsChartType("bar");
                                    setAnalyticsChartZoom(1);
                                  }}
                                  className="ui-focus inline-flex h-9 items-center justify-center rounded-md border border-slate-300 bg-slate-50 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                                >
                                  Limpiar
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                    {analyticsChartRows.length === 0 ? (
                      <p className="text-sm text-slate-500">Sin actividad en el rango seleccionado.</p>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-xs text-slate-500">
                          Mostrando <span className="font-semibold text-slate-700">{analyticsChartMetricLabel}</span> por dia
                          ({analyticsChartRows.length} registros).
                        </p>
                        <div
                          className="rounded-md border border-slate-200 bg-slate-50 p-2"
                          onWheel={handleAnalyticsChartWheel}
                          onDoubleClick={() => setAnalyticsChartZoom(1)}
                        >
                          <svg
                            viewBox="0 0 1000 260"
                            className="h-72 w-full"
                            aria-label={`${analyticsChartType === "line" ? "Linea" : analyticsChartType === "area" ? "Area" : "Barras"} de ${analyticsChartMetricLabel}`}
                          >
                            <line x1="40" y1="220" x2="960" y2="220" stroke="#cbd5e1" strokeWidth="1" />
                            {analyticsChartType === "bar"
                              ? analyticsChartPoints.map((row, index) => {
                                  const barWidth =
                                    analyticsChartPoints.length <= 1
                                      ? 50
                                      : Math.max(8, 260 / analyticsChartPoints.length);
                                  return (
                                    <g key={`analytics-bar-${row.date}`}>
                                      <rect
                                        x={row.x - barWidth / 2}
                                        y={row.y}
                                        width={barWidth}
                                        height={Math.max(3, 220 - row.y)}
                                        rx="2"
                                        fill="#0891b2"
                                      >
                                        <title>{`${formatAuctionDateLabel(row.date)}  ·  ${analyticsChartMetricLabel}: ${row.value}`}</title>
                                      </rect>
                                      {(analyticsChartPoints.length <= 16 ||
                                        index === analyticsChartPoints.length - 1 ||
                                        index % analyticsChartLabelStep === 0) && (
                                        <text
                                          x={row.x}
                                          y="238"
                                          textAnchor="middle"
                                          fontSize="11"
                                          fill="#475569"
                                        >
                                          {new Date(row.date).toLocaleDateString("es-CL", {
                                            day: "2-digit",
                                            month: "2-digit",
                                          })}
                                        </text>
                                      )}
                                    </g>
                                  );
                                })
                              : null}
                            {analyticsChartType !== "bar" && analyticsChartPoints.length > 0 ? (
                              <>
                                {analyticsChartType === "area" ? (
                                  <path
                                    d={`${analyticsChartPoints
                                      .map(
                                        (point, index) =>
                                          `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`,
                                      )
                                      .join(" ")} L ${analyticsChartPoints[analyticsChartPoints.length - 1]?.x ?? 960} 220 L ${analyticsChartPoints[0]?.x ?? 40} 220 Z`}
                                    fill="rgba(34,211,238,0.24)"
                                  />
                                ) : null}
                                <path
                                  d={analyticsChartPoints
                                    .map(
                                      (point, index) =>
                                        `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`,
                                    )
                                    .join(" ")}
                                  fill="none"
                                  stroke="#0891b2"
                                  strokeWidth="3"
                                  strokeLinejoin="round"
                                  strokeLinecap="round"
                                />
                                {analyticsChartPoints.map((point, index) => (
                                  <g key={`analytics-point-${point.date}`}>
                                    <circle cx={point.x} cy={point.y} r="4" fill="#0e7490">
                                      <title>{`${formatAuctionDateLabel(point.date)}  ·  ${analyticsChartMetricLabel}: ${point.value}`}</title>
                                    </circle>
                                    {(analyticsChartPoints.length <= 16 ||
                                      index === 0 ||
                                      index === analyticsChartPoints.length - 1 ||
                                      index % analyticsChartLabelStep === 0) && (
                                      <text
                                        x={point.x}
                                        y="238"
                                        textAnchor="middle"
                                        fontSize="11"
                                        fill="#475569"
                                      >
                                        {new Date(point.date).toLocaleDateString("es-CL", {
                                          day: "2-digit",
                                          month: "2-digit",
                                        })}
                                      </text>
                                    )}
                                  </g>
                                ))}
                              </>
                            ) : null}
                          </svg>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-600">
                          <span>
                            Zoom: <span className="font-semibold text-slate-800">{Math.round(analyticsChartZoom * 100)}%</span>
                          </span>
                          <span>
                            Horizonte: <span className="font-semibold text-slate-800">{analyticsChartRows.length} dia(s)</span>
                          </span>
                          <span className="text-slate-500">
                            Doble clic para resetear zoom
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {analyticsViewMode === "advanced" ? (
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Eventos mas frecuentes
                    </p>
                    {analyticsTopEvents.length === 0 ? (
                      <p className="text-sm text-slate-500">Sin eventos para este rango.</p>
                    ) : (
                      <div className="space-y-2">
                        {analyticsTopEvents.map((row) => (
                          <div key={`top-event-${row.eventName}`} className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5">
                            <span className="line-clamp-1 text-xs font-semibold text-slate-700">
                              {getAnalyticsEventLabel(row.eventName)}
                            </span>
                            <span className="text-xs font-bold text-slate-900">{row.total}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  ) : null}
                </div>

                {analyticsViewMode === "advanced" ? (
                  <div className="grid gap-4 xl:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Actividad por seccion
                      </p>
                      {analyticsTopSections.length === 0 ? (
                        <p className="text-sm text-slate-500">Sin datos por seccion.</p>
                      ) : (
                        <div className="space-y-2">
                          {analyticsTopSections.map((row) => (
                            <div key={`top-section-${row.section}`} className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                              <span className="text-sm font-semibold text-slate-700">
                                {getAnalyticsSectionLabel(row.section)}
                              </span>
                              <span className="rounded-full bg-slate-900 px-2 py-0.5 text-xs font-semibold text-white">
                                {row.total}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Linea completa de tiempo
                      </p>
                      {analyticsTimelineFiltered.length === 0 ? (
                        <p className="text-sm text-slate-500">Sin actividad en el rango seleccionado.</p>
                      ) : (
                        <div className="max-h-64 space-y-2 overflow-auto pr-1">
                          {analyticsTimelineFiltered.map((row) => (
                            <div key={`timeline-${row.date}`} className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                              <span className="text-sm font-semibold text-slate-700">{formatAuctionDateLabel(row.date)}</span>
                              <span className="text-sm font-bold text-slate-900">{row.total}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}

                <details className="rounded-xl border border-slate-200 bg-white p-3" open={analyticsViewMode === "advanced"}>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Ultimos eventos ({analyticsScopedEvents.length}) {analyticsViewMode === "simple" ? " ·  expandible" : ""}
                    </p>
                  </div>
                  {analyticsScopedEvents.length === 0 ? (
                    <p className="text-sm text-slate-500">Sin eventos con los filtros actuales.</p>
                  ) : (
                    <div className="max-h-64 space-y-1 overflow-auto pr-1">
                      {analyticsScopedEvents.slice(0, analyticsViewMode === "simple" ? 12 : 40).map((event, index) => (
                        <div key={`analytics-event-row-${index}`} className="grid grid-cols-[1.2fr_1fr_1fr_1fr] gap-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs">
                          <span className="line-clamp-1 font-semibold text-slate-800">
                            {getAnalyticsEventLabel(
                              typeof event.event === "string" ? event.event : "sin_evento",
                            )}
                          </span>
                          <span className="line-clamp-1 text-slate-600">
                            {getAnalyticsSectionLabel(
                              typeof event.section === "string" ? event.section : "sin-seccion",
                            )}
                          </span>
                          <span className="line-clamp-1 text-slate-600">{event.itemKey ?? "-"}</span>
                          <span className="line-clamp-1 text-slate-500">
                            {event.timestamp ? new Date(event.timestamp).toLocaleString("es-CL") : "sin fecha"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </details>
              </div>
            ) : null}

            {adminTab === "ofertas" ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Ofertas recibidas
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    Tabla dinamica con filtros por vehiculo, cliente y fecha. Puedes buscar en cualquier columna.
                  </p>
                  <div className="relative mt-3 flex flex-wrap items-center gap-2">
                    <input
                      value={offersSearch}
                      onChange={(event) => setOffersSearch(event.target.value)}
                      placeholder="Buscar en tabla..."
                      className="ui-focus min-w-[16rem] flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowOffersFiltersMenu((prev) => !prev)}
                      className="ui-focus inline-flex h-9 items-center justify-center gap-1 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                      aria-label="Abrir filtros de ofertas"
                      title="Filtros"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        aria-hidden="true"
                      >
                        <path d="M3 5h18M6 12h12M10 19h4" strokeLinecap="round" />
                      </svg>
                      <span>Filtros</span>
                      {offersFiltersActiveCount > 0 ? (
                        <span className="rounded-full bg-amber-700 px-1.5 py-0.5 text-[10px] text-white">
                          {offersFiltersActiveCount}
                        </span>
                      ) : null}
                    </button>
                    <div className="inline-flex h-9 items-center rounded-md border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700">
                      {formatCompactNumber(offersFilteredRows.length)} resultado(s)
                    </div>
                    {showOffersFiltersMenu ? (
                      <div className="absolute right-0 top-full z-20 mt-2 w-full max-w-3xl rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Filtros avanzados
                        </p>
                        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                          <select
                            value={offersSearchField}
                            onChange={(event) =>
                              setOffersSearchField(event.target.value as OfferFilterField)
                            }
                            className="ui-focus rounded-md border border-slate-300 bg-white px-3 py-2 text-xs"
                          >
                            <option value="all">Buscar en todas las columnas</option>
                            <option value="vehicleTitle">Vehiculo</option>
                            <option value="patent">Patente</option>
                            <option value="customerName">Cliente</option>
                            <option value="customerEmail">Mail</option>
                            <option value="customerPhone">Telefono</option>
                          </select>
                          <select
                            value={offersVehicleFilter}
                            onChange={(event) => setOffersVehicleFilter(event.target.value)}
                            className="ui-focus rounded-md border border-slate-300 bg-white px-3 py-2 text-xs"
                          >
                            <option value="all">Todos los vehiculos</option>
                            {offersVehicleOptions.map((vehicle) => (
                              <option key={`offer-vehicle-${vehicle}`} value={vehicle}>
                                {vehicle}
                              </option>
                            ))}
                          </select>
                          <select
                            value={offersClientFilter}
                            onChange={(event) => setOffersClientFilter(event.target.value)}
                            className="ui-focus rounded-md border border-slate-300 bg-white px-3 py-2 text-xs"
                          >
                            <option value="all">Todos los clientes</option>
                            {offersClientOptions.map((client) => (
                              <option key={`offer-client-${client}`} value={client}>
                                {client}
                              </option>
                            ))}
                          </select>
                          <input
                            type="date"
                            value={offersDateFrom}
                            onChange={(event) => setOffersDateFrom(event.target.value)}
                            className="ui-focus rounded-md border border-slate-300 bg-white px-3 py-2 text-xs"
                          />
                          <input
                            type="date"
                            value={offersDateTo}
                            onChange={(event) => setOffersDateTo(event.target.value)}
                            className="ui-focus rounded-md border border-slate-300 bg-white px-3 py-2 text-xs"
                          />
                        </div>
                        <div className="mt-3 flex flex-wrap justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setOffersSearch("");
                              setOffersSearchField("all");
                              setOffersVehicleFilter("all");
                              setOffersClientFilter("all");
                              setOffersDateFrom("");
                              setOffersDateTo("");
                            }}
                            className="ui-focus rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700"
                          >
                            Limpiar filtros
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowOffersFiltersMenu(false)}
                            className="ui-focus rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                          >
                            Cerrar
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="overflow-auto rounded-xl border border-slate-200 bg-white">
                  {offersLoading ? (
                    <p className="p-4 text-sm text-slate-500">Cargando ofertas...</p>
                  ) : offersError ? (
                    <p className="p-4 text-sm text-rose-700">{offersError}</p>
                  ) : offersFilteredRows.length === 0 ? (
                    <p className="p-4 text-sm text-slate-500">No hay ofertas para los filtros actuales.</p>
                  ) : (
                    <table className="min-w-[1280px] w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600">
                        <tr>
                          {[
                            "Fecha",
                            "Patente",
                            "Vehiculo",
                            "Cliente",
                            "Mail",
                            "Telefono",
                            "Oferta",
                            "Referencial",
                            "Diferencia",
                          ].map((label) => (
                            <th key={`offers-head-${label}`} className="whitespace-nowrap border-b border-slate-200 px-3 py-2 font-semibold">
                              {label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {offersFilteredRows.map((row) => {
                          const diff = row.offerAmount - row.referencePrice;
                          return (
                            <tr key={row.id} className="border-b border-slate-100 align-top">
                              <td className="whitespace-nowrap px-3 py-2 text-slate-700">
                                {row.createdAt ? new Date(row.createdAt).toLocaleString("es-CL") : "-"}
                              </td>
                              <td className="whitespace-nowrap px-3 py-2 font-semibold text-slate-800">{row.patent || "-"}</td>
                              <td className="min-w-64 px-3 py-2 text-slate-800">{row.vehicleTitle || "-"}</td>
                              <td className="whitespace-nowrap px-3 py-2 text-slate-700">{row.customerName || "-"}</td>
                              <td className="whitespace-nowrap px-3 py-2 text-slate-700">{row.customerEmail || "-"}</td>
                              <td className="whitespace-nowrap px-3 py-2 text-slate-700">{row.customerPhone || "-"}</td>
                              <td className="whitespace-nowrap px-3 py-2 font-semibold text-amber-800">
                                {formatCurrencyAmount(row.offerAmount)}
                              </td>
                              <td className="whitespace-nowrap px-3 py-2 text-slate-700">
                                {formatCurrencyAmount(row.referencePrice)}
                              </td>
                              <td
                                className={`whitespace-nowrap px-3 py-2 font-semibold ${
                                  diff >= 0 ? "text-emerald-700" : "text-rose-700"
                                }`}
                              >
                                {formatSignedCurrencyAmount(diff)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            ) : null}
        </section>
      ) : null}

      {showPublicHome ? (
        <>
      {config.homeLayout.showSearchBar ? (
      <section className="relative z-50 mx-auto w-full max-w-7xl px-3 pt-3 pb-2 sm:px-6 lg:px-8">
        <div ref={homeSearchShellRef} className="inventory-search-shell overflow-visible rounded-2xl p-3 md:p-4">
          <p className="mb-1 hidden text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-100 md:block">
            Busqueda de inventario
          </p>
          <div className="flex items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <svg
                viewBox="0 0 20 20"
                fill="none"
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-200"
              >
                <path d="M13.5 13.5L17 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                <circle cx="8.75" cy="8.75" r="5.75" stroke="currentColor" strokeWidth="1.8" />
              </svg>
              <input
                value={homeSearchTerm}
                onChange={(event) => {
                  setHomeSearchTerm(event.target.value);
                  trackEvent("home_search_change", { query: event.target.value });
                }}
                placeholder="Buscar patente, marca, modelo..."
                className="ui-focus w-full rounded-xl border border-amber-300/70 bg-[#4a3020] py-3 pl-10 pr-20 text-base font-medium text-amber-50 shadow-sm placeholder:text-amber-200/80 md:pr-24 md:text-sm"
                aria-label="Buscar vehiculos por patente, marca, modelo o categoria"
                type="search"
                inputMode="search"
                enterKeyHint="search"
                autoComplete="off"
              />
              {homeSearchTerm ? (
                <button
                  type="button"
                  onClick={() => {
                    setHomeSearchTerm("");
                    trackEvent("home_search_clear");
                  }}
                  className="ui-focus touch-target absolute right-2 top-1/2 -translate-y-1/2 rounded-md border border-amber-300/70 bg-[#5a3a25] px-2 py-1 text-[11px] font-semibold text-amber-50 hover:bg-[#6a452c] md:px-2.5 md:py-1.5 md:text-xs"
                >
                  Limpiar
                </button>
              ) : null}
            </div>
            {config.homeLayout.showQuickFilters || config.homeLayout.showSortSelector ? (
              <button
                type="button"
                onClick={() => {
                  setShowHomeFiltersPanel((prev) => !prev);
                }}
                className={`ui-focus shrink-0 flex h-11 w-11 items-center justify-center rounded-lg border transition ${
                  showHomeFiltersPanel || quickFilters.length > 0 || homeSort !== "recomendado"
                    ? "border-amber-200 bg-amber-700 text-amber-50"
                    : "border-amber-300/70 bg-[#5a3a25] text-amber-50 hover:bg-[#6a452c]"
                }`}
                aria-label="Abrir filtros y orden"
                aria-expanded={showHomeFiltersPanel}
                title="Filtros y orden"
              >
                <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
                  <path d="M3 5h14M5 10h10M8 15h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            ) : null}
            <div className="hidden shrink-0 items-center gap-2 md:flex">
              <button
                type="button"
                onClick={() => {
                  void downloadVisibleCalendarPdf();
                }}
                disabled={isDownloadingCalendarPdf}
                className={`ui-focus flex h-11 w-11 items-center justify-center rounded-lg border transition ${
                  isDownloadingCalendarPdf
                    ? "cursor-wait border-amber-300/50 bg-[#5a3a25] text-amber-200/70"
                    : "border-amber-200 bg-amber-700 text-amber-50 hover:bg-amber-600"
                }`}
                title="Descargar PDF del catalogo visible"
                aria-label={isDownloadingCalendarPdf ? "Generando PDF del catalogo" : "Descargar PDF del catalogo"}
              >
                <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
                  <path d="M10 3.5v8m0 0l-3-3m3 3l3-3M4.5 13.5v2h11v-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
            <span className="sr-only" aria-live="polite">
              {homeVisibleItems.length} resultados encontrados en catalogo.
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              void downloadVisibleCalendarPdf();
            }}
            disabled={isDownloadingCalendarPdf}
            className={`ui-focus mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 text-xs font-semibold transition md:hidden ${
              isDownloadingCalendarPdf
                ? "cursor-wait border-amber-300/50 bg-[#5a3a25] text-amber-200/70"
                : "border-amber-200 bg-amber-700 text-amber-50 hover:bg-amber-600"
            }`}
            title="Descargar PDF profesional del calendario visible"
          >
            <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
              <path d="M10 3.5v8m0 0l-3-3m3 3l3-3M4.5 13.5v2h11v-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {isDownloadingCalendarPdf ? "Generando PDF..." : "PDF Catalogo"}
          </button>
          {showHomeFiltersPanel &&
          (config.homeLayout.showQuickFilters || config.homeLayout.showSortSelector) ? (
          <div className="mt-3 border-t border-amber-300/40 pt-3">
            {config.homeLayout.showSortSelector ? (
              <>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-200/80">
                  Ordenar por
                </p>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  {HOME_SORT_OPTIONS.map(([value, label]) => (
                    <button
                      key={`sort-${value}`}
                      type="button"
                      onClick={() => {
                        setHomeSort(value);
                        trackEvent("home_sort_change", { sort: value });
                      }}
                      className={`ui-focus min-h-10 shrink-0 rounded-full border px-3 py-2 text-xs font-semibold transition ${
                        homeSort === value
                          ? "border-amber-200 bg-amber-700 text-amber-50"
                          : "border-amber-300/70 bg-[#5a3a25] text-amber-100 hover:bg-[#6a452c]"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </>
            ) : null}
            {config.homeLayout.showQuickFilters ? (
              <>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-200/80">
                  Filtros rapidos
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {Object.entries(QUICK_FILTER_LABELS).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => toggleQuickFilter(id as QuickFilterId)}
                      className={`ui-focus min-h-10 shrink-0 rounded-full border px-3 py-2 text-xs font-semibold transition ${
                        quickFilters.includes(id as QuickFilterId)
                          ? "border-amber-200 bg-amber-700 text-amber-50"
                          : "border-amber-300/70 bg-[#5a3a25] text-amber-100 hover:bg-[#6a452c]"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </>
            ) : null}
          </div>
          ) : null}
          {config.homeLayout.showQuickFilters && quickFilters.length > 0 ? (
            <div className="mt-3 hidden items-center gap-2 overflow-x-auto border-t border-amber-300/40 pt-3 whitespace-nowrap md:flex">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-100">
                Filtros activos
              </p>
              {quickFilters.map((filterId) => (
                <button
                  key={`active-${filterId}`}
                  type="button"
                  onClick={() => toggleQuickFilter(filterId)}
                  className="ui-focus shrink-0 rounded-full border border-amber-200 bg-amber-700 px-3 py-1 text-xs font-semibold text-amber-50"
                >
                  {QUICK_FILTER_LABELS[filterId]} ×
                </button>
              ))}
              <button
                type="button"
                onClick={() => setQuickFilters([])}
                className="ui-focus rounded border border-amber-300/70 px-2 py-1 text-xs text-amber-100 hover:bg-[#5a3a25]"
              >
                Limpiar filtros
              </button>
            </div>
          ) : null}
        </div>
      </section>
      ) : null}
      <div
        className={`transition-all duration-500 ease-out ${
          hasActiveSearchOrQuickFilters || !heroVisible
            ? "pointer-events-none max-h-0 -translate-y-2 overflow-hidden opacity-0"
            : "max-h-[1200px] translate-y-0 opacity-100"
        }`}
      >
        <section className="relative z-10 mx-auto grid max-w-7xl gap-5 px-4 py-6 sm:px-6 md:py-7 lg:grid-cols-12 lg:px-8">
          <div
            className={`${config.homeLayout.showCommercialPanel ? "lg:col-span-8" : "lg:col-span-12"} premium-panel premium-panel-hero ${
              config.homeLayout.heroTheme === "indigo"
                ? "border-amber-300/70 bg-[#f6e9dc]"
                : config.homeLayout.heroTheme === "slate"
                  ? "border-amber-300/70 bg-[#f6e9dc]"
                  : "border-amber-300/60 bg-[#f7efe7]"
            } ${config.homeLayout.heroAlignment === "center" ? "text-center" : "text-left"}`}
          >
            <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${
              config.homeLayout.heroTheme === "indigo"
                ? "text-[#89502a]"
                : config.homeLayout.heroTheme === "slate"
                  ? "text-[#7d4a27]"
                  : "text-[#7d4a27]"
            }`}
              dangerouslySetInnerHTML={{
                __html: formatHomeHeroHtml(config.homeLayout.heroKicker) || "Automotora y compraventa",
              }}
            />
            <h1
              className="mt-2 text-3xl font-black leading-tight text-[#2f1d12] md:text-[2.7rem] [&_a]:text-[#8d542d] [&_a]:underline [&_b]:font-black [&_strong]:font-black [&_em]:italic [&_i]:italic [&_u]:underline"
              dangerouslySetInnerHTML={{
                __html: formatHomeHeroHtml(config.homeLayout.heroTitle) || "Sin titulo",
              }}
            />
            <div
              className={`mt-3 text-sm leading-relaxed text-[#644d3a] md:text-[15px] [&_a]:text-[#8d542d] [&_a]:underline [&_b]:font-bold [&_strong]:font-bold [&_em]:italic [&_i]:italic [&_u]:underline [&_li]:ml-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5 [&_p]:mb-2 ${
                config.homeLayout.heroAlignment === "center"
                  ? config.homeLayout.heroMaxWidth === "xl"
                    ? "mx-auto max-w-xl"
                    : config.homeLayout.heroMaxWidth === "full"
                      ? "mx-auto max-w-full"
                      : "mx-auto max-w-2xl"
                  : config.homeLayout.heroMaxWidth === "xl"
                    ? "max-w-xl"
                    : config.homeLayout.heroMaxWidth === "full"
                      ? "max-w-full"
                      : "max-w-2xl"
              }`}
              dangerouslySetInnerHTML={{
                __html: formatHomeHeroHtml(config.homeLayout.heroDescription),
              }}
            />
            {config.homeLayout.showHeroChips ? (
            <div className={`mt-4 flex flex-wrap gap-2 ${config.homeLayout.heroAlignment === "center" ? "justify-center" : ""}`}>
              <span className="rounded-full border border-amber-300/70 bg-[#f8ecdf] px-3 py-1 text-xs font-semibold text-[#6f4222]">Visor 3D</span>
              <span className="rounded-full border border-amber-300/70 bg-[#f8ecdf] px-3 py-1 text-xs font-semibold text-[#6f4222]">Seleccion curada</span>
              <span className="rounded-full border border-amber-300/70 bg-[#f8ecdf] px-3 py-1 text-xs font-semibold text-[#6f4222]">Trazabilidad tecnica</span>
            </div>
            ) : null}
            {config.homeLayout.showHeroCtas ? (
            <div className={`mt-4 flex flex-wrap gap-3 border-t border-amber-200/70 pt-4 ${config.homeLayout.heroAlignment === "center" ? "justify-center" : ""}`}>
              <a href={config.homeLayout.heroPrimaryCtaHref || "#catalogo"} className="premium-btn-primary ui-focus">
                {config.homeLayout.heroPrimaryCtaLabel || "Ver catalogo completo"}
              </a>
            </div>
            ) : null}
            <div className={`mt-4 inline-flex w-fit flex-wrap items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 ${config.homeLayout.heroAlignment === "center" ? "mx-auto justify-center" : ""}`}>
              <span>Atencion comercial activa</span>
              <span className="text-amber-800">-</span>
              <span>Respuesta directa por WhatsApp</span>
              <span className="text-amber-800">-</span>
              <span>{formatDateDash(new Date())}</span>
            </div>
          </div>
          {config.homeLayout.showCommercialPanel ? (
          <div className="premium-panel lg:col-span-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8b6546]">Informacion comercial</p>
            <div className="mt-4 space-y-3">
              <div className="info-tile">
                <p className="text-[11px] uppercase tracking-widest text-[#8b6546]">Canal principal</p>
                <p className="mt-1 text-sm font-semibold text-[#2f1d12]">WhatsApp {CONTACT_PHONE}</p>
              </div>
              <div className="info-tile">
                <p className="text-[11px] uppercase tracking-widest text-[#8b6546]">Correo comercial</p>
                <p className="mt-1 text-sm font-semibold text-[#2f1d12]">{CONTACT_EMAIL}</p>
              </div>
              <div className="info-tile">
                <p className="text-[11px] uppercase tracking-widest text-[#8b6546]">Soporte digital</p>
                <p className="mt-1 text-sm font-semibold text-[#2f1d12]">Catalogo online + visor GLO3D para evaluar cada unidad</p>
              </div>
              <div className="info-tile">
                <p className="text-[11px] uppercase tracking-widest text-[#8b6546]">Red social</p>
                <p className="mt-1 text-sm font-semibold text-[#2f1d12]">{INSTAGRAM_HANDLE}</p>
              </div>
            </div>
          </div>
          ) : null}
        </section>
      </div>

      <div className={`relative z-10 mx-auto flex max-w-7xl flex-col ${
        config.homeLayout.sectionSpacing === "compact"
          ? "gap-8"
          : config.homeLayout.sectionSpacing === "airy"
            ? "gap-20"
            : "gap-14"
      } px-4 pb-14 sm:px-6 lg:px-8`}>
        {config.homeLayout.showFavoritesSection && favoritesItems.length > 0 ? (
          <section className="section-shell">
            <header className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="premium-kicker">Guardados</p>
                <h2 className="text-2xl font-bold text-slate-900">Tus favoritos</h2>
              </div>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                {favoritesItems.length} guardados
              </span>
            </header>
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {favoritesItems.map((item) => (
                <CatalogCard
                  key={`favorite-${item.id}`}
                  item={item}
                  density={cardDensity}
                  priceLabel={formatPrice(config.vehiclePrices[getVehicleKey(item)])}
                  promoEnabled={config.vehicleDetails[getVehicleKey(item)]?.promoEnabled}
                  originalPriceLabel={config.vehicleDetails[getVehicleKey(item)]?.originalPrice}
                  upcomingAuctionLabel={upcomingAuctionByVehicleKey[getVehicleKey(item)]}
                  onOpen={() => openVehicleDetail(item)}
                  isFavorite={favoriteKeys.includes(getVehicleKey(item))}
                  onToggleFavorite={() => toggleFavorite(getVehicleKey(item))}
                  isCompared={compareKeys.includes(getVehicleKey(item))}
                  onToggleCompare={() => toggleCompare(getVehicleKey(item))}
                  onWhatsappClick={() =>
                    trackEvent("whatsapp_click_card", {
                      section: "favoritos",
                      itemKey: getVehicleKey(item),
                    })
                  }
                  canInlineEdit={canAdminEditNow}
                  editablePriceValue={config.vehiclePrices[getVehicleKey(item)]}
                  onInlineSave={(changes) => saveInlineCardChanges(item, changes)}
                />
              ))}
            </div>
          </section>
        ) : null}
        {config.homeLayout.showRecentPublications && latestItems.length > 0 ? (
          <section className="section-shell">
            <header className="mb-4">
              <p className="premium-kicker">Nuevas publicaciones</p>
              <h2 className="text-2xl font-bold text-slate-900">Recien publicados</h2>
            </header>
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {latestItems.map((item) => (
                <CatalogCard
                  key={`latest-${item.id}`}
                  item={item}
                  density={cardDensity}
                  priceLabel={formatPrice(config.vehiclePrices[getVehicleKey(item)])}
                  promoEnabled={config.vehicleDetails[getVehicleKey(item)]?.promoEnabled}
                  originalPriceLabel={config.vehicleDetails[getVehicleKey(item)]?.originalPrice}
                  upcomingAuctionLabel={upcomingAuctionByVehicleKey[getVehicleKey(item)]}
                  onOpen={() => openVehicleDetail(item)}
                  isFavorite={favoriteKeys.includes(getVehicleKey(item))}
                  onToggleFavorite={() => toggleFavorite(getVehicleKey(item))}
                  isCompared={compareKeys.includes(getVehicleKey(item))}
                  onToggleCompare={() => toggleCompare(getVehicleKey(item))}
                  onWhatsappClick={() =>
                    trackEvent("whatsapp_click_card", {
                      section: "recien-publicados",
                      itemKey: getVehicleKey(item),
                    })
                  }
                  canInlineEdit={canAdminEditNow}
                  editablePriceValue={config.vehiclePrices[getVehicleKey(item)]}
                  onInlineSave={(changes) => saveInlineCardChanges(item, changes)}
                />
              ))}
            </div>
          </section>
        ) : null}
        {resolvedHomeSectionOrder.map((sectionId) => {
          if (isBaseHomeSectionOrderId(sectionId) && hiddenHomeCategoryIds.has(sectionCategoryKey(sectionId))) {
            return null;
          }
          if (sectionId.startsWith("managed:")) {
            const managedCategoryId = sectionId.replace("managed:", "");
            const category = managedCategorySections.find((entry) => entry.id === managedCategoryId);
            if (!category) return null;
            return (
              <Section
                key={`managed-${category.id}`}
                id={`categoria-${category.id}`}
                title={category.name}
                subtitle={category.description}
                items={category.items}
                priceMap={config.vehiclePrices}
                upcomingAuctionByVehicleKey={upcomingAuctionByVehicleKey}
                favoriteKeys={favoriteKeys}
                onToggleFavorite={toggleFavorite}
                compareKeys={compareKeys}
                onToggleCompare={toggleCompare}
                onOpenVehicle={openVehicleDetail}
                cardDensity={cardDensity}
                canInlineEdit={canAdminEditNow}
                onInlineSaveItem={saveInlineCardChanges}
              />
            );
          }
          if (sectionId === "proximos-remates") {
            if (proximosRemates.length === 0) {
              return null;
            }
            return (
              <Section
                key="public-proximos-fallback"
                id="proximos-remates"
                title={config.sectionTexts["proximos-remates"].title}
                subtitle={config.sectionTexts["proximos-remates"].subtitle}
                items={proximosRemates}
                priceMap={config.vehiclePrices}
                upcomingAuctionByVehicleKey={upcomingAuctionByVehicleKey}
                favoriteKeys={favoriteKeys}
                onToggleFavorite={toggleFavorite}
                compareKeys={compareKeys}
                onToggleCompare={toggleCompare}
                onOpenVehicle={openVehicleDetail}
                cardDensity={cardDensity}
                canInlineEdit={canAdminEditNow}
                onInlineSaveItem={saveInlineCardChanges}
              />
            );
          }
          if (sectionId === "ventas-directas") {
            if (ventasDirectas.length === 0) return null;
            return (
              <Section
                key="public-ventas-directas"
                id="ventas-directas"
                title={config.sectionTexts["ventas-directas"].title}
                subtitle={config.sectionTexts["ventas-directas"].subtitle}
                items={ventasDirectas}
                priceMap={config.vehiclePrices}
                upcomingAuctionByVehicleKey={upcomingAuctionByVehicleKey}
                favoriteKeys={favoriteKeys}
                onToggleFavorite={toggleFavorite}
                compareKeys={compareKeys}
                onToggleCompare={toggleCompare}
                onOpenVehicle={openVehicleDetail}
                cardDensity={cardDensity}
                canInlineEdit={canAdminEditNow}
                onInlineSaveItem={saveInlineCardChanges}
              />
            );
          }
          if (sectionId === "novedades") {
            if (novedades.length === 0) return null;
            return (
              <Section
                key="public-novedades"
                id="novedades"
                title={config.sectionTexts.novedades.title}
                subtitle={config.sectionTexts.novedades.subtitle}
                items={novedades}
                priceMap={config.vehiclePrices}
                upcomingAuctionByVehicleKey={upcomingAuctionByVehicleKey}
                favoriteKeys={favoriteKeys}
                onToggleFavorite={toggleFavorite}
                compareKeys={compareKeys}
                onToggleCompare={toggleCompare}
                onOpenVehicle={openVehicleDetail}
                cardDensity={cardDensity}
                canInlineEdit={canAdminEditNow}
                onInlineSaveItem={saveInlineCardChanges}
              />
            );
          }
          if (filteredCatalogItems.length === 0) return null;
          return (
            <section
              key="public-catalogo"
              id="catalogo"
              className={`section-shell scroll-mt-24 ${catalogSectionMinimized ? "py-4 sm:py-4" : ""}`}
            >
              <MinimizableSectionHeader
                kicker="Explora y decide"
                title={config.sectionTexts.catalogo.title}
                subtitle={`${config.sectionTexts.catalogo.subtitle} Usa filtros y comparacion para decidir mas rapido.`}
                count={filteredCatalogItems.length}
                isMinimized={catalogSectionMinimized}
                onToggleMinimize={() => setCatalogSectionMinimized((prev) => !prev)}
                titleClassName="text-2xl font-bold text-slate-900"
                subtitleClassName="mt-1 text-sm text-slate-600"
              />
              {!catalogSectionMinimized && !hasHomePreFilter ? (
                <div className="mb-4 flex flex-wrap gap-2">
                  {(["livianos", "pesados", "maquinaria", "otros"] as VehicleTypeId[]).map((type) => (
                    <button
                      key={type}
                      onClick={() => setActiveTypeTab(type)}
                      className={`ui-focus rounded-full px-3 py-1 text-xs font-semibold transition ${
                        activeTypeTab === type
                          ? "bg-amber-700 text-white shadow-sm"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      {type === "livianos"
                        ? "Vehiculos livianos"
                        : type === "pesados"
                          ? "Vehiculos pesados"
                          : type === "maquinaria"
                            ? "Maquinaria"
                            : "Otros"}
                    </button>
                  ))}
                </div>
              ) : null}
              {catalogSectionMinimized ? null : filteredCatalogItems.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                  No encontramos vehiculos para esta combinacion.
                  {" "}
                  Prueba con Livianos, quita filtros activos o busca por patente exacta (ej: SYGD93).
                </div>
              ) : (
                <HorizontalCardsRail
                  sectionKey="catalogo"
                  items={filteredCatalogItems}
                  priceMap={config.vehiclePrices}
                  upcomingAuctionByVehicleKey={upcomingAuctionByVehicleKey}
                  favoriteKeys={favoriteKeys}
                  onToggleFavorite={toggleFavorite}
                  compareKeys={compareKeys}
                  onToggleCompare={toggleCompare}
                  onOpenVehicle={openVehicleDetail}
                  cardDensity={cardDensity}
                />
              )}
            </section>
          );
        })}
      </div>
      <section className="relative z-10 mx-auto mb-8 max-w-7xl px-4 sm:px-6 lg:px-8">
        <InstagramSection />
      </section>

      {selectedVehicle ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 p-0 backdrop-blur-sm md:items-center md:p-5"
          onClick={closeSelectedVehicle}
        >
          <button
            type="button"
            onClick={closeSelectedVehicle}
            className="ui-focus fixed right-4 top-[calc(env(safe-area-inset-top)+10px)] z-[70] inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/40 bg-slate-900/30 text-white backdrop-blur-sm transition hover:bg-slate-900/50 md:hidden"
            aria-label="Cerrar detalle"
            title="Cerrar"
          >
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M4.22 4.22a.75.75 0 0 1 1.06 0L10 8.94l4.72-4.72a.75.75 0 1 1 1.06 1.06L11.06 10l4.72 4.72a.75.75 0 0 1-1.06 1.06L10 11.06l-4.72 4.72a.75.75 0 0 1-1.06-1.06L8.94 10 4.22 5.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
            </svg>
          </button>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Detalle de ${selectedVehicle.title}`}
            className="vehicle-detail-shell max-h-[100dvh] w-full max-w-7xl overflow-x-hidden overflow-y-auto rounded-none px-3 py-3 pb-[calc(env(safe-area-inset-bottom)+72px)] md:max-h-[96vh] md:rounded-3xl md:p-6 md:pb-[calc(env(safe-area-inset-bottom)+14px)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="vehicle-detail-hero mb-3 rounded-xl p-3 md:mb-4 md:rounded-2xl md:p-4">
              <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-start md:justify-between">
                <div className="min-w-0 w-full flex-1">
                  <div className="flex w-full min-w-0 flex-wrap items-start gap-x-2 gap-y-1">
                    {inlineSummaryField === "hero:Titulo" ? (
                      <div className="flex w-full flex-wrap items-center gap-1">
                        <input
                          value={inlineSummaryValue}
                          onChange={(event) => setInlineSummaryValue(event.target.value)}
                          className="ui-focus w-full min-w-0 rounded border border-amber-300 bg-white px-2 py-1 text-sm font-semibold text-slate-900"
                        />
                        <button type="button" onClick={() => saveInlineSummaryFieldEdit("Titulo")} className="rounded border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">Guardar</button>
                        <button type="button" onClick={cancelInlineSummaryFieldEdit} className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-600">Cancelar</button>
                      </div>
                    ) : (
                      <>
                        <h3 className="vehicle-detail-title min-w-0 flex-1 basis-full text-base font-bold leading-snug text-slate-900 md:basis-auto md:text-xl">
                          {selectedVehicle.title}
                        </h3>
                        {canAdminEditNow ? (
                          <button
                            type="button"
                            onClick={() => beginInlineSummaryFieldEdit("Titulo", selectedVehicle.title)}
                            className="ui-focus inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-amber-300 bg-amber-50 text-amber-800"
                            title="Editar titulo"
                            aria-label="Editar titulo"
                          >
                            <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
                              <path d="M13.9 3.6a1.8 1.8 0 0 1 2.5 2.5l-8.6 8.6-3.3.8.8-3.3 8.6-8.6Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                              <path d="m12.4 5.1 2.5 2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>
                        ) : null}
                      </>
                    )}
                  </div>
                  <div className="mt-2 flex w-full min-w-0 flex-col items-stretch gap-1.5 md:flex-row md:flex-wrap md:items-center md:gap-2">
                    {inlineSummaryField === "hero:Subtitulo" ? (
                      <div className="flex w-full flex-wrap items-center gap-1">
                        <input
                          value={inlineSummaryValue}
                          onChange={(event) => setInlineSummaryValue(event.target.value)}
                          className="ui-focus w-full min-w-0 rounded border border-amber-300 bg-white px-2 py-1 text-xs font-semibold text-amber-900"
                        />
                        <button type="button" onClick={() => saveInlineSummaryFieldEdit("Subtitulo")} className="rounded border border-emerald-300 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">Guardar</button>
                        <button type="button" onClick={cancelInlineSummaryFieldEdit} className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600">Cancelar</button>
                      </div>
                    ) : (
                      <>
                        <span className="vehicle-detail-chip inline-block w-full max-w-full rounded-lg border border-stone-300 bg-stone-100 px-2.5 py-1.5 text-xs font-semibold text-amber-900 md:w-auto md:rounded-full md:px-3 md:py-1">
                          {selectedVehicle.subtitle?.trim() || getPatent(selectedVehicle)}
                        </span>
                        {canAdminEditNow ? (
                          <button
                            type="button"
                            onClick={() => beginInlineSummaryFieldEdit("Subtitulo", selectedVehicle.subtitle?.trim() || getPatent(selectedVehicle))}
                            className="ui-focus inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-amber-300 bg-amber-50 text-amber-800 md:ml-0"
                            title="Editar subtitulo"
                            aria-label="Editar subtitulo"
                          >
                            <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
                              <path d="M13.9 3.6a1.8 1.8 0 0 1 2.5 2.5l-8.6 8.6-3.3.8.8-3.3 8.6-8.6Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                              <path d="m12.4 5.1 2.5 2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>
                        ) : null}
                      </>
                    )}
                    {selectedVehicleConditionLabel ? (
                      <span
                        className={`vehicle-detail-chip inline-block w-full max-w-full rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold leading-snug md:w-auto md:rounded-full md:px-3 md:py-1 md:text-xs ${selectedVehicleConditionClasses}`}
                      >
                        {selectedVehicleConditionLabel}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="vehicle-detail-actions hidden max-w-full items-center gap-1.5 overflow-x-auto md:flex md:flex-wrap md:gap-2">
                  <button
                    type="button"
                    onClick={openOfferModal}
                    disabled={selectedVehicleReferencePriceAmount <= 0}
                    className="ui-focus inline-flex h-9 w-full shrink-0 items-center justify-center rounded-full border border-amber-300 bg-stone-100 px-2 text-xs font-semibold text-amber-800 transition hover:bg-stone-200 disabled:cursor-not-allowed disabled:opacity-60 md:w-auto md:px-3"
                    aria-label="Enviar mi precio"
                    title={
                      selectedVehicleReferencePriceAmount > 0
                        ? "Enviar mi precio"
                        : "No hay precio referencial disponible"
                    }
                  >
                    <span className="md:hidden">Ofertar</span>
                    <span className="hidden md:inline">Enviar mi precio</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleCompare(selectedVehicleKey)}
                    className={`ui-focus inline-flex h-9 w-9 items-center justify-center rounded-full border text-base font-semibold transition ${
                      compareKeys.includes(selectedVehicleKey)
                        ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                    aria-label={compareKeys.includes(selectedVehicleKey) ? "Quitar de comparar" : "Comparar"}
                    title={compareKeys.includes(selectedVehicleKey) ? "Quitar de comparar" : "Comparar"}
                  >
                    <span aria-hidden="true">+</span>
                  </button>
                  <a
                    href={selectedVehicleWhatsappUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => trackEvent("whatsapp_click_modal", { itemKey: selectedVehicleKey })}
                    className="ui-focus hidden h-9 w-9 items-center justify-center rounded-full bg-[#25D366] text-white transition hover:brightness-95 md:inline-flex"
                    aria-label={selectedVehiclePrimaryCtaLabel}
                    title={selectedVehiclePrimaryCtaLabel}
                  >
                    <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="currentColor" aria-hidden="true">
                      <path d="M12.04 2C6.58 2 2.16 6.42 2.16 11.88c0 1.75.46 3.46 1.33 4.96L2 22l5.3-1.38a9.83 9.83 0 0 0 4.74 1.21h.01c5.45 0 9.87-4.42 9.87-9.88A9.87 9.87 0 0 0 12.04 2Zm0 18.03h-.01a8.13 8.13 0 0 1-4.14-1.14l-.3-.18-3.15.82.84-3.07-.2-.31a8.13 8.13 0 0 1-1.25-4.3c0-4.51 3.69-8.2 8.22-8.2 4.53 0 8.21 3.68 8.21 8.2 0 4.53-3.69 8.2-8.22 8.2Zm4.49-6.19c-.25-.12-1.49-.73-1.72-.81-.23-.09-.4-.12-.57.12-.17.25-.65.81-.8.97-.15.17-.29.19-.54.06-.25-.12-1.04-.38-1.99-1.22-.74-.66-1.24-1.48-1.39-1.72-.15-.25-.02-.38.11-.51.11-.11.25-.29.37-.44.12-.15.16-.25.25-.42.08-.17.04-.31-.02-.44-.06-.12-.57-1.37-.78-1.88-.21-.49-.42-.42-.57-.43h-.48c-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.09 0 1.23.9 2.42 1.03 2.58.12.17 1.77 2.71 4.29 3.8.6.26 1.07.42 1.43.54.6.19 1.15.16 1.59.1.49-.07 1.49-.61 1.7-1.2.21-.59.21-1.1.15-1.2-.06-.1-.23-.16-.48-.28Z" />
                    </svg>
                  </a>
                  <button
                    className="ui-focus hidden h-9 w-9 items-center justify-center rounded-full border border-slate-300 text-slate-600 transition hover:bg-slate-50 md:inline-flex"
                    onClick={closeSelectedVehicle}
                    aria-label="Volver a resultados"
                    title="Volver a resultados"
                  >
                    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden="true">
                      <path d="M11.75 4.5L6.25 10l5.5 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
            <div className="grid gap-3 md:gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-sm md:rounded-2xl">
                  {selectedVehicle.view3dUrl ? (
                    <iframe
                      src={selectedVehicle.view3dUrl}
                      title={`Visor 3D ${selectedVehicle.title}`}
                      className="h-52 min-h-[50vh] w-full border-0 md:h-[420px] md:min-h-0"
                      allow="fullscreen; autoplay"
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={selectedVehicleMainImage}
                      alt={selectedVehicle.title}
                      className="h-52 w-full object-cover md:h-[420px]"
                    />
                  )}
                </div>
                {selectedVehicle.view3dUrl ? null : selectedVehicleGalleryImages.length > 1 ? (
                  <div className="flex gap-2 overflow-x-auto rounded-xl border border-slate-200 bg-white p-2 md:flex">
                    {selectedVehicleGalleryImages.map((imageUrl, index) => (
                      <button
                        key={`${imageUrl}-${index}`}
                        type="button"
                        onClick={() => setSelectedVehicleImageIndex(index)}
                        className={`ui-focus h-16 w-20 shrink-0 overflow-hidden rounded-lg border transition ${
                          selectedVehicleImageIndex === index
                            ? "border-amber-600 ring-2 ring-stone-300"
                            : "border-slate-200 hover:border-amber-300"
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={imageUrl}
                          alt={`${selectedVehicle.title} vista ${index + 1}`}
                          className="h-full w-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="vehicle-detail-summary min-h-0 w-full min-w-0 overflow-x-hidden rounded-xl p-3 shadow-sm md:h-[420px] md:overflow-y-auto md:rounded-2xl md:p-4">
                <div className="mb-2 flex items-center justify-between gap-2 md:mb-3">
                  <h4 className="text-sm font-semibold text-slate-900 md:text-base">
                    <span className="md:hidden">Resumen</span>
                    <span className="hidden md:inline">Resumen del vehiculo</span>
                  </h4>
                  {canAdminEditNow && selectedVehicle ? (
                    <button
                      type="button"
                      onClick={() =>
                        openDetailsEditor(
                          selectedVehicle,
                          selectedVehicleTab === "tecnica" ? "tecnica" : "general",
                        )
                      }
                      className="ui-focus inline-flex h-8 w-8 items-center justify-center rounded-full border border-amber-300 bg-amber-50 text-amber-800 transition hover:bg-amber-100"
                      title="Editar ficha completa"
                      aria-label="Editar ficha completa"
                    >
                      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden="true">
                        <path d="M13.9 3.6a1.8 1.8 0 0 1 2.5 2.5l-8.6 8.6-3.3.8.8-3.3 8.6-8.6Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="m12.4 5.1 2.5 2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  ) : null}
                </div>
                <div className="vehicle-tab-rail-shell sticky top-0 z-10 -mx-1 mb-3 bg-gradient-to-b from-[#faf6f1] via-[#faf6f1]/95 to-transparent pb-1 pt-0.5 backdrop-blur-sm md:static md:mx-0 md:bg-transparent md:backdrop-blur-none">
                  <div className="vehicle-tab-rail" role="tablist" aria-label="Secciones del vehiculo">
                    {selectedVehicleTabs.map((tab) => (
                      <button
                        key={tab.id}
                        ref={(element) => {
                          vehicleTabRefs.current[tab.id] = element;
                        }}
                        type="button"
                        role="tab"
                        aria-selected={selectedVehicleTab === tab.id}
                        aria-label={tab.label}
                        onClick={() => setSelectedVehicleTab(tab.id)}
                        className={`vehicle-tab-pill vehicle-tab-rail-item ui-focus shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                          selectedVehicleTab === tab.id
                            ? "bg-amber-700 text-white"
                            : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        <span className="md:hidden">{tab.shortLabel}</span>
                        <span className="hidden md:inline">{tab.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                {selectedVehicleTab === "fotos" ? (
                  selectedVehicleGalleryImages.length === 0 ? (
                    <p className="rounded-md border border-dashed border-slate-300 bg-white p-3 text-sm text-slate-500">
                      Este vehiculo no tiene fotos disponibles.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => openSelectedVehicleLightboxAt(selectedVehicleImageIndex)}
                        className="ui-focus block w-full overflow-hidden rounded-lg border border-slate-200 bg-white"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={selectedVehicleMainImage}
                          alt={`Foto principal de ${selectedVehicle.title}`}
                          className="h-52 w-full object-cover"
                        />
                      </button>
                      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 sm:gap-2">
                        {selectedVehicleGalleryImages.map((imageUrl, index) => (
                          <button
                            key={`modal-photo-${imageUrl}-${index}`}
                            type="button"
                            onClick={() => {
                              setSelectedVehicleImageIndex(index);
                              openSelectedVehicleLightboxAt(index);
                            }}
                            className={`ui-focus overflow-hidden rounded-md border ${
                              selectedVehicleImageIndex === index
                                ? "border-amber-600 ring-2 ring-stone-300"
                                : "border-slate-200"
                            }`}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={imageUrl}
                              alt={`${selectedVehicle.title} foto ${index + 1}`}
                              className="h-20 w-full object-cover"
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                ) : selectedVehicleTab !== "descripcion" && selectedVehicleFieldsByTab[selectedVehicleTab].length === 0 ? (
                  <p className="rounded-md border border-dashed border-slate-300 bg-white p-3 text-sm text-slate-500">
                    Sin datos en esta seccion.
                  </p>
                ) : (
                  <dl className="vehicle-field-grid grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                    {selectedVehicleFieldsByTab[selectedVehicleTab].map(([label, value]) => (
                      <div
                        key={label}
                        className={`vehicle-field-card min-w-0 rounded-md bg-white p-2 ${
                          isFullWidthDetailField(label) ? "sm:col-span-2" : ""
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                            {getFieldDisplayLabel(label)}
                          </dt>
                          {canAdminEditNow && selectedVehicle ? (
                            <button
                              type="button"
                              onClick={() => beginInlineSummaryFieldEdit(label, value)}
                              className="ui-focus inline-flex h-6 w-6 items-center justify-center rounded-full border border-amber-300 bg-amber-50 text-amber-800 transition hover:bg-amber-100"
                              title={`Editar ${label.toLowerCase()}`}
                              aria-label={`Editar ${label.toLowerCase()}`}
                            >
                              <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
                                <path d="M13.9 3.6a1.8 1.8 0 0 1 2.5 2.5l-8.6 8.6-3.3.8.8-3.3 8.6-8.6Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                                <path d="m12.4 5.1 2.5 2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </button>
                          ) : null}
                        </div>
                        <dd
                          className={`break-words font-medium text-slate-800 [overflow-wrap:anywhere] ${
                            isMonoDetailField(label) ? "font-mono text-[13px] leading-snug" : ""
                          }`}
                        >
                          {inlineSummaryField === `${selectedVehicleTab}:${label}` ? (
                            <div className="space-y-1">
                              <input
                                value={inlineSummaryValue}
                                onChange={(event) => setInlineSummaryValue(event.target.value)}
                                className="ui-focus w-full rounded border border-amber-300 bg-white px-2 py-1 text-sm"
                              />
                              <div className="flex gap-1">
                                <button
                                  type="button"
                                  onClick={() => saveInlineSummaryFieldEdit(label)}
                                  className="rounded border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700"
                                >
                                  Guardar
                                </button>
                                <button
                                  type="button"
                                  onClick={cancelInlineSummaryFieldEdit}
                                  className="rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600"
                                >
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          ) : (
                            value
                          )}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
                {selectedVehicleTab === "general" ? (
                  <>
                    <div className="mt-2 rounded-md border border-stone-200 bg-stone-100/60 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-800 md:text-xs">
                          <span className="md:hidden">Precio ref.</span>
                          <span className="hidden md:inline">Precio referencial</span>
                        </p>
                        {canAdminEditNow && selectedVehicle ? (
                          <button
                            type="button"
                            onClick={startInlinePriceEdit}
                            className="ui-focus inline-flex h-6 w-6 items-center justify-center rounded-full border border-amber-300 bg-white text-amber-800 transition hover:bg-amber-50"
                            title="Editar precios y desglose"
                            aria-label="Editar precios y desglose"
                          >
                            <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
                              <path d="M13.9 3.6a1.8 1.8 0 0 1 2.5 2.5l-8.6 8.6-3.3.8.8-3.3 8.6-8.6Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                              <path d="m12.4 5.1 2.5 2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>
                        ) : null}
                      </div>
                      {inlinePriceEditing ? (
                        <div className="mt-2 space-y-2 rounded-md border border-amber-200 bg-white p-2">
                          <input
                            value={inlinePriceDraft.referencePrice}
                            onChange={(event) =>
                              setInlinePriceDraft((prev) => ({
                                ...prev,
                                referencePrice: event.target.value,
                              }))
                            }
                            className="ui-focus w-full rounded border border-slate-300 px-2 py-1 text-sm"
                            placeholder="Precio referencial"
                          />
                          <label className="inline-flex items-center gap-2 text-xs font-semibold text-amber-800">
                            <input
                              type="checkbox"
                              checked={inlinePriceDraft.promoEnabled}
                              onChange={(event) =>
                                setInlinePriceDraft((prev) => ({
                                  ...prev,
                                  promoEnabled: event.target.checked,
                                }))
                              }
                            />
                            Precio promocional activo
                          </label>
                          <input
                            value={inlinePriceDraft.originalPrice}
                            onChange={(event) =>
                              setInlinePriceDraft((prev) => ({
                                ...prev,
                                originalPrice: event.target.value,
                              }))
                            }
                            className="ui-focus w-full rounded border border-slate-300 px-2 py-1 text-sm"
                            placeholder="Precio original"
                          />
                          {inlinePriceDraft.promoEnabled ? (
                            <input
                              value={inlinePriceDraft.promoPrice}
                              onChange={(event) =>
                                setInlinePriceDraft((prev) => ({
                                  ...prev,
                                  promoPrice: event.target.value,
                                }))
                              }
                              className="ui-focus w-full rounded border border-rose-300 px-2 py-1 text-sm"
                              placeholder="Precio promocional"
                            />
                          ) : null}
                          <div className="grid gap-2 sm:grid-cols-2">
                            <input
                              value={inlinePriceDraft.taxFee}
                              onChange={(event) =>
                                setInlinePriceDraft((prev) => ({
                                  ...prev,
                                  taxFee: event.target.value,
                                }))
                              }
                              className="ui-focus w-full rounded border border-slate-300 px-2 py-1 text-sm"
                              placeholder="Impuestos"
                            />
                            <input
                              value={inlinePriceDraft.transferFee}
                              onChange={(event) =>
                                setInlinePriceDraft((prev) => ({
                                  ...prev,
                                  transferFee: event.target.value,
                                }))
                              }
                              className="ui-focus w-full rounded border border-slate-300 px-2 py-1 text-sm"
                              placeholder="Transferencia"
                            />
                          </div>
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={saveInlinePriceEdit}
                              className="rounded border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700"
                            >
                              Guardar precios
                            </button>
                            <button
                              type="button"
                              onClick={() => setInlinePriceEditing(false)}
                              className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-600"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : selectedVehiclePromoMeta.promoEnabled &&
                      selectedVehiclePromoMeta.originalPriceLabel &&
                      selectedVehiclePriceLabel ? (
                        <p className="mt-1 text-sm font-semibold text-slate-400 line-through">
                          {selectedVehiclePromoMeta.originalPriceLabel}
                        </p>
                      ) : null}
                      <p className={`mt-1 text-lg font-bold ${selectedVehiclePromoMeta.promoEnabled ? "text-rose-700" : "text-slate-900"}`}>
                        {selectedVehiclePriceLabel ?? "No informado"}
                      </p>
                      {!inlinePriceEditing && selectedVehiclePromoMeta.promoEnabled ? (
                        <p className="mt-1 inline-flex rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
                          Precio promocional
                        </p>
                      ) : null}
                      {!inlinePriceEditing && selectedVehicleHasFeeBreakdown ? (
                        <div className="mt-2 rounded-md border border-stone-200 bg-white px-2 py-2 text-xs text-slate-700">
                          <p className="font-semibold text-slate-800">Desglose referencial</p>
                          <div className="mt-1 space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <span>Valor base</span>
                              <span className="font-medium">
                                {selectedVehicleReferencePriceDisplay || selectedVehiclePriceLabel || "No informado"}
                              </span>
                            </div>
                            {selectedVehicleHasTaxFee ? (
                              <div className="flex items-center justify-between gap-2">
                                <span>Impuestos</span>
                                <span className="font-medium">{selectedVehicleTaxFeeDisplay}</span>
                              </div>
                            ) : null}
                            {selectedVehicleHasTransferFee ? (
                              <div className="flex items-center justify-between gap-2">
                                <span>Transferencia</span>
                                <span className="font-medium">{selectedVehicleTransferFeeDisplay}</span>
                              </div>
                            ) : null}
                            <div className="mt-1 flex items-center justify-between gap-2 border-t border-stone-200 pt-1 text-sm font-bold text-slate-900">
                              <span>Total</span>
                              <span>{selectedVehicleTotalWithFeesDisplay || "No informado"}</span>
                            </div>
                          </div>
                        </div>
                      ) : !inlinePriceEditing ? (
                        <p className="mt-1 text-xs text-slate-600">
                          Valor referencial.
                        </p>
                      ) : null}
                    </div>
                  </>
                ) : null}
                {selectedVehicleTab === "descripcion" ? (
                  <div className="mt-2 rounded-md border border-slate-200 bg-white p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Descripcion ampliada</p>
                      {canAdminEditNow && selectedVehicle ? (
                        <button
                          type="button"
                          onClick={() =>
                            beginInlineSummaryFieldEdit(
                              "Descripcion ampliada",
                              selectedVehicleExpandedDescription ?? "",
                            )
                          }
                          className="ui-focus inline-flex h-6 w-6 items-center justify-center rounded-full border border-amber-300 bg-amber-50 text-amber-800 transition hover:bg-amber-100"
                          title="Editar descripcion"
                          aria-label="Editar descripcion"
                        >
                          <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
                            <path d="M13.9 3.6a1.8 1.8 0 0 1 2.5 2.5l-8.6 8.6-3.3.8.8-3.3 8.6-8.6Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="m12.4 5.1 2.5 2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      ) : null}
                    </div>
                    {inlineSummaryField === "descripcion:Descripcion ampliada" ? (
                      <div className="mt-2 space-y-2">
                        <textarea
                          value={inlineSummaryValue}
                          onChange={(event) => setInlineSummaryValue(event.target.value)}
                          rows={6}
                          className="ui-focus w-full rounded border border-amber-300 bg-white px-2 py-2 text-sm text-slate-700"
                        />
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => saveInlineSummaryFieldEdit("Descripcion ampliada")}
                            className="rounded border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700"
                          >
                            Guardar descripcion
                          </button>
                          <button
                            type="button"
                            onClick={cancelInlineSummaryFieldEdit}
                            className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-600"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        className="mt-1 text-sm text-slate-700 [&_a]:text-amber-800 [&_a]:underline [&_b]:font-bold [&_strong]:font-bold [&_em]:italic [&_i]:italic [&_u]:underline [&_li]:ml-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5 [&_p]:mb-2"
                        dangerouslySetInnerHTML={{
                          __html: formatExtendedDescriptionHtml(selectedVehicleExpandedDescription),
                        }}
                      />
                    )}
                  </div>
                ) : null}
              </div>
            </div>
            {selectedVehicleLightboxImage ? (
              <div
                className="fixed inset-0 z-[85] flex items-center justify-center bg-slate-950/80 p-4"
                onClick={closeSelectedVehicleLightbox}
              >
                <div className="relative max-h-[92vh] w-full max-w-5xl">
                  <div className="absolute left-3 top-3 z-10 inline-flex items-center gap-1 rounded-full bg-black/45 px-2 py-1 text-xs font-semibold text-white backdrop-blur-sm">
                    <span>{(selectedVehicleLightboxIndex ?? 0) + 1}</span>
                    <span>/</span>
                    <span>{selectedVehicleGalleryImages.length}</span>
                  </div>
                  <div className="absolute right-3 top-3 z-10 inline-flex items-center gap-1 rounded-full bg-black/45 p-1 backdrop-blur-sm">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        zoomSelectedVehicleLightbox("out");
                      }}
                      className="ui-focus rounded-full bg-white/90 px-2 py-1 text-xs font-semibold text-slate-700"
                      title="Alejar"
                      aria-label="Alejar foto"
                    >
                      -
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        zoomSelectedVehicleLightbox("in");
                      }}
                      className="ui-focus rounded-full bg-white/90 px-2 py-1 text-xs font-semibold text-slate-700"
                      title="Acercar"
                      aria-label="Acercar foto"
                    >
                      +
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        zoomSelectedVehicleLightbox("reset");
                      }}
                      className="ui-focus rounded-full bg-white/90 px-2 py-1 text-xs font-semibold text-slate-700"
                      title="Zoom 100%"
                      aria-label="Restablecer zoom"
                    >
                      100%
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        closeSelectedVehicleLightbox();
                      }}
                      className="ui-focus rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-700"
                    >
                      Cerrar
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      moveSelectedVehicleLightbox("prev");
                    }}
                    className="ui-focus absolute left-2 top-1/2 z-10 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/40 bg-black/35 text-white backdrop-blur-sm hover:bg-black/50 md:h-11 md:w-11"
                    aria-label="Foto anterior"
                    title="Anterior"
                  >
                    <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M12.78 4.22a.75.75 0 0 1 0 1.06L8.06 10l4.72 4.72a.75.75 0 1 1-1.06 1.06l-5.25-5.25a.75.75 0 0 1 0-1.06l5.25-5.25a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      moveSelectedVehicleLightbox("next");
                    }}
                    className="ui-focus absolute right-2 top-1/2 z-10 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/40 bg-black/35 text-white backdrop-blur-sm hover:bg-black/50 md:h-11 md:w-11"
                    aria-label="Foto siguiente"
                    title="Siguiente"
                  >
                    <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M7.22 15.78a.75.75 0 0 1 0-1.06L11.94 10 7.22 5.28a.75.75 0 1 1 1.06-1.06l5.25 5.25a.75.75 0 0 1 0 1.06l-5.25 5.25a.75.75 0 0 1-1.06 0Z" clipRule="evenodd" />
                    </svg>
                  </button>
                  <div
                    className="flex max-h-[92vh] items-center justify-center overflow-auto rounded-xl"
                    onWheel={onSelectedVehicleLightboxWheel}
                    onClick={(event) => event.stopPropagation()}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={selectedVehicleLightboxImage}
                      alt={`Foto ampliada ${selectedVehicle.title}`}
                      className="max-h-[92vh] w-full rounded-xl object-contain transition-transform duration-200"
                      style={{ transform: `scale(${selectedVehicleLightboxZoom})` }}
                    />
                  </div>
                </div>
              </div>
            ) : null}
            <div className="mt-4">
              <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Vehiculos similares</h4>
              <div className="grid gap-3 md:grid-cols-3">
                {homeVisibleItems
                  .filter(
                    (item) =>
                      getVehicleKey(item) !== getVehicleKey(selectedVehicle) &&
                      inferVehicleType(item) === inferVehicleType(selectedVehicle),
                  )
                  .slice(0, 3)
                  .map((item) => {
                    const similarPriceLabel = formatPrice(config.vehiclePrices[getVehicleKey(item)]);
                    return (
                      <button
                        key={`similar-${item.id}`}
                        type="button"
                        onClick={() => openVehicleDetail(item)}
                        className="ui-focus rounded-lg border border-slate-200 bg-white p-2.5 text-left transition hover:border-amber-300 hover:bg-stone-100/30"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="line-clamp-1 text-sm font-semibold text-slate-900">{item.title}</p>
                            <div className="mt-0.5 flex items-center justify-between gap-2">
                              <p className="line-clamp-1 text-xs text-slate-600">
                                {item.subtitle ?? "Vehiculo relacionado"}
                              </p>
                              {similarPriceLabel ? (
                                <span className="shrink-0 text-[11px] font-semibold text-amber-800">
                                  {similarPriceLabel}
                                </span>
                              ) : null}
                            </div>
                          </div>
                          <div className="h-12 w-16 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-100">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={item.thumbnail ?? item.images[0] ?? "/placeholder-car.svg"}
                              alt={`Miniatura ${item.title}`}
                              className="h-full w-full object-cover"
                              loading="lazy"
                              onError={(event) => {
                                event.currentTarget.src = "/placeholder-car.svg";
                              }}
                            />
                          </div>
                        </div>
                      </button>
                    );
                  })}
              </div>
            </div>
          </div>
          <div className="vehicle-detail-mobile-bar vehicle-detail-mobile-bar-fixed flex items-center gap-2 rounded-xl border border-slate-200 bg-white/95 p-2 backdrop-blur-md md:hidden">
            <a
              href={selectedVehicleWhatsappUrl}
              target="_blank"
              rel="noreferrer"
              onClick={() => trackEvent("whatsapp_click_modal_mobile", { itemKey: selectedVehicleKey })}
              className="ui-focus inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#25D366] px-3 text-xs font-semibold text-white"
            >
              WhatsApp
            </a>
            <button
              type="button"
              onClick={openOfferModal}
              disabled={selectedVehicleReferencePriceAmount <= 0}
              className="ui-focus inline-flex min-h-11 items-center justify-center rounded-lg border border-amber-300 bg-amber-50 px-3 text-xs font-semibold text-amber-800 disabled:opacity-50"
            >
              Ofertar
            </button>
          </div>
        </div>
      ) : null}
        </>
      ) : null}

      {showPublicHome && compareItems.length > 0 ? (
        <div className="fixed bottom-[calc(1rem+var(--safe-bottom))] left-3 z-40 flex max-w-[calc(100vw-6.5rem)] items-center gap-1.5 rounded-full border border-indigo-200 bg-white px-2.5 py-2 shadow-lg md:bottom-4 md:left-4 md:max-w-none md:gap-2 md:px-3">
          <span className="truncate text-[11px] font-semibold text-indigo-700 md:text-xs">
            {compareItems.length}/{MAX_COMPARE_ITEMS}
          </span>
          <button
            type="button"
            onClick={() => {
              setShowComparePanel(true);
              trackEvent("compare_panel_open", { count: compareItems.length });
            }}
            className="ui-focus touch-target rounded-full bg-indigo-600 px-2.5 py-1.5 text-[11px] font-semibold text-white md:px-3 md:py-1 md:text-xs"
          >
            Comparar
          </button>
          <button
            type="button"
            onClick={() => {
              setCompareKeys([]);
              trackEvent("compare_clear");
            }}
            className="ui-focus touch-target rounded-full border border-slate-300 px-2.5 py-1.5 text-[11px] text-slate-600 md:px-3 md:py-1 md:text-xs"
          >
            X
          </button>
        </div>
      ) : null}

      {showComparePanel ? (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-900/70 p-0 md:items-center md:p-4" onClick={() => setShowComparePanel(false)}>
          <div role="dialog" aria-modal="true" aria-label="Comparador de vehiculos" className="max-h-[92dvh] w-full max-w-6xl overflow-auto rounded-t-2xl bg-white p-4 shadow-2xl md:rounded-2xl md:p-6" onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-lg font-bold text-slate-900">Comparador de vehiculos</h3>
              <button
                type="button"
                className="ui-focus rounded-md border border-slate-300 px-3 py-1 text-xs text-slate-600"
                onClick={() => setShowComparePanel(false)}
              >
                Cerrar
              </button>
            </div>
            {compareItems.length === 0 ? (
              <p className="text-sm text-slate-600">No hay vehiculos seleccionados para comparar.</p>
            ) : (
              <>
              <div className="space-y-3 md:hidden">
                {compareItems.map((item) => (
                  <article key={`cmp-mobile-${item.id}`} className="compare-mobile-card">
                    <h4 className="text-sm font-bold text-slate-900">{item.title}</h4>
                    <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                      <dt className="text-slate-500">Patente</dt>
                      <dd className="font-medium text-slate-800">{getPatent(item)}</dd>
                      <dt className="text-slate-500">Modelo</dt>
                      <dd className="font-medium text-slate-800">{getModel(item)}</dd>
                      <dt className="text-slate-500">Precio</dt>
                      <dd className="font-medium text-slate-800">{formatPrice(config.vehiclePrices[getVehicleKey(item)]) ?? "N/A"}</dd>
                      <dt className="text-slate-500">3D</dt>
                      <dd className="font-medium text-slate-800">{item.view3dUrl ? "Si" : "No"}</dd>
                    </dl>
                  </article>
                ))}
              </div>
              <div className="hidden overflow-auto rounded-xl border border-slate-200 md:block">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="px-3 py-2 text-xs font-semibold uppercase text-slate-500">Campo</th>
                      {compareItems.map((item) => (
                        <th key={`cmp-head-${item.id}`} className="px-3 py-2 text-xs font-semibold uppercase text-slate-700">
                          {item.title}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["Patente", (item: CatalogItem) => getPatent(item)],
                      ["Marca", (item: CatalogItem) => String((item.raw as Record<string, unknown>).marca ?? (item.raw as Record<string, unknown>).brand ?? "-")],
                      ["Modelo", (item: CatalogItem) => getModel(item)],
                      ["Ano", (item: CatalogItem) => String((item.raw as Record<string, unknown>).ano ?? (item.raw as Record<string, unknown>).anio ?? (item.raw as Record<string, unknown>).year ?? "-")],
                      ["Estado", (item: CatalogItem) => item.status ?? "Disponible"],
                      ["Ubicacion", (item: CatalogItem) => item.location ?? "-"],
                      ["Categoria", (item: CatalogItem) => upcomingAuctionByVehicleKey[getVehicleKey(item)] ?? "Sin asignar"],
                      ["Precio", (item: CatalogItem) => formatPrice(config.vehiclePrices[getVehicleKey(item)]) ?? "No informado"],
                      ["Tiene 3D", (item: CatalogItem) => (item.view3dUrl ? "Si" : "No")],
                    ].map(([label, resolver]) => (
                      <tr key={String(label)} className="border-t border-slate-200">
                        <td className="px-3 py-2 font-semibold text-slate-700">{String(label)}</td>
                        {compareItems.map((item) => (
                          <td key={`cmp-${label}-${item.id}`} className="px-3 py-2 text-slate-600">
                            {(resolver as (value: CatalogItem) => string)(item)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </>
            )}
          </div>
        </div>
      ) : null}

      {isAdmin && pendingRevertSale ? (
        <div
          className="fixed inset-0 z-[74] flex items-center justify-center bg-slate-900/70 p-4"
          onClick={() => setPendingRevertSale(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Revertir venta"
            className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Confirmacion</p>
            <h3 className="mt-1 text-lg font-bold text-slate-900">¿Revertir esta venta?</h3>
            <p className="mt-2 text-sm text-slate-600">
              La unidad <span className="font-semibold text-slate-900">{pendingRevertSale.patent}</span>{" "}
              ({pendingRevertSale.title}) volvera al inventario actual.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingRevertSale(null)}
                className="ui-focus rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  revertVehicleSale(pendingRevertSale.vehicleKey);
                  showSystemNotice(
                    "success",
                    "Venta revertida",
                    `${pendingRevertSale.patent} volvio al inventario actual.`,
                  );
                  setPendingRevertSale(null);
                }}
                className="ui-focus rounded-md bg-amber-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-amber-600"
              >
                Si, revertir
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isAdmin && finalizeAuctionId && finalizeAuction && AUCTION_ADMIN_ENABLED ? (
        <div
          className="fixed inset-0 z-[74] flex items-center justify-center bg-slate-900/70 p-4"
          onClick={() => setFinalizeAuctionId(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Finalizar remate"
            className="max-h-[92vh] w-full max-w-3xl overflow-auto rounded-2xl bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Finalizar remate</p>
                <h3 className="text-lg font-bold text-slate-900">{finalizeAuction.name}</h3>
                <p className="text-xs text-slate-500">
                  Remate programado para {formatAuctionDateLabel(finalizeAuction.date)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFinalizeAuctionId(null)}
                className="ui-focus rounded border border-slate-300 px-3 py-1 text-xs text-slate-600 transition hover:bg-slate-50"
              >
                Cerrar
              </button>
            </div>
            <div className="space-y-3">
              <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3">
                <p className="text-sm font-semibold text-slate-800">¿Que unidades fueron vendidas?</p>
                <p className="mt-1 text-xs text-slate-600">
                  Las unidades marcadas como vendidas pasan a historial y salen del catalogo/inventario visible.
                  Las no marcadas permanecen en inventario, pero quedan ocultas.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
                <input
                  value={finalizeAuctionSearchTerm}
                  onChange={(event) => setFinalizeAuctionSearchTerm(event.target.value)}
                  placeholder="Buscar por patente o modelo..."
                  className="ui-focus rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() =>
                    setFinalizeSoldVehicleKeys((prev) => {
                      const set = new Set(prev);
                      for (const item of finalizeAuctionItems) {
                        set.add(getVehicleKey(item));
                      }
                      return Array.from(set);
                    })
                  }
                  className="ui-focus rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
                >
                  Seleccionar todos
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setFinalizeSoldVehicleKeys((prev) =>
                      prev.filter(
                        (key) => !finalizeAuctionItems.some((item) => getVehicleKey(item) === key),
                      ),
                    )
                  }
                  className="ui-focus rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Limpiar marcados
                </button>
                <button
                  type="button"
                  onClick={() => setFinalizeSoldVehicleKeys([])}
                  className="ui-focus rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Omitir
                </button>
              </div>
              <div className="max-h-[48vh] space-y-2 overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-2">
                {finalizeAuctionItems.length === 0 ? (
                  <p className="px-2 py-3 text-sm text-slate-500">
                    No hay unidades para este remate con el filtro actual.
                  </p>
                ) : (
                  finalizeAuctionItems.map((item) => {
                    const vehicleKey = getVehicleKey(item);
                    const checked = finalizeSoldVehicleKeys.includes(vehicleKey);
                    return (
                      <label
                        key={`finalize-auction-${vehicleKey}`}
                        className={`flex items-center gap-3 rounded-md border px-3 py-2 text-sm ${
                          checked
                            ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                            : "border-slate-200 bg-white text-slate-700"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) =>
                            setFinalizeSoldVehicleKeys((prev) =>
                              event.target.checked
                                ? Array.from(new Set([...prev, vehicleKey]))
                                : prev.filter((key) => key !== vehicleKey),
                            )
                          }
                        />
                        <span className="min-w-20 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          {getPatent(item)}
                        </span>
                        <span className="line-clamp-1 flex-1">{getModel(item)}</span>
                        <span className="text-xs text-slate-500">
                          {formatPrice(config.vehiclePrices[vehicleKey]) ?? "Precio no definido"}
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
              <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    finalizeUpcomingAuction(finalizeAuctionId, finalizeSoldVehicleKeys);
                  }}
                  className="ui-focus rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
                >
                  Confirmar y finalizar remate
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {showBulkManualModal ? (
        <BulkManualPublicationsModal
          config={config}
          existingPatents={existingPatents}
          defaultSectionIds={bulkDefaultSectionIds}
          onClose={() => setShowBulkManualModal(false)}
          onApplyConfig={(nextConfig) => setConfig(nextConfig)}
          onNotice={showSystemNotice}
        />
      ) : null}

      {showManualCreateModal && publicationModalMode ? (
        <ManualPublicationModal
          mode={publicationModalMode}
          draft={manualDraft}
          setDraft={setManualDraft}
          uploadedImages={manualUploadedImages}
          setUploadedImages={setManualUploadedImages}
          uploading={manualUploading}
          autoredLookupLoading={autoredLookupLoading}
          onPatenteLookup={lookupAutoredPatent}
          onUploadFiles={uploadManualFiles}
          onClose={resetPublicationModal}
          onSubmit={saveVehiclePublication}
          initialTab={publicationInitialTab}
          vehicleSubtitle={
            editingPublicationItem
              ? `${getPatent(editingPublicationItem)} · ${getModel(editingPublicationItem)}`
              : undefined
          }
          onMarkSold={
            publicationModalMode === "edit" && editingPublicationKey
              ? () => {
                  markVehicleAsSold(editingPublicationKey);
                  resetPublicationModal();
                  showSystemNotice(
                    "success",
                    "Unidad vendida",
                    editingPublicationItem
                      ? `${getPatent(editingPublicationItem)} paso a historial y dejo de estar visible en inventario/catalogo.`
                      : "La unidad paso a historial.",
                  );
                }
              : undefined
          }
          onDeleteManual={
            publicationModalMode === "edit" &&
            editingPublicationItem &&
            isManualCatalogItem(editingPublicationItem)
              ? () => {
                  const manualId = String(
                    (editingPublicationItem.raw as Record<string, unknown>).manual_id ?? "",
                  );
                  if (manualId) deleteManualPublication(manualId);
                  resetPublicationModal();
                }
              : undefined
          }
          upcomingAuctions={sortedUpcomingAuctions}
          formatAuctionDateLabel={formatAuctionDateLabel}
          toggleSection={toggleManualDraftSection}
        />
      ) : null}

      {showOfferModal && selectedVehicle ? (
        <div
          className="fixed inset-0 z-[78] flex items-end justify-center bg-slate-900/70 p-0 md:items-center md:p-4"
          onClick={closeOfferModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Enviar mi precio"
            className="max-h-[92dvh] w-full max-w-lg overflow-auto rounded-t-2xl bg-white p-5 pb-[calc(1rem+var(--safe-bottom))] shadow-2xl md:rounded-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Enviar mi precio</p>
                <h3 className="text-lg font-bold text-slate-900">{getModel(selectedVehicle)}</h3>
                <p className="text-xs text-slate-500">Patente {getPatent(selectedVehicle)}</p>
              </div>
              <button
                type="button"
                onClick={closeOfferModal}
                className="ui-focus rounded border border-slate-300 px-3 py-1 text-xs text-slate-600 transition hover:bg-slate-50"
              >
                Cerrar
              </button>
            </div>

            <div className="rounded-lg border border-stone-200 bg-stone-100/70 p-3">
              <p className="text-xs uppercase tracking-wide text-amber-900">Precio referencial</p>
              <p className="mt-1 text-xl font-black text-slate-900">
                {selectedVehicleReferencePriceDisplay || selectedVehiclePriceLabel || "No informado"}
              </p>
              <p className="mt-1 text-xs text-slate-600">
                Este valor NO incluye gastos de transferencia ni impuestos.
              </p>
            </div>

            <div className="mt-4 space-y-2">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-600">Nombre *</span>
                <input
                  value={offerForm.customerName}
                  onChange={(event) =>
                    setOfferForm((prev) => ({ ...prev, customerName: event.target.value }))
                  }
                  placeholder="Tu nombre"
                  className="ui-focus w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-600">Mail *</span>
                <input
                  type="email"
                  value={offerForm.customerEmail}
                  onChange={(event) =>
                    setOfferForm((prev) => ({ ...prev, customerEmail: event.target.value }))
                  }
                  placeholder="correo@ejemplo.com"
                  className="ui-focus w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-600">Numero de telefono *</span>
                <input
                  value={offerForm.customerPhone}
                  onChange={(event) =>
                    setOfferForm((prev) => ({ ...prev, customerPhone: event.target.value }))
                  }
                  placeholder="+56 9 1234 5678"
                  className="ui-focus w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-600">Oferta *</span>
                <input
                  value={offerForm.offerAmount}
                  onChange={(event) =>
                    setOfferForm((prev) => ({
                      ...prev,
                      offerAmount: toCurrencyInput(event.target.value),
                    }))
                  }
                  placeholder="$0"
                  className="ui-focus w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold"
                />
              </label>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeOfferModal}
                className="ui-focus rounded border border-slate-300 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  void submitOffer();
                }}
                disabled={offerSending}
                className="ui-focus rounded-md bg-amber-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-600 disabled:opacity-60"
              >
                {offerSending ? "Enviando..." : "Enviar oferta"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isAdmin && batchAssignTarget ? (
        <div
          className="fixed inset-0 z-[72] flex items-center justify-center bg-slate-900/70 p-4"
          onClick={closeBatchAssignModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Agregar unidades desde inventario"
            className="max-h-[92vh] w-full max-w-4xl overflow-auto rounded-2xl bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                  Agregar desde inventario
                </p>
                <label className="mt-2 block text-xs font-semibold text-slate-600" htmlFor="batch-assign-target">
                  Categoria destino
                </label>
                <select
                  id="batch-assign-target"
                  value={batchAssignTargetSelectValue}
                  onChange={(event) => changeBatchAssignTarget(event.target.value)}
                  className="ui-focus mt-1 w-full max-w-md rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900"
                >
                  <option value="section:proximos-remates">Destacados</option>
                  <option value="section:ventas-directas">Ventas directas</option>
                  <option value="section:novedades">Novedades</option>
                  <option value="section:catalogo">Catalogo</option>
                  {AUCTION_ADMIN_ENABLED
                    ? sortedUpcomingAuctions.map((auction) => (
                        <option key={`batch-target-${auction.id}`} value={`auction:${auction.id}`}>
                          {auction.name} ({formatAuctionDateLabel(auction.date)})
                        </option>
                      ))
                    : null}
                </select>
                <p className="mt-2 text-xs text-slate-500">
                  Busca por patente, puedes ingresar varias separadas por espacio: LRBR11 SWBC56 THXX63
                </p>
              </div>
              <button
                type="button"
                onClick={closeBatchAssignModal}
                className="ui-focus rounded border border-slate-300 px-3 py-1 text-xs text-slate-600 transition hover:bg-slate-50"
              >
                Cerrar
              </button>
            </div>

            <input
              value={batchAssignSearchTerm}
              onChange={(event) => setBatchAssignSearchTerm(event.target.value)}
              placeholder="Buscar por patente, modelo o titulo..."
              className="ui-focus mb-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />

            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-slate-600">
                {batchAssignCandidates.length} resultados  ·  {batchAssignSelectedKeys.length} seleccionados
              </p>
              {batchAssignMissingPatents.length > 0 ? (
                <p className="text-xs font-medium text-amber-800">
                  No encontradas en inventario activo: {batchAssignMissingPatents.join(", ")}
                </p>
              ) : null}
              <button
                type="button"
                onClick={() =>
                  setBatchAssignSelectedKeys((prev) => {
                    const set = new Set(prev);
                    for (const item of batchAssignCandidates) set.add(getVehicleKey(item));
                    return Array.from(set);
                  })
                }
                className="ui-focus rounded border border-amber-300 bg-stone-100 px-2.5 py-1 text-xs font-semibold text-amber-800"
              >
                Seleccionar resultados
              </button>
            </div>

            <div className="space-y-2">
              {batchAssignCandidates.map((item) => {
                const key = getVehicleKey(item);
                const checked = batchAssignSelectedKeys.includes(key);
                const alreadyInTarget =
                  batchAssignTarget.type === "auction"
                    ? (config.vehicleUpcomingAuctionIds[key] ?? "") === batchAssignTarget.auctionId
                    : isVehicleAssignedInSectionList(
                        config.sectionVehicleIds[batchAssignTarget.sectionId] ?? [],
                        key,
                        itemsByKey,
                      );
                const hiddenFromHome = mergedHiddenVehicleIds.has(key);
                return (
                  <label
                    key={`assign-batch-${key}`}
                    className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm ${
                      checked ? "border-amber-300 bg-stone-100" : "border-slate-200 bg-white"
                    }`}
                  >
                    <div>
                      <p className="font-semibold text-slate-900">{getModel(item)}</p>
                      <p className="text-xs text-slate-500">
                        {getPatent(item)}
                        {alreadyInTarget ? " · ya agregado" : ""}
                        {hiddenFromHome ? " · oculta del home" : ""}
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleBatchAssignVehicle(key)}
                      className="ui-focus h-4 w-4"
                    />
                  </label>
                );
              })}
              {batchAssignCandidates.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-sm text-slate-500">
                  Sin resultados. Intenta con otra patente o modelo.
                </p>
              ) : null}
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeBatchAssignModal}
                className="ui-focus rounded border border-slate-300 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={addBatchVehiclesToTarget}
                className="ui-focus rounded-md bg-amber-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-600"
              >
                Agregar seleccionados
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isAdmin && activeManagedCategory ? (
        <div
          className="fixed inset-0 z-[72] flex items-center justify-center bg-slate-900/70 p-4"
          onClick={() => setAssignCategoryId(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Asignar vehiculos a categoria"
            className="max-h-[92vh] w-full max-w-4xl overflow-auto rounded-2xl bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                  Asignar vehiculos
                </p>
                <h3 className="text-lg font-bold text-slate-900">{activeManagedCategory.name}</h3>
                <p className="text-xs text-slate-500">{activeManagedCategory.vehicleIds.length} unidades seleccionadas</p>
              </div>
              <button
                type="button"
                onClick={() => setAssignCategoryId(null)}
                className="ui-focus rounded border border-slate-300 px-3 py-1 text-xs text-slate-600 transition hover:bg-slate-50"
              >
                Cerrar
              </button>
            </div>

            <input
              value={assignSearchTerm}
              onChange={(event) => setAssignSearchTerm(event.target.value)}
              placeholder="Buscar por patente, modelo o titulo..."
              className="ui-focus mb-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />

            <div className="space-y-2">
              {managedCategoryAssignCandidates.map((item) => {
                const key = getVehicleKey(item);
                const checked = activeManagedCategory.vehicleIds.includes(key);
                return (
                  <label
                    key={`assign-${activeManagedCategory.id}-${key}`}
                    className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm ${
                      checked ? "border-amber-300 bg-stone-100" : "border-slate-200 bg-white"
                    }`}
                  >
                    <div>
                      <p className="font-semibold text-slate-900">{getModel(item)}</p>
                      <p className="text-xs text-slate-500">{getPatent(item)}</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleVehicleInManagedCategory(activeManagedCategory.id, key)}
                      className="ui-focus h-4 w-4"
                    />
                  </label>
                );
              })}
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setAssignCategoryId(null)}
                className="ui-focus rounded-md bg-amber-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-600"
              >
                Listo
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showLogin ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div role="dialog" aria-modal="true" aria-label="Inicio de sesion administrador" className="w-full max-w-sm rounded-xl bg-white p-5 shadow-2xl">
            <h3 className="text-lg font-semibold text-slate-900">Login</h3>
            <p className="mt-1 text-sm text-slate-500">Solo administradores pueden editar categorias y vehiculos.</p>
            <div className="mt-4 space-y-2">
              <input value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm" placeholder="Correo" aria-label="Correo de administrador" />
              <input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm" placeholder="Contrasena" aria-label="Contrasena de administrador" />
            </div>
            {loginError ? <p className="mt-2 text-xs text-red-600">{loginError}</p> : null}
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setShowLogin(false)} className="ui-focus rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-50">Cancelar</button>
              <button onClick={login} className="ui-focus rounded-md bg-amber-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-amber-600">Entrar</button>
            </div>
          </div>
        </div>
      ) : null}

      {systemNotice ? (
        <div
          key={systemNotice.id}
          className="pointer-events-none fixed left-1/2 top-20 z-[80] w-[92%] max-w-md -translate-x-1/2"
          role="status"
          aria-live="polite"
        >
          <div
            className={`pointer-events-auto glass-soft rounded-xl border px-4 py-3 shadow-xl ${
              systemNotice.tone === "success"
                ? "border-emerald-200 bg-emerald-50/95"
                : systemNotice.tone === "error"
                  ? "border-rose-200 bg-rose-50/95"
                  : "border-stone-300 bg-stone-100/95"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">{systemNotice.title}</p>
                <p className="mt-1 text-xs text-slate-700">{systemNotice.message}</p>
              </div>
              <button
                type="button"
                onClick={() => setSystemNotice(null)}
                className="ui-focus rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-600"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      ) : null}

    </main>
  );
}


