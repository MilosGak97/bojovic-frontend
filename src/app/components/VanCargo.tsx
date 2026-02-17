import { useState, useRef } from 'react';
import { useDrop, useDrag } from 'react-dnd';
import { RotateCw, Layers, X } from 'lucide-react';
import type { Load } from './LoadCard';

interface Pallet {
  id: string;
  loadId: string;
  width: number;
  height: number;
  color: string;
  x: number;
  y: number;
  label: string;
  stackable: boolean;
  rotated: boolean;
}

interface VanCargoProps {
  selectedVan: string;
  onVanChange: (van: string) => void;
}

const VAN_LENGTH = 420; // cm
const VAN_WIDTH = 220; // cm
const SCALE = 1.2; // pixels per cm

interface DraggablePalletProps {
  pallet: Pallet;
  onMove: (id: string, x: number, y: number) => void;
  onRotate: (id: string) => void;
  onRemove: (id: string) => void;
}

function DraggablePallet({ pallet, onMove, onRotate, onRemove }: DraggablePalletProps) {
  const ref = useRef<HTMLDivElement>(null);

  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'pallet',
    item: { id: pallet.id, x: pallet.x, y: pallet.y },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }));

  drag(ref);

  return (
    <div
      ref={ref}
      className="absolute cursor-move group"
      style={{
        left: pallet.x * SCALE,
        top: pallet.y * SCALE,
        width: pallet.width * SCALE,
        height: pallet.height * SCALE,
        backgroundColor: pallet.color,
        opacity: isDragging ? 0.5 : 0.85,
      }}
    >
      <div className="absolute inset-0 border-2 border-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-white font-semibold text-xs">
            {pallet.label}
          </div>
          <div className="text-white text-xs opacity-90">
            {pallet.width}×{pallet.height}
          </div>
        </div>
      </div>

      {/* Controls on hover */}
      <div className="absolute -top-8 left-0 right-0 flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRotate(pallet.id);
          }}
          className="p-1 bg-white border border-gray-300 shadow-sm hover:bg-gray-50"
          title="Rotate 90°"
        >
          <RotateCw className="w-3 h-3 text-gray-700" />
        </button>
        {pallet.stackable && (
          <div className="p-1 bg-white border border-gray-300 shadow-sm" title="Stackable">
            <Layers className="w-3 h-3 text-gray-700" />
          </div>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove(pallet.id);
          }}
          className="p-1 bg-white border border-gray-300 shadow-sm hover:bg-red-50"
          title="Remove"
        >
          <X className="w-3 h-3 text-gray-700" />
        </button>
      </div>
    </div>
  );
}

export function VanCargo({ selectedVan, onVanChange }: VanCargoProps) {
  const [pallets, setPallets] = useState<Pallet[]>([]);

  const [{ isOver, canDrop }, drop] = useDrop(() => ({
    accept: ['load', 'pallet'],
    drop: (item: any, monitor) => {
      const offset = monitor.getClientOffset();
      const containerRect = document.getElementById('cargo-container')?.getBoundingClientRect();
      
      if (offset && containerRect) {
        const relativeX = offset.x - containerRect.left;
        const relativeY = offset.y - containerRect.top;
        
        // Convert from pixels to cm
        const x = Math.max(0, Math.min(relativeX / SCALE, VAN_LENGTH - 120));
        const y = Math.max(0, Math.min(relativeY / SCALE, VAN_WIDTH - 80));

        if (item.type === 'load') {
          // Adding new load from pool
          const load = item as Load;
          const newPallet: Pallet = {
            id: `pallet-${Date.now()}`,
            loadId: load.id,
            width: 120,
            height: 80,
            color: load.color,
            x: x,
            y: y,
            label: `${load.originCity.substring(0, 3).toUpperCase()}`,
            stackable: true,
            rotated: false,
          };
          setPallets((prev) => [...prev, newPallet]);
        } else if (item.id) {
          // Moving existing pallet
          movePallet(item.id, x, y);
        }
      }
      return undefined;
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  }));

  const movePallet = (id: string, x: number, y: number) => {
    setPallets((prev) =>
      prev.map((p) => (p.id === id ? { ...p, x, y } : p))
    );
  };

  const rotatePallet = (id: string) => {
    setPallets((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, width: p.height, height: p.width, rotated: !p.rotated }
          : p
      )
    );
  };

  const removePallet = (id: string) => {
    setPallets((prev) => prev.filter((p) => p.id !== id));
  };

  const totalLDM = pallets.reduce((sum, p) => sum + (p.height / 100), 0).toFixed(2);
  const usedSpace = ((pallets.reduce((sum, p) => sum + (p.width * p.height), 0) / (VAN_LENGTH * VAN_WIDTH)) * 100).toFixed(1);
  const totalRevenue = pallets.length * 450; // mock calculation

  return (
    <div className="flex flex-col h-full">
      {/* Controls */}
      <div className="bg-white border-b border-gray-200 p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <select
            value={selectedVan}
            onChange={(e) => onVanChange(e.target.value)}
            className="px-3 py-2 border border-gray-300 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="VAN1">VAN 1</option>
            <option value="VAN2">VAN 2</option>
            <option value="VAN3">VAN 3</option>
          </select>

          <div className="h-8 w-px bg-gray-300" />

          <div className="flex items-center gap-6 text-sm">
            <div>
              <span className="text-gray-500">Weight:</span>
              <span className="ml-2 font-semibold text-gray-900">
                {pallets.length * 400} kg
              </span>
              <span className="text-gray-400 ml-1">/ 1500 kg</span>
            </div>

            <div>
              <span className="text-gray-500">LDM:</span>
              <span className="ml-2 font-semibold text-gray-900">{totalLDM}</span>
              <span className="text-gray-400 ml-1">/ 4.2</span>
            </div>

            <div>
              <span className="text-gray-500">Revenue:</span>
              <span className="ml-2 font-semibold text-green-600">€{totalRevenue}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Space Used:</span>
          <div className="w-32 h-2 bg-gray-200 overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all"
              style={{ width: `${usedSpace}%` }}
            />
          </div>
          <span className="text-sm font-medium text-gray-900">{usedSpace}%</span>
        </div>
      </div>

      {/* Cargo Area */}
      <div className="flex-1 overflow-auto bg-gray-50 p-8">
        <div className="flex items-center justify-center min-h-full">
          <div className="relative">
            {/* Dimensions labels */}
            <div className="absolute -top-6 left-0 right-0 text-center text-xs text-gray-500 font-medium">
              420 cm
            </div>
            <div className="absolute -left-12 top-0 bottom-0 flex items-center">
              <div className="transform -rotate-90 text-xs text-gray-500 font-medium whitespace-nowrap">
                220 cm
              </div>
            </div>

            {/* Van cargo box */}
            <div
              id="cargo-container"
              ref={drop}
              className={`relative bg-white border-2 ${
                isOver && canDrop
                  ? 'border-blue-500 border-dashed'
                  : 'border-gray-300'
              }`}
              style={{
                width: VAN_LENGTH * SCALE,
                height: VAN_WIDTH * SCALE,
              }}
            >
              {/* Grid */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none">
                {/* Vertical lines every 50cm */}
                {Array.from({ length: Math.floor(VAN_LENGTH / 50) }).map((_, i) => (
                  <line
                    key={`v-${i}`}
                    x1={(i + 1) * 50 * SCALE}
                    y1={0}
                    x2={(i + 1) * 50 * SCALE}
                    y2={VAN_WIDTH * SCALE}
                    stroke="#e5e7eb"
                    strokeWidth="1"
                  />
                ))}
                {/* Horizontal lines every 50cm */}
                {Array.from({ length: Math.floor(VAN_WIDTH / 50) }).map((_, i) => (
                  <line
                    key={`h-${i}`}
                    x1={0}
                    y1={(i + 1) * 50 * SCALE}
                    x2={VAN_LENGTH * SCALE}
                    y2={(i + 1) * 50 * SCALE}
                    stroke="#e5e7eb"
                    strokeWidth="1"
                  />
                ))}
              </svg>

              {/* Pallets */}
              {pallets.map((pallet) => (
                <DraggablePallet
                  key={pallet.id}
                  pallet={pallet}
                  onMove={movePallet}
                  onRotate={rotatePallet}
                  onRemove={removePallet}
                />
              ))}

              {/* Drop hint */}
              {isOver && canDrop && pallets.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center text-blue-600 text-sm font-medium pointer-events-none">
                  Drop load here to add to cargo
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}