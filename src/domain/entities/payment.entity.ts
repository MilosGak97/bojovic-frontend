import { BaseEntity } from './base.entity';
import { PaymentStatus, PaymentMethod, Currency } from '../enums';
import { Load } from './load.entity';
import { BrokerCompany } from './broker.entity';

export interface PaymentRecord extends BaseEntity {
  loadId: string;
  brokerId: string;
  status: PaymentStatus;
  method: PaymentMethod | null;
  invoiceNumber: string | null;
  amount: number;
  currency: Currency;
  vatRate: number | null;
  vatAmount: number | null;
  totalWithVat: number | null;
  issueDate: string | null;
  dueDate: string | null;
  paidDate: string | null;
  paymentTermDays: number | null;
  daysOverdue: number | null;
  notes: string | null;

  // Relations
  load?: Load;
  broker?: BrokerCompany;
}

export interface BrokerPaymentStats {
  totalLoads: number;
  onTimeCount: number;
  delayedCount: number;
  issuesCount: number;
  averagePaymentDays: number | null;
}
