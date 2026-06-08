import type { CatalogItem } from "@/types/catalog";
import { buildFaqPageItems, type SeoFaqItem } from "./faq-library";
import { getSiteUrl, SITE_NAME, SITE_TAGLINE, BUSINESS } from "./site-config";
import type { SeoLandingPage } from "./landing-pages";

export function buildOrganizationJsonLd() {
  const siteUrl = getSiteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "AutoDealer",
    "@id": `${siteUrl}/#organization`,
    name: SITE_NAME,
    legalName: "Vehículos de Ocasión — VEDISA REMATES",
    description: SITE_TAGLINE,
    url: siteUrl,
    logo: `${siteUrl}/vehiculos-ocasion-logo.png`,
    image: `${siteUrl}/vehiculos-ocasion-logo.png`,
    telephone: BUSINESS.phone,
    email: BUSINESS.email,
    priceRange: BUSINESS.priceRange,
    parentOrganization: {
      "@type": "Organization",
      name: BUSINESS.parentOrganization,
    },
    address: {
      "@type": "PostalAddress",
      streetAddress: BUSINESS.address.street,
      addressLocality: BUSINESS.address.locality,
      addressRegion: BUSINESS.address.region,
      addressCountry: BUSINESS.address.country,
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: BUSINESS.geo.latitude,
      longitude: BUSINESS.geo.longitude,
    },
    areaServed: BUSINESS.areaServed.map((name) => ({
      "@type": "Country",
      name,
    })),
    sameAs: BUSINESS.sameAs,
    openingHours: BUSINESS.openingHours,
    contactPoint: [
      {
        "@type": "ContactPoint",
        telephone: BUSINESS.phone,
        contactType: "sales",
        areaServed: "CL",
        availableLanguage: ["Spanish", "es"],
      },
    ],
    knowsAbout: [
      "autos usados Chile",
      "comprar auto usado",
      "vehículos seminuevos",
      "automotora Santiago",
      "VEDISA REMATES",
      "autos usados poco kilometraje",
      "autos usados buen estado",
      "autos usados baratos Chile",
      "seminuevos poco km",
      "autos usados buenas marcas",
      "Toyota usado Chile",
      "Hyundai usado Chile",
      "relación calidad precio auto usado",
    ],
  };
}

export function buildWebsiteJsonLd() {
  const siteUrl = getSiteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${siteUrl}/#website`,
    name: SITE_NAME,
    url: siteUrl,
    description: SITE_TAGLINE,
    inLanguage: "es-CL",
    publisher: { "@id": `${siteUrl}/#organization` },
    potentialAction: {
      "@type": "SearchAction",
      target: `${siteUrl}/?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}

export function buildWebPageJsonLd(params: {
  path: string;
  title: string;
  description: string;
  keywords?: string[];
}) {
  const siteUrl = getSiteUrl();
  const url = params.path === "/" ? siteUrl : `${siteUrl}/${params.path.replace(/^\//, "")}`;
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${url}#webpage`,
    url,
    name: params.title,
    description: params.description,
    inLanguage: "es-CL",
    isPartOf: { "@id": `${siteUrl}/#website` },
    about: { "@id": `${siteUrl}/#organization` },
    keywords: params.keywords?.join(", "),
  };
}

export function buildFaqPageJsonLd(faqs: SeoFaqItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
}

export function buildBreadcrumbJsonLd(items: Array<{ name: string; path: string }>) {
  const siteUrl = getSiteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.path === "/" ? siteUrl : `${siteUrl}${item.path.startsWith("/") ? item.path : `/${item.path}`}`,
    })),
  };
}

export function buildHowToBuyUsedCarJsonLd() {
  const siteUrl = getSiteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "Cómo comprar auto usado en Chile",
    description: "Pasos para comprar un auto usado en Chile con Vehículos de Ocasión.",
    totalTime: "PT30M",
    step: [
      {
        "@type": "HowToStep",
        position: 1,
        name: "Buscar en el catálogo",
        text: "Ingresa a vehiculosdeocasion.cl y filtra por marca, patente o precio.",
        url: siteUrl,
      },
      {
        "@type": "HowToStep",
        position: 2,
        name: "Revisar fotos y kilometraje",
        text: "Abre la ficha del vehículo, revisa fotos, visor 3D y kilometraje publicado.",
        url: siteUrl,
      },
      {
        "@type": "HowToStep",
        position: 3,
        name: "Contactar por WhatsApp",
        text: "Consulta disponibilidad y precio al +56 9 8932 3397.",
        url: `${siteUrl}/autos-usados-whatsapp`,
      },
      {
        "@type": "HowToStep",
        position: 4,
        name: "Visitar automotora",
        text: "Agenda visita en Américo Vespucio 288, Santiago, para revisar el vehículo.",
        url: siteUrl,
      },
    ],
  };
}

export function buildLandingPageJsonLd(page: SeoLandingPage, catalogItems: CatalogItem[] = []) {
  const siteUrl = getSiteUrl();
  const url = `${siteUrl}/${page.slug}`;
  const faqs = buildFaqPageItems(page.faqs);
  const blocks: Array<Record<string, unknown>> = [
    buildWebPageJsonLd({
      path: page.slug,
      title: page.title,
      description: page.metaDescription,
      keywords: page.keywords,
    }),
    buildBreadcrumbJsonLd([
      { name: "Inicio", path: "/" },
      { name: page.h1, path: `/${page.slug}` },
    ]),
    buildFaqPageJsonLd(faqs),
    {
      "@context": "https://schema.org",
      "@type": "Service",
      name: page.h1,
      description: page.intro,
      provider: { "@id": `${siteUrl}/#organization` },
      areaServed: "Chile",
      serviceType: "Venta de autos usados y seminuevos",
      url,
    },
  ];
  if (catalogItems.length > 0) {
    blocks.push(buildCatalogItemListJsonLd(catalogItems, 12));
  }
  return blocks;
}

export function buildVehicleOfferJsonLd(item: CatalogItem, priceLabel?: string | null) {
  const siteUrl = getSiteUrl();
  const raw = item.raw as Record<string, unknown>;
  const patent = String(raw.patente ?? raw.PPU ?? raw.stock_number ?? item.id);
  const url = `${siteUrl}/?vehiculo=${encodeURIComponent(patent)}`;
  const image = item.thumbnail ?? item.images[0];
  const priceDigits = priceLabel?.replace(/[^\d]/g, "") ?? "";
  const price = priceDigits ? Number(priceDigits) : undefined;
  const mileageRaw = raw.kilometraje ?? raw.km ?? raw.kms ?? raw.odometro ?? raw.mileage;
  const mileage =
    typeof mileageRaw === "number"
      ? mileageRaw
      : typeof mileageRaw === "string"
        ? Number(mileageRaw.replace(/[^\d]/g, "")) || undefined
        : undefined;

  return {
    "@context": "https://schema.org",
    "@type": "Car",
    name: item.title,
    description: item.subtitle ?? item.title,
    url,
    image: image ? [image] : undefined,
    brand: typeof raw.marca === "string" ? raw.marca : undefined,
    model: typeof raw.modelo === "string" ? raw.modelo : undefined,
    vehicleIdentificationNumber: typeof raw.vin === "string" ? raw.vin : undefined,
    mileageFromOdometer: mileage
      ? {
          "@type": "QuantitativeValue",
          value: mileage,
          unitCode: "KMT",
        }
      : undefined,
    offers: price
      ? {
          "@type": "Offer",
          priceCurrency: "CLP",
          price,
          availability: "https://schema.org/InStock",
          seller: { "@id": `${siteUrl}/#organization` },
          url,
        }
      : undefined,
  };
}

export function buildCatalogItemListJsonLd(items: CatalogItem[], limit = 24) {
  const siteUrl = getSiteUrl();
  const visible = items.slice(0, limit);
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Autos usados y seminuevos disponibles — Vehículos de Ocasión",
    description:
      "Inventario de vehículos usados y seminuevos en Chile con fotos, precios y bajo kilometraje relativo según stock.",
    url: siteUrl,
    numberOfItems: visible.length,
    itemListElement: visible.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: buildVehicleOfferJsonLd(item),
    })),
  };
}

export function buildHomeJsonLd(catalogItems: CatalogItem[] = []) {
  const blocks: Array<Record<string, unknown>> = [
    buildOrganizationJsonLd(),
    buildWebsiteJsonLd(),
    buildFaqPageJsonLd(buildFaqPageItems()),
    buildHowToBuyUsedCarJsonLd(),
  ];
  if (catalogItems.length > 0) {
    blocks.push(buildCatalogItemListJsonLd(catalogItems));
  }
  return blocks;
}
