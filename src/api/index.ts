import { api } from './client';
import type {
  Load,
  BrokerCompany,
  BrokerContact,
  Van,
  Driver,
  Trip,
  RoutePlan,
  DispatchAssignment,
  PaymentRecord,
  Document,
  Expense,
  DriverPayRecord,
  CustomIncome,
  PeriodSummary,
  ExpenseBreakdownItem,
  CashFlow,
  LoadProfit,
  VanCostSummary,
  MonthlyPnLItem,
  EmailAccount,
  EmailLog,
  EmailTemplate,
} from '../domain/entities';
import type { PaginatedResponse } from '../domain/types';
import type {
  LoadStatus,
  TripStatus,
  ExpenseCategory,
  ExpenseType,
} from '../domain/enums';
import type {
  CreateBrokerContactDto,
  CreateTripDto,
  UpdateTripDto,
  CompleteTripDto,
  StartTripDto,
  CreateExpenseDto,
  UpdateExpenseDto,
  CreateDriverPayRecordDto,
  UpdateDriverPayRecordDto,
  CreateCustomIncomeDto,
  ConnectEmailAccountDto,
  SendEmailDto,
  CreateEmailTemplateDto,
  UpdateEmailTemplateDto,
} from '../domain/dto';

// ─── Loads ──────────────────────────────────────────────
export const loadApi = {
  getAll: (params?: { status?: LoadStatus; brokerId?: string; limit?: number; offset?: number }) => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.brokerId) query.set('brokerId', params.brokerId);
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));
    const qs = query.toString();
    return api.get<PaginatedResponse<Load>>(`/loads${qs ? `?${qs}` : ''}`);
  },
  getOne: (id: string) => api.get<Load>(`/loads/${id}`),
  create: (data: unknown) => api.post<Load>('/loads', data),
  update: (id: string, data: unknown) => api.put<Load>(`/loads/${id}`, data),
  updateStatus: (id: string, status: LoadStatus) =>
    api.patch<Load>(`/loads/${id}/status`, { status }),
  delete: (id: string) => api.delete(`/loads/${id}`),
};

// ─── Brokers ────────────────────────────────────────────
export const brokerApi = {
  getAll: (search?: string) =>
    api.get<BrokerCompany[]>(`/brokers${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  getOne: (id: string) => api.get<BrokerCompany>(`/brokers/${id}`),
  create: (data: unknown) => api.post<BrokerCompany>('/brokers', data),
  update: (id: string, data: unknown) => api.put<BrokerCompany>(`/brokers/${id}`, data),
  delete: (id: string) => api.delete(`/brokers/${id}`),
};

export const brokerContactApi = {
  getByCompany: (companyId: string) => api.get<BrokerContact[]>(`/brokers/contacts/company/${companyId}`),
  create: (data: CreateBrokerContactDto) => api.post<BrokerContact>('/brokers/contacts', data),
};

// ─── Vans ───────────────────────────────────────────────
export const vanApi = {
  getAll: () => api.get<Van[]>('/vans'),
  getAvailable: () => api.get<Van[]>('/vans/available'),
  getOne: (id: string) => api.get<Van>(`/vans/${id}`),
  create: (data: unknown) => api.post<Van>('/vans', data),
  update: (id: string, data: unknown) => api.put<Van>(`/vans/${id}`, data),
  delete: (id: string) => api.delete(`/vans/${id}`),
};

// ─── Drivers ────────────────────────────────────────────
export const driverApi = {
  getAll: () => api.get<Driver[]>('/drivers'),
  getAvailable: () => api.get<Driver[]>('/drivers/available'),
  getOne: (id: string) => api.get<Driver>(`/drivers/${id}`),
  create: (data: unknown) => api.post<Driver>('/drivers', data),
  update: (id: string, data: unknown) => api.put<Driver>(`/drivers/${id}`, data),
  delete: (id: string) => api.delete(`/drivers/${id}`),
};

// ─── Trips ─────────────────────────────────────────────
export const tripApi = {
  create: (data: CreateTripDto) => api.post<Trip>('/trips', data),
  getAll: (params?: {
    driverId?: string;
    vanId?: string;
    status?: TripStatus;
    from?: string;
    to?: string;
  }) => {
    const query = new URLSearchParams();
    if (params?.driverId) query.set('driverId', params.driverId);
    if (params?.vanId) query.set('vanId', params.vanId);
    if (params?.status) query.set('status', params.status);
    if (params?.from) query.set('from', params.from);
    if (params?.to) query.set('to', params.to);
    const qs = query.toString();
    return api.get<Trip[]>(`/trips${qs ? `?${qs}` : ''}`);
  },
  getActive: () => api.get<Trip[]>('/trips/active'),
  getOne: (id: string) => api.get<Trip>(`/trips/${id}`),
  getByDriver: (driverId: string) => api.get<Trip[]>(`/trips/driver/${driverId}`),
  getActiveByDriver: (driverId: string) =>
    api.get<Trip | null>(`/trips/driver/${driverId}/active`),
  update: (id: string, data: UpdateTripDto) => api.patch<Trip>(`/trips/${id}`, data),
  complete: (id: string, data: CompleteTripDto) =>
    api.patch<Trip>(`/trips/${id}/complete`, data),
  cancel: (id: string) => api.patch<Trip>(`/trips/${id}/cancel`, {}),
  start: (id: string, data: StartTripDto) => api.patch<Trip>(`/trips/${id}/start`, data),
  addLoad: (tripId: string, loadId: string) =>
    api.post<Trip>(`/trips/${tripId}/loads/${loadId}`, {}),
  removeLoad: (tripId: string, loadId: string) =>
    api.delete<Trip>(`/trips/${tripId}/loads/${loadId}`),
  delete: (id: string) => api.delete(`/trips/${id}`),
};

// ─── Routes ─────────────────────────────────────────────
export const routeApi = {
  getOne: (id: string) => api.get<RoutePlan>(`/routes/${id}`),
  getByVan: (vanId: string) => api.get<RoutePlan[]>(`/routes/van/${vanId}`),
  create: (data: unknown) => api.post<RoutePlan>('/routes', data),
  update: (id: string, data: unknown) => api.put<RoutePlan>(`/routes/${id}`, data),
  delete: (id: string) => api.delete(`/routes/${id}`),
  simulate: (routeId: string, name?: string) =>
    api.post(`/routes/${routeId}/simulate`, { name }),
  applySimulation: (simulationId: string) =>
    api.post(`/routes/simulations/${simulationId}/apply`, {}),
  getCargoAtStop: (routeId: string, stopIndex: number) =>
    api.get<string[]>(`/routes/${routeId}/cargo?stopIndex=${stopIndex}`),
};

// ─── Dispatch ───────────────────────────────────────────
export const dispatchApi = {
  getOne: (id: string) => api.get<DispatchAssignment>(`/dispatch/${id}`),
  getByVan: (vanId: string) => api.get<DispatchAssignment[]>(`/dispatch/van/${vanId}`),
  getByDriver: (driverId: string) => api.get<DispatchAssignment[]>(`/dispatch/driver/${driverId}`),
  create: (data: unknown) => api.post<DispatchAssignment>('/dispatch', data),
  update: (id: string, data: unknown) => api.put<DispatchAssignment>(`/dispatch/${id}`, data),
  updateStatus: (id: string, status: string) =>
    api.patch<DispatchAssignment>(`/dispatch/${id}/status`, { status }),
  delete: (id: string) => api.delete(`/dispatch/${id}`),
};

// ─── Payments ───────────────────────────────────────────
export const paymentApi = {
  getAll: () => api.get<PaymentRecord[]>('/payments'),
  getOne: (id: string) => api.get<PaymentRecord>(`/payments/${id}`),
  getByLoad: (loadId: string) => api.get<PaymentRecord[]>(`/payments?loadId=${loadId}`),
  getByBroker: (brokerId: string) => api.get<PaymentRecord[]>(`/payments?brokerId=${brokerId}`),
  getOverdue: () => api.get<PaymentRecord[]>('/payments/overdue'),
  create: (data: unknown) => api.post<PaymentRecord>('/payments', data),
  update: (id: string, data: unknown) => api.put<PaymentRecord>(`/payments/${id}`, data),
  markPaid: (id: string, paidDate?: string) =>
    api.patch<PaymentRecord>(`/payments/${id}/paid`, { paidDate }),
  getBrokerStats: (brokerId: string) => api.get(`/payments/broker/${brokerId}/stats`),
};

// ─── Documents ──────────────────────────────────────────
export const documentApi = {
  getOne: (id: string) => api.get<Document>(`/documents/${id}`),
  getByEntity: (category: string, entityId: string) =>
    api.get<Document[]>(`/documents?category=${category}&entityId=${entityId}`),
  create: (data: unknown) => api.post<Document>('/documents', data),
  delete: (id: string) => api.delete(`/documents/${id}`),
};

// ─── Finance ────────────────────────────────────────────
export const expenseApi = {
  create: (data: CreateExpenseDto) => api.post<Expense>('/finance/expenses', data),
  getAll: (params?: {
    vanId?: string;
    driverId?: string;
    loadId?: string;
    category?: ExpenseCategory;
    type?: ExpenseType;
    from?: string;
    to?: string;
    isRecurring?: boolean;
  }) => {
    const query = new URLSearchParams();
    if (params?.vanId) query.set('vanId', params.vanId);
    if (params?.driverId) query.set('driverId', params.driverId);
    if (params?.loadId) query.set('loadId', params.loadId);
    if (params?.category) query.set('category', params.category);
    if (params?.type) query.set('type', params.type);
    if (params?.from) query.set('from', params.from);
    if (params?.to) query.set('to', params.to);
    if (params?.isRecurring !== undefined) query.set('isRecurring', String(params.isRecurring));
    const qs = query.toString();
    return api.get<Expense[]>(`/finance/expenses${qs ? `?${qs}` : ''}`);
  },
  getRecurring: () => api.get<Expense[]>('/finance/expenses/recurring'),
  getOne: (id: string) => api.get<Expense>(`/finance/expenses/${id}`),
  update: (id: string, data: UpdateExpenseDto) => api.put<Expense>(`/finance/expenses/${id}`, data),
  delete: (id: string) => api.delete(`/finance/expenses/${id}`),
};

export const driverPayApi = {
  create: (data: CreateDriverPayRecordDto) => api.post<DriverPayRecord>('/finance/driver-pay', data),
  getAll: (params?: { driverId?: string; year?: number; month?: number }) => {
    const query = new URLSearchParams();
    if (params?.driverId) query.set('driverId', params.driverId);
    if (params?.year) query.set('year', String(params.year));
    if (params?.month) query.set('month', String(params.month));
    const qs = query.toString();
    return api.get<DriverPayRecord[]>(`/finance/driver-pay${qs ? `?${qs}` : ''}`);
  },
  getOne: (id: string) => api.get<DriverPayRecord>(`/finance/driver-pay/${id}`),
  update: (id: string, data: UpdateDriverPayRecordDto) =>
    api.put<DriverPayRecord>(`/finance/driver-pay/${id}`, data),
  markPaid: (id: string, paidDate?: string) =>
    api.patch<DriverPayRecord>(`/finance/driver-pay/${id}/paid`, { paidDate }),
};

export const customIncomeApi = {
  create: (data: CreateCustomIncomeDto) => api.post<CustomIncome>('/finance/custom-income', data),
  getAll: (params?: { from?: string; to?: string; category?: string }) => {
    const query = new URLSearchParams();
    if (params?.from) query.set('from', params.from);
    if (params?.to) query.set('to', params.to);
    if (params?.category) query.set('category', params.category);
    const qs = query.toString();
    return api.get<CustomIncome[]>(`/finance/custom-income${qs ? `?${qs}` : ''}`);
  },
  getOne: (id: string) => api.get<CustomIncome>(`/finance/custom-income/${id}`),
  update: (id: string, data: Partial<CreateCustomIncomeDto>) =>
    api.put<CustomIncome>(`/finance/custom-income/${id}`, data),
  delete: (id: string) => api.delete(`/finance/custom-income/${id}`),
};

export const financeReportApi = {
  getSummary: (from: string, to: string) =>
    api.get<PeriodSummary>(`/finance/reports/summary?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
  getExpenseBreakdown: (from: string, to: string) =>
    api.get<ExpenseBreakdownItem[]>(
      `/finance/reports/expense-breakdown?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    ),
  getCashFlow: (from: string, to: string) =>
    api.get<CashFlow>(`/finance/reports/cash-flow?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
  getLoadProfit: (loadId: string) => api.get<LoadProfit>(`/finance/reports/load-profit/${loadId}`),
  getLoadProfits: (from: string, to: string) =>
    api.get<LoadProfit[]>(
      `/finance/reports/load-profits?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    ),
  getVanCosts: (vanId: string, from: string, to: string) =>
    api.get<VanCostSummary>(
      `/finance/reports/van-costs/${vanId}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    ),
  getAllVanCosts: (from: string, to: string) =>
    api.get<VanCostSummary[]>(
      `/finance/reports/van-costs?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    ),
  getMonthlyPnL: (year: number) =>
    api.get<MonthlyPnLItem[]>(`/finance/reports/monthly-pnl?year=${year}`),
};

// ─── Email ─────────────────────────────────────────────
export const emailApi = {
  connectAccount: (data: ConnectEmailAccountDto) =>
    api.post<{ authUrl: string }>('/email/accounts/connect', data),
  getAccounts: () => api.get<EmailAccount[]>('/email/accounts'),
  deleteAccount: (id: string) => api.delete(`/email/accounts/${id}`),
  disconnectAccount: (id: string) => api.patch<EmailAccount>(`/email/accounts/${id}/disconnect`, {}),
  send: (data: SendEmailDto) => api.post<EmailLog>('/email/send', data),
  getLogs: (params?: { accountId?: string; relatedEntityType?: string; relatedEntityId?: string }) => {
    const query = new URLSearchParams();
    if (params?.accountId) query.set('accountId', params.accountId);
    if (params?.relatedEntityType) query.set('relatedEntityType', params.relatedEntityType);
    if (params?.relatedEntityId) query.set('relatedEntityId', params.relatedEntityId);
    const qs = query.toString();
    return api.get<EmailLog[]>(`/email/logs${qs ? `?${qs}` : ''}`);
  },
  getTemplates: () => api.get<EmailTemplate[]>('/email/templates'),
  getTemplate: (id: string) => api.get<EmailTemplate>(`/email/templates/${id}`),
  createTemplate: (data: CreateEmailTemplateDto) => api.post<EmailTemplate>('/email/templates', data),
  updateTemplate: (id: string, data: UpdateEmailTemplateDto) =>
    api.put<EmailTemplate>(`/email/templates/${id}`, data),
  deleteTemplate: (id: string) => api.delete(`/email/templates/${id}`),
  renderTemplate: (id: string, variables: Record<string, string>) =>
    api.post<{ subject: string; body: string }>(`/email/templates/${id}/render`, variables),
};
