import { BaseEntity } from './base.entity';
import {
  LoadStatus,
  StopType,
  BodyType,
  Currency,
  LoadBoardSource,
} from '../enums';
import { BrokerCompany, BrokerContact } from './broker.entity';
import type { Trip } from './trip.entity';
import type { Document } from './document.entity';

export interface Load extends BaseEntity {
  referenceNumber: string;
  transEuFreightNumber: string | null;
  status: LoadStatus;
  boardSource: LoadBoardSource;
  color: string | null;
  brokerageName: string | null;
  originTranseuLink: string | null;
  destTranseuLink: string | null;
  isInactive: boolean;

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
  invoitix: boolean;
  valutaCheck: boolean;
  margin: number | null;
  pricePerKm: number | null;

  // Freight
  distanceKm: number | null;
  contactPerson: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  vehicleMonitoringRequired: boolean;
  notes: string | null;
  brokerId: string | null;
  brokerContactId: string | null;
  tripId: string | null;

  // Relations
  broker?: BrokerCompany | null;
  brokerContact?: BrokerContact | null;
  trip?: Trip | null;
  stops?: LoadStop[];
  freightDetails?: LoadFreightDetails;
  pallets?: LoadPallet[];
  documents?: Document[];
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
  pallets: number | null;
  transeuLink: string | null;
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
