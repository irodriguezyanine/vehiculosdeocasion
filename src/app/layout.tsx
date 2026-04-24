import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://vehiculosdeocasion.vercel.app"),
  title: "Vehículos de Ocasión | Automotora y Compraventa",
  description:
    "Vehículos de Ocasión es una empresa especializada en la comercialización de vehículos a precios competitivos, por debajo del promedio del mercado.",
  alternates: {
    canonical: "https://vehiculosdeocasion.vercel.app",
  },
  icons: {
    icon: [
      { url: "/favicon.png", type: "image/png" },
    ],
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },
  openGraph: {
    type: "website",
    locale: "es_CL",
    url: "https://vehiculosdeocasion.vercel.app",
    siteName: "Vehículos de Ocasión",
    title: "Vehículos de Ocasión | Catálogo de vehículos",
    description:
      "Explora nuestro catálogo de vehículos con precios competitivos, fotos y visor 3D para tomar mejores decisiones.",
    images: [
      {
        url: "/favicon.png",
        width: 128,
        height: 128,
        alt: "Vehículos de Ocasión",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Vehículos de Ocasión",
    description:
      "Compraventa de vehículos con precios competitivos y apoyo comercial directo.",
    images: ["/favicon.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
