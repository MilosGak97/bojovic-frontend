import { Currency, DriverPayStatus, ExpenseCategory, ExpenseType } from '../enums';

export interface CreateExpenseDto {
  category: ExpenseCategory;
  expenseType?: ExpenseType;
  amount: number;
  currency?: Currency;
  vatRate?: number;
  vatAmount?: number;
  totalWithVat?: number;
  expenseDate: string;
  description?: string;
  receiptUrl?: string;
  isRecurring?: boolean;
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
