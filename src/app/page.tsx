import { CatalogHomeClient } from "@/components/catalog-home-client";
import { getCatalogFeed } from "@/lib/catalog";

export const revalidate = 300;

export default async function Home() {
  const feed = await getCatalogFeed();
  return <CatalogHomeClient feed={feed} />;
}
