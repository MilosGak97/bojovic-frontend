import { PaymentStatus, PaymentMethod, Currency } from '../enums';

export interface CreatePaymentRecordDto {
  loadId: string;
  brokerId: string;
  status?: PaymentStatus;
  method?: PaymentMethod;
  invoiceNumber?: string;
  amount: number;
  currency?: Currency;
  vatRate?: number;
  vatAmount?: number;
  totalWithVat?: number;
  issueDate?: string;
  dueDate?: string;
  paidDate?: string;
  paymentTermDays?: number;
  notes?: string;
}

export type UpdatePaymentRecordDto = Partial<CreatePaymentRecordDto>;
