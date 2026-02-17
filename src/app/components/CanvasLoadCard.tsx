import { useState, useRef, useEffect } from 'react';
import { GripVertical, Package, Calendar, Euro, MapPin, Phone, User, CreditCard, ChevronDown, ChevronUp, Palette, TruckIcon } from 'lucide-react';

export interface CanvasLoad {
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
  x: number;
  y: number;
  status: 'ON BOARD' | 'NEGOTIATING' | 'TAKEN' | 'NOT INTERESTED' | 'CANCELED';
  originAddress?: string;
  destAddress?: string;
  contactPerson?: string;
  phone?: string;
  paymentTerms?: string;
}

interface CanvasLoadCardProps {
  load: CanvasLoad;
  onMove: (id: string, x: number, y: number) => void;
  onColorChange: (id: string, color: string) => void;
  onStatusChange?: (id: string, status: CanvasLoad['status']) => void;
  onAddToCargo?: (load: CanvasLoad) => void;
  onRemoveFromCargo?: (load: CanvasLoad) => void;
  scale: number;
  isLoadedInCargo?: boolean; // Whether this load is already in cargo
}

const PRESET_COLORS = [
  '#3B82F6', // blue
  '#F97316', // orange
  '#10B981', // green
  '#8B5CF6', // purple
  '#EF4444', // red
  '#F59E0B', // amber
  '#EC4899', // pink
  '#14B8A6', // teal
];

const STATUS_OPTIONS: CanvasLoad['status'][] = [
  'ON BOARD',
  'NEGOTIATING',
  'TAKEN',
  'NOT INTERESTED',
  'CANCELED',
];

export function CanvasLoadCard({ load, onMove, onColorChange, onStatusChange, onAddToCargo, onRemoveFromCargo, scale, isLoadedInCargo }: CanvasLoadCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [showTakenConfirmation, setShowTakenConfirmation] = useState(false);
  const [showCanceledConfirmation, setShowCanceledConfirmation] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<CanvasLoad['status'] | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartPos = useRef({ x: 0, y: 0, loadX: 0, loadY: 0 });
  const cardRef = useRef<HTMLDivElement>(null);

  // Auto-load to van when status is TAKEN
  useEffect(() => {
    if (load.status === 'TAKEN' && !isLoadedInCargo && onAddToCargo) {
      onAddToCargo(load);
    }
  }, [load.status, isLoadedInCargo, onAddToCargo, load]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    
    setIsDragging(true);
    dragStartPos.current = {
      x: e.clientX,
      y: e.clientY,
      loadX: load.x,
      loadY: load.y,
    };
    e.stopPropagation();
    e.preventDefault();
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('application/json', JSON.stringify(load));
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      
      const deltaX = (e.clientX - dragStartPos.current.x) / scale;
      const deltaY = (e.clientY - dragStartPos.current.y) / scale;
      
      const newX = dragStartPos.current.loadX + deltaX;
      const newY = dragStartPos.current.loadY + deltaY;
      
      onMove(load.id, newX, newY);
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
  }, [isDragging, load.id, load.x, load.y, scale, onMove]);

  const statusColor = {
    'ON BOARD': 'bg-gray-100 text-gray-700',
    NEGOTIATING: 'bg-green-100 text-green-700',
    TAKEN: 'bg-blue-100 text-blue-700',
    'NOT INTERESTED': 'bg-yellow-100 text-yellow-700',
    CANCELED: 'bg-red-100 text-red-700',
  }[load.status];

  const handleConfirmTaken = () => {
    if (onStatusChange && pendingStatus) {
      console.log('Setting status to:', pendingStatus, 'for load:', load.id);
      onStatusChange(load.id, pendingStatus);
      // No need to call onAddToCargo here - the useEffect will handle it
    } else {
      console.error('onStatusChange or pendingStatus is missing:', { onStatusChange: !!onStatusChange, pendingStatus });
    }
    setShowTakenConfirmation(false);
    setShowStatusPicker(false);
    setPendingStatus(null);
  };

  const handleCancelTaken = () => {
    setShowTakenConfirmation(false);
    setShowStatusPicker(false);
    setPendingStatus(null);
  };

  const handleConfirmCanceled = () => {
    if (onStatusChange && pendingStatus) {
      onStatusChange(load.id, pendingStatus);
      if (onRemoveFromCargo && isLoadedInCargo) {
        onRemoveFromCargo(load);
      }
    }
    setShowCanceledConfirmation(false);
    setShowStatusPicker(false);
    setPendingStatus(null);
  };

  const handleCancelCanceled = () => {
    setShowCanceledConfirmation(false);
    setShowStatusPicker(false);
    setPendingStatus(null);
  };

  return (
    <>
      {/* Status Badge Above Card */}
      <div
        className="absolute"
        style={{
          left: load.x,
          top: load.y - 32,
          pointerEvents: 'none',
        }}
      >
        <div className="relative" style={{ pointerEvents: 'auto' }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowStatusPicker(!showStatusPicker);
            }}
            className={`px-2 py-1 text-xs font-semibold ${statusColor} cursor-pointer hover:opacity-80 transition-opacity shadow-sm`}
          >
            {load.status}
          </button>
          {showStatusPicker && onStatusChange && (
            <div className="absolute left-0 top-full mt-1 bg-white border border-gray-300 shadow-lg py-1 z-50 min-w-[140px]">
              {STATUS_OPTIONS.map((status) => {
                const isSelected = load.status === status;
                const statusTextColor = 
                  status === 'ON BOARD' ? 'text-gray-700' :
                  status === 'NEGOTIATING' ? 'text-green-700' :
                  status === 'TAKEN' ? 'text-blue-700' :
                  status === 'CANCELED' ? 'text-red-700' :
                  'text-orange-700';
                
                return (
                  <button
                    key={status}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (status === 'TAKEN') {
                        setShowTakenConfirmation(true);
                        setPendingStatus(status);
                        setShowStatusPicker(false);
                      } else if (status === 'CANCELED') {
                        setShowCanceledConfirmation(true);
                        setPendingStatus(status);
                        setShowStatusPicker(false);
                      } else {
                        onStatusChange(load.id, status);
                        setShowStatusPicker(false);
                      }
                    }}
                    className={`w-full px-3 py-1.5 text-xs font-medium text-left hover:bg-gray-50 transition-colors ${isSelected ? 'bg-gray-100' : ''} ${statusTextColor}`}
                  >
                    {status}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal for TAKEN Status */}
      {showTakenConfirmation && (
        <div 
          className="fixed bottom-0 left-0 right-0 bg-white border-t-4 border-blue-600 shadow-2xl"
          style={{ 
            zIndex: 9999,
            padding: '24px 48px',
          }}
        >
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-6">
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-1">Confirm Load Taken</h3>
              <p className="text-sm text-gray-600">
                By marking this load as <span className="font-bold text-blue-600">TAKEN</span>, it will be automatically loaded into the van cargo planner and added to the route sidebar.
              </p>
            </div>
            <div className="flex gap-3 flex-shrink-0">
              <button
                onClick={handleCancelTaken}
                className="px-6 py-3 text-base font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors rounded-lg whitespace-nowrap"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmTaken}
                className="px-6 py-3 text-base font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors rounded-lg whitespace-nowrap"
              >
                Confirm & Load to Van
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for CANCELED Status */}
      {showCanceledConfirmation && (
        <div 
          className="fixed bottom-0 left-0 right-0 bg-white border-t-4 border-red-600 shadow-2xl"
          style={{ 
            zIndex: 9999,
            padding: '24px 48px',
          }}
        >
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-6">
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-1">Confirm Load Canceled</h3>
              <p className="text-sm text-gray-600">
                By marking this load as <span className="font-bold text-red-600">CANCELED</span>, it will be automatically removed from the van cargo planner and the route sidebar.
              </p>
            </div>
            <div className="flex gap-3 flex-shrink-0">
              <button
                onClick={handleCancelCanceled}
                className="px-6 py-3 text-base font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors rounded-lg whitespace-nowrap"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmCanceled}
                className="px-6 py-3 text-base font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors rounded-lg whitespace-nowrap"
              >
                Confirm & Remove from Van
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Card */}
      <div
        ref={cardRef}
        draggable
        onDragStart={handleDragStart}
        onMouseDown={handleMouseDown}
        className={`absolute bg-white border border-gray-200 p-3 shadow-md cursor-grab active:cursor-grabbing transition-shadow ${
          isDragging ? 'shadow-xl z-50' : 'hover:shadow-lg'
        }`}
        style={{
          left: load.x,
          top: load.y,
          borderLeftWidth: '4px',
          borderLeftColor: load.color,
          width: '280px',
          userSelect: 'none',
        }}
      >
        <div className="flex items-start gap-2">
          <GripVertical className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-2">
              <h3 className="font-semibold text-sm text-gray-900">{load.brokerage}</h3>
              <div className="flex items-center gap-1">
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowColorPicker(!showColorPicker);
                    }}
                    className="p-1 hover:bg-gray-100"
                    title="Change color"
                  >
                    <Palette className="w-3.5 h-3.5 text-gray-600" />
                  </button>
                  {showColorPicker && (
                    <div className="absolute right-0 top-full mt-1 bg-white border border-gray-300 shadow-lg p-2 grid grid-cols-4 gap-1 z-50">
                      {PRESET_COLORS.map((color) => (
                        <button
                          key={color}
                          onClick={(e) => {
                            e.stopPropagation();
                            onColorChange(load.id, color);
                            setShowColorPicker(false);
                          }}
                          className="w-6 h-6 border border-gray-300 hover:scale-110 transition-transform"
                          style={{ backgroundColor: color }}
                          title={color}
                        />
                      ))}
                    </div>
                  )}
                </div>
                <span
                  className="px-2 py-0.5 text-xs font-medium"
                  style={{ backgroundColor: load.color + '20', color: load.color }}
                >
                  #{load.id}
                </span>
              </div>
            </div>

            {/* Add to Cargo Button */}
            {onAddToCargo && !isLoadedInCargo && load.status !== 'TAKEN' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAddToCargo(load);
                }}
                className="mb-2 w-full flex items-center justify-center gap-1.5 px-2 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors"
                title="Load into van cargo planner"
              >
                <TruckIcon className="w-3.5 h-3.5" />
                <span>Load to Van</span>
              </button>
            )}

            {/* Remove from Cargo Button - Only show if status is NOT TAKEN */}
            {onRemoveFromCargo && isLoadedInCargo && load.status !== 'TAKEN' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveFromCargo(load);
                }}
                className="mb-2 w-full flex items-center justify-center gap-1.5 px-2 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium transition-colors"
                title="Remove from van cargo planner"
              >
                <TruckIcon className="w-3.5 h-3.5" />
                <span>Remove from Van</span>
              </button>
            )}

            {/* Status indicator when TAKEN */}
            {load.status === 'TAKEN' && isLoadedInCargo && (
              <div className="mb-2 w-full flex items-center justify-center gap-1.5 px-2 py-1.5 bg-blue-50 text-blue-700 text-xs font-medium border border-blue-200">
                <TruckIcon className="w-3.5 h-3.5" />
                <span>Loaded in Van (TAKEN)</span>
              </div>
            )}

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

            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              className="mt-2 w-full flex items-center justify-center gap-1 text-xs text-gray-500 hover:text-gray-700 py-1 hover:bg-gray-50"
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="w-3 h-3" />
                  <span>Less</span>
                </>
              ) : (
                <>
                  <ChevronDown className="w-3 h-3" />
                  <span>More Details</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}