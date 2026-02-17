import { TrendingDown, TrendingUp, Fuel, DollarSign, Maximize2 } from 'lucide-react';
import type { CanvasRouteSummary } from './CanvasRouteSummaryCard';

interface SidebarRouteSummaryCardProps {
  summary: CanvasRouteSummary;
  onUndock: () => void;
  showComparison?: boolean;
}

export function SidebarRouteSummaryCard({ summary, onUndock, showComparison = false }: SidebarRouteSummaryCardProps) {
  const kmDiff = summary.totalKm - summary.oldRouteKm;
  const isImproved = kmDiff < 0;

  return (
    <div className="bg-white border-t border-gray-300">
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-2 flex items-center justify-between">
        <h3 className="font-semibold text-sm text-gray-900">
          {showComparison ? 'Simulation Comparison' : 'Active Route Summary'}
        </h3>
        <button
          onClick={onUndock}
          className="p-1 hover:bg-gray-200 text-gray-600 hover:text-gray-900 transition-colors"
          title="Move to canvas"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-gray-600">Total Distance</span>
          <span className="font-semibold text-gray-900">{summary.totalKm} km</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-gray-600">Total Time</span>
          <span className="font-semibold text-gray-900">{summary.totalTime}</span>
        </div>

        {showComparison && (
          <div className="pt-2 border-t border-gray-100">
            <div className="flex items-center justify-between mb-1">
              <span className="text-gray-600 text-xs">Route Comparison</span>
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Old Route:</span>
                <span className="text-gray-900">{summary.oldRouteKm} km</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">New Route:</span>
                <span className="text-gray-900">{summary.totalKm} km</span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-gray-100">
                <span className="text-gray-500 font-medium">Delta:</span>
                <span className={`font-semibold flex items-center gap-1 ${
                  isImproved ? 'text-green-600' : 'text-red-600'
                }`}>
                  {isImproved ? (
                    <TrendingDown className="w-3.5 h-3.5" />
                  ) : (
                    <TrendingUp className="w-3.5 h-3.5" />
                  )}
                  {isImproved ? '' : '+'}{Math.abs(kmDiff)} km
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="pt-2 border-t border-gray-100 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-gray-600">
              <Fuel className="w-4 h-4" />
              <span>Est. Fuel Cost</span>
            </div>
            <span className="font-semibold text-gray-900">€{summary.estimatedFuel}</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-gray-600">
              <DollarSign className="w-4 h-4" />
              <span>Est. Margin</span>
            </div>
            <span className="font-semibold text-green-600">€{summary.estimatedMargin}</span>
          </div>
        </div>
      </div>
    </div>
  );
}