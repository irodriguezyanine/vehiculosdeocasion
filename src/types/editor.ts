export type SectionId = "proximos-remates" | "ventas-directas" | "novedades" | "catalogo";

export type VehicleTypeId = "livianos" | "pesados" | "maquinaria" | "otros";

export type UpcomingAuction = {
  id: string;
  name: string;
  date: string;
};

export type SectionTextConfig = {
  title: string;
  subtitle: string;
};

export type ManagedCategory = {
  id: string;
  name: string;
  description: string;
  vehicleIds: string[];
  visible: boolean;
};

export type HomeLayoutConfig = {
  heroKicker: string;
  heroTitle: string;
  heroDescription: string;
  heroPrimaryCtaLabel: string;
  heroPrimaryCtaHref: string;
  heroSecondaryCtaLabel: string;
  heroSecondaryCtaHref: string;
  heroAlignment: "left" | "center";
  heroTheme: "cyan" | "indigo" | "slate";
  heroMaxWidth: "xl" | "2xl" | "full";
  showHeroChips: boolean;
  showHeroCtas: boolean;
  showFeaturedStrip: boolean;
  showRecentPublications: boolean;
  showFavoritesSection: boolean;
  showHowToSection: boolean;
  showSearchBar: boolean;
  showQuickFilters: boolean;
  showSortSelector: boolean;
  showStickySearchBar: boolean;
  showCommercialPanel: boolean;
  defaultCardDensity: "compact" | "detailed";
  sectionSpacing: "compact" | "normal" | "airy";
  sectionOrder: SectionId[];
};

export type ManualPublication = {
  id: string;
  title: string;
  subtitle?: string;
  status?: string;
  location?: string;
  lot?: string;
  auctionDate?: string;
  description?: string;
  patente?: string;
  brand?: string;
  model?: string;
  year?: string;
  category?: string;
  images: string[];
  thumbnail?: string;
  view3dUrl?: string;
  sectionIds: SectionId[];
  upcomingAuctionId?: string;
  visible: boolean;
  price?: string;
};

export type EditorVehicleDetails = {
  title?: string;
  subtitle?: string;
  patente?: string;
  patenteVerifier?: string;
  vin?: string;
  nChasis?: string;
  nMotor?: string;
  nSerie?: string;
  nSiniestro?: string;
  version?: string;
  tipo?: string;
  tipoVehiculo?: string;
  vehicleCondition?: string;
  status?: string;
  location?: string;
  ubicacionFisica?: string;
  transportista?: string;
  taller?: string;
  lot?: string;
  auctionDate?: string;
  description?: string;
  extendedDescription?: string;
  brand?: string;
  model?: string;
  year?: string;
  category?: string;
  kilometraje?: string;
  color?: string;
  combustible?: string;
  transmision?: string;
  traccion?: string;
  aro?: string;
  cilindrada?: string;
  llaves?: string;
  aireAcondicionado?: string;
  unicoPropietario?: string;
  condicionado?: string;
  multas?: string;
  tag?: string;
  vencRevisionTecnica?: string;
  vencPermisoCirculacion?: string;
  vencSeguroObligatorio?: string;
  pruebaMotor?: string;
  pruebaDesplazamiento?: string;
  estadoAirbags?: string;
  nombrePropietarioAnterior?: string;
  rutPropietarioAnterior?: string;
  rutVerificador?: string;
  thumbnail?: string;
  view3dUrl?: string;
  imagesCsv?: string;
};

export type EditorConfig = {
  sectionVehicleIds: Record<SectionId, string[]>;
  hiddenVehicleIds: string[];
  vehiclePrices: Record<string, string>;
  vehicleDetails: Record<string, EditorVehicleDetails>;
  upcomingAuctions: UpcomingAuction[];
  vehicleUpcomingAuctionIds: Record<string, string>;
  sectionTexts: Record<SectionId, SectionTextConfig>;
  homeLayout: HomeLayoutConfig;
  manualPublications: ManualPublication[];
  managedCategories: ManagedCategory[];
};

export const DEFAULT_EDITOR_CONFIG: EditorConfig = {
  sectionVehicleIds: {
    "proximos-remates": [],
    "ventas-directas": [],
    novedades: [],
    catalogo: [],
  },
  hiddenVehicleIds: [],
  vehiclePrices: {},
  vehicleDetails: {},
  upcomingAuctions: [],
  vehicleUpcomingAuctionIds: {},
  sectionTexts: {
    "proximos-remates": {
      title: "Próximos remates",
      subtitle: "Vehículos en agenda con mayor prioridad comercial.",
    },
    "ventas-directas": {
      title: "Ventas Directas",
      subtitle: "Stock disponible para cierre rápido.",
    },
    novedades: {
      title: "Novedades",
      subtitle: "Últimas unidades ingresadas al ecosistema Vedisa.",
    },
    catalogo: {
      title: "Catálogo",
      subtitle: "Inventario por tipo de vehículo.",
    },
  },
  homeLayout: {
    heroKicker: "Catálogo oficial de VEDISA REMATES",
    heroTitle: "Inventario de vehiculos",
    heroDescription:
      "Plataforma oficial de ofertas online en vedisaremates.cl. Revisa cada unidad con información clara, fotos y trazabilidad comercial para tomar decisiones con confianza.",
    heroPrimaryCtaLabel: "Ver catálogo completo",
    heroPrimaryCtaHref: "#catalogo",
    heroSecondaryCtaLabel: "Explorar secciones",
    heroSecondaryCtaHref: "#proximos-remates",
    heroAlignment: "left",
    heroTheme: "cyan",
    heroMaxWidth: "2xl",
    showHeroChips: true,
    showHeroCtas: true,
    showFeaturedStrip: true,
    showRecentPublications: false,
    showFavoritesSection: true,
    showHowToSection: true,
    showSearchBar: true,
    showQuickFilters: true,
    showSortSelector: true,
    showStickySearchBar: true,
    showCommercialPanel: true,
    defaultCardDensity: "detailed",
    sectionSpacing: "normal",
    sectionOrder: ["proximos-remates", "ventas-directas", "novedades", "catalogo"],
  },
  manualPublications: [],
  managedCategories: [],
};
