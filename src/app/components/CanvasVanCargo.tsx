import { useState, useRef, useEffect } from 'react';
import { GripVertical, X, RotateCw, Package, Plus, AlertTriangle } from 'lucide-react';

interface CargoItem {
  id: string;
  loadId: string;
  width: number; // in cm
  height: number; // in cm
  color: string;
  x: number; // position in cm
  y: number; // position in cm
  rotated: boolean;
  label: string;
  hasConflict: boolean; // red marking
  isOverflow: boolean; // shown on the side
  stopId?: string; // Which stop this belongs to
}

interface RouteStop {
  id: string;
  number: number;
  city: string;
  loadId: string;
  pallets: number;
  palletDimensions?: Array<{
    width: number;
    height: number;
  }>;
  type: 'pickup' | 'delivery' | 'extra';
  extraAction?: 'pickup' | 'dropoff';
  color: string;
  label: string;
}

interface CanvasVanCargoProps {
  vanId: string;
  x: number;
  y: number;
  onMove: (x: number, y: number) => void;
  scale: number;
  stopNumber?: number;
  routedStops?: RouteStop[];
  onCargoLoadsChange?: (loadIds: string[]) => void; // New callback to report loaded loads
  selectedStopId?: string; // Which stop to show cargo state for
  onStopSelect?: (stopId: string) => void; // Callback when clicking stepper
}

const TRUCK_LENGTH = 403; // cm
const TRUCK_WIDTH = 220; // cm
const EURO_PALLET_LENGTH = 120; // cm
const EURO_PALLET_WIDTH = 80; // cm
const SCALE = 0.8; // visual scale for display
const GRID_SIZE = 10; // 10cm grid

export function CanvasVanCargo({
  vanId,
  x,
  y,
  onMove,
  scale,
  stopNumber,
  routedStops,
  onCargoLoadsChange,
  selectedStopId,
  onStopSelect,
}: CanvasVanCargoProps) {
  const [cargoItems, setCargoItems] = useState<CargoItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showAddCustomPallet, setShowAddCustomPallet] = useState(false);
  const [customPalletWidth, setCustomPalletWidth] = useState(120);
  const [customPalletHeight, setCustomPalletHeight] = useState(80);
  const [draggingCargoId, setDraggingCargoId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [tempPosition, setTempPosition] = useState({ x: 0, y: 0 });
  const [editingDimensionsId, setEditingDimensionsId] = useState<string | null>(null);
  const [editWidth, setEditWidth] = useState(0);
  const [editHeight, setEditHeight] = useState(0);
  const [measurementPoint, setMeasurementPoint] = useState<{ x: number; y: number } | null>(null);
  const [measurementSpaces, setMeasurementSpaces] = useState<{ horizontal: number; vertical: number } | null>(null);
  const dragStartPos = useRef({ x: 0, y: 0, panelX: 0, panelY: 0 });
  const panelRef = useRef<HTMLDivElement>(null);
  const cargoGridRef = useRef<HTMLDivElement>(null);

  // Calculate euro pallet grid
  const palletsInLength = Math.floor(TRUCK_LENGTH / EURO_PALLET_LENGTH);
  const palletsInWidth = Math.floor(TRUCK_WIDTH / EURO_PALLET_WIDTH);
  const leftoverLength = TRUCK_LENGTH - (palletsInLength * EURO_PALLET_LENGTH);
  const leftoverWidth = TRUCK_WIDTH - (palletsInWidth * EURO_PALLET_WIDTH);

  // Check if two cargo items overlap (bounding box collision)
  const checkOverlap = (item1: CargoItem, item2: CargoItem): boolean => {
    if (item1.isOverflow || item2.isOverflow) return false;
    
    return !(
      item1.x + item1.width <= item2.x ||
      item2.x + item2.width <= item1.x ||
      item1.y + item1.height <= item2.y ||
      item2.y + item2.height <= item1.y
    );
  };

  // Check if item overlaps with any existing items
  const hasOverlapWithOthers = (items: CargoItem[], targetItem: CargoItem, excludeId?: string): boolean => {
    return items.some((item) => {
      if (item.id === excludeId || item.id === targetItem.id) return false;
      return checkOverlap(item, targetItem);
    });
  };

  const orderedRoutedStops = [...(routedStops ?? [])].sort((a, b) => a.number - b.number);
  const routedStopsSignature = orderedRoutedStops
    .map((stop) => {
      const palletSignature = (stop.palletDimensions ?? [])
        .map((pallet) => `${pallet.width}x${pallet.height}`)
        .join(',');
      return `${stop.id}:${stop.number}:${stop.type}:${stop.loadId}:${stop.pallets}:${stop.color}:${stop.label}:${palletSignature}`;
    })
    .join('|');

  const getPickupPlan = () => {
    const pickupTotals = new Map<
      string,
      { pallets: Array<{ width: number; height: number }>; color: string; label: string }
    >();

    orderedRoutedStops.forEach((stop) => {
      const isPickupLike =
        stop.type === 'pickup' || (stop.type === 'extra' && stop.extraAction === 'pickup');
      if (!isPickupLike) return;

      const stopPallets =
        stop.palletDimensions && stop.palletDimensions.length > 0
          ? stop.palletDimensions
          : Array.from({ length: Math.max(0, stop.pallets) }, () => ({
              width: EURO_PALLET_LENGTH,
              height: EURO_PALLET_WIDTH,
            }));

      const existing = pickupTotals.get(stop.loadId);
      if (existing) {
        pickupTotals.set(stop.loadId, {
          ...existing,
          pallets: [...existing.pallets, ...stopPallets],
        });
      } else {
        pickupTotals.set(stop.loadId, {
          pallets: [...stopPallets],
          color: stop.color,
          label: stop.label,
        });
      }
    });

    return pickupTotals;
  };

  // Keep base cargo list aligned with route pickup definitions.
  useEffect(() => {
    if (!orderedRoutedStops.length) {
      setCargoItems((prev) => prev.filter((item) => item.loadId === 'CUSTOM'));
      return;
    }

    const pickupPlan = getPickupPlan();

    setCargoItems((prev) => {
      const next = prev.filter(
        (item) => item.loadId === 'CUSTOM' || pickupPlan.has(item.loadId),
      );

      pickupPlan.forEach((plan, loadId) => {
        const loadItemIndexes = next
          .map((item, index) => ({ item, index }))
          .filter(({ item }) => item.loadId === loadId)
          .map(({ index }) => index);

        loadItemIndexes.forEach((index, palletIndex) => {
          if (palletIndex >= plan.pallets.length) return;
          const targetPallet = plan.pallets[palletIndex];
          const currentItem = next[index];

          if (
            currentItem.width !== targetPallet.width ||
            currentItem.height !== targetPallet.height ||
            currentItem.color !== plan.color ||
            currentItem.label !== plan.label
          ) {
            next[index] = {
              ...currentItem,
              width: targetPallet.width,
              height: targetPallet.height,
              color: plan.color,
              label: plan.label,
            };
          }
        });

        const excess = loadItemIndexes.length - plan.pallets.length;

        if (excess > 0) {
          let toRemove = excess;
          for (let i = loadItemIndexes.length - 1; i >= 0 && toRemove > 0; i -= 1) {
            const removeIndex = loadItemIndexes[i];
            next.splice(removeIndex, 1);
            toRemove -= 1;
          }
        }
      });

      return next;
    });
  }, [routedStopsSignature]);

  // Add missing pallets for newly planned pickup stops.
  useEffect(() => {
    if (!orderedRoutedStops.length) return;

    const pickupPlan = getPickupPlan();
    const existingCounts = new Map<string, number>();
    cargoItems.forEach((item) => {
      if (item.loadId === 'CUSTOM') return;
      existingCounts.set(item.loadId, (existingCounts.get(item.loadId) ?? 0) + 1);
    });

    const itemsToAdd: CargoItem[] = [];
    pickupPlan.forEach((plan, loadId) => {
      const existing = existingCounts.get(loadId) ?? 0;
      const missing = plan.pallets.length - existing;

      for (let i = 0; i < missing; i += 1) {
        const targetPallet = plan.pallets[existing + i] ?? {
          width: EURO_PALLET_LENGTH,
          height: EURO_PALLET_WIDTH,
        };

        itemsToAdd.push({
          id: `auto-${loadId}-${Date.now()}-${i}-${Math.random()}`,
          loadId,
          width: targetPallet.width,
          height: targetPallet.height,
          color: plan.color,
          x: 0,
          y: 0,
          rotated: false,
          label: plan.label,
          hasConflict: false,
          isOverflow: false,
        });
      }
    });

    if (itemsToAdd.length > 0) {
      placeItemsWithConflictDetection(itemsToAdd);
    }
  }, [routedStopsSignature, cargoItems]);

  const placeItemsWithConflictDetection = (itemsToAdd: CargoItem[]) => {
    setCargoItems((prev) => {
      const newItems = [...prev];
      
      itemsToAdd.forEach((item) => {
        let placed = false;
        
        // Try to find a free spot (more efficient packing - left to right, top to bottom)
        // Use smaller increment for tighter packing
        const packingIncrement = 10; // 10cm for tighter packing
        
        for (let gridY = 0; gridY <= TRUCK_WIDTH - item.height && !placed; gridY += packingIncrement) {
          for (let gridX = 0; gridX <= TRUCK_LENGTH - item.width && !placed; gridX += packingIncrement) {
            const testItem = { ...item, x: gridX, y: gridY };
            
            if (!hasOverlapWithOthers(newItems, testItem)) {
              item.x = gridX;
              item.y = gridY;
              item.hasConflict = false;
              item.isOverflow = false;
              placed = true;
              newItems.push(item);
            }
          }
        }
        
        // If not placed, try rotated
        if (!placed) {
          const rotatedWidth = item.height;
          const rotatedHeight = item.width;
          
          for (let gridY = 0; gridY <= TRUCK_WIDTH - rotatedHeight && !placed; gridY += packingIncrement) {
            for (let gridX = 0; gridX <= TRUCK_LENGTH - rotatedWidth && !placed; gridX += packingIncrement) {
              const testItem = { ...item, x: gridX, y: gridY, width: rotatedWidth, height: rotatedHeight };
              
              if (!hasOverlapWithOthers(newItems, testItem)) {
                item.x = gridX;
                item.y = gridY;
                item.width = rotatedWidth;
                item.height = rotatedHeight;
                item.rotated = true;
                item.hasConflict = true; // Mark as conflict (rotated to fit)
                item.isOverflow = false;
                placed = true;
                newItems.push(item);
              }
            }
          }
        }
        
        // If still not placed, mark as overflow
        if (!placed) {
          item.x = 0;
          item.y = 0;
          item.hasConflict = true;
          item.isOverflow = true;
          newItems.push(item);
        }
      });
      
      return newItems;
    });
  };

  const addCustomPallet = () => {
    const newItem: CargoItem = {
      id: `custom-${Date.now()}`,
      loadId: 'CUSTOM',
      width: customPalletWidth,
      height: customPalletHeight,
      color: '#6B7280',
      x: 0,
      y: 0,
      rotated: false,
      label: 'Custom',
      hasConflict: false,
      isOverflow: false,
    };
    
    placeItemsWithConflictDetection([newItem]);
    setShowAddCustomPallet(false);
  };

  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStartPos.current = {
      x: e.clientX,
      y: e.clientY,
      panelX: x,
      panelY: y,
    };
    e.stopPropagation();
    e.preventDefault();
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      
      const deltaX = (e.clientX - dragStartPos.current.x) / scale;
      const deltaY = (e.clientY - dragStartPos.current.y) / scale;
      
      const newX = dragStartPos.current.panelX + deltaX;
      const newY = dragStartPos.current.panelY + deltaY;
      
      onMove(newX, newY);
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
  }, [isDragging, x, y, scale, onMove]);

  // Clear measurement on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMeasurementPoint(null);
        setMeasurementSpaces(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Handle grid click for measurement
  const handleGridClick = (e: React.MouseEvent) => {
    // Only measure if ALT key is held
    if (!e.altKey) return;
    
    // Don't measure if clicking on a cargo item
    if ((e.target as HTMLElement).closest('.cargo-item')) {
      return;
    }

    const gridRect = cargoGridRef.current?.getBoundingClientRect();
    if (!gridRect) return;

    // Get click position relative to the grid
    const clickX = e.clientX - gridRect.left;
    const clickY = e.clientY - gridRect.top;

    // Convert from pixels to cm (accounting for SCALE)
    const xCm = clickX / SCALE;
    const yCm = clickY / SCALE;

    // Snap to nearest grid point (10cm)
    const snappedX = Math.round(xCm / GRID_SIZE) * GRID_SIZE;
    const snappedY = Math.round(yCm / GRID_SIZE) * GRID_SIZE;

    // Clamp to valid positions
    const clampedX = Math.max(0, Math.min(TRUCK_LENGTH, snappedX));
    const clampedY = Math.max(0, Math.min(TRUCK_WIDTH, snappedY));

    // Set measurement point
    setMeasurementPoint({ x: clampedX, y: clampedY });

    // Calculate available space in both directions
    // Horizontal: Find nearest obstacle to the left and right
    let leftDistance = clampedX; // Distance to left edge
    let rightDistance = TRUCK_LENGTH - clampedX; // Distance to right edge

    // Check all cargo items for horizontal obstacles
    for (const item of cargoInGrid) {
      // Check if item blocks horizontally (overlaps vertically with our point)
      if (clampedY >= item.y && clampedY < item.y + item.height) {
        // Item is in the same horizontal band
        if (item.x + item.width <= clampedX && clampedX - (item.x + item.width) < leftDistance) {
          // Item is to the left
          leftDistance = clampedX - (item.x + item.width);
        }
        if (item.x >= clampedX && item.x - clampedX < rightDistance) {
          // Item is to the right
          rightDistance = item.x - clampedX;
        }
      }
    }

    const horizontalSpace = leftDistance + rightDistance;

    // Vertical: Find nearest obstacle to the top and bottom
    let topDistance = clampedY; // Distance to top edge
    let bottomDistance = TRUCK_WIDTH - clampedY; // Distance to bottom edge

    // Check all cargo items for vertical obstacles
    for (const item of cargoInGrid) {
      // Check if item blocks vertically (overlaps horizontally with our point)
      if (clampedX >= item.x && clampedX < item.x + item.width) {
        // Item is in the same vertical band
        if (item.y + item.height <= clampedY && clampedY - (item.y + item.height) < topDistance) {
          // Item is above
          topDistance = clampedY - (item.y + item.height);
        }
        if (item.y >= clampedY && item.y - clampedY < bottomDistance) {
          // Item is below
          bottomDistance = item.y - clampedY;
        }
      }
    }

    const verticalSpace = topDistance + bottomDistance;

    setMeasurementSpaces({
      horizontal: horizontalSpace,
      vertical: verticalSpace,
    });
  };

  const rotateCargo = (id: string) => {
    setCargoItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const newWidth = item.height;
          const newHeight = item.width;
          const rotatedItem = {
            ...item,
            width: newWidth,
            height: newHeight,
            rotated: !item.rotated,
          };
          
          // Check for conflicts after rotation
          const hasConflict = hasOverlapWithOthers(prev, rotatedItem, id);
          return { ...rotatedItem, hasConflict };
        }
        return item;
      })
    );
  };

  const removeCargo = (id: string) => {
    setCargoItems((prev) => prev.filter((item) => item.id !== id));
  };

  const removeAllCargoFromLoad = (loadId: string) => {
    setCargoItems((prev) => prev.filter((item) => item.loadId !== loadId));
  };

  // Dimensions editing
  const startEditDimensions = (item: CargoItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingDimensionsId(item.id);
    setEditWidth(item.width);
    setEditHeight(item.height);
  };

  const saveDimensions = () => {
    if (!editingDimensionsId) return;
    
    setCargoItems((prev) =>
      prev.map((item) => {
        if (item.id === editingDimensionsId) {
          const updatedItem = { ...item, width: editWidth, height: editHeight };
          const hasConflict = hasOverlapWithOthers(prev, updatedItem, editingDimensionsId);
          return { ...updatedItem, hasConflict };
        }
        return item;
      })
    );
    setEditingDimensionsId(null);
  };

  // Cargo item drag handlers
  const handleCargoMouseDown = (e: React.MouseEvent, item: CargoItem) => {
    if (item.isOverflow) return; // Can't drag overflow items
    
    e.stopPropagation();
    e.preventDefault();
    
    const gridRect = cargoGridRef.current?.getBoundingClientRect();
    if (!gridRect) return;
    
    setDraggingCargoId(item.id);
    
    const itemLeft = item.x * SCALE;
    const itemTop = item.y * SCALE;
    
    setDragOffset({
      x: e.clientX - gridRect.left - itemLeft,
      y: e.clientY - gridRect.top - itemTop,
    });
    
    setTempPosition({
      x: itemLeft,
      y: itemTop,
    });
  };

  useEffect(() => {
    if (!draggingCargoId) return;

    const handleMouseMove = (e: MouseEvent) => {
      const gridRect = cargoGridRef.current?.getBoundingClientRect();
      if (!gridRect) return;

      const x = e.clientX - gridRect.left - dragOffset.x;
      const y = e.clientY - gridRect.top - dragOffset.y;

      setTempPosition({ x, y });
    };

    const handleMouseUp = () => {
      // Convert pixel position back to cm
      const xCm = tempPosition.x / SCALE;
      const yCm = tempPosition.y / SCALE;

      const draggingItem = cargoItems.find(item => item.id === draggingCargoId);
      if (!draggingItem) {
        setDraggingCargoId(null);
        return;
      }

      // Clamp to valid positions (keep item within bounds)
      let clampedX = Math.max(0, Math.min(TRUCK_LENGTH - draggingItem.width, xCm));
      let clampedY = Math.max(0, Math.min(TRUCK_WIDTH - draggingItem.height, yCm));

      // Create test item at new position
      let testItem = { ...draggingItem, x: clampedX, y: clampedY };

      // Check if new position overlaps with other items
      let hasConflict = hasOverlapWithOthers(cargoItems, testItem, draggingCargoId);

      // If there's a conflict, find the nearest available spot
      if (hasConflict) {
        let placed = false;
        let bestDistance = Infinity;
        let bestX = clampedX;
        let bestY = clampedY;

        // Search for available spots, starting from positions close to the attempted drop
        // Use a grid-based search expanding outward from the attempted position
        const searchRadius = Math.max(TRUCK_LENGTH, TRUCK_WIDTH);
        
        for (let radius = 0; radius <= searchRadius && !placed; radius += GRID_SIZE) {
          // Check positions in a spiral/expanding pattern around the target
          const positions: Array<{x: number, y: number}> = [];
          
          // Generate positions at this radius
          for (let gridY = 0; gridY < TRUCK_WIDTH - draggingItem.height; gridY += GRID_SIZE) {
            for (let gridX = 0; gridX < TRUCK_LENGTH - draggingItem.width; gridX += GRID_SIZE) {
              const distance = Math.sqrt(
                Math.pow(gridX - clampedX, 2) + Math.pow(gridY - clampedY, 2)
              );
              
              if (distance >= radius && distance < radius + GRID_SIZE) {
                positions.push({ x: gridX, y: gridY });
              }
            }
          }
          
          // Sort positions by distance to attempted drop point
          positions.sort((a, b) => {
            const distA = Math.sqrt(Math.pow(a.x - clampedX, 2) + Math.pow(a.y - clampedY, 2));
            const distB = Math.sqrt(Math.pow(b.x - clampedX, 2) + Math.pow(b.y - clampedY, 2));
            return distA - distB;
          });
          
          // Try each position
          for (const pos of positions) {
            const testPosition = { ...draggingItem, x: pos.x, y: pos.y };
            
            if (!hasOverlapWithOthers(cargoItems, testPosition, draggingCargoId)) {
              const distance = Math.sqrt(
                Math.pow(pos.x - clampedX, 2) + Math.pow(pos.y - clampedY, 2)
              );
              
              if (distance < bestDistance) {
                bestDistance = distance;
                bestX = pos.x;
                bestY = pos.y;
                placed = true;
                break;
              }
            }
          }
          
          if (placed) break;
        }
        
        clampedX = bestX;
        clampedY = bestY;
        testItem = { ...draggingItem, x: clampedX, y: clampedY };
        hasConflict = hasOverlapWithOthers(cargoItems, testItem, draggingCargoId);
      }

      setCargoItems((prev) =>
        prev.map((item) => {
          if (item.id === draggingCargoId) {
            return {
              ...item,
              x: clampedX,
              y: clampedY,
              hasConflict,
            };
          }
          return item;
        })
      );

      setDraggingCargoId(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingCargoId, dragOffset, tempPosition, cargoItems]);

  const effectiveSelectedStopId =
    selectedStopId && orderedRoutedStops.some((stop) => stop.id === selectedStopId)
      ? selectedStopId
      : orderedRoutedStops.length > 0
        ? orderedRoutedStops[0].id
        : undefined;

  useEffect(() => {
    if (!onStopSelect || !effectiveSelectedStopId) return;
    if (selectedStopId !== effectiveSelectedStopId) {
      onStopSelect(effectiveSelectedStopId);
    }
  }, [effectiveSelectedStopId, onStopSelect, selectedStopId]);

  const selectedStopIndex = effectiveSelectedStopId
    ? orderedRoutedStops.findIndex((stop) => stop.id === effectiveSelectedStopId)
    : -1;

  const palletsAfterSelectedStop = new Map<string, number>();
  const stopsToApply =
    selectedStopIndex >= 0 ? orderedRoutedStops.slice(0, selectedStopIndex + 1) : [];

  stopsToApply.forEach((stop) => {
    const currentCount = palletsAfterSelectedStop.get(stop.loadId) ?? 0;
    const palletDelta =
      stop.type === 'pickup'
        ? stop.pallets
        : stop.type === 'delivery'
          ? -stop.pallets
          : stop.extraAction === 'pickup'
            ? stop.pallets
            : -stop.pallets;
    const nextCount = Math.max(0, currentCount + palletDelta);
    palletsAfterSelectedStop.set(stop.loadId, nextCount);
  });

  const shownPerLoad = new Map<string, number>();
  const visibleCargoItems = cargoItems.filter((item) => {
    if (item.loadId === 'CUSTOM') return true;

    const allowedCount = palletsAfterSelectedStop.get(item.loadId) ?? 0;
    if (allowedCount <= 0) return false;

    const currentlyShown = shownPerLoad.get(item.loadId) ?? 0;
    if (currentlyShown >= allowedCount) return false;

    shownPerLoad.set(item.loadId, currentlyShown + 1);
    return true;
  });

  const cargoInGrid = visibleCargoItems.filter((item) => !item.isOverflow);
  const cargoOverflow = visibleCargoItems.filter((item) => item.isOverflow);
  const totalWeight = cargoInGrid.length * 400; // mock
  const totalLDM = (
    cargoInGrid.reduce((sum, item) => sum + item.height, 0) / 100
  ).toFixed(1);
  const usedPalletSlots = cargoInGrid.length;
  const overflowCount = cargoOverflow.length;

  // Get unique loads in visible cargo snapshot
  const loadsInCargo = Array.from(
    new Set(visibleCargoItems.map((item) => item.loadId))
  ).map((loadId) => {
    const items = visibleCargoItems.filter((item) => item.loadId === loadId);
    const loadedItems = items.filter((item) => !item.isOverflow);
    const overflowItems = items.filter((item) => item.isOverflow);
    return {
      loadId,
      palletCount: items.length,
      loadedCount: loadedItems.length,
      overflowCount: overflowItems.length,
      color: items[0].color,
      label: items[0].label,
    };
  });

  // Notify parent of loaded loads whenever cargoItems changes
  useEffect(() => {
    if (onCargoLoadsChange) {
      const uniqueLoadIds = Array.from(new Set(cargoItems.map((item) => item.loadId))).filter(
        (loadId) => loadId !== 'CUSTOM',
      );
      onCargoLoadsChange(uniqueLoadIds);
    }
  }, [cargoItems, onCargoLoadsChange]);

  // Calculate remaining horizontal space along top and bottom edges
  const calculateRemainingSpace = () => {
    if (cargoInGrid.length === 0) {
      return { topSpace: TRUCK_LENGTH, bottomSpace: TRUCK_LENGTH };
    }

    // Define top zone (top 20% of truck height) and bottom zone (bottom 20% of truck height)
    const topZoneHeight = TRUCK_WIDTH * 0.3; // Top 30%
    const bottomZoneStart = TRUCK_WIDTH * 0.7; // Bottom 30%

    // Find rightmost point in the top zone
    let topRightmost = 0;
    for (const item of cargoInGrid) {
      // Check if item is in the top zone
      if (item.y < topZoneHeight) {
        const rightEdge = item.x + item.width;
        if (rightEdge > topRightmost) {
          topRightmost = rightEdge;
        }
      }
    }
    const topSpace = Math.max(0, TRUCK_LENGTH - topRightmost);

    // Find rightmost point in the bottom zone
    let bottomRightmost = 0;
    for (const item of cargoInGrid) {
      // Check if item is in the bottom zone
      if (item.y + item.height > bottomZoneStart) {
        const rightEdge = item.x + item.width;
        if (rightEdge > bottomRightmost) {
          bottomRightmost = rightEdge;
        }
      }
    }
    const bottomSpace = Math.max(0, TRUCK_LENGTH - bottomRightmost);

    return { topSpace, bottomSpace };
  };

  const { topSpace, bottomSpace } = calculateRemainingSpace();

  return (
    <div
      ref={panelRef}
      className={`absolute bg-white border-2 border-gray-300 shadow-lg ${
        isDragging ? 'shadow-2xl z-50' : ''
      }`}
      style={{
        left: x,
        top: y,
        width: 750,
        userSelect: 'none',
      }}
    >
      {/* Header */}
      <div
        onMouseDown={handleHeaderMouseDown}
        className="bg-gray-50 border-b border-gray-300 px-4 py-2 flex items-center justify-between cursor-grab active:cursor-grabbing"
      >
        <div className="flex items-center gap-2">
          <GripVertical className="w-4 h-4 text-gray-400" />
          
          {/* Stop Stepper */}
          {orderedRoutedStops.length > 0 && (
            <div className="flex items-center gap-1 ml-2">
              {orderedRoutedStops.map((stop, idx) => {
                const stopTypeLabel =
                  stop.type === 'pickup'
                    ? 'pickup'
                    : stop.type === 'delivery'
                      ? 'delivery'
                      : stop.extraAction === 'pickup'
                        ? 'extra pickup'
                        : 'extra dropoff';

                return (
                <div key={stop.id} className="flex items-center">
                  {/* Stop number - visual only, using sequential index */}
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold bg-gray-100 text-gray-500 border border-gray-200"
                    title={`Stop ${idx + 1}: ${stopTypeLabel} at ${stop.city}`}
                  >
                    {idx + 1}
                  </div>
                  {/* Clickable dot separator - shows cargo state AFTER this stop */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onStopSelect) {
                        onStopSelect(stop.id);
                      }
                    }}
                    className={`w-3 h-3 rounded-full mx-1 transition-all ${
                      effectiveSelectedStopId === stop.id
                        ? 'bg-blue-600 shadow-md scale-125 ring-2 ring-blue-200'
                        : 'bg-gray-300 hover:bg-blue-400 hover:scale-110'
                    }`}
                    title={`View cargo after Stop ${idx + 1} (${stopTypeLabel} at ${stop.city})`}
                  />
                </div>
              )})}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddCustomPallet(!showAddCustomPallet)}
            className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs flex items-center gap-1"
            title="Add custom pallet"
          >
            <Plus className="w-3 h-3" />
            <span>Custom</span>
          </button>
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 hover:bg-gray-200"
          >
            {isCollapsed ? (
              <Package className="w-4 h-4 text-gray-600" />
            ) : (
              <X className="w-4 h-4 text-gray-600" />
            )}
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <>
          {/* Stats Bar */}
          <div className="px-4 py-3 bg-white border-b border-gray-200 flex items-center justify-between text-xs">
            <div className="flex items-center gap-4">
              <div>
                <span className="text-gray-500">Weight:</span>
                <span className="ml-1 font-semibold text-gray-900">{totalWeight} kg</span>
                <span className="text-gray-400 ml-1">/ 1500 kg</span>
              </div>
              <div>
                <span className="text-gray-500">LDM:</span>
                <span className="ml-1 font-semibold text-gray-900">{totalLDM}</span>
                <span className="text-gray-400 ml-1">/ 4.2</span>
              </div>
              <div>
                <span className="text-gray-500">Pallets:</span>
                <span className="ml-1 font-semibold text-gray-900">{usedPalletSlots}</span>
                <span className="text-gray-400 ml-1">/ {palletsInLength * palletsInWidth}</span>
              </div>
              {overflowCount > 0 && (
                <div className="flex items-center gap-1 text-red-600">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span className="font-semibold">{overflowCount} overflow</span>
                </div>
              )}
            </div>
          </div>

          {/* Custom Pallet Input */}
          {showAddCustomPallet && (
            <div className="px-4 py-3 bg-blue-50 border-b border-blue-200">
              <div className="flex items-center gap-3 text-xs">
                <label className="flex items-center gap-1">
                  <span className="text-gray-700">Width (cm):</span>
                  <input
                    type="number"
                    value={customPalletWidth}
                    onChange={(e) => setCustomPalletWidth(Number(e.target.value))}
                    className="w-16 px-2 py-1 border border-gray-300"
                    min="10"
                    max="200"
                  />
                </label>
                <label className="flex items-center gap-1">
                  <span className="text-gray-700">Height (cm):</span>
                  <input
                    type="number"
                    value={customPalletHeight}
                    onChange={(e) => setCustomPalletHeight(Number(e.target.value))}
                    className="w-16 px-2 py-1 border border-gray-300"
                    min="10"
                    max="200"
                  />
                </label>
                <button
                  onClick={addCustomPallet}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Add
                </button>
                <button
                  onClick={() => setShowAddCustomPallet(false)}
                  className="px-3 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Cargo Area */}
          <div className="p-6 bg-gray-50 flex gap-4">
            <div className="relative flex-1">
              {/* Top margin - Space from top edge to topmost pallet */}
              <div 
                className="absolute -top-7 flex items-center justify-center px-1"
                style={{
                  left: 0,
                  width: TRUCK_LENGTH * SCALE,
                }}
              >
                <div className="text-xs text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded">
                  ↑ {topSpace} cm free ↑
                </div>
              </div>

              {/* Left side - Truck dimensions */}
              <div className="absolute -left-16 top-0 bottom-0 flex items-center">
                <div className="transform -rotate-90 text-xs text-gray-700 font-bold whitespace-nowrap bg-gray-100 px-2 py-1 rounded">
                  {TRUCK_LENGTH} × {TRUCK_WIDTH} cm
                </div>
              </div>

              {/* Truck bed with grid */}
              <div
                ref={cargoGridRef}
                className="relative bg-white border-2 border-gray-400"
                style={{
                  width: TRUCK_LENGTH * SCALE,
                  height: TRUCK_WIDTH * SCALE,
                  backgroundImage: `
                    linear-gradient(to right, #e5e7eb 1px, transparent 1px),
                    linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)
                  `,
                  backgroundSize: `${GRID_SIZE * SCALE}px ${GRID_SIZE * SCALE}px`,
                }}
                onClick={handleGridClick}
              >
                {/* Dimension Edit Modal - Fixed position above cargo grid */}
                {editingDimensionsId && (() => {
                  const editingItem = cargoInGrid.find(i => i.id === editingDimensionsId);
                  if (!editingItem) return null;
                  
                  const itemCenterX = (editingItem.x + editingItem.width / 2) * SCALE;
                  const itemTopY = editingItem.y * SCALE;
                  
                  return (
                    <div
                      className="absolute z-[100] pointer-events-auto"
                      style={{
                        left: itemCenterX,
                        top: itemTopY - 70,
                        transform: 'translateX(-50%)',
                      }}
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      <div className="bg-white border-2 border-blue-500 shadow-xl rounded-lg p-3">
                        <div className="text-xs font-semibold text-gray-700 mb-2 text-center">
                          Edit Dimensions
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex flex-col gap-1">
                            <label className="text-xs text-gray-600">Width</label>
                            <input
                              type="number"
                              value={editWidth}
                              onChange={(e) => setEditWidth(Number(e.target.value))}
                              className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                              placeholder="W"
                              min="10"
                              autoFocus
                            />
                          </div>
                          <div className="text-gray-400 mt-5">×</div>
                          <div className="flex flex-col gap-1">
                            <label className="text-xs text-gray-600">Height</label>
                            <input
                              type="number"
                              value={editHeight}
                              onChange={(e) => setEditHeight(Number(e.target.value))}
                              className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                              placeholder="H"
                              min="10"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={saveDimensions}
                            className="flex-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded font-medium"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingDimensionsId(null)}
                            className="flex-1 px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs rounded font-medium"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                      {/* Arrow pointing down to the pallet */}
                      <div 
                        className="absolute left-1/2 -bottom-2 w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-blue-500"
                        style={{ transform: 'translateX(-50%)' }}
                      />
                    </div>
                  );
                })()}

                {/* Cargo items in grid */}
                {cargoInGrid.map((item) => {
                  const isDraggingThis = draggingCargoId === item.id;
                  const isEditing = editingDimensionsId === item.id;
                  const left = isDraggingThis ? tempPosition.x : item.x * SCALE;
                  const top = isDraggingThis ? tempPosition.y : item.y * SCALE;
                  
                  return (
                    <div
                      key={item.id}
                      className={`absolute group cargo-item ${item.hasConflict ? 'ring-2 ring-red-500' : ''} ${
                        isEditing ? 'ring-4 ring-blue-500' : ''
                      } ${isDraggingThis ? 'cursor-grabbing z-50 opacity-70' : 'cursor-grab'}`}
                      style={{
                        left,
                        top,
                        width: item.width * SCALE,
                        height: item.height * SCALE,
                        backgroundColor: item.color,
                        opacity: isDraggingThis ? 0.7 : 0.85,
                        border: '2px solid white',
                        transition: isDraggingThis ? 'none' : 'all 0.15s ease',
                      }}
                      onMouseDown={(e) => {
                        // Don't drag if clicking on a button
                        if ((e.target as HTMLElement).closest('button')) {
                          return;
                        }
                        handleCargoMouseDown(e, item);
                      }}
                    >
                      {/* Main Content */}
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="text-center">
                          <div className="text-white font-semibold text-xs">
                            {item.label}
                          </div>
                          <button
                            className="text-white text-xs opacity-90 hover:opacity-100 hover:underline cursor-pointer pointer-events-auto"
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              startEditDimensions(item, e);
                            }}
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                            }}
                            title="Click to edit dimensions"
                          >
                            {item.width}×{item.height}
                          </button>
                          {item.hasConflict && (
                            <div className="text-red-200 text-xs font-bold">⚠️</div>
                          )}
                        </div>
                      </div>

                      {/* Internal Controls - Always visible on hover */}
                      {!isDraggingThis && !isEditing && (
                        <div className="absolute inset-0 pointer-events-none">
                          {/* Top-right corner - Rotate button */}
                          <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto flex gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                rotateCargo(item.id);
                              }}
                              className="p-1 bg-white bg-opacity-90 border border-gray-300 shadow-sm hover:bg-opacity-100"
                              title="Rotate"
                            >
                              <RotateCw className="w-3.5 h-3.5 text-gray-700" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                // Move to overflow
                                setCargoItems((prev) =>
                                  prev.map((ci) => {
                                    if (ci.id === item.id) {
                                      return { ...ci, isOverflow: true, hasConflict: true };
                                    }
                                    return ci;
                                  })
                                );
                              }}
                              className="p-1 bg-white bg-opacity-90 border border-red-300 shadow-sm hover:bg-red-50"
                              title="Move to overflow"
                            >
                              <svg className="w-3.5 h-3.5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Measurement tool visualization */}
                {measurementPoint && measurementSpaces && (
                  <>
                    {/* Center point dot */}
                    <div
                      className="absolute w-4 h-4 bg-orange-500 rounded-full border-2 border-white shadow-lg pointer-events-none z-50"
                      style={{
                        left: measurementPoint.x * SCALE - 8,
                        top: measurementPoint.y * SCALE - 8,
                      }}
                    />
                    
                    {/* Horizontal measurement */}
                    {measurementSpaces.horizontal > 0 && (
                      <>
                        {/* Horizontal line */}
                        <div
                          className="absolute bg-blue-500 pointer-events-none z-50"
                          style={{
                            left: 0,
                            top: measurementPoint.y * SCALE - 1,
                            width: TRUCK_LENGTH * SCALE,
                            height: '2px',
                            opacity: 0.4,
                          }}
                        />
                        {/* Horizontal distance label */}
                        <div
                          className="absolute bg-blue-600 text-white px-3 py-1.5 rounded shadow-xl text-sm font-bold pointer-events-none z-50 whitespace-nowrap"
                          style={{
                            left: measurementPoint.x * SCALE,
                            top: measurementPoint.y * SCALE - 35,
                            transform: 'translateX(-50%)',
                          }}
                        >
                          ← {measurementSpaces.horizontal} cm →
                        </div>
                      </>
                    )}
                    
                    {/* Vertical measurement */}
                    {measurementSpaces.vertical > 0 && (
                      <>
                        {/* Vertical line */}
                        <div
                          className="absolute bg-green-500 pointer-events-none z-50"
                          style={{
                            left: measurementPoint.x * SCALE - 1,
                            top: 0,
                            width: '2px',
                            height: TRUCK_WIDTH * SCALE,
                            opacity: 0.4,
                          }}
                        />
                        {/* Vertical distance label */}
                        <div
                          className="absolute bg-green-600 text-white px-3 py-1.5 rounded shadow-xl text-sm font-bold pointer-events-none z-50 whitespace-nowrap"
                          style={{
                            left: measurementPoint.x * SCALE + 35,
                            top: measurementPoint.y * SCALE,
                            transform: 'translateY(-50%)',
                          }}
                        >
                          ↕ {measurementSpaces.vertical} cm
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>

              {/* Leftover info */}
              {leftoverLength > 0 && (
                null
              )}

              {/* Bottom margin - Space remaining from bottom edge */}
              <div 
                className="mt-3 flex items-center justify-center"
                style={{
                  width: TRUCK_LENGTH * SCALE,
                }}
              >
                <div className="text-xs text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded">
                  ↓ {bottomSpace} cm free ↓
                </div>
              </div>
            </div>

            {/* Overflow Area (on the side) */}
            {cargoOverflow.length > 0 && (
              <div className="w-32 border-2 border-red-300 bg-red-50">
                <div className="bg-red-100 border-b border-red-300 px-2 py-1 text-xs font-semibold text-red-700 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  <span>Overflow</span>
                </div>
                <div className="p-2 space-y-2">
                  {cargoOverflow.map((item) => (
                    <div
                      key={item.id}
                      className="relative group border-2 border-red-400"
                      style={{
                        width: item.width * 0.4,
                        height: item.height * 0.4,
                        backgroundColor: item.color,
                        opacity: 0.9,
                      }}
                    >
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-white text-xs font-semibold text-center">
                          {item.label}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          // Move item from overflow back to cargo grid
                          setCargoItems((prev) => {
                            const itemToMove = prev.find(ci => ci.id === item.id);
                            if (!itemToMove) return prev;
                            
                            // Remove the item first
                            const withoutItem = prev.filter(ci => ci.id !== item.id);
                            
                            // Now try to place it
                            const newItem = { ...itemToMove, isOverflow: false, x: 0, y: 0, hasConflict: false };
                            let placed = false;
                            const packingIncrement = 10;
                            
                            // Try to find a free spot
                            for (let gridY = 0; gridY <= TRUCK_WIDTH - newItem.height && !placed; gridY += packingIncrement) {
                              for (let gridX = 0; gridX <= TRUCK_LENGTH - newItem.width && !placed; gridX += packingIncrement) {
                                const testItem = { ...newItem, x: gridX, y: gridY };
                                
                                if (!hasOverlapWithOthers(withoutItem, testItem)) {
                                  newItem.x = gridX;
                                  newItem.y = gridY;
                                  newItem.hasConflict = false;
                                  newItem.isOverflow = false;
                                  placed = true;
                                }
                              }
                            }
                            
                            // If not placed, try rotated
                            if (!placed) {
                              const rotatedWidth = newItem.height;
                              const rotatedHeight = newItem.width;
                              
                              for (let gridY = 0; gridY <= TRUCK_WIDTH - rotatedHeight && !placed; gridY += packingIncrement) {
                                for (let gridX = 0; gridX <= TRUCK_LENGTH - rotatedWidth && !placed; gridX += packingIncrement) {
                                  const testItem = { ...newItem, x: gridX, y: gridY, width: rotatedWidth, height: rotatedHeight };
                                  
                                  if (!hasOverlapWithOthers(withoutItem, testItem)) {
                                    newItem.x = gridX;
                                    newItem.y = gridY;
                                    newItem.width = rotatedWidth;
                                    newItem.height = rotatedHeight;
                                    newItem.rotated = !newItem.rotated;
                                    newItem.hasConflict = false;
                                    newItem.isOverflow = false;
                                    placed = true;
                                  }
                                }
                              }
                            }
                            
                            // If still not placed, force it at 0,0 with red conflict marker
                            if (!placed) {
                              newItem.x = 0;
                              newItem.y = 0;
                              newItem.hasConflict = true;
                              newItem.isOverflow = false;
                            }
                            
                            return [...withoutItem, newItem];
                          });
                        }}
                        className="absolute -top-2 -right-2 p-0.5 bg-white border border-green-300 shadow-sm hover:bg-green-50 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Move back to cargo grid"
                      >
                        <svg className="w-2.5 h-2.5 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Loaded Routes List */}
          {loadsInCargo.length > 0 && (
            <div className="px-4 pb-4">
              <div className="text-xs font-semibold text-gray-700 mb-2">Loaded Routes:</div>
              <div className="space-y-1">
                {loadsInCargo.map((load) => (
                  <div
                    key={load.loadId}
                    className="flex items-center justify-between bg-white border border-gray-200 px-2 py-1.5 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 flex-shrink-0"
                        style={{ backgroundColor: load.color }}
                      />
                      <span className="font-medium">{load.label}</span>
                      <span className="text-gray-500">
                        ({load.loadedCount} loaded{load.overflowCount > 0 && `, ${load.overflowCount} overflow`})
                      </span>
                    </div>
                    <button
                      onClick={() => removeAllCargoFromLoad(load.loadId)}
                      className="p-0.5 hover:bg-red-50 text-gray-600 hover:text-red-600"
                      title="Remove all pallets from this route"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
