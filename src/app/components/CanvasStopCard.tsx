import { useState, useRef, useEffect } from 'react';
import { GripVertical, MapPin, Clock, AlertTriangle, Package, TrendingDown, Link, Unlink } from 'lucide-react';

export interface CanvasStop {
  id: string;
  number: number;
  type: 'pickup' | 'delivery';
  city: string;
  postcode: string;
  eta: string;
  distanceToNext: number;
  drivingTime: string;
  timeWindowViolation: boolean;
  color: string;
  loadId: string;
  pallets: number;
  weight: number;
  x: number;
  y: number;
  groupId?: string; // If grouped with other stops
}

interface CanvasStopCardProps {
  stop: CanvasStop;
  isSelected: boolean;
  isGrouped: boolean;
  onMove: (id: string, x: number, y: number) => void;
  onSelect: (id: string, multiSelect: boolean) => void;
  scale: number;
}

export function CanvasStopCard({ stop, isSelected, isGrouped, onMove, onSelect, scale }: CanvasStopCardProps) {
  const [isDragging, setIsDragging] = useState(false);
  const dragStartPos = useRef({ x: 0, y: 0, stopX: 0, stopY: 0 });
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    
    // Handle selection
    if (e.ctrlKey || e.shiftKey) {
      onSelect(stop.id, true);
      return;
    }
    
    setIsDragging(true);
    dragStartPos.current = {
      x: e.clientX,
      y: e.clientY,
      stopX: stop.x,
      stopY: stop.y,
    };
    e.stopPropagation();
    e.preventDefault();
  };

  const handleClick = (e: React.MouseEvent) => {
    if (!isDragging && !(e.ctrlKey || e.shiftKey)) {
      onSelect(stop.id, false);
    }
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('application/json', JSON.stringify({
      type: 'stop',
      stop: stop,
    }));
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      
      const deltaX = (e.clientX - dragStartPos.current.x) / scale;
      const deltaY = (e.clientY - dragStartPos.current.y) / scale;
      
      const newX = dragStartPos.current.stopX + deltaX;
      const newY = dragStartPos.current.stopY + deltaY;
      
      onMove(stop.id, newX, newY);
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
  }, [isDragging, stop.id, stop.x, stop.y, scale, onMove]);

  return (
    <div
      ref={cardRef}
      draggable
      onDragStart={handleDragStart}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      className={`absolute bg-white p-3 shadow-md cursor-grab active:cursor-grabbing ${
        isDragging ? 'shadow-xl z-50' : 'hover:shadow-lg'
      } ${isSelected ? 'ring-2 ring-blue-500 ring-offset-2' : ''} ${
        isGrouped ? 'border-2 border-amber-400' : 'border-2 border-gray-200'
      }`}
      style={{
        left: stop.x,
        top: stop.y,
        borderLeftWidth: '4px',
        borderLeftColor: stop.color,
        width: '240px',
        userSelect: 'none',
      }}
    >
      <div className="flex items-start gap-2">
        <GripVertical className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <span 
                className="w-6 h-6 flex items-center justify-center text-xs font-semibold text-white"
                style={{ backgroundColor: stop.color }}
              >
                {stop.number}
              </span>
              <span
                className={`px-2 py-0.5 text-xs font-medium ${
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
            
            {stop.timeWindowViolation && (
              <AlertTriangle className="w-4 h-4 text-amber-500" />
            )}
          </div>

          {isGrouped && (
            <div className="mb-2 flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2 py-1">
              <Link className="w-3 h-3" />
              <span>Grouped</span>
            </div>
          )}

          <div className="space-y-1.5 text-xs">
            <div className="flex items-center gap-1.5 text-gray-900 font-medium">
              <MapPin className="w-3.5 h-3.5" />
              <span>{stop.city}</span>
              <span className="text-gray-500 font-normal">{stop.postcode}</span>
            </div>

            <div className="flex items-center gap-1.5 text-gray-600">
              <Clock className="w-3.5 h-3.5" />
              <span>ETA: {stop.eta}</span>
            </div>

            <div className="flex items-center justify-between pt-1 text-gray-500">
              <span>{stop.pallets} PAL • {stop.weight} kg</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}