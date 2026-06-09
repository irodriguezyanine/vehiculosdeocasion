import { BUSINESS } from "@/lib/seo/site-config";
import { CONTACT_PHONE, WHATSAPP_DEFAULT_LINK } from "@/lib/contact";
import { INSTAGRAM_HANDLE, INSTAGRAM_PROFILE_URL } from "@/lib/instagram";

export const COMMERCIAL_EMAIL = "vehiculosdeocasioncl@gmail.com";

export const ABOUT_INTRO =
  "Vehículos de Ocasión es la automotora de vehículos seminuevos de la empresa VEDISA REMATES, especializada en la comercialización de todo tipo de vehículos a precios competitivos y por debajo del promedio del mercado.";

export const ABOUT_HIGHLIGHTS = [
  {
    title: "Más de 40 años de experiencia",
    text: "Somos expertos en la comercialización de vehículos seminuevos y usados, con respaldo comercial y operativo de VEDISA REMATES.",
  },
  {
    title: "Precios por debajo del mercado",
    text: "Seleccionamos unidades con una propuesta de valor competitiva para que compres con mejor relación precio-calidad.",
  },
  {
    title: "Catálogo digital completo",
    text: "Revisa fotos, ficha técnica y visor GLO3D cuando está disponible, con información clara para decidir con confianza.",
  },
  {
    title: "Asesoría comercial directa",
    text: "Te acompañamos por WhatsApp durante reserva, revisión, documentación y cierre de tu compra.",
  },
] as const;

export const EXPERIENCE_TILES = [
  [
    "Precios competitivos",
    "Seleccionamos unidades con una propuesta de valor por debajo del promedio del mercado.",
  ],
  [
    "Visor GLO3D",
    "Publicamos vehículos con una experiencia inmersiva para revisar detalles con mayor confianza.",
  ],
  [
    "Asesoría directa",
    "Te apoyamos por WhatsApp durante todo el proceso de compra o reserva de tu unidad.",
  ],
  [
    "Gestión documental",
    "Coordinamos el cierre comercial y la documentación para una compra más simple.",
  ],
] as const;

export const COMMERCIAL_FAQS = [
  [
    "¿Cómo reservo un vehículo?",
    "Contáctanos por WhatsApp y te guiamos con toda la información comercial de la unidad.",
  ],
  [
    "¿Puedo revisar vehículos antes?",
    "Sí. Podemos coordinar revisión presencial y también apoyarte con fotos, video y GLO3D.",
  ],
  [
    "¿Todos los vehículos tienen visor 3D?",
    "No todos, pero los que lo tienen aparecen marcados como 3D en el catálogo.",
  ],
  [
    "¿Dónde recibo apoyo comercial?",
    "Nuestro equipo responde por WhatsApp e Instagram en horario comercial.",
  ],
] as const;

export const CONTACT_CHANNELS = {
  phone: CONTACT_PHONE,
  whatsappUrl: WHATSAPP_DEFAULT_LINK,
  email: COMMERCIAL_EMAIL,
  businessEmail: BUSINESS.email,
  instagramHandle: INSTAGRAM_HANDLE,
  instagramUrl: INSTAGRAM_PROFILE_URL,
  address: `${BUSINESS.address.street}, ${BUSINESS.address.locality}`,
  openingHours: BUSINESS.openingHours,
} as const;

export const SITE_NAV_LINKS = [
  { href: "/#catalogo", label: "Catálogo", pathMatch: "/" as const },
  { href: "/nosotros", label: "Nosotros", pathMatch: "/nosotros" as const },
  { href: "/contacto", label: "Contacto", pathMatch: "/contacto" as const },
] as const;

export type SiteLocation = {
  id: string;
  label: string;
  addressLine: string;
  mapsQuery: string;
};

export const SITE_LOCATIONS: SiteLocation[] = [
  {
    id: "oficinas",
    label: "Oficinas",
    addressLine: "Américo Vespucio 2880, Piso 7",
    mapsQuery: "Américo Vespucio 2880, Santiago, Chile",
  },
  {
    id: "exhibicion",
    label: "Exhibición",
    addressLine: "Arturo Prat 6457, Noviciado, Pudahuel",
    mapsQuery: "Arturo Prat 6457, Pudahuel, Chile",
  },
];

export const FOOTER_DISCLAIMER =
  "La información publicada es referencial, complementada con fotografías y videos. Los vehículos se encuentran en exhibición para verificar su estado en forma presencial. VEDISA REMATES garantiza la información publicada en nuestros recintos; una vez retirada de nuestras bodegas, se entiende aceptada a entera conformidad, sin derecho a reclamos posteriores respecto a su estado y equipamiento.";

export const FOOTER_HOURS =
  "Lunes a Viernes 9:00 - 13:00 / 14:00 - 17:00 · Sábado y Domingo cerrado";

export function buildMapEmbedUrl(query: string): string {
  return `https://maps.google.com/maps?q=${encodeURIComponent(query)}&z=16&ie=UTF8&iwloc=&output=embed`;
}

export function buildMapExternalUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
