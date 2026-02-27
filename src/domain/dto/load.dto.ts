import {
  LoadStatus,
  Currency,
  BodyType,
  StopType,
  LoadBoardSource,
} from '../enums';

export interface CreateLoadStopDto {
  id?: string;
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
  pallets?: number;
  transeuLink?: string;
  orderIndex?: number;
}

export interface CreateLoadFreightDto {
  weightTons?: number;
  loadingMeters?: number;
  volumeM3?: number;
  palletCount?: number;
  bodyType?: BodyType;
  bodyTypeText?: string;
  bodySize?: string;
  freightMode?: string;
  isStackable?: boolean;
  isHazardous?: boolean;
  adrClass?: string;
  temperatureMin?: number;
  temperatureMax?: number;
  goodsDescription?: string;
}

export interface CreateLoadPalletDto {
  id?: string;
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
  transEuFreightNumber?: string;
  status?: LoadStatus;
  boardSource?: LoadBoardSource;
  color?: string;
  brokerageName?: string;
  originTranseuLink?: string;
  destTranseuLink?: string;
  isInactive?: boolean;

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
  invoitix?: boolean;
  valutaCheck?: boolean;
  distanceKm?: number;
  contactPerson?: string;
  contactPhone?: string;
  contactEmail?: string;
  vehicleMonitoringRequired?: boolean;
  brokerId?: string;
  brokerContactId?: string;
  tripId?: string;
  notes?: string;

  freightDetails?: CreateLoadFreightDto;
  pallets?: CreateLoadPalletDto[];
  stops?: CreateLoadStopDto[];
}

export type UpdateLoadDto = Partial<CreateLoadDto>;
