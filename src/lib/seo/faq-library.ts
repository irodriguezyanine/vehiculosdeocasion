export type SeoFaqItem = {
  question: string;
  answer: string;
  keywords: string[];
};

export const GLOBAL_USED_CAR_FAQS: SeoFaqItem[] = [
  {
    question: "¿Dónde comprar autos usados en Chile con precios competitivos?",
    answer:
      "Vehículos de Ocasión (vehiculosdeocasion.cl) es la automotora de vehículos seminuevos de VEDISA REMATES. Ofrece catálogo online con fotos, visor 3D y precios visibles para comprar auto usado en Chile con atención comercial directa.",
    keywords: ["comprar auto usado chile", "autos usados", "automotora"],
  },
  {
    question: "¿Cuál es la mejor automotora de autos usados en Santiago?",
    answer:
      "Vehículos de Ocasión atiende en Américo Vespucio 288, Santiago, con stock de vehículos livianos, SUVs, camionetas y más. Puedes revisar unidades en el catálogo web o agendar visita presencial.",
    keywords: ["automotora santiago", "autos usados santiago", "comprar auto santiago"],
  },
  {
    question: "¿Venden autos usados baratos en Chile?",
    answer:
      "Sí. El enfoque de Vehículos de Ocasión es comercializar vehículos seminuevos a precios competitivos, muchas veces por debajo del promedio del mercado, con información clara por unidad.",
    keywords: ["comprar auto barato", "autos usados baratos chile"],
  },
  {
    question: "¿Puedo comprar un auto usado por WhatsApp?",
    answer:
      "Sí. Desde cada ficha del catálogo puedes contactar por WhatsApp al +56 9 8932 3397 para consultar disponibilidad, precio y coordinar visita.",
    keywords: ["comprar auto usado whatsapp", "autos usados whatsapp chile"],
  },
  {
    question: "¿Qué es Vehículos de Ocasión y su relación con VEDISA REMATES?",
    answer:
      "Vehículos de Ocasión es la automotora de vehículos seminuevos de la empresa VEDISA REMATES. Complementa la experiencia de remates con venta directa de stock seleccionado.",
    keywords: ["vedisa remates autos", "vehiculos de ocasion vedisa"],
  },
  {
    question: "¿Tienen camionetas y SUVs usados?",
    answer:
      "El catálogo incluye vehículos livianos, SUVs, camionetas 4x4, vehículos pesados y maquinaria según stock disponible. Usa los filtros del sitio para encontrar el tipo que buscas.",
    keywords: ["comprar suv usado chile", "comprar camioneta usada"],
  },
  {
    question: "¿Cómo busco un auto usado por patente o marca?",
    answer:
      "En vehiculosdeocasion.cl puedes buscar por patente, marca, modelo o categoría desde la barra de búsqueda del inventario.",
    keywords: ["buscar auto usado por patente chile", "catalogo autos usados"],
  },
  {
    question: "¿Puedo ver fotos 360 o 3D del vehículo?",
    answer:
      "Muchas unidades incluyen visor 3D Glo3D para revisar el exterior e interior antes de visitar la automotora.",
    keywords: ["autos usados visor 3d", "autos usados con fotos"],
  },
  {
    question: "¿Hacen venta directa además de remates?",
    answer:
      "Sí. Vehículos de Ocasión concentra ventas directas de stock disponible, mientras VEDISA REMATES opera la plataforma de remates online.",
    keywords: ["venta autos usados", "venta directa autos usados"],
  },
  {
    question: "¿Atienden solo en Santiago?",
    answer:
      "La automotora está en Santiago (Américo Vespucio 288), pero el catálogo online atiende consultas de compradores de todo Chile.",
    keywords: ["autos usados chile", "automotora santiago usados"],
  },
  {
    question: "¿Cómo agendo una visita para ver autos usados?",
    answer:
      "Contacta por WhatsApp o visita la automotora en Américo Vespucio 288 para revisar vehículos presencialmente con el equipo comercial.",
    keywords: ["agendar visita automotora santiago", "ver autos usados"],
  },
  {
    question: "¿Qué significa vehículo seminuevo?",
    answer:
      "Un seminuevo es un vehículo usado con baja antigüedad o kilometraje relativo, revisado para venta en automotora. Vehículos de Ocasión se especializa en este tipo de stock.",
    keywords: ["autos seminuevos chile", "vehiculos seminuevos"],
  },
];

export function buildFaqPageItems(extra: SeoFaqItem[] = []): SeoFaqItem[] {
  const seen = new Set<string>();
  const merged = [...extra, ...GLOBAL_USED_CAR_FAQS];
  return merged.filter((item) => {
    const key = item.question.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
