import { BaseEntity } from './base.entity';
import { PaymentStatus, PaymentMethod, Currency } from '../enums';
import { Load } from './load.entity';
import { BrokerCompany } from './broker.entity';

export type PaymentFlowType = 'INVOITIX' | 'VALUTA';
export type InvoitixDecision = 'PENDING' | 'REJECTED' | 'APPROVED';
export type ValutaMode = 'VALUTA' | 'SKONTO';
export type ValutaCountdownStart = 'ORIGINALS_RECEIVED' | 'EMAIL_COPY_INVOICE';
export type ValutaInvoiceDispatch = 'EMAIL_WITH_CMR' | 'WAIT_AND_SHIP_ORIGINALS';

export interface PaymentWorkflow extends BaseEntity {
  paymentRecordId: string;
  manualNote: string | null;
  flowType: PaymentFlowType | null;

  invoitixSentAt: string | null;
  invoitixDecision: InvoitixDecision;
  invoitixRejectedAt: string | null;
  invoitixResubmittedAt: string | null;
  invoitixApprovedAt: string | null;
  invoitixPaidOutAt: string | null;
  invoitixPayoutReference: string | null;
  invoitixProjectedIncomeAddedAt: string | null;
  invoitixPayoutConfirmedAt: string | null;

  valutaMode: ValutaMode;
  valutaCountdownStart: ValutaCountdownStart | null;
  valutaCountdownDays: number | null;
  valutaSkontoPercent: number | null;
  valutaSentToAccountantAt: string | null;
  valutaInvoiceDispatch: ValutaInvoiceDispatch | null;
  valutaInvoiceSentAt: string | null;
  valutaShippedAt: string | null;
  valutaTrackingNumber: string | null;
  valutaDocumentsArrivedAt: string | null;
  valutaProjectedPayoutDate: string | null;
  valutaPayoutReceivedAt: string | null;
  valutaBankFeeAmount: number | null;
}

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
  workflow?: PaymentWorkflow | null;

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
