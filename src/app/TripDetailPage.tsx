import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { RefreshCw } from 'lucide-react';
import { documentApi, loadApi, paymentApi, tripApi } from '../api';
import type { Load, PaymentRecord, Trip } from '../domain/entities';
import {
  DocumentCategory,
  DocumentType,
  LoadStatus,
  PaymentStatus,
  TripStatus,
} from '../domain/enums';
import { ThinModuleMenu } from './components/ThinModuleMenu';
import { formatSerbiaDateTime, getSerbiaNowDateKey } from '../utils/serbia-time';

const TRIP_STATUS_STYLES: Record<TripStatus, string> = {
  [TripStatus.PLANNED]: 'border-amber-200 bg-amber-50 text-amber-700',
  [TripStatus.IN_PROGRESS]: 'border-blue-200 bg-blue-50 text-blue-700',
  [TripStatus.COMPLETED]: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  [TripStatus.CANCELED]: 'border-rose-200 bg-rose-50 text-rose-700',
};

const LOAD_STATUS_STYLES: Record<LoadStatus, string> = {
  [LoadStatus.DRAFT]: 'border-slate-200 bg-slate-50 text-slate-700',
  [LoadStatus.PUBLISHED]: 'border-slate-200 bg-slate-50 text-slate-700',
  [LoadStatus.NEGOTIATING]: 'border-amber-200 bg-amber-50 text-amber-700',
  [LoadStatus.TAKEN]: 'border-blue-200 bg-blue-50 text-blue-700',
  [LoadStatus.ON_BOARD]: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  [LoadStatus.IN_TRANSIT]: 'border-cyan-200 bg-cyan-50 text-cyan-700',
  [LoadStatus.DELIVERED]: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  [LoadStatus.CANCELED]: 'border-rose-200 bg-rose-50 text-rose-700',
  [LoadStatus.NOT_INTERESTED]: 'border-slate-200 bg-slate-50 text-slate-700',
};

const PAYMENT_STATUS_STYLES: Record<PaymentStatus, string> = {
  [PaymentStatus.PENDING]: 'border-amber-200 bg-amber-50 text-amber-700',
  [PaymentStatus.INVOICED]: 'border-blue-200 bg-blue-50 text-blue-700',
  [PaymentStatus.PAID]: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  [PaymentStatus.OVERDUE]: 'border-rose-200 bg-rose-50 text-rose-700',
  [PaymentStatus.DISPUTED]: 'border-orange-200 bg-orange-50 text-orange-700',
  [PaymentStatus.WRITTEN_OFF]: 'border-slate-200 bg-slate-50 text-slate-700',
};

const toNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatMoney = (value: number): string =>
  new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(toNumber(value));

const formatDateTime = (value?: string | null): string => formatSerbiaDateTime(value, '—');

const getTripKm = (trip: Trip): number | null => {
  if (trip.startOdometerKm === null || trip.endOdometerKm === null) return null;
  return trip.endOdometerKm - trip.startOdometerKm;
};

const resolveLoadAmount = (load: Load): number =>
  toNumber(load.agreedPrice ?? load.publishedPrice);

const toTimestamp = (value?: string | null): number => {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

const getLatestPaymentByLoad = (
  payments: PaymentRecord[],
  loadIdSet: Set<string>,
): Map<string, PaymentRecord> => {
  const sorted = [...payments]
    .filter((payment) => loadIdSet.has(payment.loadId))
    .sort((a, b) => {
      const dateA = Math.max(toTimestamp(a.updatedAt), toTimestamp(a.paidDate), toTimestamp(a.issueDate));
      const dateB = Math.max(toTimestamp(b.updatedAt), toTimestamp(b.paidDate), toTimestamp(b.issueDate));
      return dateB - dateA;
    });

  const map = new Map<string, PaymentRecord>();
  sorted.forEach((payment) => {
    if (!map.has(payment.loadId)) {
      map.set(payment.loadId, payment);
    }
  });
  return map;
};

export default function TripDetailPage() {
  const { tripId } = useParams();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [allPayments, setAllPayments] = useState<PaymentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [statusModalLoad, setStatusModalLoad] = useState<{
    id: string;
    referenceNumber: string;
    status: LoadStatus;
  } | null>(null);
  const [cmrFile, setCmrFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshData = useCallback(async () => {
    if (!tripId) {
      setTrip(null);
      setAllPayments([]);
      setError('Trip ID is missing.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const [tripData, payments] = await Promise.all([tripApi.getOne(tripId), paymentApi.getAll()]);
      setTrip(tripData);
      setAllPayments(payments);
    } catch (requestError) {
      setTrip(null);
      setAllPayments([]);
      setError(requestError instanceof Error ? requestError.message : 'Failed to load trip details.');
    } finally {
      setIsLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    void refreshData();
  }, [refreshData]);

  const tripLoads = useMemo(() => trip?.loads ?? [], [trip]);

  const latestPaymentByLoad = useMemo(() => {
    const loadIds = new Set(tripLoads.map((load) => load.id));
    return getLatestPaymentByLoad(allPayments, loadIds);
  }, [allPayments, tripLoads]);

  const expectedRevenue = useMemo(
    () => tripLoads.reduce((sum, load) => sum + resolveLoadAmount(load), 0),
    [tripLoads],
  );

  const paidIn = useMemo(() => {
    let total = 0;
    latestPaymentByLoad.forEach((payment) => {
      if (payment.status === PaymentStatus.PAID) {
        total += toNumber(payment.totalWithVat ?? payment.amount);
      }
    });
    return total;
  }, [latestPaymentByLoad]);

  const paymentScheduled = useMemo(() => {
    let total = 0;
    latestPaymentByLoad.forEach((payment) => {
      if (payment.status !== PaymentStatus.PAID && payment.status !== PaymentStatus.WRITTEN_OFF) {
        total += toNumber(payment.totalWithVat ?? payment.amount);
      }
    });
    return total;
  }, [latestPaymentByLoad]);

  const outstanding = Math.max(expectedRevenue - paidIn, 0);
  const tripKm = trip ? getTripKm(trip) : null;

  const closeStatusModal = () => {
    setStatusModalLoad(null);
    setCmrFile(null);
  };

  const openLoadStatusModal = (load: Load) => {
    setStatusModalLoad({
      id: load.id,
      referenceNumber: load.referenceNumber,
      status: load.status,
    });
    setCmrFile(null);
  };

  const handleMarkInTransit = async () => {
    if (!statusModalLoad) return;
    if (statusModalLoad.status !== LoadStatus.TAKEN) return;

    const confirmed = window.confirm('Are you sure you want to mark this load as IN_TRANSIT?');
    if (!confirmed) return;

    setIsUpdatingStatus(true);
    setError(null);
    try {
      await loadApi.updateStatus(statusModalLoad.id, LoadStatus.IN_TRANSIT);
      closeStatusModal();
      await refreshData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to set load to IN_TRANSIT.');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const uploadCmrDocument = async (loadId: string, referenceNumber: string, file: File) => {
    const uploaded = await documentApi.upload(file);
    await documentApi.create({
      documentType: DocumentType.CMR,
      category: DocumentCategory.LOAD,
      title: `CMR - ${referenceNumber}`,
      fileName: uploaded.fileName,
      filePath: uploaded.filePath,
      mimeType: uploaded.mimeType,
      fileSizeBytes: uploaded.fileSizeBytes,
      issuedAt: getSerbiaNowDateKey(),
      loadId,
    });
  };

  const handleMarkDeliveredWithCmr = async () => {
    if (!statusModalLoad) return;
    if (!cmrFile) {
      setError('Select CMR file first.');
      return;
    }

    setIsUpdatingStatus(true);
    setError(null);
    try {
      if (statusModalLoad.status === LoadStatus.IN_TRANSIT) {
        await loadApi.updateStatus(statusModalLoad.id, LoadStatus.DELIVERED);
      }
      await uploadCmrDocument(statusModalLoad.id, statusModalLoad.referenceNumber, cmrFile);
      closeStatusModal();
      await refreshData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to deliver load and upload CMR.');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleMarkLoadCanceled = async () => {
    if (!statusModalLoad) return;
    const confirmed = window.confirm('Mark this load as CANCELED?');
    if (!confirmed) return;

    setIsUpdatingStatus(true);
    setError(null);
    try {
      await loadApi.updateStatus(statusModalLoad.id, LoadStatus.CANCELED);
      closeStatusModal();
      await refreshData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to cancel load.');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-100">
      <ThinModuleMenu />

      <div className="w-full px-4 py-8 sm:px-6 xl:px-8">
        <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Bojovic Transport</p>
              <h1 className="mt-1 text-2xl font-semibold text-slate-900">Trip Details</h1>
              <p className="mt-1 text-sm text-slate-600">Loads and money-in overview for one trip.</p>
            </div>

            <div className="flex items-center gap-2">
              <Link
                to="/trips"
                className="rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Back To Trips
              </Link>
              <button
                type="button"
                onClick={() => void refreshData()}
                disabled={isLoading}
                className="inline-flex items-center gap-1.5 rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>

          {error && (
            <p className="mt-3 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
          )}
        </header>

        {!error && trip && (
          <section className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-2">
            <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-900">Trip Summary</h2>
                <span className={`inline-flex rounded border px-2 py-0.5 text-[11px] font-semibold ${TRIP_STATUS_STYLES[trip.status]}`}>
                  {trip.status}
                </span>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-slate-500">Driver</dt>
                  <dd className="mt-0.5 font-medium text-slate-900">
                    {trip.driver ? `${trip.driver.firstName} ${trip.driver.lastName}` : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Vehicle</dt>
                  <dd className="mt-0.5 font-medium text-slate-900">
                    {trip.van ? `${trip.van.name}${trip.van.licensePlate ? ` (${trip.van.licensePlate})` : ''}` : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Loadboard From</dt>
                  <dd className="mt-0.5 font-medium text-slate-900">{formatDateTime(trip.loadboardFromDate)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Planned End</dt>
                  <dd className="mt-0.5 font-medium text-slate-900">{formatDateTime(trip.plannedEndDate)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Departure</dt>
                  <dd className="mt-0.5 font-medium text-slate-900">{formatDateTime(trip.departureDate)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Return</dt>
                  <dd className="mt-0.5 font-medium text-slate-900">{formatDateTime(trip.returnDate)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Loads In Trip</dt>
                  <dd className="mt-0.5 font-medium text-slate-900">{tripLoads.length}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">KM</dt>
                  <dd className="mt-0.5 font-medium text-slate-900">{tripKm === null ? '—' : `${tripKm} km`}</dd>
                </div>
              </dl>
            </article>

            <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-900">Money In</h2>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">Expected Revenue</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{formatMoney(expectedRevenue)}</p>
                </div>
                <div className="rounded border border-blue-200 bg-blue-50 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-blue-600">Payment Scheduled</p>
                  <p className="mt-1 text-sm font-semibold text-blue-900">{formatMoney(paymentScheduled)}</p>
                </div>
                <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-emerald-600">Paid In</p>
                  <p className="mt-1 text-sm font-semibold text-emerald-900">{formatMoney(paidIn)}</p>
                </div>
                <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-amber-600">Outstanding</p>
                  <p className="mt-1 text-sm font-semibold text-amber-900">{formatMoney(outstanding)}</p>
                </div>
              </div>
            </article>
          </section>
        )}

        {!error && (
          <section className="mt-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Loads In This Trip</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Reference</th>
                    <th className="px-3 py-2">Route</th>
                    <th className="px-3 py-2">Load Status</th>
                    <th className="px-3 py-2 text-right">Load Price</th>
                    <th className="px-3 py-2">Payment Status</th>
                    <th className="px-3 py-2 text-right">Money In</th>
                    <th className="px-3 py-2">Paid Date</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading && (
                    <tr>
                      <td className="px-3 py-6 text-center text-slate-500" colSpan={8}>
                        Loading trip loads...
                      </td>
                    </tr>
                  )}

                  {!isLoading && tripLoads.length === 0 && (
                    <tr>
                      <td className="px-3 py-6 text-center text-slate-500" colSpan={8}>
                        No loads assigned to this trip yet.
                      </td>
                    </tr>
                  )}

                  {!isLoading &&
                    tripLoads.map((load) => {
                      const payment = latestPaymentByLoad.get(load.id) ?? null;
                      const paymentAmount = toNumber(payment?.totalWithVat ?? payment?.amount);
                      return (
                        <tr key={load.id} className="border-t border-slate-100">
                          <td className="px-3 py-2 font-medium text-slate-900">{load.referenceNumber}</td>
                          <td className="px-3 py-2 text-slate-700">
                            {load.pickupCity} → {load.deliveryCity}
                          </td>
                          <td className="px-3 py-2">
                            <span className={`inline-flex rounded border px-2 py-0.5 text-[11px] font-semibold ${LOAD_STATUS_STYLES[load.status]}`}>
                              {load.status}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right font-medium text-slate-900">
                            {formatMoney(resolveLoadAmount(load))}
                          </td>
                          <td className="px-3 py-2">
                            {payment ? (
                              <span className={`inline-flex rounded border px-2 py-0.5 text-[11px] font-semibold ${PAYMENT_STATUS_STYLES[payment.status]}`}>
                                {payment.status}
                              </span>
                            ) : (
                              <span className="text-slate-400">No payment</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right text-slate-700">
                            {payment ? formatMoney(paymentAmount) : '—'}
                          </td>
                          <td className="px-3 py-2 text-slate-700">{formatDateTime(payment?.paidDate)}</td>
                          <td className="px-3 py-2 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => openLoadStatusModal(load)}
                                className="rounded border border-indigo-200 bg-indigo-50 px-2 py-1 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100"
                              >
                                Change Status
                              </button>
                              <Link
                                to={`/loads/${load.id}`}
                                className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                              >
                                Open Load
                              </Link>
                              <button
                                type="button"
                                onClick={() =>
                                  window.open(`/loads/${encodeURIComponent(load.id)}?section=payments`, '_blank', 'noopener,noreferrer')
                                }
                                className="rounded border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-100"
                              >
                                Payments
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>

      {statusModalLoad && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4 py-6"
          onClick={() => {
            if (!isUpdatingStatus) {
              closeStatusModal();
            }
          }}
        >
          <section
            className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-4 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-sm font-semibold text-slate-900">Change Load Status</h3>
            <p className="mt-1 text-xs text-slate-600">Load: {statusModalLoad.referenceNumber}</p>
            <p className="mt-2 text-xs text-slate-600">
              Current status:{' '}
              <span className={`inline-flex rounded border px-2 py-0.5 text-[11px] font-semibold ${LOAD_STATUS_STYLES[statusModalLoad.status]}`}>
                {statusModalLoad.status}
              </span>
            </p>

            {statusModalLoad.status === LoadStatus.TAKEN && (
              <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
                <p className="text-xs text-blue-700">Next step: move this load to IN_TRANSIT.</p>
                <button
                  type="button"
                  onClick={() => void handleMarkInTransit()}
                  disabled={isUpdatingStatus}
                  className="mt-2 rounded border border-blue-700 bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  Mark IN_TRANSIT
                </button>
              </div>
            )}

            {(statusModalLoad.status === LoadStatus.IN_TRANSIT || statusModalLoad.status === LoadStatus.DELIVERED) && (
              <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-xs text-emerald-700">
                  {statusModalLoad.status === LoadStatus.IN_TRANSIT
                    ? 'Upload CMR and mark this load as DELIVERED.'
                    : 'Upload CMR to load documents.'}
                </p>

                <label className="mt-2 block text-xs text-slate-700">
                  CMR File
                  <input
                    type="file"
                    accept=".pdf,image/*"
                    onChange={(event) => setCmrFile(event.target.files?.[0] ?? null)}
                    className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                  />
                </label>
                {cmrFile && (
                  <p className="mt-1 text-[11px] text-slate-600">
                    Selected: <span className="font-medium text-slate-800">{cmrFile.name}</span>
                  </p>
                )}
              </div>
            )}

            <div className="mt-4 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => void handleMarkLoadCanceled()}
                disabled={isUpdatingStatus || statusModalLoad.status === LoadStatus.CANCELED}
                className="rounded border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
              >
                Mark CANCELED
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={closeStatusModal}
                  disabled={isUpdatingStatus}
                  className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  Close
                </button>
                {(statusModalLoad.status === LoadStatus.IN_TRANSIT ||
                  statusModalLoad.status === LoadStatus.DELIVERED) && (
                  <button
                    type="button"
                    onClick={() => void handleMarkDeliveredWithCmr()}
                    disabled={isUpdatingStatus || !cmrFile}
                    className="rounded border border-emerald-700 bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {statusModalLoad.status === LoadStatus.IN_TRANSIT
                      ? 'Mark Delivered'
                      : 'Upload CMR'}
                  </button>
                )}
              </div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
