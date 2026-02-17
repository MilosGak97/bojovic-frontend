import { DriverStatus } from '../enums';

export interface CreateDriverDto {
  firstName: string;
  lastName: string;
  status?: DriverStatus;
  phone?: string;
  email?: string;
  driverLicenseNumber?: string;
  driverLicenseValidUntil?: string;
  driverLicenseCategories?: string[];
  nationality?: string;
  dateOfBirth?: string;
  adrCertified?: boolean;
  adrValidUntil?: string;
  hiredAt?: string;
  notes?: string;
}

export type UpdateDriverDto = Partial<CreateDriverDto>;
