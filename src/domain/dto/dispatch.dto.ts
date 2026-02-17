import { DispatchStatus } from '../enums';

export interface CreateDispatchAssignmentDto {
  vanId: string;
  driverId: string;
  routePlanId: string;
  status?: DispatchStatus;
  assignedDate: string;
  notes?: string;
}

export type UpdateDispatchAssignmentDto = Partial<CreateDispatchAssignmentDto>;
