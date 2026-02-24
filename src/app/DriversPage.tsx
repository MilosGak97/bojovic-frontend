import { useCallback, useEffect, useMemo, useState } from 'react';
import { Ban, CheckCircle2, Pencil, Plus, Play, X } from 'lucide-react';
import { driverApi, tripApi, vanApi } from '../api';
import { ThinModuleMenu } from './components/ThinModuleMenu';
import { CreateTripModal } from './components/CreateTripModal';
import { DateTimePicker } from './components/DateTimePicker';
import type {
  CompleteTripDto,
  CreateDriverDto,
  CreateTripDto,
  StartTripDto,
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
  const [copiedCellKey, setCopiedCellKey] = useState<string | null>(null);
  const [driverSearch, setDriverSearch] = useState('');
  const [driverActiveFilter, setDriverActiveFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [driverAvailabilityFilter, setDriverAvailabilityFilter] = useState<
    'ALL' | 'AVAILABLE' | 'NOT_AVAILABLE'
  >('ALL');

  const [driverModalOpen, setDriverModalOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [driverForm, setDriverForm] = useState<DriverFormState>(DEFAULT_DRIVER_FORM);

  const [startTripModalOpen, setStartTripModalOpen] = useState(false);
  const [startTripDriverId, setStartTripDriverId] = useState('');
  const [startTripVanId, setStartTripVanId] = useState('');
  const [startTripDeparture, setStartTripDeparture] = useState(toDatetimeLocalValue());

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

  const filteredDrivers = useMemo(() => {
    const searchTerm = driverSearch.trim().toLowerCase();

    return drivers.filter((driver) => {
      if (driverActiveFilter === 'ACTIVE' && !driver.isActive) return false;
      if (driverActiveFilter === 'INACTIVE' && driver.isActive) return false;

      if (driverAvailabilityFilter === 'AVAILABLE' && driver.status !== DriverStatus.AVAILABLE) {
        return false;
      }
      if (
        driverAvailabilityFilter === 'NOT_AVAILABLE' &&
        driver.status === DriverStatus.AVAILABLE
      ) {
        return false;
      }

      if (!searchTerm) return true;

      const searchable = [
        driver.firstName,
        driver.lastName,
        driver.email ?? '',
        driver.phone ?? '',
      ]
        .join(' ')
        .toLowerCase();

      return searchable.includes(searchTerm);
    });
  }, [drivers, driverActiveFilter, driverAvailabilityFilter, driverSearch]);

  const plannedVanIds = useMemo(
    () =>
      new Set(
        activeTrips
          .filter((trip) => trip.status === TripStatus.PLANNED)
          .map((trip) => trip.vanId),
      ),
    [activeTrips],
  );

  const selectedActiveTrip = useMemo(() => {
    if (!selectedDriver) return null;
    return activeTripByDriver.get(selectedDriver.id) ?? null;
  }, [activeTripByDriver, selectedDriver]);

  const planningVansForTrip = useMemo(() => {
    return vans.filter(
      (van) =>
        [VanStatus.AVAILABLE, VanStatus.ON_ROUTE].includes(van.status) &&
        !plannedVanIds.has(van.id),
    );
  }, [vans, plannedVanIds]);

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

  const copyText = async (value: string, key: string) => {
    if (!value.trim()) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedCellKey(key);
      window.setTimeout(() => {
        setCopiedCellKey((prev) => (prev === key ? null : prev));
      }, 1200);
    } catch {
      setError('Failed to copy to clipboard.');
    }
  };

  const openStartTripModal = (driverId?: string) => {
    const resolvedDriverId = driverId ?? selectedDriverId ?? '';
    setStartTripDriverId(resolvedDriverId);
    if (resolvedDriverId) {
      setSelectedDriverId(resolvedDriverId);
    }

    const firstVan = planningVansForTrip[0];
    setStartTripVanId(firstVan?.id ?? '');
    setStartTripDeparture(toDatetimeLocalValue());
    setStartTripModalOpen(true);
  };

  const closeStartTripModal = () => {
    setStartTripModalOpen(false);
    setStartTripDriverId('');
    setStartTripVanId('');
  };

  const handleStartTrip = async () => {
    if (!startTripDriverId) {
      setError('Select a driver first.');
      return;
    }

    if (!startTripVanId) {
      setError('Select a vehicle for the trip.');
      return;
    }

    const isVanSelectable = planningVansForTrip.some((van) => van.id === startTripVanId);
    if (!isVanSelectable) {
      setError('Selected vehicle is no longer available.');
      return;
    }

    const selectedDriver = drivers.find((driver) => driver.id === startTripDriverId) ?? null;
    if (!selectedDriver) {
      setError('Selected driver no longer exists.');
      return;
    }
    if (!selectedDriver.isActive || selectedDriver.status !== DriverStatus.AVAILABLE) {
      setError('Selected driver is not available.');
      return;
    }

    if (!startTripDeparture) {
      setError('Loadboard from date and time are required.');
      return;
    }
    setIsSubmitting(true);
    setError(null);

    try {
      const createPayload: CreateTripDto = {
        driverId: startTripDriverId,
        vanId: startTripVanId,
        loadboardFromDate: toIso(startTripDeparture),
        departureDate: toIso(startTripDeparture),
      };

      await tripApi.create(createPayload);

      closeStartTripModal();
      await loadPageData();
      await loadSelectedDriverTrips(selectedDriver.id);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to create trip.');
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

  const handleStartPlannedTrip = async () => {
    if (!selectedActiveTrip || selectedActiveTrip.status !== TripStatus.PLANNED) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const payload: StartTripDto = {
        departureDate: toIso(toDatetimeLocalValue(selectedActiveTrip.loadboardFromDate)),
        ...(selectedActiveTrip.plannedEndDate
          ? { plannedEndDate: selectedActiveTrip.plannedEndDate }
          : {}),
        ...(selectedActiveTrip.startOdometerKm !== null
          ? { startOdometerKm: selectedActiveTrip.startOdometerKm }
          : {}),
      };

      await tripApi.start(selectedActiveTrip.id, payload);
      await loadPageData();
      await loadSelectedDriverTrips(selectedActiveTrip.driverId);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to start trip.');
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

        <section className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-xs text-slate-600 sm:col-span-2">
              Search Drivers
              <input
                type="text"
                value={driverSearch}
                onChange={(event) => setDriverSearch(event.target.value)}
                placeholder="Search by name, email, or phone..."
                className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
              />
            </label>

            <label className="text-xs text-slate-600">
              Active
              <select
                value={driverActiveFilter}
                onChange={(event) =>
                  setDriverActiveFilter(event.target.value as 'ALL' | 'ACTIVE' | 'INACTIVE')
                }
                className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
              >
                <option value="ALL">All</option>
                <option value="ACTIVE">Active only</option>
                <option value="INACTIVE">Inactive only</option>
              </select>
            </label>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold text-slate-600">Availability:</span>
            <button
              type="button"
              onClick={() => setDriverAvailabilityFilter('ALL')}
              className={`rounded border px-2 py-1 font-semibold ${
                driverAvailabilityFilter === 'ALL'
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setDriverAvailabilityFilter('AVAILABLE')}
              className={`rounded border px-2 py-1 font-semibold ${
                driverAvailabilityFilter === 'AVAILABLE'
                  ? 'border-emerald-700 bg-emerald-700 text-white'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              }`}
            >
              Available
            </button>
            <button
              type="button"
              onClick={() => setDriverAvailabilityFilter('NOT_AVAILABLE')}
              className={`rounded border px-2 py-1 font-semibold ${
                driverAvailabilityFilter === 'NOT_AVAILABLE'
                  ? 'border-blue-700 bg-blue-700 text-white'
                  : 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
              }`}
            >
              Not Available
            </button>
            <span className="ml-auto text-slate-500">
              {filteredDrivers.length} result(s)
            </span>
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Phone</th>
                    <th className="px-3 py-2">Email</th>
                    <th className="px-3 py-2">Active Trip</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading && (
                    <tr>
                      <td className="px-3 py-6 text-center text-slate-500" colSpan={6}>
                        Loading drivers...
                      </td>
                    </tr>
                  )}

                  {!isLoading && filteredDrivers.length === 0 && (
                    <tr>
                      <td className="px-3 py-6 text-center text-slate-500" colSpan={6}>
                        No drivers match current filters.
                      </td>
                    </tr>
                  )}

                  {!isLoading &&
                    filteredDrivers.map((driver) => {
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
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                void copyText(`${driver.firstName} ${driver.lastName}`, `name-${driver.id}`);
                              }}
                              className={`font-semibold transition-colors ${
                                copiedCellKey === `name-${driver.id}`
                                  ? 'text-emerald-600'
                                  : 'text-slate-900 hover:text-slate-700'
                              }`}
                              title="Copy name"
                            >
                              {driver.firstName} {driver.lastName}
                            </button>
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
                          <td className="px-3 py-2 text-slate-700">
                            {driver.phone ? (
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void copyText(driver.phone ?? '', `phone-${driver.id}`);
                                }}
                                className={`transition-colors ${
                                  copiedCellKey === `phone-${driver.id}`
                                    ? 'text-emerald-600'
                                    : 'hover:text-slate-900'
                                }`}
                                title="Copy phone"
                              >
                                {driver.phone}
                              </button>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="px-3 py-2 text-slate-700">
                            {driver.email ? (
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void copyText(driver.email ?? '', `email-${driver.id}`);
                                }}
                                className={`transition-colors ${
                                  copiedCellKey === `email-${driver.id}`
                                    ? 'text-emerald-600'
                                    : 'hover:text-slate-900'
                                }`}
                                title="Copy email"
                              >
                                {driver.email}
                              </button>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="px-3 py-2 text-slate-700">
                            {activeTrip ? (
                              <div>
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    void copyText(
                                      `${activeTrip.van?.name ?? 'Van'} ${activeTrip.van?.licensePlate ?? ''}`.trim(),
                                      `trip-van-${driver.id}`,
                                    );
                                  }}
                                  className={`font-medium transition-colors ${
                                    copiedCellKey === `trip-van-${driver.id}`
                                      ? 'text-emerald-600'
                                      : 'text-slate-900 hover:text-slate-700'
                                  }`}
                                  title="Copy trip vehicle"
                                >
                                  {activeTrip.van?.name ?? 'Van'}
                                </button>
                                <p className="text-[11px] text-slate-500">
                                  since {formatDateTime(activeTrip.departureDate ?? activeTrip.loadboardFromDate)}
                                </p>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openStartTripModal(driver.id);
                                }}
                                disabled={!driver.isActive || driver.status !== DriverStatus.AVAILABLE || planningVansForTrip.length === 0}
                                className="rounded border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                No Active Trip
                              </button>
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
                        disabled={
                          planningVansForTrip.length === 0 ||
                          !selectedDriver.isActive ||
                          selectedDriver.status !== DriverStatus.AVAILABLE
                        }
                        className="inline-flex items-center gap-1 rounded border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Play className="h-3.5 w-3.5" />
                        Create Trip
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
                          <p className="text-slate-500">
                            {selectedActiveTrip.status === TripStatus.PLANNED
                              ? 'Loadboard From'
                              : 'Departure'}
                          </p>
                          <p className="font-semibold text-slate-900">
                            {formatDateTime(
                              selectedActiveTrip.departureDate ?? selectedActiveTrip.loadboardFromDate,
                            )}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-500">Start Odometer</p>
                          <p className="font-semibold text-slate-900">
                            {selectedActiveTrip.startOdometerKm ?? '—'}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-500">Planned End</p>
                          <p className="font-semibold text-slate-900">
                            {formatDateTime(selectedActiveTrip.plannedEndDate)}
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
                        {selectedActiveTrip.status === TripStatus.PLANNED && (
                          <button
                            type="button"
                            onClick={() => void handleStartPlannedTrip()}
                            className="inline-flex items-center gap-1 rounded border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                          >
                            <Play className="h-3.5 w-3.5" />
                            Start Trip
                          </button>
                        )}
                        {selectedActiveTrip.status === TripStatus.IN_PROGRESS && (
                          <button
                            type="button"
                            onClick={openCompleteTripModal}
                            className="inline-flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Complete Trip
                          </button>
                        )}
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
                            {formatDateTime(trip.departureDate ?? trip.loadboardFromDate)} →{' '}
                            {formatDateTime(trip.returnDate)}
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
                <DateTimePicker
                  mode="date"
                  value={driverForm.driverLicenseValidUntil}
                  onChange={(value) =>
                    setDriverForm((prev) => ({
                      ...prev,
                      driverLicenseValidUntil: value,
                    }))
                  }
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
                <DateTimePicker
                  mode="date"
                  value={driverForm.dateOfBirth}
                  onChange={(value) =>
                    setDriverForm((prev) => ({ ...prev, dateOfBirth: value }))
                  }
                />
              </label>

              <label className="text-xs text-slate-600">
                Hired At
                <DateTimePicker
                  mode="date"
                  value={driverForm.hiredAt}
                  onChange={(value) =>
                    setDriverForm((prev) => ({ ...prev, hiredAt: value }))
                  }
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
                  <DateTimePicker
                    mode="date"
                    value={driverForm.adrValidUntil}
                    onChange={(value) =>
                      setDriverForm((prev) => ({
                        ...prev,
                        adrValidUntil: value,
                      }))
                    }
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

      <CreateTripModal
        isOpen={startTripModalOpen}
        isSubmitting={isSubmitting}
        error={error}
        driverOptions={drivers
          .filter(
            (driver) =>
              driver.isActive &&
              driver.status === DriverStatus.AVAILABLE &&
              !activeTripByDriver.has(driver.id),
          )
          .map((driver) => ({
            id: driver.id,
            name: `${driver.firstName} ${driver.lastName}`,
            email: driver.email,
            phone: driver.phone,
          }))}
        vanOptions={planningVansForTrip.map((van) => ({
          id: van.id,
          name: van.name,
          licensePlate: van.licensePlate,
          status: van.status,
          vehicleId: van.vehicleId,
          driverName: van.assignedDriver
            ? `${van.assignedDriver.firstName} ${van.assignedDriver.lastName}`
            : null,
        }))}
        driverId={startTripDriverId}
        vanId={startTripVanId}
        loadboardFrom={startTripDeparture}
        onDriverChange={setStartTripDriverId}
        onVanChange={setStartTripVanId}
        onLoadboardFromChange={setStartTripDeparture}
        onClose={closeStartTripModal}
        onSubmit={() => void handleStartTrip()}
      />

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
                <DateTimePicker
                  mode="datetime"
                  value={completeTripDate}
                  onChange={setCompleteTripDate}
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
