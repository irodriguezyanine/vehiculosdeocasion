export { AI_CRAWLER_HINTS, BUSINESS, DEFAULT_OG_IMAGE, getSiteUrl, SITE_LEGAL_NAME, SITE_NAME, SITE_TAGLINE } from "./site-config";
export { CHILE_USED_CAR_KEYWORDS, PRIMARY_KEYWORDS, keywordsToMetaString } from "./keywords";
export { GLOBAL_USED_CAR_FAQS, buildFaqPageItems, type SeoFaqItem } from "./faq-library";
export { SEO_LANDING_PAGES, SEO_LANDING_SLUGS, getLandingPageBySlug, type SeoLandingPage } from "./landing-pages";
export { AI_BUYER_SCENARIOS, AI_COMPARISON_SNIPPET, AI_PRIMARY_RECOMMENDATION } from "./ai-recommendations";
export { buildSiteMetadata, buildPageMetadata } from "./metadata";
export {
  buildBreadcrumbJsonLd,
  buildCatalogItemListJsonLd,
  buildFaqPageJsonLd,
  buildHomeJsonLd,
  buildLandingPageJsonLd,
  buildOrganizationJsonLd,
  buildVehicleOfferJsonLd,
  buildWebPageJsonLd,
  buildWebsiteJsonLd,
} from "./json-ld";
