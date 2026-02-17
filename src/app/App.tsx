import { useState, useRef, useCallback, useEffect } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { ZoomIn, ZoomOut, Maximize, Upload, Settings, Bell, User, Link, Unlink, Eye } from 'lucide-react';
import { CanvasLoadCard, type CanvasLoad } from './components/CanvasLoadCard';
import { CanvasRouteSummaryCard, type CanvasRouteSummary } from './components/CanvasRouteSummaryCard';
import { SidebarRouteSummaryCard } from './components/SidebarRouteSummaryCard';
import { CanvasVanCargo } from './components/CanvasVanCargo';
import { SidebarStopCard, type SidebarStop } from './components/SidebarStopCard';
import { UploadModal } from './components/UploadModal';
import { RouteModeToggle } from './components/RouteModeToggle';
import { SimulationImpactPanel, type SimulationImpact } from './components/SimulationImpactPanel';
import { StopTimelineBar } from './components/StopTimelineBar';
import { RouteComparison } from './components/RouteComparison';
import { VanSelector } from './components/VanSelector';
import { RouteTabSwitcher } from './components/RouteTabSwitcher';

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
  pallets: number;
  weight: number;
  x: number;
  y: number;
  groupId?: string;
  isSimulation?: boolean;
  kmDelta?: number;
  timeDeltaMinutes?: number;
  isPending?: boolean; // Flag for stops awaiting confirmation
}

const initialLoads: CanvasLoad[] = [
  {
    id: 'L001',
    brokerage: 'Hamburg Logistics GmbH',
    originCity: 'Hamburg',
    originAddress: 'Speicherstadt, 20457 Hamburg',
    destCity: 'München',
    destAddress: 'Karlsplatz, 80335 München',
    pallets: 2,
    ldm: 2.4,
    weight: 850,
    price: 450,
    distance: 775,
    pickupDate: '2024-03-15',
    deliveryDate: '2024-03-16',
    color: '#3B82F6',
    status: 'ON BOARD',
    x: 100,
    y: 100,
  },
  {
    id: 'L002',
    brokerage: 'Berlin Transport AG',
    originCity: 'Berlin',
    originAddress: 'Alexanderplatz, 10178 Berlin',
    destCity: 'Frankfurt',
    destAddress: 'Hauptwache, 60313 Frankfurt',
    pallets: 3,
    ldm: 3.6,
    weight: 1200,
    price: 380,
    distance: 550,
    pickupDate: '2024-03-15',
    deliveryDate: '2024-03-17',
    color: '#10B981',
    status: 'NEGOTIATING',
    x: 100,
    y: 300,
  },
  {
    id: 'L003',
    brokerage: 'Köln Express',
    originCity: 'Köln',
    originAddress: 'Domplatte, 50667 Köln',
    destCity: 'Stuttgart',
    destAddress: 'Schlossplatz, 70173 Stuttgart',
    pallets: 1,
    ldm: 1.2,
    weight: 420,
    price: 290,
    distance: 370,
    pickupDate: '2024-03-16',
    deliveryDate: '2024-03-17',
    color: '#F59E0B',
    status: 'TAKEN',
    x: 100,
    y: 500,
  },
];

const initialStops: CanvasStop[] = [
  // L001 - ON BOARD
  {
    id: 'S001',
    number: 1,
    type: 'pickup',
    city: 'Hamburg',
    postcode: '20457',
    eta: '08:00',
    distanceToNext: 125,
    drivingTime: '1h 45m',
    timeWindowViolation: false,
    color: '#3B82F6',
    loadId: 'L001',
    pallets: 2,
    weight: 850,
    x: 1100,
    y: 100,
  },
  {
    id: 'S002',
    number: 2,
    type: 'delivery',
    city: 'München',
    postcode: '80335',
    eta: '16:30',
    distanceToNext: 0,
    drivingTime: '—',
    timeWindowViolation: false,
    color: '#3B82F6',
    loadId: 'L001',
    pallets: 2,
    weight: 850,
    x: 1100,
    y: 280,
  },
  // L002 - NEGOTIATING
  {
    id: 'S003',
    number: 3,
    type: 'pickup',
    city: 'Berlin',
    postcode: '10178',
    eta: '08:00',
    distanceToNext: 220,
    drivingTime: '2h 30m',
    timeWindowViolation: false,
    color: '#10B981',
    loadId: 'L002',
    pallets: 3,
    weight: 1200,
    x: 1100,
    y: 460,
  },
  {
    id: 'S004',
    number: 4,
    type: 'delivery',
    city: 'Frankfurt',
    postcode: '60313',
    eta: '13:45',
    distanceToNext: 180,
    drivingTime: '2h 15m',
    timeWindowViolation: false,
    color: '#10B981',
    loadId: 'L002',
    pallets: 3,
    weight: 1200,
    x: 1100,
    y: 640,
  },
  // L003 - TAKEN
  {
    id: 'S005',
    number: 5,
    type: 'pickup',
    city: 'Köln',
    postcode: '50667',
    eta: '08:00',
    distanceToNext: 125,
    drivingTime: '1h 45m',
    timeWindowViolation: false,
    color: '#F59E0B',
    loadId: 'L003',
    pallets: 1,
    weight: 420,
    x: 1100,
    y: 820,
  },
  {
    id: 'S006',
    number: 6,
    type: 'delivery',
    city: 'Stuttgart',
    postcode: '70173',
    eta: '10:30',
    distanceToNext: 0,
    drivingTime: '—',
    timeWindowViolation: false,
    color: '#F59E0B',
    loadId: 'L003',
    pallets: 1,
    weight: 420,
    x: 1100,
    y: 1000,
  },
];

export default function App() {
  const [loads, setLoads] = useState<CanvasLoad[]>(initialLoads);
  const [stops, setStops] = useState<CanvasStop[]>(initialStops);
  const [pendingStops, setPendingStops] = useState<CanvasStop[]>([]); // Stops waiting for confirmation
  const [selectedStops, setSelectedStops] = useState<string[]>([]);
  const [groupCounter, setGroupCounter] = useState(1);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [loadToAddToCargo, setLoadToAddToCargo] = useState<CanvasLoad | null>(null);
  const [loadedCargoIds, setLoadedCargoIds] = useState<string[]>([]); // Track which loads are in cargo
  const [isRouteSummaryDocked, setIsRouteSummaryDocked] = useState(false); // Track if route summary is docked

  // Simulation Mode State
  const [routeMode, setRouteMode] = useState<'active' | 'simulation'>('active');
  const [hasSimulation, setHasSimulation] = useState(false);
  const [simulationStops, setSimulationStops] = useState<CanvasStop[]>([]);
  const [simulationImpact, setSimulationImpact] = useState<SimulationImpact>({
    kmDelta: 87,
    timeDelta: '+1h 20m',
    warnings: ['Pushes Stop 4 by +45m', '12 cm overflow at Stop 3'],
  });
  const [selectedCargoStopId, setSelectedCargoStopId] = useState('S001'); // For cargo timeline
  
  const [routeSummary, setRouteSummary] = useState<CanvasRouteSummary>({
    id: 'RS001',
    totalKm: 525,
    totalTime: '8h 30m',
    oldRouteKm: 612,
    estimatedFuel: 189,
    estimatedMargin: 1450,
    x: 1400,
    y: 100,
  });
  const [vanCargoPosition, setVanCargoPosition] = useState({ x: 100, y: 800 });
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [selectedVan, setSelectedVan] = useState('VAN1');
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Route Variant Management
  interface RouteVariant {
    id: string;
    name: string;
    savedAt: string;
    stops: CanvasStop[];
    loadedCargoIds: string[];
    selectedVan: string;
    loads: CanvasLoad[]; // Each variant has its own copy of loads
  }
  const [activeRouteTab, setActiveRouteTab] = useState('current');
  const [routeVariants, setRouteVariants] = useState<RouteVariant[]>([
    {
      id: 'variant-1',
      name: 'V1',
      savedAt: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      stops: [],
      loadedCargoIds: [],
      selectedVan: 'VAN1',
      loads: JSON.parse(JSON.stringify(initialLoads)), // Deep copy
    },
    {
      id: 'variant-2',
      name: 'V2',
      savedAt: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      stops: [],
      loadedCargoIds: [],
      selectedVan: 'VAN1',
      loads: JSON.parse(JSON.stringify(initialLoads)), // Deep copy
    },
  ]);
  const [currentRouteState, setCurrentRouteState] = useState({
    stops: initialStops,
    loadedCargoIds: [] as string[],
    loads: initialLoads, // Current Route's load state
  });

  // Save current route as a variant
  const handleSaveRouteVariant = () => {
    const variantNumber = routeVariants.length + 1;
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    
    const newVariant: RouteVariant = {
      id: `variant-${Date.now()}`,
      name: `V${variantNumber}`,
      savedAt: timeString,
      stops: [...stops],
      loadedCargoIds: [...loadedCargoIds],
      selectedVan: selectedVan,
      loads: JSON.parse(JSON.stringify(loads)), // Deep copy
    };
    
    setRouteVariants(prev => [...prev, newVariant]);
  };

  // Switch between Current Route and Variants
  const handleRouteTabChange = (tabId: string) => {
    if (tabId === activeRouteTab) return;

    // Save current state before switching
    if (activeRouteTab === 'current') {
      setCurrentRouteState({
        stops: [...stops],
        loadedCargoIds: [...loadedCargoIds],
        loads: JSON.parse(JSON.stringify(loads)), // Deep copy to preserve state
      });
    } else {
      // Save to variant with loads state
      setRouteVariants(prev => prev.map(v => 
        v.id === activeRouteTab 
          ? { 
              ...v, 
              stops: [...stops], 
              loadedCargoIds: [...loadedCargoIds], 
              selectedVan,
              loads: JSON.parse(JSON.stringify(loads)) // Deep copy
            }
          : v
      ));
    }

    // Load new state
    if (tabId === 'current') {
      setStops(currentRouteState.stops);
      setLoadedCargoIds(currentRouteState.loadedCargoIds);
      setLoads(currentRouteState.loads);
    } else {
      const variant = routeVariants.find(v => v.id === tabId);
      if (variant) {
        setStops(variant.stops);
        setLoadedCargoIds(variant.loadedCargoIds);
        setSelectedVan(variant.selectedVan);
        setLoads(variant.loads);
      }
    }

    setActiveRouteTab(tabId);
  };

  // Delete a route variant
  const handleDeleteRouteVariant = (variantId: string) => {
    setRouteVariants(prev => prev.filter(v => v.id !== variantId));
    if (activeRouteTab === variantId) {
      setActiveRouteTab('current');
      setStops(currentRouteState.stops);
      setLoadedCargoIds(currentRouteState.loadedCargoIds);
      setLoads(currentRouteState.loads);
    }
  };

  // Rename a route variant
  const handleRenameRouteVariant = (variantId: string, newName: string) => {
    setRouteVariants(prev => prev.map(v => 
      v.id === variantId ? { ...v, name: newName } : v
    ));
  };

  // Duplicate a route variant
  const handleDuplicateVariant = (variantId: string) => {
    const variant = routeVariants.find(v => v.id === variantId);
    if (!variant) return;

    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    
    // Find next available number for naming
    const existingNumbers = routeVariants
      .map(v => {
        const match = v.name.match(/^V(\d+)$/);
        return match ? parseInt(match[1]) : 0;
      })
      .filter(n => n > 0);
    const nextNumber = Math.max(...existingNumbers, 0) + 1;

    const duplicatedVariant: RouteVariant = {
      id: `variant-${Date.now()}`,
      name: `V${nextNumber}`,
      savedAt: timeString,
      stops: [...variant.stops],
      loadedCargoIds: [...variant.loadedCargoIds],
      selectedVan: variant.selectedVan,
      loads: JSON.parse(JSON.stringify(variant.loads)), // Deep copy
    };

    setRouteVariants(prev => [...prev, duplicatedVariant]);
  };

  // Duplicate Current Route
  const handleDuplicateCurrent = () => {
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    
    // Find next available number for naming
    const existingNumbers = routeVariants
      .map(v => {
        const match = v.name.match(/^V(\d+)$/);
        return match ? parseInt(match[1]) : 0;
      })
      .filter(n => n > 0);
    const nextNumber = Math.max(...existingNumbers, 0) + 1;

    const duplicatedVariant: RouteVariant = {
      id: `variant-${Date.now()}`,
      name: `V${nextNumber}`,
      savedAt: timeString,
      stops: activeRouteTab === 'current' ? [...currentRouteState.stops] : [...stops],
      loadedCargoIds: activeRouteTab === 'current' ? [...currentRouteState.loadedCargoIds] : [...loadedCargoIds],
      selectedVan: selectedVan,
      loads: JSON.parse(JSON.stringify(activeRouteTab === 'current' ? currentRouteState.loads : loads)), // Deep copy
    };

    setRouteVariants(prev => [...prev, duplicatedVariant]);
  };

  // Convert stops to sidebar format (combining active and pending for reordering)
  const combinedStops: CanvasStop[] = [...stops, ...pendingStops];
  
  // Filter stops based on active tab
  const filteredStops = activeRouteTab === 'current'
    ? combinedStops.filter(stop => {
        const load = loads.find(l => l.id === stop.loadId);
        return load?.status === 'TAKEN';
      })
    : combinedStops;
  
  const sidebarStops: SidebarStop[] = filteredStops
    .map((stop) => ({
      id: stop.id,
      number: stop.number,
      type: stop.type,
      city: stop.city,
      postcode: stop.postcode,
      eta: stop.eta,
      color: stop.color,
      loadId: stop.loadId,
      pallets: stop.pallets,
      weight: stop.weight,
      groupId: stop.groupId,
    }))
    .sort((a, b) => a.number - b.number); // Sort by number to maintain correct visual order

  const handleSelectStop = (id: string, multiSelect: boolean) => {
    if (multiSelect) {
      setSelectedStops((prev) =>
        prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id]
      );
    } else {
      setSelectedStops([id]);
    }
  };

  const handleStickStops = () => {
    if (selectedStops.length < 2) return;
    
    const groupId = `group-${groupCounter}`;
    setStops((prev) =>
      prev.map((stop) =>
        selectedStops.includes(stop.id) ? { ...stop, groupId } : stop
      )
    );
    setSelectedStops([]);
    setGroupCounter((prev) => prev + 1);
  };

  const handleUnstickStops = () => {
    if (selectedStops.length === 0) return;
    
    setStops((prev) =>
      prev.map((stop) =>
        selectedStops.includes(stop.id) ? { ...stop, groupId: undefined } : stop
      )
    );
    setSelectedStops([]);
  };

  const handleReorderStops = (fromIndex: number, toIndex: number) => {
    // Work with the sorted sidebar stops
    const reordered = [...sidebarStops];
    const [movedStop] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, movedStop);
    
    // Renumber all stops
    const renumbered = reordered.map((stop, idx) => ({ ...stop, number: idx + 1 }));
    
    // Update both stops and pending stops with their new numbers
    setStops(prev => prev.map(stop => {
      const updated = renumbered.find(r => r.id === stop.id);
      return updated ? { ...stop, number: updated.number } : stop;
    }));
    
    setPendingStops(prev => prev.map(stop => {
      const updated = renumbered.find(r => r.id === stop.id);
      return updated ? { ...stop, number: updated.number } : stop;
    }));
  };

  const moveStopWithGroup = (id: string, x: number, y: number) => {
    setStops((prev) => {
      const stop = prev.find((s) => s.id === id);
      if (!stop) return prev;

      const deltaX = x - stop.x;
      const deltaY = y - stop.y;

      if (stop.groupId) {
        // Move all stops in the same group
        return prev.map((s) =>
          s.groupId === stop.groupId
            ? { ...s, x: s.x + deltaX, y: s.y + deltaY }
            : s
        );
      } else {
        // Move just this stop
        return prev.map((s) => (s.id === id ? { ...s, x, y } : s));
      }
    });
  };

  // Handle space key for panning
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isSpacePressed) {
        setIsSpacePressed(true);
        e.preventDefault();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
        setIsPanning(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isSpacePressed]);

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setScale((prev) => Math.max(0.1, Math.min(3, prev * delta)));
    }
  };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || isSpacePressed) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      e.preventDefault();
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
    }
  };

  const handleCanvasMouseUp = () => {
    if (!isSpacePressed) {
      setIsPanning(false);
    }
  };

  const moveLoad = (id: string, x: number, y: number) => {
    setLoads((prev) =>
      prev.map((load) => (load.id === id ? { ...load, x, y } : load))
    );
  };

  const changeLoadColor = (id: string, color: string) => {
    setLoads((prev) =>
      prev.map((load) => (load.id === id ? { ...load, color } : load))
    );
  };

  const changeLoadStatus = (id: string, status: CanvasLoad['status']) => {
    console.log('changeLoadStatus called with id:', id, 'status:', status);
    setLoads((prev) => {
      const updated = prev.map((load) => (load.id === id ? { ...load, status } : load));
      console.log('Loads updated:', updated.find(l => l.id === id));
      return updated;
    });
  };

  const moveStop = (id: string, x: number, y: number) => {
    setStops((prev) =>
      prev.map((stop) => (stop.id === id ? { ...stop, x, y } : stop))
    );
  };

  const moveRouteContainer = (loadId: string, x: number, y: number) => {
    setStops((prev) =>
      prev.map((stop) => {
        if (stop.loadId === loadId) {
          if (stop.type === 'pickup') {
            return { ...stop, x, y };
          } else {
            // Keep delivery relative to pickup
            const pickup = prev.find((s) => s.loadId === loadId && s.type === 'pickup');
            if (pickup) {
              const offsetY = stop.y - pickup.y;
              return { ...stop, x, y: y + offsetY };
            }
          }
        }
        return stop;
      })
    );
  };

  const moveRouteSummary = (id: string, x: number, y: number) => {
    setRouteSummary((prev) => ({ ...prev, x, y }));
  };

  const moveVanCargo = (x: number, y: number) => {
    setVanCargoPosition({ x, y });
  };

  const handleZoomIn = () => {
    setScale((prev) => Math.min(3, prev * 1.2));
  };

  const handleZoomOut = () => {
    setScale((prev) => Math.max(0.1, prev / 1.2));
  };

  const handleZoomReset = () => {
    setScale(1);
    setPan({ x: 0, y: 0 });
  };

  // Simulation Mode Handlers
  const handleCreateSimulation = () => {
    setSimulationStops([...stops]);
    setHasSimulation(true);
    setRouteMode('simulation');
  };

  const handleApplyChanges = () => {
    setStops(simulationStops);
    setHasSimulation(false);
    setRouteMode('active');
    setSimulationStops([]);
  };

  const handleDiscardSimulation = () => {
    setHasSimulation(false);
    setRouteMode('active');
    setSimulationStops([]);
  };

  const handleModeChange = (mode: 'active' | 'simulation') => {
    setRouteMode(mode);
  };

  // Handle Load to Van - creates pending pickup and delivery stops for user to arrange
  const handleLoadToVan = useCallback((load: CanvasLoad) => {
    // Check if this load is already in the van or pending (prevent duplicates)
    const alreadyLoaded = stops.some(stop => stop.loadId === load.id);
    const alreadyPending = pendingStops.some(stop => stop.loadId === load.id);
    if (alreadyLoaded || alreadyPending) {
      return;
    }

    // Create pickup stop
    const pickupStop: CanvasStop = {
      id: `S-${load.id}-pickup`,
      number: stops.length + pendingStops.length + 1,
      type: 'pickup',
      city: load.originCity,
      postcode: load.originAddress?.split(',')[1]?.trim().split(' ')[0] || '00000',
      eta: load.pickupDate,
      distanceToNext: 0,
      drivingTime: '—',
      timeWindowViolation: false,
      color: load.color,
      loadId: load.id,
      pallets: load.pallets,
      weight: load.weight,
      x: 1100,
      y: 100 + (stops.length + pendingStops.length) * 180,
    };

    // Create delivery stop
    const deliveryStop: CanvasStop = {
      id: `S-${load.id}-delivery`,
      number: stops.length + pendingStops.length + 2,
      type: 'delivery',
      city: load.destCity,
      postcode: load.destAddress?.split(',')[1]?.trim().split(' ')[0] || '00000',
      eta: load.deliveryDate,
      distanceToNext: 0,
      drivingTime: '—',
      timeWindowViolation: false,
      color: load.color,
      loadId: load.id,
      pallets: load.pallets,
      weight: load.weight,
      x: 1100,
      y: 100 + (stops.length + pendingStops.length + 1) * 180,
    };

    // Add to pending stops for user to arrange
    setPendingStops(prev => [...prev, pickupStop, deliveryStop]);
  }, [stops, pendingStops]);

  // Handle Remove from Van - removes stops from both pending and active
  const handleRemoveFromVan = useCallback((load: CanvasLoad) => {
    // Remove stops associated with this load from active stops
    setStops(prev => prev.filter(stop => stop.loadId !== load.id));
    // Remove from pending stops
    setPendingStops(prev => prev.filter(stop => stop.loadId !== load.id));
    // Remove from loaded cargo tracking
    setLoadedCargoIds(prev => prev.filter(id => id !== load.id));
  }, []);

  // Confirm pending stops - moves them to active route
  const handleConfirmRouteChanges = () => {
    // Combine all stops and sort by their CURRENT numbers (which reflect user's reordering)
    const allStops = [...stops, ...pendingStops].sort((a, b) => a.number - b.number);
    
    // Mark all pending loads as loaded in cargo
    const pendingLoadIds = [...new Set(pendingStops.map(stop => stop.loadId))];
    setLoadedCargoIds(prev => [...prev, ...pendingLoadIds]);
    
    // Set the combined sorted stops as the new active stops
    setStops(allStops);
    
    // Clear pending stops
    setPendingStops([]);
  };

  // Cancel pending stops - removes them and reverts load status
  const handleCancelRouteChanges = () => {
    // Get all load IDs from pending stops
    const pendingLoadIds = [...new Set(pendingStops.map(stop => stop.loadId))];
    
    // Revert load status back to ON BOARD
    setLoads(prev => prev.map(load => 
      pendingLoadIds.includes(load.id) ? { ...load, status: 'ON BOARD' } : load
    ));
    
    // Clear pending stops
    setPendingStops([]);
  };

  // Calculate route summaries for comparison
  const calculateRouteSummaries = () => {
    const FUEL_PRICE_PER_LITER = 1.65; // €1.65 per liter

    // Get TAKEN load IDs
    const takenLoadIds = loads.filter(l => l.status === 'TAKEN').map(l => l.id);
    
    // Get toggled ON load IDs (non-TAKEN loads that are in cargo)
    const toggledOnLoadIds = loadedCargoIds.filter(id => {
      const load = loads.find(l => l.id === id);
      return load && load.status !== 'TAKEN';
    });

    // Calculate for TAKEN loads only (Current Route)
    const takenLoads = loads.filter(l => takenLoadIds.includes(l.id));
    const currentTotalKm = takenLoads.reduce((sum, l) => sum + l.distance, 0);
    const currentFuelLiters = Math.round(currentTotalKm * 0.35);
    const currentFuelCost = Math.round(currentFuelLiters * FUEL_PRICE_PER_LITER);
    const currentRevenue = takenLoads.reduce((sum, l) => sum + l.price, 0);
    const currentRoute = {
      totalKm: currentTotalKm,
      totalTime: '5h 30m', // Mock calculation
      estimatedFuel: currentFuelLiters,
      fuelCost: currentFuelCost,
      totalRevenue: currentRevenue,
      pricePerKm: currentTotalKm > 0 ? currentRevenue / currentTotalKm : 0,
      estimatedMargin: currentRevenue - currentFuelCost,
      stopCount: takenLoadIds.length * 2, // pickup + delivery
    };

    // Calculate for TAKEN + toggled ON loads (Toggled ON Route)
    const toggledOnIncludedIds = [...takenLoadIds, ...toggledOnLoadIds];
    const toggledOnLoads = loads.filter(l => toggledOnIncludedIds.includes(l.id));
    const toggledOnTotalKm = toggledOnLoads.reduce((sum, l) => sum + l.distance, 0);
    const toggledOnFuelLiters = Math.round(toggledOnTotalKm * 0.35);
    const toggledOnFuelCost = Math.round(toggledOnFuelLiters * FUEL_PRICE_PER_LITER);
    const toggledOnRevenue = toggledOnLoads.reduce((sum, l) => sum + l.price, 0);
    const toggledOnRoute = {
      totalKm: toggledOnTotalKm,
      totalTime: '9h 15m', // Mock calculation
      estimatedFuel: toggledOnFuelLiters,
      fuelCost: toggledOnFuelCost,
      totalRevenue: toggledOnRevenue,
      pricePerKm: toggledOnTotalKm > 0 ? toggledOnRevenue / toggledOnTotalKm : 0,
      estimatedMargin: toggledOnRevenue - toggledOnFuelCost,
      stopCount: toggledOnIncludedIds.length * 2,
    };

    // Calculate for ALL loads (Everything Route)
    const allLoads = loads;
    const everythingTotalKm = allLoads.reduce((sum, l) => sum + l.distance, 0);
    const everythingFuelLiters = Math.round(everythingTotalKm * 0.35);
    const everythingFuelCost = Math.round(everythingFuelLiters * FUEL_PRICE_PER_LITER);
    const everythingRevenue = allLoads.reduce((sum, l) => sum + l.price, 0);
    const everythingRoute = {
      totalKm: everythingTotalKm,
      totalTime: '12h 45m', // Mock calculation
      estimatedFuel: everythingFuelLiters,
      fuelCost: everythingFuelCost,
      totalRevenue: everythingRevenue,
      pricePerKm: everythingTotalKm > 0 ? everythingRevenue / everythingTotalKm : 0,
      estimatedMargin: everythingRevenue - everythingFuelCost,
      stopCount: allLoads.length * 2,
    };

    return {
      currentRoute,
      toggledOnRoute,
      everythingRoute,
      hasToggledLoads: toggledOnLoadIds.length > 0,
    };
  };

  const routeComparison = calculateRouteSummaries();

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="h-screen flex flex-col bg-[#F8FAFC]">
        {/* Top Navigation */}
        <nav className={`bg-white border-b px-6 py-3 flex items-center justify-between z-10 ${
          routeMode === 'simulation' ? 'border-amber-400 border-b-2' : 'border-gray-200'
        }`}>
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-600 flex items-center justify-center">
                <span className="text-white font-bold text-sm">VD</span>
              </div>
              <h1 className="font-semibold text-gray-900">Van Dispatch Planning Board</h1>
              {routeMode === 'simulation' && (
                <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs font-semibold border border-amber-300">
                  SIMULATION MODE
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <VanSelector
              selectedVanId={selectedVan}
              onVanChange={setSelectedVan}
            />

            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 border border-gray-300">
              <button
                onClick={handleZoomOut}
                className="p-1.5 hover:bg-white"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4 text-gray-700" />
              </button>
              <span className="text-sm font-medium text-gray-900 min-w-[60px] text-center">
                {Math.round(scale * 100)}%
              </span>
              <button
                onClick={handleZoomIn}
                className="p-1.5 hover:bg-white"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4 text-gray-700" />
              </button>
              <button
                onClick={handleZoomReset}
                className="p-1.5 hover:bg-white border-l border-gray-300 ml-1 pl-2"
                title="Reset View"
              >
                <Maximize className="w-4 h-4 text-gray-700" />
              </button>
            </div>

            <RouteModeToggle
              mode={routeMode}
              onModeChange={handleModeChange}
              onCreateSimulation={handleCreateSimulation}
              onApplyChanges={handleApplyChanges}
              onDiscardSimulation={handleDiscardSimulation}
              hasSimulation={hasSimulation}
            />

            <button
              onClick={() => setShowUploadModal(true)}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              Upload Freight
            </button>
            <button className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100">
              <Bell className="w-5 h-5" />
            </button>
            <button className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100">
              <Settings className="w-5 h-5" />
            </button>
            <button className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100">
              <User className="w-5 h-5" />
            </button>
          </div>
        </nav>

        {/* Route Tab Switcher */}
        <RouteTabSwitcher
          activeTab={activeRouteTab}
          variants={routeVariants}
          onTabChange={handleRouteTabChange}
          onRenameVariant={handleRenameRouteVariant}
          onDeleteVariant={handleDeleteRouteVariant}
          onDuplicateVariant={handleDuplicateVariant}
          onDuplicateCurrent={handleDuplicateCurrent}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left side - Canvas + Route Comparison */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Canvas Area */}
            <div
              ref={canvasRef}
              className="flex-1 overflow-hidden relative bg-gray-100"
              onWheel={handleWheel}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              style={{
                cursor: isPanning ? 'grabbing' : isSpacePressed ? 'grab' : 'default',
              }}
            >
              {/* Grid background */}
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage: `
                  linear-gradient(rgba(0, 0, 0, 0.05) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(0, 0, 0, 0.05) 1px, transparent 1px)
                `,
                  backgroundSize: `${50 * scale}px ${50 * scale}px`,
                  backgroundPosition: `${pan.x}px ${pan.y}px`,
                }}
              />

              {/* Canvas content */}
              <div
                className="absolute"
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
                  transformOrigin: '0 0',
                  width: '5000px',
                  height: '5000px',
                }}
              >
                {/* Load Cards */}
                {loads.map((load) => (
                  <CanvasLoadCard
                    key={load.id}
                    load={load}
                    onMove={moveLoad}
                    onColorChange={changeLoadColor}
                    onStatusChange={changeLoadStatus}
                    onAddToCargo={() => handleLoadToVan(load)}
                    onRemoveFromCargo={() => handleRemoveFromVan(load)}
                    isLoadedInCargo={loadedCargoIds.includes(load.id)}
                    scale={scale}
                  />
                ))}

                {/* Route Summary Card */}
                {!isRouteSummaryDocked && (
                  <CanvasRouteSummaryCard
                    summary={routeSummary}
                    onMove={moveRouteSummary}
                    onDock={() => setIsRouteSummaryDocked(true)}
                    scale={scale}
                  />
                )}

                {/* Van Cargo Planner */}
                <CanvasVanCargo
                  vanId={selectedVan}
                  x={vanCargoPosition.x}
                  y={vanCargoPosition.y}
                  onMove={moveVanCargo}
                  loadToAdd={loadToAddToCargo}
                  onLoadAdded={() => setLoadToAddToCargo(null)}
                  onCargoLoadsChange={setLoadedCargoIds}
                  scale={scale}
                  selectedStopId={selectedCargoStopId}
                  onStopSelect={setSelectedCargoStopId}
                  routedStops={stops.map(stop => ({
                    id: stop.id,
                    number: stop.number,
                    city: stop.city,
                    loadId: stop.loadId,
                    pallets: stop.pallets,
                    type: stop.type,
                    color: stop.color,
                    label: `${stop.city.substring(0, 3)}-${stop.number}`
                  }))}
                />
              </div>

              {/* Helper text */}
              
            </div>

            {/* Bottom Bar - Route Comparison (only spans canvas area) */}
            {!pendingStops.length && (
              <RouteComparison
                currentRoute={routeComparison.currentRoute}
                toggledOnRoute={routeComparison.toggledOnRoute}
                everythingRoute={routeComparison.everythingRoute}
                hasToggledLoads={routeComparison.hasToggledLoads}
              />
            )}
          </div>

          {/* Right Sidebar - Route Stops */}
          <div className="w-80 bg-white border-l border-gray-300 flex flex-col overflow-hidden">
            {/* Sidebar Header */}
            <div className="relative z-10 bg-gray-50 border-b border-gray-300 px-4 py-3">
              <h2 className="font-semibold text-sm text-gray-900">
                {routeMode === 'simulation' ? 'Simulation Route' : 'Route Stops'}
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">Click to select, drag to reorder</p>
              
              {/* Stick/Unstick Controls */}
              {selectedStops.length > 0 && (
                <div className="mt-2 flex gap-2">
                  {selectedStops.length >= 2 && (
                    <button
                      onClick={handleStickStops}
                      className="flex-1 px-2 py-1.5 bg-amber-600 text-white text-xs font-medium hover:bg-amber-700 flex items-center justify-center gap-1"
                    >
                      <Link className="w-3 h-3" />
                      Stick ({selectedStops.length})
                    </button>
                  )}
                  {stops.some((s) => selectedStops.includes(s.id) && s.groupId) && (
                    <button
                      onClick={handleUnstickStops}
                      className="flex-1 px-2 py-1.5 bg-gray-600 text-white text-xs font-medium hover:bg-gray-700 flex items-center justify-center gap-1"
                    >
                      <Unlink className="w-3 h-3" />
                      Unstick
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Simulation Impact Panel */}
            {routeMode === 'simulation' && hasSimulation && (
              <div className="px-3 pt-3">
                <SimulationImpactPanel impact={simulationImpact} />
              </div>
            )}

            {/* Stops List */}
            <div className="flex-1 overflow-y-auto">
              {sidebarStops.map((stop, index) => {
                const isPending = pendingStops.some(ps => ps.id === stop.id);
                const load = loads.find(l => l.id === stop.loadId);
                const isInCargo = load?.status !== 'TAKEN' && loadedCargoIds.includes(stop.loadId); // Blue dot for non-TAKEN loads that are loaded
                const showToggle = load?.status !== 'TAKEN'; // Only show toggle for non-TAKEN loads
                return (
                  <div key={stop.id}>
                    {/* Cargo View Icon - Divider line with eye icon */}
                    <div className="relative h-px bg-gray-200 z-50">
                      <button
                        onClick={() => setSelectedCargoStopId(stop.id)}
                        className={`absolute right-3 ${
                          index === 0 ? 'top-full translate-y-1' : 'top-1/2 -translate-y-1/2'
                        } w-6 h-6 flex items-center justify-center transition-all rounded-sm ${
                          selectedCargoStopId === stop.id
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'bg-gray-50 text-gray-400 hover:text-gray-600 hover:bg-gray-100 border border-gray-200'
                        }`}
                        title={`View cargo at Stop ${index + 1} (${stop.type === 'pickup' ? 'after pickup' : 'after delivery'})`}
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Stop Card */}
                    <div className={isPending ? 'bg-amber-50/30' : ''}>
                      <SidebarStopCard
                        stop={stop}
                        index={index}
                        isSelected={selectedStops.includes(stop.id)}
                        isGrouped={!!stop.groupId}
                        isInCargo={isInCargo}
                        isPending={isPending}
                        onSelect={handleSelectStop}
                        onReorder={handleReorderStops}
                        onToggleCargo={showToggle ? (stopId) => {
                          const stop = stops.find(s => s.id === stopId) || pendingStops.find(s => s.id === stopId);
                          if (!stop) return;
                          
                          // Toggle cargo visibility
                          setLoadedCargoIds(prev => 
                            prev.includes(stop.loadId) 
                              ? prev.filter(id => id !== stop.loadId)
                              : [...prev, stop.loadId]
                          );
                        } : undefined}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pending Stops Confirmation Panel */}
            {pendingStops.length > 0 && (
              <div className="border-t-4 border-amber-500 bg-amber-50 px-4 py-4">
                <div className="mb-3">
                  <p className="text-sm font-semibold text-amber-900 mb-1">
                    {pendingStops.length} stop{pendingStops.length > 1 ? 's' : ''} pending confirmation
                  </p>
                  <p className="text-xs text-amber-700">
                    Arrange the stops above, then confirm to add them to the active route.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleCancelRouteChanges}
                    className="flex-1 px-4 py-2.5 bg-white text-amber-900 text-sm font-semibold border-2 border-amber-300 hover:bg-amber-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmRouteChanges}
                    className="flex-1 px-4 py-2.5 bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 transition-colors"
                  >
                    Confirm Route
                  </button>
                </div>
              </div>
            )}

            {/* Route Summary - Docked at Bottom */}
            {isRouteSummaryDocked && !pendingStops.length && (
              <SidebarRouteSummaryCard
                summary={routeSummary}
                onUndock={() => setIsRouteSummaryDocked(false)}
              />
            )}
          </div>
        </div>

        <UploadModal
          isOpen={showUploadModal}
          onClose={() => setShowUploadModal(false)}
        />
      </div>
    </DndProvider>
  );
}