import { RouteStatus, StopType } from '../enums';

export interface CreateRouteStopDto {
  loadId: string;
  stopType: StopType;
  orderIndex: number;
  groupId?: string;
  address: string;
  city: string;
  postcode: string;
  country: string;
  lat?: number;
  lng?: number;
  eta?: string;
  timeWindowFrom?: string;
  timeWindowTo?: string;
  distanceToNextKm?: number;
  drivingTimeToNextMinutes?: number;
  pallets?: number;
  weightKg?: number;
  notes?: string;
}

export interface CreateRoutePlanDto {
  name?: string;
  status?: RouteStatus;
  vanId?: string;
  departureDate?: string;
  stops?: CreateRouteStopDto[];
  notes?: string;
}

export type UpdateRoutePlanDto = Partial<CreateRoutePlanDto>;
