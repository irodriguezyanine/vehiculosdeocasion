import { CatalogHomeClient } from "@/components/catalog-home-client";
import { getCatalogFeed } from "@/lib/catalog";
import { getEditorConfig } from "@/lib/editor-config";

export const revalidate = 300;

export default async function Home() {
  const [feed, editorConfigResult] = await Promise.all([
    getCatalogFeed(),
    getEditorConfig(),
  ]);
  return <CatalogHomeClient feed={feed} initialConfig={editorConfigResult.config} />;
}
