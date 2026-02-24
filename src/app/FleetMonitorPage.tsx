import { useCallback, useEffect, useMemo, useState } from 'react';
import { Play, Plus, Trash2, X } from 'lucide-react';
import { driverApi, tripApi, vanApi } from '../api';
import { ThinModuleMenu } from './components/ThinModuleMenu';
import { CreateTripModal } from './components/CreateTripModal';
import type { CreateTripDto, CreateVanDto } from '../domain/dto';
import type { Driver, Trip, Van } from '../domain/entities';
import { DriverStatus, TripStatus, VanStatus, VanType } from '../domain/enums';

const VEHICLE_TYPE_OPTIONS: Array<{
  value: VanType;
  label: string;
  defaultMaxWeightKg: number;
}> = [
  { value: VanType.VAN_3_5T, label: '3.5t', defaultMaxWeightKg: 3500 },
  { value: VanType.TRUCK_7T, label: '7t', defaultMaxWeightKg: 7000 },
  { value: VanType.CARGO_VAN, label: 'Cargo Van', defaultMaxWeightKg: 1200 },
];

const VEHICLE_TYPE_LABEL: Record<VanType, string> = {
  [VanType.VAN_3_5T]: '3.5t',
  [VanType.TRUCK_7T]: '7t',
  [VanType.CARGO_VAN]: 'Cargo Van',
};

const MOCK_UPCOMING_SERVICE = [
  {
    id: 'svc-1',
    vehicleName: 'Sprinter 01',
    licensePlate: 'B-VD-2301',
    serviceDate: '2026-03-05',
    type: 'Oil + Filter',
    priority: 'High',
  },
  {
    id: 'svc-2',
    vehicleName: 'Truck 7T East',
    licensePlate: 'B-VD-4412',
    serviceDate: '2026-03-09',
    type: 'Brake Inspection',
    priority: 'Medium',
  },
  {
    id: 'svc-3',
    vehicleName: 'Cargo Van City',
    licensePlate: 'B-VD-1198',
    serviceDate: '2026-03-14',
    type: 'Tire Rotation',
    priority: 'Low',
  },
];

const toPositiveInteger = (value: string): number | null => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed);
};

const toDatetimeLocalValue = (date?: string | null): string => {
  const value = date ? new Date(date) : new Date();
  if (Number.isNaN(value.getTime())) return '';
  const offset = value.getTimezoneOffset();
  const localDate = new Date(value.getTime() - offset * 60_000);
  return localDate.toISOString().slice(0, 16);
};

const toIso = (localDatetime: string): string => new Date(localDatetime).toISOString();

export default function FleetMonitorPage() {
  const [vans, setVans] = useState<Van[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [activeTrips, setActiveTrips] = useState<Trip[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isTripModalOpen, setIsTripModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [tripFormError, setTripFormError] = useState<string | null>(null);

  const [tripDriverId, setTripDriverId] = useState('');
  const [tripVanId, setTripVanId] = useState('');
  const [tripLoadboardFrom, setTripLoadboardFrom] = useState(toDatetimeLocalValue());

  const [form, setForm] = useState({
    name: '',
    vehicleId: '',
    licensePlate: '',
    vehicleType: VanType.CARGO_VAN,
    cargoLengthCm: '403',
    cargoWidthCm: '220',
    cargoHeightCm: '220',
  });

  const loadPageData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [vansData, driversData, tripsData] = await Promise.all([
        vanApi.getAll(),
        driverApi.getAll(),
        tripApi.getActive(),
      ]);
      setVans(vansData);
      setDrivers(driversData);
      setActiveTrips(tripsData);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to load vehicles.');
      setVans([]);
      setDrivers([]);
      setActiveTrips([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPageData();
  }, [loadPageData]);

  const selectedType = useMemo(
    () => VEHICLE_TYPE_OPTIONS.find((option) => option.value === form.vehicleType) ?? VEHICLE_TYPE_OPTIONS[2],
    [form.vehicleType],
  );

  const estimatedPallets = useMemo(() => {
    const length = toPositiveInteger(form.cargoLengthCm);
    const width = toPositiveInteger(form.cargoWidthCm);
    if (!length || !width) return 0;
    return Math.floor(length / 120) * Math.floor(width / 80);
  }, [form.cargoLengthCm, form.cargoWidthCm]);

  const activeDriverIds = useMemo(
    () => new Set(activeTrips.map((trip) => trip.driverId)),
    [activeTrips],
  );

  const plannedVanIds = useMemo(
    () =>
      new Set(
        activeTrips
          .filter((trip) => trip.status === TripStatus.PLANNED)
          .map((trip) => trip.vanId),
      ),
    [activeTrips],
  );

  const availableDrivers = useMemo(
    () =>
      drivers.filter(
        (driver) =>
          driver.isActive &&
          driver.status === DriverStatus.AVAILABLE &&
          !activeDriverIds.has(driver.id),
      ),
    [drivers, activeDriverIds],
  );

  const planningVans = useMemo(
    () =>
      vans.filter(
        (van) =>
          [VanStatus.AVAILABLE, VanStatus.ON_ROUTE].includes(van.status) &&
          !plannedVanIds.has(van.id),
      ),
    [vans, plannedVanIds],
  );

  const openTripModal = (preferredVanId?: string) => {
    const preferredVan = preferredVanId
      ? planningVans.find((van) => van.id === preferredVanId) ?? null
      : null;
    const selectedVan = preferredVan ?? planningVans[0] ?? null;
    const selectedDriver = availableDrivers[0] ?? null;

    setTripDriverId(selectedDriver?.id ?? '');
    setTripVanId(selectedVan?.id ?? '');
    setTripLoadboardFrom(toDatetimeLocalValue());
    setTripFormError(null);
    setIsTripModalOpen(true);
  };

  const closeTripModal = () => {
    setIsTripModalOpen(false);
    setTripDriverId('');
    setTripVanId('');
    setTripFormError(null);
  };

  const handleCreateTrip = async () => {
    setTripFormError(null);

    if (!tripDriverId || !tripVanId) {
      setTripFormError('Select both driver and vehicle.');
      return;
    }
    if (!tripLoadboardFrom) {
      setTripFormError('Loadboard from date/time is required.');
      return;
    }
    const isDriverSelectable = availableDrivers.some((driver) => driver.id === tripDriverId);
    if (!isDriverSelectable) {
      setTripFormError('Selected driver is no longer available.');
      return;
    }

    const isVanSelectable = planningVans.some((van) => van.id === tripVanId);
    if (!isVanSelectable) {
      setTripFormError('Selected vehicle is no longer available.');
      return;
    }

    const payload: CreateTripDto = {
      driverId: tripDriverId,
      vanId: tripVanId,
      loadboardFromDate: toIso(tripLoadboardFrom),
      departureDate: toIso(tripLoadboardFrom),
    };

    setIsSubmitting(true);
    try {
      await tripApi.create(payload);
      closeTripModal();
      await loadPageData();
    } catch (requestError) {
      setTripFormError(requestError instanceof Error ? requestError.message : 'Failed to create trip.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateVehicle = async () => {
    setFormError(null);

    const cargoLengthCm = toPositiveInteger(form.cargoLengthCm);
    const cargoWidthCm = toPositiveInteger(form.cargoWidthCm);
    const cargoHeightCm = toPositiveInteger(form.cargoHeightCm);

    if (!form.name.trim()) {
      setFormError('Vehicle name is required.');
      return;
    }
    if (!form.licensePlate.trim()) {
      setFormError('License plate is required.');
      return;
    }
    if (!cargoLengthCm || !cargoWidthCm || !cargoHeightCm) {
      setFormError('Cargo dimensions must be positive numbers.');
      return;
    }

    const payload: CreateVanDto = {
      name: form.name.trim(),
      ...(form.vehicleId.trim() ? { vehicleId: form.vehicleId.trim() } : {}),
      licensePlate: form.licensePlate.trim(),
      status: VanStatus.AVAILABLE,
      vehicleType: form.vehicleType,
      maxWeightKg: selectedType.defaultMaxWeightKg,
      cargoLengthCm,
      cargoWidthCm,
      cargoHeightCm,
      ...(estimatedPallets > 0 ? { maxPallets: estimatedPallets } : {}),
    };

    setIsSubmitting(true);
    try {
      await vanApi.create(payload);
      setForm({
        name: '',
        vehicleId: '',
        licensePlate: '',
        vehicleType: form.vehicleType,
        cargoLengthCm: '403',
        cargoWidthCm: '220',
        cargoHeightCm: '220',
      });
      setIsCreateModalOpen(false);
      await loadPageData();
    } catch (requestError) {
      setFormError(requestError instanceof Error ? requestError.message : 'Failed to create vehicle.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteVehicle = async (id: string) => {
    try {
      await vanApi.delete(id);
      await loadPageData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to delete vehicle.');
    }
  };

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
              <h1 className="mt-1 text-2xl font-semibold text-slate-900">Vehicles</h1>
              <p className="mt-1 text-sm text-slate-600">
                Add vehicles with type and cargo dimensions for future load-planner matching.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => openTripModal()}
                disabled={availableDrivers.length === 0 || planningVans.length === 0}
                className="inline-flex items-center gap-1.5 rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Play className="h-3.5 w-3.5" />
                Create Trip
              </button>

              <button
                type="button"
                onClick={() => {
                  setFormError(null);
                  setIsCreateModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Vehicle
              </button>
            </div>
          </div>
        </header>

        <div className="grid gap-5 xl:grid-cols-2">
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Vehicle ID</th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">License</th>
                    <th className="px-3 py-2">Cargo (cm)</th>
                    <th className="px-3 py-2 text-right">Max Weight</th>
                    <th className="px-3 py-2 text-right">Pallets</th>
                    <th className="px-3 py-2">Driver</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading && (
                    <tr>
                      <td className="px-3 py-5 text-center text-slate-500" colSpan={10}>
                        Loading vehicles...
                      </td>
                    </tr>
                  )}

                  {!isLoading && error && (
                    <tr>
                      <td className="px-3 py-5 text-center text-rose-600" colSpan={10}>
                        {error}
                      </td>
                    </tr>
                  )}

                  {!isLoading && !error && vans.length === 0 && (
                    <tr>
                      <td className="px-3 py-5 text-center text-slate-500" colSpan={10}>
                        No vehicles yet.
                      </td>
                    </tr>
                  )}

                  {!isLoading &&
                    !error &&
                    vans.map((van) => (
                      <tr key={van.id} className="border-t border-slate-100">
                        <td className="px-3 py-2 font-semibold text-slate-900">{van.name}</td>
                        <td className="px-3 py-2 text-slate-700">{van.vehicleId ?? '—'}</td>
                        <td className="px-3 py-2 text-slate-700">
                          {VEHICLE_TYPE_LABEL[van.vehicleType] ?? van.vehicleType}
                        </td>
                        <td className="px-3 py-2 text-slate-700">{van.licensePlate}</td>
                        <td className="px-3 py-2 text-slate-700">
                          {van.cargoLengthCm} × {van.cargoWidthCm} × {van.cargoHeightCm}
                        </td>
                        <td className="px-3 py-2 text-right text-slate-800">{Math.round(van.maxWeightKg)} kg</td>
                        <td className="px-3 py-2 text-right text-slate-700">
                          {van.maxPallets ?? '—'}
                        </td>
                        <td className="px-3 py-2 text-slate-700">
                          {van.assignedDriver
                            ? `${van.assignedDriver.firstName} ${van.assignedDriver.lastName}`
                            : 'Unassigned'}
                        </td>
                        <td className="px-3 py-2 text-slate-700">{van.status}</td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => openTripModal(van.id)}
                              disabled={
                                availableDrivers.length === 0 ||
                                !planningVans.some((row) => row.id === van.id)
                              }
                              className="inline-flex items-center rounded border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                              title="Create trip for this vehicle"
                            >
                              Trip
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDeleteVehicle(van.id)}
                              className="inline-flex items-center rounded border border-rose-200 bg-rose-50 p-1.5 text-rose-600 hover:bg-rose-100"
                              title="Delete vehicle"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Upcoming Service</h2>
              <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                Mock
              </span>
            </div>

            <div className="space-y-2">
              {MOCK_UPCOMING_SERVICE.map((item) => (
                <article
                  key={item.id}
                  className="rounded border border-slate-200 bg-slate-50 px-3 py-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {item.vehicleName}
                      </p>
                      <p className="text-xs text-slate-500">{item.licensePlate}</p>
                    </div>
                    <span
                      className={`rounded px-2 py-0.5 text-[11px] font-semibold ${
                        item.priority === 'High'
                          ? 'bg-rose-100 text-rose-700'
                          : item.priority === 'Medium'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {item.priority}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-slate-600">
                    <span>{item.type}</span>
                    <span>{item.serviceDate}</span>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>

      <CreateTripModal
        isOpen={isTripModalOpen}
        isSubmitting={isSubmitting}
        error={tripFormError}
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
        driverId={tripDriverId}
        vanId={tripVanId}
        loadboardFrom={tripLoadboardFrom}
        onDriverChange={setTripDriverId}
        onVanChange={setTripVanId}
        onLoadboardFromChange={setTripLoadboardFrom}
        onClose={closeTripModal}
        onSubmit={() => void handleCreateTrip()}
      />

      {isCreateModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4 py-6"
          onClick={() => setIsCreateModalOpen(false)}
        >
          <section
            className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-4 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Add Vehicle</h2>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="rounded border border-slate-300 bg-white p-1 text-slate-600 hover:bg-slate-50"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <label className="block text-xs text-slate-600">
                Vehicle Name
                <input
                  type="text"
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                  placeholder="e.g. Sprinter 01"
                />
              </label>

              <label className="block text-xs text-slate-600">
                Vehicle ID (optional)
                <input
                  type="text"
                  value={form.vehicleId}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, vehicleId: event.target.value }))
                  }
                  className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                  placeholder="e.g. V-001"
                />
              </label>

              <label className="block text-xs text-slate-600">
                License Plate
                <input
                  type="text"
                  value={form.licensePlate}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, licensePlate: event.target.value }))
                  }
                  className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                  placeholder="e.g. B-VD-2301"
                />
              </label>

              <label className="block text-xs text-slate-600">
                Type
                <select
                  value={form.vehicleType}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      vehicleType: event.target.value as VanType,
                    }))
                  }
                  className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                >
                  {VEHICLE_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-3 gap-2">
                <label className="text-xs text-slate-600">
                  Length (cm)
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={form.cargoLengthCm}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, cargoLengthCm: event.target.value }))
                    }
                    className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                  />
                </label>
                <label className="text-xs text-slate-600">
                  Width (cm)
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={form.cargoWidthCm}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, cargoWidthCm: event.target.value }))
                    }
                    className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                  />
                </label>
                <label className="text-xs text-slate-600">
                  Height (cm)
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={form.cargoHeightCm}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, cargoHeightCm: event.target.value }))
                    }
                    className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                  />
                </label>
              </div>

              <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                <p>
                  Type payload preset:{' '}
                  <span className="font-semibold text-slate-800">{selectedType.defaultMaxWeightKg} kg</span>
                </p>
                <p>
                  Estimated euro pallets:{' '}
                  <span className="font-semibold text-slate-800">{estimatedPallets}</span>
                </p>
              </div>

              {formError && (
                <p className="rounded border border-rose-200 bg-rose-50 px-2 py-1.5 text-xs text-rose-700">
                  {formError}
                </p>
              )}

              <button
                type="button"
                onClick={() => void handleCreateVehicle()}
                disabled={isSubmitting}
                className="inline-flex w-full items-center justify-center gap-2 rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Plus className="h-4 w-4" />
                Add Vehicle
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
