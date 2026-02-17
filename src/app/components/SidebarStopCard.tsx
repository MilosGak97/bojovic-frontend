import { useState, useRef } from 'react';
import { GripVertical, MapPin, Clock, Package, TrendingDown, Link } from 'lucide-react';
import { DeltaBadge } from './DeltaBadge';

export interface SidebarStop {
  id: string;
  number: number;
  type: 'pickup' | 'delivery';
  city: string;
  postcode: string;
  eta: string;
  color: string;
  loadId: string;
  pallets: number;
  weight: number;
  groupId?: string;
  isSimulation?: boolean;
  kmDelta?: number;
  timeDeltaMinutes?: number;
}

interface SidebarStopCardProps {
  stop: SidebarStop;
  index: number;
  isSelected: boolean;
  isGrouped: boolean;
  isInCargo?: boolean; // Whether this load is loaded in cargo planner
  isPending?: boolean; // Whether this stop is pending confirmation
  onSelect: (id: string, multiSelect: boolean) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onToggleCargo?: (stopId: string) => void; // Toggle cargo visibility
}

export function SidebarStopCard({ stop, index, isSelected, isGrouped, isInCargo, isPending, onSelect, onReorder, onToggleCargo }: SidebarStopCardProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const itemRef = useRef<HTMLDivElement>(null);

  const handleClick = (e: React.MouseEvent) => {
    const multiSelect = e.ctrlKey || e.shiftKey;
    onSelect(stop.id, multiSelect);
  };

  const handleDragStart = (e: React.DragEvent) => {
    setIsDragging(true);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('stopIndex', index.toString());
    e.dataTransfer.setData('application/json', JSON.stringify({
      type: 'stop',
      stop: stop,
    }));
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    setDragOverIndex(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const fromIndex = parseInt(e.dataTransfer.getData('stopIndex'));
    if (!isNaN(fromIndex) && fromIndex !== index) {
      onReorder(fromIndex, index);
    }
    setDragOverIndex(null);
  };

  return (
    <div
      ref={itemRef}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
      className={`relative bg-white border-b border-gray-200 cursor-move transition-all ${
        isDragging ? 'opacity-40 scale-95' : ''
      } ${dragOverIndex === index ? 'border-t-4 border-t-blue-500 bg-blue-50' : ''} ${
        isSelected ? 'bg-blue-100 ring-2 ring-inset ring-blue-500' : ''
      } ${isGrouped && !isSelected ? 'bg-amber-50' : ''}`}
      style={{
        borderLeft: `4px solid ${stop.color}`,
      }}
    >
      {/* Toggle Button - Centered vertically on right side */}
      {onToggleCargo && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleCargo(stop.id);
          }}
          className={`absolute right-3 top-1/2 -translate-y-1/2 w-8 h-4 rounded-full transition-colors z-10 ${
            isInCargo ? 'bg-blue-500' : 'bg-gray-300'
          }`}
          title={isInCargo ? "Hide from cargo planner" : "Show in cargo planner"}
        >
          <div 
            className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow-md transition-transform ${
              isInCargo ? 'translate-x-4' : 'translate-x-0.5'
            }`}
          />
        </button>
      )}

      <div className="px-3 py-2">
        <div className="flex items-start gap-2">
          <GripVertical className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-2">
                <span 
                  className="w-5 h-5 flex items-center justify-center text-xs font-semibold text-white flex-shrink-0"
                  style={{ backgroundColor: stop.color }}
                >
                  {index + 1}
                </span>
                <span
                  className={`px-1.5 py-0.5 text-xs font-medium ${
                    stop.type === 'pickup'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-orange-100 text-orange-700'
                  }`}
                >
                  {stop.type === 'pickup' ? (
                    <span className="flex items-center gap-1">
                      <TrendingDown className="w-3 h-3 rotate-180" />
                      PICKUP
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <Package className="w-3 h-3" />
                      DELIVERY
                    </span>
                  )}
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                {isGrouped && (
                  <Link className="w-3.5 h-3.5 text-amber-600" />
                )}
                {isPending && (
                  <div 
                    className="w-2.5 h-2.5 rounded-full bg-yellow-500 shadow-md" 
                    title="Pending confirmation"
                  />
                )}
              </div>
            </div>

            <div className="space-y-1 text-xs">
              <div className="flex items-center gap-1 text-gray-900 font-medium">
                <MapPin className="w-3 h-3" />
                <span>{stop.city}</span>
                <span className="text-gray-500 font-normal">{stop.postcode}</span>
              </div>

              <div className="flex items-center gap-1 text-gray-600">
                <Clock className="w-3 h-3" />
                <span>ETA: {stop.eta}</span>
              </div>

              <div className="flex items-center justify-between pt-0.5 text-gray-500">
                <span>{stop.pallets} PAL • {stop.weight} kg</span>
              </div>

              {stop.isSimulation && (stop.kmDelta !== undefined || stop.timeDeltaMinutes !== undefined) && (
                <div className="flex items-center gap-1 pt-1">
                  {stop.kmDelta !== undefined && stop.kmDelta !== 0 && (
                    <DeltaBadge value={stop.kmDelta} unit="km" type="km" />
                  )}
                  {stop.timeDeltaMinutes !== undefined && stop.timeDeltaMinutes !== 0 && (
                    <DeltaBadge value={stop.timeDeltaMinutes} unit="m" type="time" />
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}