import { VanStatus, VanType, Currency } from '../enums';

export interface CreateVanDto {
  name: string;
  licensePlate: string;
  status?: VanStatus;
  vehicleType?: VanType;
  maxWeightKg: number;
  cargoLengthCm: number;
  cargoWidthCm: number;
  cargoHeightCm: number;
  maxLoadingMeters?: number;
  maxPallets?: number;
  make?: string;
  model?: string;
  year?: number;
  fuelConsumptionPer100km?: number;
  odometerKm?: number;
  nextServiceDate?: string;
  insuranceValidUntil?: string;
  technicalInspectionUntil?: string;
  monthlyLeasingCost?: number;
  monthlyInsuranceCost?: number;
  costCurrency?: Currency;
  notes?: string;
}

export type UpdateVanDto = Partial<CreateVanDto>;
