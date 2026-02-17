import { useState, useRef, useEffect } from 'react';
import { GripVertical, MapPin, Clock, Package, TrendingDown } from 'lucide-react';

export interface RouteStopData {
  id: string;
  loadId: string;
  color: string;
  pickupCity: string;
  pickupPostcode: string;
  pickupEta: string;
  pickupNumber: number;
  deliveryCity: string;
  deliveryPostcode: string;
  deliveryEta: string;
  deliveryNumber: number;
  distance: number;
  timeWindowViolation?: boolean;
}

interface SidebarRouteStopProps {
  route: RouteStopData;
  index: number;
  onReorder: (fromIndex: number, toIndex: number) => void;
}

export function SidebarRouteStop({ route, index, onReorder }: SidebarRouteStopProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragStartY = useRef(0);
  const itemRef = useRef<HTMLDivElement>(null);

  const handleDragStart = (e: React.DragEvent) => {
    setIsDragging(true);
    dragStartY.current = e.clientY;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('routeIndex', index.toString());
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    setDragOverIndex(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const fromIndex = parseInt(e.dataTransfer.getData('routeIndex'));
    if (fromIndex !== index) {
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
      onDrop={handleDrop}
      className={`bg-white border-b border-gray-200 cursor-move transition-all ${
        isDragging ? 'opacity-50' : ''
      } ${dragOverIndex === index ? 'border-t-2 border-t-blue-500' : ''}`}
      style={{
        borderLeft: `4px solid ${route.color}`,
      }}
    >
      {/* Header */}
      <div className="px-3 py-1.5 bg-gray-50 flex items-center justify-between border-b border-gray-200">
        <div className="flex items-center gap-2">
          <GripVertical className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-xs font-semibold text-gray-900">Route #{route.loadId}</span>
        </div>
        <span className="text-xs text-gray-500">{route.distance} km</span>
      </div>

      {/* Pickup Stop */}
      <div className="px-3 py-2">
        <div className="flex items-start gap-2">
          <span 
            className="w-5 h-5 flex items-center justify-center text-xs font-semibold text-white flex-shrink-0"
            style={{ backgroundColor: route.color }}
          >
            {route.pickupNumber}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 mb-1">
              <span className="px-1.5 py-0.5 text-xs font-medium bg-green-100 text-green-700">
                PICKUP
              </span>
            </div>
            <div className="text-xs space-y-0.5">
              <div className="flex items-center gap-1 text-gray-900 font-medium">
                <MapPin className="w-3 h-3" />
                <span>{route.pickupCity}</span>
                <span className="text-gray-500">{route.pickupPostcode}</span>
              </div>
              <div className="flex items-center gap-1 text-gray-600">
                <Clock className="w-3 h-3" />
                <span>{route.pickupEta}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-gray-200" />

      {/* Delivery Stop */}
      <div className="px-3 py-2">
        <div className="flex items-start gap-2">
          <span 
            className="w-5 h-5 flex items-center justify-center text-xs font-semibold text-white flex-shrink-0"
            style={{ backgroundColor: route.color }}
          >
            {route.deliveryNumber}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 mb-1">
              <span className="px-1.5 py-0.5 text-xs font-medium bg-orange-100 text-orange-700">
                DELIVERY
              </span>
            </div>
            <div className="text-xs space-y-0.5">
              <div className="flex items-center gap-1 text-gray-900 font-medium">
                <MapPin className="w-3 h-3" />
                <span>{route.deliveryCity}</span>
                <span className="text-gray-500">{route.deliveryPostcode}</span>
              </div>
              <div className="flex items-center gap-1 text-gray-600">
                <Clock className="w-3 h-3" />
                <span>{route.deliveryEta}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}