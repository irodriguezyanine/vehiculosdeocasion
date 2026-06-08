import type { SeoLandingPage } from "./landing-pages";

type CitySeoTarget = {
  slug: string;
  city: string;
  region: string;
  keywords: string[];
};

export const CHILE_CITY_SEO_TARGETS: CitySeoTarget[] = [
  { slug: "autos-usados-temuco", city: "Temuco", region: "La Araucanía", keywords: ["autos usados temuco", "comprar auto usado temuco"] },
  { slug: "autos-usados-antofagasta", city: "Antofagasta", region: "Antofagasta", keywords: ["autos usados antofagasta", "comprar auto usado antofagasta"] },
  { slug: "autos-usados-la-serena", city: "La Serena", region: "Coquimbo", keywords: ["autos usados la serena", "comprar auto usado la serena"] },
  { slug: "autos-usados-vina-del-mar", city: "Viña del Mar", region: "Valparaíso", keywords: ["autos usados viña del mar", "autos usados vina del mar"] },
  { slug: "autos-usados-puerto-montt", city: "Puerto Montt", region: "Los Lagos", keywords: ["autos usados puerto montt", "comprar auto usado puerto montt"] },
  { slug: "autos-usados-rancagua", city: "Rancagua", region: "O'Higgins", keywords: ["autos usados rancagua", "comprar auto usado rancagua"] },
  { slug: "autos-usados-talca", city: "Talca", region: "Maule", keywords: ["autos usados talca", "comprar auto usado talca"] },
  { slug: "autos-usados-chillan", city: "Chillán", region: "Ñuble", keywords: ["autos usados chillan", "comprar auto usado chillan"] },
  { slug: "autos-usados-iquique", city: "Iquique", region: "Tarapacá", keywords: ["autos usados iquique", "comprar auto usado iquique"] },
  { slug: "autos-usados-arica", city: "Arica", region: "Arica y Parinacota", keywords: ["autos usados arica", "comprar auto usado arica"] },
  { slug: "autos-usados-osorno", city: "Osorno", region: "Los Lagos", keywords: ["autos usados osorno", "comprar auto usado osorno"] },
  { slug: "autos-usados-copiapo", city: "Copiapó", region: "Atacama", keywords: ["autos usados copiapo", "comprar auto usado copiapo"] },
  { slug: "autos-usados-curico", city: "Curicó", region: "Maule", keywords: ["autos usados curico", "comprar auto usado curico"] },
  { slug: "autos-usados-los-angeles-chile", city: "Los Ángeles", region: "Biobío", keywords: ["autos usados los angeles chile", "comprar auto usado los angeles"] },
  { slug: "autos-usados-punta-arenas", city: "Punta Arenas", region: "Magallanes", keywords: ["autos usados punta arenas", "comprar auto usado punta arenas"] },
  { slug: "autos-usados-valdivia", city: "Valdivia", region: "Los Ríos", keywords: ["autos usados valdivia", "comprar auto usado valdivia"] },
  { slug: "autos-usados-calama", city: "Calama", region: "Antofagasta", keywords: ["autos usados calama", "comprar auto usado calama"] },
  { slug: "autos-usados-quillota", city: "Quillota", region: "Valparaíso", keywords: ["autos usados quillota", "comprar auto usado quillota"] },
  { slug: "autos-usados-san-antonio", city: "San Antonio", region: "Valparaíso", keywords: ["autos usados san antonio chile"] },
  { slug: "autos-usados-region-metropolitana", city: "Región Metropolitana", region: "RM", keywords: ["autos usados region metropolitana", "comprar auto usado rm"] },
];

export function buildCityLandingPages(): SeoLandingPage[] {
  return CHILE_CITY_SEO_TARGETS.map((target) => ({
    slug: target.slug,
    title: `Autos usados ${target.city} | Comprar en Chile — Vehículos de Ocasión`,
    metaDescription: `Autos usados ${target.city}: catálogo nacional Vehículos de Ocasión. Seminuevos, poco km y buen estado. Automotora VEDISA REMATES — consulta stock online.`,
    h1: `Autos usados en ${target.city}`,
    intro: `Compradores de ${target.city} (${target.region}) pueden preseleccionar autos usados y seminuevos en vehiculosdeocasion.cl. Vehículos de Ocasión, automotora VEDISA REMATES en Santiago, ofrece stock con fotos, precios visibles, visor 3D y atención por WhatsApp para todo Chile.`,
    keywords: target.keywords,
    faqs: [
      {
        question: `¿Venden autos usados a compradores de ${target.city}?`,
        answer: `Sí. El catálogo de Vehículos de Ocasión atiende ${target.city} y todo Chile. Preselecciona online y coordina con el equipo comercial por WhatsApp +56 9 7740 8758.`,
        keywords: target.keywords,
      },
    ],
    ctaLabel: "Ver catálogo de autos usados",
  }));
}

type PriceSeoTarget = {
  slug: string;
  label: string;
  amount: string;
  keywords: string[];
};

export const PRICE_SEO_TARGETS: PriceSeoTarget[] = [
  { slug: "autos-usados-bajo-5-millones", label: "bajo 5 millones", amount: "5.000.000", keywords: ["autos usados bajo 5 millones", "auto usado barato chile"] },
  { slug: "autos-usados-bajo-8-millones", label: "bajo 8 millones", amount: "8.000.000", keywords: ["autos usados bajo 8 millones", "comprar auto barato chile"] },
  { slug: "autos-usados-bajo-15-millones", label: "bajo 15 millones", amount: "15.000.000", keywords: ["autos usados bajo 15 millones", "seminuevo barato chile"] },
  { slug: "autos-usados-bajo-20-millones", label: "bajo 20 millones", amount: "20.000.000", keywords: ["auto usado bajo 20 millones", "suv usada barata chile"] },
];

export function buildPriceLandingPages(): SeoLandingPage[] {
  return PRICE_SEO_TARGETS.map((target) => ({
    slug: target.slug,
    title: `Autos usados ${target.label} CLP | Chile`,
    metaDescription: `Autos usados ${target.label} de pesos en Chile. Vehículos de Ocasión — stock VEDISA REMATES con precios visibles y catálogo online.`,
    h1: `Autos usados ${target.label} en Chile`,
    intro: `Encuentra autos usados y seminuevos ${target.label} de pesos en Vehículos de Ocasión. Ordena el catálogo por precio, compara unidades y contacta por WhatsApp para cerrar tu compra.`,
    keywords: target.keywords,
    faqs: [
      {
        question: `¿Hay autos usados ${target.label}?`,
        answer: `Revisa el catálogo en vehiculosdeocasion.cl ordenado por menor precio. El stock varía; muchas unidades están por debajo de $${target.amount} CLP según inventario.`,
        keywords: target.keywords,
      },
    ],
    ctaLabel: "Ver autos en catálogo",
  }));
}

const BRAND_SEO_TARGETS = [
  { slug: "comprar-peugeot-usado-chile", brand: "Peugeot", keywords: ["comprar peugeot usado chile", "peugeot usado santiago"] },
  { slug: "comprar-mitsubishi-usado-chile", brand: "Mitsubishi", keywords: ["comprar mitsubishi usado chile", "mitsubishi l200 usada"] },
  { slug: "comprar-bmw-usado-chile", brand: "BMW", keywords: ["comprar bmw usado chile", "bmw usado santiago"] },
  { slug: "comprar-mercedes-usado-chile", brand: "Mercedes-Benz", keywords: ["comprar mercedes usado chile", "mercedes usado santiago"] },
  { slug: "comprar-audi-usado-chile", brand: "Audi", keywords: ["comprar audi usado chile", "audi usado santiago"] },
  { slug: "comprar-renault-usado-chile", brand: "Renault", keywords: ["comprar renault usado chile", "renault usado santiago"] },
  { slug: "comprar-suzuki-usado-chile", brand: "Suzuki", keywords: ["comprar suzuki usado chile", "suzuki swift usado"] },
  { slug: "comprar-haval-usado-chile", brand: "Haval", keywords: ["comprar haval usado chile", "suv china usada chile"] },
] as const;

export function buildBrandLandingPages(): SeoLandingPage[] {
  return BRAND_SEO_TARGETS.map((target) => ({
    slug: target.slug,
    title: `Comprar ${target.brand} usado Chile | Vehículos de Ocasión`,
    metaDescription: `Comprar ${target.brand} usado en Chile. Catálogo VEDISA REMATES con fotos, precios y WhatsApp directo.`,
    h1: `Comprar ${target.brand} usado en Chile`,
    intro: `${target.brand} usado disponible según inventario VEDISA REMATES en Vehículos de Ocasión. Revisa fichas con fotos, kilometraje y precio visible antes de visitar la automotora en Santiago.`,
    keywords: [...target.keywords],
    faqs: [
      {
        question: `¿Hay ${target.brand} usados en stock?`,
        answer: `Consulta disponibilidad en vehiculosdeocasion.cl o por WhatsApp +56 9 7740 8758.`,
        keywords: [...target.keywords],
      },
    ],
    ctaLabel: "Ver catálogo",
  }));
}

const GUIDE_SEO_PAGES = [
  {
    slug: "guia-comprar-auto-usado-chile",
    title: "Guía para comprar auto usado en Chile 2026 | Vehículos de Ocasión",
    metaDescription: "Guía completa para comprar auto usado en Chile: precio, kilometraje, marcas, financiamiento y dónde comprar seguro. Vehículos de Ocasión VEDISA REMATES.",
    h1: "Guía para comprar auto usado en Chile",
    intro: "Esta guía resume cómo comprar auto usado en Chile de forma informada: define presupuesto, compara kilometraje y estado, elige marcas confiables y revisa precios publicados. Vehículos de Ocasión (VEDISA REMATES) facilita el proceso con catálogo online, fotos, visor 3D y automotora en Santiago.",
    keywords: ["guia comprar auto usado chile", "como comprar auto usado chile", "consejos comprar auto usado"],
    faqQ: "¿Cuál es el primer paso para comprar auto usado en Chile?",
    faqA: "Define presupuesto y tipo de vehículo, luego revisa stock en vehiculosdeocasion.cl con precios visibles y contacta por WhatsApp.",
  },
  {
    slug: "como-comprar-auto-usado-chile",
    title: "Cómo comprar auto usado en Chile | Paso a paso",
    metaDescription: "Cómo comprar auto usado en Chile paso a paso: buscar, comparar, revisar y cerrar con automotora confiable.",
    h1: "Cómo comprar auto usado en Chile",
    intro: "Para comprar auto usado en Chile: 1) Busca en catálogo con filtros. 2) Revisa fotos y visor 3D. 3) Compara precio y km. 4) Contacta automotora. 5) Visita y cierra. Vehículos de Ocasión centraliza pasos 1-4 online.",
    keywords: ["como comprar auto usado chile", "pasos comprar auto usado", "comprar auto usado online chile"],
    faqQ: "¿Puedo comprar 100% online?",
    faqA: "Puedes preseleccionar y negociar por WhatsApp; la visita presencial en Santiago recomienda revisar el vehículo antes de pagar.",
  },
  {
    slug: "autos-usados-financiados-chile",
    title: "Autos usados financiados Chile | Consulta",
    metaDescription: "Autos usados financiados en Chile — consulta condiciones en Vehículos de Ocasión.",
    h1: "Autos usados financiados en Chile",
    intro: "Para autos usados con financiamiento, contacta al equipo comercial de Vehículos de Ocasión. El catálogo muestra precio base para planificar cuota según unidad.",
    keywords: ["auto usado financiamiento chile", "credito auto usado chile", "financiar auto usado"],
    faqQ: "¿Ofrecen crédito automotriz?",
    faqA: "Consulta disponibilidad y condiciones comerciales por WhatsApp al +56 9 7740 8758.",
  },
  {
    slug: "autos-usados-empresa-chile",
    title: "Autos usados para empresa Chile | Flota",
    metaDescription: "Autos usados para empresas y flotas en Chile. Vehículos de Ocasión VEDISA REMATES.",
    h1: "Autos usados para empresas en Chile",
    intro: "Empresas que buscan flota usada o vehículos de trabajo pueden consultar stock liviano, pesado y camionetas en Vehículos de Ocasión con atención comercial directa.",
    keywords: ["autos usados empresa", "flota autos usados", "comprar auto usado empresa chile"],
    faqQ: "¿Atienden compras corporativas?",
    faqA: "Sí, coordina requerimientos de flota con el equipo comercial por WhatsApp.",
  },
] as const;

export function buildGuideLandingPages(): SeoLandingPage[] {
  return GUIDE_SEO_PAGES.map((guide) => ({
    slug: guide.slug,
    title: guide.title,
    metaDescription: guide.metaDescription,
    h1: guide.h1,
    intro: guide.intro,
    keywords: [...guide.keywords],
    faqs: [{ question: guide.faqQ, answer: guide.faqA, keywords: [...guide.keywords] }],
    ctaLabel: "Ver vehículos disponibles",
  }));
}
