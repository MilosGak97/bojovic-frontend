import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { driverPayApi, expenseApi, loadApi, paymentApi } from '../api';
import type { DriverPayRecord, Expense, Load, PaymentRecord } from '../domain/entities';
import { Currency, ExpenseCategory, ExpenseType, LoadStatus, PaymentStatus } from '../domain/enums';
import { ThinModuleMenu } from './components/ThinModuleMenu';

type LedgerEventKind = 'INCOME' | 'FIXED' | 'VARIABLE';

type LedgerEvent = {
  id: string;
  date: string;
  kind: LedgerEventKind;
  label: string;
  amount: number;
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

type LoadPaymentFilter = 'ALL' | 'TAKEN' | 'COMPLETED' | 'PAID' | 'PAYMENT_SCHEDULED';

type LoadPaymentRow = {
  load: Load;
  payment: PaymentRecord | null;
  expectedAmount: number;
  paymentDate: string;
};

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

const numberFormatter = new Intl.NumberFormat('de-DE', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const formatMoney = (value: number): string => moneyFormatter.format(toNumber(value));
const formatNumber = (value: number): string => numberFormatter.format(toNumber(value));

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
  const [currentBalanceInput, setCurrentBalanceInput] = useState('0');

  const [allExpenses, setAllExpenses] = useState<Expense[]>([]);
  const [allPayments, setAllPayments] = useState<PaymentRecord[]>([]);
  const [allDriverPayRecords, setAllDriverPayRecords] = useState<DriverPayRecord[]>([]);
  const [allLoads, setAllLoads] = useState<Load[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [updatingLoadStatusId, setUpdatingLoadStatusId] = useState<string | null>(null);
  const [updatingPaymentLoadId, setUpdatingPaymentLoadId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [fixedForm, setFixedForm] = useState({
    category: ExpenseCategory.LEASING,
    amount: '',
    dueDate: getDefaultFromDate(),
    label: '',
    vendor: '',
    recurring: true,
  });

  const [variableForm, setVariableForm] = useState({
    category: ExpenseCategory.FUEL,
    amount: '',
    date: getDefaultFromDate(),
    label: '',
    vendor: '',
  });

  const [incomeForm, setIncomeForm] = useState({
    loadId: '',
    amount: '',
    invoiceDate: getDefaultFromDate(),
    incomingDate: getDefaultFromDate(),
    invoiceNumber: '',
    note: '',
  });

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [expenses, payments, driverPay, loads] = await Promise.all([
        expenseApi.getAll(),
        paymentApi.getAll(),
        driverPayApi.getAll(),
        fetchAllLoads(),
      ]);

      setAllExpenses(expenses);
      setAllPayments(payments);
      setAllDriverPayRecords(driverPay);
      setAllLoads(loads);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to load finance data.');
      setAllExpenses([]);
      setAllPayments([]);
      setAllDriverPayRecords([]);
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

  const fixedExpenses = useMemo(
    () => expensesInRange.filter((expense) => expense.expenseType === ExpenseType.FIXED || expense.isRecurring),
    [expensesInRange],
  );

  const variableExpenses = useMemo(
    () => expensesInRange.filter((expense) => expense.expenseType !== ExpenseType.FIXED && !expense.isRecurring),
    [expensesInRange],
  );

  const upcomingIncomes = useMemo(
    () => [...paymentsInRange].sort((a, b) => resolveIncomeDate(a).localeCompare(resolveIncomeDate(b))),
    [paymentsInRange],
  );

  const variableCostRows = useMemo<VariableCostRow[]>(() => {
    const expenseRows: VariableCostRow[] = variableExpenses.map((expense) => ({
      id: expense.id,
      date: toDateOnly(expense.expenseDate) || getDefaultFromDate(),
      source: 'EXPENSE',
      category: expense.category,
      label: expense.description ?? expense.vendor ?? expense.referenceNumber ?? expense.category,
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

  const ledgerEvents = useMemo<LedgerEvent[]>(() => {
    const incomeEvents: LedgerEvent[] = upcomingIncomes.map((payment) => {
      const linkedLoad = payment.load ?? loadsById.get(payment.loadId);
      const loadRef = linkedLoad?.referenceNumber ?? payment.loadId;
      return {
        id: `income-${payment.id}`,
        date: resolveIncomeDate(payment),
        kind: 'INCOME',
        label: `Income ${loadRef}`,
        amount: toNumber(payment.totalWithVat ?? payment.amount),
      };
    });

    const fixedEvents: LedgerEvent[] = fixedExpenses.map((expense) => ({
      id: `fixed-${expense.id}`,
      date: toDateOnly(expense.expenseDate) || getDefaultFromDate(),
      kind: 'FIXED',
      label: expense.recurringLabel ?? expense.description ?? expense.category,
      amount: toNumber(expense.totalWithVat ?? expense.amount),
    }));

    const variableEvents: LedgerEvent[] = variableCostRows.map((row) => ({
      id: `variable-${row.id}`,
      date: row.date,
      kind: 'VARIABLE',
      label: row.label,
      amount: toNumber(row.amount),
    }));

    return [...incomeEvents, ...fixedEvents, ...variableEvents].sort((a, b) =>
      a.date === b.date ? a.id.localeCompare(b.id) : a.date.localeCompare(b.date),
    );
  }, [upcomingIncomes, fixedExpenses, variableCostRows, loadsById]);

  const openingBalance = toNumber(currentBalanceInput);

  const simulation = useMemo(() => {
    let running = openingBalance;

    const rows = ledgerEvents.map((event) => {
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
      ledgerEvents
        .filter((event) => event.kind === 'INCOME')
        .reduce((sum, event) => sum + event.amount, 0),
    );
    const totalOut = round2(
      ledgerEvents
        .filter((event) => event.kind !== 'INCOME')
        .reduce((sum, event) => sum + event.amount, 0),
    );

    return {
      rows,
      totalIncome,
      totalOut,
      projectedBalance: round2(openingBalance + totalIncome - totalOut),
    };
  }, [ledgerEvents, openingBalance]);

  const handleAddFixedExpense = async () => {
    const amount = toNumber(fixedForm.amount);
    if (amount <= 0) {
      setError('Fixed expense amount must be greater than 0.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await expenseApi.create({
        category: fixedForm.category,
        expenseType: ExpenseType.FIXED,
        amount,
        currency: Currency.EUR,
        expenseDate: fixedForm.dueDate,
        ...(fixedForm.label.trim() ? { recurringLabel: fixedForm.label.trim(), description: fixedForm.label.trim() } : {}),
        ...(fixedForm.vendor.trim() ? { vendor: fixedForm.vendor.trim() } : {}),
        isRecurring: fixedForm.recurring,
      });

      setFixedForm((prev) => ({ ...prev, amount: '', label: '', vendor: '' }));
      await loadData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to add fixed expense.');
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
        ...(variableForm.label.trim() ? { description: variableForm.label.trim() } : {}),
        ...(variableForm.vendor.trim() ? { vendor: variableForm.vendor.trim() } : {}),
        isRecurring: false,
      });

      setVariableForm((prev) => ({ ...prev, amount: '', label: '', vendor: '' }));
      await loadData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to add variable expense.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddUpcomingIncome = async () => {
    const amount = toNumber(incomeForm.amount);
    if (!incomeForm.loadId) {
      setError('Select a load for upcoming income.');
      return;
    }
    if (amount <= 0) {
      setError('Income amount must be greater than 0.');
      return;
    }

    const selectedLoad = loadsById.get(incomeForm.loadId);
    if (!selectedLoad?.brokerId) {
      setError('Selected load has no broker assigned.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await paymentApi.create({
        loadId: selectedLoad.id,
        brokerId: selectedLoad.brokerId,
        status: PaymentStatus.INVOICED,
        amount,
        currency: Currency.EUR,
        ...(incomeForm.invoiceNumber.trim() ? { invoiceNumber: incomeForm.invoiceNumber.trim() } : {}),
        issueDate: incomeForm.invoiceDate,
        dueDate: incomeForm.incomingDate,
        ...(incomeForm.note.trim() ? { notes: incomeForm.note.trim() } : {}),
      });

      setIncomeForm((prev) => ({
        ...prev,
        amount: '',
        invoiceNumber: '',
        note: '',
      }));
      await loadData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to add upcoming income.');
    } finally {
      setIsSubmitting(false);
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
                <input
                  type="date"
                  value={from}
                  onChange={(event) => setFrom(event.target.value)}
                  className="mt-1 block rounded border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900"
                />
              </label>
              <label className="text-xs text-slate-600">
                To
                <input
                  type="date"
                  value={to}
                  onChange={(event) => setTo(event.target.value)}
                  className="mt-1 block rounded border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900"
                />
              </label>
              <label className="text-xs text-slate-600">
                Current Balance
                <input
                  type="number"
                  step="0.01"
                  value={currentBalanceInput}
                  onChange={(event) => setCurrentBalanceInput(event.target.value)}
                  className="mt-1 block w-36 rounded border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900"
                />
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

          <p className="mt-3 text-xs text-slate-500">
            Range totals: income {formatMoney(simulation.totalIncome)} • outgoing {formatMoney(simulation.totalOut)} • projected balance {formatMoney(simulation.projectedBalance)}
          </p>

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
        <section className="order-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm xl:col-start-1">
          <h2 className="text-sm font-semibold text-slate-900">3. Fixed Expenses</h2>

          <div className="mt-3 grid gap-2 md:grid-cols-6">
            <select
              value={fixedForm.category}
              onChange={(event) =>
                setFixedForm((prev) => ({ ...prev, category: event.target.value as ExpenseCategory }))
              }
              className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
            >
              {Object.values(ExpenseCategory).map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>

            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="Amount"
              value={fixedForm.amount}
              onChange={(event) => setFixedForm((prev) => ({ ...prev, amount: event.target.value }))}
              className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
            />

            <input
              type="date"
              value={fixedForm.dueDate}
              onChange={(event) => setFixedForm((prev) => ({ ...prev, dueDate: event.target.value }))}
              className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
            />

            <input
              type="text"
              placeholder="Label (Lease, Base Pay...)"
              value={fixedForm.label}
              onChange={(event) => setFixedForm((prev) => ({ ...prev, label: event.target.value }))}
              className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
            />

            <input
              type="text"
              placeholder="Vendor"
              value={fixedForm.vendor}
              onChange={(event) => setFixedForm((prev) => ({ ...prev, vendor: event.target.value }))}
              className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
            />

            <button
              type="button"
              onClick={() => void handleAddFixedExpense()}
              disabled={isSubmitting}
              className="inline-flex items-center justify-center gap-1.5 rounded border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Fixed
            </button>
          </div>

          <label className="mt-2 inline-flex items-center gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={fixedForm.recurring}
              onChange={(event) => setFixedForm((prev) => ({ ...prev, recurring: event.target.checked }))}
              className="h-4 w-4 rounded border-slate-300"
            />
            Recurring monthly
          </label>

          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-2 py-1">Due Date</th>
                  <th className="px-2 py-1">Label</th>
                  <th className="px-2 py-1">Category</th>
                  <th className="px-2 py-1">Recurring</th>
                  <th className="px-2 py-1">Vendor</th>
                  <th className="px-2 py-1 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {fixedExpenses.length === 0 && (
                  <tr>
                    <td className="px-2 py-3 text-slate-500" colSpan={6}>
                      {isLoading ? 'Loading...' : 'No fixed expenses in selected range.'}
                    </td>
                  </tr>
                )}
                {fixedExpenses
                  .slice()
                  .sort((a, b) => (a.expenseDate < b.expenseDate ? 1 : -1))
                  .map((expense) => (
                    <tr key={expense.id} className="border-t border-slate-100">
                      <td className="px-2 py-1.5 text-slate-700">{formatDateCell(expense.expenseDate)}</td>
                      <td className="px-2 py-1.5 font-medium text-slate-800">
                        {expense.recurringLabel ?? expense.description ?? expense.category}
                      </td>
                      <td className="px-2 py-1.5 text-slate-700">{expense.category}</td>
                      <td className="px-2 py-1.5 text-slate-700">{expense.isRecurring ? 'Yes' : 'No'}</td>
                      <td className="px-2 py-1.5 text-slate-700">{expense.vendor ?? '—'}</td>
                      <td className="px-2 py-1.5 text-right text-slate-800">
                        {formatMoney(toNumber(expense.totalWithVat ?? expense.amount))}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="order-1 rounded-xl border border-slate-200 bg-white p-4 shadow-sm xl:col-start-1">
          <h2 className="text-sm font-semibold text-slate-900">1. Upcoming Income</h2>

          <div className="mt-3 grid gap-2 md:grid-cols-6">
            <select
              value={incomeForm.loadId}
              onChange={(event) => {
                const loadId = event.target.value;
                const load = loadsById.get(loadId);
                const suggestedPrice = toNumber(load?.agreedPrice ?? load?.publishedPrice);
                const suggestedDate = toDateOnly(load?.deliveryDateFrom) || incomeForm.incomingDate;

                setIncomeForm((prev) => ({
                  ...prev,
                  loadId,
                  amount: prev.amount || (suggestedPrice > 0 ? String(suggestedPrice) : ''),
                  incomingDate: prev.incomingDate || suggestedDate,
                }));
              }}
              className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
            >
              <option value="">Select load</option>
              {allLoads.map((load) => (
                <option key={load.id} value={load.id}>
                  {load.referenceNumber} • {load.pickupCity} → {load.deliveryCity}
                </option>
              ))}
            </select>

            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="Income amount"
              value={incomeForm.amount}
              onChange={(event) => setIncomeForm((prev) => ({ ...prev, amount: event.target.value }))}
              className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
            />

            <input
              type="date"
              value={incomeForm.invoiceDate}
              onChange={(event) => setIncomeForm((prev) => ({ ...prev, invoiceDate: event.target.value }))}
              className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
            />

            <input
              type="date"
              value={incomeForm.incomingDate}
              onChange={(event) => setIncomeForm((prev) => ({ ...prev, incomingDate: event.target.value }))}
              className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
            />

            <input
              type="text"
              placeholder="Invoice number"
              value={incomeForm.invoiceNumber}
              onChange={(event) => setIncomeForm((prev) => ({ ...prev, invoiceNumber: event.target.value }))}
              className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
            />

            <button
              type="button"
              onClick={() => void handleAddUpcomingIncome()}
              disabled={isSubmitting}
              className="inline-flex items-center justify-center gap-1.5 rounded border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Income
            </button>
          </div>

          <input
            type="text"
            placeholder="Note (optional)"
            value={incomeForm.note}
            onChange={(event) => setIncomeForm((prev) => ({ ...prev, note: event.target.value }))}
            className="mt-2 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
          />

          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-2 py-1">Incoming Date</th>
                  <th className="px-2 py-1">Invoice Date</th>
                  <th className="px-2 py-1">Load</th>
                  <th className="px-2 py-1">Broker</th>
                  <th className="px-2 py-1">Status</th>
                  <th className="px-2 py-1 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {upcomingIncomes.length === 0 && (
                  <tr>
                    <td className="px-2 py-3 text-slate-500" colSpan={6}>
                      {isLoading ? 'Loading...' : 'No upcoming income rows in selected range.'}
                    </td>
                  </tr>
                )}
                {upcomingIncomes.map((payment) => {
                  const linkedLoad = payment.load ?? loadsById.get(payment.loadId);
                  const loadRef = linkedLoad?.referenceNumber ?? payment.loadId;
                  const brokerName = payment.broker?.companyName ?? linkedLoad?.broker?.companyName ?? '—';
                  return (
                    <tr key={payment.id} className="border-t border-slate-100">
                      <td className="px-2 py-1.5 text-slate-700">{formatDateCell(resolveIncomeDate(payment))}</td>
                      <td className="px-2 py-1.5 text-slate-700">
                        {payment.issueDate ? formatDateCell(payment.issueDate) : '—'}
                      </td>
                      <td className="px-2 py-1.5 text-slate-800">{loadRef}</td>
                      <td className="px-2 py-1.5 text-slate-700">{brokerName}</td>
                      <td className="px-2 py-1.5 text-slate-700">{payment.status}</td>
                      <td className="px-2 py-1.5 text-right text-emerald-700 font-semibold">
                        {formatMoney(toNumber(payment.totalWithVat ?? payment.amount))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="order-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm xl:col-start-1">
          <h2 className="text-sm font-semibold text-slate-900">2. Variable Costs</h2>

          <div className="mt-3 grid gap-2 md:grid-cols-6">
            <select
              value={variableForm.category}
              onChange={(event) =>
                setVariableForm((prev) => ({ ...prev, category: event.target.value as ExpenseCategory }))
              }
              className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
            >
              {Object.values(ExpenseCategory).map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>

            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="Amount"
              value={variableForm.amount}
              onChange={(event) => setVariableForm((prev) => ({ ...prev, amount: event.target.value }))}
              className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
            />

            <input
              type="date"
              value={variableForm.date}
              onChange={(event) => setVariableForm((prev) => ({ ...prev, date: event.target.value }))}
              className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
            />

            <input
              type="text"
              placeholder="Label"
              value={variableForm.label}
              onChange={(event) => setVariableForm((prev) => ({ ...prev, label: event.target.value }))}
              className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
            />

            <input
              type="text"
              placeholder="Vendor"
              value={variableForm.vendor}
              onChange={(event) => setVariableForm((prev) => ({ ...prev, vendor: event.target.value }))}
              className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
            />

            <button
              type="button"
              onClick={() => void handleAddVariableExpense()}
              disabled={isSubmitting}
              className="inline-flex items-center justify-center gap-1.5 rounded border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Variable
            </button>
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-2 py-1">Date</th>
                  <th className="px-2 py-1">Source</th>
                  <th className="px-2 py-1">Category</th>
                  <th className="px-2 py-1">Label</th>
                  <th className="px-2 py-1">Status</th>
                  <th className="px-2 py-1 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {variableCostRows.length === 0 && (
                  <tr>
                    <td className="px-2 py-3 text-slate-500" colSpan={6}>
                      {isLoading ? 'Loading...' : 'No variable costs in selected range.'}
                    </td>
                  </tr>
                )}
                {variableCostRows.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="px-2 py-1.5 text-slate-700">{formatDateCell(row.date)}</td>
                    <td className="px-2 py-1.5 text-slate-700">{row.source}</td>
                    <td className="px-2 py-1.5 text-slate-700">{row.category}</td>
                    <td className="px-2 py-1.5 text-slate-800">{row.label}</td>
                    <td className="px-2 py-1.5 text-slate-700">{row.status}</td>
                    <td className="px-2 py-1.5 text-right font-medium text-slate-900">{formatMoney(row.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="order-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm xl:col-start-2 xl:row-span-3 xl:row-start-1">
          <h2 className="text-sm font-semibold text-slate-900">4. Combined Balance Simulation</h2>
          <p className="mt-1 text-xs text-slate-500">
            Opening balance {formatMoney(openingBalance)} • Incoming {formatMoney(simulation.totalIncome)} • Outgoing {formatMoney(simulation.totalOut)} • Projected {formatMoney(simulation.projectedBalance)}
          </p>

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
                  return (
                    <tr key={row.id} className="border-t border-slate-100">
                      <td className="px-2 py-1.5 text-slate-700">{formatDateCell(row.date)}</td>
                      <td className="px-2 py-1.5 text-slate-700">{row.kind}</td>
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
    </main>
  );
}
