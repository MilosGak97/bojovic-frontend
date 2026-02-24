import { BaseEntity } from './base.entity';
import { TripStatus } from '../enums';
import type { Driver } from './driver.entity';
import type { Van } from './van.entity';
import type { Load } from './load.entity';

export interface Trip extends BaseEntity {
  driverId: string;
  vanId: string;
  status: TripStatus;
  departureDate: string;
  returnDate: string | null;
  startOdometerKm: number | null;
  endOdometerKm: number | null;
  notes: string | null;

  driver?: Driver;
  van?: Van;
  loads?: Load[];
}
