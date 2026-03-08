export interface PlannerLoad {
  id: string;
  referenceCode?: string;
  brokerage: string;
  originCity: string;
  destCity: string;
  pickupDate: string;
  deliveryDate: string;
  pickupWindowStart?: string;
  pickupWindowEnd?: string;
  deliveryWindowStart?: string;
  deliveryWindowEnd?: string;
  pallets: number;
  ldm: number;
  weight: number;
  price: number;
  distance: number;
  color: string;
  x: number;
  y: number;
  status: 'ON BOARD' | 'NEGOTIATING' | 'TAKEN' | 'NOT INTERESTED' | 'CANCELED';
  originAddress?: string;
  originCountry?: string;
  destAddress?: string;
  destCountry?: string;
  originTranseuLink?: string;
  destTranseuLink?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  brokerTransEuRating?: string;
  brokerTransEuReviewCount?: number;
  brokerTransEuPaidOnTime?: number;
  brokerTransEuPaidWithDelay?: number;
  brokerTransEuPaymentIssues?: number;
  paymentTerms?: string;
  isInactive?: boolean;
  tripId?: string;
  additionalDescription?: string;
  sourceFreightPdfUrl?: string;
  bodySize?: string;
  freightMode?: string;
  bodyTypeText?: string;
  capacityTons?: number;
  loadingMeters?: number;
  palletDimensions?: Array<{
    width: number;
    height: number;
    weightKg?: number;
  }>;
  extraStops?: Array<
    | string
    | {
        address: string;
        pallets: number;
        action: 'pickup' | 'dropoff';
      }
  >;
}
