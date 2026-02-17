import { LoadStatus, StopType } from '../enums';

/**
 * Canvas-specific types that extend domain entities with UI positioning.
 * These are used by the dispatch board canvas and are NOT sent to the backend.
 */

export interface CanvasPosition {
  x: number;
  y: number;
}

export interface CanvasLoad extends CanvasPosition {
  id: string;
  brokerage: string;
  originCity: string;
  destCity: string;
  pickupDate: string;
  deliveryDate: string;
  pallets: number;
  ldm: number;
  weight: number;
  price: number;
  distance: number;
  color: string;
  status: LoadStatus;
  originAddress?: string;
  destAddress?: string;
  contactPerson?: string;
  phone?: string;
  paymentTerms?: string;
}

export interface CanvasStop extends CanvasPosition {
  id: string;
  number: number;
  type: StopType;
  city: string;
  postcode: string;
  eta: string;
  distanceToNext: number;
  drivingTime: string;
  timeWindowViolation: boolean;
  color: string;
  loadId: string;
  pallets: number;
  weight: number;
  groupId?: string;
  isSimulation?: boolean;
  kmDelta?: number;
  timeDeltaMinutes?: number;
  isPending?: boolean;
}

export interface CanvasRouteSummary extends CanvasPosition {
  id: string;
  totalKm: number;
  totalTime: string;
  oldRouteKm: number;
  estimatedFuel: number;
  estimatedMargin: number;
}

export interface CanvasCargoItem {
  id: string;
  loadId: string;
  width: number;
  height: number;
  color: string;
  x: number;
  y: number;
  rotated: boolean;
  label: string;
  hasConflict: boolean;
  isOverflow: boolean;
  stopId?: string;
}
