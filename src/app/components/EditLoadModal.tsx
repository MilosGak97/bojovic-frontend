import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import type { PlannerLoad } from '../types/load';

type PlannerStatus = PlannerLoad['status'];

interface LoadExtraStop {
  address: string;
  pallets: number;
  action: 'pickup' | 'dropoff';
}

interface EditLoadModalProps {
  isOpen: boolean;
  load: PlannerLoad | null;
  onClose: () => void;
  onSave: (load: PlannerLoad) => void;
  onSetInactive: (loadId: string) => void;
}

const STATUS_OPTIONS: PlannerStatus[] = [
  'ON BOARD',
  'NEGOTIATING',
  'TAKEN',
  'NOT INTERESTED',
  'CANCELED',
];

const createDefaultPalletDimensions = (
  count: number,
): Array<{ width: number; height: number; weightKg?: number }> =>
  Array.from({ length: Math.max(0, count) }, () => ({
    width: 120,
    height: 80,
  }));

const normalizePalletDimensions = (
  load: PlannerLoad,
): Array<{ width: number; height: number; weightKg?: number }> => {
  const palletCount = Math.max(0, Math.round(load.pallets));
  const existing = (load.palletDimensions ?? []).map((pallet) => ({
    width: Math.max(10, Math.round(pallet.width || 120)),
    height: Math.max(10, Math.round(pallet.height || 80)),
    ...(typeof pallet.weightKg === 'number' && Number.isFinite(pallet.weightKg)
      ? { weightKg: Math.max(0, Number(pallet.weightKg.toFixed(2))) }
      : {}),
  }));

  if (existing.length >= palletCount) {
    return existing.slice(0, palletCount);
  }

  return [...existing, ...createDefaultPalletDimensions(palletCount - existing.length)];
};

const normalizeExtraStops = (load: PlannerLoad): LoadExtraStop[] =>
  (load.extraStops ?? []).map((extraStop) => {
    if (typeof extraStop === 'string') {
      return {
        address: extraStop,
        pallets: 1,
        action: 'dropoff',
      };
    }

    return {
      address: extraStop.address ?? '',
      pallets: Math.max(0, Math.round(extraStop.pallets ?? 0)),
      action: extraStop.action === 'pickup' ? 'pickup' : 'dropoff',
    };
  });

export function EditLoadModal({
  isOpen,
  load,
  onClose,
  onSave,
  onSetInactive,
}: EditLoadModalProps) {
  const [draft, setDraft] = useState<PlannerLoad | null>(null);

  useEffect(() => {
    if (!isOpen || !load) {
      setDraft(null);
      return;
    }

    setDraft({
      ...load,
      palletDimensions: normalizePalletDimensions(load),
      extraStops: normalizeExtraStops(load),
    });
  }, [isOpen, load]);

  useEffect(() => {
    if (!isOpen) return;

    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  const pricePerKm = useMemo(() => {
    if (!draft || draft.distance <= 0) return 0;
    return draft.price / draft.distance;
  }, [draft]);

  if (!isOpen || !draft) return null;

  const updateField = <K extends keyof PlannerLoad>(field: K, value: PlannerLoad[K]) => {
    setDraft((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const updatePalletCount = (nextValue: number) => {
    const safeCount = Number.isFinite(nextValue) ? Math.max(0, Math.round(nextValue)) : 0;
    setDraft((prev) => {
      if (!prev) return prev;
      const nextLoad = { ...prev, pallets: safeCount };
      return {
        ...nextLoad,
        palletDimensions: normalizePalletDimensions(nextLoad),
      };
    });
  };

  const updatePalletDimension = (
    index: number,
    field: 'width' | 'height',
    value: number,
  ) => {
    const safeValue = Number.isFinite(value) ? Math.max(10, Math.min(300, Math.round(value))) : 10;
    setDraft((prev) => {
      if (!prev) return prev;
      const nextDimensions = normalizePalletDimensions(prev).map((pallet, palletIndex) =>
        palletIndex === index ? { ...pallet, [field]: safeValue } : pallet,
      );

      return {
        ...prev,
        palletDimensions: nextDimensions,
      };
    });
  };

  const addExtraStop = () => {
    setDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        extraStops: [
          ...normalizeExtraStops(prev),
          {
            address: '',
            pallets: 1,
            action: 'dropoff',
          },
        ],
      };
    });
  };

  const updateExtraStop = (
    stopIndex: number,
    field: 'address' | 'pallets' | 'action',
    value: string | number,
  ) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const nextStops = normalizeExtraStops(prev).map((stop, index) => {
        if (index !== stopIndex) return stop;
        if (field === 'pallets') {
          const numeric = Number.isFinite(Number(value)) ? Math.max(0, Math.round(Number(value))) : 0;
          return { ...stop, pallets: numeric };
        }
        if (field === 'action') {
          return { ...stop, action: value === 'pickup' ? 'pickup' : 'dropoff' };
        }
        return { ...stop, address: String(value) };
      });

      return {
        ...prev,
        extraStops: nextStops,
      };
    });
  };

  const removeExtraStop = (stopIndex: number) => {
    setDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        extraStops: normalizeExtraStops(prev).filter((_, index) => index !== stopIndex),
      };
    });
  };

  const handleSave = () => {
    const normalizedDraft: PlannerLoad = {
      ...draft,
      brokerage: (draft.brokerage ?? '').trim(),
      contactPerson: draft.contactPerson?.trim() ?? '',
      phone: draft.phone?.trim() ?? '',
      email: draft.email?.trim() ?? '',
      originAddress: draft.originAddress?.trim() ?? '',
      destAddress: draft.destAddress?.trim() ?? '',
      originTranseuLink: draft.originTranseuLink?.trim() ?? '',
      destTranseuLink: draft.destTranseuLink?.trim() ?? '',
      paymentTerms: draft.paymentTerms?.trim() ?? '',
      pallets: Math.max(0, Math.round(draft.pallets)),
      weight: Math.max(0, Math.round(draft.weight)),
      ldm: Number.isFinite(draft.ldm) ? Math.max(0, Number(draft.ldm)) : 0,
      distance: Number.isFinite(draft.distance) ? Math.max(0, Number(draft.distance)) : 0,
      price: Number.isFinite(draft.price) ? Math.max(0, Number(draft.price.toFixed(2))) : 0,
      palletDimensions: normalizePalletDimensions(draft),
      extraStops: normalizeExtraStops(draft).filter((stop) => stop.address.trim().length > 0),
    };

    onSave(normalizedDraft);
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl rounded-xl border border-gray-200 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Edit Route</h3>
            <p className="text-xs text-gray-500">
              {draft.referenceCode ?? draft.id}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-gray-300 p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            title="Close editor"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="max-h-[78vh] overflow-y-auto p-5">
          <div className="space-y-4">
            <section className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-600">
                Basic
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs text-gray-600">
                  Brokerage Company
                  <input
                    type="text"
                    value={draft.brokerage}
                    onChange={(event) => updateField('brokerage', event.target.value)}
                    className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-800"
                  />
                </label>
                <label className="text-xs text-gray-600">
                  Broker Name
                  <input
                    type="text"
                    value={draft.contactPerson ?? ''}
                    onChange={(event) => updateField('contactPerson', event.target.value)}
                    className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-800"
                  />
                </label>
                <label className="text-xs text-gray-600">
                  Phone
                  <input
                    type="text"
                    value={draft.phone ?? ''}
                    onChange={(event) => updateField('phone', event.target.value)}
                    className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-800"
                  />
                </label>
                <label className="text-xs text-gray-600">
                  Email
                  <input
                    type="email"
                    value={draft.email ?? ''}
                    onChange={(event) => updateField('email', event.target.value)}
                    className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-800"
                  />
                </label>
                <label className="text-xs text-gray-600">
                  Status
                  <select
                    value={draft.status}
                    onChange={(event) =>
                      updateField('status', event.target.value as PlannerLoad['status'])
                    }
                    className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-800"
                  >
                    {STATUS_OPTIONS.map((statusOption) => (
                      <option key={statusOption} value={statusOption}>
                        {statusOption}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-gray-600">
                  Color
                  <input
                    type="color"
                    value={draft.color}
                    onChange={(event) => updateField('color', event.target.value)}
                    className="mt-1 h-9 w-full rounded border border-gray-300 bg-white px-1 py-1"
                  />
                </label>
              </div>
            </section>

            <section className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-600">
                Pickup And Delivery
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <label className="col-span-2 text-xs text-gray-600">
                  Pickup Address
                  <input
                    type="text"
                    value={draft.originAddress ?? ''}
                    onChange={(event) => updateField('originAddress', event.target.value)}
                    className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-800"
                  />
                </label>
                <label className="text-xs text-gray-600">
                  Pickup Window Start
                  <input
                    type="text"
                    value={draft.pickupWindowStart ?? draft.pickupDate}
                    onChange={(event) => updateField('pickupWindowStart', event.target.value)}
                    className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-800"
                  />
                </label>
                <label className="text-xs text-gray-600">
                  Pickup Window End
                  <input
                    type="text"
                    value={draft.pickupWindowEnd ?? ''}
                    onChange={(event) => updateField('pickupWindowEnd', event.target.value)}
                    className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-800"
                  />
                </label>
                <label className="col-span-2 text-xs text-gray-600">
                  Pickup Transeu Link
                  <input
                    type="text"
                    value={draft.originTranseuLink ?? ''}
                    onChange={(event) => updateField('originTranseuLink', event.target.value)}
                    className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-800"
                  />
                </label>

                <label className="col-span-2 mt-1 text-xs text-gray-600">
                  Delivery Address
                  <input
                    type="text"
                    value={draft.destAddress ?? ''}
                    onChange={(event) => updateField('destAddress', event.target.value)}
                    className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-800"
                  />
                </label>
                <label className="text-xs text-gray-600">
                  Delivery Window Start
                  <input
                    type="text"
                    value={draft.deliveryWindowStart ?? draft.deliveryDate}
                    onChange={(event) => updateField('deliveryWindowStart', event.target.value)}
                    className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-800"
                  />
                </label>
                <label className="text-xs text-gray-600">
                  Delivery Window End
                  <input
                    type="text"
                    value={draft.deliveryWindowEnd ?? ''}
                    onChange={(event) => updateField('deliveryWindowEnd', event.target.value)}
                    className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-800"
                  />
                </label>
                <label className="col-span-2 text-xs text-gray-600">
                  Delivery Transeu Link
                  <input
                    type="text"
                    value={draft.destTranseuLink ?? ''}
                    onChange={(event) => updateField('destTranseuLink', event.target.value)}
                    className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-800"
                  />
                </label>
              </div>
            </section>

            <section className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-600">
                Cargo And Price
              </h4>
              <div className="grid grid-cols-3 gap-3">
                <label className="text-xs text-gray-600">
                  Pallets
                  <input
                    type="number"
                    min={0}
                    value={draft.pallets}
                    onChange={(event) => updatePalletCount(Number(event.target.value))}
                    className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-800"
                  />
                </label>
                <label className="text-xs text-gray-600">
                  Weight (kg)
                  <input
                    type="number"
                    min={0}
                    value={draft.weight}
                    onChange={(event) => updateField('weight', Number(event.target.value))}
                    className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-800"
                  />
                </label>
                <label className="text-xs text-gray-600">
                  LDM
                  <input
                    type="number"
                    min={0}
                    step="0.1"
                    value={draft.ldm}
                    onChange={(event) => updateField('ldm', Number(event.target.value))}
                    className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-800"
                  />
                </label>
                <label className="text-xs text-gray-600">
                  Distance (km)
                  <input
                    type="number"
                    min={0}
                    value={draft.distance}
                    onChange={(event) => updateField('distance', Number(event.target.value))}
                    className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-800"
                  />
                </label>
                <label className="text-xs text-gray-600">
                  Price
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={draft.price}
                    onChange={(event) => updateField('price', Number(event.target.value))}
                    className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-800"
                  />
                </label>
                <label className="text-xs text-gray-600">
                  Payment Terms (days)
                  <input
                    type="text"
                    value={draft.paymentTerms ?? ''}
                    onChange={(event) => updateField('paymentTerms', event.target.value)}
                    className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-800"
                  />
                </label>
              </div>

              <div className="mt-2 rounded border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700">
                {draft.distance} km • {pricePerKm.toFixed(2)}€/km • {draft.price}€
              </div>

              {normalizePalletDimensions(draft).length > 0 && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                    Individual Pallets
                  </p>
                  <div className="space-y-1.5">
                    {normalizePalletDimensions(draft).map((pallet, index) => (
                      <div
                        key={`modal-pallet-${index}`}
                        className="grid grid-cols-[50px_1fr_1fr] items-center gap-2 rounded border border-gray-200 bg-white px-2 py-1.5"
                      >
                        <span className="text-xs font-medium text-gray-600">P{index + 1}</span>
                        <input
                          type="number"
                          min={10}
                          max={300}
                          value={pallet.width}
                          onChange={(event) =>
                            updatePalletDimension(index, 'width', Number(event.target.value))
                          }
                          className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-800"
                        />
                        <input
                          type="number"
                          min={10}
                          max={300}
                          value={pallet.height}
                          onChange={(event) =>
                            updatePalletDimension(index, 'height', Number(event.target.value))
                          }
                          className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-800"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            <section className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Extra Stops
                </h4>
                <button
                  type="button"
                  onClick={addExtraStop}
                  className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-2 py-1 text-[11px] font-semibold text-gray-700 hover:bg-gray-100"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Stop
                </button>
              </div>

              {normalizeExtraStops(draft).length === 0 && (
                <p className="rounded border border-dashed border-gray-300 bg-white px-2 py-2 text-xs text-gray-500">
                  No extra stops.
                </p>
              )}

              <div className="space-y-2">
                {normalizeExtraStops(draft).map((stop, stopIndex) => (
                  <div
                    key={`modal-extra-stop-${stopIndex}`}
                    className="rounded border border-gray-200 bg-white p-2"
                  >
                    <div className="grid grid-cols-[1fr_90px_34px] items-center gap-2">
                      <select
                        value={stop.action}
                        onChange={(event) =>
                          updateExtraStop(stopIndex, 'action', event.target.value)
                        }
                        className="rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-800"
                      >
                        <option value="dropoff">Dropoff</option>
                        <option value="pickup">Pickup</option>
                      </select>
                      <input
                        type="number"
                        min={0}
                        value={stop.pallets}
                        onChange={(event) =>
                          updateExtraStop(stopIndex, 'pallets', Number(event.target.value))
                        }
                        className="rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-800"
                      />
                      <button
                        type="button"
                        onClick={() => removeExtraStop(stopIndex)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded border border-red-300 bg-red-50 text-red-600 hover:bg-red-100"
                        title="Remove stop"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <input
                      type="text"
                      value={stop.address}
                      onChange={(event) => updateExtraStop(stopIndex, 'address', event.target.value)}
                      placeholder={`Extra stop ${stopIndex + 1} address`}
                      className="mt-2 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-800"
                    />
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>

        <footer className="flex items-center justify-between border-t border-gray-200 px-5 py-4">
          <button
            type="button"
            onClick={() => onSetInactive(draft.id)}
            className="rounded border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
          >
            Mark Inactive
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="rounded border border-blue-700 bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
            >
              Save Changes
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
