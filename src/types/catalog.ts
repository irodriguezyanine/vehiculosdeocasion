export type CatalogSource = "tasaciones-api" | "supabase" | "empty";

export type CatalogItem = {
  id: string;
  title: string;
  subtitle?: string;
  lot?: string;
  status?: string;
  location?: string;
  auctionDate?: string;
  images: string[];
  thumbnail?: string;
  view3dUrl?: string;
  enBodega?: boolean;
  raw: Record<string, unknown>;
};

export type CatalogFeed = {
  source: CatalogSource;
  items: CatalogItem[];
  warning?: string;
};
