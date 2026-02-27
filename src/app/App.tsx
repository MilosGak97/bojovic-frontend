import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Upload,
  Settings,
  Bell,
  User,
  Eye,
  Copy,
  ExternalLink,
  Pencil,
  Trash2,
} from 'lucide-react';
import type { PlannerLoad } from './types/load';
import { CanvasVanCargo } from './components/CanvasVanCargo';
import { SidebarStopCard, type SidebarStop } from './components/SidebarStopCard';
import { UploadModal } from './components/UploadModal';
import { EditLoadModal } from './components/EditLoadModal';
import { PalletDetailsModal } from './components/PalletDetailsModal';
import { ThinModuleMenu } from './components/ThinModuleMenu';
import { RouteModeToggle } from './components/RouteModeToggle';
import { SimulationImpactPanel, type SimulationImpact } from './components/SimulationImpactPanel';
import { RouteComparison } from './components/RouteComparison';
import { TripSelector } from './components/TripSelector';
import { loadApi } from '../api';
import type { Load as ApiLoad } from '../domain/entities';
import {
  buildLoadUpsertDto,
  buildPlannerSyncFingerprint,
  buildSidebarSeedStops,
  isUuid,
  mapApiLoadToPlannerLoad,
} from './planner-api-mapper';

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
}

type OrganizerStatus = 'ON BOARD' | 'NEGOTIATING' | 'TAKEN';
type MiddleWorkspaceTab = 'load-planner' | 'maps';
type TranseuLinkField = 'originTranseuLink' | 'destTranseuLink';

const ORGANIZER_STATUSES: OrganizerStatus[] = [
  'ON BOARD',
  'NEGOTIATING',
  'TAKEN',
];

interface PalletDimensions {
  width: number;
  height: number;
  weightKg?: number;
}

interface LoadExtraStop {
  address: string;
  pallets: number;
  action: 'pickup' | 'dropoff';
}

const createDefaultPalletDimensions = (count: number): PalletDimensions[] =>
  Array.from({ length: Math.max(0, count) }, () => ({
    width: 120,
    height: 80,
  }));

const ensureLoadPalletDimensions = (load: PlannerLoad): PalletDimensions[] => {
  const current = load.palletDimensions ?? [];
  if (current.length >= load.pallets) {
    return current.slice(0, load.pallets);
  }

  return [
    ...current,
    ...createDefaultPalletDimensions(load.pallets - current.length),
  ];
};

const ensureLoadExtraStops = (load: PlannerLoad): LoadExtraStop[] =>
  (load.extraStops ?? []).map((extraStop) => {
    if (typeof extraStop === 'string') {
      return {
        address: extraStop,
        pallets: 1,
        action: 'dropoff',
      };
    }

    return {
      address: extraStop.address ?? '',
      pallets: Math.max(0, Math.round(extraStop.pallets ?? 0)),
      action: extraStop.action === 'pickup' ? 'pickup' : 'dropoff',
    };
  });

const clonePlannerLoad = (load: PlannerLoad): PlannerLoad => ({
  ...load,
  palletDimensions: load.palletDimensions
    ? load.palletDimensions.map((pallet) => ({ ...pallet }))
    : undefined,
  extraStops: load.extraStops
    ? load.extraStops.map((stop) => (typeof stop === 'string' ? stop : { ...stop }))
    : undefined,
});

const upsertPlannerLoad = (
  existingLoads: PlannerLoad[],
  incomingLoad: PlannerLoad,
): PlannerLoad[] => {
  const nextLoad = clonePlannerLoad(incomingLoad);
  const existingIndex = existingLoads.findIndex((load) => load.id === incomingLoad.id);
  if (existingIndex === -1) {
    return [nextLoad, ...existingLoads];
  }

  return existingLoads.map((load, index) => (index === existingIndex ? nextLoad : load));
};

const extractPostcode = (address?: string): string => {
  const match = address?.match(/\b\d{5}\b/);
  return match?.[0] ?? '00000';
};

const parseEtaDisplay = (eta: string, fallbackDate?: string) => {
  const trimmed = eta.trim();
  if (!trimmed) {
    return {
      date: fallbackDate ?? '—',
      time: '—',
    };
  }

  const dateTimeMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{1,2}:\d{2})/);
  if (dateTimeMatch) {
    return {
      date: dateTimeMatch[1],
      time: dateTimeMatch[2],
    };
  }

  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(trimmed);
  if (isDateOnly) {
    return {
      date: trimmed,
      time: '—',
    };
  }

  const isTimeOnly = /^\d{1,2}:\d{2}$/.test(trimmed);
  if (isTimeOnly) {
    return {
      date: fallbackDate ?? '—',
      time: trimmed,
    };
  }

  return {
    date: fallbackDate ?? trimmed,
    time: '—',
  };
};

const formatDateTimePoint = (dateValue?: string, timeHint?: string) => {
  const dateParsed = parseEtaDisplay(dateValue ?? '');
  const hintParsed = parseEtaDisplay(timeHint ?? '', dateParsed.date !== '—' ? dateParsed.date : undefined);

  const date =
    dateParsed.date && dateParsed.date !== '—'
      ? dateParsed.date
      : hintParsed.date || '—';
  const time =
    dateParsed.time !== '—'
      ? dateParsed.time
      : hintParsed.time !== '—'
        ? hintParsed.time
        : '—';

  return `${date} ${time}`;
};

const formatDateTimeRange = (
  startDateValue?: string,
  endDateValue?: string,
  startTimeHint?: string,
) => {
  const startPoint = formatDateTimePoint(startDateValue, startTimeHint);
  if (!endDateValue) {
    return startPoint;
  }

  const endPoint = formatDateTimePoint(endDateValue);
  return `${startPoint} - ${endPoint}`;
};

const initialLoads: PlannerLoad[] = [
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

const normalizedInitialLoads: PlannerLoad[] = initialLoads.map((load) => ({
  ...load,
  palletDimensions: ensureLoadPalletDimensions(load),
  extraStops: ensureLoadExtraStops(load),
}));

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
  const [loads, setLoads] = useState<PlannerLoad[]>(normalizedInitialLoads);
  const [stops, setStops] = useState<CanvasStop[]>(initialStops);
  const [selectedStops, setSelectedStops] = useState<string[]>([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [loadedCargoIds, setLoadedCargoIds] = useState<string[]>([]); // Track which loads are in cargo

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
  const [selectedTrip, setSelectedTrip] = useState('');
  const [organizerVanCargoPosition, setOrganizerVanCargoPosition] = useState({ x: 24, y: 24 });
  const [middleWorkspaceTab, setMiddleWorkspaceTab] = useState<MiddleWorkspaceTab>('load-planner');
  const [draggingSidebarStopIndex, setDraggingSidebarStopIndex] = useState<number | null>(null);
  const [draggingLoadId, setDraggingLoadId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<OrganizerStatus | null>(null);
  const [isInactiveModalOpen, setIsInactiveModalOpen] = useState(false);
  const [editingLoadId, setEditingLoadId] = useState<string | null>(null);
  const [editingPalletLoadId, setEditingPalletLoadId] = useState<string | null>(null);
  const [selectedLoadId, setSelectedLoadId] = useState<string | null>(null);
  const [copiedIndicatorKey, setCopiedIndicatorKey] = useState<string | null>(null);
  const [isApiConnected, setIsApiConnected] = useState(false);
  const [isPlannerHydrated, setIsPlannerHydrated] = useState(false);
  const [isSavingPlanner, setIsSavingPlanner] = useState(false);
  const [lastPlannerSyncError, setLastPlannerSyncError] = useState<string | null>(null);
  const plannerSyncTimerRef = useRef<number | null>(null);
  const plannerLastSyncedFingerprintRef = useRef<string>('');

  const hasAnyTripAssignment = useMemo(
    () => loads.some((load) => Boolean(load.tripId)),
    [loads],
  );
  const visiblePlannerLoads = useMemo(() => {
    if (!hasAnyTripAssignment) {
      return loads;
    }
    if (!selectedTrip) {
      return loads.filter((load) => Boolean(load.tripId));
    }
    return loads.filter((load) => load.tripId === selectedTrip);
  }, [hasAnyTripAssignment, loads, selectedTrip]);

  useEffect(() => {
    if (!selectedLoadId) return;
    const isStillVisible = visiblePlannerLoads.some((load) => load.id === selectedLoadId);
    if (!isStillVisible) {
      setSelectedLoadId(null);
      setSelectedStops([]);
    }
  }, [selectedLoadId, visiblePlannerLoads]);

  const buildCanvasStopsFromApiLoads = useCallback(
    (apiLoads: ApiLoad[], plannerLoads: PlannerLoad[]): CanvasStop[] => {
      const seedStops = buildSidebarSeedStops(apiLoads, plannerLoads);

      return seedStops.map((seed, index) => ({
        id: `S-${seed.loadId}-${seed.type}`,
        number: index + 1,
        type: seed.type,
        city: seed.city,
        postcode: seed.postcode,
        eta: seed.eta,
        distanceToNext: 0,
        drivingTime: '—',
        timeWindowViolation: false,
        color: seed.color,
        loadId: seed.loadId,
        pallets: seed.pallets,
        weight: seed.weight,
        x: 1100,
        y: 100 + index * 180,
      }));
    },
    [],
  );

  const appendPlannerStopsForLoad = useCallback(
    (
      existingStops: CanvasStop[],
      apiLoad: ApiLoad,
      plannerLoad: PlannerLoad,
    ): CanvasStop[] => {
      if (existingStops.some((stop) => stop.loadId === plannerLoad.id)) {
        return existingStops;
      }

      const generatedStops = buildCanvasStopsFromApiLoads([apiLoad], [plannerLoad]);
      if (generatedStops.length === 0) {
        return existingStops;
      }

      const nextStopNumber =
        existingStops.reduce((max, stop) => Math.max(max, stop.number), 0) + 1;

      const normalizedStops = generatedStops.map((stop, index) => {
        const number = nextStopNumber + index;
        return {
          ...stop,
          number,
          x: 1100,
          y: 100 + (number - 1) * 180,
        };
      });

      return [...existingStops, ...normalizedStops];
    },
    [buildCanvasStopsFromApiLoads],
  );

  const handleFreightCreated = useCallback(
    (createdLoad: ApiLoad) => {
      const mappedLoad = mapApiLoadToPlannerLoad(createdLoad);

      setLoads((prev) => upsertPlannerLoad(prev, mappedLoad));
      setStops((prev) => appendPlannerStopsForLoad(prev, createdLoad, mappedLoad));
    },
    [appendPlannerStopsForLoad],
  );

  useEffect(() => {
    let isCancelled = false;

    const hydratePlanner = async () => {
      try {
        const initialResponse = await loadApi.getAll({ limit: 200, offset: 0 });
        let apiLoads = initialResponse.data;

        if (apiLoads.length === 0) {
          for (const seedLoad of normalizedInitialLoads) {
            await loadApi.create(buildLoadUpsertDto(seedLoad));
          }
          const seededResponse = await loadApi.getAll({ limit: 200, offset: 0 });
          apiLoads = seededResponse.data;
        }

        if (isCancelled) return;

        const plannerLoads = apiLoads.map(mapApiLoadToPlannerLoad);
        const plannerStops = buildCanvasStopsFromApiLoads(apiLoads, plannerLoads);

        setLoads(plannerLoads);
        setStops(plannerStops);
        setSelectedStops([]);
        setSelectedLoadId(null);
        setEditingLoadId(null);
        setLoadedCargoIds([]);
        setSelectedCargoStopId(plannerStops[0]?.id ?? '');

        plannerLastSyncedFingerprintRef.current = buildPlannerSyncFingerprint(plannerLoads);
        setIsApiConnected(true);
        setLastPlannerSyncError(null);
      } catch (error) {
        console.error('Failed to hydrate planner loads from API', error);
        if (!isCancelled) {
          setIsApiConnected(false);
        }
      } finally {
        if (!isCancelled) {
          setIsPlannerHydrated(true);
        }
      }
    };

    void hydratePlanner();

    return () => {
      isCancelled = true;
      if (plannerSyncTimerRef.current !== null) {
        window.clearTimeout(plannerSyncTimerRef.current);
        plannerSyncTimerRef.current = null;
      }
    };
  }, [buildCanvasStopsFromApiLoads]);

  const syncPlannerLoadsToApi = useCallback(
    async (loadsToSync: PlannerLoad[]) => {
      const syncableLoads = loadsToSync.filter((load) => isUuid(load.id));
      if (!isApiConnected || syncableLoads.length === 0) {
        return;
      }

      setIsSavingPlanner(true);
      try {
        await Promise.all(
          syncableLoads.map((load) => loadApi.update(load.id, buildLoadUpsertDto(load))),
        );
        plannerLastSyncedFingerprintRef.current = buildPlannerSyncFingerprint(loadsToSync);
        setLastPlannerSyncError(null);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to sync planner loads';
        console.error('Planner load sync failed', error);
        setLastPlannerSyncError(message);
      } finally {
        setIsSavingPlanner(false);
      }
    },
    [isApiConnected],
  );

  const plannerSyncFingerprint = useMemo(() => buildPlannerSyncFingerprint(loads), [loads]);

  useEffect(() => {
    if (!isApiConnected || !isPlannerHydrated) {
      return;
    }
    if (plannerSyncFingerprint === plannerLastSyncedFingerprintRef.current) {
      return;
    }

    if (plannerSyncTimerRef.current !== null) {
      window.clearTimeout(plannerSyncTimerRef.current);
    }

    const loadsSnapshot = loads;
    plannerSyncTimerRef.current = window.setTimeout(() => {
      void syncPlannerLoadsToApi(loadsSnapshot);
    }, 700);

    return () => {
      if (plannerSyncTimerRef.current !== null) {
        window.clearTimeout(plannerSyncTimerRef.current);
        plannerSyncTimerRef.current = null;
      }
    };
  }, [
    isApiConnected,
    isPlannerHydrated,
    loads,
    plannerSyncFingerprint,
    syncPlannerLoadsToApi,
  ]);

  // Convert stops to sidebar format
  const combinedStops: CanvasStop[] = stops;
  
  // Keep sidebar focused on route-active loads
  const filteredStops = combinedStops.filter((stop) => {
    const load = visiblePlannerLoads.find((currentLoad) => currentLoad.id === stop.loadId);
    if (!load || load.isInactive) return false;
    return load.status === 'TAKEN' || load.status === 'NEGOTIATING';
  });
  
  const sidebarStops: SidebarStop[] = filteredStops
    .map((stop) => {
      const relatedLoad = visiblePlannerLoads.find((load) => load.id === stop.loadId);
      const fallbackDate =
        stop.type === 'pickup' ? relatedLoad?.pickupDate : relatedLoad?.deliveryDate;
      const { date: etaDate, time: etaTime } = parseEtaDisplay(stop.eta, fallbackDate);

      return {
        id: stop.id,
        number: stop.number,
        type: stop.type,
        city: stop.city,
        postcode: stop.postcode,
        eta: stop.eta,
        etaDate,
        etaTime,
        color: relatedLoad?.color ?? stop.color,
        loadId: stop.loadId,
        brokerage: relatedLoad?.brokerage ?? '',
        locationLine: `DE, ${stop.postcode}, ${stop.city}`,
        transeuLink:
          stop.type === 'pickup'
            ? relatedLoad?.originTranseuLink
            : relatedLoad?.destTranseuLink,
        pallets: stop.pallets,
        weight: stop.weight,
        distanceToNext: stop.distanceToNext,
        drivingTime: stop.drivingTime,
        groupId: stop.groupId,
      };
    })
    .sort((a, b) => a.number - b.number); // Sort by number to maintain correct visual order

  const cargoRoutedStops = sidebarStops
    .flatMap((stop) => {
      const relatedLoad = visiblePlannerLoads.find((load) => load.id === stop.loadId);
      const palletDimensions = relatedLoad ? ensureLoadPalletDimensions(relatedLoad) : [];
      const baseStop = {
        id: stop.id,
        number: stop.number,
        city: stop.city,
        loadId: stop.loadId,
        pallets: stop.pallets,
        palletDimensions,
        type: stop.type,
        color: relatedLoad?.color ?? stop.color,
        label: `${stop.city.substring(0, 3)}-${stop.number}`,
      } as const;

      if (stop.type !== 'pickup' || !relatedLoad) {
        return [baseStop];
      }

      const extraStops = ensureLoadExtraStops(relatedLoad);
      const extraRouteStops = extraStops.map((extraStop, extraIndex) => ({
        id: `${stop.id}-extra-${extraIndex}`,
        number: stop.number + (extraIndex + 1) / 100,
        city: extraStop.address || `Extra stop ${extraIndex + 1}`,
        loadId: stop.loadId,
        pallets: extraStop.pallets,
        palletDimensions: createDefaultPalletDimensions(extraStop.pallets),
        type: 'extra' as const,
        extraAction: extraStop.action,
        color: relatedLoad?.color ?? stop.color,
        label: `EX-${extraIndex + 1}`,
      }));

      return [baseStop, ...extraRouteStops];
    })
    .sort((a, b) => a.number - b.number);

  useEffect(() => {
    if (cargoRoutedStops.length === 0) {
      if (selectedCargoStopId !== '') {
        setSelectedCargoStopId('');
      }
      return;
    }

    const hasSelectedStop = cargoRoutedStops.some((stop) => stop.id === selectedCargoStopId);
    if (!hasSelectedStop) {
      setSelectedCargoStopId(cargoRoutedStops[0].id);
    }
  }, [cargoRoutedStops, selectedCargoStopId]);

  const getLoadIdFromStopId = (stopId: string): string | null => {
    const visibleStop = sidebarStops.find((stop) => stop.id === stopId);
    if (visibleStop) return visibleStop.loadId;

    const allStop = combinedStops.find((stop) => stop.id === stopId);
    return allStop?.loadId ?? null;
  };

  const deriveSelectedLoadIdFromStops = (stopIds: string[]): string | null => {
    const relatedLoadIds = Array.from(
      new Set(
        stopIds
          .map((stopId) => getLoadIdFromStopId(stopId))
          .filter((loadId): loadId is string => loadId !== null),
      ),
    );

    return relatedLoadIds.length === 1 ? relatedLoadIds[0] : null;
  };

  const handleSelectLoad = (loadId: string) => {
    const relatedStopIds = sidebarStops
      .filter((stop) => stop.loadId === loadId)
      .map((stop) => stop.id);

    setSelectedLoadId(loadId);
    setSelectedStops(relatedStopIds);
    setEditingLoadId(null);

    if (relatedStopIds.length > 0) {
      setSelectedCargoStopId(relatedStopIds[0]);
    }
  };

  const clearLoadSelection = () => {
    setSelectedLoadId(null);
    setSelectedStops([]);
  };

  const handleSelectStop = (id: string, multiSelect: boolean) => {
    if (multiSelect) {
      setSelectedStops((prev) => {
        const nextStops = prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id];
        setSelectedLoadId(deriveSelectedLoadIdFromStops(nextStops));
        return nextStops;
      });
    } else {
      setSelectedStops([id]);
      setSelectedLoadId(getLoadIdFromStopId(id));
    }
  };

  const handleSidebarStopTranseuAction = (stopId: string, shouldEdit = false) => {
    const stop = sidebarStops.find((currentStop) => currentStop.id === stopId);
    if (!stop) return;

    const linkField: TranseuLinkField =
      stop.type === 'pickup' ? 'originTranseuLink' : 'destTranseuLink';
    handleTranseuLinkAction(stop.loadId, linkField, shouldEdit);
  };

  const handleReorderStops = (fromIndex: number, toIndex: number) => {
    // Work with the sorted sidebar stops
    const reordered = [...sidebarStops];
    const [movedStop] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, movedStop);
    
    // Renumber all stops
    const renumbered = reordered.map((stop, idx) => ({ ...stop, number: idx + 1 }));
    
    // Update active stops with new numbers
    setStops(prev => prev.map(stop => {
      const updated = renumbered.find(r => r.id === stop.id);
      return updated ? { ...stop, number: updated.number } : stop;
    }));
  };

  const changeLoadStatus = (id: string, status: PlannerLoad['status']) => {
    const currentLoad = loads.find((load) => load.id === id);
    if (!currentLoad || currentLoad.status === status) return;

    if (status === 'TAKEN' && !selectedTrip) {
      setLastPlannerSyncError('Select an active trip before moving a load to TAKEN.');
      return;
    }

    const nextTripId =
      status === 'TAKEN' ? selectedTrip || currentLoad.tripId : currentLoad.tripId;
    const nextLoad: PlannerLoad = {
      ...currentLoad,
      status,
      ...(nextTripId ? { tripId: nextTripId } : {}),
    };

    setLoads((prev) =>
      prev.map((load) => (load.id === id ? nextLoad : load)),
    );

    const isPlannedStatus = (loadStatus: PlannerLoad['status']) =>
      loadStatus === 'TAKEN' || loadStatus === 'NEGOTIATING';
    const wasPlanned = isPlannedStatus(currentLoad.status);
    const isPlanned = isPlannedStatus(status);
    const gainedTripAssignment = !currentLoad.tripId && !!nextTripId;

    if (
      isPlanned &&
      nextLoad.tripId &&
      (!wasPlanned || gainedTripAssignment)
    ) {
      handleLoadToVan(nextLoad);
    } else if (!isPlanned && wasPlanned) {
      handleRemoveFromVan(nextLoad);
    }
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

  // Handle Load to Van - creates pickup and delivery stops immediately
  const handleLoadToVan = useCallback((load: PlannerLoad) => {
    if (!load.tripId) return;

    // Check if this load is already in the route (prevent duplicates)
    const alreadyLoaded = stops.some(stop => stop.loadId === load.id);
    if (alreadyLoaded) {
      return;
    }

    const nextStopNumber =
      stops.reduce((max, stop) => Math.max(max, stop.number), 0) + 1;

    // Create pickup stop
    const pickupStop: CanvasStop = {
      id: `S-${load.id}-pickup`,
      number: nextStopNumber,
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
      y: 100 + (nextStopNumber - 1) * 180,
    };

    // Create delivery stop
    const deliveryStop: CanvasStop = {
      id: `S-${load.id}-delivery`,
      number: nextStopNumber + 1,
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
      y: 100 + nextStopNumber * 180,
    };

    setStops(prev => [...prev, pickupStop, deliveryStop]);
  }, [stops]);

  // Handle Remove from Van - removes stops from active route
  const handleRemoveFromVan = useCallback((load: PlannerLoad) => {
    // Remove stops associated with this load from active stops
    setStops(prev => prev.filter(stop => stop.loadId !== load.id));
  }, []);

  const normalizeOrganizerStatus = (status: PlannerLoad['status']): OrganizerStatus =>
    status === 'TAKEN' || status === 'NEGOTIATING' ? status : 'ON BOARD';

  const inactiveLoads = visiblePlannerLoads.filter((load) => load.isInactive);
  const getOrganizerLoads = (status: OrganizerStatus) =>
    visiblePlannerLoads.filter((load) => !load.isInactive && load.status === status);
  const editingLoad = editingLoadId
    ? loads.find((load) => load.id === editingLoadId) ?? null
    : null;
  const editingPalletLoad = editingPalletLoadId
    ? loads.find((load) => load.id === editingPalletLoadId) ?? null
    : null;

  const handleSetLoadInactive = (loadId: string) => {
    const load = loads.find((currentLoad) => currentLoad.id === loadId);
    if (!load || load.isInactive) return;

    setLoads((prev) =>
      prev.map((currentLoad) =>
        currentLoad.id === loadId ? { ...currentLoad, isInactive: true } : currentLoad,
      ),
    );
    handleRemoveFromVan(load);
    setEditingLoadId((current) => (current === loadId ? null : current));
    setEditingPalletLoadId((current) => (current === loadId ? null : current));
  };

  const handleReactivateLoad = (loadId: string, preferredStatus?: OrganizerStatus) => {
    const load = loads.find((currentLoad) => currentLoad.id === loadId);
    if (!load) return;

    const targetStatus = preferredStatus ?? normalizeOrganizerStatus(load.status);
    if (targetStatus === 'TAKEN' && !selectedTrip && !load.tripId) {
      setLastPlannerSyncError('Select an active trip before moving a load to TAKEN.');
      return;
    }

    const nextTripId =
      targetStatus === 'TAKEN' ? selectedTrip || load.tripId : load.tripId;
    const reactivatedLoad: PlannerLoad = {
      ...load,
      isInactive: false,
      status: targetStatus,
      ...(nextTripId ? { tripId: nextTripId } : {}),
    };

    setLoads((prev) =>
      prev.map((currentLoad) =>
        currentLoad.id === loadId ? reactivatedLoad : currentLoad,
      ),
    );

    if ((targetStatus === 'TAKEN' || targetStatus === 'NEGOTIATING') && reactivatedLoad.tripId) {
      handleLoadToVan(reactivatedLoad);
    } else {
      handleRemoveFromVan(reactivatedLoad);
    }
  };

  const handleOpenLoadEditor = (loadId: string) => {
    setEditingPalletLoadId(null);
    setEditingLoadId(loadId);
  };

  const handleCloseLoadEditor = () => {
    setEditingLoadId(null);
  };

  const handleOpenPalletEditor = (loadId: string) => {
    setEditingLoadId(null);
    setEditingPalletLoadId(loadId);
  };

  const handleClosePalletEditor = () => {
    setEditingPalletLoadId(null);
  };

  const syncLoadCargoToStops = (loadId: string, pallets: number, weight: number) => {
    setStops((prev) =>
      prev.map((stop) =>
        stop.loadId === loadId
          ? {
              ...stop,
              pallets,
              weight,
            }
          : stop,
      ),
    );
  };

  const handleSaveLoadEditor = (updatedLoad: PlannerLoad) => {
    const currentLoad = loads.find((load) => load.id === updatedLoad.id);
    if (!currentLoad) {
      setEditingLoadId(null);
      return;
    }

    if (updatedLoad.status === 'TAKEN' && !selectedTrip && !updatedLoad.tripId) {
      setLastPlannerSyncError('Select an active trip before moving a load to TAKEN.');
      return;
    }

    const nextTripId =
      updatedLoad.status === 'TAKEN'
        ? selectedTrip || updatedLoad.tripId || currentLoad.tripId
        : updatedLoad.tripId || currentLoad.tripId;

    const normalizedUpdatedLoad: PlannerLoad = {
      ...updatedLoad,
      isInactive: false,
      ...(nextTripId ? { tripId: nextTripId } : {}),
    };

    setLoads((prev) =>
      prev.map((load) => (load.id === updatedLoad.id ? normalizedUpdatedLoad : load)),
    );
    syncLoadCargoToStops(
      normalizedUpdatedLoad.id,
      normalizedUpdatedLoad.pallets,
      normalizedUpdatedLoad.weight,
    );

    const isPlannedStatus = (status: PlannerLoad['status']) =>
      status === 'TAKEN' || status === 'NEGOTIATING';
    const wasPlanned = isPlannedStatus(currentLoad.status);
    const isPlanned = isPlannedStatus(normalizedUpdatedLoad.status);
    const gainedTripAssignment = !currentLoad.tripId && !!normalizedUpdatedLoad.tripId;

    if (
      isPlanned &&
      normalizedUpdatedLoad.tripId &&
      (!wasPlanned || gainedTripAssignment)
    ) {
      handleLoadToVan(normalizedUpdatedLoad);
    } else if (!isPlanned && wasPlanned) {
      handleRemoveFromVan(normalizedUpdatedLoad);
    }

    setEditingLoadId(null);
  };

  const handleSavePalletEditor = (
    loadId: string,
    payload: {
      pallets: number;
      weight: number;
      palletDimensions: Array<{ width: number; height: number; weightKg?: number }>;
    },
  ) => {
    const safePallets = Math.max(0, Math.round(payload.pallets));
    const safeWeight = Math.max(0, Math.round(payload.weight));
    const normalizedIncomingPallets: PalletDimensions[] = payload.palletDimensions.map((pallet) => {
      const normalizedWeight =
        typeof pallet.weightKg === 'number' && Number.isFinite(pallet.weightKg)
          ? Math.max(0, Number(pallet.weightKg.toFixed(2)))
          : undefined;

      return {
        width: Math.max(10, Math.min(300, Math.round(pallet.width || 120))),
        height: Math.max(10, Math.min(300, Math.round(pallet.height || 80))),
        ...(normalizedWeight !== undefined ? { weightKg: normalizedWeight } : {}),
      };
    });
    const nextPalletDimensions =
      normalizedIncomingPallets.length > safePallets
        ? normalizedIncomingPallets.slice(0, safePallets)
        : [
            ...normalizedIncomingPallets,
            ...createDefaultPalletDimensions(safePallets - normalizedIncomingPallets.length),
          ];

    setLoads((prev) =>
      prev.map((load) =>
        load.id === loadId
          ? {
              ...load,
              pallets: safePallets,
              weight: safeWeight,
              palletDimensions: nextPalletDimensions,
            }
          : load,
      ),
    );
    syncLoadCargoToStops(loadId, safePallets, safeWeight);
    setEditingPalletLoadId(null);
  };

  const formatLoadAddressLine = (city: string, address?: string) =>
    `DE, ${extractPostcode(address)}, ${city}`;

  const handleCopyAddress = async (text: string): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Ignore clipboard failures in unsupported environments.
      return false;
    }
  };

  const handleCopyAddressWithFeedback = async (copyKey: string, text: string) => {
    const didCopy = await handleCopyAddress(text);
    if (!didCopy) return;

    setCopiedIndicatorKey(copyKey);
    window.setTimeout(() => {
      setCopiedIndicatorKey((current) => (current === copyKey ? null : current));
    }, 1200);
  };

  const normalizeExternalLink = (raw: string): string | null => {
    const trimmed = raw.trim();
    if (!trimmed) return null;

    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    try {
      const parsed = new URL(withProtocol);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return null;
      }
      return parsed.toString();
    } catch {
      return null;
    }
  };

  const updateLoadTranseuLink = (
    loadId: string,
    field: TranseuLinkField,
    value: string,
  ) => {
    setLoads((prev) =>
      prev.map((load) => (load.id === loadId ? { ...load, [field]: value } : load)),
    );
  };

  const handleTranseuLinkAction = (
    loadId: string,
    field: TranseuLinkField,
    shouldEdit = false,
  ) => {
    const load = loads.find((currentLoad) => currentLoad.id === loadId);
    if (!load) return;

    const existingLink = load[field];
    if (existingLink && !shouldEdit) {
      window.open(existingLink, '_blank', 'noopener,noreferrer');
      return;
    }

    const enteredLink = window.prompt(
      existingLink ? 'Edit Transeu link URL' : 'Enter Transeu link URL',
      existingLink ?? '',
    );
    if (enteredLink === null) return;

    const normalizedLink = normalizeExternalLink(enteredLink);
    if (!normalizedLink) return;

    updateLoadTranseuLink(loadId, field, normalizedLink);
  };

  const updateLoadAddress = (
    loadId: string,
    field: 'originAddress' | 'destAddress',
    value: string,
  ) => {
    setLoads((prev) =>
      prev.map((load) => (load.id === loadId ? { ...load, [field]: value } : load)),
    );
  };

  const addLoadExtraStop = (loadId: string) => {
    setLoads((prev) =>
      prev.map((load) => {
        if (load.id !== loadId) return load;
        return {
          ...load,
          extraStops: [
            ...ensureLoadExtraStops(load),
            {
              address: '',
              pallets: 1,
              action: 'dropoff',
            },
          ],
        };
      }),
    );
  };

  const updateLoadExtraStopAddress = (loadId: string, stopIndex: number, value: string) => {
    setLoads((prev) =>
      prev.map((load) => {
        if (load.id !== loadId) return load;

        const nextStops = ensureLoadExtraStops(load).map((stop, index) =>
          index === stopIndex ? { ...stop, address: value } : stop,
        );

        return {
          ...load,
          extraStops: nextStops,
        };
      }),
    );
  };

  const updateLoadExtraStopAction = (
    loadId: string,
    stopIndex: number,
    action: 'pickup' | 'dropoff',
  ) => {
    setLoads((prev) =>
      prev.map((load) => {
        if (load.id !== loadId) return load;

        const nextStops = ensureLoadExtraStops(load).map((stop, index) =>
          index === stopIndex ? { ...stop, action } : stop,
        );

        return {
          ...load,
          extraStops: nextStops,
        };
      }),
    );
  };

  const updateLoadExtraStopPallets = (
    loadId: string,
    stopIndex: number,
    pallets: number,
  ) => {
    const safePallets = Number.isFinite(pallets) ? Math.max(0, Math.round(pallets)) : 0;

    setLoads((prev) =>
      prev.map((load) => {
        if (load.id !== loadId) return load;

        const nextStops = ensureLoadExtraStops(load).map((stop, index) =>
          index === stopIndex ? { ...stop, pallets: safePallets } : stop,
        );

        return {
          ...load,
          extraStops: nextStops,
        };
      }),
    );
  };

  const removeLoadExtraStop = (loadId: string, stopIndex: number) => {
    setLoads((prev) =>
      prev.map((load) => {
        if (load.id !== loadId) return load;

        const nextStops = ensureLoadExtraStops(load).filter((_, index) => index !== stopIndex);

        return {
          ...load,
          extraStops: nextStops,
        };
      }),
    );
  };

  const updateLoadWeight = (loadId: string, value: number) => {
    const safeValue = Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
    setLoads((prev) =>
      prev.map((load) => (load.id === loadId ? { ...load, weight: safeValue } : load)),
    );
  };

  const updateLoadPrice = (loadId: string, value: number) => {
    const safeValue = Number.isFinite(value) ? Math.max(0, Number(value.toFixed(2))) : 0;
    setLoads((prev) =>
      prev.map((load) => (load.id === loadId ? { ...load, price: safeValue } : load)),
    );
  };

  const updateLoadPalletDimension = (
    loadId: string,
    palletIndex: number,
    dimension: 'width' | 'height',
    value: number,
  ) => {
    const safeValue = Number.isFinite(value) ? Math.max(10, Math.min(300, Math.round(value))) : 10;

    setLoads((prev) =>
      prev.map((load) => {
        if (load.id !== loadId) return load;

        const nextPallets = ensureLoadPalletDimensions(load).map((pallet, index) =>
          index === palletIndex ? { ...pallet, [dimension]: safeValue } : pallet,
        );

        return {
          ...load,
          pallets: nextPallets.length,
          palletDimensions: nextPallets,
        };
      }),
    );
  };

  const handleOrganizerDragStart = (
    event: React.DragEvent<HTMLElement>,
    loadId: string,
  ) => {
    const target = event.target as HTMLElement | null;
    if (
      target?.closest(
        'button, input, textarea, select, option, a, label, [data-no-drag="true"]',
      )
    ) {
      event.preventDefault();
      return;
    }

    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/load-id', loadId);
    setDraggingLoadId(loadId);
    setEditingLoadId(null);
  };

  const handleOrganizerDragEnd = () => {
    setDraggingLoadId(null);
    setDragOverStatus(null);
  };

  const handleOrganizerDragOver = (
    event: React.DragEvent<HTMLElement>,
    status: OrganizerStatus,
  ) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDragOverStatus(status);
  };

  const handleOrganizerDrop = (
    event: React.DragEvent<HTMLElement>,
    status: OrganizerStatus,
  ) => {
    event.preventDefault();
    const loadId = event.dataTransfer.getData('text/load-id');
    if (loadId) {
      changeLoadStatus(loadId, status);
    }
    setDragOverStatus(null);
    setDraggingLoadId(null);
  };

  // Calculate route summaries for comparison
  const calculateRouteSummaries = () => {
    const FUEL_PRICE_PER_LITER = 1.65; // €1.65 per liter
    const activeLoads = visiblePlannerLoads.filter((load) => !load.isInactive);
    const loadIdsOnRoute = new Set(stops.map((stop) => stop.loadId));

    // Get TAKEN load IDs
    const takenLoadIds = activeLoads.filter((load) => load.status === 'TAKEN').map((load) => load.id);
    
    // Toggled ON load IDs (non-TAKEN loads that are currently enabled)
    const toggledOnLoadIds = activeLoads
      .filter(
        (load) =>
          load.status !== 'TAKEN' &&
          loadedCargoIds.includes(load.id) &&
          loadIdsOnRoute.has(load.id),
      )
      .map((load) => load.id);

    // Calculate for TAKEN loads only (Current Route)
    const takenLoads = activeLoads.filter((load) => takenLoadIds.includes(load.id));
    const currentTotalKm = takenLoads.reduce((sum, load) => sum + load.distance, 0);
    const currentFuelLiters = Math.round(currentTotalKm * 0.35);
    const currentFuelCost = Math.round(currentFuelLiters * FUEL_PRICE_PER_LITER);
    const currentRevenue = takenLoads.reduce((sum, load) => sum + load.price, 0);
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

    // Calculate for TAKEN + toggled ON loads
    const toggledOnIncludedIds = [...takenLoadIds, ...toggledOnLoadIds];
    const toggledOnLoads = activeLoads.filter((load) => toggledOnIncludedIds.includes(load.id));
    const toggledOnTotalKm = toggledOnLoads.reduce((sum, load) => sum + load.distance, 0);
    const toggledOnFuelLiters = Math.round(toggledOnTotalKm * 0.35);
    const toggledOnFuelCost = Math.round(toggledOnFuelLiters * FUEL_PRICE_PER_LITER);
    const toggledOnRevenue = toggledOnLoads.reduce((sum, load) => sum + load.price, 0);
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
    const allLoads = activeLoads;
    const everythingTotalKm = allLoads.reduce((sum, load) => sum + load.distance, 0);
    const everythingFuelLiters = Math.round(everythingTotalKm * 0.35);
    const everythingFuelCost = Math.round(everythingFuelLiters * FUEL_PRICE_PER_LITER);
    const everythingRevenue = allLoads.reduce((sum, load) => sum + load.price, 0);
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
  const hasSelectedStops = selectedStops.length > 0;

  const organizerMapPoints = sidebarStops.map((stop, index, allStops) => {
    if (allStops.length === 1) {
      return { stop, x: 50, y: 50 };
    }

    const t = index / (allStops.length - 1);
    const x = 10 + t * 80;
    const yBase = 20 + Math.sin(t * Math.PI) * 55;
    const yOffset = index % 2 === 0 ? -6 : 6;
    const y = Math.max(8, Math.min(92, yBase + yOffset));

    return { stop, x, y };
  });
  const organizerMapPath = organizerMapPoints.map((point) => `${point.x},${point.y}`).join(' ');

  return (
    <div className="h-screen flex flex-col bg-[#F8FAFC]">
        <ThinModuleMenu />
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
            <TripSelector
              selectedTripId={selectedTrip}
              onTripChange={setSelectedTrip}
            />

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

        {/* Main Content Area */}
        <div className="flex-1 flex overflow-hidden" onClick={clearLoadSelection}>
          {/* Right Sidebar - Route Stops */}
          <div className="order-last flex w-80 flex-col overflow-hidden border-l border-gray-300 bg-white">
            {/* Sidebar Header */}
            <div className="relative z-10 bg-gray-50 border-b border-gray-300 px-4 py-3">
              <h2 className="font-semibold text-sm text-gray-900">
                {routeMode === 'simulation' ? 'Simulation Route' : 'Route Stops'}
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">Click to select, drag to reorder</p>

              {/* Reserve controls space to prevent layout jump on first select/deselect */}
              <div className="mt-2 min-h-8">
                <div
                  className={`flex gap-2 transition-opacity ${
                    hasSelectedStops ? 'opacity-100' : 'pointer-events-none opacity-0'
                  }`}
                >
                  <button
                    type="button"
                    disabled
                    className="flex-1 rounded border border-slate-300 bg-slate-100 px-2 py-1.5 text-xs font-semibold text-slate-600"
                    title="Isolate selected stops (coming soon)"
                  >
                    Isolate ({selectedStops.length})
                  </button>
                </div>
              </div>
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
                const load = visiblePlannerLoads.find(l => l.id === stop.loadId);
                const previousStop = index > 0 ? sidebarStops[index - 1] : null;
                const segmentKmValue = previousStop
                  ? Math.max(0, Math.round(previousStop.distanceToNext ?? 0))
                  : 0;
                const segmentKmLabel = segmentKmValue > 0 ? `${segmentKmValue} km` : '— km';
                const isInCargo = load?.status !== 'TAKEN' && loadedCargoIds.includes(stop.loadId); // Blue dot for non-TAKEN loads that are loaded
                const showToggle = load?.status !== 'TAKEN'; // Only show toggle for non-TAKEN loads
                return (
                  <div key={stop.id} onClick={(event) => event.stopPropagation()}>
                    {/* Cargo View Icon - Divider line with eye icon */}
                    <div className="relative h-px bg-gray-200 z-50">
                      {index > 0 && (
                        <span className="pointer-events-none absolute right-11 top-1/2 -translate-y-1/2 rounded bg-white px-1 text-[10px] font-medium text-gray-400">
                          {segmentKmLabel}
                        </span>
                      )}
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

                    <SidebarStopCard
                      stop={stop}
                      index={index}
                      draggingIndex={draggingSidebarStopIndex}
                      isSelected={selectedStops.includes(stop.id)}
                      isInCargo={isInCargo}
                      onSelect={handleSelectStop}
                      onReorder={handleReorderStops}
                      onDraggingIndexChange={setDraggingSidebarStopIndex}
                      onTranseuAction={handleSidebarStopTranseuAction}
                      onToggleCargo={showToggle ? (stopId) => {
                        const routeStop = stops.find(s => s.id === stopId);
                        if (!routeStop) return;

                        // Toggle cargo visibility
                        setLoadedCargoIds(prev =>
                          prev.includes(routeStop.loadId)
                            ? prev.filter(id => id !== routeStop.loadId)
                            : [...prev, routeStop.loadId]
                        );
                      } : undefined}
                    />
                  </div>
                );
              })}
            </div>

          </div>

          <div className="grid h-full flex-1 min-w-0 grid-cols-[50%_50%] overflow-hidden">
              <aside className="min-w-0 bg-white border-r border-gray-300 flex flex-col">
                <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-semibold text-gray-900">Route Status Organizer</h2>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Drag cards between boards to change route status.
                      </p>
                      {isApiConnected && (
                        <p className="mt-0.5 text-[11px] text-gray-500">
                          {isSavingPlanner ? 'Saving changes...' : 'Saved to backend'}
                        </p>
                      )}
                      {lastPlannerSyncError && (
                        <p className="mt-0.5 text-[11px] text-red-600">
                          Sync error: {lastPlannerSyncError}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => setIsInactiveModalOpen(true)}
                      className="shrink-0 px-2.5 py-1.5 text-[11px] font-semibold border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      {`Show Inactive (${inactiveLoads.length})`}
                    </button>
                  </div>
                </div>

                <div className="flex-1 min-h-0 p-3 flex flex-col gap-3">
                  <div className="min-h-0 flex-1 grid grid-cols-2 grid-rows-[minmax(0,3fr)_minmax(0,1fr)] gap-3">
                    {ORGANIZER_STATUSES.map((status) => {
                      const statusLoads = getOrganizerLoads(status);
                      const statusStyle =
                        status === 'TAKEN'
                          ? 'border-blue-300 bg-blue-50'
                          : status === 'NEGOTIATING'
                            ? 'border-emerald-300 bg-emerald-50'
                            : 'border-slate-300 bg-slate-50';
                      const layoutStyle = status === 'TAKEN' ? 'col-span-2' : '';

                      return (
                        <section
                          key={status}
                          onDragOver={(event) => handleOrganizerDragOver(event, status)}
                          onDrop={(event) => handleOrganizerDrop(event, status)}
                          onDragLeave={() => setDragOverStatus(null)}
                          className={`min-h-0 rounded-xl border p-3 transition-colors flex flex-col ${layoutStyle} ${
                            dragOverStatus === status ? 'ring-2 ring-blue-400 ring-offset-1' : ''
                          } ${statusStyle}`}
                        >
                          <div className="flex items-center justify-between">
                            <h3 className="text-xs font-semibold tracking-wide text-gray-900">
                              {status}
                            </h3>
                            <span className="text-xs text-gray-600">{statusLoads.length}</span>
                          </div>

                          <div
                            className={`mt-2 min-h-0 overflow-x-hidden overflow-y-auto pr-1 ${
                              status === 'TAKEN'
                                ? 'grid grid-cols-4 gap-2 content-start items-start auto-rows-max'
                                : 'grid grid-cols-2 gap-2 content-start items-start auto-rows-max'
                            }`}
                          >
                            {statusLoads.length === 0 && (
                              <p
                                className={`rounded-lg border border-dashed border-gray-300 bg-white/70 px-2 py-3 text-center text-xs text-gray-500 ${
                                  status === 'TAKEN' ? 'col-span-4' : 'col-span-2'
                                }`}
                              >
                                Drop routes here
                              </p>
                            )}

                            {statusLoads.map((load) => {
                              const pricePerKm = load.distance > 0 ? load.price / load.distance : 0;
                              const pickupAddressLine = formatLoadAddressLine(
                                load.originCity,
                                load.originAddress,
                              );
                              const deliveryAddressLine = formatLoadAddressLine(
                                load.destCity,
                                load.destAddress,
                              );
                              const loadRouteStops = combinedStops
                                .filter(
                                  (stop) =>
                                    stop.loadId === load.id &&
                                    (stop.type === 'pickup' || stop.type === 'delivery'),
                                )
                                .sort((a, b) => a.number - b.number);
                              const pickupStop = loadRouteStops.find((stop) => stop.type === 'pickup');
                              const deliveryStop = loadRouteStops.find((stop) => stop.type === 'delivery');
                              const pickupScheduleLabel = formatDateTimeRange(
                                load.pickupWindowStart ?? load.pickupDate,
                                load.pickupWindowEnd,
                                pickupStop?.eta,
                              );
                              const deliveryScheduleLabel = formatDateTimeRange(
                                load.deliveryWindowStart ?? load.deliveryDate,
                                load.deliveryWindowEnd,
                                deliveryStop?.eta,
                              );
                              const pickupHasTranseuLink = Boolean(load.originTranseuLink);
                              const deliveryHasTranseuLink = Boolean(load.destTranseuLink);
                              const pickupLineCopyKey = `load-${load.id}-pickup-line`;
                              const deliveryLineCopyKey = `load-${load.id}-delivery-line`;

                              return (
                                <article
                                  key={load.id}
                                  draggable
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleSelectLoad(load.id);
                                  }}
                                  onDragStart={(event) => handleOrganizerDragStart(event, load.id)}
                                  onDragEnd={handleOrganizerDragEnd}
                                  className={`w-full max-w-full min-w-0 self-start overflow-hidden rounded-lg border bg-white p-3 shadow-sm transition ${
                                    selectedLoadId === load.id
                                      ? 'border-blue-400 ring-2 ring-blue-200'
                                      : 'border-gray-200'
                                  } ${
                                    draggingLoadId === load.id ? 'opacity-50' : 'hover:shadow-md'
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="min-w-0">
                                      <p
                                        className="truncate text-sm font-semibold"
                                        style={{ color: load.color }}
                                      >
                                        {load.brokerage}
                                      </p>
                                      <p className="truncate text-[11px] text-gray-500">
                                        {load.contactPerson || 'Broker name not set'}
                                      </p>
                                    </div>
                                    <div className="relative flex items-center gap-1">
                                      <button
                                        onMouseDown={(event) => event.stopPropagation()}
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          handleOpenLoadEditor(load.id);
                                        }}
                                        className="rounded border border-gray-300 bg-white p-1 text-gray-600 hover:bg-gray-100 hover:text-gray-800"
                                        title="Edit load"
                                      >
                                        <Pencil className="h-3.5 w-3.5" />
                                      </button>
                                      <button
                                        onMouseDown={(event) => event.stopPropagation()}
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          handleSetLoadInactive(load.id);
                                        }}
                                        className="rounded border border-red-300 bg-white p-1 text-red-600 hover:bg-red-50 hover:text-red-700"
                                        title="Mark inactive"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  </div>

                                  <div className="mt-1 space-y-1">
                                    <div className="space-y-0.5">
                                      <div className="flex items-center justify-between gap-1">
                                        <button
                                          type="button"
                                          onMouseDown={(event) => event.stopPropagation()}
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            handleCopyAddressWithFeedback(
                                              pickupLineCopyKey,
                                              load.originAddress || pickupAddressLine,
                                            );
                                          }}
                                          className="truncate text-left text-[11px] text-gray-600 hover:text-gray-800"
                                          title="Copy pickup line"
                                        >
                                          {pickupAddressLine}
                                        </button>
                                        <div className="flex items-center gap-0.5">
                                          <button
                                            onMouseDown={(event) => event.stopPropagation()}
                                            onClick={(event) => {
                                              event.stopPropagation();
                                              handleTranseuLinkAction(
                                                load.id,
                                                'originTranseuLink',
                                                event.altKey,
                                              );
                                            }}
                                            className={`rounded p-0.5 transition-colors ${
                                              pickupHasTranseuLink
                                                ? 'text-blue-600 hover:bg-blue-50 hover:text-blue-700'
                                                : 'text-gray-300 hover:bg-gray-100 hover:text-gray-500'
                                            }`}
                                            title={
                                              pickupHasTranseuLink
                                                ? 'Open Transeu link (Alt+Click to edit)'
                                                : 'Add Transeu link'
                                            }
                                          >
                                            <ExternalLink className="h-3.5 w-3.5" />
                                          </button>
                                          <button
                                            onMouseDown={(event) => event.stopPropagation()}
                                            onClick={(event) => {
                                              event.stopPropagation();
                                              handleCopyAddressWithFeedback(
                                                pickupLineCopyKey,
                                                load.originAddress || pickupAddressLine,
                                              );
                                            }}
                                            className={`rounded p-0.5 transition-colors ${
                                              copiedIndicatorKey === pickupLineCopyKey
                                                ? 'bg-emerald-50 text-emerald-600'
                                                : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700'
                                            }`}
                                            title="Copy pickup line"
                                          >
                                            <Copy className="h-3.5 w-3.5" />
                                          </button>
                                        </div>
                                      </div>
                                      <p className="text-[10px] text-gray-500">{pickupScheduleLabel}</p>
                                    </div>
                                    <div className="space-y-0.5">
                                      <div className="flex items-center justify-between gap-1">
                                        <button
                                          type="button"
                                          onMouseDown={(event) => event.stopPropagation()}
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            handleCopyAddressWithFeedback(
                                              deliveryLineCopyKey,
                                              load.destAddress || deliveryAddressLine,
                                            );
                                          }}
                                          className="truncate text-left text-[11px] text-gray-600 hover:text-gray-800"
                                          title="Copy delivery line"
                                        >
                                          {deliveryAddressLine}
                                        </button>
                                        <div className="flex items-center gap-0.5">
                                          <button
                                            onMouseDown={(event) => event.stopPropagation()}
                                            onClick={(event) => {
                                              event.stopPropagation();
                                              handleTranseuLinkAction(
                                                load.id,
                                                'destTranseuLink',
                                                event.altKey,
                                              );
                                            }}
                                            className={`rounded p-0.5 transition-colors ${
                                              deliveryHasTranseuLink
                                                ? 'text-blue-600 hover:bg-blue-50 hover:text-blue-700'
                                                : 'text-gray-300 hover:bg-gray-100 hover:text-gray-500'
                                            }`}
                                            title={
                                              deliveryHasTranseuLink
                                                ? 'Open Transeu link (Alt+Click to edit)'
                                                : 'Add Transeu link'
                                            }
                                          >
                                            <ExternalLink className="h-3.5 w-3.5" />
                                          </button>
                                          <button
                                            onMouseDown={(event) => event.stopPropagation()}
                                            onClick={(event) => {
                                              event.stopPropagation();
                                              handleCopyAddressWithFeedback(
                                                deliveryLineCopyKey,
                                                load.destAddress || deliveryAddressLine,
                                              );
                                            }}
                                            className={`rounded p-0.5 transition-colors ${
                                              copiedIndicatorKey === deliveryLineCopyKey
                                                ? 'bg-emerald-50 text-emerald-600'
                                                : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700'
                                            }`}
                                            title="Copy delivery line"
                                          >
                                            <Copy className="h-3.5 w-3.5" />
                                          </button>
                                        </div>
                                      </div>
                                      <p className="text-[10px] text-gray-500">{deliveryScheduleLabel}</p>
                                    </div>
                                  </div>

                                  <button
                                    type="button"
                                    onMouseDown={(event) => event.stopPropagation()}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      handleOpenPalletEditor(load.id);
                                    }}
                                    className="mt-2 flex w-full items-center justify-between rounded border border-gray-200 bg-gray-50 px-2 py-1 text-left text-xs text-gray-700 hover:bg-gray-100"
                                    title="Edit pallets and weight"
                                  >
                                    <span>
                                      {load.pallets} pallets • {load.weight} kg
                                    </span>
                                  </button>

                                  <div className="mt-2 grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded border border-gray-200 bg-gray-50 px-2 py-1.5 text-[11px] font-semibold text-gray-800 tabular-nums">
                                    <span className="text-left">{load.distance} km</span>
                                    <span className="pl-1 text-left">{pricePerKm.toFixed(2)}€/km</span>
                                    <div className="flex items-center justify-end">
                                      <input
                                        type="number"
                                        min={0}
                                        step="0.01"
                                        value={load.price}
                                        onMouseDown={(event) => event.stopPropagation()}
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          event.currentTarget.select();
                                        }}
                                        onFocus={(event) => event.currentTarget.select()}
                                        onChange={(event) =>
                                          updateLoadPrice(load.id, Number(event.target.value))
                                        }
                                        className="w-14 rounded border border-gray-300 bg-white px-1.5 py-0.5 text-right text-[11px] font-semibold text-gray-900"
                                      />
                                    </div>
                                  </div>

                                </article>
                              );
                            })}
                          </div>
                        </section>
                      );
                    })}
                  </div>

                </div>
              </aside>

              <section className="min-w-0 flex flex-col bg-[radial-gradient(circle_at_top_left,_#dbeafe_0%,_#f8fafc_45%,_#eef2ff_100%)]">
                <div className="border-b border-slate-300 bg-white/80 px-4 py-3 backdrop-blur-sm">
                  <div className="inline-flex items-center border border-slate-300 bg-white p-1">
                    <button
                      onClick={() => setMiddleWorkspaceTab('load-planner')}
                      className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                        middleWorkspaceTab === 'load-planner'
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      Load Planner
                    </button>
                    <button
                      onClick={() => setMiddleWorkspaceTab('maps')}
                      className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                        middleWorkspaceTab === 'maps'
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      Maps
                    </button>
                  </div>
                </div>

                <div className="min-h-0 flex-1 grid grid-rows-[minmax(0,3fr)_minmax(0,1fr)]">
                  <div className="min-h-0 overflow-auto">
                    {middleWorkspaceTab === 'load-planner' && (
                      <div className="mx-auto h-full min-w-[880px] max-w-[1280px] p-6">
                        <div className="relative h-full min-h-[680px] rounded-2xl border border-slate-300 bg-white/70 shadow-inner backdrop-blur-sm">
                          <CanvasVanCargo
                            vanId={selectedTrip}
                            x={organizerVanCargoPosition.x}
                            y={organizerVanCargoPosition.y}
                            onMove={(x, y) => setOrganizerVanCargoPosition({ x, y })}
                            scale={1}
                            selectedStopId={selectedCargoStopId}
                            onStopSelect={setSelectedCargoStopId}
                            routedStops={cargoRoutedStops}
                          />
                        </div>
                      </div>
                    )}

                    {middleWorkspaceTab === 'maps' && (
                      <div className="mx-auto h-full min-w-[880px] max-w-[1280px] p-6">
                        <div className="h-full min-h-[680px] rounded-2xl border border-slate-300 bg-white/80 p-4 shadow-inner backdrop-blur-sm">
                          {organizerMapPoints.length > 0 ? (
                            <div className="relative h-full overflow-hidden rounded-xl border border-slate-200 bg-[linear-gradient(130deg,#e2e8f0_0%,#f8fafc_45%,#dbeafe_100%)]">
                              <div
                                className="absolute inset-0 opacity-35"
                                style={{
                                  backgroundImage:
                                    'linear-gradient(rgba(15, 23, 42, 0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(15, 23, 42, 0.08) 1px, transparent 1px)',
                                  backgroundSize: '44px 44px',
                                }}
                              />

                              <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
                                {organizerMapPoints.length > 1 && (
                                  <polyline
                                    points={organizerMapPath}
                                    fill="none"
                                    stroke="#2563eb"
                                    strokeWidth="1.2"
                                    strokeLinejoin="round"
                                    strokeLinecap="round"
                                    strokeDasharray="0"
                                  />
                                )}

                                {organizerMapPoints.map(({ stop, x, y }) => (
                                  <g key={stop.id}>
                                    <circle cx={x} cy={y} r="2.6" fill="white" stroke={stop.color} strokeWidth="0.7" />
                                    <circle cx={x} cy={y} r="1.1" fill={stop.color} />
                                    <text
                                      x={x}
                                      y={y - 3.6}
                                      textAnchor="middle"
                                      fontSize="2.8"
                                      fill="#0f172a"
                                      fontWeight="700"
                                    >
                                      {stop.number}
                                    </text>
                                  </g>
                                ))}
                              </svg>

                              <div className="absolute left-4 top-4 max-w-[320px] rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-xs text-slate-700 shadow-sm">
                                Map preview based on current stop order.
                              </div>

                            </div>
                          ) : (
                            <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white/70 text-sm font-medium text-slate-500">
                              No stops available for map preview.
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="min-h-0 overflow-hidden border-t border-slate-300 bg-white">
                    <RouteComparison
                      currentRoute={routeComparison.currentRoute}
                      toggledOnRoute={routeComparison.toggledOnRoute}
                      everythingRoute={routeComparison.everythingRoute}
                      hasToggledLoads={routeComparison.hasToggledLoads}
                    />
                  </div>
                </div>
              </section>
            </div>
        </div>

        {isInactiveModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4 py-6"
            onClick={() => setIsInactiveModalOpen(false)}
          >
            <div
              className="flex max-h-[88vh] w-full max-w-4xl flex-col rounded-2xl border border-slate-300 bg-white shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Inactive Loads</h3>
                  <p className="text-xs text-slate-500">
                    Restore inactive loads back to organizer boards.
                  </p>
                </div>
                <button
                  onClick={() => setIsInactiveModalOpen(false)}
                  className="rounded border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Close
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                {inactiveLoads.length === 0 && (
                  <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-center text-sm text-slate-500">
                    No inactive routes.
                  </p>
                )}

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {inactiveLoads.map((load) => {
                    const pickupAddressLine = formatLoadAddressLine(
                      load.originCity,
                      load.originAddress,
                    );
                    const deliveryAddressLine = formatLoadAddressLine(
                      load.destCity,
                      load.destAddress,
                    );
                    const loadRouteStops = combinedStops
                      .filter(
                        (stop) =>
                          stop.loadId === load.id &&
                          (stop.type === 'pickup' || stop.type === 'delivery'),
                      )
                      .sort((a, b) => a.number - b.number);
                    const pickupStop = loadRouteStops.find((stop) => stop.type === 'pickup');
                    const deliveryStop = loadRouteStops.find((stop) => stop.type === 'delivery');
                    const pickupScheduleLabel = formatDateTimeRange(
                      load.pickupWindowStart ?? load.pickupDate,
                      load.pickupWindowEnd,
                      pickupStop?.eta,
                    );
                    const deliveryScheduleLabel = formatDateTimeRange(
                      load.deliveryWindowStart ?? load.deliveryDate,
                      load.deliveryWindowEnd,
                      deliveryStop?.eta,
                    );
                    const pickupHasTranseuLink = Boolean(load.originTranseuLink);
                    const deliveryHasTranseuLink = Boolean(load.destTranseuLink);
                    const pickupLineCopyKey = `inactive-load-${load.id}-pickup-line`;
                    const deliveryLineCopyKey = `inactive-load-${load.id}-delivery-line`;

                    return (
                      <article
                        key={load.id}
                        className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">
                              {load.brokerage}
                            </p>
                            <p className="truncate text-[11px] text-slate-500">
                              {load.contactPerson || 'Broker name not set'}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-0.5">
                            <span className="text-[10px] font-semibold uppercase text-slate-500">
                              {normalizeOrganizerStatus(load.status)}
                            </span>
                            <span className="text-[10px] font-semibold text-slate-400">
                              {load.referenceCode ?? load.id}
                            </span>
                          </div>
                        </div>
                        <div className="mt-1 space-y-1">
                          <div className="space-y-0.5">
                            <div className="flex items-center justify-between gap-1">
                              <button
                                type="button"
                                onClick={() =>
                                  handleCopyAddressWithFeedback(
                                    pickupLineCopyKey,
                                    load.originAddress || pickupAddressLine,
                                  )
                                }
                                className="truncate text-left text-[11px] text-slate-600 hover:text-slate-800"
                                title="Copy pickup line"
                              >
                                {pickupAddressLine}
                              </button>
                              <div className="flex items-center gap-0.5">
                                <button
                                  onClick={(event) =>
                                    handleTranseuLinkAction(
                                      load.id,
                                      'originTranseuLink',
                                      event.altKey,
                                    )
                                  }
                                  className={`rounded p-0.5 transition-colors ${
                                    pickupHasTranseuLink
                                      ? 'text-blue-600 hover:bg-blue-50 hover:text-blue-700'
                                      : 'text-slate-300 hover:bg-slate-100 hover:text-slate-500'
                                  }`}
                                  title={
                                    pickupHasTranseuLink
                                      ? 'Open Transeu link (Alt+Click to edit)'
                                      : 'Add Transeu link'
                                  }
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() =>
                                    handleCopyAddressWithFeedback(
                                      pickupLineCopyKey,
                                      load.originAddress || pickupAddressLine,
                                    )
                                  }
                                  className={`rounded p-0.5 transition-colors ${
                                    copiedIndicatorKey === pickupLineCopyKey
                                      ? 'bg-emerald-50 text-emerald-600'
                                      : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'
                                  }`}
                                  title="Copy pickup line"
                                >
                                  <Copy className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                            <p className="text-[10px] text-slate-500">{pickupScheduleLabel}</p>
                          </div>
                          <div className="space-y-0.5">
                            <div className="flex items-center justify-between gap-1">
                              <button
                                type="button"
                                onClick={() =>
                                  handleCopyAddressWithFeedback(
                                    deliveryLineCopyKey,
                                    load.destAddress || deliveryAddressLine,
                                  )
                                }
                                className="truncate text-left text-[11px] text-slate-600 hover:text-slate-800"
                                title="Copy delivery line"
                              >
                                {deliveryAddressLine}
                              </button>
                              <div className="flex items-center gap-0.5">
                                <button
                                  onClick={(event) =>
                                    handleTranseuLinkAction(
                                      load.id,
                                      'destTranseuLink',
                                      event.altKey,
                                    )
                                  }
                                  className={`rounded p-0.5 transition-colors ${
                                    deliveryHasTranseuLink
                                      ? 'text-blue-600 hover:bg-blue-50 hover:text-blue-700'
                                      : 'text-slate-300 hover:bg-slate-100 hover:text-slate-500'
                                  }`}
                                  title={
                                    deliveryHasTranseuLink
                                      ? 'Open Transeu link (Alt+Click to edit)'
                                      : 'Add Transeu link'
                                  }
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() =>
                                    handleCopyAddressWithFeedback(
                                      deliveryLineCopyKey,
                                      load.destAddress || deliveryAddressLine,
                                    )
                                  }
                                  className={`rounded p-0.5 transition-colors ${
                                    copiedIndicatorKey === deliveryLineCopyKey
                                      ? 'bg-emerald-50 text-emerald-600'
                                      : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'
                                  }`}
                                  title="Copy delivery line"
                                >
                                  <Copy className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                            <p className="text-[10px] text-slate-500">{deliveryScheduleLabel}</p>
                          </div>
                        </div>

                        <div className="mt-2 flex gap-1">
                          <button
                            onClick={() => handleReactivateLoad(load.id)}
                            className="flex-1 px-2 py-1 text-[10px] font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                          >
                            Restore
                          </button>
                          <button
                            onClick={() => handleReactivateLoad(load.id, 'ON BOARD')}
                            className="px-2 py-1 text-[10px] font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                          >
                            ON
                          </button>
                          <button
                            onClick={() => handleReactivateLoad(load.id, 'NEGOTIATING')}
                            className="px-2 py-1 text-[10px] font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                          >
                            NEG
                          </button>
                          <button
                            onClick={() => handleReactivateLoad(load.id, 'TAKEN')}
                            className="px-2 py-1 text-[10px] font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                          >
                            TAKEN
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        <UploadModal
          isOpen={showUploadModal}
          onClose={() => setShowUploadModal(false)}
          onCreated={handleFreightCreated}
          defaultTripId={selectedTrip}
        />
        <EditLoadModal
          isOpen={editingLoad !== null}
          load={editingLoad}
          onClose={handleCloseLoadEditor}
          onSave={handleSaveLoadEditor}
          onSetInactive={handleSetLoadInactive}
        />
        <PalletDetailsModal
          isOpen={editingPalletLoad !== null}
          load={editingPalletLoad}
          onClose={handleClosePalletEditor}
          onSave={handleSavePalletEditor}
        />
    </div>
  );
}
