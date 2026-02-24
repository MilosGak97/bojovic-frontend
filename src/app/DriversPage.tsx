import { useCallback, useEffect, useMemo, useState } from 'react';
import { Ban, CheckCircle2, Pencil, Plus, Play, X } from 'lucide-react';
import { driverApi, tripApi, vanApi } from '../api';
import { ThinModuleMenu } from './components/ThinModuleMenu';
import type {
  CompleteTripDto,
  CreateDriverDto,
  CreateTripDto,
} from '../domain/dto';
import type { Driver, Trip, Van } from '../domain/entities';
import { DriverStatus, TripStatus, VanStatus } from '../domain/enums';

const DRIVER_STATUS_STYLES: Record<DriverStatus, string> = {
  [DriverStatus.AVAILABLE]: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  [DriverStatus.ON_ROUTE]: 'bg-blue-100 text-blue-700 border-blue-200',
  [DriverStatus.REST]: 'bg-amber-100 text-amber-700 border-amber-200',
  [DriverStatus.OFF_DUTY]: 'bg-slate-100 text-slate-700 border-slate-200',
  [DriverStatus.SICK]: 'bg-rose-100 text-rose-700 border-rose-200',
};

const DRIVER_STATUS_OPTIONS = Object.values(DriverStatus);

const toDatetimeLocalValue = (date?: string | null): string => {
  const value = date ? new Date(date) : new Date();
  if (Number.isNaN(value.getTime())) return '';
  const offset = value.getTimezoneOffset();
  const localDate = new Date(value.getTime() - offset * 60_000);
  return localDate.toISOString().slice(0, 16);
};

const toIso = (localDatetime: string): string => new Date(localDatetime).toISOString();

const formatDate = (value?: string | null): string => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-GB').format(date);
};

const formatDateTime = (value?: string | null): string => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
};

type DriverFormState = {
  firstName: string;
  lastName: string;
  status: DriverStatus;
  phone: string;
  email: string;
  driverLicenseNumber: string;
  driverLicenseValidUntil: string;
  driverLicenseCategories: string;
  nationality: string;
  dateOfBirth: string;
  adrCertified: boolean;
  adrValidUntil: string;
  hiredAt: string;
  notes: string;
  isActive: boolean;
};

const DEFAULT_DRIVER_FORM: DriverFormState = {
  firstName: '',
  lastName: '',
  status: DriverStatus.AVAILABLE,
  phone: '',
  email: '',
  driverLicenseNumber: '',
  driverLicenseValidUntil: '',
  driverLicenseCategories: '',
  nationality: '',
  dateOfBirth: '',
  adrCertified: false,
  adrValidUntil: '',
  hiredAt: '',
  notes: '',
  isActive: true,
};

const toDriverFormState = (driver: Driver): DriverFormState => ({
  firstName: driver.firstName,
  lastName: driver.lastName,
  status: driver.status,
  phone: driver.phone ?? '',
  email: driver.email ?? '',
  driverLicenseNumber: driver.driverLicenseNumber ?? '',
  driverLicenseValidUntil: driver.driverLicenseValidUntil?.slice(0, 10) ?? '',
  driverLicenseCategories: (driver.driverLicenseCategories ?? []).join(', '),
  nationality: driver.nationality ?? '',
  dateOfBirth: driver.dateOfBirth?.slice(0, 10) ?? '',
  adrCertified: driver.adrCertified,
  adrValidUntil: driver.adrValidUntil?.slice(0, 10) ?? '',
  hiredAt: driver.hiredAt?.slice(0, 10) ?? '',
  notes: driver.notes ?? '',
  isActive: driver.isActive,
});

const toDriverPayload = (form: DriverFormState): CreateDriverDto => {
  const categories = form.driverLicenseCategories
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  return {
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    status: form.status,
    ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
    ...(form.email.trim() ? { email: form.email.trim() } : {}),
    ...(form.driverLicenseNumber.trim()
      ? { driverLicenseNumber: form.driverLicenseNumber.trim() }
      : {}),
    ...(form.driverLicenseValidUntil ? { driverLicenseValidUntil: form.driverLicenseValidUntil } : {}),
    ...(categories.length > 0 ? { driverLicenseCategories: categories } : {}),
    ...(form.nationality.trim() ? { nationality: form.nationality.trim() } : {}),
    ...(form.dateOfBirth ? { dateOfBirth: form.dateOfBirth } : {}),
    adrCertified: form.adrCertified,
    ...(form.adrCertified && form.adrValidUntil ? { adrValidUntil: form.adrValidUntil } : {}),
    ...(form.hiredAt ? { hiredAt: form.hiredAt } : {}),
    ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
    isActive: form.isActive,
  };
};

export default function DriversPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vans, setVans] = useState<Van[]>([]);
  const [activeTrips, setActiveTrips] = useState<Trip[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [selectedDriverTrips, setSelectedDriverTrips] = useState<Trip[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingDriverTrips, setIsLoadingDriverTrips] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [driverModalOpen, setDriverModalOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [driverForm, setDriverForm] = useState<DriverFormState>(DEFAULT_DRIVER_FORM);

  const [startTripModalOpen, setStartTripModalOpen] = useState(false);
  const [startTripVanId, setStartTripVanId] = useState('');
  const [startTripDeparture, setStartTripDeparture] = useState(toDatetimeLocalValue());
  const [startTripOdometer, setStartTripOdometer] = useState('');
  const [startTripNotes, setStartTripNotes] = useState('');

  const [completeTripModalOpen, setCompleteTripModalOpen] = useState(false);
  const [completeTripDate, setCompleteTripDate] = useState(toDatetimeLocalValue());
  const [completeTripOdometer, setCompleteTripOdometer] = useState('');

  const selectedDriver = useMemo(
    () => drivers.find((driver) => driver.id === selectedDriverId) ?? null,
    [drivers, selectedDriverId],
  );

  const activeTripByDriver = useMemo(() => {
    const map = new Map<string, Trip>();
    activeTrips.forEach((trip) => {
      map.set(trip.driverId, trip);
    });
    return map;
  }, [activeTrips]);

  const activeVanIds = useMemo(() => new Set(activeTrips.map((trip) => trip.vanId)), [activeTrips]);

  const selectedActiveTrip = useMemo(() => {
    if (!selectedDriver) return null;
    return activeTripByDriver.get(selectedDriver.id) ?? null;
  }, [activeTripByDriver, selectedDriver]);

  const availableVansForTrip = useMemo(() => {
    return vans.filter(
      (van) => van.status === VanStatus.AVAILABLE && !activeVanIds.has(van.id),
    );
  }, [vans, activeVanIds]);

  const loadPageData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [driversData, vansData, activeTripsData] = await Promise.all([
        driverApi.getAll(),
        vanApi.getAll(),
        tripApi.getActive(),
      ]);

      setDrivers(driversData);
      setVans(vansData);
      setActiveTrips(activeTripsData);

      setSelectedDriverId((prev) => {
        if (prev && driversData.some((driver) => driver.id === prev)) return prev;
        return driversData[0]?.id ?? null;
      });
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Failed to load drivers and trips.',
      );
      setDrivers([]);
      setVans([]);
      setActiveTrips([]);
      setSelectedDriverId(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadSelectedDriverTrips = useCallback(async (driverId: string | null) => {
    if (!driverId) {
      setSelectedDriverTrips([]);
      return;
    }

    setIsLoadingDriverTrips(true);
    try {
      const trips = await tripApi.getByDriver(driverId);
      setSelectedDriverTrips(trips);
    } catch {
      setSelectedDriverTrips([]);
    } finally {
      setIsLoadingDriverTrips(false);
    }
  }, []);

  useEffect(() => {
    void loadPageData();
  }, [loadPageData]);

  useEffect(() => {
    void loadSelectedDriverTrips(selectedDriverId);
  }, [selectedDriverId, loadSelectedDriverTrips]);

  const openCreateDriverModal = () => {
    setEditingDriver(null);
    setDriverForm(DEFAULT_DRIVER_FORM);
    setDriverModalOpen(true);
  };

  const openEditDriverModal = (driver: Driver) => {
    setEditingDriver(driver);
    setDriverForm(toDriverFormState(driver));
    setDriverModalOpen(true);
  };

  const closeDriverModal = () => {
    setDriverModalOpen(false);
    setEditingDriver(null);
    setDriverForm(DEFAULT_DRIVER_FORM);
  };

  const handleSaveDriver = async () => {
    if (!driverForm.firstName.trim() || !driverForm.lastName.trim()) {
      setError('First name and last name are required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const payload = toDriverPayload(driverForm);
      if (editingDriver) {
        await driverApi.update(editingDriver.id, payload);
      } else {
        const created = await driverApi.create(payload);
        setSelectedDriverId(created.id);
      }

      closeDriverModal();
      await loadPageData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to save driver.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleDriverActive = async (driver: Driver) => {
    setIsSubmitting(true);
    setError(null);
    try {
      await driverApi.update(driver.id, { isActive: !driver.isActive });
      await loadPageData();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Failed to update driver activity.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const openStartTripModal = () => {
    const firstVan = availableVansForTrip[0];
    setStartTripVanId(firstVan?.id ?? '');
    setStartTripDeparture(toDatetimeLocalValue());
    setStartTripOdometer(firstVan?.odometerKm ? String(firstVan.odometerKm) : '');
    setStartTripNotes('');
    setStartTripModalOpen(true);
  };

  const closeStartTripModal = () => {
    setStartTripModalOpen(false);
    setStartTripVanId('');
    setStartTripOdometer('');
    setStartTripNotes('');
  };

  const handleStartTrip = async () => {
    if (!selectedDriver) {
      setError('Select a driver first.');
      return;
    }

    if (!startTripVanId) {
      setError('Select a vehicle for the trip.');
      return;
    }
    if (!startTripDeparture) {
      setError('Departure date and time are required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const createPayload: CreateTripDto = {
        driverId: selectedDriver.id,
        vanId: startTripVanId,
        departureDate: toIso(startTripDeparture),
        ...(startTripOdometer.trim()
          ? { startOdometerKm: Number(startTripOdometer) }
          : {}),
        ...(startTripNotes.trim() ? { notes: startTripNotes.trim() } : {}),
      };

      const createdTrip = await tripApi.create(createPayload);
      await tripApi.start(createdTrip.id);

      closeStartTripModal();
      await loadPageData();
      await loadSelectedDriverTrips(selectedDriver.id);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to start trip.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openCompleteTripModal = () => {
    setCompleteTripDate(toDatetimeLocalValue());
    setCompleteTripOdometer('');
    setCompleteTripModalOpen(true);
  };

  const closeCompleteTripModal = () => {
    setCompleteTripModalOpen(false);
    setCompleteTripOdometer('');
  };

  const handleCompleteTrip = async () => {
    if (!selectedActiveTrip) return;
    if (!completeTripDate) {
      setError('Return date and time are required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const payload: CompleteTripDto = {
        returnDate: toIso(completeTripDate),
        ...(completeTripOdometer.trim()
          ? { endOdometerKm: Number(completeTripOdometer) }
          : {}),
      };

      await tripApi.complete(selectedActiveTrip.id, payload);
      closeCompleteTripModal();
      await loadPageData();
      await loadSelectedDriverTrips(selectedActiveTrip.driverId);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to complete trip.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelTrip = async () => {
    if (!selectedActiveTrip) return;

    const confirmed = window.confirm('Cancel this trip? Driver and vehicle will be marked AVAILABLE.');
    if (!confirmed) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await tripApi.cancel(selectedActiveTrip.id);
      await loadPageData();
      await loadSelectedDriverTrips(selectedActiveTrip.driverId);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to cancel trip.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedDriverTripHistory = useMemo(
    () =>
      selectedDriverTrips.filter((trip) =>
        [TripStatus.COMPLETED, TripStatus.CANCELED].includes(trip.status),
      ),
    [selectedDriverTrips],
  );

  return (
    <main className="min-h-screen bg-slate-100">
      <ThinModuleMenu />

      <div className="w-full px-4 py-8 sm:px-6 xl:px-8">
        <header className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Bojovic Transport
              </p>
              <h1 className="mt-1 text-2xl font-semibold text-slate-900">Drivers</h1>
              <p className="mt-1 text-sm text-slate-600">
                Manage driver records, start trips with vehicles, and track trip history.
              </p>
            </div>

            <button
              type="button"
              onClick={openCreateDriverModal}
              className="inline-flex items-center gap-1.5 rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Driver
            </button>
          </div>
        </header>

        {error && (
          <p className="mb-4 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        )}

        <div className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Phone</th>
                    <th className="px-3 py-2">License</th>
                    <th className="px-3 py-2">Hired</th>
                    <th className="px-3 py-2">Active Trip</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading && (
                    <tr>
                      <td className="px-3 py-6 text-center text-slate-500" colSpan={7}>
                        Loading drivers...
                      </td>
                    </tr>
                  )}

                  {!isLoading && drivers.length === 0 && (
                    <tr>
                      <td className="px-3 py-6 text-center text-slate-500" colSpan={7}>
                        No drivers found.
                      </td>
                    </tr>
                  )}

                  {!isLoading &&
                    drivers.map((driver) => {
                      const activeTrip = activeTripByDriver.get(driver.id);
                      const isSelected = driver.id === selectedDriverId;

                      return (
                        <tr
                          key={driver.id}
                          className={`cursor-pointer border-t border-slate-100 ${
                            isSelected ? 'bg-blue-50/60' : 'hover:bg-slate-50'
                          }`}
                          onClick={() => setSelectedDriverId(driver.id)}
                        >
                          <td className="px-3 py-2">
                            <p className="font-semibold text-slate-900">
                              {driver.firstName} {driver.lastName}
                            </p>
                            {!driver.isActive && (
                              <p className="text-[11px] font-medium text-rose-600">Inactive</p>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`inline-flex rounded border px-2 py-0.5 text-[11px] font-semibold ${DRIVER_STATUS_STYLES[driver.status]}`}
                            >
                              {driver.status}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-slate-700">{driver.phone ?? '—'}</td>
                          <td className="px-3 py-2 text-slate-700">{driver.driverLicenseNumber ?? '—'}</td>
                          <td className="px-3 py-2 text-slate-700">{formatDate(driver.hiredAt)}</td>
                          <td className="px-3 py-2 text-slate-700">
                            {activeTrip ? (
                              <div>
                                <p className="font-medium text-slate-900">
                                  {activeTrip.van?.name ?? 'Van'}
                                </p>
                                <p className="text-[11px] text-slate-500">
                                  since {formatDateTime(activeTrip.departureDate)}
                                </p>
                              </div>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openEditDriverModal(driver);
                                }}
                                className="inline-flex items-center rounded border border-slate-300 bg-white p-1.5 text-slate-600 hover:bg-slate-50"
                                title="Edit driver"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void handleToggleDriverActive(driver);
                                }}
                                disabled={isSubmitting}
                                className={`rounded border px-2 py-1 text-[11px] font-semibold ${
                                  driver.isActive
                                    ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                                    : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                }`}
                              >
                                {driver.isActive ? 'Deactivate' : 'Activate'}
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

          <section className="space-y-4">
            {!selectedDriver && (
              <article className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
                Select a driver to view details and trips.
              </article>
            )}

            {selectedDriver && (
              <>
                <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h2 className="text-base font-semibold text-slate-900">
                        {selectedDriver.firstName} {selectedDriver.lastName}
                      </h2>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {selectedDriver.email ?? 'No email'} · {selectedDriver.phone ?? 'No phone'}
                      </p>
                    </div>
                    <span
                      className={`inline-flex rounded border px-2 py-0.5 text-[11px] font-semibold ${DRIVER_STATUS_STYLES[selectedDriver.status]}`}
                    >
                      {selectedDriver.status}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
                    <div>
                      <p className="text-slate-500">License</p>
                      <p className="font-medium text-slate-800">
                        {selectedDriver.driverLicenseNumber ?? '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">Categories</p>
                      <p className="font-medium text-slate-800">
                        {selectedDriver.driverLicenseCategories?.join(', ') || '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">License Valid Until</p>
                      <p className="font-medium text-slate-800">
                        {formatDate(selectedDriver.driverLicenseValidUntil)}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">ADR</p>
                      <p className="font-medium text-slate-800">
                        {selectedDriver.adrCertified
                          ? `Yes${selectedDriver.adrValidUntil ? ` · ${formatDate(selectedDriver.adrValidUntil)}` : ''}`
                          : 'No'}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">Nationality</p>
                      <p className="font-medium text-slate-800">{selectedDriver.nationality ?? '—'}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Date of Birth</p>
                      <p className="font-medium text-slate-800">{formatDate(selectedDriver.dateOfBirth)}</p>
                    </div>
                  </div>
                </article>

                <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-slate-900">Current Trip</h3>
                    {!selectedActiveTrip && (
                      <button
                        type="button"
                        onClick={openStartTripModal}
                        disabled={availableVansForTrip.length === 0}
                        className="inline-flex items-center gap-1 rounded border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Play className="h-3.5 w-3.5" />
                        Start New Trip
                      </button>
                    )}
                  </div>

                  {!selectedActiveTrip && (
                    <p className="mt-2 text-xs text-slate-500">No active trip for this driver.</p>
                  )}

                  {selectedActiveTrip && (
                    <div className="mt-2 space-y-2 rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-slate-500">Van</p>
                          <p className="font-semibold text-slate-900">
                            {selectedActiveTrip.van?.name ?? '—'}
                            {selectedActiveTrip.van?.licensePlate
                              ? ` (${selectedActiveTrip.van.licensePlate})`
                              : ''}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-500">Departure</p>
                          <p className="font-semibold text-slate-900">
                            {formatDateTime(selectedActiveTrip.departureDate)}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-500">Start Odometer</p>
                          <p className="font-semibold text-slate-900">
                            {selectedActiveTrip.startOdometerKm ?? '—'}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-500">Loads in Trip</p>
                          <p className="font-semibold text-slate-900">
                            {selectedActiveTrip.loads?.length ?? 0}
                          </p>
                        </div>
                      </div>

                      {selectedActiveTrip.loads && selectedActiveTrip.loads.length > 0 && (
                        <div className="space-y-1 border-t border-slate-200 pt-2">
                          {selectedActiveTrip.loads.map((load) => (
                            <div
                              key={load.id}
                              className="flex items-center justify-between rounded border border-slate-200 bg-white px-2 py-1"
                            >
                              <span className="text-[11px] font-semibold text-slate-800">
                                {load.referenceNumber}
                              </span>
                              <span className="text-[10px] text-slate-500">{load.status}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          onClick={openCompleteTripModal}
                          className="inline-flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Complete Trip
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleCancelTrip()}
                          className="inline-flex items-center gap-1 rounded border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                        >
                          <Ban className="h-3.5 w-3.5" />
                          Cancel Trip
                        </button>
                      </div>
                    </div>
                  )}
                </article>

                <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <h3 className="text-sm font-semibold text-slate-900">Trip History</h3>

                  {isLoadingDriverTrips && (
                    <p className="mt-2 text-xs text-slate-500">Loading trip history...</p>
                  )}

                  {!isLoadingDriverTrips && selectedDriverTripHistory.length === 0 && (
                    <p className="mt-2 text-xs text-slate-500">No completed or canceled trips yet.</p>
                  )}

                  <div className="mt-2 space-y-2">
                    {selectedDriverTripHistory.map((trip) => {
                      const kmDriven =
                        trip.startOdometerKm !== null && trip.endOdometerKm !== null
                          ? trip.endOdometerKm - trip.startOdometerKm
                          : null;

                      return (
                        <article
                          key={trip.id}
                          className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-semibold text-slate-900">
                              {trip.van?.name ?? 'Van'}
                              {trip.van?.licensePlate ? ` (${trip.van.licensePlate})` : ''}
                            </p>
                            <span className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                              {trip.status}
                            </span>
                          </div>
                          <p className="mt-1 text-slate-600">
                            {formatDateTime(trip.departureDate)} → {formatDateTime(trip.returnDate)}
                          </p>
                          <p className="text-slate-600">
                            {kmDriven !== null ? `${kmDriven} km` : 'KM not available'} · {trip.loads?.length ?? 0} load(s)
                          </p>
                        </article>
                      );
                    })}
                  </div>
                </article>
              </>
            )}
          </section>
        </div>
      </div>

      {driverModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4 py-6"
          onClick={closeDriverModal}
        >
          <section
            className="w-full max-w-3xl rounded-xl border border-slate-200 bg-white p-4 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">
                {editingDriver ? 'Edit Driver' : 'Add Driver'}
              </h2>
              <button
                type="button"
                onClick={closeDriverModal}
                className="rounded border border-slate-300 bg-white p-1 text-slate-600 hover:bg-slate-50"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs text-slate-600">
                First Name
                <input
                  type="text"
                  value={driverForm.firstName}
                  onChange={(event) =>
                    setDriverForm((prev) => ({ ...prev, firstName: event.target.value }))
                  }
                  className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                />
              </label>

              <label className="text-xs text-slate-600">
                Last Name
                <input
                  type="text"
                  value={driverForm.lastName}
                  onChange={(event) =>
                    setDriverForm((prev) => ({ ...prev, lastName: event.target.value }))
                  }
                  className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                />
              </label>

              <label className="text-xs text-slate-600">
                Status
                <select
                  value={driverForm.status}
                  onChange={(event) =>
                    setDriverForm((prev) => ({
                      ...prev,
                      status: event.target.value as DriverStatus,
                    }))
                  }
                  className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                >
                  {DRIVER_STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-xs text-slate-600">
                Active
                <select
                  value={driverForm.isActive ? 'true' : 'false'}
                  onChange={(event) =>
                    setDriverForm((prev) => ({
                      ...prev,
                      isActive: event.target.value === 'true',
                    }))
                  }
                  className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                >
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </label>

              <label className="text-xs text-slate-600">
                Phone
                <input
                  type="text"
                  value={driverForm.phone}
                  onChange={(event) =>
                    setDriverForm((prev) => ({ ...prev, phone: event.target.value }))
                  }
                  className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                />
              </label>

              <label className="text-xs text-slate-600">
                Email
                <input
                  type="email"
                  value={driverForm.email}
                  onChange={(event) =>
                    setDriverForm((prev) => ({ ...prev, email: event.target.value }))
                  }
                  className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                />
              </label>

              <label className="text-xs text-slate-600">
                License Number
                <input
                  type="text"
                  value={driverForm.driverLicenseNumber}
                  onChange={(event) =>
                    setDriverForm((prev) => ({
                      ...prev,
                      driverLicenseNumber: event.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                />
              </label>

              <label className="text-xs text-slate-600">
                License Valid Until
                <input
                  type="date"
                  value={driverForm.driverLicenseValidUntil}
                  onChange={(event) =>
                    setDriverForm((prev) => ({
                      ...prev,
                      driverLicenseValidUntil: event.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                />
              </label>

              <label className="text-xs text-slate-600 sm:col-span-2">
                License Categories (comma-separated)
                <input
                  type="text"
                  value={driverForm.driverLicenseCategories}
                  onChange={(event) =>
                    setDriverForm((prev) => ({
                      ...prev,
                      driverLicenseCategories: event.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                  placeholder="B, C, CE"
                />
              </label>

              <label className="text-xs text-slate-600">
                Nationality
                <input
                  type="text"
                  value={driverForm.nationality}
                  onChange={(event) =>
                    setDriverForm((prev) => ({ ...prev, nationality: event.target.value }))
                  }
                  className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                />
              </label>

              <label className="text-xs text-slate-600">
                Date of Birth
                <input
                  type="date"
                  value={driverForm.dateOfBirth}
                  onChange={(event) =>
                    setDriverForm((prev) => ({ ...prev, dateOfBirth: event.target.value }))
                  }
                  className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                />
              </label>

              <label className="text-xs text-slate-600">
                Hired At
                <input
                  type="date"
                  value={driverForm.hiredAt}
                  onChange={(event) =>
                    setDriverForm((prev) => ({ ...prev, hiredAt: event.target.value }))
                  }
                  className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                />
              </label>

              <label className="text-xs text-slate-600">
                ADR Certified
                <select
                  value={driverForm.adrCertified ? 'true' : 'false'}
                  onChange={(event) =>
                    setDriverForm((prev) => ({
                      ...prev,
                      adrCertified: event.target.value === 'true',
                      ...(event.target.value === 'false' ? { adrValidUntil: '' } : {}),
                    }))
                  }
                  className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                >
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </select>
              </label>

              {driverForm.adrCertified && (
                <label className="text-xs text-slate-600 sm:col-span-2">
                  ADR Valid Until
                  <input
                    type="date"
                    value={driverForm.adrValidUntil}
                    onChange={(event) =>
                      setDriverForm((prev) => ({
                        ...prev,
                        adrValidUntil: event.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                  />
                </label>
              )}

              <label className="text-xs text-slate-600 sm:col-span-2">
                Notes
                <textarea
                  value={driverForm.notes}
                  onChange={(event) =>
                    setDriverForm((prev) => ({ ...prev, notes: event.target.value }))
                  }
                  className="mt-1 min-h-20 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                />
              </label>
            </div>

            <button
              type="button"
              onClick={() => void handleSaveDriver()}
              disabled={isSubmitting}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              {editingDriver ? 'Save Driver' : 'Create Driver'}
            </button>
          </section>
        </div>
      )}

      {startTripModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4 py-6"
          onClick={closeStartTripModal}
        >
          <section
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-4 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Start New Trip</h2>
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
              <label className="block text-xs text-slate-600">
                Vehicle
                <select
                  value={startTripVanId}
                  onChange={(event) => {
                    const van = availableVansForTrip.find((row) => row.id === event.target.value);
                    setStartTripVanId(event.target.value);
                    setStartTripOdometer(van?.odometerKm ? String(van.odometerKm) : '');
                  }}
                  className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                >
                  <option value="">Select vehicle</option>
                  {availableVansForTrip.map((van) => (
                    <option key={van.id} value={van.id}>
                      {van.name} ({van.licensePlate})
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-xs text-slate-600">
                Departure
                <input
                  type="datetime-local"
                  value={startTripDeparture}
                  onChange={(event) => setStartTripDeparture(event.target.value)}
                  className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                />
              </label>

              <label className="block text-xs text-slate-600">
                Start Odometer (km)
                <input
                  type="number"
                  min={0}
                  value={startTripOdometer}
                  onChange={(event) => setStartTripOdometer(event.target.value)}
                  className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                />
              </label>

              <label className="block text-xs text-slate-600">
                Notes
                <textarea
                  value={startTripNotes}
                  onChange={(event) => setStartTripNotes(event.target.value)}
                  className="mt-1 min-h-20 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                />
              </label>

              <button
                type="button"
                onClick={() => void handleStartTrip()}
                disabled={isSubmitting}
                className="inline-flex w-full items-center justify-center gap-2 rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Play className="h-4 w-4" />
                Start Trip
              </button>
            </div>
          </section>
        </div>
      )}

      {completeTripModalOpen && selectedActiveTrip && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4 py-6"
          onClick={closeCompleteTripModal}
        >
          <section
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-4 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Complete Trip</h2>
              <button
                type="button"
                onClick={closeCompleteTripModal}
                className="rounded border border-slate-300 bg-white p-1 text-slate-600 hover:bg-slate-50"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <label className="block text-xs text-slate-600">
                Return Date & Time
                <input
                  type="datetime-local"
                  value={completeTripDate}
                  onChange={(event) => setCompleteTripDate(event.target.value)}
                  className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                />
              </label>

              <label className="block text-xs text-slate-600">
                End Odometer (km)
                <input
                  type="number"
                  min={0}
                  value={completeTripOdometer}
                  onChange={(event) => setCompleteTripOdometer(event.target.value)}
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
