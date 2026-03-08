import { ChevronDown, ChevronUp, TrendingUp, Clock, Fuel, Euro } from 'lucide-react';
import { useState } from 'react';

export interface RouteStats {
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
  currentRoute: RouteStats;
  plannedRoute: RouteStats;
  previousRoute?: {
    currentRoute: RouteStats;
    plannedRoute: RouteStats;
  } | null;
}

export function RouteComparison({ 
  currentRoute, 
  plannedRoute, 
  previousRoute = null,
}: RouteComparisonProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const plannedPrevious = previousRoute?.plannedRoute;

  const formatSignedDelta = (value: number, decimals = 0): string => {
    const rounded =
      decimals > 0 ? Number(value.toFixed(decimals)) : Math.round(value);
    if (rounded === 0) return '0';
    const absoluteText =
      decimals > 0
        ? Math.abs(rounded).toFixed(decimals).replace(/\.?0+$/, '')
        : String(Math.abs(rounded));
    return `${rounded > 0 ? '+' : '-'}${absoluteText}`;
  };

  const renderDelta = (
    currentValue: number,
    previousValue: number | undefined,
    options?: {
      prefix?: string;
      decimals?: number;
      className?: string;
    },
  ) => {
    if (typeof previousValue !== 'number' || Number.isNaN(previousValue)) {
      return null;
    }
    const delta = currentValue - previousValue;
    const prefix = options?.prefix ?? '';
    const decimals = options?.decimals ?? 0;
    const className = options?.className ?? 'text-[10px] font-medium';
    return (
      <span className={className}>
        ({prefix}
        {formatSignedDelta(delta, decimals)})
      </span>
    );
  };

  return (
    <div className="flex flex-col bg-white">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-6 py-2 flex items-center justify-between hover:bg-gray-50 transition-colors border-b border-gray-200"
      >
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-sm text-gray-900">Route Comparison</h3>
        </div>
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-gray-500" />
        ) : (
          <ChevronUp className="w-4 h-4 text-gray-500" />
        )}
      </button>

      {/* Expandable Content - Horizontal Layout */}
      {isExpanded && (
        <div className="px-6 py-4">
          <div className="grid grid-cols-1 gap-4">
            {/* Planned Route - TAKEN + NEGOTIATING */}
            <div className="bg-blue-50 border-2 border-blue-300 p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-semibold text-blue-700 uppercase tracking-wide">
                  Planned Route
                </h4>
                <span className="text-xs text-blue-600 font-medium">
                  {plannedRoute.stopCount} stops
                </span>
              </div>
              
              {/* Main Metrics */}
              <div className="grid grid-cols-2 gap-3 text-xs mb-3 pb-3 border-b border-blue-300">
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-blue-500" />
                  <span className="text-blue-900 font-semibold">{plannedRoute.totalKm} km</span>
                  {renderDelta(plannedRoute.totalKm, plannedPrevious?.totalKm, {
                    className: 'text-blue-600 text-[10px] font-medium',
                  })}
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-blue-500" />
                  <span className="text-blue-900 font-semibold">{plannedRoute.totalTime}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Fuel className="w-3.5 h-3.5 text-blue-500" />
                  <span className="text-blue-900 font-semibold">{plannedRoute.estimatedFuel}L</span>
                  {renderDelta(plannedRoute.estimatedFuel, plannedPrevious?.estimatedFuel, {
                    className: 'text-blue-600 text-[10px] font-medium',
                  })}
                </div>
                <div className="flex items-center gap-1.5">
                  <Euro className="w-3.5 h-3.5 text-blue-500" />
                  <span className="text-blue-900 font-semibold">€{plannedRoute.estimatedMargin}</span>
                  {renderDelta(plannedRoute.estimatedMargin, plannedPrevious?.estimatedMargin, {
                    prefix: '€',
                    decimals: 2,
                    className: 'text-green-600 text-[10px] font-semibold',
                  })}
                </div>
              </div>
              
              {/* Bottom horizontal metrics */}
              <div className="flex items-center justify-between text-[11px] text-blue-600 gap-3">
                <div className="flex flex-col">
                  <span className="font-medium text-blue-600">Fuel Cost</span>
                  <span className="text-blue-900 font-semibold">€{plannedRoute.fuelCost}</span>
                  {renderDelta(plannedRoute.fuelCost, plannedPrevious?.fuelCost, {
                    prefix: '€',
                    className: 'text-blue-600 text-[10px]',
                  })}
                </div>
                <div className="flex flex-col">
                  <span className="font-medium text-blue-600">Revenue</span>
                  <span className="text-blue-900 font-semibold">€{plannedRoute.totalRevenue}</span>
                  {renderDelta(plannedRoute.totalRevenue, plannedPrevious?.totalRevenue, {
                    prefix: '€',
                    decimals: 2,
                    className: 'text-green-600 font-semibold text-[10px]',
                  })}
                </div>
                <div className="flex flex-col">
                  <span className="font-medium text-blue-600">€/km</span>
                  <span className="text-blue-900 font-semibold">{plannedRoute.pricePerKm.toFixed(2)}</span>
                </div>
              </div>
            </div>

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
          </div>
        </div>
      )}
    </div>
  );
}
