import { createClient } from "@supabase/supabase-js";
import { DEFAULT_EDITOR_CONFIG, type EditorConfig } from "@/types/editor";

const EDITOR_TABLE = process.env.CATALOG_EDITOR_TABLE ?? "catalogo_editor_config";
const EDITOR_ROW_ID = "global";

function getServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) return null;
  return createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function normalizeConfig(config?: Partial<EditorConfig> | null): EditorConfig {
  const defaults = DEFAULT_EDITOR_CONFIG;
  const legacyHeroTitles = new Set([
    "Inventario de vehículos para remate y venta directa",
    "Inventario de vehiculos",
    "Inventario de vehículos",
  ]);
  const incomingHeroTitle = config?.homeLayout?.heroTitle?.trim();
  const normalizedHeroTitle =
    !incomingHeroTitle || legacyHeroTitles.has(incomingHeroTitle)
      ? defaults.homeLayout.heroTitle
      : config?.homeLayout?.heroTitle ?? defaults.homeLayout.heroTitle;
  const incomingDescription = config?.homeLayout?.heroDescription?.trim();
  const normalizedHeroDescription =
    !incomingDescription ||
    incomingDescription ===
      "Plataforma oficial de ofertas online en vedisaremates.cl. Revisa cada unidad con información clara, fotos y trazabilidad comercial para tomar decisiones con confianza."
      ? defaults.homeLayout.heroDescription
      : config?.homeLayout?.heroDescription ?? defaults.homeLayout.heroDescription;
  const incomingPrimaryCta = config?.homeLayout?.heroPrimaryCtaLabel?.trim();
  const normalizedPrimaryCta =
    !incomingPrimaryCta || incomingPrimaryCta === "Ver catálogo completo"
      ? defaults.homeLayout.heroPrimaryCtaLabel
      : config?.homeLayout?.heroPrimaryCtaLabel ?? defaults.homeLayout.heroPrimaryCtaLabel;
  const incomingSecondaryCta = config?.homeLayout?.heroSecondaryCtaLabel?.trim();
  const normalizedSecondaryCta =
    !incomingSecondaryCta || incomingSecondaryCta === "Explorar secciones"
      ? defaults.homeLayout.heroSecondaryCtaLabel
      : config?.homeLayout?.heroSecondaryCtaLabel ?? defaults.homeLayout.heroSecondaryCtaLabel;
  const incomingSecondaryHref = config?.homeLayout?.heroSecondaryCtaHref?.trim();
  const normalizedSecondaryHref =
    !incomingSecondaryHref || incomingSecondaryHref === "#proximos-remates"
      ? "#contacto"
      : config?.homeLayout?.heroSecondaryCtaHref ?? defaults.homeLayout.heroSecondaryCtaHref;
  return {
    sectionVehicleIds: {
      "proximos-remates":
        config?.sectionVehicleIds?.["proximos-remates"] ??
        defaults.sectionVehicleIds["proximos-remates"],
      "ventas-directas":
        config?.sectionVehicleIds?.["ventas-directas"] ??
        defaults.sectionVehicleIds["ventas-directas"],
      novedades: config?.sectionVehicleIds?.novedades ?? defaults.sectionVehicleIds.novedades,
      catalogo: config?.sectionVehicleIds?.catalogo ?? defaults.sectionVehicleIds.catalogo,
    },
    hiddenVehicleIds: config?.hiddenVehicleIds ?? defaults.hiddenVehicleIds,
    hiddenCategoryIds: config?.hiddenCategoryIds ?? defaults.hiddenCategoryIds,
    soldVehicleIds: config?.soldVehicleIds ?? defaults.soldVehicleIds,
    soldVehicleHistory: config?.soldVehicleHistory ?? defaults.soldVehicleHistory,
    vehiclePrices: config?.vehiclePrices ?? defaults.vehiclePrices,
    vehicleDetails: config?.vehicleDetails ?? defaults.vehicleDetails,
    upcomingAuctions: config?.upcomingAuctions ?? defaults.upcomingAuctions,
    vehicleUpcomingAuctionIds:
      config?.vehicleUpcomingAuctionIds ?? defaults.vehicleUpcomingAuctionIds,
    sectionTexts: {
      "proximos-remates":
        config?.sectionTexts?.["proximos-remates"] ?? defaults.sectionTexts["proximos-remates"],
      "ventas-directas":
        config?.sectionTexts?.["ventas-directas"] ?? defaults.sectionTexts["ventas-directas"],
      novedades: config?.sectionTexts?.novedades ?? defaults.sectionTexts.novedades,
      catalogo: config?.sectionTexts?.catalogo ?? defaults.sectionTexts.catalogo,
    },
    homeLayout: {
      heroKicker: config?.homeLayout?.heroKicker ?? defaults.homeLayout.heroKicker,
      heroTitle: normalizedHeroTitle,
      heroDescription: normalizedHeroDescription,
      heroPrimaryCtaLabel: normalizedPrimaryCta,
      heroPrimaryCtaHref:
        config?.homeLayout?.heroPrimaryCtaHref ?? defaults.homeLayout.heroPrimaryCtaHref,
      heroSecondaryCtaLabel: normalizedSecondaryCta,
      heroSecondaryCtaHref: normalizedSecondaryHref,
      heroAlignment: config?.homeLayout?.heroAlignment ?? defaults.homeLayout.heroAlignment,
      heroTheme: config?.homeLayout?.heroTheme ?? defaults.homeLayout.heroTheme,
      heroMaxWidth: config?.homeLayout?.heroMaxWidth ?? defaults.homeLayout.heroMaxWidth,
      showHeroChips: config?.homeLayout?.showHeroChips ?? defaults.homeLayout.showHeroChips,
      showHeroCtas: config?.homeLayout?.showHeroCtas ?? defaults.homeLayout.showHeroCtas,
      showFeaturedStrip:
        config?.homeLayout?.showFeaturedStrip ?? defaults.homeLayout.showFeaturedStrip,
      showRecentPublications:
        config?.homeLayout?.showRecentPublications ??
        defaults.homeLayout.showRecentPublications,
      showFavoritesSection:
        config?.homeLayout?.showFavoritesSection ?? defaults.homeLayout.showFavoritesSection,
      showHowToSection:
        (config?.homeLayout?.showHowToSection ?? defaults.homeLayout.showHowToSection) ||
        normalizedSecondaryHref === "#contacto",
      showSearchBar: config?.homeLayout?.showSearchBar ?? defaults.homeLayout.showSearchBar,
      showQuickFilters:
        config?.homeLayout?.showQuickFilters ?? defaults.homeLayout.showQuickFilters,
      showSortSelector:
        config?.homeLayout?.showSortSelector ?? defaults.homeLayout.showSortSelector,
      showStickySearchBar:
        config?.homeLayout?.showStickySearchBar ?? defaults.homeLayout.showStickySearchBar,
      showCommercialPanel:
        config?.homeLayout?.showCommercialPanel ?? defaults.homeLayout.showCommercialPanel,
      defaultCardDensity:
        config?.homeLayout?.defaultCardDensity ?? defaults.homeLayout.defaultCardDensity,
      sectionSpacing: config?.homeLayout?.sectionSpacing ?? defaults.homeLayout.sectionSpacing,
      sectionOrder: config?.homeLayout?.sectionOrder ?? defaults.homeLayout.sectionOrder,
    },
    manualPublications: config?.manualPublications ?? defaults.manualPublications,
    managedCategories: config?.managedCategories ?? defaults.managedCategories,
  };
}

export type EditorConfigLoadResult = {
  config: EditorConfig;
  persisted: boolean;
};

export async function getEditorConfig(): Promise<EditorConfigLoadResult> {
  const supabase = getServerSupabase();
  if (!supabase) return { config: DEFAULT_EDITOR_CONFIG, persisted: false };

  const { data, error } = await supabase
    .from(EDITOR_TABLE)
    .select("config")
    .eq("id", EDITOR_ROW_ID)
    .maybeSingle();

  if (error || !data) return { config: DEFAULT_EDITOR_CONFIG, persisted: false };
  return {
    config: normalizeConfig((data as { config?: Partial<EditorConfig> }).config ?? null),
    persisted: true,
  };
}

export async function saveEditorConfig(config: EditorConfig, updatedBy: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = getServerSupabase();
  if (!supabase) {
    return { ok: false, error: "Falta SUPABASE_SERVICE_ROLE_KEY o URL para guardar configuración." };
  }

  const normalizedConfig = normalizeConfig(config);
  const payloadWithAudit = {
    id: EDITOR_ROW_ID,
    config: normalizedConfig,
    updated_by: updatedBy,
    updated_at: new Date().toISOString(),
  };

  const fullSave = await supabase.from(EDITOR_TABLE).upsert(payloadWithAudit, { onConflict: "id" });
  if (!fullSave.error) return { ok: true };

  // Compatibilidad: algunas instalaciones antiguas tienen solo (id, config).
  const payloadMinimal = {
    id: EDITOR_ROW_ID,
    config: normalizedConfig,
  };
  const fallbackSave = await supabase.from(EDITOR_TABLE).upsert(payloadMinimal, { onConflict: "id" });
  if (!fallbackSave.error) return { ok: true };

  return {
    ok: false,
    error:
      `No se pudo guardar la configuración en la tabla '${EDITOR_TABLE}'. ` +
      "Verifica que exista la tabla y al menos las columnas: id (pk) y config (jsonb).",
  };
}
