export type OfferSubmissionInput = {
  itemKey: string;
  vehicleTitle: string;
  patent: string;
  referencePrice: number;
  offerAmount: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  createdAt?: string;
};

export type OfferRecord = {
  id: string;
  itemKey: string;
  vehicleTitle: string;
  patent: string;
  referencePrice: number;
  offerAmount: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  createdAt: string;
};
