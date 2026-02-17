import { useState } from 'react';
import { useDrag } from 'react-dnd';
import { GripVertical, Package, Calendar, Euro, MapPin, Phone, User, CreditCard } from 'lucide-react';

export interface Load {
  id: string;
  brokerage: string;
  originCity: string;
  destCity: string;
  pickupDate: string;
  deliveryDate: string;
  pallets: number;
  ldm: number;
  weight: number;
  price: number;
  distance: number;
  color: string;
  originAddress?: string;
  destAddress?: string;
  contactPerson?: string;
  phone?: string;
  paymentTerms?: string;
}

interface LoadCardProps {
  load: Load;
}

export function LoadCard({ load }: LoadCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'load',
    item: load,
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }));

  return (
    <div
      ref={drag}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
      className={`bg-white border border-gray-200 p-3 cursor-grab active:cursor-grabbing transition-all ${
        isDragging ? 'opacity-50' : 'opacity-100 hover:shadow-md'
      }`}
      style={{
        borderLeftWidth: '4px',
        borderLeftColor: load.color,
      }}
    >
      <div className="flex items-start gap-2">
        <GripVertical className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="font-semibold text-sm text-gray-900">{load.brokerage}</h3>
            <span
              className="px-2 py-0.5 text-xs font-medium"
              style={{ backgroundColor: load.color + '20', color: load.color }}
            >
              #{load.id}
            </span>
          </div>

          <div className="space-y-1.5 text-xs text-gray-600">
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" />
              <span className="font-medium">
                {load.originCity} → {load.destCity}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              <span>
                {load.pickupDate} → {load.deliveryDate}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5" />
                <span>{load.pallets} PAL • {load.ldm} LDM</span>
              </div>
              <span className="text-gray-400">•</span>
              <span>{load.weight} kg</span>
            </div>

            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-1.5">
                <Euro className="w-3.5 h-3.5" />
                <span className="font-semibold text-green-600">€{load.price}</span>
              </div>
              <span className="text-gray-500">{load.distance} km</span>
            </div>
          </div>

          {isExpanded && (
            <div className="mt-3 pt-3 border-t border-gray-100 space-y-2 text-xs">
              {load.originAddress && (
                <div>
                  <div className="text-gray-500 mb-0.5">Origin:</div>
                  <div className="text-gray-900">{load.originAddress}</div>
                </div>
              )}
              {load.destAddress && (
                <div>
                  <div className="text-gray-500 mb-0.5">Destination:</div>
                  <div className="text-gray-900">{load.destAddress}</div>
                </div>
              )}
              {load.contactPerson && (
                <div className="flex items-center gap-1.5 text-gray-700">
                  <User className="w-3.5 h-3.5" />
                  <span>{load.contactPerson}</span>
                </div>
              )}
              {load.phone && (
                <div className="flex items-center gap-1.5 text-gray-700">
                  <Phone className="w-3.5 h-3.5" />
                  <span>{load.phone}</span>
                </div>
              )}
              {load.paymentTerms && (
                <div className="flex items-center gap-1.5 text-gray-700">
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>{load.paymentTerms}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
