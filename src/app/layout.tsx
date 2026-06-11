import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SiteFooter } from "@/components/site-footer";
import { WhatsAppFloatingButton } from "@/components/whatsapp-floating-button";
import { buildSiteMetadata } from "@/lib/seo/metadata";
import { getSiteUrl } from "@/lib/seo/site-config";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#8a542f",
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = buildSiteMetadata();

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const siteUrl = getSiteUrl();
  return (
    <html
      lang="es-CL"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <link rel="alternate" type="text/plain" href={`${siteUrl}/llms.txt`} title="LLMs discovery file" />
        <link rel="alternate" type="text/plain" href={`${siteUrl}/ai.txt`} title="AI discovery file" />
        <link rel="alternate" type="application/rss+xml" href={`${siteUrl}/feed.xml`} title="RSS catálogo autos usados" />
        <link rel="sitemap" type="application/xml" href={`${siteUrl}/sitemap.xml`} title="Sitemap" />
      </head>
      <body className="app-body min-h-full flex flex-col overflow-x-hidden">
        {children}
        <SiteFooter />
        <WhatsAppFloatingButton />
      </body>
    </html>
  );
}
