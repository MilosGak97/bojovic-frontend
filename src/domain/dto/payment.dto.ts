import { PaymentStatus, PaymentMethod, Currency } from '../enums';
import type {
  PaymentFlowType,
  InvoitixDecision,
  ValutaMode,
  ValutaCountdownStart,
  ValutaInvoiceDispatch,
} from '../entities/payment.entity';

export interface CreatePaymentWorkflowDto {
  manualNote?: string;
  flowType?: PaymentFlowType;

  invoitixSentAt?: string;
  invoitixDecision?: InvoitixDecision;
  invoitixRejectedAt?: string;
  invoitixResubmittedAt?: string;
  invoitixApprovedAt?: string;
  invoitixPaidOutAt?: string;
  invoitixPayoutReference?: string;
  invoitixProjectedIncomeAddedAt?: string;
  invoitixPayoutConfirmedAt?: string;

  valutaMode?: ValutaMode;
  valutaCountdownStart?: ValutaCountdownStart;
  valutaCountdownDays?: number;
  valutaSkontoPercent?: number;
  valutaSentToAccountantAt?: string;
  valutaInvoiceDispatch?: ValutaInvoiceDispatch;
  valutaInvoiceSentAt?: string;
  valutaShippedAt?: string;
  valutaTrackingNumber?: string;
  valutaDocumentsArrivedAt?: string;
  valutaProjectedPayoutDate?: string;
  valutaPayoutReceivedAt?: string;
  valutaBankFeeAmount?: number;
}

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
  workflow?: CreatePaymentWorkflowDto;
}

export type UpdatePaymentRecordDto = Partial<CreatePaymentRecordDto>;
