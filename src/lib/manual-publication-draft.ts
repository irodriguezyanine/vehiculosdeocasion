import type { EditorVehicleDetails, SectionId } from "@/types/editor";

export type ManualPublicationDraft = EditorVehicleDetails & {
  status: string;
  location: string;
  lot: string;
  auctionDate: string;
  normalPrice: string;
  promoEnabled: boolean;
  promoPrice: string;
  upcomingAuctionId: string;
  visible: boolean;
  sectionIds: SectionId[];
  imagesCsv: string;
};

export const EMPTY_MANUAL_PUBLICATION_DRAFT: ManualPublicationDraft = {
  title: "",
  subtitle: "",
  patente: "",
  patenteVerifier: "",
  vin: "",
  nChasis: "",
  nMotor: "",
  nSerie: "",
  nSiniestro: "",
  version: "",
  tipo: "",
  tipoVehiculo: "",
  vehicleCondition: "",
  status: "Disponible",
  location: "",
  ubicacionFisica: "",
  transportista: "",
  taller: "",
  lot: "",
  auctionDate: "",
  description: "",
  extendedDescription: "",
  brand: "",
  model: "",
  year: "",
  category: "",
  kilometraje: "",
  color: "",
  combustible: "",
  transmision: "",
  traccion: "",
  aro: "",
  cilindrada: "",
  llaves: "",
  aireAcondicionado: "",
  unicoPropietario: "",
  condicionado: "",
  multas: "",
  tag: "",
  vencRevisionTecnica: "",
  vencPermisoCirculacion: "",
  vencSeguroObligatorio: "",
  pruebaMotor: "",
  pruebaDesplazamiento: "",
  estadoAirbags: "",
  nombrePropietarioAnterior: "",
  rutPropietarioAnterior: "",
  rutVerificador: "",
  thumbnail: "",
  view3dUrl: "",
  imagesCsv: "",
  originalPrice: "",
  promoPrice: "",
  promoEnabled: false,
  taxFee: "",
  transferFee: "",
  normalPrice: "",
  upcomingAuctionId: "",
  visible: true,
  sectionIds: ["catalogo"],
};

export function buildManualDraftDetails(draft: ManualPublicationDraft): EditorVehicleDetails {
  const {
    status: _status,
    location: _location,
    lot: _lot,
    auctionDate: _auctionDate,
    normalPrice: _normalPrice,
    promoEnabled: _promoEnabled,
    promoPrice: _promoPrice,
    upcomingAuctionId: _upcomingAuctionId,
    visible: _visible,
    sectionIds: _sectionIds,
    imagesCsv: _imagesCsv,
    ...details
  } = draft;
  return details;
}
