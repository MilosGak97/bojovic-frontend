import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw, X } from 'lucide-react';
import { customIncomeApi, driverPayApi, expenseApi, loadApi, paymentApi } from '../api';
import type { CustomIncome, DriverPayRecord, Expense, Load, PaymentRecord } from '../domain/entities';
import {
  Currency,
  ExpenseCategory,
  ExpenseRecurrence,
  ExpenseType,
  LoadStatus,
  PaymentStatus,
} from '../domain/enums';
import { ThinModuleMenu } from './components/ThinModuleMenu';
import { DateTimePicker } from './components/DateTimePicker';

type LedgerEventKind = 'INCOME' | 'FIXED' | 'VARIABLE';

type LedgerEvent = {
  id: string;
  date: string;
  kind: LedgerEventKind;
  label: string;
  amount: number;
  source?: 'PAYMENT' | 'CUSTOM';
  editableType?: 'FIXED_EXPENSE' | 'FIXED_INCOME';
  entityId?: string;
};

type VariableCostRow = {
  id: string;
  date: string;
  source: 'EXPENSE' | 'DRIVER_PAY';
  category: string;
  label: string;
  status: string;
  amount: number;
};

type FinanceTab = 'CASH_FLOW' | 'LOAD_PAYMENTS';
type SimulationView = 'COMBINED' | 'VARIABLE_ONLY' | 'UPCOMING_INCOME_ONLY';

type LoadPaymentFilter = 'ALL' | 'TAKEN' | 'COMPLETED' | 'PAID' | 'PAYMENT_SCHEDULED';

type LoadPaymentRow = {
  load: Load;
  payment: PaymentRecord | null;
  expectedAmount: number;
  paymentDate: string;
};

type FixedIncomeInputCurrency = 'EUR' | 'RSD';

const FINANCE_TABS: Array<{ id: FinanceTab; label: string }> = [
  { id: 'CASH_FLOW', label: 'Cash Flow' },
  { id: 'LOAD_PAYMENTS', label: 'Load Payments' },
];

const LOAD_PAYMENT_FILTERS: Array<{ id: LoadPaymentFilter; label: string }> = [
  { id: 'COMPLETED', label: 'Completed' },
  { id: 'TAKEN', label: 'Taken' },
  { id: 'PAYMENT_SCHEDULED', label: 'Payment Scheduled' },
  { id: 'PAID', label: 'Paid' },
  { id: 'ALL', label: 'All' },
];

const SIMULATION_VIEW_OPTIONS: Array<{ id: SimulationView; label: string }> = [
  { id: 'COMBINED', label: 'Combined' },
  { id: 'VARIABLE_ONLY', label: 'Variable Cost' },
  { id: 'UPCOMING_INCOME_ONLY', label: 'Upcoming Income' },
];

const RSD_TO_EUR_MULTIPLIER = 118;

const toDateInput = (value: Date): string => value.toISOString().slice(0, 10);

const getDefaultFromDate = (): string => {
  const now = new Date();
  return toDateInput(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)));
};

const getDefaultToDate = (): string => {
  const now = new Date();
  return toDateInput(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 2, 0)));
};

const toNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const round2 = (value: number): number => Math.round(value * 100) / 100;

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
  return toDateInput(parsed);
};

const formatDateCell = (value: string): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-GB');
};

const isDateInRange = (value: string, from: string, to: string): boolean => {
  const day = toDateOnly(value);
  if (!day) return false;
  return day >= from && day <= to;
};

const resolveIncomeDate = (payment: PaymentRecord): string =>
  toDateOnly(payment.dueDate) || toDateOnly(payment.issueDate) || toDateOnly(payment.createdAt) || getDefaultToDate();

const resolveDriverPayDate = (record: DriverPayRecord): string => {
  if (record.paidDate) return toDateOnly(record.paidDate) || getDefaultToDate();
  return `${record.year}-${String(record.month).padStart(2, '0')}-01`;
};

const getLoadStatusLabel = (status: LoadStatus): string => {
  if (status === LoadStatus.DELIVERED) return 'COMPLETED';
  return status.replaceAll('_', ' ');
};

const isTakenLikeStatus = (status: LoadStatus): boolean =>
  status === LoadStatus.TAKEN || status === LoadStatus.ON_BOARD || status === LoadStatus.IN_TRANSIT;

const isScheduledPaymentStatus = (status: PaymentStatus): boolean =>
  status === PaymentStatus.PENDING ||
  status === PaymentStatus.INVOICED ||
  status === PaymentStatus.OVERDUE ||
  status === PaymentStatus.DISPUTED;

const selectableLoadStatuses: LoadStatus[] = [
  LoadStatus.TAKEN,
  LoadStatus.ON_BOARD,
  LoadStatus.IN_TRANSIT,
  LoadStatus.DELIVERED,
  LoadStatus.CANCELED,
];

const selectablePaymentStatuses: PaymentStatus[] = [
  PaymentStatus.PENDING,
  PaymentStatus.INVOICED,
  PaymentStatus.PAID,
  PaymentStatus.OVERDUE,
  PaymentStatus.DISPUTED,
  PaymentStatus.WRITTEN_OFF,
];

const FIXED_EXPENSE_CATEGORIES: ExpenseCategory[] = [
  ExpenseCategory.LEASING,
  ExpenseCategory.INSURANCE,
  ExpenseCategory.PERMITS,
  ExpenseCategory.OFFICE,
  ExpenseCategory.SOFTWARE,
  ExpenseCategory.SALARY,
  ExpenseCategory.OTHER,
];

const VARIABLE_EXPENSE_CATEGORIES: ExpenseCategory[] = [
  ExpenseCategory.FUEL,
  ExpenseCategory.OFFICE,
  ExpenseCategory.MAINTENANCE,
  ExpenseCategory.SALARY,
];

const getExpenseCategoryLabel = (category: ExpenseCategory): string => {
  if (category === ExpenseCategory.LEASING) return 'Leasing';
  if (category === ExpenseCategory.INSURANCE) return 'Insurance';
  if (category === ExpenseCategory.PERMITS) return 'Permits';
  if (category === ExpenseCategory.OFFICE) return 'Office';
  if (category === ExpenseCategory.SOFTWARE) return 'Software';
  if (category === ExpenseCategory.SALARY) return 'Salary Tax';
  if (category === ExpenseCategory.OTHER) return 'Other';
  return category;
};

const getVariableCategoryLabel = (category: string): string => {
  if (category === ExpenseCategory.FUEL) return 'Fuel';
  if (category === ExpenseCategory.OFFICE) return 'Supply';
  if (category === ExpenseCategory.MAINTENANCE) return 'Maintenance';
  if (category === ExpenseCategory.SALARY || category === 'DRIVER_PAY') return 'Driver Wage';
  return category;
};

const getDefaultDueDay = (): string => String(new Date().getDate());
const pad = (value: number): string => String(value).padStart(2, '0');

const getDueDayFromDate = (value?: string | null): string => {
  if (!value) return getDefaultDueDay();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return getDefaultDueDay();
  return String(parsed.getDate());
};

const toMonthlyAnchorDate = (dayInMonth: number, referenceDate?: string | null): string => {
  const base = referenceDate ? new Date(referenceDate) : new Date();
  const safeBase = Number.isNaN(base.getTime()) ? new Date() : base;
  const year = safeBase.getFullYear();
  const month = safeBase.getMonth();
  const maxDay = new Date(year, month + 1, 0).getDate();
  const normalizedDay = Math.min(Math.max(Math.round(dayInMonth), 1), maxDay);
  return `${year}-${pad(month + 1)}-${pad(normalizedDay)}`;
};

const getMonthStart = (dateKey: string): Date => {
  const base = new Date(`${dateKey}T00:00:00.000Z`);
  return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), 1));
};

const addUtcMonths = (value: Date, months: number): Date =>
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + months, 1));

const getOccurrenceDateKey = (monthStart: Date, dueDay: number): string => {
  const year = monthStart.getUTCFullYear();
  const month = monthStart.getUTCMonth();
  const maxDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const safeDay = Math.min(Math.max(Math.round(dueDay), 1), maxDay);
  return `${year}-${pad(month + 1)}-${pad(safeDay)}`;
};

const getIncomeDueDay = (income: CustomIncome): number => {
  const parsed = Math.trunc(toNumber(income.dueDay));
  if (parsed >= 1 && parsed <= 31) return parsed;
  const fallback = getDueDayFromDate(income.incomeDate);
  return Math.min(Math.max(Math.trunc(toNumber(fallback)), 1), 31);
};

type RecurringCustomIncomeOccurrence = {
  id: string;
  incomeId: string;
  date: string;
  label: string;
  amount: number;
};

const expandRecurringCustomIncome = (
  templates: CustomIncome[],
  from: string,
  to: string,
): RecurringCustomIncomeOccurrence[] => {
  const result: RecurringCustomIncomeOccurrence[] = [];

  templates.forEach((income) => {
    const dueDay = getIncomeDueDay(income);
    const amount = toNumber(income.amount);
    if (amount <= 0) return;

    const startDate = toDateOnly(income.incomeDate) || from;
    const stopDate = toDateOnly(income.stopDate);
    if (startDate > to) return;
    if (stopDate && stopDate < from) return;

    let monthCursor = getMonthStart(startDate);
    const monthEnd = getMonthStart(stopDate && stopDate < to ? stopDate : to);

    while (monthCursor <= monthEnd) {
      const occurrenceDate = getOccurrenceDateKey(monthCursor, dueDay);
      if (
        occurrenceDate >= from &&
        occurrenceDate <= to &&
        occurrenceDate >= startDate &&
        (!stopDate || occurrenceDate <= stopDate)
      ) {
        result.push({
          id: `${income.id}-${occurrenceDate}`,
          incomeId: income.id,
          date: occurrenceDate,
          label: income.description,
          amount,
        });
      }
      monthCursor = addUtcMonths(monthCursor, 1);
    }
  });

  return result.sort((a, b) => (a.date === b.date ? a.id.localeCompare(b.id) : a.date.localeCompare(b.date)));
};

const fetchAllLoads = async (): Promise<Load[]> => {
  const allLoads: Load[] = [];
  const pageSize = 200;
  let offset = 0;
  let total = 0;

  do {
    const response = await loadApi.getAll({ limit: pageSize, offset });
    total = response.total;
    allLoads.push(...response.data);
    offset += response.data.length;
    if (response.data.length === 0) break;
  } while (allLoads.length < total);

  return allLoads;
};

export default function FinancePage() {
  const [activeTab, setActiveTab] = useState<FinanceTab>('CASH_FLOW');
  const [loadPaymentFilter, setLoadPaymentFilter] = useState<LoadPaymentFilter>('COMPLETED');
  const [from, setFrom] = useState(getDefaultFromDate);
  const [to, setTo] = useState(getDefaultToDate);
  const [simulationView, setSimulationView] = useState<SimulationView>('COMBINED');
  const [currentBalanceInput, setCurrentBalanceInput] = useState('0');
  const [isCustomIncomeModalOpen, setIsCustomIncomeModalOpen] = useState(false);
  const [isFixedExpenseModalOpen, setIsFixedExpenseModalOpen] = useState(false);
  const [isVariableCostModalOpen, setIsVariableCostModalOpen] = useState(false);

  const [allExpenses, setAllExpenses] = useState<Expense[]>([]);
  const [allPayments, setAllPayments] = useState<PaymentRecord[]>([]);
  const [allDriverPayRecords, setAllDriverPayRecords] = useState<DriverPayRecord[]>([]);
  const [allCustomIncomes, setAllCustomIncomes] = useState<CustomIncome[]>([]);
  const [allLoads, setAllLoads] = useState<Load[]>([]);
  const [editingFixedExpense, setEditingFixedExpense] = useState<Expense | null>(null);
  const [editingFixedIncome, setEditingFixedIncome] = useState<CustomIncome | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingFixedIncomeId, setDeletingFixedIncomeId] = useState<string | null>(null);
  const [updatingLoadStatusId, setUpdatingLoadStatusId] = useState<string | null>(null);
  const [updatingPaymentLoadId, setUpdatingPaymentLoadId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [fixedForm, setFixedForm] = useState({
    category: ExpenseCategory.LEASING,
    amount: '',
    dueDay: getDefaultDueDay(),
    stopDate: '',
    label: '',
  });

  const [variableForm, setVariableForm] = useState({
    category: ExpenseCategory.FUEL,
    amount: '',
    date: getDefaultFromDate(),
    label: '',
  });

  const [customIncomeForm, setCustomIncomeForm] = useState({
    description: '',
    amount: '',
    inputCurrency: 'EUR' as FixedIncomeInputCurrency,
    dueDay: getDefaultDueDay(),
    stopDate: '',
    notes: '',
  });

  const resetCustomIncomeForm = useCallback(() => {
    setCustomIncomeForm({
      description: '',
      amount: '',
      inputCurrency: 'EUR',
      dueDay: getDefaultDueDay(),
      stopDate: '',
      notes: '',
    });
  }, []);

  const resetFixedForm = useCallback(() => {
    setFixedForm({
      category: ExpenseCategory.LEASING,
      amount: '',
      dueDay: getDefaultDueDay(),
      stopDate: '',
      label: '',
    });
  }, []);

  const openCreateFixedExpenseModal = useCallback(() => {
    setEditingFixedExpense(null);
    resetFixedForm();
    setIsFixedExpenseModalOpen(true);
  }, [resetFixedForm]);

  const openEditFixedExpenseModal = useCallback((expense: Expense) => {
    setEditingFixedExpense(expense);
    setFixedForm({
      category: expense.category,
      amount: String(toNumber(expense.amount)),
      dueDay: getDueDayFromDate(expense.expenseDate),
      stopDate: toDateOnly(expense.stopDate),
      label: expense.recurringLabel ?? expense.description ?? '',
    });
    setIsFixedExpenseModalOpen(true);
  }, []);

  const openCreateFixedIncomeModal = useCallback(() => {
    setEditingFixedIncome(null);
    resetCustomIncomeForm();
    setIsCustomIncomeModalOpen(true);
  }, [resetCustomIncomeForm]);

  const openEditFixedIncomeModal = useCallback((income: CustomIncome) => {
    const inputCurrency: FixedIncomeInputCurrency =
      income.inputCurrency === 'RSD' ? 'RSD' : 'EUR';
    const inputAmount =
      inputCurrency === 'RSD'
        ? toNumber(income.inputAmount ?? income.amount)
        : toNumber(income.amount);

    setEditingFixedIncome(income);
    setCustomIncomeForm({
      description: income.description ?? '',
      amount: String(inputAmount),
      inputCurrency,
      dueDay: String(getIncomeDueDay(income)),
      stopDate: toDateOnly(income.stopDate),
      notes: income.notes ?? '',
    });
    setIsCustomIncomeModalOpen(true);
  }, []);

  const fixedCategoryOptions = useMemo(() => {
    if (FIXED_EXPENSE_CATEGORIES.includes(fixedForm.category)) {
      return FIXED_EXPENSE_CATEGORIES;
    }
    return [fixedForm.category, ...FIXED_EXPENSE_CATEGORIES];
  }, [fixedForm.category]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [expenses, payments, driverPay, customIncomes, loads] = await Promise.all([
        expenseApi.getAll(),
        paymentApi.getAll(),
        driverPayApi.getAll(),
        customIncomeApi.getAll(),
        fetchAllLoads(),
      ]);

      setAllExpenses(expenses);
      setAllPayments(payments);
      setAllDriverPayRecords(driverPay);
      setAllCustomIncomes(customIncomes);
      setAllLoads(loads);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to load finance data.');
      setAllExpenses([]);
      setAllPayments([]);
      setAllDriverPayRecords([]);
      setAllCustomIncomes([]);
      setAllLoads([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const loadsById = useMemo(
    () => new Map(allLoads.map((load) => [load.id, load])),
    [allLoads],
  );

  const latestPaymentByLoadId = useMemo(() => {
    const map = new Map<string, PaymentRecord>();

    allPayments.forEach((payment) => {
      const existing = map.get(payment.loadId);
      if (!existing) {
        map.set(payment.loadId, payment);
        return;
      }

      const existingSortDate =
        toDateOnly(existing.dueDate) || toDateOnly(existing.issueDate) || toDateOnly(existing.createdAt);
      const currentSortDate =
        toDateOnly(payment.dueDate) || toDateOnly(payment.issueDate) || toDateOnly(payment.createdAt);

      if (currentSortDate >= existingSortDate) {
        map.set(payment.loadId, payment);
      }
    });

    return map;
  }, [allPayments]);

  const loadPaymentRows = useMemo<LoadPaymentRow[]>(() => {
    const rows = allLoads
      .filter((load) => !load.isInactive)
      .map((load) => {
        const payment = latestPaymentByLoadId.get(load.id) ?? null;
        const expectedAmount = toNumber(payment?.totalWithVat ?? payment?.amount ?? load.agreedPrice ?? load.publishedPrice);
        const paymentDate =
          toDateOnly(payment?.dueDate) ||
          toDateOnly(payment?.issueDate) ||
          toDateOnly(load.deliveryDateTo) ||
          toDateOnly(load.deliveryDateFrom) ||
          '';

        return {
          load,
          payment,
          expectedAmount,
          paymentDate,
        };
      })
      .sort((a, b) => {
        const aDate = toDateOnly(a.load.deliveryDateFrom) || '';
        const bDate = toDateOnly(b.load.deliveryDateFrom) || '';
        return bDate.localeCompare(aDate);
      });

    return rows.filter((row) => {
      if (loadPaymentFilter === 'ALL') return true;
      if (loadPaymentFilter === 'TAKEN') return isTakenLikeStatus(row.load.status);
      if (loadPaymentFilter === 'COMPLETED') return row.load.status === LoadStatus.DELIVERED;
      if (loadPaymentFilter === 'PAID') return row.payment?.status === PaymentStatus.PAID;
      if (loadPaymentFilter === 'PAYMENT_SCHEDULED') {
        return row.payment ? isScheduledPaymentStatus(row.payment.status) : false;
      }
      return true;
    });
  }, [allLoads, latestPaymentByLoadId, loadPaymentFilter]);

  const expensesInRange = useMemo(
    () => allExpenses.filter((expense) => isDateInRange(expense.expenseDate, from, to)),
    [allExpenses, from, to],
  );

  const paymentsInRange = useMemo(
    () => allPayments.filter((payment) => isDateInRange(resolveIncomeDate(payment), from, to)),
    [allPayments, from, to],
  );

  const driverPayInRange = useMemo(
    () => allDriverPayRecords.filter((record) => isDateInRange(resolveDriverPayDate(record), from, to)),
    [allDriverPayRecords, from, to],
  );

  const fixedIncomeTemplates = useMemo(
    () =>
      allCustomIncomes.filter((income) => {
        const startDate = toDateOnly(income.incomeDate) || from;
        const stopDate = toDateOnly(income.stopDate);
        return startDate <= to && (!stopDate || stopDate >= from);
      }),
    [allCustomIncomes, from, to],
  );

  const fixedIncomeOccurrences = useMemo(
    () => expandRecurringCustomIncome(fixedIncomeTemplates, from, to),
    [fixedIncomeTemplates, from, to],
  );

  const fixedExpenses = useMemo(
    () => expensesInRange.filter((expense) => expense.expenseType === ExpenseType.FIXED),
    [expensesInRange],
  );

  const variableExpenses = useMemo(
    () => expensesInRange.filter((expense) => expense.expenseType !== ExpenseType.FIXED),
    [expensesInRange],
  );

  const fixedExpensesTotal = useMemo(
    () =>
      round2(
        fixedExpenses.reduce(
          (sum, expense) => sum + toNumber(expense.totalWithVat ?? expense.amount),
          0,
        ),
      ),
    [fixedExpenses],
  );

  const upcomingIncomes = useMemo(
    () => [...paymentsInRange].sort((a, b) => resolveIncomeDate(a).localeCompare(resolveIncomeDate(b))),
    [paymentsInRange],
  );

  const customIncomeTotal = useMemo(
    () => round2(fixedIncomeOccurrences.reduce((sum, income) => sum + toNumber(income.amount), 0)),
    [fixedIncomeOccurrences],
  );

  const fixedIncomeMonthlyTotal = useMemo(
    () =>
      round2(
        fixedIncomeTemplates.reduce((sum, income) => sum + toNumber(income.amount), 0),
      ),
    [fixedIncomeTemplates],
  );

  const variableCostRows = useMemo<VariableCostRow[]>(() => {
    const expenseRows: VariableCostRow[] = variableExpenses.map((expense) => ({
      id: expense.id,
      date: toDateOnly(expense.expenseDate) || getDefaultFromDate(),
      source: 'EXPENSE',
      category: expense.category,
      label: expense.description ?? expense.referenceNumber ?? expense.category,
      status: expense.expenseType,
      amount: toNumber(expense.totalWithVat ?? expense.amount),
    }));

    const payRows: VariableCostRow[] = driverPayInRange.map((record) => ({
      id: `driver-pay-${record.id}`,
      date: resolveDriverPayDate(record),
      source: 'DRIVER_PAY',
      category: 'DRIVER_PAY',
      label: record.driver
        ? `${record.driver.firstName} ${record.driver.lastName}`
        : `Driver ${record.driverId.slice(0, 8)}`,
      status: record.status,
      amount: toNumber(record.totalPay),
    }));

    return [...expenseRows, ...payRows].sort((a, b) => b.date.localeCompare(a.date));
  }, [variableExpenses, driverPayInRange]);

  const allLedgerEvents = useMemo<LedgerEvent[]>(() => {
    const incomeEvents: LedgerEvent[] = upcomingIncomes.map((payment) => {
      const linkedLoad = payment.load ?? loadsById.get(payment.loadId);
      const loadRef = linkedLoad?.referenceNumber ?? payment.loadId;
      return {
        id: `income-${payment.id}`,
        date: resolveIncomeDate(payment),
        kind: 'INCOME',
        label: `Income ${loadRef}`,
        amount: toNumber(payment.totalWithVat ?? payment.amount),
        source: 'PAYMENT',
      };
    });

    const customIncomeEvents: LedgerEvent[] = fixedIncomeOccurrences.map((income) => ({
      id: `custom-income-${income.id}`,
      date: income.date,
      kind: 'INCOME',
      label: income.label,
      amount: toNumber(income.amount),
      source: 'CUSTOM',
      editableType: 'FIXED_INCOME',
      entityId: income.incomeId,
    }));

    const fixedEvents: LedgerEvent[] = fixedExpenses.map((expense) => ({
      id: `fixed-${expense.id}`,
      date: toDateOnly(expense.expenseDate) || getDefaultFromDate(),
      kind: 'FIXED',
      label: expense.recurringLabel ?? expense.description ?? expense.category,
      amount: toNumber(expense.totalWithVat ?? expense.amount),
      editableType: 'FIXED_EXPENSE',
      entityId: expense.id,
    }));

    const variableEvents: LedgerEvent[] = variableCostRows.map((row) => ({
      id: `variable-${row.id}`,
      date: row.date,
      kind: 'VARIABLE',
      label: row.label,
      amount: toNumber(row.amount),
    }));

    return [...incomeEvents, ...customIncomeEvents, ...fixedEvents, ...variableEvents].sort((a, b) =>
      a.date === b.date ? a.id.localeCompare(b.id) : a.date.localeCompare(b.date),
    );
  }, [upcomingIncomes, fixedIncomeOccurrences, fixedExpenses, variableCostRows, loadsById]);

  const filteredLedgerEvents = useMemo<LedgerEvent[]>(() => {
    if (simulationView === 'VARIABLE_ONLY') {
      return allLedgerEvents.filter((event) => event.kind === 'VARIABLE');
    }
    if (simulationView === 'UPCOMING_INCOME_ONLY') {
      return allLedgerEvents.filter((event) => event.kind === 'INCOME');
    }
    return allLedgerEvents;
  }, [allLedgerEvents, simulationView]);

  const openingBalance = toNumber(currentBalanceInput);

  const simulation = useMemo(() => {
    let running = openingBalance;

    const rows = filteredLedgerEvents.map((event) => {
      if (event.kind === 'INCOME') {
        running += event.amount;
      } else {
        running -= event.amount;
      }

      return {
        ...event,
        runningBalance: round2(running),
      };
    });

    const totalIncome = round2(
      filteredLedgerEvents
        .filter((event) => event.kind === 'INCOME')
        .reduce((sum, event) => sum + event.amount, 0),
    );
    const totalOut = round2(
      filteredLedgerEvents
        .filter((event) => event.kind !== 'INCOME')
        .reduce((sum, event) => sum + event.amount, 0),
    );

    return {
      rows,
      totalIncome,
      totalOut,
      projectedBalance: round2(openingBalance + totalIncome - totalOut),
    };
  }, [filteredLedgerEvents, openingBalance]);

  const handleAddFixedExpense = async () => {
    const amount = toNumber(fixedForm.amount);
    if (amount <= 0) {
      setError('Fixed expense amount must be greater than 0.');
      return;
    }
    const dueDayNumeric = Number(fixedForm.dueDay);
    if (!Number.isFinite(dueDayNumeric) || dueDayNumeric < 1 || dueDayNumeric > 31) {
      setError('Due day must be a number between 1 and 31.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const payload = {
        category: fixedForm.category,
        expenseType: ExpenseType.FIXED,
        amount,
        currency: Currency.EUR,
        expenseDate: toMonthlyAnchorDate(dueDayNumeric, editingFixedExpense?.expenseDate),
        recurrenceType: ExpenseRecurrence.MONTHLY,
        ...(fixedForm.label.trim() ? { recurringLabel: fixedForm.label.trim(), description: fixedForm.label.trim() } : {}),
        ...(fixedForm.stopDate ? { stopDate: fixedForm.stopDate } : { stopDate: null }),
        isRecurring: true,
      };

      if (editingFixedExpense) {
        await expenseApi.update(editingFixedExpense.id, payload);
      } else {
        await expenseApi.create(payload);
      }

      setFixedForm((prev) => ({ ...prev, amount: '', label: '' }));
      setIsFixedExpenseModalOpen(false);
      setEditingFixedExpense(null);
      await loadData();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : editingFixedExpense
            ? 'Failed to update fixed expense.'
            : 'Failed to add fixed expense.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteFixedExpense = async () => {
    if (!editingFixedExpense) return;
    const confirmed = window.confirm('Hard delete this fixed expense? This action cannot be undone.');
    if (!confirmed) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await expenseApi.delete(editingFixedExpense.id);
      setIsFixedExpenseModalOpen(false);
      setEditingFixedExpense(null);
      resetFixedForm();
      await loadData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to delete fixed expense.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddVariableExpense = async () => {
    const amount = toNumber(variableForm.amount);
    if (amount <= 0) {
      setError('Variable expense amount must be greater than 0.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await expenseApi.create({
        category: variableForm.category,
        expenseType: ExpenseType.VARIABLE,
        amount,
        currency: Currency.EUR,
        expenseDate: variableForm.date,
        recurrenceType: ExpenseRecurrence.ONE_TIME,
        ...(variableForm.label.trim() ? { description: variableForm.label.trim() } : {}),
        isRecurring: false,
      });

      setVariableForm((prev) => ({ ...prev, amount: '', label: '' }));
      setIsVariableCostModalOpen(false);
      await loadData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to add variable expense.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddCustomIncome = async () => {
    const rawAmount = toNumber(customIncomeForm.amount);
    const amount =
      customIncomeForm.inputCurrency === 'RSD'
        ? round2(rawAmount / RSD_TO_EUR_MULTIPLIER)
        : rawAmount;
    const dueDay = Math.trunc(toNumber(customIncomeForm.dueDay));
    if (!customIncomeForm.description.trim()) {
      setError('Custom income description is required.');
      return;
    }
    if (rawAmount <= 0) {
      setError('Custom income amount must be greater than 0.');
      return;
    }
    if (!Number.isFinite(dueDay) || dueDay < 1 || dueDay > 31) {
      setError('Due day must be between 1 and 31.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const payload = {
        amount,
        currency: Currency.EUR,
        inputAmount: rawAmount,
        inputCurrency: customIncomeForm.inputCurrency,
        dueDay,
        incomeDate: toMonthlyAnchorDate(dueDay, editingFixedIncome?.incomeDate),
        ...(customIncomeForm.stopDate ? { stopDate: customIncomeForm.stopDate } : {}),
        description: customIncomeForm.description.trim(),
        ...(customIncomeForm.notes.trim()
          ? { notes: customIncomeForm.notes.trim() }
          : {}),
      };

      if (editingFixedIncome) {
        await customIncomeApi.update(editingFixedIncome.id, payload);
      } else {
        await customIncomeApi.create(payload);
      }

      resetCustomIncomeForm();
      setEditingFixedIncome(null);
      setIsCustomIncomeModalOpen(false);
      await loadData();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : editingFixedIncome
            ? 'Failed to update fixed income.'
            : 'Failed to add fixed income.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteFixedIncome = async (incomeId: string) => {
    const confirmed = window.confirm('Delete this fixed income template?');
    if (!confirmed) return;

    setDeletingFixedIncomeId(incomeId);
    setError(null);
    try {
      await customIncomeApi.delete(incomeId);
      if (editingFixedIncome?.id === incomeId) {
        setIsCustomIncomeModalOpen(false);
        setEditingFixedIncome(null);
        resetCustomIncomeForm();
      }
      await loadData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to delete fixed income.');
    } finally {
      setDeletingFixedIncomeId(null);
    }
  };

  const handleUpdateLoadWorkflowStatus = async (loadId: string, status: LoadStatus) => {
    setUpdatingLoadStatusId(loadId);
    setError(null);

    try {
      await loadApi.updateStatus(loadId, status);
      await loadData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to update load status.');
    } finally {
      setUpdatingLoadStatusId(null);
    }
  };

  const handleUpdatePaymentStatus = async (
    load: Load,
    existingPayment: PaymentRecord | null,
    status: PaymentStatus,
  ) => {
    setUpdatingPaymentLoadId(load.id);
    setError(null);

    try {
      if (existingPayment) {
        if (status === PaymentStatus.PAID) {
          await paymentApi.markPaid(existingPayment.id, toDateInput(new Date()));
        } else {
          await paymentApi.update(existingPayment.id, { status });
        }
        await loadData();
        return;
      }

      if (!load.brokerId) {
        throw new Error('Load has no broker assigned. Assign broker first before creating payment.');
      }

      const amount = toNumber(load.agreedPrice ?? load.publishedPrice);
      if (amount <= 0) {
        throw new Error('Load has no valid price. Set agreed/published price first.');
      }

      const issueDate = toDateOnly(load.deliveryDateFrom) || toDateInput(new Date());
      const dueDate = toDateOnly(load.deliveryDateTo) || issueDate;

      const created = await paymentApi.create({
        loadId: load.id,
        brokerId: load.brokerId,
        status: status === PaymentStatus.PAID ? PaymentStatus.INVOICED : status,
        amount,
        currency: load.currency ?? Currency.EUR,
        issueDate,
        dueDate,
      });

      if (status === PaymentStatus.PAID) {
        await paymentApi.markPaid(created.id, toDateInput(new Date()));
      }

      await loadData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to update payment status.');
    } finally {
      setUpdatingPaymentLoadId(null);
    }
  };

  const handleOpenLoadPayment = (loadId: string) => {
    const targetUrl = `/loads/${encodeURIComponent(loadId)}?section=payments`;
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  };

  const handleSimulationRowClick = (row: LedgerEvent) => {
    if (!row.editableType || !row.entityId) return;

    if (row.editableType === 'FIXED_EXPENSE') {
      const expense = allExpenses.find((item) => item.id === row.entityId);
      if (expense) {
        openEditFixedExpenseModal(expense);
      }
      return;
    }

    if (row.editableType === 'FIXED_INCOME') {
      const income = allCustomIncomes.find((item) => item.id === row.entityId);
      if (income) {
        openEditFixedIncomeModal(income);
      }
    }
  };

  return (
    <main className="min-h-screen bg-slate-100">
      <ThinModuleMenu />

      <div className="w-full px-4 py-8 sm:px-6 xl:px-8">
        <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Bojovic Transport</p>
              <h1 className="mt-1 text-2xl font-semibold text-slate-900">Finance</h1>
              <p className="mt-1 text-sm text-slate-600">
                Fixed expenses, upcoming income, variable costs, and cash-flow simulation.
              </p>
            </div>

            <div className="flex flex-wrap items-end gap-2">
              <label className="text-xs text-slate-600">
                From
                <DateTimePicker mode="date" value={from} onChange={setFrom} triggerClassName="mt-1" />
              </label>
              <label className="text-xs text-slate-600">
                To
                <DateTimePicker mode="date" value={to} onChange={setTo} triggerClassName="mt-1" />
              </label>
              <button
                type="button"
                onClick={() => void loadData()}
                disabled={isLoading}
                className="inline-flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-800">
              Current Balance: {formatMoney(openingBalance)}
            </span>
          </div>

          {error && (
            <p className="mt-3 rounded border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-700">{error}</p>
          )}
        </header>

        <div className="mt-4 flex flex-wrap gap-2">
          {FINANCE_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                activeTab === tab.id
                  ? 'bg-slate-900 text-white'
                  : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'CASH_FLOW' && (
        <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-2 xl:items-start">
        <section className="order-1 rounded-xl border border-slate-200 bg-white p-4 shadow-sm xl:col-start-1">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-900">Fixed Expenses</h2>
            <button
              type="button"
              onClick={openCreateFixedExpenseModal}
              className="inline-flex items-center justify-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Plus className="h-3 w-3" />
              Add Fixed Expense
            </button>
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-2 py-1">Due Day</th>
                  <th className="px-2 py-1">Stop Date</th>
                  <th className="px-2 py-1">Label</th>
                  <th className="px-2 py-1">Category</th>
                  <th className="px-2 py-1 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {fixedExpenses.length === 0 && (
                  <tr>
                    <td className="px-2 py-3 text-slate-500" colSpan={5}>
                      {isLoading ? 'Loading...' : 'No fixed expenses in selected range.'}
                    </td>
                  </tr>
                )}
                {fixedExpenses
                  .slice()
                  .sort((a, b) => (a.expenseDate < b.expenseDate ? 1 : -1))
                  .map((expense) => (
                    <tr
                      key={expense.id}
                      className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
                      onClick={() => openEditFixedExpenseModal(expense)}
                      title="Click to edit fixed expense"
                    >
                      <td className="px-2 py-1.5 text-slate-700">Day {getDueDayFromDate(expense.expenseDate)}</td>
                      <td className="px-2 py-1.5 text-slate-700">
                        {expense.stopDate ? formatDateCell(toDateOnly(expense.stopDate)) : '—'}
                      </td>
                      <td className="px-2 py-1.5 font-medium text-slate-800">
                        {expense.recurringLabel ?? expense.description ?? expense.category}
                      </td>
                      <td className="px-2 py-1.5 text-slate-700">{getExpenseCategoryLabel(expense.category)}</td>
                      <td className="px-2 py-1.5 text-right text-slate-800">
                        {formatMoney(toNumber(expense.totalWithVat ?? expense.amount))}
                      </td>
                    </tr>
                  ))}
                {fixedExpenses.length > 0 && (
                  <tr className="border-t-2 border-slate-300 bg-slate-50">
                    <td className="px-2 py-2 text-sm font-semibold text-slate-900" colSpan={4}>
                      Total
                    </td>
                    <td className="px-2 py-2 text-right text-sm font-semibold text-slate-900">
                      {formatMoney(fixedExpensesTotal)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900">Fixed Income</h3>
              <button
                type="button"
                onClick={openCreateFixedIncomeModal}
                className="inline-flex items-center justify-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Plus className="h-3 w-3" />
                Add Fixed Income
              </button>
            </div>

            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-[11px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-2 py-1">Due Day</th>
                    <th className="px-2 py-1">Stop Date</th>
                    <th className="px-2 py-1">Description</th>
                    <th className="px-2 py-1 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {fixedIncomeTemplates.length === 0 && (
                    <tr>
                      <td className="px-2 py-3 text-slate-500" colSpan={4}>
                        {isLoading ? 'Loading...' : 'No fixed income templates in selected range.'}
                      </td>
                    </tr>
                  )}
                  {fixedIncomeTemplates
                    .slice()
                    .sort((a, b) => getIncomeDueDay(a) - getIncomeDueDay(b))
                    .map((income) => (
                      <tr
                        key={income.id}
                        className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
                        onClick={() => openEditFixedIncomeModal(income)}
                        title="Click to edit fixed income"
                      >
                        <td className="px-2 py-1.5 text-slate-700">Day {getIncomeDueDay(income)}</td>
                        <td className="px-2 py-1.5 text-slate-700">
                          {income.stopDate ? formatDateCell(toDateOnly(income.stopDate)) : '—'}
                        </td>
                        <td className="px-2 py-1.5 font-medium text-slate-800">{income.description}</td>
                        <td className="px-2 py-1.5 text-right text-emerald-700 font-medium">
                          {formatMoney(toNumber(income.amount))}
                        </td>
                      </tr>
                    ))}
                  {fixedIncomeTemplates.length > 0 && (
                    <tr className="border-t-2 border-slate-300 bg-slate-50">
                      <td className="px-2 py-2 text-sm font-semibold text-slate-900" colSpan={3}>
                        Total (Monthly)
                      </td>
                      <td className="px-2 py-2 text-right text-sm font-semibold text-emerald-700">
                        {formatMoney(fixedIncomeMonthlyTotal)}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="order-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm xl:col-start-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Combined Balance Simulation</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setIsVariableCostModalOpen(true)}
                className="inline-flex items-center justify-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Plus className="h-3 w-3" />
                Add Variable Cost
              </button>
              <button
                type="button"
                onClick={openCreateFixedIncomeModal}
                className="inline-flex items-center justify-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Plus className="h-3 w-3" />
                Add Fixed Income
              </button>
            </div>
          </div>

          <div className="mt-3 inline-flex rounded-lg border border-slate-300 bg-slate-50 p-1">
            {SIMULATION_VIEW_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setSimulationView(option.id)}
                className={`rounded px-3 py-1 text-xs font-semibold ${
                  simulationView === option.id
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-200'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-2 py-1">Date</th>
                  <th className="px-2 py-1">Type</th>
                  <th className="px-2 py-1">Label</th>
                  <th className="px-2 py-1 text-right">Incoming</th>
                  <th className="px-2 py-1 text-right">Outgoing</th>
                  <th className="px-2 py-1 text-right">Running Balance</th>
                </tr>
              </thead>
              <tbody>
                {simulation.rows.length === 0 && (
                  <tr>
                    <td className="px-2 py-3 text-slate-500" colSpan={6}>
                      No events in selected range.
                    </td>
                  </tr>
                )}
                {simulation.rows.map((row) => {
                  const isIncome = row.kind === 'INCOME';
                  const isEditable = Boolean(row.editableType && row.entityId);
                  const typeLabel =
                    row.kind === 'INCOME'
                      ? row.source === 'CUSTOM'
                        ? 'INCOME (CUSTOM)'
                        : 'INCOME (PAYMENT)'
                      : row.kind;
                  return (
                    <tr
                      key={row.id}
                      className={`border-t border-slate-100 ${isEditable ? 'cursor-pointer hover:bg-slate-50' : ''}`}
                      onClick={isEditable ? () => handleSimulationRowClick(row) : undefined}
                      title={isEditable ? 'Click to edit' : undefined}
                    >
                      <td className="px-2 py-1.5 text-slate-700">{formatDateCell(row.date)}</td>
                      <td className="px-2 py-1.5 text-slate-700">{typeLabel}</td>
                      <td className="px-2 py-1.5 text-slate-800">{row.label}</td>
                      <td className="px-2 py-1.5 text-right text-emerald-700 font-medium">
                        {isIncome ? formatMoney(row.amount) : '—'}
                      </td>
                      <td className="px-2 py-1.5 text-right text-rose-700 font-medium">
                        {!isIncome ? formatMoney(row.amount) : '—'}
                      </td>
                      <td
                        className={`px-2 py-1.5 text-right font-semibold ${
                          row.runningBalance >= 0 ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {formatMoney(row.runningBalance)}
                      </td>
                    </tr>
                  );
                })}
                {simulation.rows.length > 0 && (
                  <tr className="border-t-2 border-slate-300 bg-slate-50">
                    <td className="px-2 py-2 text-sm font-semibold text-slate-900" colSpan={3}>
                      Total
                    </td>
                    <td className="px-2 py-2 text-right text-sm font-semibold text-emerald-700">
                      {formatMoney(simulation.totalIncome)}
                    </td>
                    <td className="px-2 py-2 text-right text-sm font-semibold text-rose-700">
                      {formatMoney(simulation.totalOut)}
                    </td>
                    <td className="px-2 py-2 text-right text-sm font-semibold text-slate-900">
                      {formatMoney(simulation.totalIncome - simulation.totalOut)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
        </div>
        )}

        {activeTab === 'LOAD_PAYMENTS' && (
          <section className="mt-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Load Payments</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Track taken/completed loads, update payment lifecycle, and jump directly to load payment focus.
                </p>
              </div>
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

            <div className="mt-3 flex flex-wrap gap-2">
              {LOAD_PAYMENT_FILTERS.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setLoadPaymentFilter(filter.id)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                    loadPaymentFilter === filter.id
                      ? 'bg-blue-600 text-white'
                      : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-[11px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-2 py-1">Reference</th>
                    <th className="px-2 py-1">Route</th>
                    <th className="px-2 py-1">Load Status</th>
                    <th className="px-2 py-1">Payment Status</th>
                    <th className="px-2 py-1">Payment Date</th>
                    <th className="px-2 py-1 text-right">Expected Amount</th>
                    <th className="px-2 py-1 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loadPaymentRows.length === 0 && (
                    <tr>
                      <td className="px-2 py-3 text-slate-500" colSpan={7}>
                        {isLoading ? 'Loading...' : 'No loads match selected payment filter.'}
                      </td>
                    </tr>
                  )}

                  {loadPaymentRows.map((row) => (
                    <tr key={row.load.id} className="border-t border-slate-100">
                      <td className="px-2 py-1.5 font-medium text-slate-900">{row.load.referenceNumber}</td>
                      <td className="px-2 py-1.5 text-slate-700">
                        {row.load.pickupCity} → {row.load.deliveryCity}
                      </td>
                      <td className="px-2 py-1.5">
                        <select
                          value={row.load.status}
                          onChange={(event) =>
                            void handleUpdateLoadWorkflowStatus(row.load.id, event.target.value as LoadStatus)
                          }
                          disabled={updatingLoadStatusId === row.load.id}
                          className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 disabled:bg-slate-100"
                        >
                          {selectableLoadStatuses.map((status) => (
                            <option key={status} value={status}>
                              {getLoadStatusLabel(status)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-1.5">
                        <select
                          value={row.payment?.status ?? PaymentStatus.PENDING}
                          onChange={(event) =>
                            void handleUpdatePaymentStatus(
                              row.load,
                              row.payment,
                              event.target.value as PaymentStatus,
                            )
                          }
                          disabled={updatingPaymentLoadId === row.load.id}
                          className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 disabled:bg-slate-100"
                        >
                          {selectablePaymentStatuses.map((status) => (
                            <option key={status} value={status}>
                              {status.replaceAll('_', ' ')}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-1.5 text-slate-700">
                        {row.paymentDate ? formatDateCell(row.paymentDate) : '—'}
                      </td>
                      <td className="px-2 py-1.5 text-right font-medium text-slate-900">
                        {row.expectedAmount > 0 ? formatMoney(row.expectedAmount) : '—'}
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <button
                          type="button"
                          onClick={() => handleOpenLoadPayment(row.load.id)}
                          className="rounded border border-blue-300 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                        >
                          Payment
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>

      {isFixedExpenseModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4 py-6"
          onClick={() => {
            if (!isSubmitting) {
              setIsFixedExpenseModalOpen(false);
              setEditingFixedExpense(null);
            }
          }}
        >
          <section
            className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-4 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">
                {editingFixedExpense ? 'Edit Fixed Expense' : 'Add Fixed Expense'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsFixedExpenseModalOpen(false);
                  setEditingFixedExpense(null);
                }}
                disabled={isSubmitting}
                className="rounded border border-slate-300 bg-white p-1 text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-2 md:grid-cols-2">
              <label className="text-xs text-slate-600">
                Category
                <select
                  value={fixedForm.category}
                  onChange={(event) =>
                    setFixedForm((prev) => ({ ...prev, category: event.target.value as ExpenseCategory }))
                  }
                  className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                >
                  {fixedCategoryOptions.map((category) => (
                    <option key={category} value={category}>
                      {getExpenseCategoryLabel(category)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-slate-600">
                Amount
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Amount"
                  value={fixedForm.amount}
                  onChange={(event) => setFixedForm((prev) => ({ ...prev, amount: event.target.value }))}
                  className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                />
              </label>
              <label className="text-xs text-slate-600">
                Due Day (1-31)
                <input
                  type="number"
                  min="1"
                  max="31"
                  step="1"
                  value={fixedForm.dueDay}
                  onChange={(event) => setFixedForm((prev) => ({ ...prev, dueDay: event.target.value }))}
                  className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                />
              </label>
              <label className="text-xs text-slate-600">
                Stop Date (optional)
                <DateTimePicker
                  mode="date"
                  value={fixedForm.stopDate}
                  onChange={(value) => setFixedForm((prev) => ({ ...prev, stopDate: value }))}
                  triggerClassName="mt-1"
                />
              </label>
              <label className="text-xs text-slate-600">
                Label
                <input
                  type="text"
                  placeholder="Lease, Base Pay..."
                  value={fixedForm.label}
                  onChange={(event) => setFixedForm((prev) => ({ ...prev, label: event.target.value }))}
                  className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                />
              </label>
            </div>

            <div className="mt-4 flex items-center justify-between gap-2">
              <div>
                {editingFixedExpense && (
                  <button
                    type="button"
                    onClick={() => void handleDeleteFixedExpense()}
                    disabled={isSubmitting}
                    className="rounded border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                  >
                    Hard Delete
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsFixedExpenseModalOpen(false);
                    setEditingFixedExpense(null);
                  }}
                  disabled={isSubmitting}
                  className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleAddFixedExpense()}
                  disabled={isSubmitting}
                  className="inline-flex items-center justify-center gap-1.5 rounded border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {editingFixedExpense ? 'Save Fixed Expense' : 'Add Fixed Expense'}
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {isVariableCostModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4 py-6"
          onClick={() => {
            if (!isSubmitting) setIsVariableCostModalOpen(false);
          }}
        >
          <section
            className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-4 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Add Variable Cost</h3>
              <button
                type="button"
                onClick={() => setIsVariableCostModalOpen(false)}
                disabled={isSubmitting}
                className="rounded border border-slate-300 bg-white p-1 text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-2 md:grid-cols-2">
              <label className="text-xs text-slate-600">
                Category
                <select
                  value={variableForm.category}
                  onChange={(event) =>
                    setVariableForm((prev) => ({ ...prev, category: event.target.value as ExpenseCategory }))
                  }
                  className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                >
                  {VARIABLE_EXPENSE_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {getVariableCategoryLabel(category)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-slate-600">
                Amount
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Amount"
                  value={variableForm.amount}
                  onChange={(event) => setVariableForm((prev) => ({ ...prev, amount: event.target.value }))}
                  className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                />
              </label>
              <label className="text-xs text-slate-600">
                Date
                <DateTimePicker
                  mode="date"
                  value={variableForm.date}
                  onChange={(value) => setVariableForm((prev) => ({ ...prev, date: value }))}
                  triggerClassName="mt-1"
                />
              </label>
              <label className="text-xs text-slate-600">
                Label
                <input
                  type="text"
                  placeholder="Label"
                  value={variableForm.label}
                  onChange={(event) => setVariableForm((prev) => ({ ...prev, label: event.target.value }))}
                  className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                />
              </label>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsVariableCostModalOpen(false)}
                disabled={isSubmitting}
                className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleAddVariableExpense()}
                disabled={isSubmitting}
                className="inline-flex items-center justify-center gap-1.5 rounded border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Variable Cost
              </button>
            </div>
          </section>
        </div>
      )}

      {isCustomIncomeModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4 py-6"
          onClick={() => {
            if (!isSubmitting && !deletingFixedIncomeId) {
              setIsCustomIncomeModalOpen(false);
              setEditingFixedIncome(null);
              resetCustomIncomeForm();
            }
          }}
        >
          <section
            className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-4 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  {editingFixedIncome ? 'Edit Fixed Income' : 'Add Fixed Income'}
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Monthly recurring entry not linked to a load.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsCustomIncomeModalOpen(false);
                  setEditingFixedIncome(null);
                  resetCustomIncomeForm();
                }}
                disabled={isSubmitting || Boolean(deletingFixedIncomeId)}
                className="rounded border border-slate-300 bg-white p-1 text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-2 md:grid-cols-2">
              <label className="text-xs text-slate-600 md:col-span-2">
                Description
                <input
                  type="text"
                  placeholder="Description"
                  value={customIncomeForm.description}
                  onChange={(event) =>
                    setCustomIncomeForm((prev) => ({ ...prev, description: event.target.value }))
                  }
                  className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                />
              </label>
              <label className="text-xs text-slate-600">
                Amount
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Amount"
                  value={customIncomeForm.amount}
                  onChange={(event) =>
                    setCustomIncomeForm((prev) => ({ ...prev, amount: event.target.value }))
                  }
                  className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                />
              </label>
              <label className="text-xs text-slate-600">
                Input Currency
                <select
                  value={customIncomeForm.inputCurrency}
                  onChange={(event) =>
                    setCustomIncomeForm((prev) => ({
                      ...prev,
                      inputCurrency: event.target.value as FixedIncomeInputCurrency,
                    }))
                  }
                  className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                >
                  <option value="EUR">EUR</option>
                  <option value="RSD">RSD</option>
                </select>
              </label>
              {customIncomeForm.inputCurrency === 'RSD' && (
                <p className="md:col-span-2 rounded border border-blue-200 bg-blue-50 px-2 py-1 text-xs text-blue-700">
                  Converted and saved in EUR: {formatMoney(round2(toNumber(customIncomeForm.amount) / RSD_TO_EUR_MULTIPLIER))} (RSD / 118)
                </p>
              )}
              <label className="text-xs text-slate-600">
                Due Day (1-31)
                <input
                  type="number"
                  min="1"
                  max="31"
                  step="1"
                  placeholder="e.g. 15"
                  value={customIncomeForm.dueDay}
                  onChange={(event) =>
                    setCustomIncomeForm((prev) => ({ ...prev, dueDay: event.target.value }))
                  }
                  className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                />
              </label>
              <label className="text-xs text-slate-600">
                Stop Date (optional)
                <DateTimePicker
                  mode="date"
                  value={customIncomeForm.stopDate}
                  onChange={(value) =>
                    setCustomIncomeForm((prev) => ({ ...prev, stopDate: value }))
                  }
                  triggerClassName="mt-1"
                />
              </label>
              <label className="text-xs text-slate-600 md:col-span-2">
                Notes (optional)
                <textarea
                  placeholder="Notes"
                  value={customIncomeForm.notes}
                  onChange={(event) =>
                    setCustomIncomeForm((prev) => ({ ...prev, notes: event.target.value }))
                  }
                  className="mt-1 min-h-20 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                />
              </label>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              {editingFixedIncome && (
                <button
                  type="button"
                  onClick={() => void handleDeleteFixedIncome(editingFixedIncome.id)}
                  disabled={isSubmitting || deletingFixedIncomeId === editingFixedIncome.id}
                  className="rounded border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                >
                  Delete
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setIsCustomIncomeModalOpen(false);
                  setEditingFixedIncome(null);
                  resetCustomIncomeForm();
                }}
                disabled={isSubmitting || Boolean(deletingFixedIncomeId)}
                className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleAddCustomIncome()}
                disabled={isSubmitting || Boolean(deletingFixedIncomeId)}
                className="inline-flex items-center justify-center gap-1.5 rounded border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
              >
                <Plus className="h-3.5 w-3.5" />
                {editingFixedIncome ? 'Save Changes' : 'Add Income'}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
