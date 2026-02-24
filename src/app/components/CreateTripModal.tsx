import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Search, X } from 'lucide-react';
import { DateTimePicker } from './DateTimePicker';

export interface CreateTripDriverOption {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
}

export interface CreateTripVanOption {
  id: string;
  name: string;
  licensePlate: string;
  status: string;
  vehicleId?: string | null;
  driverName?: string | null;
}

interface CreateTripModalProps {
  isOpen: boolean;
  isSubmitting: boolean;
  error?: string | null;
  driverOptions: CreateTripDriverOption[];
  vanOptions: CreateTripVanOption[];
  driverId: string;
  vanId: string;
  loadboardFrom: string;
  onDriverChange: (driverId: string) => void;
  onVanChange: (vanId: string) => void;
  onLoadboardFromChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}

export function CreateTripModal({
  isOpen,
  isSubmitting,
  error,
  driverOptions,
  vanOptions,
  driverId,
  vanId,
  loadboardFrom,
  onDriverChange,
  onVanChange,
  onLoadboardFromChange,
  onClose,
  onSubmit,
}: CreateTripModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [driverSearch, setDriverSearch] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setStep(1);
    setVehicleSearch('');
    setDriverSearch('');
  }, [isOpen]);

  const filteredVans = useMemo(() => {
    const term = vehicleSearch.trim().toLowerCase();
    if (!term) return vanOptions;
    return vanOptions.filter((van) =>
      `${van.name} ${van.licensePlate} ${van.vehicleId ?? ''} ${van.driverName ?? ''}`
        .toLowerCase()
        .includes(term),
    );
  }, [vehicleSearch, vanOptions]);

  const selectedVan = useMemo(
    () => vanOptions.find((van) => van.id === vanId) ?? null,
    [vanOptions, vanId],
  );

  const selectedDriver = useMemo(
    () => driverOptions.find((driver) => driver.id === driverId) ?? null,
    [driverOptions, driverId],
  );

  const filteredDrivers = useMemo(() => {
    const term = driverSearch.trim().toLowerCase();
    if (!term) return driverOptions;
    return driverOptions.filter((driver) =>
      `${driver.name} ${driver.email ?? ''} ${driver.phone ?? ''}`
        .toLowerCase()
        .includes(term),
    );
  }, [driverSearch, driverOptions]);

  if (!isOpen) return null;

  const canContinueFromVehicle = Boolean(vanId);
  const canContinueFromDriver = Boolean(driverId);
  const canSubmit = Boolean(vanId && driverId && loadboardFrom);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4 py-6"
      onClick={onClose}
    >
      <section
        className="w-full max-w-3xl rounded-xl border border-slate-200 bg-white p-4 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Create Trip</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-slate-300 bg-white p-1 text-slate-600 hover:bg-slate-50"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-2">
          {[
            { id: 1, label: 'Vehicle' },
            { id: 2, label: 'Driver' },
            { id: 3, label: 'Loadboard From' },
          ].map((item) => {
            const isActive = step === item.id;
            const isDone = step > item.id;
            return (
              <div
                key={item.id}
                className={`rounded border px-2 py-1 text-xs font-semibold ${
                  isActive
                    ? 'border-blue-300 bg-blue-50 text-blue-700'
                    : isDone
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                      : 'border-slate-200 bg-slate-50 text-slate-500'
                }`}
              >
                {item.id}. {item.label}
              </div>
            );
          })}
        </div>

        {error && (
          <p className="mb-3 rounded border border-rose-200 bg-rose-50 px-2 py-1.5 text-xs text-rose-700">
            {error}
          </p>
        )}

        {step === 1 && (
          <div className="space-y-3">
            <label className="block text-xs text-slate-600">
              Search Vehicle
              <div className="relative mt-1">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={vehicleSearch}
                  onChange={(event) => setVehicleSearch(event.target.value)}
                  className="w-full rounded border border-slate-300 bg-white py-1.5 pl-7 pr-2 text-sm text-slate-900"
                  placeholder="Search by vehicle, plate, ID, or assigned driver"
                />
              </div>
            </label>

            <div className="max-h-72 overflow-auto rounded border border-slate-200">
              <table className="min-w-full border-collapse text-xs">
                <thead className="bg-slate-50 text-left uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-2 py-1.5">Vehicle</th>
                    <th className="px-2 py-1.5">Plate</th>
                    <th className="px-2 py-1.5">Driver</th>
                    <th className="px-2 py-1.5">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVans.length === 0 && (
                    <tr>
                      <td className="px-2 py-4 text-center text-slate-500" colSpan={4}>
                        No matching vehicles.
                      </td>
                    </tr>
                  )}
                  {filteredVans.map((van) => {
                    const isSelected = van.id === vanId;
                    return (
                      <tr
                        key={van.id}
                        className={`cursor-pointer border-t border-slate-100 ${
                          isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'
                        }`}
                        onClick={() => onVanChange(van.id)}
                      >
                        <td className="px-2 py-1.5 font-semibold text-slate-800">
                          {van.name}
                          <p className="font-normal text-slate-500">{van.vehicleId ?? 'No vehicle ID'}</p>
                        </td>
                        <td className="px-2 py-1.5 text-slate-700">{van.licensePlate}</td>
                        <td className="px-2 py-1.5 text-slate-700">{van.driverName ?? 'Unassigned'}</td>
                        <td className="px-2 py-1.5 text-slate-700">{van.status}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-2">
            <p className="text-xs text-slate-600">
              Selected vehicle: <span className="font-semibold text-slate-900">{selectedVan?.name ?? '—'}</span>
            </p>
            <label className="block text-xs text-slate-600">
              Search Driver
              <div className="relative mt-1">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={driverSearch}
                  onChange={(event) => setDriverSearch(event.target.value)}
                  className="w-full rounded border border-slate-300 bg-white py-1.5 pl-7 pr-2 text-sm text-slate-900"
                  placeholder="Search by driver, email, or phone"
                />
              </div>
            </label>
            <div className="max-h-72 overflow-auto rounded border border-slate-200">
              {filteredDrivers.length === 0 ? (
                <p className="px-3 py-4 text-center text-xs text-slate-500">No available drivers.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredDrivers.map((driver) => {
                    const isSelected = driver.id === driverId;
                    return (
                      <button
                        key={driver.id}
                        type="button"
                        onClick={() => onDriverChange(driver.id)}
                        className={`w-full px-3 py-2 text-left text-xs ${
                          isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'
                        }`}
                      >
                        <p className="font-semibold text-slate-900">{driver.name}</p>
                        <p className="text-slate-500">
                          {driver.email || 'No email'} · {driver.phone || 'No phone'}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <p>
                Vehicle: <span className="font-semibold text-slate-900">{selectedVan?.name ?? '—'}</span>
              </p>
              <p>
                Driver: <span className="font-semibold text-slate-900">{selectedDriver?.name ?? '—'}</span>
              </p>
            </div>

            <label className="block text-xs text-slate-600">
              Loadboard From
              <DateTimePicker
                mode="datetime"
                value={loadboardFrom}
                onChange={onLoadboardFromChange}
              />
            </label>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setStep((prev) => (prev > 1 ? ((prev - 1) as 1 | 2 | 3) : prev))}
            disabled={step === 1 || isSubmitting}
            className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Back
          </button>

          {step < 3 && (
            <button
              type="button"
              onClick={() => setStep((prev) => (prev < 3 ? ((prev + 1) as 1 | 2 | 3) : prev))}
              disabled={
                isSubmitting ||
                (step === 1 && !canContinueFromVehicle) ||
                (step === 2 && !canContinueFromDriver)
              }
              className="inline-flex items-center gap-1 rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Continue
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          )}

          {step === 3 && (
            <button
              type="button"
              onClick={onSubmit}
              disabled={isSubmitting || !canSubmit}
              className="inline-flex items-center gap-1 rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Plus className="h-3.5 w-3.5" />
              Save Trip
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
