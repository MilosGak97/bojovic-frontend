import { useState, useRef } from 'react';
import { GripVertical, ExternalLink, ArrowUp, ArrowDown } from 'lucide-react';
import { DeltaBadge } from './DeltaBadge';

export interface SidebarStop {
  id: string;
  number: number;
  type: 'pickup' | 'delivery';
  city: string;
  postcode: string;
  countryCode?: string;
  lat?: number | null;
  lng?: number | null;
  eta: string;
  etaDate?: string;
  etaTime?: string;
  color: string;
  loadId: string;
  brokerage?: string;
  locationLine?: string;
  transeuLink?: string;
  pallets: number;
  weight: number;
  distanceToNext?: number;
  drivingTime?: string;
  groupId?: string;
  isSimulation?: boolean;
  kmDelta?: number;
  timeDeltaMinutes?: number;
}

interface SidebarStopCardProps {
  stop: SidebarStop;
  index: number;
  draggingIndex: number | null;
  isSelected: boolean;
  onSelect: (id: string, multiSelect: boolean) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onDraggingIndexChange: (index: number | null) => void;
  onTranseuAction?: (stopId: string, shouldEdit: boolean) => void;
}

const hexToRgba = (hex: string, alpha: number): string => {
  const normalized = hex.trim().replace('#', '');
  const fullHex =
    normalized.length === 3
      ? normalized
          .split('')
          .map((char) => char + char)
          .join('')
      : normalized;

  if (!/^[0-9a-fA-F]{6}$/.test(fullHex)) {
    return `rgba(148, 163, 184, ${alpha})`;
  }

  const value = parseInt(fullHex, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export function SidebarStopCard({
  stop,
  index,
  draggingIndex,
  isSelected,
  onSelect,
  onReorder,
  onDraggingIndexChange,
  onTranseuAction,
}: SidebarStopCardProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const itemRef = useRef<HTMLDivElement>(null);
  const didDragRef = useRef(false);
  const locationLine = stop.locationLine ?? `DE, ${stop.postcode}, ${stop.city}`;
  const etaDate = stop.etaDate ?? '—';
  const etaTime = stop.etaTime ?? '—';
  const brokerageLabelRaw = (stop.brokerage ?? '').trim();
  const brokerageLabel = brokerageLabelRaw
    ? brokerageLabelRaw.length > 24
      ? `${brokerageLabelRaw.slice(0, 24)}...`
      : brokerageLabelRaw
    : 'Brokerage not set';
  const brokerBadgeStyle = {
    backgroundColor: hexToRgba(stop.color, 0.12),
    borderColor: hexToRgba(stop.color, 0.3),
    color: stop.color,
  };

  const handleCopyLocation = async (event: React.MouseEvent) => {
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(locationLine);
    } catch {
      // Ignore clipboard failures in unsupported environments.
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    if (didDragRef.current) {
      didDragRef.current = false;
      return;
    }
    const multiSelect = e.ctrlKey || e.shiftKey;
    onSelect(stop.id, multiSelect);
  };

  const handleDragStart = (e: React.DragEvent) => {
    didDragRef.current = true;
    setIsDragging(true);
    onDraggingIndexChange(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/x-sidebar-stop-index', String(index));
    e.dataTransfer.setData('text/plain', stop.id);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    setIsDragOver(false);
    onDraggingIndexChange(null);
    window.setTimeout(() => {
      didDragRef.current = false;
    }, 0);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const transferredIndex = Number(e.dataTransfer.getData('application/x-sidebar-stop-index'));
    const sourceIndex = Number.isInteger(transferredIndex)
      ? transferredIndex
      : draggingIndex;
    if (sourceIndex !== null && sourceIndex >= 0 && sourceIndex !== index) {
      onReorder(sourceIndex, index);
    }
    onDraggingIndexChange(null);
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
      className={`relative select-none bg-white border-b border-gray-200 cursor-move transition-[background-color,box-shadow,opacity,transform] ${
        isDragging ? 'opacity-40 scale-95' : ''
      } ${isDragOver && draggingIndex !== index ? 'bg-blue-50 shadow-[inset_0_0_0_2px_rgba(147,197,253,1)]' : ''} ${
        isSelected ? 'bg-blue-100 shadow-[inset_0_0_0_2px_rgba(59,130,246,1)]' : ''
      }`}
      style={{
        borderLeft: `4px solid ${stop.color}`,
      }}
    >
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
                  className="inline-flex min-w-0 items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-semibold"
                  style={brokerBadgeStyle}
                >
                  {stop.type === 'pickup' ? (
                    <ArrowUp className="h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <ArrowDown className="h-3.5 w-3.5 shrink-0" />
                  )}
                  <span className="truncate">{brokerageLabel}</span>
                </span>
              </div>
              
              <div className="flex items-center gap-2" />
            </div>

            <div className="space-y-1 text-xs">
              <div className="flex items-center gap-1 text-gray-500">
                <button
                  type="button"
                  onClick={handleCopyLocation}
                  className="truncate text-left text-xs font-normal leading-4 text-gray-500 hover:text-gray-700"
                  title="Copy location"
                >
                  {locationLine}
                </button>
                {onTranseuAction && (
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      onTranseuAction(stop.id, event.altKey);
                    }}
                    className={`rounded p-0.5 transition-colors ${
                      stop.transeuLink
                        ? 'text-blue-600 hover:bg-blue-50 hover:text-blue-700'
                        : 'text-gray-300 hover:bg-gray-100 hover:text-gray-500'
                    }`}
                    title={
                      stop.transeuLink
                        ? 'Open Transeu link (Alt+Click to edit)'
                        : 'Add Transeu link'
                    }
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1 text-gray-500">
                <span className="text-xs font-normal leading-4 text-gray-500">
                  ETA: {etaDate} {etaTime}
                </span>
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
