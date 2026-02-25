import { Currency, DriverPayStatus, ExpenseCategory, ExpenseRecurrence, ExpenseType } from '../enums';

export interface CreateExpenseDto {
  category: ExpenseCategory;
  expenseType?: ExpenseType;
  amount: number;
  currency?: Currency;
  vatRate?: number;
  vatAmount?: number;
  totalWithVat?: number;
  expenseDate: string;
  stopDate?: string | null;
  description?: string;
  receiptUrl?: string;
  isRecurring?: boolean;
  recurrenceType?: ExpenseRecurrence;
  recurringLabel?: string;
  vendor?: string;
  referenceNumber?: string;
  notes?: string;
  vanId?: string;
  driverId?: string;
  loadId?: string;
}

export type UpdateExpenseDto = Partial<CreateExpenseDto>;

export interface CreateDriverPayRecordDto {
  driverId: string;
  year: number;
  month: number;
  baseSalary: number;
  perDiemTotal?: number;
  bonus?: number;
  deductions?: number;
  currency?: Currency;
  status?: DriverPayStatus;
  paidDate?: string;
  notes?: string;
}

export type UpdateDriverPayRecordDto = Partial<CreateDriverPayRecordDto>;

export interface CreateCustomIncomeDto {
  amount: number;
  currency?: Currency;
  incomeDate: string;
  description: string;
  category?: string;
  referenceNumber?: string;
  notes?: string;
}

export type UpdateCustomIncomeDto = Partial<CreateCustomIncomeDto>;
