import type { MetadataRoute } from "next";
import { getSiteUrl, SITE_NAME, SITE_TAGLINE } from "@/lib/seo/site-config";

export default function manifest(): MetadataRoute.Manifest {
  const siteUrl = getSiteUrl();
  return {
    name: SITE_NAME,
    short_name: "Veh. Ocasión",
    description: SITE_TAGLINE,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f5f3f0",
    theme_color: "#8a542f",
    lang: "es-CL",
    orientation: "portrait-primary",
    categories: ["automotive", "shopping"],
    icons: [
      {
        src: "/favicon.png",
        sizes: "128x128",
        type: "image/png",
      },
    ],
    id: siteUrl,
  };
}
