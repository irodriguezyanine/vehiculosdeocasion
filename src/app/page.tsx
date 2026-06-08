import type { Metadata } from "next";
import { CatalogHomeClient } from "@/components/catalog-home-client";
import { SeoHomeExtras } from "@/components/seo-home-extras";
import { StructuredData } from "@/components/structured-data";
import { getCatalogFeed } from "@/lib/catalog";
import { getEditorConfig } from "@/lib/editor-config";
import { buildHomeJsonLd } from "@/lib/seo/json-ld";
import { buildSiteMetadata } from "@/lib/seo/metadata";

export const revalidate = 300;

export const metadata: Metadata = buildSiteMetadata({
  title: "Vehículos de Ocasión | Autos usados baratos, poco km y buen estado en Chile",
  description:
    "Compra autos usados y seminuevos en buen estado, con poco kilometraje y buenas marcas a precios competitivos en Chile. Catálogo VEDISA REMATES: fotos, visor 3D, precios visibles y WhatsApp. Automotora Santiago.",
});

export default async function Home() {
  const [feed, editorConfigResult] = await Promise.all([
    getCatalogFeed(),
    getEditorConfig(),
  ]);

  return (
    <>
      <StructuredData data={buildHomeJsonLd(feed.items)} />
      <CatalogHomeClient feed={feed} initialConfig={editorConfigResult.config} />
      <SeoHomeExtras />
    </>
  );
}
