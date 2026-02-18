import { useEffect, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import type { PlannerLoad } from '../types/load';

interface PalletDimensionsDraft {
  width: number;
  height: number;
  weightKg?: number;
}

interface PalletDetailsSavePayload {
  pallets: number;
  weight: number;
  palletDimensions: PalletDimensionsDraft[];
}

interface PalletDetailsModalProps {
  isOpen: boolean;
  load: PlannerLoad | null;
  onClose: () => void;
  onSave: (loadId: string, payload: PalletDetailsSavePayload) => void;
}

const createDefaultPalletDimensions = (count: number): PalletDimensionsDraft[] =>
  Array.from({ length: Math.max(0, count) }, () => ({
    width: 120,
    height: 80,
  }));

const normalizePalletWeight = (value: unknown): number | undefined => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }
  return Math.max(0, Number(parsed.toFixed(2)));
};

const distributeWeightAcrossPallets = (
  totalWeight: number,
  pallets: PalletDimensionsDraft[],
): PalletDimensionsDraft[] => {
  const count = pallets.length;
  if (count === 0) {
    return [];
  }

  const safeTotal = Math.max(0, Math.round(totalWeight));
  const baseWeight = Math.floor(safeTotal / count);
  let remainder = safeTotal - baseWeight * count;

  return pallets.map((pallet) => {
    const extra = remainder > 0 ? 1 : 0;
    if (remainder > 0) {
      remainder -= 1;
    }
    return {
      ...pallet,
      weightKg: baseWeight + extra,
    };
  });
};

const sumPalletWeights = (pallets: PalletDimensionsDraft[]): number =>
  Math.max(
    0,
    Math.round(
      pallets.reduce((sum, pallet) => sum + (normalizePalletWeight(pallet.weightKg) ?? 0), 0),
    ),
  );

const normalizePalletDimensions = (
  palletCount: number,
  existing: PlannerLoad['palletDimensions'],
): PalletDimensionsDraft[] => {
  const safeCount = Math.max(0, Math.round(palletCount));
  const normalizedExisting = (existing ?? []).map((pallet) => ({
    width: Math.max(10, Math.min(300, Math.round(pallet.width || 120))),
    height: Math.max(10, Math.min(300, Math.round(pallet.height || 80))),
    ...(normalizePalletWeight(pallet.weightKg) !== undefined
      ? { weightKg: normalizePalletWeight(pallet.weightKg) }
      : {}),
  }));

  if (normalizedExisting.length >= safeCount) {
    return normalizedExisting.slice(0, safeCount);
  }

  return [
    ...normalizedExisting,
    ...createDefaultPalletDimensions(safeCount - normalizedExisting.length),
  ];
};

export function PalletDetailsModal({
  isOpen,
  load,
  onClose,
  onSave,
}: PalletDetailsModalProps) {
  const [draftWeight, setDraftWeight] = useState(0);
  const [draftDimensions, setDraftDimensions] = useState<PalletDimensionsDraft[]>([]);

  useEffect(() => {
    if (!isOpen || !load) {
      setDraftWeight(0);
      setDraftDimensions([]);
      return;
    }

    const safePallets = Math.max(0, Math.round(load.pallets));
    const safeWeight = Math.max(0, Math.round(load.weight));
    const normalized = normalizePalletDimensions(safePallets, load.palletDimensions);
    const hasPerPalletWeights = normalized.some(
      (pallet) => normalizePalletWeight(pallet.weightKg) !== undefined,
    );

    setDraftWeight(safeWeight);
    setDraftDimensions(
      hasPerPalletWeights ? normalized : distributeWeightAcrossPallets(safeWeight, normalized),
    );
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

  if (!isOpen || !load) return null;

  const handleWeightChange = (value: number) => {
    const safeWeight = Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
    setDraftWeight(safeWeight);
    setDraftDimensions((prev) => distributeWeightAcrossPallets(safeWeight, prev));
  };

  const handleAddPallet = () => {
    setDraftDimensions((prev) =>
      distributeWeightAcrossPallets(draftWeight, [...prev, ...createDefaultPalletDimensions(1)]),
    );
  };

  const handleRemovePallet = (index: number) => {
    setDraftDimensions((prev) => {
      const next = prev.filter((_, palletIndex) => palletIndex !== index);
      const redistributed = distributeWeightAcrossPallets(draftWeight, next);
      setDraftWeight(redistributed.length > 0 ? sumPalletWeights(redistributed) : 0);
      return redistributed;
    });
  };

  const handleDimensionChange = (
    index: number,
    field: 'width' | 'height',
    value: number,
  ) => {
    const safeValue = Number.isFinite(value) ? Math.max(10, Math.min(300, Math.round(value))) : 10;
    setDraftDimensions((prev) =>
      prev.map((pallet, palletIndex) =>
        palletIndex === index ? { ...pallet, [field]: safeValue } : pallet,
      ),
    );
  };

  const handlePalletWeightChange = (index: number, value: string) => {
    setDraftDimensions((prev) => {
      const normalizedWeight =
        value.trim() === '' ? undefined : normalizePalletWeight(Number(value));
      const next = prev.map((pallet, palletIndex) =>
        palletIndex === index
          ? {
              ...pallet,
              ...(normalizedWeight !== undefined ? { weightKg: normalizedWeight } : { weightKg: undefined }),
            }
          : pallet,
      );
      setDraftWeight(sumPalletWeights(next));
      return next;
    });
  };

  const handleSave = () => {
    const palletCount = draftDimensions.length;
    const safeWeight =
      palletCount > 0 ? Math.max(0, Math.round(draftWeight)) : 0;
    onSave(load.id, {
      pallets: palletCount,
      weight: safeWeight,
      palletDimensions: normalizePalletDimensions(palletCount, draftDimensions),
    });
  };

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-xl border border-gray-200 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Pallet Details</h3>
            <p className="text-xs text-gray-500">{load.brokerage}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-gray-300 p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="max-h-[72vh] overflow-y-auto p-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="text-xs text-gray-600">
              Total Pallets
              <div className="mt-1 rounded border border-gray-300 bg-gray-50 px-2 py-1.5 text-sm font-semibold text-gray-900">
                {draftDimensions.length}
              </div>
            </div>
            <label className="text-xs text-gray-600">
              Total Weight (kg)
              <input
                type="number"
                min={0}
                step={1}
                value={draftWeight}
                onChange={(event) => handleWeightChange(Number(event.target.value))}
                className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
              />
            </label>
          </div>

          <section className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                Individual Pallets
              </h4>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">{draftDimensions.length} total</span>
                <button
                  type="button"
                  onClick={handleAddPallet}
                  className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-2 py-1 text-[11px] font-semibold text-gray-700 hover:bg-gray-100"
                >
                  <Plus className="h-3 w-3" />
                  Add Pallet
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {draftDimensions.length === 0 && (
                <p className="rounded border border-dashed border-gray-300 bg-white px-2 py-2 text-xs text-gray-500">
                  No pallets configured.
                </p>
              )}

              {draftDimensions.map((pallet, index) => (
                <div
                  key={`pallet-dimension-${index}`}
                  className="grid grid-cols-[auto_1fr_1fr_1fr_auto] items-center gap-2 rounded border border-gray-200 bg-white px-2 py-1.5"
                >
                  <span className="text-xs font-semibold text-gray-700">#{index + 1}</span>
                  <label className="text-[11px] text-gray-600">
                    Width (cm)
                    <input
                      type="number"
                      min={10}
                      max={300}
                      step={1}
                      value={pallet.width}
                      onChange={(event) =>
                        handleDimensionChange(index, 'width', Number(event.target.value))
                      }
                      className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900"
                    />
                  </label>
                  <label className="text-[11px] text-gray-600">
                    Length (cm)
                    <input
                      type="number"
                      min={10}
                      max={300}
                      step={1}
                      value={pallet.height}
                      onChange={(event) =>
                        handleDimensionChange(index, 'height', Number(event.target.value))
                      }
                      className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900"
                    />
                  </label>
                  <label className="text-[11px] text-gray-600">
                    KG
                    <input
                      type="number"
                      min={0}
                      step={0.1}
                      value={pallet.weightKg ?? ''}
                      onChange={(event) => handlePalletWeightChange(index, event.target.value)}
                      className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900"
                      placeholder="optional"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => handleRemovePallet(index)}
                    className="rounded border border-red-200 bg-red-50 p-1 text-red-600 hover:bg-red-100 hover:text-red-700"
                    title="Remove pallet"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-gray-200 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
          >
            Save
          </button>
        </footer>
      </div>
    </div>
  );
}
