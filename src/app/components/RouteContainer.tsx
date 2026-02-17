import { useState, useRef, useEffect } from 'react';
import { GripVertical, MapPin, Clock, AlertTriangle, Package, TrendingDown, ChevronDown, ChevronUp } from 'lucide-react';

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
  x: number;
  y: number;
}

interface RouteContainerProps {
  loadId: string;
  pickupStop: CanvasStop;
  deliveryStop: CanvasStop;
  onMove: (loadId: string, x: number, y: number) => void;
  scale: number;
}

export function RouteContainer({ loadId, pickupStop, deliveryStop, onMove, scale }: RouteContainerProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const dragStartPos = useRef({ x: 0, y: 0, containerX: 0, containerY: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    
    setIsDragging(true);
    dragStartPos.current = {
      x: e.clientX,
      y: e.clientY,
      containerX: pickupStop.x,
      containerY: pickupStop.y,
    };
    e.stopPropagation();
    e.preventDefault();
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      
      const deltaX = (e.clientX - dragStartPos.current.x) / scale;
      const deltaY = (e.clientY - dragStartPos.current.y) / scale;
      
      const newX = dragStartPos.current.containerX + deltaX;
      const newY = dragStartPos.current.containerY + deltaY;
      
      onMove(loadId, newX, newY);
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
  }, [isDragging, pickupStop.x, pickupStop.y, scale, onMove, loadId]);

  const renderStop = (stop: CanvasStop) => (
    <div className="p-3 bg-white">
      <div className="flex items-start gap-2">
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
              <span>{stop.distanceToNext} km to next</span>
              <span>{stop.drivingTime}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      className={`absolute bg-white border-2 shadow-md cursor-grab active:cursor-grabbing ${
        isDragging ? 'shadow-xl z-50' : 'hover:shadow-lg'
      }`}
      style={{
        left: pickupStop.x,
        top: pickupStop.y,
        borderLeftWidth: '4px',
        borderLeftColor: pickupStop.color,
        width: '280px',
        userSelect: 'none',
      }}
    >
      {/* Header */}
      <div className="bg-gray-50 border-b border-gray-200 px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GripVertical className="w-4 h-4 text-gray-400" />
          <h3 className="font-semibold text-xs text-gray-900">Route #{loadId}</h3>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsCollapsed(!isCollapsed);
          }}
          className="p-1 hover:bg-gray-200"
        >
          {isCollapsed ? (
            <ChevronDown className="w-3.5 h-3.5 text-gray-600" />
          ) : (
            <ChevronUp className="w-3.5 h-3.5 text-gray-600" />
          )}
        </button>
      </div>

      {!isCollapsed && (
        <>
          {renderStop(pickupStop)}
          <div className="border-t border-gray-200" />
          {renderStop(deliveryStop)}
        </>
      )}
    </div>
  );
}
