import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StructuredData } from "@/components/structured-data";
import { getCatalogFeed, resolveCatalogItemThumbnail } from "@/lib/catalog";
import {
  buildPriceLabelMap,
  getVehicleKey,
  getVisibleCatalogItems,
} from "@/lib/catalog-visibility";
import { getEditorConfig } from "@/lib/editor-config";
import { buildPageMetadata } from "@/lib/seo/metadata";
import {
  buildVehicleCatalogDeepLink,
  buildVehicleSeoKeywords,
  buildVehicleSeoPath,
  extractVehicleBrandModel,
  extractVehicleSeoDescription,
  extractVehicleSeoTitle,
  normalizeVehicleSeoKey,
} from "@/lib/seo/vehicle-seo";
import { buildVehicleOfferJsonLd } from "@/lib/seo/json-ld";
import { BUSINESS, SITE_NAME } from "@/lib/seo/site-config";
import type { CatalogItem } from "@/types/catalog";

export const revalidate = 300;

type PageProps = {
  params: Promise<{ key: string }>;
};

async function findVehicleByKey(key: string): Promise<{
  item: CatalogItem;
  vehicleKey: string;
  priceLabel: string | null;
} | null> {
  const normalized = normalizeVehicleSeoKey(decodeURIComponent(key));
  const [feed, editorConfigResult] = await Promise.all([getCatalogFeed(), getEditorConfig()]);
  const visibleItems = getVisibleCatalogItems(feed.items, editorConfigResult.config);
  const priceLabels = buildPriceLabelMap(editorConfigResult.config);

  for (const item of visibleItems) {
    const vehicleKey = getVehicleKey(item);
    if (normalizeVehicleSeoKey(vehicleKey) === normalized) {
      return {
        item,
        vehicleKey,
        priceLabel: priceLabels[vehicleKey] ?? null,
      };
    }
  }
  return null;
}

export async function generateStaticParams() {
  const [feed, editorConfigResult] = await Promise.all([getCatalogFeed(), getEditorConfig()]);
  const visibleItems = getVisibleCatalogItems(feed.items, editorConfigResult.config);
  return visibleItems.map((item) => ({
    key: normalizeVehicleSeoKey(getVehicleKey(item)),
  }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { key } = await params;
  const found = await findVehicleByKey(key);
  if (!found) return { robots: { index: false, follow: false } };

  const { item, vehicleKey, priceLabel } = found;
  const title = `${extractVehicleSeoTitle(item)} | Autos usados Chile — ${SITE_NAME}`;
  const description = `${extractVehicleSeoDescription(item, priceLabel)} Compra auto usado en Chile con VEDISA REMATES. WhatsApp ${BUSINESS.phone}.`;
  const image = resolveCatalogItemThumbnail(item) ?? item.images[0];
  const path = buildVehicleSeoPath(vehicleKey).replace(/^\//, "");

  return buildPageMetadata({
    path,
    title,
    description,
    keywords: buildVehicleSeoKeywords(item),
    ogImage: image,
    ogImageAlt: item.title,
  });
}

export default async function VehicleSeoPage({ params }: PageProps) {
  const { key } = await params;
  const found = await findVehicleByKey(key);
  if (!found) notFound();

  const { item, vehicleKey, priceLabel } = found;
  const { brand, model, year } = extractVehicleBrandModel(item);
  const image = resolveCatalogItemThumbnail(item) ?? item.images[0];
  const catalogLink = buildVehicleCatalogDeepLink(vehicleKey);

  return (
    <>
      <StructuredData data={buildVehicleOfferJsonLd(item, priceLabel)} />
      <div className="min-h-screen bg-[#f6efe8] text-[#2d2118]">
        <header className="border-b border-[#e8ddd2] bg-[#f6efe8]/95">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
            <Link href="/" className="font-semibold text-[#8a542f]">
              {SITE_NAME}
            </Link>
            <Link href="/autos-usados-chile" className="text-sm text-[#8a542f] hover:underline">
              Autos usados Chile
            </Link>
          </div>
        </header>
        <main className="mx-auto max-w-3xl px-4 py-8">
          <nav aria-label="Breadcrumb" className="mb-4 text-sm text-neutral-600">
            <Link href="/" className="hover:underline">
              Inicio
            </Link>
            {" / "}
            <Link href="/autos-usados" className="hover:underline">
              Autos usados
            </Link>
            {" / "}
            <span>{item.title}</span>
          </nav>
          <h1 className="mb-2 text-2xl font-bold">{item.title}</h1>
          {item.subtitle ? <p className="mb-4 text-neutral-700">{item.subtitle}</p> : null}
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt={item.title} className="mb-4 w-full rounded-xl object-cover" />
          ) : null}
          <dl className="mb-6 grid gap-2 text-sm sm:grid-cols-2">
            {brand ? (
              <>
                <dt className="font-medium">Marca</dt>
                <dd>{brand}</dd>
              </>
            ) : null}
            {model ? (
              <>
                <dt className="font-medium">Modelo</dt>
                <dd>{model}</dd>
              </>
            ) : null}
            {year ? (
              <>
                <dt className="font-medium">Año</dt>
                <dd>{year}</dd>
              </>
            ) : null}
            {priceLabel ? (
              <>
                <dt className="font-medium">Precio</dt>
                <dd>{priceLabel}</dd>
              </>
            ) : null}
            <dt className="font-medium">Patente / ID</dt>
            <dd>{vehicleKey}</dd>
          </dl>
          <p className="mb-6 text-neutral-700">
            Auto usado disponible en {SITE_NAME}, automotora VEDISA REMATES en Santiago. Buena oportunidad
            para comprar autos usados en Chile con fotos, ficha técnica y contacto WhatsApp directo.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href={catalogLink}
              className="inline-flex rounded-lg bg-[#8a542f] px-4 py-2 font-medium text-white hover:bg-[#744628]"
            >
              Ver ficha completa en catálogo
            </Link>
            <a
              href={`https://wa.me/${BUSINESS.whatsapp.replace(/\D/g, "")}`}
              className="inline-flex rounded-lg border border-[#8a542f] px-4 py-2 font-medium text-[#8a542f] hover:bg-[#8a542f]/5"
              rel="noopener noreferrer"
              target="_blank"
            >
              WhatsApp
            </a>
          </div>
        </main>
      </div>
    </>
  );
}
