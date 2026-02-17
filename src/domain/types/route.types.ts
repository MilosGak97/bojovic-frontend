import { CanvasStop, CanvasLoad } from './canvas.types';

export interface RouteStats {
  totalKm: number;
  totalTime: string;
  estimatedFuel: number;
  fuelCost: number;
  totalRevenue: number;
  pricePerKm: number;
  estimatedMargin: number;
  stopCount: number;
}

export interface SimulationImpact {
  kmDelta: number;
  timeDelta: string;
  warnings: string[];
}

export interface RouteVariant {
  id: string;
  name: string;
  savedAt: string;
  stops: CanvasStop[];
  loadedCargoIds: string[];
  selectedVan: string;
  loads: CanvasLoad[];
}

export type RouteMode = 'active' | 'simulation';
