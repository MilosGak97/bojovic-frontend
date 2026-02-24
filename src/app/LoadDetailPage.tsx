import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { RefreshCw } from 'lucide-react';
import { brokerApi, brokerContactApi, documentApi, loadApi, paymentApi } from '../api';
import type {
  BrokerCompany,
  BrokerContact,
  Document,
  Load,
  PaymentRecord,
  PaymentWorkflow as PaymentWorkflowEntity,
} from '../domain/entities';
import type { CreatePaymentWorkflowDto } from '../domain/dto';
import {
  ContactRole,
  DocumentCategory,
  DocumentType,
  LoadStatus,
  PaymentStatus,
} from '../domain/enums';
import { ThinModuleMenu } from './components/ThinModuleMenu';
import { DateTimePicker } from './components/DateTimePicker';

type LoadDetailSection =
  | 'overview'
  | 'broker'
  | 'statuses'
  | 'activity'
  | 'payments'
  | 'documents'
  | 'stops'
  | 'freight'
  | 'contacts';

type ActivityKind = 'LOAD' | 'STOP' | 'PAYMENT' | 'DOCUMENT';
type ActivityFilter = 'ALL' | ActivityKind;

type ActivityEvent = {
  id: string;
  date: string;
  kind: ActivityKind;
  title: string;
  detail: string;
  isUpcoming: boolean;
};

type PaymentFlowType = 'INVOITIX' | 'VALUTA';
type ValutaMode = 'VALUTA' | 'SKONTO';
type ValutaCountdownStart = 'ORIGINALS_RECEIVED' | 'EMAIL_COPY_INVOICE';
type ValutaInvoiceDispatch = 'EMAIL_WITH_CMR' | 'WAIT_AND_SHIP_ORIGINALS';
type InvoitixDecision = 'PENDING' | 'REJECTED' | 'APPROVED';

type PaymentWorkflowData = {
  flowType: PaymentFlowType | null;
  invoitix: {
    sentAt: string | null;
    decision: InvoitixDecision;
    rejectedAt: string | null;
    resubmittedAt: string | null;
    approvedAt: string | null;
    paidOutAt: string | null;
    payoutReference: string;
    projectedIncomeAddedAt: string | null;
    payoutConfirmedAt: string | null;
  };
  valuta: {
    mode: ValutaMode;
    countdownStart: ValutaCountdownStart | null;
    countdownDays: string;
    skontoPercent: string;
    sentToAccountantAt: string | null;
    invoiceDispatch: ValutaInvoiceDispatch | null;
    invoiceSentAt: string | null;
    shippedAt: string | null;
    trackingNumber: string;
    documentsArrivedAt: string | null;
    payoutReceivedAt: string | null;
    bankFeeAmount: string;
  };
};

type PaymentNotesPayload = {
  kind: 'LOAD_PAYMENT_WORKFLOW_V1';
  manualNote: string;
  workflow: PaymentWorkflowData;
};

type BrokerMainDraft = {
  companyName: string;
  employeeCount: string;
  phone: string;
  email: string;
  website: string;
  street: string;
  postcode: string;
  city: string;
  country: string;
};

type BrokerTransEuDraft = {
  transEuId: string;
  transEuRating: string;
  transEuReviewCount: string;
  transEuPaidOnTime: string;
  transEuPaidWithDelay: string;
  transEuPaymentIssues: string;
};

type BrokerOtherDraft = {
  legalName: string;
  taxId: string;
  vatId: string;
  insuranceCoverage: string;
  insuranceProvider: string;
  insuranceValidUntil: string;
  licenseNumber: string;
  licenseValidUntil: string;
  platformMemberSince: string;
  isActive: boolean;
  notes: string;
};

type BrokerEditModalSection = 'main' | 'transEu' | 'other';

const SECTION_ITEMS: Array<{ id: LoadDetailSection; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'broker', label: 'Broker' },
  { id: 'statuses', label: 'Statuses' },
  { id: 'activity', label: 'Activity' },
  { id: 'payments', label: 'Payments' },
  { id: 'documents', label: 'Documents' },
  { id: 'stops', label: 'Stops' },
  { id: 'freight', label: 'Freight' },
  { id: 'contacts', label: 'Contacts' },
];

const CONTACT_ROLE_OPTIONS: ContactRole[] = [
  ContactRole.DISPATCHER,
  ContactRole.MANAGER,
  ContactRole.ACCOUNTING,
  ContactRole.DRIVER_COORDINATOR,
  ContactRole.OTHER,
];

const ACTIVITY_FILTER_ITEMS: Array<{ id: ActivityFilter; label: string }> = [
  { id: 'ALL', label: 'All' },
  { id: 'LOAD', label: 'Load' },
  { id: 'PAYMENT', label: 'Payment' },
  { id: 'DOCUMENT', label: 'Document' },
  { id: 'STOP', label: 'Stop' },
];

const LOAD_STATUS_PROGRESS_PATH: LoadStatus[] = [
  LoadStatus.ON_BOARD,
  LoadStatus.NEGOTIATING,
  LoadStatus.TAKEN,
  LoadStatus.IN_TRANSIT,
  LoadStatus.DELIVERED,
];

const DEFAULT_PAYMENT_WORKFLOW: PaymentWorkflowData = {
  flowType: null,
  invoitix: {
    sentAt: null,
    decision: 'PENDING',
    rejectedAt: null,
    resubmittedAt: null,
    approvedAt: null,
    paidOutAt: null,
    payoutReference: '',
    projectedIncomeAddedAt: null,
    payoutConfirmedAt: null,
  },
  valuta: {
    mode: 'VALUTA',
    countdownStart: null,
    countdownDays: '',
    skontoPercent: '',
    sentToAccountantAt: null,
    invoiceDispatch: null,
    invoiceSentAt: null,
    shippedAt: null,
    trackingNumber: '',
    documentsArrivedAt: null,
    payoutReceivedAt: null,
    bankFeeAmount: '',
  },
};

const toNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const moneyFormatter = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatMoney = (value: number): string => moneyFormatter.format(toNumber(value));

const toDateOnly = (value?: string | null): string => {
  if (!value) return '';
  const direct = value.match(/^(\d{4}-\d{2}-\d{2})/);
  if (direct) return direct[1];
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
};

const formatDate = (value?: string | null): string => {
  const dateOnly = toDateOnly(value);
  if (!dateOnly) return '—';
  const parsed = new Date(`${dateOnly}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateOnly;
  return parsed.toLocaleDateString('en-GB');
};

const formatBrokerRating = (value?: string | null): string => {
  if (!value) return '—';
  const normalized = value.replace(',', '.').trim();
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return value;
  return Number.isInteger(parsed) ? String(parsed) : parsed.toFixed(1);
};

const nullableString = (value: string): string | null => {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const toOptionalIntegerString = (value: string, label: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${label} must be a non-negative number.`);
  }
  return Math.trunc(parsed);
};

const toOptionalDecimalString = (value: string, label: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${label} must be a non-negative number.`);
  }
  return Math.round(parsed * 100) / 100;
};

const getTodayDateInput = (): string => new Date().toISOString().slice(0, 10);

const normalizeNullableDate = (value?: string | null): string | null => {
  const normalized = toDateOnly(value);
  return normalized || null;
};

const addDaysToDateInput = (value: string, days: number): string => {
  const normalized = toDateOnly(value);
  if (!normalized) return '';
  const parsed = new Date(`${normalized}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return '';
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
};

const getDaysUntilDateInput = (value?: string | null): number | null => {
  const normalized = toDateOnly(value);
  if (!normalized) return null;
  const target = new Date(`${normalized}T00:00:00Z`);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date(`${getTodayDateInput()}T00:00:00Z`);
  const diffMs = target.getTime() - today.getTime();
  return Math.ceil(diffMs / (24 * 60 * 60 * 1000));
};

const mergeWorkflowData = (
  base: PaymentWorkflowData,
  incoming?: Partial<PaymentWorkflowData> | null,
): PaymentWorkflowData => {
  if (!incoming) {
    return {
      ...base,
      invoitix: { ...base.invoitix },
      valuta: { ...base.valuta },
    };
  }
  return {
    ...base,
    ...incoming,
    invoitix: {
      ...base.invoitix,
      ...(incoming.invoitix ?? {}),
    },
    valuta: {
      ...base.valuta,
      ...(incoming.valuta ?? {}),
    },
  };
};

const mapEntityWorkflowToUi = (
  workflow?: PaymentWorkflowEntity | null,
): PaymentWorkflowData | null => {
  if (!workflow) return null;

  return {
    flowType: workflow.flowType,
    invoitix: {
      sentAt: toDateOnly(workflow.invoitixSentAt) || null,
      decision: workflow.invoitixDecision ?? 'PENDING',
      rejectedAt: toDateOnly(workflow.invoitixRejectedAt) || null,
      resubmittedAt: toDateOnly(workflow.invoitixResubmittedAt) || null,
      approvedAt: toDateOnly(workflow.invoitixApprovedAt) || null,
      paidOutAt: toDateOnly(workflow.invoitixPaidOutAt) || null,
      payoutReference: workflow.invoitixPayoutReference ?? '',
      projectedIncomeAddedAt:
        toDateOnly(workflow.invoitixProjectedIncomeAddedAt) || null,
      payoutConfirmedAt:
        toDateOnly(workflow.invoitixPayoutConfirmedAt) || null,
    },
    valuta: {
      mode: workflow.valutaMode ?? 'VALUTA',
      countdownStart: workflow.valutaCountdownStart ?? null,
      countdownDays:
        workflow.valutaCountdownDays === null ||
        workflow.valutaCountdownDays === undefined
          ? ''
          : String(workflow.valutaCountdownDays),
      skontoPercent:
        workflow.valutaSkontoPercent === null ||
        workflow.valutaSkontoPercent === undefined
          ? ''
          : String(workflow.valutaSkontoPercent),
      sentToAccountantAt:
        toDateOnly(workflow.valutaSentToAccountantAt) || null,
      invoiceDispatch: workflow.valutaInvoiceDispatch ?? null,
      invoiceSentAt: toDateOnly(workflow.valutaInvoiceSentAt) || null,
      shippedAt: toDateOnly(workflow.valutaShippedAt) || null,
      trackingNumber: workflow.valutaTrackingNumber ?? '',
      documentsArrivedAt:
        toDateOnly(workflow.valutaDocumentsArrivedAt) || null,
      payoutReceivedAt: toDateOnly(workflow.valutaPayoutReceivedAt) || null,
      bankFeeAmount:
        workflow.valutaBankFeeAmount === null ||
        workflow.valutaBankFeeAmount === undefined
          ? ''
          : String(workflow.valutaBankFeeAmount),
    },
  };
};

const mapUiWorkflowToDto = (
  workflow: PaymentWorkflowData,
  manualNote: string,
): CreatePaymentWorkflowDto => {
  const countdownDays = Number(workflow.valuta.countdownDays);
  const parsedCountdownDays =
    Number.isFinite(countdownDays) && countdownDays >= 0
      ? Math.trunc(countdownDays)
      : undefined;

  const skontoPercent = Number(workflow.valuta.skontoPercent);
  const parsedSkontoPercent =
    Number.isFinite(skontoPercent) && skontoPercent >= 0
      ? Math.round(skontoPercent * 100) / 100
      : undefined;

  const bankFeeAmount = Number(workflow.valuta.bankFeeAmount);
  const parsedBankFeeAmount =
    Number.isFinite(bankFeeAmount) && bankFeeAmount >= 0
      ? Math.round(bankFeeAmount * 100) / 100
      : undefined;

  const countdownStartDate =
    workflow.valuta.countdownStart === 'ORIGINALS_RECEIVED'
      ? workflow.valuta.documentsArrivedAt
      : workflow.valuta.countdownStart === 'EMAIL_COPY_INVOICE'
        ? workflow.valuta.invoiceSentAt
        : null;
  const projectedPayoutDate =
    parsedCountdownDays !== undefined && countdownStartDate
      ? addDaysToDateInput(countdownStartDate, parsedCountdownDays) || undefined
      : undefined;

  return {
    manualNote,
    flowType: workflow.flowType ?? undefined,

    invoitixSentAt: workflow.invoitix.sentAt ?? undefined,
    invoitixDecision: workflow.invoitix.decision,
    invoitixRejectedAt: workflow.invoitix.rejectedAt ?? undefined,
    invoitixResubmittedAt: workflow.invoitix.resubmittedAt ?? undefined,
    invoitixApprovedAt: workflow.invoitix.approvedAt ?? undefined,
    invoitixPaidOutAt: workflow.invoitix.paidOutAt ?? undefined,
    invoitixPayoutReference:
      workflow.invoitix.payoutReference.trim() || undefined,
    invoitixProjectedIncomeAddedAt:
      workflow.invoitix.projectedIncomeAddedAt ?? undefined,
    invoitixPayoutConfirmedAt:
      workflow.invoitix.payoutConfirmedAt ?? undefined,

    valutaMode: workflow.valuta.mode,
    valutaCountdownStart: workflow.valuta.countdownStart ?? undefined,
    valutaCountdownDays: parsedCountdownDays,
    valutaSkontoPercent: parsedSkontoPercent,
    valutaSentToAccountantAt:
      workflow.valuta.sentToAccountantAt ?? undefined,
    valutaInvoiceDispatch: workflow.valuta.invoiceDispatch ?? undefined,
    valutaInvoiceSentAt: workflow.valuta.invoiceSentAt ?? undefined,
    valutaShippedAt: workflow.valuta.shippedAt ?? undefined,
    valutaTrackingNumber: workflow.valuta.trackingNumber.trim() || undefined,
    valutaDocumentsArrivedAt:
      workflow.valuta.documentsArrivedAt ?? undefined,
    valutaProjectedPayoutDate: projectedPayoutDate,
    valutaPayoutReceivedAt: workflow.valuta.payoutReceivedAt ?? undefined,
    valutaBankFeeAmount: parsedBankFeeAmount,
  };
};

const parsePaymentNotesPayload = (
  notes?: string | null,
): { manualNote: string; workflow: PaymentWorkflowData } => {
  if (!notes) {
    return {
      manualNote: '',
      workflow: { ...DEFAULT_PAYMENT_WORKFLOW },
    };
  }

  try {
    const parsed = JSON.parse(notes) as Partial<PaymentNotesPayload>;
    if (parsed.kind === 'LOAD_PAYMENT_WORKFLOW_V1' && parsed.workflow) {
      return {
        manualNote: typeof parsed.manualNote === 'string' ? parsed.manualNote : '',
        workflow: mergeWorkflowData(DEFAULT_PAYMENT_WORKFLOW, parsed.workflow),
      };
    }
  } catch {
    // Keep backward compatibility with plain text notes.
  }

  return {
    manualNote: notes,
    workflow: { ...DEFAULT_PAYMENT_WORKFLOW },
  };
};

const isDetailSection = (value: string | null): value is LoadDetailSection =>
  value !== null && SECTION_ITEMS.some((section) => section.id === value);

const getLoadStatusLabel = (status: LoadStatus): string =>
  status === LoadStatus.DELIVERED ? 'COMPLETED' : status.replaceAll('_', ' ');

const getValutaModeLabel = (mode: ValutaMode): string => (mode === 'SKONTO' ? 'Skonto' : 'Valuta');

const getCountdownStartLabel = (countdownStart: ValutaCountdownStart | null): string => {
  if (countdownStart === 'ORIGINALS_RECEIVED') return 'Originals';
  if (countdownStart === 'EMAIL_COPY_INVOICE') return 'Email';
  return '—';
};

const getActivityKindClass = (kind: ActivityKind): string => {
  switch (kind) {
    case 'LOAD':
      return 'bg-slate-100 text-slate-800';
    case 'STOP':
      return 'bg-blue-100 text-blue-800';
    case 'PAYMENT':
      return 'bg-emerald-100 text-emerald-800';
    case 'DOCUMENT':
      return 'bg-amber-100 text-amber-800';
    default:
      return 'bg-gray-100 text-gray-700';
  }
};

export default function LoadDetailPage() {
  const { loadId = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedSection = searchParams.get('section');

  const [activeSection, setActiveSection] = useState<LoadDetailSection>(
    isDetailSection(requestedSection) ? requestedSection : 'overview',
  );
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('ALL');

  const [load, setLoad] = useState<Load | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);

  const [paymentManualNote, setPaymentManualNote] = useState('');
  const [paymentWorkflow, setPaymentWorkflow] = useState<PaymentWorkflowData>(
    mergeWorkflowData(DEFAULT_PAYMENT_WORKFLOW),
  );
  const [isFlowModalOpen, setIsFlowModalOpen] = useState(false);
  const [flowDraft, setFlowDraft] = useState<PaymentWorkflowData>(
    mergeWorkflowData(DEFAULT_PAYMENT_WORKFLOW),
  );

  const [brokerSearch, setBrokerSearch] = useState('');
  const [brokers, setBrokers] = useState<BrokerCompany[]>([]);
  const [isBrokersLoading, setIsBrokersLoading] = useState(false);
  const [selectedBrokerId, setSelectedBrokerId] = useState('');
  const [brokerContacts, setBrokerContacts] = useState<BrokerContact[]>([]);
  const [isBrokerContactsLoading, setIsBrokerContactsLoading] = useState(false);
  const [selectedBrokerContactId, setSelectedBrokerContactId] = useState('');
  const [isAssigningBroker, setIsAssigningBroker] = useState(false);
  const [isAssigningBrokerContact, setIsAssigningBrokerContact] = useState(false);
  const [isCreatingBrokerContact, setIsCreatingBrokerContact] = useState(false);
  const [brokerContactSearch, setBrokerContactSearch] = useState('');
  const [isBrokerContactCreateOpen, setIsBrokerContactCreateOpen] = useState(false);
  const [isNewBrokerContactFormOpen, setIsNewBrokerContactFormOpen] = useState(false);
  const [isChangeBrokerModalOpen, setIsChangeBrokerModalOpen] = useState(false);
  const [brokerEditModal, setBrokerEditModal] = useState<BrokerEditModalSection | null>(null);
  const [isSavingBrokerSection, setIsSavingBrokerSection] = useState<
    null | 'main' | 'transEu' | 'other'
  >(null);
  const [brokerMainDraft, setBrokerMainDraft] = useState<BrokerMainDraft>({
    companyName: '',
    employeeCount: '',
    phone: '',
    email: '',
    website: '',
    street: '',
    postcode: '',
    city: '',
    country: '',
  });
  const [brokerTransEuDraft, setBrokerTransEuDraft] = useState<BrokerTransEuDraft>({
    transEuId: '',
    transEuRating: '',
    transEuReviewCount: '',
    transEuPaidOnTime: '',
    transEuPaidWithDelay: '',
    transEuPaymentIssues: '',
  });
  const [brokerOtherDraft, setBrokerOtherDraft] = useState<BrokerOtherDraft>({
    legalName: '',
    taxId: '',
    vatId: '',
    insuranceCoverage: '',
    insuranceProvider: '',
    insuranceValidUntil: '',
    licenseNumber: '',
    licenseValidUntil: '',
    platformMemberSince: '',
    isActive: true,
    notes: '',
  });
  const [newContactForm, setNewContactForm] = useState({
    firstName: '',
    lastName: '',
    role: ContactRole.DISPATCHER,
    email: '',
    phone: '',
    mobile: '',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isSavingPaymentDetails, setIsSavingPaymentDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isDetailSection(requestedSection)) return;
    setActiveSection(requestedSection);
  }, [requestedSection]);

  const setSection = (section: LoadDetailSection) => {
    setActiveSection(section);
    const next = new URLSearchParams(searchParams);
    if (section === 'overview') next.delete('section');
    else next.set('section', section);
    setSearchParams(next, { replace: true });
  };

  const loadData = useCallback(async () => {
    if (!loadId) return;
    setIsLoading(true);
    setError(null);

    try {
      const [nextLoad, nextPayments, nextDocuments] = await Promise.all([
        loadApi.getOne(loadId),
        paymentApi.getByLoad(loadId),
        documentApi.getByEntity(DocumentCategory.LOAD, loadId),
      ]);

      setLoad(nextLoad);
      setPayments(nextPayments);
      setDocuments(nextDocuments);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to load load detail.');
      setLoad(null);
      setPayments([]);
      setDocuments([]);
    } finally {
      setIsLoading(false);
    }
  }, [loadId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const loadBrokerOptions = useCallback(async (searchText = '') => {
    setIsBrokersLoading(true);
    try {
      const items = await brokerApi.getAll(searchText.trim() || undefined);
      setBrokers(items);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to load brokers.');
    } finally {
      setIsBrokersLoading(false);
    }
  }, []);

  const loadBrokerContactOptions = useCallback(async (brokerId: string) => {
    setIsBrokerContactsLoading(true);
    try {
      const items = await brokerContactApi.getByCompany(brokerId);
      setBrokerContacts(items);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to load broker contacts.');
      setBrokerContacts([]);
    } finally {
      setIsBrokerContactsLoading(false);
    }
  }, []);

  useEffect(() => {
    setSelectedBrokerId(load?.brokerId ?? '');
    setSelectedBrokerContactId(load?.brokerContactId ?? '');
  }, [load?.brokerId, load?.brokerContactId]);

  useEffect(() => {
    if (activeSection !== 'broker') return;
    void loadBrokerOptions();
  }, [activeSection, loadBrokerOptions]);

  useEffect(() => {
    if (activeSection !== 'broker') return;
    const term = brokerSearch.trim();
    const timeoutId = window.setTimeout(() => {
      if (term.length >= 2) {
        void loadBrokerOptions(term);
      } else {
        void loadBrokerOptions();
      }
    }, 220);

    return () => window.clearTimeout(timeoutId);
  }, [activeSection, brokerSearch, loadBrokerOptions]);

  useEffect(() => {
    if (!selectedBrokerId) {
      setBrokerContacts([]);
      setBrokerContactSearch('');
      setIsBrokerContactCreateOpen(false);
      setIsNewBrokerContactFormOpen(false);
      return;
    }
    void loadBrokerContactOptions(selectedBrokerId);
    setBrokerContactSearch('');
    setIsNewBrokerContactFormOpen(false);
  }, [selectedBrokerId, loadBrokerContactOptions]);

  const sortedPayments = useMemo(
    () =>
      [...payments].sort((a, b) => {
        const aDate = toDateOnly(a.dueDate) || toDateOnly(a.issueDate) || toDateOnly(a.createdAt);
        const bDate = toDateOnly(b.dueDate) || toDateOnly(b.issueDate) || toDateOnly(b.createdAt);
        return bDate.localeCompare(aDate);
      }),
    [payments],
  );

  const primaryPayment = sortedPayments[0] ?? null;

  const cmrDocument = useMemo(
    () => documents.find((document) => document.documentType === DocumentType.CMR) ?? null,
    [documents],
  );

  const orderedStops = useMemo(
    () => [...(load?.stops ?? [])].sort((a, b) => a.orderIndex - b.orderIndex),
    [load?.stops],
  );

  useEffect(() => {
    if (!load) {
      setPaymentManualNote('');
      setPaymentWorkflow(mergeWorkflowData(DEFAULT_PAYMENT_WORKFLOW));
      return;
    }

    const parsedNotes = parsePaymentNotesPayload(primaryPayment?.notes);
    const entityWorkflow = mapEntityWorkflowToUi(primaryPayment?.workflow);
    const inferredFlowType: PaymentFlowType | null = load.invoitix
      ? 'INVOITIX'
      : load.valutaCheck
        ? 'VALUTA'
        : null;
    const sourceWorkflow = entityWorkflow ?? parsedNotes.workflow;
    const nextWorkflow = mergeWorkflowData(sourceWorkflow, {
      flowType: sourceWorkflow.flowType ?? inferredFlowType,
    });

    const manualNote =
      primaryPayment?.workflow?.manualNote ??
      parsedNotes.manualNote ??
      '';
    setPaymentManualNote(manualNote);
    setPaymentWorkflow(nextWorkflow);
  }, [load, primaryPayment]);

  const activityEvents = useMemo<ActivityEvent[]>(() => {
    const today = toDateOnly(new Date().toISOString());
    const events: ActivityEvent[] = [];

    if (load) {
      const createdDate = toDateOnly(load.createdAt);
      if (createdDate) {
        events.push({
          id: `load-created-${load.id}`,
          date: createdDate,
          kind: 'LOAD',
          title: 'Load created',
          detail: `${load.referenceNumber} was created.`,
          isUpcoming: createdDate > today,
        });
      }

      const updatedDate = toDateOnly(load.updatedAt);
      if (updatedDate) {
        events.push({
          id: `load-updated-${load.id}`,
          date: updatedDate,
          kind: 'LOAD',
          title: 'Load updated',
          detail: `Current status: ${getLoadStatusLabel(load.status)}.`,
          isUpcoming: updatedDate > today,
        });
      }

      const pickupDate = toDateOnly(load.pickupDateFrom);
      if (pickupDate) {
        events.push({
          id: `load-pickup-${load.id}`,
          date: pickupDate,
          kind: 'STOP',
          title: 'Pickup window',
          detail: `${load.pickupCountry}, ${load.pickupPostcode}, ${load.pickupCity}`,
          isUpcoming: pickupDate > today,
        });
      }

      const deliveryDate = toDateOnly(load.deliveryDateFrom);
      if (deliveryDate) {
        events.push({
          id: `load-delivery-${load.id}`,
          date: deliveryDate,
          kind: 'STOP',
          title: 'Delivery window',
          detail: `${load.deliveryCountry}, ${load.deliveryPostcode}, ${load.deliveryCity}`,
          isUpcoming: deliveryDate > today,
        });
      }
    }

    orderedStops.forEach((stop) => {
      const stopDate = toDateOnly(stop.dateFrom);
      if (!stopDate) return;
      events.push({
        id: `stop-${stop.id}`,
        date: stopDate,
        kind: 'STOP',
        title: `${stop.stopType} stop #${stop.orderIndex + 1}`,
        detail: `${stop.country}, ${stop.postcode}, ${stop.city}`,
        isUpcoming: stopDate > today,
      });
    });

    sortedPayments.forEach((payment) => {
      const paymentCreatedDate = toDateOnly(payment.createdAt);
      if (paymentCreatedDate) {
        events.push({
          id: `payment-created-${payment.id}`,
          date: paymentCreatedDate,
          kind: 'PAYMENT',
          title: 'Payment record created',
          detail: `${payment.status} • ${formatMoney(toNumber(payment.totalWithVat ?? payment.amount))}`,
          isUpcoming: paymentCreatedDate > today,
        });
      }

      const issueDate = toDateOnly(payment.issueDate);
      if (issueDate) {
        events.push({
          id: `payment-issue-${payment.id}`,
          date: issueDate,
          kind: 'PAYMENT',
          title: 'Invoice issued',
          detail: payment.invoiceNumber ?? 'No invoice number',
          isUpcoming: issueDate > today,
        });
      }

      const dueDate = toDateOnly(payment.dueDate);
      if (dueDate) {
        events.push({
          id: `payment-due-${payment.id}`,
          date: dueDate,
          kind: 'PAYMENT',
          title: 'Payment due',
          detail: `Status: ${payment.status}`,
          isUpcoming: dueDate > today,
        });
      }

      const paidDate = toDateOnly(payment.paidDate);
      if (paidDate) {
        events.push({
          id: `payment-paid-${payment.id}`,
          date: paidDate,
          kind: 'PAYMENT',
          title: 'Payment settled',
          detail: formatMoney(toNumber(payment.totalWithVat ?? payment.amount)),
          isUpcoming: paidDate > today,
        });
      }
    });

    documents.forEach((document) => {
      const documentCreatedDate = toDateOnly(document.createdAt);
      if (documentCreatedDate) {
        events.push({
          id: `document-created-${document.id}`,
          date: documentCreatedDate,
          kind: 'DOCUMENT',
          title: 'Document uploaded',
          detail: `${document.documentType} • ${document.title}`,
          isUpcoming: documentCreatedDate > today,
        });
      }

      const issuedDate = toDateOnly(document.issuedAt);
      if (issuedDate) {
        events.push({
          id: `document-issued-${document.id}`,
          date: issuedDate,
          kind: 'DOCUMENT',
          title: 'Document issued',
          detail: document.title,
          isUpcoming: issuedDate > today,
        });
      }
    });

    return events
      .filter((event) => Boolean(event.date))
      .sort((a, b) =>
        a.date === b.date
          ? a.title.localeCompare(b.title)
          : b.date.localeCompare(a.date),
      );
  }, [documents, load, orderedStops, sortedPayments]);

  const activityCounts = useMemo(() => {
    return activityEvents.reduce(
      (acc, event) => {
        acc.ALL += 1;
        acc[event.kind] += 1;
        return acc;
      },
      {
        ALL: 0,
        LOAD: 0,
        STOP: 0,
        PAYMENT: 0,
        DOCUMENT: 0,
      },
    );
  }, [activityEvents]);

  const filteredActivityEvents = useMemo(
    () => activityEvents.filter((event) => activityFilter === 'ALL' || event.kind === activityFilter),
    [activityEvents, activityFilter],
  );

  const routeLabel = useMemo(() => {
    if (!load) return '—';
    return `${load.pickupCountry}, ${load.pickupPostcode}, ${load.pickupCity} → ${load.deliveryCountry}, ${load.deliveryPostcode}, ${load.deliveryCity}`;
  }, [load]);

  const statusProgressPath = useMemo(() => {
    if (!load) return [];
    return LOAD_STATUS_PROGRESS_PATH.includes(load.status)
      ? LOAD_STATUS_PROGRESS_PATH
      : [load.status];
  }, [load]);

  const statusCurrentIndex = useMemo(() => {
    if (!load) return -1;
    return statusProgressPath.findIndex((status) => status === load.status);
  }, [load, statusProgressPath]);

  const palletsTotal = useMemo(() => {
    if (!load) return 0;
    if (typeof load.freightDetails?.palletCount === 'number') {
      return Math.max(0, Math.round(load.freightDetails.palletCount));
    }
    return (load.pallets ?? []).reduce(
      (sum, pallet) => sum + Math.max(1, pallet.quantity ?? 1),
      0,
    );
  }, [load]);

  const expectedAmount = useMemo(() => {
    if (!load) return 0;
    return toNumber(primaryPayment?.totalWithVat ?? primaryPayment?.amount ?? load.agreedPrice ?? load.publishedPrice);
  }, [load, primaryPayment]);

  const baseLoadAmount = useMemo(
    () => toNumber(load?.agreedPrice ?? load?.publishedPrice),
    [load],
  );

  const currentPaymentStatus = primaryPayment?.status ?? PaymentStatus.PENDING;
  const isPaymentPaidOut =
    currentPaymentStatus === PaymentStatus.PAID ||
    Boolean(paymentWorkflow.invoitix.payoutConfirmedAt) ||
    Boolean(paymentWorkflow.valuta.payoutReceivedAt);
  const isWaitingForPayment =
    load?.status === LoadStatus.DELIVERED && !isPaymentPaidOut;
  const statusProgressSteps = useMemo(() => {
    if (!load) return [];
    const isProgressStatus = LOAD_STATUS_PROGRESS_PATH.includes(load.status);
    if (!isProgressStatus) {
      return [
        {
          key: load.status,
          label: getLoadStatusLabel(load.status),
          isActive: true,
        },
      ];
    }

    return [
      ...LOAD_STATUS_PROGRESS_PATH.map((status, index) => ({
        key: status,
        label: getLoadStatusLabel(status),
        isActive: statusCurrentIndex >= 0 && index <= statusCurrentIndex,
      })),
      {
        key: 'WAITING_FOR_PAYMENT',
        label: 'WAITING FOR PAYMENT',
        isActive: isWaitingForPayment || isPaymentPaidOut,
      },
      {
        key: 'PAID_OUT',
        label: 'PAID OUT',
        isActive: isPaymentPaidOut,
      },
    ];
  }, [isPaymentPaidOut, isWaitingForPayment, load, statusCurrentIndex]);
  const isLoadCompleted = load?.status === LoadStatus.DELIVERED;
  const selectedFlowType = paymentWorkflow.flowType;
  const isInvoitixFlow = selectedFlowType === 'INVOITIX';
  const isValutaFlow = selectedFlowType === 'VALUTA';
  const isSkontoMode = paymentWorkflow.valuta.mode === 'SKONTO';

  const invoitixFeeAmount = useMemo(
    () => (baseLoadAmount > 0 ? Math.round((baseLoadAmount * 0.07 + 3.15) * 100) / 100 : 0),
    [baseLoadAmount],
  );
  const invoitixProjectedPayout = useMemo(
    () => Math.max(0, Math.round((baseLoadAmount - invoitixFeeAmount) * 100) / 100),
    [baseLoadAmount, invoitixFeeAmount],
  );

  const skontoFeeAmount = useMemo(() => {
    const percent = toNumber(paymentWorkflow.valuta.skontoPercent);
    if (!isSkontoMode || baseLoadAmount <= 0 || percent <= 0) return 0;
    return Math.round((baseLoadAmount * percent / 100) * 100) / 100;
  }, [baseLoadAmount, isSkontoMode, paymentWorkflow.valuta.skontoPercent]);

  const bankFeeAmount = toNumber(paymentWorkflow.valuta.bankFeeAmount);
  const projectedPayout = useMemo(() => {
    if (baseLoadAmount <= 0) return 0;
    if (isInvoitixFlow) return invoitixProjectedPayout;
    if (isValutaFlow) {
      return Math.max(
        0,
        Math.round((baseLoadAmount - skontoFeeAmount - bankFeeAmount) * 100) / 100,
      );
    }
    return baseLoadAmount;
  }, [bankFeeAmount, baseLoadAmount, invoitixProjectedPayout, isInvoitixFlow, isValutaFlow, skontoFeeAmount]);

  const invoitixSentDate = paymentWorkflow.invoitix.sentAt;
  const invoitixProjectedDate = invoitixSentDate ? addDaysToDateInput(invoitixSentDate, 2) : '';
  const isInvoitixSentSaved = Boolean(invoitixSentDate);
  const isInvoitixPayoutConfirmed = Boolean(paymentWorkflow.invoitix.payoutConfirmedAt);
  const isValutaPayoutConfirmed = Boolean(paymentWorkflow.valuta.payoutReceivedAt);
  const isValutaBankFeeSaved =
    isValutaPayoutConfirmed &&
    primaryPayment?.workflow?.valutaBankFeeAmount !== null &&
    primaryPayment?.workflow?.valutaBankFeeAmount !== undefined;
  const hasInvoitixWorkflowStarted = Boolean(
    paymentWorkflow.invoitix.sentAt ||
      paymentWorkflow.invoitix.rejectedAt ||
      paymentWorkflow.invoitix.resubmittedAt ||
      paymentWorkflow.invoitix.approvedAt ||
      paymentWorkflow.invoitix.paidOutAt ||
      paymentWorkflow.invoitix.payoutConfirmedAt ||
      paymentWorkflow.invoitix.projectedIncomeAddedAt,
  );
  const hasValutaWorkflowStarted = Boolean(
    paymentWorkflow.valuta.invoiceSentAt ||
      paymentWorkflow.valuta.shippedAt ||
      paymentWorkflow.valuta.trackingNumber.trim() ||
      paymentWorkflow.valuta.documentsArrivedAt ||
      paymentWorkflow.valuta.payoutReceivedAt ||
      paymentWorkflow.valuta.bankFeeAmount.trim(),
  );
  const isFlowEditLocked =
    (selectedFlowType === 'INVOITIX' && hasInvoitixWorkflowStarted) ||
    (selectedFlowType === 'VALUTA' && hasValutaWorkflowStarted);

  const hasValutaCountdownDays = paymentWorkflow.valuta.countdownDays !== '';
  const valutaCountdownDays = Math.max(0, Math.trunc(toNumber(paymentWorkflow.valuta.countdownDays)));
  const valutaCountdownStartDate =
    paymentWorkflow.valuta.countdownStart === 'ORIGINALS_RECEIVED'
      ? paymentWorkflow.valuta.documentsArrivedAt
      : paymentWorkflow.valuta.countdownStart === 'EMAIL_COPY_INVOICE'
        ? paymentWorkflow.valuta.invoiceSentAt
        : null;
  const valutaProjectedDate =
    hasValutaCountdownDays && valutaCountdownStartDate !== null && valutaCountdownStartDate !== ''
      ? addDaysToDateInput(valutaCountdownStartDate, valutaCountdownDays)
      : '';

  const valutaCurrentStatus = useMemo(() => {
    if (!isLoadCompleted) return 'Waiting to be completed';
    if (!paymentWorkflow.valuta.countdownStart) return 'Waiting for flow setup';
    if (isValutaPayoutConfirmed) return 'Payout confirmed';

    if (paymentWorkflow.valuta.countdownStart === 'ORIGINALS_RECEIVED') {
      if (!paymentWorkflow.valuta.shippedAt) return 'Waiting for driver return';
      if (!paymentWorkflow.valuta.documentsArrivedAt) return 'Waiting for originals to arrive';
      return 'Countdown in progress';
    }

    if (!paymentWorkflow.valuta.invoiceSentAt) return 'Waiting for driver return';
    return 'Countdown in progress';
  }, [
    isLoadCompleted,
    isValutaPayoutConfirmed,
    paymentWorkflow.valuta.countdownStart,
    paymentWorkflow.valuta.documentsArrivedAt,
    paymentWorkflow.valuta.invoiceSentAt,
    paymentWorkflow.valuta.shippedAt,
  ]);

  const isValutaEmailStepDone = Boolean(paymentWorkflow.valuta.invoiceSentAt);
  const isValutaOriginalsSentStepDone = Boolean(
    paymentWorkflow.valuta.shippedAt && paymentWorkflow.valuta.trackingNumber.trim(),
  );
  const hasValutaSentDocumentsDraft = Boolean(
    paymentWorkflow.valuta.shippedAt || paymentWorkflow.valuta.trackingNumber.trim(),
  );
  const isValutaWaitingDriverInProgress =
    paymentWorkflow.valuta.countdownStart === 'ORIGINALS_RECEIVED' &&
    isLoadCompleted &&
    !isValutaOriginalsSentStepDone;
  const isValutaWaitingDriverPending =
    paymentWorkflow.valuta.countdownStart === 'ORIGINALS_RECEIVED' &&
    !isLoadCompleted &&
    !isValutaOriginalsSentStepDone;
  const isValutaSentDocumentsInProgress =
    paymentWorkflow.valuta.countdownStart === 'ORIGINALS_RECEIVED' &&
    isLoadCompleted &&
    !isValutaOriginalsSentStepDone &&
    hasValutaSentDocumentsDraft;
  const isValutaSentDocumentsPending =
    paymentWorkflow.valuta.countdownStart === 'ORIGINALS_RECEIVED' &&
    !isValutaOriginalsSentStepDone &&
    !isValutaSentDocumentsInProgress;
  const isValutaOriginalsArrivedStepDone = Boolean(paymentWorkflow.valuta.documentsArrivedAt);
  const isValutaWaitingOriginalsInProgress =
    paymentWorkflow.valuta.countdownStart === 'ORIGINALS_RECEIVED' &&
    isValutaOriginalsSentStepDone &&
    !isValutaOriginalsArrivedStepDone;
  const isValutaWaitingOriginalsPending =
    paymentWorkflow.valuta.countdownStart === 'ORIGINALS_RECEIVED' &&
    !isValutaOriginalsArrivedStepDone &&
    !isValutaWaitingOriginalsInProgress;
  const isValutaCountdownStepDone = isValutaPayoutConfirmed;
  const isValutaCountdownInProgress = Boolean(valutaProjectedDate) && !isValutaPayoutConfirmed;
  const isInvoitixStep1Done = isInvoitixSentSaved;
  const isInvoitixStep1InProgress = isLoadCompleted && !isInvoitixStep1Done;
  const isInvoitixStep2Done = isInvoitixPayoutConfirmed;
  const isInvoitixStep2InProgress = isInvoitixSentSaved && !isInvoitixStep2Done;
  const isInvoitixStep3Done = isInvoitixPayoutConfirmed;
  const isInvoitixStep3InProgress = isInvoitixSentSaved && !isInvoitixStep3Done;
  const isValutaEmailStepInProgress =
    paymentWorkflow.valuta.countdownStart === 'EMAIL_COPY_INVOICE' &&
    isLoadCompleted &&
    !isValutaEmailStepDone;
  const valutaDaysLeft = useMemo(
    () => getDaysUntilDateInput(valutaProjectedDate),
    [valutaProjectedDate],
  );
  const payoutStatusLabel = useMemo(() => {
    if (!selectedFlowType) return 'Flow not set';
    if (isInvoitixFlow) {
      if (!isLoadCompleted) return 'Waiting to be completed';
      if (isInvoitixPayoutConfirmed) return 'Payout confirmed';
      if (isInvoitixSentSaved) return 'Waiting for payout';
      return 'Ready to send to Invoitix';
    }
    return valutaCurrentStatus;
  }, [
    isInvoitixFlow,
    isInvoitixPayoutConfirmed,
    isInvoitixSentSaved,
    isLoadCompleted,
    selectedFlowType,
    valutaCurrentStatus,
  ]);
  const payoutStatusBadgeClass = useMemo(() => {
    const status = payoutStatusLabel.toLowerCase();
    if (status.includes('confirmed')) {
      return 'border-emerald-400 bg-emerald-100 text-emerald-900';
    }
    if (status.includes('waiting to be completed')) {
      return 'border-amber-400 bg-amber-100 text-amber-900';
    }
    if (status.includes('waiting') || status.includes('ready') || status.includes('progress')) {
      return 'border-blue-400 bg-blue-100 text-blue-900';
    }
    if (status.includes('flow not set')) {
      return 'border-slate-400 bg-slate-100 text-slate-900';
    }
    return 'border-slate-400 bg-white text-slate-900';
  }, [payoutStatusLabel]);
  const getStepNumberChipClass = (isDone: boolean, isInProgress: boolean): string => {
    if (isDone) return 'border-emerald-600 bg-emerald-600 text-white';
    if (isInProgress) return 'border-blue-600 bg-blue-600 text-white';
    return 'border-amber-600 bg-amber-600 text-white';
  };
  const selectedBroker = useMemo(() => {
    if (!selectedBrokerId) return load?.broker ?? null;
    return brokers.find((broker) => broker.id === selectedBrokerId) ?? load?.broker ?? null;
  }, [brokers, load?.broker, selectedBrokerId]);
  const selectedBrokerContact = useMemo(() => {
    if (!selectedBrokerContactId) return load?.brokerContact ?? null;
    return (
      brokerContacts.find((contact) => contact.id === selectedBrokerContactId) ??
      load?.brokerContact ??
      null
    );
  }, [brokerContacts, load?.brokerContact, selectedBrokerContactId]);
  const filteredBrokerContacts = useMemo(() => {
    const term = brokerContactSearch.trim().toLowerCase();
    if (!term) return brokerContacts;
    return brokerContacts.filter((contact) => {
      const haystack = [
        contact.firstName,
        contact.lastName,
        contact.role,
        contact.email ?? '',
        contact.phone ?? '',
        contact.mobile ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [brokerContactSearch, brokerContacts]);
  const isBrokerCompanySelected = Boolean(selectedBrokerId);

  const hydrateBrokerDrafts = useCallback((broker: BrokerCompany) => {
    setBrokerMainDraft({
      companyName: broker.companyName ?? '',
      employeeCount:
        broker.employeeCount === null || broker.employeeCount === undefined
          ? ''
          : String(broker.employeeCount),
      phone: broker.phone ?? '',
      email: broker.email ?? '',
      website: broker.website ?? '',
      street: broker.street ?? '',
      postcode: broker.postcode ?? '',
      city: broker.city ?? '',
      country: broker.country ?? '',
    });

    setBrokerTransEuDraft({
      transEuId: broker.transEuId ?? '',
      transEuRating: broker.transEuRating ?? '',
      transEuReviewCount:
        broker.transEuReviewCount === null || broker.transEuReviewCount === undefined
          ? ''
          : String(broker.transEuReviewCount),
      transEuPaidOnTime:
        broker.transEuPaidOnTime === null || broker.transEuPaidOnTime === undefined
          ? ''
          : String(broker.transEuPaidOnTime),
      transEuPaidWithDelay:
        broker.transEuPaidWithDelay === null || broker.transEuPaidWithDelay === undefined
          ? ''
          : String(broker.transEuPaidWithDelay),
      transEuPaymentIssues:
        broker.transEuPaymentIssues === null || broker.transEuPaymentIssues === undefined
          ? ''
          : String(broker.transEuPaymentIssues),
    });

    setBrokerOtherDraft({
      legalName: broker.legalName ?? '',
      taxId: broker.taxId ?? '',
      vatId: broker.vatId ?? '',
      insuranceCoverage:
        broker.insuranceCoverage === null || broker.insuranceCoverage === undefined
          ? ''
          : String(broker.insuranceCoverage),
      insuranceProvider: broker.insuranceProvider ?? '',
      insuranceValidUntil: toDateOnly(broker.insuranceValidUntil),
      licenseNumber: broker.licenseNumber ?? '',
      licenseValidUntil: toDateOnly(broker.licenseValidUntil),
      platformMemberSince: toDateOnly(broker.platformMemberSince),
      isActive: broker.isActive,
      notes: broker.notes ?? '',
    });
  }, []);

  useEffect(() => {
    if (!selectedBroker) return;
    hydrateBrokerDrafts(selectedBroker);
    setBrokerEditModal(null);
  }, [hydrateBrokerDrafts, selectedBroker?.id]);

  const applyUpdatedBrokerLocally = (updatedBroker: BrokerCompany) => {
    setBrokers((prev) => {
      const existingIndex = prev.findIndex((item) => item.id === updatedBroker.id);
      if (existingIndex === -1) return [updatedBroker, ...prev];
      const next = [...prev];
      next[existingIndex] = updatedBroker;
      return next;
    });

    setLoad((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        brokerageName: updatedBroker.companyName,
        broker: updatedBroker,
      };
    });
  };

  const persistBrokerSectionUpdate = async (
    section: 'main' | 'transEu' | 'other',
    payload: Record<string, unknown>,
    onSuccess: () => void,
  ) => {
    if (!selectedBroker) {
      setError('Select broker first.');
      return;
    }

    setIsSavingBrokerSection(section);
    setError(null);
    try {
      const updated = await brokerApi.update(selectedBroker.id, payload);
      applyUpdatedBrokerLocally(updated);
      hydrateBrokerDrafts(updated);
      onSuccess();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to update broker.');
    } finally {
      setIsSavingBrokerSection(null);
    }
  };

  const saveBrokerMainSection = async () => {
    const companyName = brokerMainDraft.companyName.trim();
    const street = brokerMainDraft.street.trim();
    const postcode = brokerMainDraft.postcode.trim();
    const city = brokerMainDraft.city.trim();
    const country = brokerMainDraft.country.trim();

    if (!companyName || !street || !postcode || !city || !country) {
      setError('Company, street, postcode, city, and country are required.');
      return;
    }

    try {
      const employeeCount = toOptionalIntegerString(brokerMainDraft.employeeCount, 'Employees');
      await persistBrokerSectionUpdate(
        'main',
        {
          companyName,
          employeeCount,
          phone: nullableString(brokerMainDraft.phone),
          email: nullableString(brokerMainDraft.email),
          website: nullableString(brokerMainDraft.website),
          street,
          postcode,
          city,
          country,
        },
        () => setBrokerEditModal(null),
      );
    } catch (validationError) {
      setError(
        validationError instanceof Error
          ? validationError.message
          : 'Invalid broker main card values.',
      );
    }
  };

  const saveBrokerTransEuSection = async () => {
    try {
      const transEuReviewCount = toOptionalIntegerString(
        brokerTransEuDraft.transEuReviewCount,
        'Trans.eu reviews',
      );
      const transEuPaidOnTime = toOptionalIntegerString(
        brokerTransEuDraft.transEuPaidOnTime,
        'Paid on time',
      );
      const transEuPaidWithDelay = toOptionalIntegerString(
        brokerTransEuDraft.transEuPaidWithDelay,
        'Paid with delay',
      );
      const transEuPaymentIssues = toOptionalIntegerString(
        brokerTransEuDraft.transEuPaymentIssues,
        'Payment issues',
      );

      await persistBrokerSectionUpdate(
        'transEu',
        {
          transEuId: nullableString(brokerTransEuDraft.transEuId),
          transEuRating: nullableString(brokerTransEuDraft.transEuRating),
          transEuReviewCount,
          transEuPaidOnTime,
          transEuPaidWithDelay,
          transEuPaymentIssues,
        },
        () => setBrokerEditModal(null),
      );
    } catch (validationError) {
      setError(
        validationError instanceof Error
          ? validationError.message
          : 'Invalid Trans.eu values.',
      );
    }
  };

  const saveBrokerOtherSection = async () => {
    try {
      const insuranceCoverage = toOptionalDecimalString(
        brokerOtherDraft.insuranceCoverage,
        'Insurance coverage',
      );

      await persistBrokerSectionUpdate(
        'other',
        {
          legalName: nullableString(brokerOtherDraft.legalName),
          taxId: nullableString(brokerOtherDraft.taxId),
          vatId: nullableString(brokerOtherDraft.vatId),
          insuranceCoverage,
          insuranceProvider: nullableString(brokerOtherDraft.insuranceProvider),
          insuranceValidUntil: normalizeNullableDate(brokerOtherDraft.insuranceValidUntil),
          licenseNumber: nullableString(brokerOtherDraft.licenseNumber),
          licenseValidUntil: normalizeNullableDate(brokerOtherDraft.licenseValidUntil),
          platformMemberSince: normalizeNullableDate(brokerOtherDraft.platformMemberSince),
          isActive: brokerOtherDraft.isActive,
          notes: nullableString(brokerOtherDraft.notes),
        },
        () => setBrokerEditModal(null),
      );
    } catch (validationError) {
      setError(
        validationError instanceof Error
          ? validationError.message
          : 'Invalid broker extra values.',
      );
    }
  };

  const openBrokerEditModal = (section: BrokerEditModalSection) => {
    if (!selectedBroker) {
      setError('Select broker first.');
      return;
    }
    hydrateBrokerDrafts(selectedBroker);
    setError(null);
    setBrokerEditModal(section);
  };

  const assignBrokerToLoad = async (brokerId: string, brokerFromCreate?: BrokerCompany) => {
    if (!load) return;
    const broker =
      brokerFromCreate ??
      brokers.find((item) => item.id === brokerId) ??
      null;
    if (!broker) {
      setError('Select broker first.');
      return;
    }

    setIsAssigningBroker(true);
    setError(null);
    try {
      await loadApi.update(load.id, {
        brokerId: broker.id,
        brokerContactId: null,
        brokerageName: broker.companyName,
        contactPerson: null,
        contactPhone: null,
        contactEmail: null,
      });
      setSelectedBrokerId(broker.id);
      setSelectedBrokerContactId('');
      await loadData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to assign broker.');
    } finally {
      setIsAssigningBroker(false);
    }
  };

  const confirmAndAssignBroker = async (
    broker: BrokerCompany,
    options?: { closeModal?: boolean },
  ) => {
    const confirmed = window.confirm(
      `Select broker "${broker.companyName}" for this load?`,
    );
    if (!confirmed) return;
    await assignBrokerToLoad(broker.id, broker);
    setBrokerSearch(broker.companyName);
    if (options?.closeModal) {
      setIsChangeBrokerModalOpen(false);
    }
  };

  const assignBrokerContactToLoad = async (
    contactId: string,
    contactFromCreate?: BrokerContact,
    options?: { closeModal?: boolean },
  ) => {
    if (!load || !selectedBrokerId) return;
    const contact =
      contactFromCreate ??
      brokerContacts.find((item) => item.id === contactId) ??
      null;
    if (!contact) {
      setError('Select broker contact first.');
      return;
    }

    const fullName = `${contact.firstName} ${contact.lastName}`.trim();
    setIsAssigningBrokerContact(true);
    setError(null);
    try {
      await loadApi.update(load.id, {
        brokerId: selectedBrokerId,
        brokerContactId: contact.id,
        contactPerson: fullName || null,
        contactPhone: contact.phone || contact.mobile || null,
        contactEmail: contact.email || null,
      });
      setSelectedBrokerContactId(contact.id);
      await loadData();
      if (options?.closeModal) {
        setIsBrokerContactCreateOpen(false);
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to assign broker contact.');
    } finally {
      setIsAssigningBrokerContact(false);
    }
  };

  const createBrokerContact = async () => {
    if (!selectedBrokerId) {
      setError('Select broker first.');
      return;
    }
    const firstName = newContactForm.firstName.trim();
    const lastName = newContactForm.lastName.trim();
    if (!firstName || !lastName) {
      setError('Contact first and last name are required.');
      return;
    }

    setIsCreatingBrokerContact(true);
    setError(null);
    try {
      const created = await brokerContactApi.create({
        companyId: selectedBrokerId,
        firstName,
        lastName,
        role: newContactForm.role,
        ...(newContactForm.email.trim() ? { email: newContactForm.email.trim() } : {}),
        ...(newContactForm.phone.trim() ? { phone: newContactForm.phone.trim() } : {}),
        ...(newContactForm.mobile.trim() ? { mobile: newContactForm.mobile.trim() } : {}),
      });
      setBrokerContacts((prev) => {
        const deduped = prev.filter((item) => item.id !== created.id);
        return [created, ...deduped];
      });
      setNewContactForm({
        firstName: '',
        lastName: '',
        role: ContactRole.DISPATCHER,
        email: '',
        phone: '',
        mobile: '',
      });
      setIsNewBrokerContactFormOpen(false);
      await assignBrokerContactToLoad(created.id, created, { closeModal: true });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to create broker contact.');
    } finally {
      setIsCreatingBrokerContact(false);
    }
  };

  const patchInvoitixWorkflow = (patch: Partial<PaymentWorkflowData['invoitix']>) => {
    setPaymentWorkflow((prev) =>
      mergeWorkflowData(prev, {
        invoitix: patch,
      }),
    );
  };

  const patchValutaWorkflow = (patch: Partial<PaymentWorkflowData['valuta']>) => {
    setPaymentWorkflow((prev) =>
      mergeWorkflowData(prev, {
        valuta: patch,
      }),
    );
  };

  const openFlowModal = () => {
    if (isFlowEditLocked) {
      setError('Payment flow cannot be edited after workflow steps have started.');
      return;
    }
    setError(null);
    setFlowDraft(mergeWorkflowData(DEFAULT_PAYMENT_WORKFLOW, paymentWorkflow));
    setIsFlowModalOpen(true);
  };

  const patchFlowDraft = (patch: Partial<PaymentWorkflowData>) => {
    setFlowDraft((prev) => mergeWorkflowData(prev, patch));
  };

  const patchValutaDraft = (patch: Partial<PaymentWorkflowData['valuta']>) => {
    setFlowDraft((prev) =>
      mergeWorkflowData(prev, {
        valuta: patch,
      }),
    );
  };

  const savePaymentDetails = async (
    options?: {
      workflow?: PaymentWorkflowData;
      amount?: number;
      status?: PaymentStatus;
      issueDate?: string | null;
      dueDate?: string | null;
      markPaidDate?: string | null;
      skipFlowCheck?: boolean;
    },
  ) => {
    if (!load) return;

    setIsSavingPaymentDetails(true);
    setError(null);

    try {
      const workflowToSave = options?.workflow ?? paymentWorkflow;

      if (!workflowToSave.flowType && !options?.skipFlowCheck) {
        throw new Error('Select payment flow first (Invoitix or Valuta/Skonto).');
      }

      const amount = toNumber(options?.amount ?? load.agreedPrice ?? load.publishedPrice);
      if (amount <= 0) {
        throw new Error('Payment amount must be greater than 0.');
      }

      const issueDate = options?.issueDate ?? toDateOnly(primaryPayment?.issueDate) ?? toDateOnly(load.deliveryDateFrom);
      const dueDate =
        options?.dueDate ??
        toDateOnly(primaryPayment?.dueDate) ??
        toDateOnly(load.deliveryDateTo) ??
        toDateOnly(load.deliveryDateFrom);
      const targetStatus = options?.status ?? primaryPayment?.status ?? PaymentStatus.PENDING;
      const manualNote = paymentManualNote.trim();
      const workflowDto = mapUiWorkflowToDto(workflowToSave, manualNote);

      let paymentId: string;
      if (primaryPayment) {
        await paymentApi.update(primaryPayment.id, {
          amount,
          status: targetStatus,
          ...(issueDate ? { issueDate } : {}),
          ...(dueDate ? { dueDate } : {}),
          ...(manualNote ? { notes: manualNote } : { notes: '' }),
          workflow: workflowDto,
        });
        paymentId = primaryPayment.id;
      } else {
        if (!load.brokerId) {
          throw new Error('Load has no broker assigned. Assign broker first.');
        }

        const created = await paymentApi.create({
          loadId: load.id,
          brokerId: load.brokerId,
          status: targetStatus,
          amount,
          currency: load.currency,
          ...(issueDate ? { issueDate } : {}),
          ...(dueDate ? { dueDate } : {}),
          ...(manualNote ? { notes: manualNote } : { notes: '' }),
          workflow: workflowDto,
        });
        paymentId = created.id;
      }

      if (options?.markPaidDate && paymentId) {
        await paymentApi.markPaid(paymentId, options.markPaidDate);
      }

      const shouldUseInvoitix = workflowToSave.flowType === 'INVOITIX';
      const shouldUseValuta = workflowToSave.flowType === 'VALUTA';
      if (load.invoitix !== shouldUseInvoitix || load.valutaCheck !== shouldUseValuta) {
        const updatedLoad = await loadApi.update(load.id, {
          invoitix: shouldUseInvoitix,
          valutaCheck: shouldUseValuta,
        });
        setLoad(updatedLoad);
      }

      await loadData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to save payment details.');
    } finally {
      setIsSavingPaymentDetails(false);
    }
  };

  const saveFlowSelection = async () => {
    if (!flowDraft.flowType) {
      setError('Select payment flow first.');
      return;
    }

    const nextWorkflow = mergeWorkflowData(paymentWorkflow, {
      flowType: flowDraft.flowType,
      valuta: flowDraft.valuta,
    });

    setPaymentWorkflow(nextWorkflow);
    await savePaymentDetails({
      workflow: nextWorkflow,
      amount: baseLoadAmount > 0 ? baseLoadAmount : expectedAmount,
      status: currentPaymentStatus,
    });
    setIsFlowModalOpen(false);
  };

  const saveValutaStep = async (
    patch: Partial<PaymentWorkflowData['valuta']>,
    options?: {
      amount?: number;
      status?: PaymentStatus;
      issueDate?: string | null;
      dueDate?: string | null;
      markPaidDate?: string | null;
    },
  ) => {
    const nextWorkflow = mergeWorkflowData(paymentWorkflow, {
      flowType: 'VALUTA',
      valuta: patch,
    });
    setPaymentWorkflow(nextWorkflow);

    await savePaymentDetails({
      workflow: nextWorkflow,
      amount: options?.amount ?? (baseLoadAmount > 0 ? baseLoadAmount : expectedAmount),
      status: options?.status ?? currentPaymentStatus,
      issueDate: options?.issueDate,
      dueDate: options?.dueDate,
      markPaidDate: options?.markPaidDate,
    });
  };

  const confirmValutaEmailSent = async () => {
    if (!isLoadCompleted) {
      setError('Load must be completed first.');
      return;
    }

    const sentDate = paymentWorkflow.valuta.invoiceSentAt ?? getTodayDateInput();
    const confirmed = window.confirm(`Confirm email copy + invoice sent on ${formatDate(sentDate)}?`);
    if (!confirmed) return;

    const dueDate = addDaysToDateInput(sentDate, valutaCountdownDays);
    await saveValutaStep(
      {
        invoiceSentAt: sentDate,
        invoiceDispatch: 'EMAIL_WITH_CMR',
      },
      {
        issueDate: sentDate,
        dueDate: dueDate || undefined,
      },
    );
  };

  const confirmValutaOriginalsSent = async () => {
    if (!isLoadCompleted) {
      setError('Load must be completed first.');
      return;
    }

    const sentDate = paymentWorkflow.valuta.shippedAt ?? getTodayDateInput();
    const trackingNumber = paymentWorkflow.valuta.trackingNumber.trim();
    if (!trackingNumber) {
      setError('Enter tracking number before marking originals as sent.');
      return;
    }

    const confirmed = window.confirm(`Confirm originals sent to broker on ${formatDate(sentDate)}?`);
    if (!confirmed) return;

    await saveValutaStep(
      {
        shippedAt: sentDate,
        trackingNumber,
        invoiceDispatch: 'WAIT_AND_SHIP_ORIGINALS',
      },
      {
        issueDate: sentDate,
      },
    );
  };

  const confirmValutaOriginalsArrived = async () => {
    if (!paymentWorkflow.valuta.shippedAt) {
      setError('Mark originals as sent first.');
      return;
    }

    const arrivedDate = paymentWorkflow.valuta.documentsArrivedAt ?? getTodayDateInput();
    const confirmed = window.confirm(`Confirm originals arrived on ${formatDate(arrivedDate)}?`);
    if (!confirmed) return;

    const dueDate = addDaysToDateInput(arrivedDate, valutaCountdownDays);
    await saveValutaStep(
      {
        documentsArrivedAt: arrivedDate,
      },
      {
        dueDate: dueDate || undefined,
      },
    );
  };

  const confirmValutaPayout = async () => {
    if (!isLoadCompleted) {
      setError('Load must be completed first.');
      return;
    }
    if (!valutaCountdownStartDate) {
      setError('Countdown has not started yet.');
      return;
    }

    const payoutDate = getTodayDateInput();
    const confirmed = window.confirm(`Confirm payout received on ${formatDate(payoutDate)}?`);
    if (!confirmed) return;

    await saveValutaStep(
      {
        payoutReceivedAt: payoutDate,
      },
      {
        amount: projectedPayout,
        status: PaymentStatus.PAID,
        dueDate: valutaProjectedDate || payoutDate,
        markPaidDate: payoutDate,
      },
    );
  };

  const saveValutaBankFee = async () => {
    if (!isValutaPayoutConfirmed) {
      setError('Confirm payout first, then save bank fee.');
      return;
    }

    await saveValutaStep(
      {
        bankFeeAmount: paymentWorkflow.valuta.bankFeeAmount,
      },
      {
        amount: projectedPayout,
        status: PaymentStatus.PAID,
        dueDate: valutaProjectedDate || toDateOnly(primaryPayment?.dueDate),
      },
    );
  };

  const confirmSendToInvoitix = async () => {
    const sendDate = paymentWorkflow.invoitix.sentAt ?? getTodayDateInput();
    const projectedDate = addDaysToDateInput(sendDate, 2);
    const confirmed = window.confirm(
      `Are you sure you want to mark this load as sent to Invoitix on ${formatDate(sendDate)}?\n\nProjected payout: ${formatMoney(invoitixProjectedPayout)}\nProjected date: ${formatDate(projectedDate)}`,
    );
    if (!confirmed) return;

    const nextWorkflow = mergeWorkflowData(paymentWorkflow, {
      flowType: 'INVOITIX',
      invoitix: {
        sentAt: sendDate,
        projectedIncomeAddedAt: sendDate,
      },
    });

    await savePaymentDetails({
      workflow: nextWorkflow,
      amount: baseLoadAmount,
      status: PaymentStatus.INVOICED,
      issueDate: sendDate,
      dueDate: projectedDate,
    });
  };

  const confirmInvoitixPayout = async () => {
    if (!invoitixSentDate) {
      setError('Send to Invoitix first.');
      return;
    }

    const confirmed = window.confirm('Confirm Invoitix payout received?');
    if (!confirmed) return;

    const payoutDate = getTodayDateInput();
    const nextWorkflow = mergeWorkflowData(paymentWorkflow, {
      flowType: 'INVOITIX',
      invoitix: {
        payoutConfirmedAt: payoutDate,
        paidOutAt: payoutDate,
      },
    });

    await savePaymentDetails({
      workflow: nextWorkflow,
      amount: invoitixProjectedPayout,
      status: PaymentStatus.PAID,
      issueDate: invoitixSentDate,
      dueDate: invoitixProjectedDate || addDaysToDateInput(invoitixSentDate, 2),
      markPaidDate: payoutDate,
    });
  };

  if (!loadId) {
    return (
      <main className="min-h-screen bg-slate-100">
        <ThinModuleMenu />
        <div className="w-full px-4 py-8 sm:px-6 xl:px-8">
          <section className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            Invalid load id.
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <ThinModuleMenu />

      <div className="w-full px-4 py-6 sm:px-6 xl:px-8">
        <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Load Detail</p>
              <h1 className="mt-1 text-2xl font-semibold text-slate-900">
                {load?.referenceNumber ?? 'Loading...'}
              </h1>
              <p className="mt-1 text-sm text-slate-600">{routeLabel}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                to="/load-board"
                className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Back To Load Board
              </Link>
              <button
                type="button"
                onClick={() => void loadData()}
                disabled={isLoading}
                className="inline-flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Brokerage</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {load?.broker?.companyName ?? load?.brokerageName ?? 'Broker not set'}
              </p>
              <p className="mt-1 text-xs text-slate-600">
                Contact: {load?.contactPerson || '—'} {load?.contactPhone ? `• ${load.contactPhone}` : ''}
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Load</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {palletsTotal} pallets • {toNumber(load?.freightDetails?.weightTons).toFixed(2)} t
              </p>
              <p className="mt-1 text-xs text-slate-600">
                Board: {load?.boardSource ?? '—'} • TransEU: {load?.transEuFreightNumber ?? '—'}
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Payment Snapshot</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {expectedAmount > 0 ? formatMoney(expectedAmount) : '—'}
              </p>
              <p className="mt-1 text-xs text-slate-600">
                Status: {primaryPayment?.status ?? PaymentStatus.PENDING}
              </p>
            </div>
          </div>

          {error && (
            <p className="mt-3 rounded border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-700">
              {error}
            </p>
          )}
        </header>

        <div className="mt-4 grid gap-4 lg:grid-cols-[220px_1fr]">
          <aside className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Load Menu</p>
            <nav className="space-y-1">
              {SECTION_ITEMS.map((section) => (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setSection(section.id)}
                  className={`w-full rounded px-2 py-2 text-left text-sm font-medium transition-colors ${
                    activeSection === section.id
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {section.label}
                </button>
              ))}
            </nav>
          </aside>

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            {activeSection === 'overview' && (
              <div className="grid gap-4 md:grid-cols-2">
                <article className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <h2 className="text-sm font-semibold text-slate-900">Brokerage Information</h2>
                  <p className="mt-2 text-sm text-slate-800">
                    {load?.broker?.companyName ?? load?.brokerageName ?? 'Broker not set'}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">Email: {load?.contactEmail ?? '—'}</p>
                  <p className="mt-1 text-xs text-slate-600">Phone: {load?.contactPhone ?? '—'}</p>
                </article>

                <article className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <h2 className="text-sm font-semibold text-slate-900">Load Information</h2>
                  <p className="mt-2 text-xs text-slate-600">Pickup: {load ? formatDate(load.pickupDateFrom) : '—'}</p>
                  <p className="mt-1 text-xs text-slate-600">Delivery: {load ? formatDate(load.deliveryDateFrom) : '—'}</p>
                  <p className="mt-1 text-xs text-slate-600">
                    Price: {toNumber(load?.agreedPrice ?? load?.publishedPrice) > 0
                      ? formatMoney(toNumber(load?.agreedPrice ?? load?.publishedPrice))
                      : '—'}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">Notes: {load?.notes ?? '—'}</p>
                </article>
              </div>
            )}

            {activeSection === 'broker' && (
              <div className="space-y-4">
                <article className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold text-slate-900">Broker Company</h2>
                    {isBrokerCompanySelected && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsChangeBrokerModalOpen(true);
                          setBrokerSearch('');
                          void loadBrokerOptions();
                        }}
                        className="rounded border border-slate-900 bg-slate-900 px-2 py-1 text-xs font-semibold text-white hover:bg-slate-800"
                      >
                        Change Broker
                      </button>
                    )}
                  </div>

                  {!isBrokerCompanySelected && (
                    <>
                      <input
                        type="text"
                        value={brokerSearch}
                        onChange={(event) => setBrokerSearch(event.target.value)}
                        placeholder="Search broker company..."
                        className="mt-3 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                      />
                      <div className="mt-2 overflow-hidden rounded border border-slate-300 bg-white">
                        <div className="max-h-64 overflow-y-auto">
                          <table className="min-w-full text-xs">
                            <thead className="sticky top-0 bg-slate-100 text-left text-[10px] uppercase tracking-wide text-slate-600">
                              <tr>
                                <th className="px-2 py-1.5">Broker</th>
                                <th className="px-2 py-1.5">City</th>
                                <th className="px-2 py-1.5">Country</th>
                                <th className="px-2 py-1.5 text-right">Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {isBrokersLoading && (
                                <tr>
                                  <td className="px-2 py-2 text-slate-500" colSpan={4}>
                                    Loading brokers...
                                  </td>
                                </tr>
                              )}
                              {!isBrokersLoading && brokers.length === 0 && (
                                <tr>
                                  <td className="px-2 py-2 text-slate-500" colSpan={4}>
                                    No brokers found.
                                  </td>
                                </tr>
                              )}
                              {!isBrokersLoading &&
                                brokers.map((broker) => (
                                  <tr key={broker.id} className="border-t border-slate-100">
                                    <td className="px-2 py-1.5 font-semibold text-slate-800">
                                      {broker.companyName}
                                    </td>
                                    <td className="px-2 py-1.5 text-slate-700">{broker.city}</td>
                                    <td className="px-2 py-1.5 text-slate-700">{broker.country}</td>
                                    <td className="px-2 py-1.5 text-right">
                                      <button
                                        type="button"
                                        onClick={() => void confirmAndAssignBroker(broker)}
                                        disabled={isAssigningBroker}
                                        className="rounded border border-slate-900 bg-slate-900 px-2 py-1 text-[10px] font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                                      >
                                        SELECT THIS BROKER
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </>
                  )}

                  {isBrokerCompanySelected && selectedBroker && (
                    <div className="mt-3 grid gap-3 xl:grid-cols-3">
                      <div className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                              Broker Main Card
                            </p>
                            <p className="mt-1 truncate text-lg font-semibold text-slate-900">
                              {selectedBroker.companyName}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => openBrokerEditModal('main')}
                            disabled={isSavingBrokerSection === 'main'}
                            className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                          >
                            Edit
                          </button>
                        </div>

                        <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
                          <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
                            <p className="text-[10px] uppercase tracking-wide text-slate-500">Employees</p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">
                              {selectedBroker.employeeCount ?? '—'}
                            </p>
                          </div>
                          <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
                            <p className="text-[10px] uppercase tracking-wide text-slate-500">Phone</p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">
                              {selectedBroker.phone ?? '—'}
                            </p>
                          </div>
                          <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 sm:col-span-2">
                            <p className="text-[10px] uppercase tracking-wide text-slate-500">Email</p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">
                              {selectedBroker.email ?? '—'}
                            </p>
                          </div>
                          <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 sm:col-span-2">
                            <p className="text-[10px] uppercase tracking-wide text-slate-500">Website</p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">
                              {selectedBroker.website ?? '—'}
                            </p>
                          </div>
                          <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 sm:col-span-2">
                            <p className="text-[10px] uppercase tracking-wide text-slate-500">Address</p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">
                              {selectedBroker.street}, {selectedBroker.postcode} {selectedBroker.city},{' '}
                              {selectedBroker.country}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-300 bg-white p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-slate-700">Trans.eu Overview</p>
                          <button
                            type="button"
                            onClick={() => openBrokerEditModal('transEu')}
                            disabled={isSavingBrokerSection === 'transEu'}
                            className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                          >
                            Edit
                          </button>
                        </div>

                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          <div className="rounded border border-slate-200 bg-slate-50 p-2">
                            <p className="text-[10px] uppercase tracking-wide text-slate-500">Rating</p>
                            <p className="mt-1 text-2xl font-bold text-slate-900">
                              {formatBrokerRating(selectedBroker.transEuRating)}
                            </p>
                          </div>
                          <div className="rounded border border-slate-200 bg-slate-50 p-2">
                            <p className="text-[10px] uppercase tracking-wide text-slate-500">
                              Trans.eu Reviews
                            </p>
                            <p className="mt-1 text-2xl font-bold text-slate-900">
                              {selectedBroker.transEuReviewCount ?? '—'}
                            </p>
                          </div>
                        </div>
                        <div className="mt-3 grid gap-2 sm:grid-cols-3">
                          <div className="rounded border border-emerald-200 bg-emerald-50 p-2">
                            <p className="text-[10px] uppercase tracking-wide text-emerald-700">Paid On Time</p>
                            <p className="mt-1 text-base font-semibold text-emerald-800">
                              {selectedBroker.transEuPaidOnTime ?? '—'}
                            </p>
                          </div>
                          <div className="rounded border border-amber-200 bg-amber-50 p-2">
                            <p className="text-[10px] uppercase tracking-wide text-amber-700">Paid With Delay</p>
                            <p className="mt-1 text-base font-semibold text-amber-800">
                              {selectedBroker.transEuPaidWithDelay ?? '—'}
                            </p>
                          </div>
                          <div className="rounded border border-rose-200 bg-rose-50 p-2">
                            <p className="text-[10px] uppercase tracking-wide text-rose-700">Payment Issues</p>
                            <p className="mt-1 text-base font-semibold text-rose-800">
                              {selectedBroker.transEuPaymentIssues ?? '—'}
                            </p>
                          </div>
                        </div>
                        <div className="mt-2 rounded border border-slate-200 bg-slate-50 p-2">
                          <p className="text-[10px] uppercase tracking-wide text-slate-500">Trans.eu ID</p>
                          <p className="mt-1 truncate text-xl font-bold text-slate-900" title={selectedBroker.transEuId ?? ''}>
                            {selectedBroker.transEuId ?? '—'}
                          </p>
                          <p className="mt-1 text-xs font-semibold text-slate-700">
                            Member Since: {formatDate(selectedBroker.platformMemberSince)}
                          </p>
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-300 bg-white p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-slate-700">Other Broker Fields</p>
                          <button
                            type="button"
                            onClick={() => openBrokerEditModal('other')}
                            disabled={isSavingBrokerSection === 'other'}
                            className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                          >
                            Edit
                          </button>
                        </div>

                        <div className="mt-2 grid gap-1.5 text-xs text-slate-600 sm:grid-cols-2">
                          <p>
                            Legal Name:{' '}
                            <span className="font-semibold text-slate-900">
                              {selectedBroker.legalName ?? '—'}
                            </span>
                          </p>
                          <p>
                            Tax ID:{' '}
                            <span className="font-semibold text-slate-900">
                              {selectedBroker.taxId ?? '—'}
                            </span>
                          </p>
                          <p>
                            VAT ID:{' '}
                            <span className="font-semibold text-slate-900">
                              {selectedBroker.vatId ?? '—'}
                            </span>
                          </p>
                          <p>
                            Insurance Coverage:{' '}
                            <span className="font-semibold text-slate-900">
                              {selectedBroker.insuranceCoverage ?? '—'}
                            </span>
                          </p>
                          <p>
                            Insurance Provider:{' '}
                            <span className="font-semibold text-slate-900">
                              {selectedBroker.insuranceProvider ?? '—'}
                            </span>
                          </p>
                          <p>
                            Insurance Valid Until:{' '}
                            <span className="font-semibold text-slate-900">
                              {formatDate(selectedBroker.insuranceValidUntil)}
                            </span>
                          </p>
                          <p>
                            License Number:{' '}
                            <span className="font-semibold text-slate-900">
                              {selectedBroker.licenseNumber ?? '—'}
                            </span>
                          </p>
                          <p>
                            License Valid Until:{' '}
                            <span className="font-semibold text-slate-900">
                              {formatDate(selectedBroker.licenseValidUntil)}
                            </span>
                          </p>
                          <p>
                            Member Since:{' '}
                            <span className="font-semibold text-slate-900">
                              {formatDate(selectedBroker.platformMemberSince)}
                            </span>
                          </p>
                          <p>
                            Active:{' '}
                            <span className="font-semibold text-slate-900">
                              {selectedBroker.isActive ? 'Yes' : 'No'}
                            </span>
                          </p>
                          <p className="sm:col-span-2">
                            Notes:{' '}
                            <span className="font-semibold text-slate-900">{selectedBroker.notes ?? '—'}</span>
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </article>

                <article className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold text-slate-900">Broker Contact</h2>
                    <button
                      type="button"
                      onClick={() => {
                        setBrokerContactSearch('');
                        setIsNewBrokerContactFormOpen(false);
                        setIsBrokerContactCreateOpen(true);
                      }}
                      disabled={!isBrokerCompanySelected}
                      className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Change Contact
                    </button>
                  </div>

                  {!isBrokerCompanySelected && (
                    <p className="mt-2 rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
                      Select and assign broker company first. Contact section is locked until then.
                    </p>
                  )}

                  <div className={`mt-2 ${!isBrokerCompanySelected ? 'pointer-events-none opacity-45' : ''}`}>
                    <div className="rounded border border-slate-200 bg-white p-3">
                      {selectedBrokerContact ? (
                        <>
                          <p className="text-sm font-semibold text-slate-900">
                            {selectedBrokerContact.firstName} {selectedBrokerContact.lastName}
                          </p>
                          <p className="mt-1 text-[11px] uppercase tracking-wide text-slate-500">
                            {selectedBrokerContact.role}
                          </p>
                          <p className="mt-1 text-xs text-slate-600">
                            Email: {selectedBrokerContact.email ?? '—'}
                          </p>
                          <p className="mt-1 text-xs text-slate-600">
                            Phone: {selectedBrokerContact.phone ?? selectedBrokerContact.mobile ?? '—'}
                          </p>
                        </>
                      ) : (
                        <p className="text-xs text-slate-600">Contact not set on this load.</p>
                      )}
                    </div>
                  </div>
                </article>
              </div>
            )}

            {activeSection === 'statuses' && (
              <div className="space-y-4">
                <article className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold text-slate-900">Load Status Path</h2>
                    <span className="rounded border border-emerald-300 bg-emerald-100 px-2 py-1 text-[11px] font-semibold text-emerald-800">
                      Current: {load ? getLoadStatusLabel(load.status) : '—'}
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {statusProgressSteps.length === 0 ? (
                      <span className="text-sm text-slate-500">No status path.</span>
                    ) : (
                      statusProgressSteps.map((step, index) => {
                        return (
                          <div key={`${step.key}-${index}`} className="flex items-center gap-2">
                            <span
                              className={`rounded-md border-2 px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                                step.isActive
                                  ? 'border-emerald-600 bg-emerald-100 text-emerald-800'
                                  : 'border-slate-300 bg-white text-slate-600'
                              }`}
                            >
                              {step.label}
                            </span>
                            {index < statusProgressSteps.length - 1 ? (
                              <span className="text-sm text-slate-400">→</span>
                            ) : null}
                          </div>
                        );
                      })
                    )}
                  </div>
                </article>
              </div>
            )}

            {activeSection === 'activity' && (
              <div>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-slate-900">Activity Timeline</h2>
                  <span className="text-xs text-slate-500">
                    {filteredActivityEvents.length} / {activityEvents.length} events
                  </span>
                </div>

                <div className="mb-3 flex flex-wrap gap-2">
                  {ACTIVITY_FILTER_ITEMS.map((filterItem) => (
                    <button
                      key={filterItem.id}
                      type="button"
                      onClick={() => setActivityFilter(filterItem.id)}
                      className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                        activityFilter === filterItem.id
                          ? 'bg-slate-900 text-white'
                          : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {filterItem.label} ({activityCounts[filterItem.id]})
                    </button>
                  ))}
                </div>

                {filteredActivityEvents.length === 0 && (
                  <p className="text-sm text-slate-500">
                    {activityEvents.length === 0
                      ? 'No activity events available for this load yet.'
                      : 'No activity events for selected filter.'}
                  </p>
                )}

                {filteredActivityEvents.length > 0 && (
                  <ol className="space-y-2">
                    {filteredActivityEvents.map((event) => (
                      <li key={event.id} className="rounded border border-slate-200 bg-slate-50 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${getActivityKindClass(event.kind)}`}>
                              {event.kind}
                            </span>
                            <p className="text-sm font-semibold text-slate-900">{event.title}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {event.isUpcoming && (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                                UPCOMING
                              </span>
                            )}
                            <span className="text-xs text-slate-500">{formatDate(event.date)}</span>
                          </div>
                        </div>
                        <p className="mt-1 text-xs text-slate-600">{event.detail}</p>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )}

            {activeSection === 'payments' && (
              <div className="space-y-5">
                <article className="rounded-xl border-2 border-slate-300 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Step 1</p>
                  <h2 className="mt-1 text-base font-semibold text-slate-900">Base Amount & Flow</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Base amount is locked from load price. Set payment flow in advance, then manage dates below.
                  </p>

                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs text-slate-500">Base Amount</p>
                      <p className="mt-1 text-lg font-semibold text-slate-900">
                        {baseLoadAmount > 0 ? formatMoney(baseLoadAmount) : '—'}
                      </p>
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs text-slate-500">Payout Status</p>
                      <div className="mt-2 rounded-lg border border-slate-300 bg-white p-2">
                        <span
                          className={`inline-flex w-full items-center justify-center rounded-md border px-2 py-2 text-sm font-bold tracking-wide ${payoutStatusBadgeClass}`}
                        >
                          {payoutStatusLabel.toUpperCase()}
                        </span>
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs font-semibold text-slate-700">Payment Flow</p>
                      {!selectedFlowType && (
                        <div className="mt-2 space-y-2">
                          <p className="text-xs text-slate-600">No flow selected yet.</p>
                          <button
                            type="button"
                            onClick={openFlowModal}
                            className="w-full rounded border border-slate-900 bg-slate-900 px-2 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                          >
                            Set Flow
                          </button>
                        </div>
                      )}
                      {selectedFlowType && (
                        <div className="mt-2 space-y-2">
                          <div className="rounded-lg border-2 border-slate-300 bg-white p-2.5">
                            <div className="flex flex-wrap gap-1.5">
                              <span
                                className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold ${
                                  isInvoitixFlow
                                    ? 'border-blue-400 bg-blue-100 text-blue-900'
                                    : 'border-amber-400 bg-amber-100 text-amber-900'
                                }`}
                              >
                                {isInvoitixFlow ? 'Invoitix' : getValutaModeLabel(paymentWorkflow.valuta.mode)}
                              </span>
                              {isInvoitixFlow && (
                                <>
                                  <span className="inline-flex items-center rounded-full border border-slate-300 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-800">
                                    Sent: {formatDate(paymentWorkflow.invoitix.sentAt)}
                                  </span>
                                  <span className="inline-flex items-center rounded-full border border-slate-300 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-800">
                                    Projected: {formatDate(invoitixProjectedDate)}
                                  </span>
                                </>
                              )}
                              {isValutaFlow && (
                                <>
                                  <span className="inline-flex items-center rounded-full border border-slate-300 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-800">
                                    {getCountdownStartLabel(paymentWorkflow.valuta.countdownStart)}
                                  </span>
                                  <span className="inline-flex items-center rounded-full border border-slate-300 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-800">
                                    {paymentWorkflow.valuta.countdownDays || '—'} day(s)
                                  </span>
                                  {paymentWorkflow.valuta.mode === 'SKONTO' && paymentWorkflow.valuta.skontoPercent && (
                                    <span className="inline-flex items-center rounded-full border border-slate-300 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-800">
                                      {paymentWorkflow.valuta.skontoPercent}%
                                    </span>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={openFlowModal}
                            disabled={isFlowEditLocked}
                            className={`w-full rounded border px-2 py-2 text-xs font-semibold ${
                              isFlowEditLocked
                                ? 'cursor-not-allowed border-slate-300 bg-slate-200 text-slate-500'
                                : 'border-slate-900 bg-slate-900 text-white hover:bg-slate-800'
                            }`}
                          >
                            {isFlowEditLocked ? 'Flow Locked' : 'Edit Flow'}
                          </button>
                          {isFlowEditLocked && (
                            <p className="text-[11px] text-slate-500">
                              Flow is locked after workflow steps start.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {!selectedFlowType && (
                    <article className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                      Set flow to continue with payment dates and confirmation steps.
                    </article>
                  )}

                  {isInvoitixFlow && (
                    <section className="mt-4 rounded-xl border-2 border-blue-300 bg-blue-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Invoitix Flow</p>
                      <div className="mt-3 grid gap-3 md:grid-cols-3">
                      <div className="rounded-lg border border-blue-200 bg-white p-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex h-6 min-w-6 items-center justify-center rounded-md border px-2 text-xs font-bold shadow-sm ${getStepNumberChipClass(
                              isInvoitixStep1Done,
                              isInvoitixStep1InProgress,
                            )}`}
                          >
                            1
                          </span>
                          <p className="text-sm font-semibold text-slate-900">Send To Invoitix</p>
                        </div>
                        {!isInvoitixSentSaved && (
                          <>
                            <label className="mt-2 block text-xs text-slate-600">
                              Send Date
                              <DateTimePicker
                                mode="date"
                                value={paymentWorkflow.invoitix.sentAt ?? ''}
                                onChange={(value) =>
                                  patchInvoitixWorkflow({ sentAt: normalizeNullableDate(value) })
                                }
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() => patchInvoitixWorkflow({ sentAt: getTodayDateInput() })}
                              className="mt-2 w-full rounded border border-blue-300 bg-blue-100 px-2 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-200"
                            >
                              Mark Today
                            </button>
                            <button
                              type="button"
                              onClick={() => void confirmSendToInvoitix()}
                              disabled={isSavingPaymentDetails}
                              className="mt-2 w-full rounded border border-blue-600 bg-blue-600 px-2 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                            >
                              Confirm & Save Send
                            </button>
                          </>
                        )}
                        {isInvoitixSentSaved && (
                          <div className="mt-2 rounded border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-800">
                            Sent to Invoitix: <span className="font-semibold">{formatDate(invoitixSentDate)}</span>
                          </div>
                        )}
                      </div>

                      <div className="rounded-lg border border-blue-200 bg-white p-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex h-6 min-w-6 items-center justify-center rounded-md border px-2 text-xs font-bold shadow-sm ${getStepNumberChipClass(
                              isInvoitixStep2Done,
                              isInvoitixStep2InProgress,
                            )}`}
                          >
                            2
                          </span>
                          <p className="text-sm font-semibold text-slate-900">Projected Payout (48h)</p>
                        </div>
                        <p className="mt-2 text-xs text-slate-600">
                          Fee: {formatMoney(invoitixFeeAmount)} (7% + 3.15 EUR)
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          Payout: {formatMoney(invoitixProjectedPayout)}
                        </p>
                        <p className="mt-1 text-xs text-slate-600">
                          Expected date: {invoitixProjectedDate ? formatDate(invoitixProjectedDate) : '—'}
                        </p>
                        <div className="mt-2 rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">
                          Projected payout is view-only and is tracked automatically after send confirmation.
                        </div>
                      </div>

                      <div className="rounded-lg border border-blue-200 bg-white p-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex h-6 min-w-6 items-center justify-center rounded-md border px-2 text-xs font-bold shadow-sm ${getStepNumberChipClass(
                              isInvoitixStep3Done,
                              isInvoitixStep3InProgress,
                            )}`}
                          >
                            3
                          </span>
                          <p className="text-sm font-semibold text-slate-900">Confirm Payout</p>
                        </div>
                        {!isInvoitixPayoutConfirmed && (
                          <button
                            type="button"
                            onClick={() => void confirmInvoitixPayout()}
                            disabled={!isInvoitixSentSaved || isSavingPaymentDetails}
                            className="mt-2 w-full rounded border border-emerald-500 bg-emerald-500 px-2 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Confirm Payout
                          </button>
                        )}
                        {isInvoitixPayoutConfirmed && (
                          <div className="mt-2 rounded border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-800">
                            Payout confirmed on <span className="font-semibold">{formatDate(paymentWorkflow.invoitix.payoutConfirmedAt)}</span>
                          </div>
                        )}
                        <p className="mt-2 text-xs text-slate-600">
                          Payment status: <span className="font-semibold">{currentPaymentStatus.replaceAll('_', ' ')}</span>
                        </p>
                      </div>
                    </div>
                    </section>
                  )}

                  {isValutaFlow && (
                    <section
                      className={`mt-4 rounded-xl border-2 border-amber-300 bg-amber-50 p-4 transition-opacity ${
                        !isLoadCompleted ? 'opacity-60' : 'opacity-100'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Valuta / Skonto Flow</p>
                      </div>
                      {!isLoadCompleted && (
                        <p className="mt-2 text-xs font-semibold text-amber-800">
                          Locked until load status is completed.
                        </p>
                      )}

                      <div
                        className={`mt-3 grid gap-3 xl:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)] ${
                          !isLoadCompleted ? 'pointer-events-none' : ''
                        }`}
                      >
                        <div className="space-y-3">
                          {paymentWorkflow.valuta.countdownStart === 'EMAIL_COPY_INVOICE' && (
                            <div
                              className={`rounded-lg border p-3 ${
                                isValutaEmailStepDone ? 'border-emerald-300 bg-emerald-50' : 'border-amber-200 bg-white'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`inline-flex h-6 min-w-6 items-center justify-center rounded-md border px-2 text-xs font-bold shadow-sm ${getStepNumberChipClass(
                                      isValutaEmailStepDone,
                                      isValutaEmailStepInProgress,
                                    )}`}
                                  >
                                    1
                                  </span>
                                  <p className="text-sm font-semibold text-slate-900">Send Email Copy + Invoice</p>
                                </div>
                                {isValutaEmailStepDone && (
                                  <span className="rounded-full border border-emerald-300 bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                                    ✓ Done
                                  </span>
                                )}
                              </div>
                              <p className="mt-1 text-[11px] text-slate-600">
                                Complete when email copy + invoice is confirmed as sent.
                              </p>
                              <label className="mt-2 block text-xs text-slate-600">
                                Sent Date
                                <DateTimePicker
                                  mode="date"
                                  value={paymentWorkflow.valuta.invoiceSentAt ?? ''}
                                  onChange={(value) =>
                                    patchValutaWorkflow({ invoiceSentAt: normalizeNullableDate(value) })
                                  }
                                  disabled={isValutaEmailStepDone}
                                />
                              </label>
                              {!isValutaEmailStepDone && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => patchValutaWorkflow({ invoiceSentAt: getTodayDateInput() })}
                                    className="mt-2 w-full rounded border border-amber-300 bg-amber-100 px-2 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-200"
                                  >
                                    Mark Today
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void confirmValutaEmailSent()}
                                    disabled={!isLoadCompleted || isSavingPaymentDetails}
                                    className="mt-2 w-full rounded border border-amber-600 bg-amber-600 px-2 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
                                  >
                                    Confirm Email Sent
                                  </button>
                                </>
                              )}
                            </div>
                          )}

                          {paymentWorkflow.valuta.countdownStart === 'ORIGINALS_RECEIVED' && (
                            <div
                              className={`rounded-lg border p-3 ${
                                isValutaOriginalsSentStepDone
                                  ? 'border-emerald-300 bg-emerald-50'
                                  : isValutaWaitingDriverInProgress
                                    ? 'border-blue-300 bg-blue-50'
                                  : 'border-amber-200 bg-white'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`inline-flex h-6 min-w-6 items-center justify-center rounded-md border px-2 text-xs font-bold shadow-sm ${getStepNumberChipClass(
                                      isValutaOriginalsSentStepDone,
                                      isValutaWaitingDriverInProgress,
                                    )}`}
                                  >
                                    1
                                  </span>
                                  <p className="text-sm font-semibold text-slate-900">Waiting On Driver</p>
                                </div>
                                {isValutaOriginalsSentStepDone && (
                                  <span className="rounded-full border border-emerald-300 bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                                    ✓ Done
                                  </span>
                                )}
                                {!isValutaOriginalsSentStepDone && isValutaWaitingDriverInProgress && (
                                  <span className="rounded-full border border-blue-300 bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                                    IN PROGRESS
                                  </span>
                                )}
                                {!isValutaOriginalsSentStepDone && isValutaWaitingDriverPending && (
                                  <span className="rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                                    PENDING
                                  </span>
                                )}
                              </div>
                              <p className="mt-1 text-[11px] text-slate-600">
                                {isValutaOriginalsSentStepDone
                                  ? 'Driver returned.'
                                  : isValutaWaitingDriverInProgress
                                    ? 'Waiting for driver to return from trip.'
                                    : 'Pending until load is completed.'}
                              </p>
                            </div>
                          )}

                          {paymentWorkflow.valuta.countdownStart === 'ORIGINALS_RECEIVED' && (
                            <div
                              className={`rounded-lg border p-3 ${
                                isValutaOriginalsSentStepDone
                                  ? 'border-emerald-300 bg-emerald-50'
                                  : isValutaSentDocumentsInProgress
                                    ? 'border-blue-300 bg-blue-50'
                                    : 'border-amber-200 bg-white'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`inline-flex h-6 min-w-6 items-center justify-center rounded-md border px-2 text-xs font-bold shadow-sm ${getStepNumberChipClass(
                                      isValutaOriginalsSentStepDone,
                                      isValutaSentDocumentsInProgress,
                                    )}`}
                                  >
                                    2
                                  </span>
                                  <p className="text-sm font-semibold text-slate-900">Sent Documents</p>
                                </div>
                                {isValutaOriginalsSentStepDone && (
                                  <span className="rounded-full border border-emerald-300 bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                                    ✓ Done
                                  </span>
                                )}
                                {!isValutaOriginalsSentStepDone && isValutaSentDocumentsInProgress && (
                                  <span className="rounded-full border border-blue-300 bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                                    IN PROGRESS
                                  </span>
                                )}
                                {!isValutaOriginalsSentStepDone && isValutaSentDocumentsPending && (
                                  <span className="rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                                    PENDING
                                  </span>
                                )}
                              </div>
                              <p className="mt-1 text-[11px] text-slate-600">
                                Complete when originals are sent to broker with date and tracking number.
                              </p>
                              <label className="mt-2 block text-xs text-slate-600">
                                Sent Date
                                <DateTimePicker
                                  mode="date"
                                  value={paymentWorkflow.valuta.shippedAt ?? ''}
                                  onChange={(value) =>
                                    patchValutaWorkflow({ shippedAt: normalizeNullableDate(value) })
                                  }
                                  disabled={isValutaOriginalsSentStepDone}
                                />
                              </label>
                              <label className="mt-2 block text-xs text-slate-600">
                                Tracking Number
                                <input
                                  type="text"
                                  value={paymentWorkflow.valuta.trackingNumber}
                                  onChange={(event) => patchValutaWorkflow({ trackingNumber: event.target.value })}
                                  placeholder="e.g. RR384756221DE"
                                  disabled={isValutaOriginalsSentStepDone}
                                  className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 disabled:bg-slate-100"
                                />
                              </label>
                              {!isValutaOriginalsSentStepDone && (
                                <button
                                  type="button"
                                  onClick={() => void confirmValutaOriginalsSent()}
                                  disabled={!isLoadCompleted || !paymentWorkflow.valuta.trackingNumber.trim() || isSavingPaymentDetails}
                                  className="mt-2 w-full rounded border border-amber-600 bg-amber-600 px-2 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
                                >
                                  Confirm Sent Documents
                                </button>
                              )}
                            </div>
                          )}

                          {paymentWorkflow.valuta.countdownStart === 'ORIGINALS_RECEIVED' && (
                            <div
                              className={`rounded-lg border p-3 ${
                                isValutaOriginalsArrivedStepDone
                                  ? 'border-emerald-300 bg-emerald-50'
                                  : isValutaWaitingOriginalsInProgress
                                    ? 'border-blue-300 bg-blue-50'
                                  : 'border-amber-200 bg-white'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`inline-flex h-6 min-w-6 items-center justify-center rounded-md border px-2 text-xs font-bold shadow-sm ${getStepNumberChipClass(
                                      isValutaOriginalsArrivedStepDone,
                                      isValutaWaitingOriginalsInProgress,
                                    )}`}
                                  >
                                    3
                                  </span>
                                  <p className="text-sm font-semibold text-slate-900">Waiting For Originals</p>
                                </div>
                                {isValutaOriginalsArrivedStepDone && (
                                  <span className="rounded-full border border-emerald-300 bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                                    ✓ Done
                                  </span>
                                )}
                                {!isValutaOriginalsArrivedStepDone && isValutaWaitingOriginalsInProgress && (
                                  <span className="rounded-full border border-blue-300 bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                                    IN PROGRESS
                                  </span>
                                )}
                                {!isValutaOriginalsArrivedStepDone && isValutaWaitingOriginalsPending && (
                                  <span className="rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                                    PENDING
                                  </span>
                                )}
                              </div>
                              <p className="mt-1 text-[11px] text-slate-600">
                                {isValutaWaitingOriginalsInProgress
                                  ? 'Originals are on the way. Confirm once broker receives them.'
                                  : 'Pending until originals are sent with tracking number.'}
                              </p>
                              <label className="mt-2 block text-xs text-slate-600">
                                Arrival Date
                                <DateTimePicker
                                  mode="date"
                                  value={paymentWorkflow.valuta.documentsArrivedAt ?? ''}
                                  onChange={(value) =>
                                    patchValutaWorkflow({ documentsArrivedAt: normalizeNullableDate(value) })
                                  }
                                  disabled={isValutaOriginalsArrivedStepDone}
                                />
                              </label>
                              {!isValutaOriginalsArrivedStepDone && (
                                <button
                                  type="button"
                                  onClick={() => void confirmValutaOriginalsArrived()}
                                  disabled={!paymentWorkflow.valuta.shippedAt || isSavingPaymentDetails}
                                  className="mt-2 w-full rounded border border-amber-600 bg-amber-600 px-2 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
                                >
                                  Confirm Originals Arrived
                                </button>
                              )}
                            </div>
                          )}

                        </div>

                        <div className="space-y-3">
                          <div
                            className={`rounded-lg border p-3 ${
                              isValutaCountdownStepDone
                                ? 'border-emerald-300 bg-emerald-50'
                                : isValutaCountdownInProgress
                                  ? 'border-blue-300 bg-blue-50'
                                  : 'border-amber-200 bg-white'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`inline-flex h-6 min-w-6 items-center justify-center rounded-md border px-2 text-xs font-bold shadow-sm ${getStepNumberChipClass(
                                    isValutaCountdownStepDone,
                                    isValutaCountdownInProgress,
                                  )}`}
                                >
                                  {paymentWorkflow.valuta.countdownStart === 'ORIGINALS_RECEIVED' ? '4' : '2'}
                                </span>
                                <p className="text-sm font-semibold text-slate-900">Countdown & Payout</p>
                              </div>
                              {isValutaCountdownStepDone && (
                                <span className="rounded-full border border-emerald-300 bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                                  ✓ Done
                                </span>
                              )}
                              {!isValutaCountdownStepDone && isValutaCountdownInProgress && (
                                <span className="rounded-full border border-blue-300 bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                                  IN PROGRESS
                                </span>
                              )}
                              {!isValutaCountdownStepDone && !isValutaCountdownInProgress && (
                                <span className="rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                                  PENDING
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-[11px] text-slate-600">
                              {isValutaCountdownStepDone
                                ? 'Countdown is complete and payout is confirmed.'
                                : isValutaCountdownInProgress
                                  ? 'Projected payout date is set. Keep this step in progress until payout is confirmed.'
                                  : 'Set countdown start date and days to generate projected payout date.'}
                            </p>
                            <p className="mt-2 text-xs text-slate-600">
                              Start rule: <span className="font-semibold">{getCountdownStartLabel(paymentWorkflow.valuta.countdownStart)}</span>
                            </p>
                            <p className="mt-1 text-xs text-slate-600">
                              Start date: <span className="font-semibold">{formatDate(valutaCountdownStartDate)}</span>
                            </p>
                            <p className="mt-1 text-xs text-slate-600">
                              Countdown: <span className="font-semibold">{paymentWorkflow.valuta.countdownDays || '—'} day(s)</span>
                            </p>
                            <p className="mt-1 text-xs text-slate-600">
                              Projected payout date: <span className="font-semibold">{formatDate(valutaProjectedDate)}</span>
                            </p>
                            <p className="mt-1 text-xs text-slate-600">
                              Days left:{' '}
                              <span className="font-semibold">
                                {valutaDaysLeft === null
                                  ? '—'
                                  : valutaDaysLeft >= 0
                                    ? `${valutaDaysLeft} day(s)`
                                    : `Overdue ${Math.abs(valutaDaysLeft)} day(s)`}
                              </span>
                            </p>
                            {!isValutaPayoutConfirmed && (
                              <button
                                type="button"
                                onClick={() => void confirmValutaPayout()}
                                disabled={!isLoadCompleted || !valutaProjectedDate || isSavingPaymentDetails}
                                className="mt-2 w-full rounded border border-emerald-500 bg-emerald-500 px-2 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-60"
                              >
                                Confirm Payout
                              </button>
                            )}
                            {isValutaPayoutConfirmed && (
                              <p className="mt-2 rounded border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-xs text-emerald-800">
                                Payout confirmed on{' '}
                                <span className="font-semibold">{formatDate(paymentWorkflow.valuta.payoutReceivedAt)}</span>
                              </p>
                            )}

                            <label className="mt-2 block text-xs text-slate-600">
                              Bank Flat Fee
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={paymentWorkflow.valuta.bankFeeAmount}
                                onChange={(event) => patchValutaWorkflow({ bankFeeAmount: event.target.value })}
                                disabled={!isValutaPayoutConfirmed}
                                readOnly={isValutaBankFeeSaved}
                                className={`mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900 disabled:bg-slate-100 ${
                                  isValutaBankFeeSaved ? 'bg-slate-100' : 'bg-white'
                                }`}
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() => void saveValutaBankFee()}
                              disabled={!isValutaPayoutConfirmed || isValutaBankFeeSaved || isSavingPaymentDetails}
                              className="mt-2 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                            >
                              {isValutaBankFeeSaved ? 'Bank Fee Saved' : 'Save Bank Fee'}
                            </button>
                            <p className="mt-2 text-xs text-slate-600">
                              Projected payout: <span className="font-semibold">{formatMoney(projectedPayout)}</span>
                            </p>
                          </div>
                        </div>
                      </div>
                    </section>
                  )}
                </article>
              </div>
            )}

            {activeSection === 'documents' && (
              <div>
                <h2 className="mb-3 text-sm font-semibold text-slate-900">Documents</h2>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="text-left text-[11px] uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-2 py-1">Type</th>
                        <th className="px-2 py-1">Title</th>
                        <th className="px-2 py-1">Issued</th>
                        <th className="px-2 py-1">Valid Until</th>
                        <th className="px-2 py-1">File</th>
                      </tr>
                    </thead>
                    <tbody>
                      {documents.length === 0 && (
                        <tr>
                          <td className="px-2 py-3 text-slate-500" colSpan={5}>
                            No documents attached to this load yet.
                          </td>
                        </tr>
                      )}
                      {documents.map((document) => (
                        <tr key={document.id} className="border-t border-slate-100">
                          <td className="px-2 py-1.5 text-slate-700">{document.documentType}</td>
                          <td className="px-2 py-1.5 text-slate-900">{document.title}</td>
                          <td className="px-2 py-1.5 text-slate-700">{formatDate(document.issuedAt)}</td>
                          <td className="px-2 py-1.5 text-slate-700">{formatDate(document.validUntil)}</td>
                          <td className="px-2 py-1.5 text-slate-700">{document.fileName}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeSection === 'stops' && (
              <div>
                <h2 className="mb-3 text-sm font-semibold text-slate-900">Stops</h2>
                <div className="space-y-2">
                  {orderedStops.length === 0 && (
                    <p className="text-sm text-slate-500">No stops defined for this load.</p>
                  )}
                  {orderedStops.map((stop) => (
                    <article key={stop.id} className="rounded border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {stop.stopType} #{stop.orderIndex + 1}
                      </p>
                      <p className="mt-1 text-sm font-medium text-slate-900">
                        {stop.country}, {stop.postcode}, {stop.city}
                      </p>
                      <p className="mt-1 text-xs text-slate-600">{stop.address}</p>
                      <p className="mt-1 text-xs text-slate-600">
                        Window: {formatDate(stop.dateFrom)}{stop.dateTo ? ` - ${formatDate(stop.dateTo)}` : ''}
                      </p>
                      <p className="mt-1 text-xs text-slate-600">
                        Pallets: {stop.pallets ?? '—'} • Notes: {stop.notes ?? '—'}
                      </p>
                    </article>
                  ))}
                </div>
              </div>
            )}

            {activeSection === 'freight' && (
              <div className="grid gap-3 md:grid-cols-2">
                <article className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <h2 className="text-sm font-semibold text-slate-900">Freight Metrics</h2>
                  <p className="mt-2 text-xs text-slate-600">
                    Weight: {toNumber(load?.freightDetails?.weightTons).toFixed(2)} t
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    Loading meters: {toNumber(load?.freightDetails?.loadingMeters).toFixed(2)}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">Pallets: {palletsTotal}</p>
                  <p className="mt-1 text-xs text-slate-600">
                    Body type: {load?.freightDetails?.bodyType ?? '—'}
                  </p>
                </article>

                <article className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <h2 className="text-sm font-semibold text-slate-900">Pallet Details</h2>
                  {(load?.pallets ?? []).length === 0 && (
                    <p className="mt-2 text-xs text-slate-500">No pallet rows.</p>
                  )}
                  {(load?.pallets ?? []).map((pallet) => (
                    <p key={pallet.id} className="mt-1 text-xs text-slate-600">
                      {(pallet.label ?? 'Pallet').trim()} • {pallet.widthCm}x{pallet.heightCm}
                      {pallet.depthCm ? `x${pallet.depthCm}` : ''} cm • qty {pallet.quantity}
                    </p>
                  ))}
                </article>
              </div>
            )}

            {activeSection === 'contacts' && (
              <div className="grid gap-3 md:grid-cols-2">
                <article className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <h2 className="text-sm font-semibold text-slate-900">Broker Contact</h2>
                  <p className="mt-2 text-xs text-slate-600">
                    Company: {load?.broker?.companyName ?? load?.brokerageName ?? '—'}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">Contact person: {load?.contactPerson ?? '—'}</p>
                  <p className="mt-1 text-xs text-slate-600">Phone: {load?.contactPhone ?? '—'}</p>
                  <p className="mt-1 text-xs text-slate-600">Email: {load?.contactEmail ?? '—'}</p>
                </article>

                <article className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <h2 className="text-sm font-semibold text-slate-900">Address Snapshot</h2>
                  <p className="mt-2 text-xs text-slate-600">
                    Pickup: {load?.pickupCountry}, {load?.pickupPostcode}, {load?.pickupCity}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">{load?.pickupAddress ?? '—'}</p>
                  <p className="mt-2 text-xs text-slate-600">
                    Delivery: {load?.deliveryCountry}, {load?.deliveryPostcode}, {load?.deliveryCity}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">{load?.deliveryAddress ?? '—'}</p>
                </article>
              </div>
            )}
          </section>
        </div>
      </div>

      {brokerEditModal && selectedBroker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-4 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Broker Company</p>
                <h3 className="text-base font-semibold text-slate-900">
                  {brokerEditModal === 'main'
                    ? 'Edit Main Card'
                    : brokerEditModal === 'transEu'
                      ? 'Edit Trans.eu Overview'
                      : 'Edit Other Broker Fields'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setBrokerEditModal(null)}
                disabled={isSavingBrokerSection !== null}
                className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
              >
                Close
              </button>
            </div>

            {brokerEditModal === 'main' && (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <label className="text-xs text-slate-600 sm:col-span-2">
                  Company
                  <input
                    type="text"
                    value={brokerMainDraft.companyName}
                    onChange={(event) =>
                      setBrokerMainDraft((prev) => ({ ...prev, companyName: event.target.value }))
                    }
                    className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                  />
                </label>
                <label className="text-xs text-slate-600">
                  Employees
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={brokerMainDraft.employeeCount}
                    onChange={(event) =>
                      setBrokerMainDraft((prev) => ({ ...prev, employeeCount: event.target.value }))
                    }
                    className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                  />
                </label>
                <label className="text-xs text-slate-600">
                  Phone
                  <input
                    type="text"
                    value={brokerMainDraft.phone}
                    onChange={(event) =>
                      setBrokerMainDraft((prev) => ({ ...prev, phone: event.target.value }))
                    }
                    className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                  />
                </label>
                <label className="text-xs text-slate-600 sm:col-span-2">
                  Email
                  <input
                    type="email"
                    value={brokerMainDraft.email}
                    onChange={(event) =>
                      setBrokerMainDraft((prev) => ({ ...prev, email: event.target.value }))
                    }
                    className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                  />
                </label>
                <label className="text-xs text-slate-600 sm:col-span-2">
                  Website
                  <input
                    type="text"
                    value={brokerMainDraft.website}
                    onChange={(event) =>
                      setBrokerMainDraft((prev) => ({ ...prev, website: event.target.value }))
                    }
                    className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                  />
                </label>
                <label className="text-xs text-slate-600 sm:col-span-2">
                  Street
                  <input
                    type="text"
                    value={brokerMainDraft.street}
                    onChange={(event) =>
                      setBrokerMainDraft((prev) => ({ ...prev, street: event.target.value }))
                    }
                    className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                  />
                </label>
                <label className="text-xs text-slate-600">
                  Postcode
                  <input
                    type="text"
                    value={brokerMainDraft.postcode}
                    onChange={(event) =>
                      setBrokerMainDraft((prev) => ({ ...prev, postcode: event.target.value }))
                    }
                    className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                  />
                </label>
                <label className="text-xs text-slate-600">
                  City
                  <input
                    type="text"
                    value={brokerMainDraft.city}
                    onChange={(event) =>
                      setBrokerMainDraft((prev) => ({ ...prev, city: event.target.value }))
                    }
                    className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                  />
                </label>
                <label className="text-xs text-slate-600 sm:col-span-2">
                  Country
                  <input
                    type="text"
                    value={brokerMainDraft.country}
                    onChange={(event) =>
                      setBrokerMainDraft((prev) => ({ ...prev, country: event.target.value }))
                    }
                    className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void saveBrokerMainSection()}
                  disabled={isSavingBrokerSection === 'main'}
                  className="sm:col-span-2 mt-1 w-full rounded border border-slate-900 bg-slate-900 px-2 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {isSavingBrokerSection === 'main' ? 'Saving...' : 'Save Main Card'}
                </button>
              </div>
            )}

            {brokerEditModal === 'transEu' && (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <label className="text-xs text-slate-600 sm:col-span-2">
                  Trans.eu ID
                  <input
                    type="text"
                    value={brokerTransEuDraft.transEuId}
                    onChange={(event) =>
                      setBrokerTransEuDraft((prev) => ({
                        ...prev,
                        transEuId: event.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                  />
                </label>
                <label className="text-xs text-slate-600">
                  Rating
                  <input
                    type="text"
                    value={brokerTransEuDraft.transEuRating}
                    onChange={(event) =>
                      setBrokerTransEuDraft((prev) => ({
                        ...prev,
                        transEuRating: event.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                  />
                </label>
                <label className="text-xs text-slate-600">
                  Reviews
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={brokerTransEuDraft.transEuReviewCount}
                    onChange={(event) =>
                      setBrokerTransEuDraft((prev) => ({
                        ...prev,
                        transEuReviewCount: event.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                  />
                </label>
                <label className="text-xs text-slate-600">
                  Paid On Time
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={brokerTransEuDraft.transEuPaidOnTime}
                    onChange={(event) =>
                      setBrokerTransEuDraft((prev) => ({
                        ...prev,
                        transEuPaidOnTime: event.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                  />
                </label>
                <label className="text-xs text-slate-600">
                  Paid With Delay
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={brokerTransEuDraft.transEuPaidWithDelay}
                    onChange={(event) =>
                      setBrokerTransEuDraft((prev) => ({
                        ...prev,
                        transEuPaidWithDelay: event.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                  />
                </label>
                <label className="text-xs text-slate-600 sm:col-span-2">
                  Payment Issues
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={brokerTransEuDraft.transEuPaymentIssues}
                    onChange={(event) =>
                      setBrokerTransEuDraft((prev) => ({
                        ...prev,
                        transEuPaymentIssues: event.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void saveBrokerTransEuSection()}
                  disabled={isSavingBrokerSection === 'transEu'}
                  className="sm:col-span-2 mt-1 w-full rounded border border-slate-900 bg-slate-900 px-2 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {isSavingBrokerSection === 'transEu' ? 'Saving...' : 'Save Trans.eu Overview'}
                </button>
              </div>
            )}

            {brokerEditModal === 'other' && (
              <div className="mt-3 grid max-h-[70vh] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                <label className="text-xs text-slate-600 sm:col-span-2">
                  Legal Name
                  <input
                    type="text"
                    value={brokerOtherDraft.legalName}
                    onChange={(event) =>
                      setBrokerOtherDraft((prev) => ({ ...prev, legalName: event.target.value }))
                    }
                    className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                  />
                </label>
                <label className="text-xs text-slate-600">
                  Tax ID
                  <input
                    type="text"
                    value={brokerOtherDraft.taxId}
                    onChange={(event) =>
                      setBrokerOtherDraft((prev) => ({ ...prev, taxId: event.target.value }))
                    }
                    className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                  />
                </label>
                <label className="text-xs text-slate-600">
                  VAT ID
                  <input
                    type="text"
                    value={brokerOtherDraft.vatId}
                    onChange={(event) =>
                      setBrokerOtherDraft((prev) => ({ ...prev, vatId: event.target.value }))
                    }
                    className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                  />
                </label>
                <label className="text-xs text-slate-600">
                  Insurance Coverage
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={brokerOtherDraft.insuranceCoverage}
                    onChange={(event) =>
                      setBrokerOtherDraft((prev) => ({
                        ...prev,
                        insuranceCoverage: event.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                  />
                </label>
                <label className="text-xs text-slate-600">
                  Insurance Provider
                  <input
                    type="text"
                    value={brokerOtherDraft.insuranceProvider}
                    onChange={(event) =>
                      setBrokerOtherDraft((prev) => ({
                        ...prev,
                        insuranceProvider: event.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                  />
                </label>
                <label className="text-xs text-slate-600">
                  Insurance Valid Until
                  <DateTimePicker
                    mode="date"
                    value={brokerOtherDraft.insuranceValidUntil}
                    onChange={(value) =>
                      setBrokerOtherDraft((prev) => ({
                        ...prev,
                        insuranceValidUntil: value,
                      }))
                    }
                  />
                </label>
                <label className="text-xs text-slate-600">
                  License Number
                  <input
                    type="text"
                    value={brokerOtherDraft.licenseNumber}
                    onChange={(event) =>
                      setBrokerOtherDraft((prev) => ({
                        ...prev,
                        licenseNumber: event.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                  />
                </label>
                <label className="text-xs text-slate-600">
                  License Valid Until
                  <DateTimePicker
                    mode="date"
                    value={brokerOtherDraft.licenseValidUntil}
                    onChange={(value) =>
                      setBrokerOtherDraft((prev) => ({
                        ...prev,
                        licenseValidUntil: value,
                      }))
                    }
                  />
                </label>
                <label className="text-xs text-slate-600">
                  Platform Member Since
                  <DateTimePicker
                    mode="date"
                    value={brokerOtherDraft.platformMemberSince}
                    onChange={(value) =>
                      setBrokerOtherDraft((prev) => ({
                        ...prev,
                        platformMemberSince: value,
                      }))
                    }
                  />
                </label>
                <label className="text-xs text-slate-600">
                  Active
                  <select
                    value={brokerOtherDraft.isActive ? 'yes' : 'no'}
                    onChange={(event) =>
                      setBrokerOtherDraft((prev) => ({
                        ...prev,
                        isActive: event.target.value === 'yes',
                      }))
                    }
                    className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                  >
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </label>
                <label className="text-xs text-slate-600 sm:col-span-2">
                  Notes
                  <textarea
                    value={brokerOtherDraft.notes}
                    onChange={(event) =>
                      setBrokerOtherDraft((prev) => ({ ...prev, notes: event.target.value }))
                    }
                    rows={3}
                    className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void saveBrokerOtherSection()}
                  disabled={isSavingBrokerSection === 'other'}
                  className="sm:col-span-2 mt-1 w-full rounded border border-slate-900 bg-slate-900 px-2 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {isSavingBrokerSection === 'other' ? 'Saving...' : 'Save Other Broker Fields'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {isBrokerContactCreateOpen && isBrokerCompanySelected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-3xl rounded-xl border border-slate-200 bg-white p-4 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Broker Contact
                </p>
                <h3 className="text-base font-semibold text-slate-900">Change Contact</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsBrokerContactCreateOpen(false);
                  setIsNewBrokerContactFormOpen(false);
                }}
                disabled={isCreatingBrokerContact}
                className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
              >
                Close
              </button>
            </div>

            <label className="mt-3 block text-xs text-slate-600">
              Search Contacts
              <input
                type="text"
                value={brokerContactSearch}
                onChange={(event) => setBrokerContactSearch(event.target.value)}
                placeholder="Search by name, role, email, or phone..."
                className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900"
              />
            </label>

            <div className="mt-2 overflow-hidden rounded border border-slate-300 bg-white">
              <div className="max-h-64 overflow-y-auto">
                <table className="min-w-full text-xs">
                  <thead className="sticky top-0 bg-slate-100 text-left text-[10px] uppercase tracking-wide text-slate-600">
                    <tr>
                      <th className="px-2 py-1.5">Name</th>
                      <th className="px-2 py-1.5">Role</th>
                      <th className="px-2 py-1.5">Email</th>
                      <th className="px-2 py-1.5">Phone</th>
                      <th className="px-2 py-1.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isBrokerContactsLoading && (
                      <tr>
                        <td className="px-2 py-2 text-slate-500" colSpan={5}>
                          Loading contacts...
                        </td>
                      </tr>
                    )}
                    {!isBrokerContactsLoading && brokerContacts.length === 0 && (
                      <tr>
                        <td className="px-2 py-2 text-slate-500" colSpan={5}>
                          No contacts for this broker yet.
                        </td>
                      </tr>
                    )}
                    {!isBrokerContactsLoading &&
                      brokerContacts.length > 0 &&
                      filteredBrokerContacts.length === 0 && (
                        <tr>
                          <td className="px-2 py-2 text-slate-500" colSpan={5}>
                            No contacts match your search.
                          </td>
                        </tr>
                      )}
                    {!isBrokerContactsLoading &&
                      filteredBrokerContacts.map((contact) => {
                        const isCurrentOnLoad = selectedBrokerContactId === contact.id;
                        return (
                          <tr key={contact.id} className="border-t border-slate-100">
                            <td className="px-2 py-1.5 font-semibold text-slate-800">
                              {contact.firstName} {contact.lastName}
                            </td>
                            <td className="px-2 py-1.5 text-slate-700">{contact.role}</td>
                            <td className="px-2 py-1.5 text-slate-700">{contact.email ?? '—'}</td>
                            <td className="px-2 py-1.5 text-slate-700">
                              {contact.phone ?? contact.mobile ?? '—'}
                            </td>
                            <td className="px-2 py-1.5 text-right">
                              <button
                                type="button"
                                onClick={() =>
                                  void assignBrokerContactToLoad(contact.id, undefined, {
                                    closeModal: true,
                                  })
                                }
                                disabled={isAssigningBrokerContact || isCurrentOnLoad}
                                className={`rounded border px-2 py-1 text-[10px] font-semibold ${
                                  isCurrentOnLoad
                                    ? 'border-emerald-300 bg-emerald-100 text-emerald-800'
                                    : 'border-slate-900 bg-slate-900 text-white hover:bg-slate-800'
                                } disabled:cursor-not-allowed disabled:opacity-60`}
                              >
                                {isCurrentOnLoad ? 'Assigned' : 'Assign'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsNewBrokerContactFormOpen((prev) => !prev)}
              className="mt-3 rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              {isNewBrokerContactFormOpen ? 'Close Add Contact' : 'Add New Contact'}
            </button>

            {isNewBrokerContactFormOpen && (
              <div className="mt-3 rounded border border-slate-300 bg-slate-50 p-3">
                <p className="text-xs font-semibold text-slate-700">Create New Contact</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <input
                    type="text"
                    value={newContactForm.firstName}
                    onChange={(event) =>
                      setNewContactForm((prev) => ({ ...prev, firstName: event.target.value }))
                    }
                    placeholder="First Name *"
                    className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                  />
                  <input
                    type="text"
                    value={newContactForm.lastName}
                    onChange={(event) =>
                      setNewContactForm((prev) => ({ ...prev, lastName: event.target.value }))
                    }
                    placeholder="Last Name *"
                    className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                  />
                  <select
                    value={newContactForm.role}
                    onChange={(event) =>
                      setNewContactForm((prev) => ({
                        ...prev,
                        role: event.target.value as ContactRole,
                      }))
                    }
                    className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                  >
                    {CONTACT_ROLE_OPTIONS.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                  <input
                    type="email"
                    value={newContactForm.email}
                    onChange={(event) =>
                      setNewContactForm((prev) => ({ ...prev, email: event.target.value }))
                    }
                    placeholder="Email"
                    className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                  />
                  <input
                    type="text"
                    value={newContactForm.phone}
                    onChange={(event) =>
                      setNewContactForm((prev) => ({ ...prev, phone: event.target.value }))
                    }
                    placeholder="Phone"
                    className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                  />
                  <input
                    type="text"
                    value={newContactForm.mobile}
                    onChange={(event) =>
                      setNewContactForm((prev) => ({ ...prev, mobile: event.target.value }))
                    }
                    placeholder="Mobile"
                    className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => void createBrokerContact()}
                  disabled={isCreatingBrokerContact}
                  className="mt-3 w-full rounded border border-emerald-600 bg-emerald-600 px-2 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  {isCreatingBrokerContact ? 'Creating Contact...' : 'Create Contact'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {isChangeBrokerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-3xl rounded-xl border border-slate-200 bg-white p-4 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Broker Company
                </p>
                <h3 className="text-base font-semibold text-slate-900">Change Broker</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsChangeBrokerModalOpen(false)}
                className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Close
              </button>
            </div>

            <input
              type="text"
              value={brokerSearch}
              onChange={(event) => setBrokerSearch(event.target.value)}
              placeholder="Search broker company..."
              className="mt-3 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            />

            <div className="mt-3 overflow-hidden rounded border border-slate-300 bg-white">
              <div className="max-h-72 overflow-y-auto">
                <table className="min-w-full text-xs">
                  <thead className="sticky top-0 bg-slate-100 text-left text-[10px] uppercase tracking-wide text-slate-600">
                    <tr>
                      <th className="px-2 py-1.5">Broker</th>
                      <th className="px-2 py-1.5">City</th>
                      <th className="px-2 py-1.5">Country</th>
                      <th className="px-2 py-1.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isBrokersLoading && (
                      <tr>
                        <td className="px-2 py-2 text-slate-500" colSpan={4}>
                          Loading brokers...
                        </td>
                      </tr>
                    )}
                    {!isBrokersLoading && brokers.length === 0 && (
                      <tr>
                        <td className="px-2 py-2 text-slate-500" colSpan={4}>
                          No brokers found.
                        </td>
                      </tr>
                    )}
                    {!isBrokersLoading &&
                      brokers.map((broker) => (
                        <tr key={broker.id} className="border-t border-slate-100">
                          <td className="px-2 py-1.5 font-semibold text-slate-800">
                            {broker.companyName}
                          </td>
                          <td className="px-2 py-1.5 text-slate-700">{broker.city}</td>
                          <td className="px-2 py-1.5 text-slate-700">{broker.country}</td>
                          <td className="px-2 py-1.5 text-right">
                            <button
                              type="button"
                              onClick={() =>
                                void confirmAndAssignBroker(broker, { closeModal: true })
                              }
                              disabled={isAssigningBroker}
                              className="rounded border border-slate-900 bg-slate-900 px-2 py-1 text-[10px] font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                            >
                              SELECT THIS BROKER
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {isFlowModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-xl rounded-xl border border-slate-200 bg-white p-4 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Payment Flow</p>
                <h3 className="text-base font-semibold text-slate-900">Set Flow</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsFlowModalOpen(false)}
                className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Close
              </button>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => patchFlowDraft({ flowType: 'INVOITIX' })}
                className={`rounded border px-2 py-1.5 text-xs font-semibold ${
                  flowDraft.flowType === 'INVOITIX'
                    ? 'border-blue-500 bg-blue-100 text-blue-800'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                }`}
              >
                Invoitix
              </button>
              <button
                type="button"
                onClick={() => patchFlowDraft({ flowType: 'VALUTA' })}
                className={`rounded border px-2 py-1.5 text-xs font-semibold ${
                  flowDraft.flowType === 'VALUTA'
                    ? 'border-amber-500 bg-amber-100 text-amber-800'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                }`}
              >
                Valuta / Skonto
              </button>
            </div>

            {flowDraft.flowType === 'VALUTA' && (
              <div className="mt-3 space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <div>
                  <p className="text-xs font-semibold text-slate-900">Mode</p>
                  <div className="mt-1 flex gap-2">
                    <button
                      type="button"
                      onClick={() => patchValutaDraft({ mode: 'VALUTA' })}
                      className={`flex-1 rounded border px-2 py-1.5 text-xs font-semibold ${
                        flowDraft.valuta.mode === 'VALUTA'
                          ? 'border-amber-500 bg-amber-100 text-amber-800'
                          : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      Valuta
                    </button>
                    <button
                      type="button"
                      onClick={() => patchValutaDraft({ mode: 'SKONTO' })}
                      className={`flex-1 rounded border px-2 py-1.5 text-xs font-semibold ${
                        flowDraft.valuta.mode === 'SKONTO'
                          ? 'border-amber-500 bg-amber-100 text-amber-800'
                          : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      Skonto
                    </button>
                  </div>
                </div>

                {flowDraft.valuta.mode === 'SKONTO' && (
                  <label className="block text-xs text-slate-700">
                    Skonto %
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={flowDraft.valuta.skontoPercent}
                      onChange={(event) => patchValutaDraft({ skontoPercent: event.target.value })}
                      className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                    />
                  </label>
                )}

                <div>
                  <p className="text-xs font-semibold text-slate-900">Countdown Start</p>
                  <div className="mt-1 grid gap-2">
                    <button
                      type="button"
                      onClick={() => patchValutaDraft({ countdownStart: 'ORIGINALS_RECEIVED' })}
                      className={`rounded border px-2 py-1.5 text-left text-xs font-semibold ${
                        flowDraft.valuta.countdownStart === 'ORIGINALS_RECEIVED'
                          ? 'border-amber-500 bg-amber-100 text-amber-800'
                          : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      Start on originals arrival
                    </button>
                    <button
                      type="button"
                      onClick={() => patchValutaDraft({ countdownStart: 'EMAIL_COPY_INVOICE' })}
                      className={`rounded border px-2 py-1.5 text-left text-xs font-semibold ${
                        flowDraft.valuta.countdownStart === 'EMAIL_COPY_INVOICE'
                          ? 'border-amber-500 bg-amber-100 text-amber-800'
                          : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      Start on email copy + invoice
                    </button>
                  </div>
                </div>

                <label className="block text-xs text-slate-700">
                  Countdown Days
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={flowDraft.valuta.countdownDays}
                    onChange={(event) => patchValutaDraft({ countdownDays: event.target.value })}
                    className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                  />
                </label>
              </div>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsFlowModalOpen(false)}
                className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void saveFlowSelection()}
                disabled={!flowDraft.flowType || isSavingPaymentDetails}
                className="rounded border border-slate-900 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {isSavingPaymentDetails ? 'Saving...' : 'Save Flow'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
