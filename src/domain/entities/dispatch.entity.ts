import { BaseEntity } from './base.entity';
import { DispatchStatus } from '../enums';
import { Van } from './van.entity';
import { Driver } from './driver.entity';
import { RoutePlan } from './route.entity';

export interface DispatchAssignment extends BaseEntity {
  vanId: string;
  driverId: string;
  routePlanId: string;
  status: DispatchStatus;
  assignedDate: string;
  startedAt: string | null;
  completedAt: string | null;
  notes: string | null;

  // Relations
  van?: Van;
  driver?: Driver;
  routePlan?: RoutePlan;
}
