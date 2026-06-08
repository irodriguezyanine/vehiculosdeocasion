import type { Metadata } from "next";
import { keywordsToMetaString, PRIMARY_KEYWORDS } from "./keywords";
import { DEFAULT_OG_IMAGE, getSiteUrl, SITE_NAME, SITE_TAGLINE } from "./site-config";

export function buildSiteMetadata(overrides: Partial<Metadata> = {}): Metadata {
  const siteUrl = getSiteUrl();
  const title = overrides.title ?? `${SITE_NAME} | Autos usados y seminuevos Chile`;
  const description =
    (typeof overrides.description === "string" ? overrides.description : undefined) ??
    `${SITE_TAGLINE}. Compra autos usados, seminuevos, SUVs y camionetas con precios visibles, fotos 3D y WhatsApp directo. Automotora VEDISA REMATES en Santiago.`;

  return {
    metadataBase: new URL(siteUrl),
    title,
    description,
    keywords: keywordsToMetaString(PRIMARY_KEYWORDS),
    authors: [{ name: SITE_NAME, url: siteUrl }],
    creator: SITE_NAME,
    publisher: SITE_NAME,
    category: "Automotive",
    alternates: {
      canonical: siteUrl,
      ...overrides.alternates,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
    verification: {
      google: "1ySlQG4DLFr7UtiAc47gQB_7atdekQW-nK-r0Y6OoCA",
    },
    openGraph: {
      type: "website",
      locale: "es_CL",
      url: siteUrl,
      siteName: SITE_NAME,
      title: typeof title === "string" ? title : SITE_NAME,
      description,
      images: [
        {
          url: DEFAULT_OG_IMAGE,
          width: 512,
          height: 512,
          alt: SITE_NAME,
        },
      ],
      ...overrides.openGraph,
    },
    twitter: {
      card: "summary_large_image",
      title: typeof title === "string" ? title : SITE_NAME,
      description,
      images: [DEFAULT_OG_IMAGE],
      ...overrides.twitter,
    },
    other: {
      "geo.region": "CL-RM",
      "geo.placename": "Santiago",
      "geo.position": "-33.4489;-70.6693",
      ICBM: "-33.4489, -70.6693",
      "content-language": "es-CL",
    },
    ...overrides,
  };
}

export function buildPageMetadata(params: {
  path: string;
  title: string;
  description: string;
  keywords?: string[];
}): Metadata {
  const siteUrl = getSiteUrl();
  const canonical = params.path === "/" ? siteUrl : `${siteUrl}/${params.path.replace(/^\//, "")}`;
  return buildSiteMetadata({
    title: params.title,
    description: params.description,
    keywords: params.keywords?.join(", "),
    alternates: { canonical },
    openGraph: {
      url: canonical,
      title: params.title,
      description: params.description,
    },
    twitter: {
      title: params.title,
      description: params.description,
    },
  });
}
