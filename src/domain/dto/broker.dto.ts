import { ContactRole } from '../enums';

export interface CreateBrokerCompanyDto {
  companyName: string;
  legalName?: string;
  taxId?: string;
  vatId?: string;
  street: string;
  city: string;
  postcode: string;
  country: string;
  employeeCount?: number;
  phone?: string;
  email?: string;
  website?: string;
  transEuId?: string;
  transEuPaidOnTime?: number;
  transEuPaidWithDelay?: number;
  transEuPaymentIssues?: number;
  transEuRating?: string;
  transEuReviewCount?: number;
  insuranceCoverage?: number;
  insuranceProvider?: string;
  insuranceValidUntil?: string;
  licenseNumber?: string;
  licenseValidUntil?: string;
  platformMemberSince?: string;
  notes?: string;
  isActive?: boolean;
}

export type UpdateBrokerCompanyDto = Partial<CreateBrokerCompanyDto>;

export interface CreateBrokerContactDto {
  companyId: string;
  firstName: string;
  lastName: string;
  role?: ContactRole;
  email?: string;
  phone?: string;
  mobile?: string;
  isPrimary?: boolean;
  notes?: string;
}
