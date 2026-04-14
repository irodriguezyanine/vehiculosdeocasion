export type SectionId = "proximos-remates" | "ventas-directas" | "novedades" | "catalogo";

export type VehicleTypeId = "livianos" | "pesados" | "maquinaria" | "otros";

export type EditorVehicleDetails = {
  title?: string;
  subtitle?: string;
  status?: string;
  location?: string;
  lot?: string;
  auctionDate?: string;
  description?: string;
  brand?: string;
  model?: string;
  year?: string;
  category?: string;
  thumbnail?: string;
  view3dUrl?: string;
  imagesCsv?: string;
};

export type EditorConfig = {
  sectionVehicleIds: Record<SectionId, string[]>;
  hiddenVehicleIds: string[];
  vehiclePrices: Record<string, string>;
  vehicleDetails: Record<string, EditorVehicleDetails>;
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
};
