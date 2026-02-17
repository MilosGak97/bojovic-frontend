import { api } from './client';
import type {
  Load,
  BrokerCompany,
  Van,
  Driver,
  RoutePlan,
  DispatchAssignment,
  PaymentRecord,
  Document,
} from '../domain/entities';
import type { PaginatedResponse } from '../domain/types';
import type { LoadStatus } from '../domain/enums';

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
