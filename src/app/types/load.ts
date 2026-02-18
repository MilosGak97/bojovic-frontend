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
  destAddress?: string;
  originTranseuLink?: string;
  destTranseuLink?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  paymentTerms?: string;
  isInactive?: boolean;
  plannerVanId?: string;
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
