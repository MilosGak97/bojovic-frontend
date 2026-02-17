import { useState, useRef, useEffect } from 'react';
import { GripVertical, TrendingDown, TrendingUp, Fuel, DollarSign, Sidebar } from 'lucide-react';

export interface CanvasRouteSummary {
  id: string;
  totalKm: number;
  totalTime: string;
  oldRouteKm: number;
  estimatedFuel: number;
  estimatedMargin: number;
  x: number;
  y: number;
}

interface CanvasRouteSummaryCardProps {
  summary: CanvasRouteSummary;
  onMove: (id: string, x: number, y: number) => void;
  scale: number;
  onDock?: () => void; // New callback to dock to sidebar
}

export function CanvasRouteSummaryCard({ summary, onMove, scale, onDock }: CanvasRouteSummaryCardProps) {
  const [isDragging, setIsDragging] = useState(false);
  const dragStartPos = useRef({ x: 0, y: 0, summaryX: 0, summaryY: 0 });
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    // Don't start dragging if clicking a button
    if ((e.target as HTMLElement).closest('button')) return;
    
    setIsDragging(true);
    dragStartPos.current = {
      x: e.clientX,
      y: e.clientY,
      summaryX: summary.x,
      summaryY: summary.y,
    };
    e.stopPropagation();
    e.preventDefault();
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      
      const deltaX = (e.clientX - dragStartPos.current.x) / scale;
      const deltaY = (e.clientY - dragStartPos.current.y) / scale;
      
      const newX = dragStartPos.current.summaryX + deltaX;
      const newY = dragStartPos.current.summaryY + deltaY;
      
      onMove(summary.id, newX, newY);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, summary.id, summary.x, summary.y, scale, onMove]);

  const kmDiff = summary.totalKm - summary.oldRouteKm;
  const isImproved = kmDiff < 0;

  return (
    <div
      ref={cardRef}
      onMouseDown={handleMouseDown}
      className={`absolute bg-white border border-gray-200 shadow-md cursor-grab active:cursor-grabbing ${
        isDragging ? 'shadow-xl z-50' : 'hover:shadow-lg'
      }`}
      style={{
        left: summary.x,
        top: summary.y,
        width: '280px',
        userSelect: 'none',
      }}
    >
      <div className="bg-gray-50 border-b border-gray-200 px-3 py-2 flex items-center gap-2">
        <GripVertical className="w-4 h-4 text-gray-400" />
        <h3 className="font-semibold text-sm text-gray-900">Route Summary</h3>
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

        <div className="pt-2 border-t border-gray-100">
          <div className="flex items-center justify-between mb-1">
            <span className="text-gray-600 text-xs">Route Comparison</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <div className="text-xs text-gray-500 mb-1">Old: {summary.oldRouteKm} km</div>
              <div className="text-xs text-gray-500">New: {summary.totalKm} km</div>
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

        {/* Dock to Sidebar Button */}
        {onDock && (
          <div className="pt-2 border-t border-gray-100">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDock();
              }}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium transition-colors"
              title="Dock to sidebar"
            >
              <Sidebar className="w-3.5 h-3.5" />
              <span>Dock to Sidebar</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}