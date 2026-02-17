import { useDrag, useDrop } from 'react-dnd';
import { GripVertical, MapPin, Clock, AlertTriangle, Package, TrendingDown } from 'lucide-react';
import { useRef } from 'react';

export interface Stop {
  id: string;
  number: number;
  type: 'pickup' | 'delivery';
  city: string;
  postcode: string;
  eta: string;
  distanceToNext: number;
  drivingTime: string;
  timeWindowViolation: boolean;
  color: string; // Color to match with route/load
  loadId: string; // To link pickup/delivery of same load
}

interface StopCardProps {
  stop: Stop;
  index: number;
  moveStop: (dragIndex: number, hoverIndex: number) => void;
}

export function StopCard({ stop, index, moveStop }: StopCardProps) {
  const ref = useRef<HTMLDivElement>(null);

  const [{ isDragging }, drag] = useDrag({
    type: 'stop',
    item: { index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [, drop] = useDrop({
    accept: 'stop',
    hover: (item: { index: number }) => {
      if (!ref.current) return;
      const dragIndex = item.index;
      const hoverIndex = index;
      if (dragIndex === hoverIndex) return;
      moveStop(dragIndex, hoverIndex);
      item.index = hoverIndex;
    },
  });

  drag(drop(ref));

  return (
    <div
      ref={ref}
      className={`bg-white border border-gray-200 p-3 cursor-move ${
        isDragging ? 'opacity-50' : 'opacity-100'
      }`}
      style={{
        borderLeftWidth: '4px',
        borderLeftColor: stop.color,
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
}