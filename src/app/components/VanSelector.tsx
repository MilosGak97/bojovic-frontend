import { useState, useRef, useEffect } from 'react';
import { Truck, ChevronDown } from 'lucide-react';

interface Van {
  id: string;
  name: string;
  licensePlate: string;
  capacity: string;
}

interface VanSelectorProps {
  selectedVanId: string;
  onVanChange: (vanId: string) => void;
}

const VANS: Van[] = [
  { id: 'VAN1', name: 'Van 1', licensePlate: 'B-VD-2301', capacity: '3.5t' },
  { id: 'VAN2', name: 'Van 2', licensePlate: 'B-VD-2302', capacity: '3.5t' },
  { id: 'VAN3', name: 'Van 3', licensePlate: 'B-VD-2303', capacity: '3.5t' },
  { id: 'VAN4', name: 'Van 4', licensePlate: 'B-VD-2304', capacity: '3.5t' },
  { id: 'VAN5', name: 'Van 5', licensePlate: 'B-VD-2305', capacity: '3.5t' },
];

export function VanSelector({ selectedVanId, onVanChange }: VanSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedVan = VANS.find(v => v.id === selectedVanId) || VANS[0];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-white border-2 border-gray-300 hover:border-blue-500 hover:bg-gray-50 transition-colors"
      >
        <Truck className="w-4 h-4 text-blue-600" />
        <div className="flex flex-col items-start">
          <span className="text-sm font-semibold text-gray-900">{selectedVan.name}</span>
          <span className="text-xs text-gray-500">{selectedVan.licensePlate}</span>
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-600 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full mt-1 left-0 bg-white border-2 border-gray-300 shadow-lg z-50 min-w-[200px]">
          {VANS.map((van) => (
            <button
              key={van.id}
              onClick={() => {
                onVanChange(van.id);
                setIsOpen(false);
              }}
              className={`w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-blue-50 transition-colors border-b border-gray-200 last:border-b-0 ${
                van.id === selectedVanId ? 'bg-blue-50' : ''
              }`}
            >
              <Truck className={`w-4 h-4 flex-shrink-0 ${van.id === selectedVanId ? 'text-blue-600' : 'text-gray-400'}`} />
              <div className="flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-sm font-semibold ${van.id === selectedVanId ? 'text-blue-600' : 'text-gray-900'}`}>
                    {van.name}
                  </span>
                  <span className="text-xs text-gray-500">{van.capacity}</span>
                </div>
                <span className="text-xs text-gray-500">{van.licensePlate}</span>
              </div>
              {van.id === selectedVanId && (
                <div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0"></div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
