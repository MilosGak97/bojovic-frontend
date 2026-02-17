import { TrendingDown, TrendingUp, Fuel, DollarSign } from 'lucide-react';

interface RouteSummaryProps {
  totalKm: number;
  totalTime: string;
  oldRouteKm: number;
  estimatedFuel: number;
  estimatedMargin: number;
}

export function RouteSummary({
  totalKm,
  totalTime,
  oldRouteKm,
  estimatedFuel,
  estimatedMargin,
}: RouteSummaryProps) {
  const kmDiff = totalKm - oldRouteKm;
  const isImproved = kmDiff < 0;

  return (
    <div className="bg-white border border-gray-200 p-4 space-y-4">
      <h3 className="font-semibold text-sm text-gray-900">Route Summary</h3>

      <div className="space-y-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-gray-600">Total Distance</span>
          <span className="font-semibold text-gray-900">{totalKm} km</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-gray-600">Total Time</span>
          <span className="font-semibold text-gray-900">{totalTime}</span>
        </div>

        <div className="pt-2 border-t border-gray-100">
          <div className="flex items-center justify-between mb-1">
            <span className="text-gray-600 text-xs">Route Comparison</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <div className="text-xs text-gray-500 mb-1">Old: {oldRouteKm} km</div>
              <div className="text-xs text-gray-500">New: {totalKm} km</div>
            </div>
            <div className={`flex items-center gap-1 font-semibold ${
              isImproved ? 'text-green-600' : 'text-red-600'
            }`}>
              {isImproved ? (
                <TrendingDown className="w-4 h-4" />
              ) : (
                <TrendingUp className="w-4 h-4" />
              )}
              <span>{Math.abs(kmDiff)} km</span>
            </div>
          </div>
        </div>

        <div className="pt-2 border-t border-gray-100 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-gray-600">
              <Fuel className="w-4 h-4" />
              <span>Est. Fuel Cost</span>
            </div>
            <span className="font-semibold text-gray-900">€{estimatedFuel}</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-gray-600">
              <DollarSign className="w-4 h-4" />
              <span>Est. Margin</span>
            </div>
            <span className="font-semibold text-green-600">€{estimatedMargin}</span>
          </div>
        </div>
      </div>

      {/* Map preview placeholder */}
      <div className="mt-4 pt-4 border-t border-gray-100">
        <div className="bg-gray-100 h-32 flex items-center justify-center text-xs text-gray-500">
          Route Map Preview
        </div>
      </div>
    </div>
  );
}
