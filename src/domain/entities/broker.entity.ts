import { BaseEntity } from './base.entity';
import { BrokerRiskLevel, ContactRole } from '../enums';

export interface BrokerCompany extends BaseEntity {
  companyName: string;
  legalName: string | null;
  taxId: string | null;
  vatId: string | null;
  street: string;
  city: string;
  postcode: string;
  country: string;
  employeeCount: number | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  transEuId: string | null;
  transEuPaidOnTime: number | null;
  transEuPaidWithDelay: number | null;
  transEuPaymentIssues: number | null;
  transEuRating: string | null;
  transEuReviewCount: number | null;
  insuranceCoverage: number | null;
  insuranceProvider: string | null;
  insuranceValidUntil: string | null;
  licenseNumber: string | null;
  licenseValidUntil: string | null;
  platformMemberSince: string | null;
  notes: string | null;
  isActive: boolean;

  // Relations
  contacts?: BrokerContact[];
  trustProfile?: BrokerTrustProfile;
}

export interface BrokerContact extends BaseEntity {
  companyId: string;
  firstName: string;
  lastName: string;
  role: ContactRole;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  isPrimary: boolean;
  notes: string | null;
}

export interface BrokerTrustProfile extends BaseEntity {
  companyId: string;
  riskLevel: BrokerRiskLevel;
  transRiskScore: number | null;
  totalLoads: number;
  onTimeCount: number;
  delayedCount: number;
  issuesCount: number;
  averagePaymentDays: number | null;
  paymentCredibility: string | null;
  lastEvaluatedAt: string | null;
  notes: string | null;
}
