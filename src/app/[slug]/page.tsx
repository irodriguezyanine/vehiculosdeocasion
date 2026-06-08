import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SeoLandingPageClient } from "@/components/seo-landing-page-client";
import { StructuredData } from "@/components/structured-data";
import { getCatalogFeed } from "@/lib/catalog";
import { getEditorConfig } from "@/lib/editor-config";
import { buildLandingPageJsonLd } from "@/lib/seo/json-ld";
import { getLandingPageBySlug, SEO_LANDING_SLUGS } from "@/lib/seo/landing-pages";
import { buildPageMetadata } from "@/lib/seo/metadata";
export const revalidate = 300;

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return SEO_LANDING_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = getLandingPageBySlug(slug);
  if (!page) return {};
  return buildPageMetadata({
    path: page.slug,
    title: page.title,
    description: page.metaDescription,
    keywords: page.keywords,
  });
}

export default async function SeoLandingRoute({ params }: PageProps) {
  const { slug } = await params;
  const page = getLandingPageBySlug(slug);
  if (!page) notFound();

  const [feed, editorConfigResult] = await Promise.all([
    getCatalogFeed(),
    getEditorConfig(),
  ]);

  return (
    <>
      <StructuredData data={buildLandingPageJsonLd(page)} />
      <SeoLandingPageClient page={page} feed={feed} config={editorConfigResult.config} />
    </>
  );
}
