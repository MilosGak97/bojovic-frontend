import { useEffect, useMemo, useRef, useState } from 'react';
import { Truck, ChevronDown } from 'lucide-react';
import { tripApi } from '../../api';
import type { Trip } from '../../domain/entities';

interface TripSelectorProps {
  selectedTripId: string;
  onTripChange: (tripId: string) => void;
}

const formatDateRange = (from: string, to: string | null): string => {
  const formatShort = (value: string): string => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });
  };

  const start = formatShort(from);
  if (!to) return `${start} –`;
  return `${start} – ${formatShort(to)}`;
};

const getTripLabel = (trip: Trip): string => {
  const driverName = trip.driver
    ? `${trip.driver.firstName} ${trip.driver.lastName}`.trim()
    : 'No driver';
  const vanInfo = trip.van
    ? `${trip.van.name} (${trip.van.licensePlate})`
    : 'No vehicle';
  const dates = formatDateRange(trip.loadboardFromDate, trip.plannedEndDate);
  return `${driverName} — ${vanInfo} — ${dates}`;
};

export function TripSelector({ selectedTripId, onTripChange }: TripSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    const loadTrips = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await tripApi.getActive();
        if (!cancelled) {
          setTrips(response);
        }
      } catch (requestError) {
        if (!cancelled) {
          setTrips([]);
          setError(
            requestError instanceof Error ? requestError.message : 'Failed to load trips.',
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadTrips();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (trips.length === 0) return;
    if (trips.some((trip) => trip.id === selectedTripId)) return;
    onTripChange(trips[0].id);
  }, [trips, selectedTripId, onTripChange]);

  const selectedTrip = useMemo(
    () => trips.find((trip) => trip.id === selectedTripId) ?? null,
    [trips, selectedTripId],
  );

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
        disabled={isLoading || trips.length === 0}
        className="flex w-full items-center justify-between gap-2 rounded border border-gray-300 bg-white px-3 py-1.5 text-sm transition-colors hover:border-blue-500 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <div className="inline-flex min-w-0 items-center gap-2">
          <Truck className="h-4 w-4 flex-shrink-0 text-blue-600" />
          {selectedTrip ? (
            <span className="truncate text-gray-900">{getTripLabel(selectedTrip)}</span>
          ) : isLoading ? (
            <span className="font-medium text-gray-600">Loading trips...</span>
          ) : (
            <span className="font-medium text-gray-600">
              No active trips — create one on the Drivers page
            </span>
          )}
        </div>
        <ChevronDown
          className={`h-4 w-4 flex-shrink-0 text-gray-600 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full border border-gray-300 bg-white shadow-lg">
          {trips.length === 0 && (
            <div className="px-3 py-2 text-xs text-gray-500">
              {error ?? 'No active trips available.'}
            </div>
          )}

          {trips.map((trip) => {
            const driverName = trip.driver
              ? `${trip.driver.firstName} ${trip.driver.lastName}`.trim()
              : 'No driver';
            const vanName = trip.van?.name ?? 'No vehicle';
            const vanPlate = trip.van?.licensePlate ?? '';
            const dates = formatDateRange(trip.loadboardFromDate, trip.plannedEndDate);

            return (
              <button
                key={trip.id}
                onClick={() => {
                  onTripChange(trip.id);
                  setIsOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-3 border-b border-gray-200 px-3 py-2 text-left transition-colors last:border-b-0 hover:bg-blue-50 ${
                  trip.id === selectedTripId ? 'bg-blue-50' : ''
                }`}
              >
                <div className="inline-flex min-w-0 flex-col gap-0.5">
                  <span
                    className={`text-sm font-semibold ${
                      trip.id === selectedTripId ? 'text-blue-600' : 'text-gray-900'
                    }`}
                  >
                    {driverName}
                  </span>
                  <span className="text-xs text-gray-500">
                    {vanName} {vanPlate && `(${vanPlate})`} — {dates}
                  </span>
                </div>
                {trip.id === selectedTripId && (
                  <div className="h-2 w-2 flex-shrink-0 rounded-full bg-blue-600" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
