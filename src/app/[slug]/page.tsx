import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SeoLandingPageView } from "@/components/seo-landing-page";
import { StructuredData } from "@/components/structured-data";
import { buildLandingPageJsonLd } from "@/lib/seo/json-ld";
import { getLandingPageBySlug, SEO_LANDING_SLUGS } from "@/lib/seo/landing-pages";
import { buildPageMetadata } from "@/lib/seo/metadata";

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

  return (
    <>
      <StructuredData data={buildLandingPageJsonLd(page)} />
      <SeoLandingPageView page={page} />
    </>
  );
}
