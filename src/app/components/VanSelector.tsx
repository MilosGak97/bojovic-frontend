import { useEffect, useMemo, useRef, useState } from 'react';
import { Truck, ChevronDown } from 'lucide-react';
import { vanApi } from '../../api';
import type { Van } from '../../domain/entities';
import { VanType } from '../../domain/enums';

interface VanSelectorProps {
  selectedVanId: string;
  onVanChange: (vanId: string) => void;
}

const getVanTypeLabel = (type: VanType): string => {
  switch (type) {
    case VanType.VAN_3_5T:
      return '3.5t';
    case VanType.TRUCK_7T:
      return '7t';
    case VanType.CARGO_VAN:
      return 'Cargo Van';
    default:
      return type;
  }
};

export function VanSelector({ selectedVanId, onVanChange }: VanSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [vans, setVans] = useState<Van[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    const loadVans = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await vanApi.getAll();
        if (!cancelled) {
          setVans(response);
        }
      } catch (requestError) {
        if (!cancelled) {
          setVans([]);
          setError(
            requestError instanceof Error ? requestError.message : 'Failed to load vehicles.',
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadVans();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (vans.length === 0) return;
    if (vans.some((van) => van.id === selectedVanId)) return;
    onVanChange(vans[0].id);
  }, [vans, selectedVanId, onVanChange]);

  const selectedVan = useMemo(
    () => vans.find((van) => van.id === selectedVanId) ?? null,
    [vans, selectedVanId],
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative w-full sm:min-w-[560px] sm:max-w-[760px]" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        disabled={isLoading || vans.length === 0}
        className="flex w-full items-center justify-between gap-2 rounded border border-gray-300 bg-white px-3 py-1.5 text-sm transition-colors hover:border-blue-500 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <div className="inline-flex min-w-0 items-center gap-2">
          <Truck className="h-4 w-4 flex-shrink-0 text-blue-600" />
          {selectedVan ? (
            <>
              <span className="truncate font-semibold text-gray-900">{selectedVan.name}</span>
              <span className="truncate text-gray-500">{selectedVan.licensePlate}</span>
              <span className="truncate text-gray-500">{getVanTypeLabel(selectedVan.vehicleType)}</span>
            </>
          ) : isLoading ? (
            <span className="font-medium text-gray-600">Loading vehicles...</span>
          ) : (
            <span className="font-medium text-gray-600">No vehicles</span>
          )}
        </div>
        <ChevronDown
          className={`h-4 w-4 flex-shrink-0 text-gray-600 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full border border-gray-300 bg-white shadow-lg">
          {vans.length === 0 && (
            <div className="px-3 py-2 text-xs text-gray-500">
              {error ?? 'No vehicles available.'}
            </div>
          )}

          {vans.map((van) => (
            <button
              key={van.id}
              onClick={() => {
                onVanChange(van.id);
                setIsOpen(false);
              }}
              className={`flex w-full items-center justify-between gap-3 border-b border-gray-200 px-3 py-2 text-left transition-colors last:border-b-0 hover:bg-blue-50 ${
                van.id === selectedVanId ? 'bg-blue-50' : ''
              }`}
            >
              <div className="inline-flex min-w-0 items-center gap-2">
                <Truck
                  className={`h-4 w-4 flex-shrink-0 ${
                    van.id === selectedVanId ? 'text-blue-600' : 'text-gray-400'
                  }`}
                />
                <span
                  className={`text-sm font-semibold ${
                    van.id === selectedVanId ? 'text-blue-600' : 'text-gray-900'
                  }`}
                >
                  {van.name}
                </span>
                <span className="text-xs text-gray-500">{van.licensePlate}</span>
              </div>
              <span className="text-xs text-gray-500">{getVanTypeLabel(van.vehicleType)}</span>
              {van.id === selectedVanId && <div className="h-2 w-2 flex-shrink-0 rounded-full bg-blue-600" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
