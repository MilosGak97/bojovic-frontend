import { BaseEntity } from './base.entity';
import { RouteStatus, StopType, RouteStopStatus } from '../enums';
import { Van } from './van.entity';
import { Load } from './load.entity';

export interface RoutePlan extends BaseEntity {
  name: string | null;
  status: RouteStatus;
  vanId: string | null;
  departureDate: string | null;
  arrivalDate: string | null;

  // Computed totals (cached)
  totalDistanceKm: number | null;
  totalTimeMinutes: number | null;
  estimatedFuelLiters: number | null;
  fuelCost: number | null;
  totalRevenue: number | null;
  estimatedMargin: number | null;
  pricePerKm: number | null;
  notes: string | null;

  // Relations
  van?: Van | null;
  stops?: RouteStop[];
}

export interface RouteStop extends BaseEntity {
  routePlanId: string;
  loadId: string;
  stopType: StopType;
  status: RouteStopStatus;
  orderIndex: number;
  groupId: string | null;

  // Location
  address: string;
  city: string;
  postcode: string;
  country: string;
  lat: number | null;
  lng: number | null;

  // Timing
  eta: string | null;
  etd: string | null;
  actualArrival: string | null;
  actualDeparture: string | null;
  timeWindowFrom: string | null;
  timeWindowTo: string | null;
  timeWindowViolation: boolean;

  // Distance
  distanceToNextKm: number | null;
  drivingTimeToNextMinutes: number | null;

  // Cargo
  pallets: number | null;
  weightKg: number | null;
  notes: string | null;

  // Relations
  load?: Load;
}

export interface RouteSimulation extends BaseEntity {
  sourceRouteId: string;
  simulatedRouteId: string;
  name: string | null;

  // Deltas
  deltaDistanceKm: number | null;
  deltaTimeMinutes: number | null;
  deltaFuelLiters: number | null;
  deltaMargin: number | null;
  warnings: string[] | null;

  isApplied: boolean;
  appliedAt: string | null;

  // Relations
  sourceRoute?: RoutePlan;
  simulatedRoute?: RoutePlan;
}

export interface CargoPlacement extends BaseEntity {
  routePlanId: string;
  loadId: string;
  palletId: string | null;
  label: string | null;

  // Position in cargo area (cm)
  xCm: number;
  yCm: number;
  widthCm: number;
  heightCm: number;
  rotated: boolean;
  hasConflict: boolean;
  isOverflow: boolean;
}
