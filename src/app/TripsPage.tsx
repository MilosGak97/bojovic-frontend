import { useCallback, useEffect, useMemo, useState } from 'react';
import { Ban, CheckCircle2, Plus, Play, X } from 'lucide-react';
import { driverApi, tripApi, vanApi } from '../api';
import { ThinModuleMenu } from './components/ThinModuleMenu';
import { CreateTripModal } from './components/CreateTripModal';
import { DateTimePicker } from './components/DateTimePicker';
import type {
  CompleteTripDto,
  CreateTripDto,
  StartTripDto,
} from '../domain/dto';
import type { Driver, Trip, Van } from '../domain/entities';
import { DriverStatus, TripStatus, VanStatus } from '../domain/enums';

type TripTab = 'ACTIVE' | 'PAST' | 'ALL';

const TRIP_STATUS_STYLES: Record<TripStatus, string> = {
  [TripStatus.PLANNED]: 'border-amber-200 bg-amber-50 text-amber-700',
  [TripStatus.IN_PROGRESS]: 'border-blue-200 bg-blue-50 text-blue-700',
  [TripStatus.COMPLETED]: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  [TripStatus.CANCELED]: 'border-rose-200 bg-rose-50 text-rose-700',
};

const toDatetimeLocalValue = (date?: string | null): string => {
  const value = date ? new Date(date) : new Date();
  if (Number.isNaN(value.getTime())) return '';
  const offset = value.getTimezoneOffset();
  const localDate = new Date(value.getTime() - offset * 60_000);
  return localDate.toISOString().slice(0, 16);
};

const toIso = (localDatetime: string): string => new Date(localDatetime).toISOString();

const formatDateTime = (value?: string | null): string => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
};

const getTripKm = (trip: Trip): string => {
  if (trip.startOdometerKm === null || trip.endOdometerKm === null) return '—';
  return `${trip.endOdometerKm - trip.startOdometerKm} km`;
};

const getDriverLabel = (driver?: Driver): string => {
  if (!driver) return '—';
  return `${driver.firstName} ${driver.lastName}`;
};

const getVanLabel = (van?: Van): string => {
  if (!van) return '—';
  return `${van.name}${van.licensePlate ? ` (${van.licensePlate})` : ''}`;
};

export default function TripsPage() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vans, setVans] = useState<Van[]>([]);
  const [activeTab, setActiveTab] = useState<TripTab>('ACTIVE');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createDriverId, setCreateDriverId] = useState('');
  const [createVanId, setCreateVanId] = useState('');
  const [createLoadboardFrom, setCreateLoadboardFrom] = useState(toDatetimeLocalValue());

  const [startTripId, setStartTripId] = useState<string | null>(null);
  const [startDeparture, setStartDeparture] = useState(toDatetimeLocalValue());
  const [startOdometer, setStartOdometer] = useState('');

  const [completeTripId, setCompleteTripId] = useState<string | null>(null);
  const [completeDate, setCompleteDate] = useState(toDatetimeLocalValue());
  const [completeOdometer, setCompleteOdometer] = useState('');

  const refreshData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [allTrips, allDrivers, allVans] = await Promise.all([
        tripApi.getAll(),
        driverApi.getAll(),
        vanApi.getAll(),
      ]);
      setTrips(allTrips);
      setDrivers(allDrivers);
      setVans(allVans);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to load trips.');
      setTrips([]);
      setDrivers([]);
      setVans([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshData();
  }, [refreshData]);

  const activeTrips = useMemo(
    () =>
      trips.filter((trip) =>
        [TripStatus.PLANNED, TripStatus.IN_PROGRESS].includes(trip.status),
      ),
    [trips],
  );

  const pastTrips = useMemo(
    () =>
      trips.filter((trip) =>
        [TripStatus.COMPLETED, TripStatus.CANCELED].includes(trip.status),
      ),
    [trips],
  );

  const visibleTrips = useMemo(() => {
    if (activeTab === 'ACTIVE') return activeTrips;
    if (activeTab === 'PAST') return pastTrips;
    return trips;
  }, [activeTab, activeTrips, pastTrips, trips]);

  const activeDriverIds = useMemo(
    () => new Set(activeTrips.map((trip) => trip.driverId)),
    [activeTrips],
  );
  const plannedVanIds = useMemo(
    () =>
      new Set(
        trips
          .filter((trip) => trip.status === TripStatus.PLANNED)
          .map((trip) => trip.vanId),
      ),
    [trips],
  );

  const availableDrivers = useMemo(() => {
    return drivers.filter(
      (driver) =>
        driver.isActive &&
        driver.status === DriverStatus.AVAILABLE &&
        !activeDriverIds.has(driver.id),
    );
  }, [drivers, activeDriverIds]);

  const planningVans = useMemo(() => {
    return vans.filter(
      (van) =>
        [VanStatus.AVAILABLE, VanStatus.ON_ROUTE].includes(van.status) &&
        !plannedVanIds.has(van.id),
    );
  }, [vans, plannedVanIds]);

  const startTripCandidate = useMemo(
    () => trips.find((trip) => trip.id === startTripId) ?? null,
    [trips, startTripId],
  );

  const openCreateModal = () => {
    const defaultDriver = availableDrivers[0];
    const defaultVan = planningVans[0];
    setCreateDriverId(defaultDriver?.id ?? '');
    setCreateVanId(defaultVan?.id ?? '');
    setCreateLoadboardFrom(toDatetimeLocalValue());
    setIsCreateModalOpen(true);
  };

  const closeCreateModal = () => {
    setIsCreateModalOpen(false);
    setCreateDriverId('');
    setCreateVanId('');
  };

  const handleCreateTrip = async () => {
    if (!createDriverId || !createVanId) {
      setError('Select both driver and vehicle.');
      return;
    }
    if (!createLoadboardFrom) {
      setError('Loadboard from date/time is required.');
      return;
    }
    const isDriverAvailable = availableDrivers.some((driver) => driver.id === createDriverId);
    if (!isDriverAvailable) {
      setError('Selected driver is no longer available.');
      return;
    }

    const isVanSelectable = planningVans.some((van) => van.id === createVanId);
    if (!isVanSelectable) {
      setError('Selected vehicle is no longer available.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const payload: CreateTripDto = {
        driverId: createDriverId,
        vanId: createVanId,
        loadboardFromDate: toIso(createLoadboardFrom),
        departureDate: toIso(createLoadboardFrom),
      };

      await tripApi.create(payload);
      closeCreateModal();
      setActiveTab('ACTIVE');
      await refreshData();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Failed to create trip.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const openStartTripModal = (trip: Trip) => {
    setStartTripId(trip.id);
    setStartDeparture(toDatetimeLocalValue(trip.loadboardFromDate));
    setStartOdometer(
      trip.startOdometerKm !== null
        ? String(trip.startOdometerKm)
        : trip.van?.odometerKm
          ? String(trip.van.odometerKm)
          : '',
    );
  };

  const closeStartTripModal = () => {
    setStartTripId(null);
    setStartOdometer('');
  };

  const handleStartTrip = async () => {
    if (!startTripId) return;
    if (!startDeparture) {
      setError('Departure date and time are required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const payload: StartTripDto = {
        departureDate: toIso(startDeparture),
        ...(startOdometer.trim() ? { startOdometerKm: Number(startOdometer) } : {}),
      };
      await tripApi.start(startTripId, payload);
      closeStartTripModal();
      await refreshData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to start trip.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openCompleteModal = (trip: Trip) => {
    setCompleteTripId(trip.id);
    setCompleteDate(toDatetimeLocalValue());
    setCompleteOdometer('');
  };

  const closeCompleteModal = () => {
    setCompleteTripId(null);
    setCompleteOdometer('');
  };

  const handleCompleteTrip = async () => {
    if (!completeTripId) return;
    if (!completeDate) {
      setError('Return date and time are required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const payload: CompleteTripDto = {
        returnDate: toIso(completeDate),
        ...(completeOdometer.trim() ? { endOdometerKm: Number(completeOdometer) } : {}),
      };
      await tripApi.complete(completeTripId, payload);
      closeCompleteModal();
      await refreshData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to complete trip.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelTrip = async (tripId: string) => {
    const confirmed = window.confirm(
      'Cancel this trip? Driver and vehicle will be moved back to AVAILABLE.',
    );
    if (!confirmed) return;

    setIsSubmitting(true);
    setError(null);
    try {
      await tripApi.cancel(tripId);
      await refreshData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to cancel trip.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const tabs: Array<{ id: TripTab; label: string; count: number }> = [
    { id: 'ACTIVE', label: 'Active Trips', count: activeTrips.length },
    { id: 'PAST', label: 'Past Trips', count: pastTrips.length },
    { id: 'ALL', label: 'All Trips', count: trips.length },
  ];

  return (
    <main className="min-h-screen bg-slate-100">
      <ThinModuleMenu />

      <div className="w-full px-4 py-8 sm:px-6 xl:px-8">
        <header className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Bojovic Transport
              </p>
              <h1 className="mt-1 text-2xl font-semibold text-slate-900">Trips</h1>
              <p className="mt-1 text-sm text-slate-600">
                Active, past, and all trips with loadboard-first workflow.
              </p>
            </div>

            <button
              type="button"
              onClick={openCreateModal}
              disabled={availableDrivers.length === 0 || planningVans.length === 0}
              className="inline-flex items-center gap-1.5 rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Plus className="h-3.5 w-3.5" />
              Create Trip
            </button>
          </div>
        </header>

        {error && (
          <p className="mb-4 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`rounded border px-3 py-1.5 text-xs font-semibold ${
                  activeTab === tab.id
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Driver</th>
                  <th className="px-3 py-2">Vehicle</th>
                  <th className="px-3 py-2">Loadboard From</th>
                  <th className="px-3 py-2">Planned End</th>
                  <th className="px-3 py-2">Departure</th>
                  <th className="px-3 py-2">Return</th>
                  <th className="px-3 py-2 text-right">Loads</th>
                  <th className="px-3 py-2 text-right">KM</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td className="px-3 py-6 text-center text-slate-500" colSpan={10}>
                      Loading trips...
                    </td>
                  </tr>
                )}

                {!isLoading && visibleTrips.length === 0 && (
                  <tr>
                    <td className="px-3 py-6 text-center text-slate-500" colSpan={10}>
                      No trips in this view.
                    </td>
                  </tr>
                )}

                {!isLoading &&
                  visibleTrips.map((trip) => (
                    <tr key={trip.id} className="border-t border-slate-100">
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex rounded border px-2 py-0.5 text-[11px] font-semibold ${TRIP_STATUS_STYLES[trip.status]}`}
                        >
                          {trip.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-800">{getDriverLabel(trip.driver)}</td>
                      <td className="px-3 py-2 text-slate-800">{getVanLabel(trip.van)}</td>
                      <td className="px-3 py-2 text-slate-700">{formatDateTime(trip.loadboardFromDate)}</td>
                      <td className="px-3 py-2 text-slate-700">{formatDateTime(trip.plannedEndDate)}</td>
                      <td className="px-3 py-2 text-slate-700">{formatDateTime(trip.departureDate)}</td>
                      <td className="px-3 py-2 text-slate-700">{formatDateTime(trip.returnDate)}</td>
                      <td className="px-3 py-2 text-right text-slate-700">{trip.loads?.length ?? 0}</td>
                      <td className="px-3 py-2 text-right text-slate-700">{getTripKm(trip)}</td>
                      <td className="px-3 py-2 text-right">
                        {trip.status === TripStatus.PLANNED && (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => openStartTripModal(trip)}
                              disabled={isSubmitting}
                              className="inline-flex items-center gap-1 rounded border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <Play className="h-3.5 w-3.5" />
                              Start
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleCancelTrip(trip.id)}
                              disabled={isSubmitting}
                              className="inline-flex items-center gap-1 rounded border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <Ban className="h-3.5 w-3.5" />
                              Cancel
                            </button>
                          </div>
                        )}

                        {trip.status === TripStatus.IN_PROGRESS && (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => openCompleteModal(trip)}
                              disabled={isSubmitting}
                              className="inline-flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Complete
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleCancelTrip(trip.id)}
                              disabled={isSubmitting}
                              className="inline-flex items-center gap-1 rounded border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <Ban className="h-3.5 w-3.5" />
                              Cancel
                            </button>
                          </div>
                        )}

                        {[TripStatus.COMPLETED, TripStatus.CANCELED].includes(trip.status) && (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <CreateTripModal
        isOpen={isCreateModalOpen}
        isSubmitting={isSubmitting}
        error={error}
        driverOptions={availableDrivers.map((driver) => ({
          id: driver.id,
          name: `${driver.firstName} ${driver.lastName}`,
          email: driver.email,
          phone: driver.phone,
        }))}
        vanOptions={planningVans.map((van) => ({
          id: van.id,
          name: van.name,
          licensePlate: van.licensePlate,
          status: van.status,
          vehicleId: van.vehicleId,
          driverName: van.assignedDriver
            ? `${van.assignedDriver.firstName} ${van.assignedDriver.lastName}`
            : null,
        }))}
        driverId={createDriverId}
        vanId={createVanId}
        loadboardFrom={createLoadboardFrom}
        onDriverChange={setCreateDriverId}
        onVanChange={setCreateVanId}
        onLoadboardFromChange={setCreateLoadboardFrom}
        onClose={closeCreateModal}
        onSubmit={() => void handleCreateTrip()}
      />

      {startTripId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4 py-6"
          onClick={closeStartTripModal}
        >
          <section
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-4 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Start Trip</h2>
              <button
                type="button"
                onClick={closeStartTripModal}
                className="rounded border border-slate-300 bg-white p-1 text-slate-600 hover:bg-slate-50"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <p className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600">
                Loadboard from: {formatDateTime(startTripCandidate?.loadboardFromDate)}
              </p>

              <label className="block text-xs text-slate-600">
                Actual Departure
                <DateTimePicker
                  mode="datetime"
                  value={startDeparture}
                  onChange={setStartDeparture}
                />
              </label>

              <label className="block text-xs text-slate-600">
                Start Odometer (km)
                <input
                  type="number"
                  min={0}
                  value={startOdometer}
                  onChange={(event) => setStartOdometer(event.target.value)}
                  className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                />
              </label>

              <button
                type="button"
                onClick={() => void handleStartTrip()}
                disabled={isSubmitting}
                className="inline-flex w-full items-center justify-center gap-2 rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Play className="h-4 w-4" />
                Confirm Start
              </button>
            </div>
          </section>
        </div>
      )}

      {completeTripId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4 py-6"
          onClick={closeCompleteModal}
        >
          <section
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-4 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Complete Trip</h2>
              <button
                type="button"
                onClick={closeCompleteModal}
                className="rounded border border-slate-300 bg-white p-1 text-slate-600 hover:bg-slate-50"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <label className="block text-xs text-slate-600">
                Return Date & Time
                <DateTimePicker
                  mode="datetime"
                  value={completeDate}
                  onChange={setCompleteDate}
                />
              </label>

              <label className="block text-xs text-slate-600">
                End Odometer (km)
                <input
                  type="number"
                  min={0}
                  value={completeOdometer}
                  onChange={(event) => setCompleteOdometer(event.target.value)}
                  className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                />
              </label>

              <button
                type="button"
                onClick={() => void handleCompleteTrip()}
                disabled={isSubmitting}
                className="inline-flex w-full items-center justify-center gap-2 rounded bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <CheckCircle2 className="h-4 w-4" />
                Complete Trip
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
