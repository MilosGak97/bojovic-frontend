import { BaseEntity } from './base.entity';
import { Currency, DriverPayStatus, ExpenseCategory, ExpenseType } from '../enums';
import { Van } from './van.entity';
import { Driver } from './driver.entity';
import { Load } from './load.entity';

export interface Expense extends BaseEntity {
  category: ExpenseCategory;
  expenseType: ExpenseType;
  amount: number;
  currency: Currency;
  vatRate: number | null;
  vatAmount: number | null;
  totalWithVat: number | null;
  expenseDate: string;
  description: string | null;
  receiptUrl: string | null;
  isRecurring: boolean;
  recurringLabel: string | null;
  vendor: string | null;
  referenceNumber: string | null;
  notes: string | null;
  vanId: string | null;
  driverId: string | null;
  loadId: string | null;

  van?: Van | null;
  driver?: Driver | null;
  load?: Load | null;
}

export interface DriverPayRecord extends BaseEntity {
  driverId: string;
  year: number;
  month: number;
  baseSalary: number;
  perDiemTotal: number | null;
  bonus: number | null;
  deductions: number | null;
  totalPay: number;
  currency: Currency;
  status: DriverPayStatus;
  paidDate: string | null;
  notes: string | null;

  driver?: Driver;
}

export interface CustomIncome extends BaseEntity {
  amount: number;
  currency: Currency;
  incomeDate: string;
  description: string;
  category: string | null;
  referenceNumber: string | null;
  notes: string | null;
}

export interface PeriodSummary {
  totalRevenue: number;
  totalExpenses: number;
  totalSalaries: number;
  netProfit: number;
  profitMarginPercent: number;
  totalKmDriven: number;
  costPerKm: number;
  revenuePerKm: number;
}

export interface ExpenseBreakdownItem {
  category: ExpenseCategory;
  total: number;
  count: number;
  percentOfTotal: number;
}

export interface CashFlow {
  expectedIncoming: number;
  expectedIncomingInvoitix: number;
  expectedIncomingValuta: number;
  customIncomeTotal: number;
  totalExpenses: number;
  totalSalaries: number;
  netCashFlow: number;
}

export interface LoadProfit {
  loadId: string;
  revenue: number;
  expenses: number;
  profit: number;
  profitMarginPercent: number;
  distanceKm: number;
  profitPerKm: number;
}

export interface VanCostSummary {
  vanId: string;
  fuel: number;
  toll: number;
  maintenance: number;
  insurance: number;
  leasing: number;
  other: number;
  grandTotal: number;
  costPerKm: number;
}

export interface MonthlyPnLItem {
  month: number;
  totalRevenue: number;
  totalExpenses: number;
  totalSalaries: number;
  netProfit: number;
}
