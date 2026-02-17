import { useState, useRef, ReactNode } from 'react';
import { GripVertical, Maximize2, Minimize2 } from 'lucide-react';

interface CanvasPanelProps {
  title: string;
  children: ReactNode;
  initialX: number;
  initialY: number;
  initialWidth?: number;
  initialHeight?: number;
  onMove: (x: number, y: number) => void;
  scale: number;
}

export function CanvasPanel({
  title,
  children,
  initialX,
  initialY,
  initialWidth = 400,
  initialHeight = 600,
  onMove,
  scale,
}: CanvasPanelProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [position, setPosition] = useState({ x: initialX, y: initialY });
  const panelRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    const rect = panelRef.current?.getBoundingClientRect();
    if (rect) {
      setDragOffset({
        x: (e.clientX - rect.left) / scale,
        y: (e.clientY - rect.top) / scale,
      });
    }
    e.preventDefault();
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;
    
    const newX = (e.clientX / scale) - dragOffset.x;
    const newY = (e.clientY / scale) - dragOffset.y;
    
    setPosition({ x: newX, y: newY });
    onMove(newX, newY);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useState(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  });

  return (
    <div
      ref={panelRef}
      className={`absolute bg-white border-2 border-gray-300 shadow-lg ${
        isDragging ? 'shadow-2xl z-50' : ''
      }`}
      style={{
        left: position.x,
        top: position.y,
        width: initialWidth,
        height: isCollapsed ? 'auto' : initialHeight,
      }}
    >
      <div
        onMouseDown={handleMouseDown}
        className="bg-gray-50 border-b border-gray-300 px-4 py-2 flex items-center justify-between cursor-grab active:cursor-grabbing"
      >
        <div className="flex items-center gap-2">
          <GripVertical className="w-4 h-4 text-gray-400" />
          <h3 className="font-semibold text-sm text-gray-900">{title}</h3>
        </div>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1 hover:bg-gray-200 rounded"
        >
          {isCollapsed ? (
            <Maximize2 className="w-4 h-4 text-gray-600" />
          ) : (
            <Minimize2 className="w-4 h-4 text-gray-600" />
          )}
        </button>
      </div>
      {!isCollapsed && <div className="overflow-auto h-full">{children}</div>}
    </div>
  );
}
