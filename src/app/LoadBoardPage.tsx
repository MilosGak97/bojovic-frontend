import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { loadApi, vanApi } from '../api';
import type { Load, Van } from '../domain/entities';
import { LoadStatus } from '../domain/enums';
import { ThinModuleMenu } from './components/ThinModuleMenu';
import { UploadModal } from './components/UploadModal';

type LoadStatusFilter = 'ALL' | LoadStatus;

const STATUS_FILTERS: Array<{ label: string; value: LoadStatusFilter }> = [
  { label: 'All', value: 'ALL' },
  { label: 'On Board', value: LoadStatus.ON_BOARD },
  { label: 'Negotiating', value: LoadStatus.NEGOTIATING },
  { label: 'Taken', value: LoadStatus.TAKEN },
  { label: 'Delivered', value: LoadStatus.DELIVERED },
  { label: 'Canceled', value: LoadStatus.CANCELED },
];

const getStatusBadgeClass = (status: LoadStatus): string => {
  switch (status) {
    case LoadStatus.ON_BOARD:
      return 'bg-slate-100 text-slate-800';
    case LoadStatus.NEGOTIATING:
      return 'bg-emerald-100 text-emerald-800';
    case LoadStatus.TAKEN:
      return 'bg-blue-100 text-blue-800';
    case LoadStatus.DELIVERED:
      return 'bg-green-100 text-green-800';
    case LoadStatus.CANCELED:
      return 'bg-rose-100 text-rose-800';
    case LoadStatus.IN_TRANSIT:
      return 'bg-amber-100 text-amber-800';
    default:
      return 'bg-gray-100 text-gray-700';
  }
};

const formatDateTime = (value: string): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('en-GB', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatLocation = (country: string, postcode: string, city: string): string =>
  [country, postcode, city].filter(Boolean).join(', ');

const getPalletCount = (load: Load): number => {
  if (typeof load.freightDetails?.palletCount === 'number') {
    return Math.max(0, Math.round(load.freightDetails.palletCount));
  }

  return (load.pallets ?? []).reduce(
    (sum, pallet) => sum + Math.max(1, pallet.quantity ?? 1),
    0,
  );
};

const getWeightLabel = (load: Load): string => {
  if (typeof load.freightDetails?.weightTons === 'number' && load.freightDetails.weightTons > 0) {
    return `${load.freightDetails.weightTons.toFixed(3)} t`;
  }

  const kg = (load.pallets ?? []).reduce(
    (sum, pallet) => sum + (pallet.weightKg ?? 0) * Math.max(1, pallet.quantity ?? 1),
    0,
  );
  if (kg > 0) {
    return `${Math.round(kg)} kg`;
  }

  return '—';
};

const getPriceLabel = (load: Load): string => {
  const price = load.agreedPrice ?? load.publishedPrice;
  if (typeof price !== 'number') return '—';
  return `${price.toFixed(2)} ${load.currency}`;
};

const formatBoardSource = (load: Load): string => {
  switch (load.boardSource) {
    case 'TRANS_EU':
      return 'Trans.eu';
    case 'TIMOCOM':
      return 'Timocom';
    case 'MANUAL':
      return 'Manual';
    case 'OTHER':
      return 'Other';
    default:
      return '—';
  }
};

export default function LoadBoardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [loads, setLoads] = useState<Load[]>([]);
  const [statusFilter, setStatusFilter] = useState<LoadStatusFilter>('ALL');
  const [isLoading, setIsLoading] = useState(false);
  const [isCreateLoadOpen, setIsCreateLoadOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [plannerVans, setPlannerVans] = useState<Van[]>([]);
  const [isLoadingPlannerVans, setIsLoadingPlannerVans] = useState(false);
  const [plannerVansError, setPlannerVansError] = useState<string | null>(null);

  const [selectedLoadIds, setSelectedLoadIds] = useState<string[]>([]);
  const [isBulkAssignOpen, setIsBulkAssignOpen] = useState(false);
  const [bulkPlannerVanId, setBulkPlannerVanId] = useState('');
  const [bulkVehicleSearch, setBulkVehicleSearch] = useState('');
  const [isBulkAssigning, setIsBulkAssigning] = useState(false);
  const [bulkAssignError, setBulkAssignError] = useState<string | null>(null);
  const [singlePlannerLoad, setSinglePlannerLoad] = useState<Load | null>(null);
  const [singlePlannerVanId, setSinglePlannerVanId] = useState('');
  const [singleVehicleSearch, setSingleVehicleSearch] = useState('');
  const [isSingleAssigning, setIsSingleAssigning] = useState(false);
  const [singleAssignError, setSingleAssignError] = useState<string | null>(null);

  const focusedLoadId = searchParams.get('loadId')?.trim() ?? '';
  const isPaymentFocus = searchParams.get('focus') === 'payment';

  const fetchLoads = useCallback(async (filter: LoadStatusFilter) => {
    setIsLoading(true);
    setError(null);

    try {
      const pageSize = 200;
      let offset = 0;
      let total = 0;
      const collected: Load[] = [];

      do {
        const response = await loadApi.getAll({
          ...(filter !== 'ALL' ? { status: filter } : {}),
          limit: pageSize,
          offset,
        });
        total = response.total;
        collected.push(...response.data);
        offset += response.data.length;
        if (response.data.length === 0) break;
      } while (collected.length < total);

      setLoads(collected);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to load board data.');
      setLoads([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchPlannerVans = useCallback(async () => {
    setIsLoadingPlannerVans(true);
    setPlannerVansError(null);
    try {
      const response = await vanApi.getAll();
      setPlannerVans(response);
      setBulkPlannerVanId((current) => current || response[0]?.id || '');
    } catch (requestError) {
      setPlannerVans([]);
      setPlannerVansError(
        requestError instanceof Error ? requestError.message : 'Failed to load vehicles.',
      );
    } finally {
      setIsLoadingPlannerVans(false);
    }
  }, []);

  useEffect(() => {
    void fetchLoads(statusFilter);
  }, [fetchLoads, statusFilter]);

  useEffect(() => {
    void fetchPlannerVans();
  }, [fetchPlannerVans]);

  useEffect(() => {
    setSelectedLoadIds((prev) => prev.filter((id) => loads.some((load) => load.id === id)));
  }, [loads]);

  useEffect(() => {
    if (!focusedLoadId || loads.length === 0) return;

    const row = document.getElementById(`load-row-${focusedLoadId}`);
    if (row) {
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [focusedLoadId, loads]);

  const plannerVansById = useMemo(
    () => new Map(plannerVans.map((van) => [van.id, van])),
    [plannerVans],
  );

  const formatPlannerVehicle = useCallback(
    (load: Load): string => {
      if (load.plannerVan) {
        return `${load.plannerVan.name} • ${load.plannerVan.licensePlate}`;
      }
      if (load.plannerVanId) {
        const van = plannerVansById.get(load.plannerVanId);
        if (van) {
          return `${van.name} • ${van.licensePlate}`;
        }
        return 'Assigned';
      }
      return 'Not in planner';
    },
    [plannerVansById],
  );

  const summary = useMemo(
    () => ({
      total: loads.length,
      active: loads.filter((load) => !load.isInactive).length,
      inactive: loads.filter((load) => load.isInactive).length,
      inPlanner: loads.filter((load) => Boolean(load.plannerVanId)).length,
    }),
    [loads],
  );

  const areAllLoadsSelected = useMemo(
    () => loads.length > 0 && loads.every((load) => selectedLoadIds.includes(load.id)),
    [loads, selectedLoadIds],
  );

  const toggleLoadSelection = (loadId: string) => {
    setSelectedLoadIds((prev) =>
      prev.includes(loadId) ? prev.filter((id) => id !== loadId) : [...prev, loadId],
    );
  };

  const toggleSelectAllVisible = () => {
    if (areAllLoadsSelected) {
      setSelectedLoadIds([]);
      return;
    }
    setSelectedLoadIds(loads.map((load) => load.id));
  };

  const openBulkAssign = () => {
    setBulkAssignError(null);
    setBulkVehicleSearch('');
    if (!bulkPlannerVanId && plannerVans.length > 0) {
      setBulkPlannerVanId(plannerVans[0].id);
    }
    setIsBulkAssignOpen(true);
  };

  const openSingleAssign = (load: Load) => {
    setSingleAssignError(null);
    setSingleVehicleSearch('');
    setSinglePlannerLoad(load);
    setSinglePlannerVanId(load.plannerVanId ?? plannerVans[0]?.id ?? '');
  };

  const closeSingleAssign = () => {
    if (isSingleAssigning) return;
    setSinglePlannerLoad(null);
    setSinglePlannerVanId('');
    setSingleVehicleSearch('');
    setSingleAssignError(null);
  };

  const clearFocusedLoad = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('loadId');
    next.delete('focus');
    setSearchParams(next);
  };

  const handleBulkAddToPlanner = async () => {
    if (selectedLoadIds.length === 0) {
      setBulkAssignError('Select at least one load.');
      return;
    }
    if (!bulkPlannerVanId) {
      setBulkAssignError('Select a vehicle.');
      return;
    }

    setIsBulkAssigning(true);
    setBulkAssignError(null);
    try {
      await Promise.all(
        selectedLoadIds.map((loadId) =>
          loadApi.update(loadId, {
            plannerVanId: bulkPlannerVanId,
          }),
        ),
      );

      setIsBulkAssignOpen(false);
      setSelectedLoadIds([]);
      await fetchLoads(statusFilter);
    } catch (requestError) {
      setBulkAssignError(
        requestError instanceof Error ? requestError.message : 'Failed to add loads to planner.',
      );
    } finally {
      setIsBulkAssigning(false);
    }
  };

  const handleSingleAddToPlanner = async () => {
    if (!singlePlannerLoad) return;
    if (!singlePlannerVanId) {
      setSingleAssignError('Select a vehicle.');
      return;
    }

    setIsSingleAssigning(true);
    setSingleAssignError(null);

    try {
      await loadApi.update(singlePlannerLoad.id, {
        plannerVanId: singlePlannerVanId,
      });

      const selectedVan = plannerVansById.get(singlePlannerVanId) ?? null;
      setLoads((prev) =>
        prev.map((load) =>
          load.id === singlePlannerLoad.id
            ? {
                ...load,
                plannerVanId: singlePlannerVanId,
                plannerVan: selectedVan,
              }
            : load,
        ),
      );

      setSinglePlannerLoad(null);
      setSinglePlannerVanId('');
    } catch (requestError) {
      setSingleAssignError(
        requestError instanceof Error ? requestError.message : 'Failed to add load to planner.',
      );
    } finally {
      setIsSingleAssigning(false);
    }
  };

  const filteredBulkPlannerVans = useMemo(() => {
    const term = bulkVehicleSearch.trim().toLowerCase();
    if (!term) return plannerVans;
    return plannerVans.filter((van) => {
      const driverName = van.assignedDriver
        ? `${van.assignedDriver.firstName} ${van.assignedDriver.lastName}`
        : '';
      return `${van.name} ${van.vehicleId ?? ''} ${van.licensePlate} ${driverName}`
        .toLowerCase()
        .includes(term);
    });
  }, [bulkVehicleSearch, plannerVans]);

  const filteredSinglePlannerVans = useMemo(() => {
    const term = singleVehicleSearch.trim().toLowerCase();
    if (!term) return plannerVans;
    return plannerVans.filter((van) => {
      const driverName = van.assignedDriver
        ? `${van.assignedDriver.firstName} ${van.assignedDriver.lastName}`
        : '';
      return `${van.name} ${van.vehicleId ?? ''} ${van.licensePlate} ${driverName}`
        .toLowerCase()
        .includes(term);
    });
  }, [plannerVans, singleVehicleSearch]);

  return (
    <main className="min-h-screen bg-slate-100">
      <ThinModuleMenu />
      <div className="w-full px-4 py-8 sm:px-6 xl:px-8">
        <header className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Bojovic Transport
              </p>
              <h1 className="mt-1 text-2xl font-semibold text-slate-900">Load Board</h1>
              <p className="mt-1 text-sm text-slate-600">
                All uploaded loads from backend, in one list.
              </p>
              <p className="mt-2 text-xs text-slate-500">
                {summary.total} total • {summary.active} active • {summary.inactive} inactive • {summary.inPlanner}{' '}
                in planner
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setIsCreateLoadOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Plus className="h-4 w-4" />
                Create Load
              </button>
              <button
                type="button"
                onClick={openBulkAssign}
                disabled={selectedLoadIds.length === 0 || plannerVans.length === 0}
                className="inline-flex items-center gap-1.5 rounded-xl border border-blue-300 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {`Add Selected To Planner (${selectedLoadIds.length})`}
              </button>
              <button
                type="button"
                onClick={() => void fetchLoads(statusFilter)}
                disabled={isLoading}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {STATUS_FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => setStatusFilter(filter.value)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  statusFilter === filter.value
                    ? 'bg-blue-600 text-white'
                    : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {focusedLoadId && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
              <p className="text-xs text-blue-800">
                {isPaymentFocus
                  ? `Payment focus is active for load ${focusedLoadId.slice(0, 8)}...`
                  : `Focused load ${focusedLoadId.slice(0, 8)}...`}
              </p>
              <button
                type="button"
                onClick={clearFocusedLoad}
                className="rounded border border-blue-300 bg-white px-2 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-100"
              >
                Clear Focus
              </button>
            </div>
          )}
        </header>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={areAllLoadsSelected}
                      onChange={toggleSelectAllVisible}
                      disabled={loads.length === 0}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                  </th>
                  <th className="px-3 py-2">Reference</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Board</th>
                  <th className="px-3 py-2">Planner Vehicle</th>
                  <th className="px-3 py-2">Broker</th>
                  <th className="px-3 py-2">Pickup</th>
                  <th className="px-3 py-2">Delivery</th>
                  <th className="px-3 py-2 text-right">Pallets</th>
                  <th className="px-3 py-2 text-right">Weight</th>
                  <th className="px-3 py-2 text-right">Price</th>
                  <th className="px-3 py-2">Checks</th>
                  <th className="px-3 py-2">Created</th>
                </tr>
              </thead>

              <tbody>
                {isLoading && (
                  <tr>
                    <td className="px-3 py-5 text-center text-slate-500" colSpan={13}>
                      Loading loads...
                    </td>
                  </tr>
                )}

                {!isLoading && error && (
                  <tr>
                    <td className="px-3 py-5 text-center text-rose-600" colSpan={13}>
                      {error}
                    </td>
                  </tr>
                )}

                {!isLoading && !error && loads.length === 0 && (
                  <tr>
                    <td className="px-3 py-5 text-center text-slate-500" colSpan={13}>
                      No loads found for this filter.
                    </td>
                  </tr>
                )}

                {!isLoading &&
                  !error &&
                  loads.map((load) => (
                    <tr
                      key={load.id}
                      id={`load-row-${load.id}`}
                      className={`border-t border-slate-100 ${focusedLoadId === load.id ? 'bg-blue-50' : ''}`}
                    >
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selectedLoadIds.includes(load.id)}
                          onChange={() => toggleLoadSelection(load.id)}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                      </td>
                      <td className="px-3 py-2 font-semibold text-slate-900">
                        <div className="flex items-center gap-2">
                          <Link
                            to={`/loads/${load.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="underline decoration-slate-300 underline-offset-2 hover:text-blue-700"
                            title="Open load detail"
                          >
                            {load.referenceNumber}
                          </Link>
                          {focusedLoadId === load.id && isPaymentFocus && (
                            <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                              PAYMENT
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${getStatusBadgeClass(load.status)}`}>
                          {load.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-700">{formatBoardSource(load)}</td>
                      <td className="px-3 py-2 text-slate-700">
                        {load.plannerVanId ? (
                          formatPlannerVehicle(load)
                        ) : (
                          <button
                            type="button"
                            onClick={() => openSingleAssign(load)}
                            className="font-semibold text-blue-700 underline decoration-blue-300 underline-offset-2 hover:text-blue-800"
                            title="Add this load to planner"
                          >
                            Not in planner
                          </button>
                        )}
                      </td>
                      <td className="px-3 py-2 text-slate-700">
                        {load.broker?.companyName || '—'}
                      </td>
                      <td className="px-3 py-2 text-slate-700">
                        {formatLocation(load.pickupCountry, load.pickupPostcode, load.pickupCity)}
                      </td>
                      <td className="px-3 py-2 text-slate-700">
                        {formatLocation(load.deliveryCountry, load.deliveryPostcode, load.deliveryCity)}
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-slate-800">{getPalletCount(load)}</td>
                      <td className="px-3 py-2 text-right text-slate-700">{getWeightLabel(load)}</td>
                      <td className="px-3 py-2 text-right font-medium text-slate-800">{getPriceLabel(load)}</td>
                      <td className="px-3 py-2 text-slate-700">
                        {load.invoitix || load.valutaCheck
                          ? [load.invoitix ? 'Invoitix' : '', load.valutaCheck ? 'Valuta' : '']
                              .filter(Boolean)
                              .join(' • ')
                          : '—'}
                      </td>
                      <td className="px-3 py-2 text-slate-600">{formatDateTime(load.createdAt)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {isBulkAssignOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4 py-6"
          onClick={() => setIsBulkAssignOpen(false)}
        >
          <section
            className="w-full max-w-[700px] overflow-x-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto w-full md:w-[616px]">
              <h3 className="text-sm font-semibold text-slate-900">Add Loads To Load Planner</h3>
              <p className="mt-1 text-xs text-slate-600">
                {selectedLoadIds.length} selected load(s)
              </p>
            </div>

            <label className="mx-auto mt-3 block w-full text-xs text-slate-600 md:w-[616px]">
              Search Vehicle
              <input
                type="text"
                value={bulkVehicleSearch}
                onChange={(event) => setBulkVehicleSearch(event.target.value)}
                placeholder="Search by name, vehicle ID, plate, or assigned driver..."
                disabled={isLoadingPlannerVans || plannerVans.length === 0 || isBulkAssigning}
                className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 disabled:bg-slate-100"
              />
            </label>

            <div className="mx-auto mt-2 grid max-h-72 w-full grid-cols-1 gap-2 overflow-y-auto md:w-[616px] md:grid-cols-[repeat(3,200px)] md:justify-center">
              {isLoadingPlannerVans && (
                <p className="w-full rounded border border-slate-200 bg-slate-50 px-2 py-2 text-xs text-slate-600">
                  Loading vehicles...
                </p>
              )}
              {!isLoadingPlannerVans && filteredBulkPlannerVans.length === 0 && (
                <p className="w-full rounded border border-slate-200 bg-slate-50 px-2 py-2 text-xs text-slate-600">
                  No vehicles match this search.
                </p>
              )}
              {!isLoadingPlannerVans &&
                filteredBulkPlannerVans.map((van) => {
                  const isSelected = bulkPlannerVanId === van.id;
                  return (
                    <button
                      key={van.id}
                      type="button"
                      onClick={() => setBulkPlannerVanId(van.id)}
                      disabled={isBulkAssigning}
                      className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                      } disabled:cursor-not-allowed disabled:opacity-60`}
                    >
                      <p className="text-sm font-semibold text-slate-900">{van.name}</p>
                      <p className="text-xs text-slate-500">{van.vehicleId ?? 'No vehicle ID'}</p>
                      <p className="text-xs text-slate-600">{van.licensePlate}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Driver:{' '}
                        {van.assignedDriver
                          ? `${van.assignedDriver.firstName} ${van.assignedDriver.lastName}`
                          : 'Unassigned'}
                      </p>
                    </button>
                  );
                })}
            </div>
            {plannerVansError && (
              <span className="mx-auto mt-1 block w-full text-[11px] text-rose-600 md:w-[616px]">
                {plannerVansError}
              </span>
            )}

            {bulkAssignError && (
              <p className="mx-auto mt-2 w-full rounded border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-700 md:w-[616px]">
                {bulkAssignError}
              </p>
            )}

            <div className="mx-auto mt-4 flex w-full flex-col-reverse gap-2 md:w-[616px] sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setIsBulkAssignOpen(false)}
                className="w-full rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 sm:w-auto"
                disabled={isBulkAssigning}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleBulkAddToPlanner()}
                disabled={isBulkAssigning || !bulkPlannerVanId || selectedLoadIds.length === 0}
                className="w-full rounded border border-blue-700 bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {isBulkAssigning ? 'Assigning...' : 'Add To Planner'}
              </button>
            </div>
          </section>
        </div>
      )}

      {singlePlannerLoad && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4 py-6"
          onClick={closeSingleAssign}
        >
          <section
            className="w-full max-w-[700px] overflow-x-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto w-full md:w-[616px]">
              <h3 className="text-sm font-semibold text-slate-900">Add Load To Planner</h3>
              <p className="mt-1 text-xs text-slate-600">
                Load: <span className="font-semibold text-slate-800">{singlePlannerLoad.referenceNumber}</span>
              </p>
            </div>

            <label className="mx-auto mt-3 block w-full text-xs text-slate-600 md:w-[616px]">
              Search Vehicle
              <input
                type="text"
                value={singleVehicleSearch}
                onChange={(event) => setSingleVehicleSearch(event.target.value)}
                placeholder="Search by name, vehicle ID, plate, or assigned driver..."
                disabled={isLoadingPlannerVans || plannerVans.length === 0 || isSingleAssigning}
                className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 disabled:bg-slate-100"
              />
            </label>

            <div className="mx-auto mt-2 grid max-h-72 w-full grid-cols-1 gap-2 overflow-y-auto md:w-[616px] md:grid-cols-[repeat(3,200px)] md:justify-center">
              {isLoadingPlannerVans && (
                <p className="w-full rounded border border-slate-200 bg-slate-50 px-2 py-2 text-xs text-slate-600">
                  Loading vehicles...
                </p>
              )}
              {!isLoadingPlannerVans && filteredSinglePlannerVans.length === 0 && (
                <p className="w-full rounded border border-slate-200 bg-slate-50 px-2 py-2 text-xs text-slate-600">
                  No vehicles match this search.
                </p>
              )}
              {!isLoadingPlannerVans &&
                filteredSinglePlannerVans.map((van) => {
                  const isSelected = singlePlannerVanId === van.id;
                  return (
                    <button
                      key={van.id}
                      type="button"
                      onClick={() => setSinglePlannerVanId(van.id)}
                      disabled={isSingleAssigning}
                      className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                      } disabled:cursor-not-allowed disabled:opacity-60`}
                    >
                      <p className="text-sm font-semibold text-slate-900">{van.name}</p>
                      <p className="text-xs text-slate-500">{van.vehicleId ?? 'No vehicle ID'}</p>
                      <p className="text-xs text-slate-600">{van.licensePlate}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Driver:{' '}
                        {van.assignedDriver
                          ? `${van.assignedDriver.firstName} ${van.assignedDriver.lastName}`
                          : 'Unassigned'}
                      </p>
                    </button>
                  );
                })}
            </div>
            {plannerVansError && (
              <span className="mx-auto mt-1 block w-full text-[11px] text-rose-600 md:w-[616px]">
                {plannerVansError}
              </span>
            )}

            {singleAssignError && (
              <p className="mx-auto mt-2 w-full rounded border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-700 md:w-[616px]">
                {singleAssignError}
              </p>
            )}

            <div className="mx-auto mt-4 flex w-full flex-col-reverse gap-2 md:w-[616px] sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeSingleAssign}
                className="w-full rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 sm:w-auto"
                disabled={isSingleAssigning}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSingleAddToPlanner()}
                disabled={isSingleAssigning || !singlePlannerVanId}
                className="w-full rounded border border-blue-700 bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {isSingleAssigning ? 'Assigning...' : 'Add To Planner'}
              </button>
            </div>
          </section>
        </div>
      )}

      <UploadModal
        isOpen={isCreateLoadOpen}
        onClose={() => setIsCreateLoadOpen(false)}
        onCreated={() => {
          void fetchLoads(statusFilter);
        }}
      />
    </main>
  );
}
