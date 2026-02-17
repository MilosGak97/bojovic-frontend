import { BaseEntity } from './base.entity';
import { VanStatus } from '../enums';

export interface Van extends BaseEntity {
  name: string;
  licensePlate: string;
  status: VanStatus;

  // Capacity
  maxWeightKg: number;
  cargoLengthCm: number;
  cargoWidthCm: number;
  cargoHeightCm: number;
  maxLoadingMeters: number | null;
  maxPallets: number | null;

  // Vehicle info
  make: string | null;
  model: string | null;
  year: number | null;
  fuelConsumptionPer100km: number | null;
  odometerKm: number | null;
  nextServiceDate: string | null;
  insuranceValidUntil: string | null;
  technicalInspectionUntil: string | null;
  notes: string | null;
}
