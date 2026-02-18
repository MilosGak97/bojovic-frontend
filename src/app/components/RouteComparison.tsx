import { ChevronDown, ChevronUp, TrendingUp, Clock, Fuel, Euro } from 'lucide-react';
import { useState } from 'react';

interface RouteStats {
  totalKm: number;
  totalTime: string;
  estimatedFuel: number;
  fuelCost: number;
  totalRevenue: number;
  pricePerKm: number;
  estimatedMargin: number;
  stopCount: number;
}

interface RouteComparisonProps {
  currentRoute: RouteStats;      // TAKEN loads only
  toggledOnRoute: RouteStats;    // TAKEN + toggled ON loads
  everythingRoute: RouteStats;   // ALL loads (TAKEN + ON + OFF)
  hasToggledLoads: boolean;      // Whether any loads are toggled ON
}

export function RouteComparison({ 
  currentRoute, 
  toggledOnRoute, 
  everythingRoute,
  hasToggledLoads 
}: RouteComparisonProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-6 py-2 flex items-center justify-between hover:bg-gray-50 transition-colors border-b border-gray-200"
      >
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-sm text-gray-900">Route Comparison</h3>
          {hasToggledLoads && (
            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium">
              {toggledOnRoute.stopCount / 2} loads planned
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-gray-500" />
        ) : (
          <ChevronUp className="w-4 h-4 text-gray-500" />
        )}
      </button>

      {/* Expandable Content - Horizontal Layout */}
      {isExpanded && (
        <div className="min-h-0 flex-1 overflow-auto px-6 py-4">
          <div className="grid min-w-[980px] grid-cols-3 gap-4">
            {/* Current Route - TAKEN only */}
            <div className="bg-gray-50 border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                  Current Route
                </h4>
                <span className="text-xs text-gray-500 font-medium">
                  {currentRoute.stopCount} stops
                </span>
              </div>
              
              {/* Main Metrics */}
              <div className="grid grid-cols-2 gap-3 text-xs mb-3 pb-3 border-b border-gray-300">
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-gray-500" />
                  <span className="text-gray-900 font-semibold">{currentRoute.totalKm} km</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-gray-500" />
                  <span className="text-gray-900 font-semibold">{currentRoute.totalTime}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Fuel className="w-3.5 h-3.5 text-gray-500" />
                  <span className="text-gray-900 font-semibold">{currentRoute.estimatedFuel}L</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Euro className="w-3.5 h-3.5 text-gray-500" />
                  <span className="text-gray-900 font-semibold">€{currentRoute.estimatedMargin}</span>
                </div>
              </div>
              
              {/* Bottom horizontal metrics */}
              <div className="flex items-center justify-between text-[11px] text-gray-600 gap-3">
                <div className="flex flex-col">
                  <span className="font-medium text-gray-500">Fuel Cost</span>
                  <span className="text-gray-900 font-semibold">€{currentRoute.fuelCost}</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-medium text-gray-500">Revenue</span>
                  <span className="text-gray-900 font-semibold">€{currentRoute.totalRevenue}</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-medium text-gray-500">€/km</span>
                  <span className="text-gray-900 font-semibold">{currentRoute.pricePerKm.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Planned Route - TAKEN + toggled ON */}
            <div className="bg-blue-50 border-2 border-blue-300 p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-semibold text-blue-700 uppercase tracking-wide">
                  With Toggle ON
                </h4>
                <span className="text-xs text-blue-600 font-medium">
                  {toggledOnRoute.stopCount} stops
                </span>
              </div>
              
              {/* Main Metrics */}
              <div className="grid grid-cols-2 gap-3 text-xs mb-3 pb-3 border-b border-blue-300">
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-blue-500" />
                  <span className="text-blue-900 font-semibold">{toggledOnRoute.totalKm} km</span>
                  <span className="text-blue-600 text-[10px] font-medium">
                    (+{toggledOnRoute.totalKm - currentRoute.totalKm})
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-blue-500" />
                  <span className="text-blue-900 font-semibold">{toggledOnRoute.totalTime}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Fuel className="w-3.5 h-3.5 text-blue-500" />
                  <span className="text-blue-900 font-semibold">{toggledOnRoute.estimatedFuel}L</span>
                  <span className="text-blue-600 text-[10px] font-medium">
                    (+{toggledOnRoute.estimatedFuel - currentRoute.estimatedFuel})
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Euro className="w-3.5 h-3.5 text-blue-500" />
                  <span className="text-blue-900 font-semibold">€{toggledOnRoute.estimatedMargin}</span>
                  <span className="text-green-600 text-[10px] font-semibold">
                    (+€{toggledOnRoute.estimatedMargin - currentRoute.estimatedMargin})
                  </span>
                </div>
              </div>
              
              {/* Bottom horizontal metrics */}
              <div className="flex items-center justify-between text-[11px] text-blue-600 gap-3">
                <div className="flex flex-col">
                  <span className="font-medium text-blue-600">Fuel Cost</span>
                  <span className="text-blue-900 font-semibold">€{toggledOnRoute.fuelCost}</span>
                  <span className="text-blue-600 text-[10px]">(+€{toggledOnRoute.fuelCost - currentRoute.fuelCost})</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-medium text-blue-600">Revenue</span>
                  <span className="text-blue-900 font-semibold">€{toggledOnRoute.totalRevenue}</span>
                  <span className="text-green-600 font-semibold text-[10px]">(+€{toggledOnRoute.totalRevenue - currentRoute.totalRevenue})</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-medium text-blue-600">€/km</span>
                  <span className="text-blue-900 font-semibold">{toggledOnRoute.pricePerKm.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Everything - ALL loads */}
            <div className="bg-purple-50 border border-purple-300 p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-semibold text-purple-700 uppercase tracking-wide">
                  Everything
                </h4>
                <span className="text-xs text-purple-600 font-medium">
                  {everythingRoute.stopCount} stops
                </span>
              </div>
              
              {/* Main Metrics */}
              <div className="grid grid-cols-2 gap-3 text-xs mb-3 pb-3 border-b border-purple-300">
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-purple-500" />
                  <span className="text-purple-900 font-semibold">{everythingRoute.totalKm} km</span>
                  <span className="text-purple-600 text-[10px] font-medium">
                    (+{everythingRoute.totalKm - currentRoute.totalKm})
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-purple-500" />
                  <span className="text-purple-900 font-semibold">{everythingRoute.totalTime}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Fuel className="w-3.5 h-3.5 text-purple-500" />
                  <span className="text-purple-900 font-semibold">{everythingRoute.estimatedFuel}L</span>
                  <span className="text-purple-600 text-[10px] font-medium">
                    (+{everythingRoute.estimatedFuel - currentRoute.estimatedFuel})
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Euro className="w-3.5 h-3.5 text-purple-500" />
                  <span className="text-purple-900 font-semibold">€{everythingRoute.estimatedMargin}</span>
                  <span className="text-green-600 text-[10px] font-semibold">
                    (+€{everythingRoute.estimatedMargin - currentRoute.estimatedMargin})
                  </span>
                </div>
              </div>
              
              {/* Bottom horizontal metrics */}
              <div className="flex items-center justify-between text-[11px] text-purple-600 gap-3">
                <div className="flex flex-col">
                  <span className="font-medium text-purple-600">Fuel Cost</span>
                  <span className="text-purple-900 font-semibold">€{everythingRoute.fuelCost}</span>
                  <span className="text-purple-600 text-[10px]">(+€{everythingRoute.fuelCost - currentRoute.fuelCost})</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-medium text-purple-600">Revenue</span>
                  <span className="text-purple-900 font-semibold">€{everythingRoute.totalRevenue}</span>
                  <span className="text-green-600 font-semibold text-[10px]">(+€{everythingRoute.totalRevenue - currentRoute.totalRevenue})</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-medium text-purple-600">€/km</span>
                  <span className="text-purple-900 font-semibold">{everythingRoute.pricePerKm.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
