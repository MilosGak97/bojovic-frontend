import { BaseEntity } from './base.entity';
import { VanStatus, VanType, Currency } from '../enums';
import type { Driver } from './driver.entity';

export interface Van extends BaseEntity {
  name: string;
  licensePlate: string;
  status: VanStatus;
  vehicleType: VanType;

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
  monthlyLeasingCost: number | null;
  monthlyInsuranceCost: number | null;
  costCurrency: Currency | null;
  notes: string | null;
  assignedDriverId: string | null;
  assignedDriver?: Driver | null;
}
