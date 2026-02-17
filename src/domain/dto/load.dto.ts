import { LoadStatus, Currency, BodyType, StopType } from '../enums';

export interface CreateLoadStopDto {
  stopType: StopType;
  address: string;
  city: string;
  postcode: string;
  country: string;
  lat?: number;
  lng?: number;
  dateFrom: string;
  dateTo?: string;
  contactName?: string;
  contactPhone?: string;
  notes?: string;
  orderIndex?: number;
}

export interface CreateLoadFreightDto {
  weightTons?: number;
  loadingMeters?: number;
  volumeM3?: number;
  palletCount?: number;
  bodyType?: BodyType;
  isStackable?: boolean;
  isHazardous?: boolean;
  adrClass?: string;
  temperatureMin?: number;
  temperatureMax?: number;
  goodsDescription?: string;
}

export interface CreateLoadPalletDto {
  label?: string;
  widthCm: number;
  heightCm: number;
  depthCm?: number;
  weightKg?: number;
  isStackable?: boolean;
  quantity?: number;
}

export interface CreateLoadDto {
  referenceNumber: string;
  externalId?: string;
  status?: LoadStatus;
  color?: string;

  pickupAddress: string;
  pickupCity: string;
  pickupPostcode: string;
  pickupCountry: string;
  pickupDateFrom: string;
  pickupDateTo?: string;

  deliveryAddress: string;
  deliveryCity: string;
  deliveryPostcode: string;
  deliveryCountry: string;
  deliveryDateFrom: string;
  deliveryDateTo?: string;

  publishedPrice?: number;
  agreedPrice?: number;
  currency?: Currency;
  paymentTermDays?: number;
  distanceKm?: number;
  contactPerson?: string;
  contactPhone?: string;
  vehicleMonitoringRequired?: boolean;
  brokerId?: string;
  notes?: string;

  freightDetails?: CreateLoadFreightDto;
  pallets?: CreateLoadPalletDto[];
  stops?: CreateLoadStopDto[];
}

export type UpdateLoadDto = Partial<CreateLoadDto>;
