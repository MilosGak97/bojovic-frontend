import { BaseEntity } from './base.entity';
import { LoadStatus, StopType, BodyType, Currency } from '../enums';
import { BrokerCompany } from './broker.entity';

export interface Load extends BaseEntity {
  referenceNumber: string;
  externalId: string | null;
  status: LoadStatus;
  color: string | null;

  // Pickup
  pickupAddress: string;
  pickupCity: string;
  pickupPostcode: string;
  pickupCountry: string;
  pickupDateFrom: string;
  pickupDateTo: string | null;

  // Delivery
  deliveryAddress: string;
  deliveryCity: string;
  deliveryPostcode: string;
  deliveryCountry: string;
  deliveryDateFrom: string;
  deliveryDateTo: string | null;

  // Pricing
  publishedPrice: number | null;
  agreedPrice: number | null;
  currency: Currency;
  paymentTermDays: number | null;
  margin: number | null;
  pricePerKm: number | null;

  // Freight
  distanceKm: number | null;
  contactPerson: string | null;
  contactPhone: string | null;
  vehicleMonitoringRequired: boolean;
  notes: string | null;
  brokerId: string | null;

  // Relations
  broker?: BrokerCompany | null;
  stops?: LoadStop[];
  freightDetails?: LoadFreightDetails;
  pallets?: LoadPallet[];
}

export interface LoadStop extends BaseEntity {
  loadId: string;
  stopType: StopType;
  address: string;
  city: string;
  postcode: string;
  country: string;
  lat: number | null;
  lng: number | null;
  dateFrom: string;
  dateTo: string | null;
  contactName: string | null;
  contactPhone: string | null;
  notes: string | null;
  orderIndex: number;
}

export interface LoadFreightDetails extends BaseEntity {
  loadId: string;
  weightTons: number | null;
  loadingMeters: number | null;
  volumeM3: number | null;
  palletCount: number | null;
  bodyType: BodyType | null;
  isStackable: boolean;
  isHazardous: boolean;
  adrClass: string | null;
  temperatureMin: number | null;
  temperatureMax: number | null;
  goodsDescription: string | null;
}

export interface LoadPallet extends BaseEntity {
  loadId: string;
  label: string | null;
  widthCm: number;
  heightCm: number;
  depthCm: number | null;
  weightKg: number | null;
  isStackable: boolean;
  quantity: number;
  orderIndex: number;
}
