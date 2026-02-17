import { BaseEntity } from './base.entity';
import { DriverStatus } from '../enums';

export interface Driver extends BaseEntity {
  firstName: string;
  lastName: string;
  status: DriverStatus;
  phone: string | null;
  email: string | null;
  driverLicenseNumber: string | null;
  driverLicenseValidUntil: string | null;
  driverLicenseCategories: string[] | null;
  nationality: string | null;
  dateOfBirth: string | null;
  adrCertified: boolean;
  adrValidUntil: string | null;
  hiredAt: string | null;
  notes: string | null;
  isActive: boolean;
}
