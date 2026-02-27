import type { CreateLoadDto } from '../domain/dto';
import { Currency, DocumentType, LoadStatus, StopType } from '../domain/enums';
import type { Load, LoadStop } from '../domain/entities';
import type { PlannerLoad } from './types/load';
import { getSerbiaNowDateKey, toSerbiaDateKey } from '../utils/serbia-time';
import { API_BASE } from '../api/client';

const DEFAULT_COUNTRY = 'DE';
const DEFAULT_COLOR = '#3B82F6';
const DEFAULT_POSTCODE = '00000';
const POSTCODE_REGEX = /\b\d{4,6}\b/;

type PlannerStatus = PlannerLoad['status'];

const PLANNER_TO_API_STATUS: Record<PlannerStatus, LoadStatus> = {
  'ON BOARD': LoadStatus.ON_BOARD,
  NEGOTIATING: LoadStatus.NEGOTIATING,
  TAKEN: LoadStatus.TAKEN,
  'NOT INTERESTED': LoadStatus.NOT_INTERESTED,
  CANCELED: LoadStatus.CANCELED,
};

const API_TO_PLANNER_STATUS: Partial<Record<LoadStatus, PlannerStatus>> = {
  [LoadStatus.ON_BOARD]: 'ON BOARD',
  [LoadStatus.NEGOTIATING]: 'NEGOTIATING',
  [LoadStatus.TAKEN]: 'TAKEN',
  [LoadStatus.NOT_INTERESTED]: 'NOT INTERESTED',
  [LoadStatus.CANCELED]: 'CANCELED',
};

export const isUuid = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const extractPostcode = (value?: string | null): string => value?.match(POSTCODE_REGEX)?.[0] ?? '';

const toDateOnly = (value?: string | null): string => {
  if (!value) return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const serbiaDate = toSerbiaDateKey(trimmed);
  if (serbiaDate) {
    return serbiaDate;
  }
  return trimmed;
};

const FILES_PUBLIC_BASE = API_BASE.replace(/\/api\/?$/, '');

const getAbsoluteFileBase = (): string => {
  if (/^https?:\/\//i.test(FILES_PUBLIC_BASE)) {
    return FILES_PUBLIC_BASE.replace(/\/+$/, '');
  }
  const normalizedBase = FILES_PUBLIC_BASE.startsWith('/')
    ? FILES_PUBLIC_BASE
    : `/${FILES_PUBLIC_BASE}`;
  return `${window.location.origin}${normalizedBase}`.replace(/\/+$/, '');
};

const buildPublicFileUrl = (filePath: string): string => {
  const trimmed = filePath.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const fileBase = getAbsoluteFileBase();
  const normalizedPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return `${fileBase}${encodeURI(normalizedPath)}`;
};

const normalizeDateInput = (value: string | undefined, fallback: string): string => {
  const trimmed = value?.trim();
  if (trimmed) return trimmed;
  const fallbackTrimmed = fallback.trim();
  if (fallbackTrimmed) return fallbackTrimmed;
  return getSerbiaNowDateKey();
};

const parseAddressFields = (
  rawAddress: string | undefined,
  fallbackCity: string,
  fallbackPostcode: string = DEFAULT_POSTCODE,
) => {
  const address = rawAddress?.trim() ?? '';
  const postcode = extractPostcode(address) || fallbackPostcode;
  let city = fallbackCity.trim();

  if (address.includes(postcode)) {
    const afterPostcode = address.slice(address.indexOf(postcode) + postcode.length).trim();
    const sanitized = afterPostcode.replace(/^[,\s-]+/, '').trim();
    if (sanitized) {
      city = sanitized;
    }
  }

  if (!city) {
    city = fallbackCity.trim() || 'Unknown';
  }

  const fallbackStreet = `${city} terminal`;
  const streetFromComma = address.split(',')[0]?.trim();
  const street = streetFromComma || address || fallbackStreet;

  return {
    street,
    city,
    postcode,
    fullAddress: address || `${street}, ${postcode} ${city}`,
  };
};

const normalizePlannerPalletDimensions = (
  load: PlannerLoad,
): Array<{ width: number; height: number; weightKg?: number }> => {
  const requestedCount = Math.max(0, Math.round(load.pallets));
  const existing = (load.palletDimensions ?? []).map((dim) => ({
    width: Math.max(10, Math.round(dim.width || 120)),
    height: Math.max(10, Math.round(dim.height || 80)),
    ...(typeof dim.weightKg === 'number' && Number.isFinite(dim.weightKg)
      ? { weightKg: Math.max(0, Number(dim.weightKg.toFixed(2))) }
      : {}),
  }));

  if (existing.length > requestedCount && requestedCount > 0) {
    return existing.slice(0, requestedCount);
  }

  if (existing.length >= requestedCount) {
    return existing;
  }

  return [
    ...existing,
    ...Array.from({ length: requestedCount - existing.length }, () => ({ width: 120, height: 80 })),
  ];
};

const sumPalletQuantity = (apiLoad: Load): number =>
  (apiLoad.pallets ?? []).reduce((acc, pallet) => acc + Math.max(1, pallet.quantity ?? 1), 0);

const getExtraStopsFromApi = (apiLoad: Load): PlannerLoad['extraStops'] => {
  const sortedStops = [...(apiLoad.stops ?? [])].sort((a, b) => a.orderIndex - b.orderIndex);
  if (sortedStops.length <= 2) return [];

  return sortedStops.slice(1, -1).map((stop) => ({
    address: stop.address,
    pallets: Math.max(0, stop.pallets ?? 0),
    action: stop.stopType === StopType.PICKUP ? 'pickup' : 'dropoff',
  }));
};

export const toPlannerStatus = (status: LoadStatus): PlannerStatus =>
  API_TO_PLANNER_STATUS[status] ?? 'ON BOARD';

export const toApiStatus = (status: PlannerStatus): LoadStatus =>
  PLANNER_TO_API_STATUS[status] ?? LoadStatus.ON_BOARD;

export const mapApiLoadToPlannerLoad = (apiLoad: Load): PlannerLoad => {
  const originAddressLine = `${apiLoad.pickupAddress}, ${apiLoad.pickupPostcode} ${apiLoad.pickupCity}`;
  const destAddressLine = `${apiLoad.deliveryAddress}, ${apiLoad.deliveryPostcode} ${apiLoad.deliveryCity}`;
  const status = toPlannerStatus(apiLoad.status);
  const brokerContactName = apiLoad.brokerContact
    ? `${apiLoad.brokerContact.firstName} ${apiLoad.brokerContact.lastName}`.replace(/\s+/g, ' ').trim()
    : '';
  const brokerContactPhone = apiLoad.brokerContact?.phone ?? apiLoad.brokerContact?.mobile ?? undefined;
  const brokerContactEmail = apiLoad.brokerContact?.email ?? undefined;
  const latestFreightPdfDocument = [...(apiLoad.documents ?? [])]
    .filter(
      (document) =>
        document.documentType === DocumentType.FREIGHT_ORDER &&
        typeof document.filePath === 'string' &&
        document.filePath.trim().length > 0,
    )
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() -
        new Date(a.createdAt).getTime(),
    )[0];
  const sourceFreightPdfUrl = latestFreightPdfDocument
    ? buildPublicFileUrl(latestFreightPdfDocument.filePath)
    : undefined;
  const additionalDescription =
    apiLoad.freightDetails?.goodsDescription?.trim() ||
    apiLoad.notes?.trim() ||
    undefined;

  const palletDimensions = (apiLoad.pallets ?? []).flatMap((pallet) => {
    const quantity = Math.max(1, pallet.quantity ?? 1);
    const palletWeight =
      typeof pallet.weightKg === 'number' && Number.isFinite(pallet.weightKg)
        ? Math.max(0, Number(pallet.weightKg.toFixed(2)))
        : undefined;
    return Array.from({ length: quantity }, () => ({
      width: Math.round(pallet.widthCm),
      height: Math.round(pallet.heightCm),
      ...(palletWeight !== undefined ? { weightKg: palletWeight } : {}),
    }));
  });

  const palletCountFromFreight = apiLoad.freightDetails?.palletCount ?? null;
  const palletCount = Math.max(
    0,
    Math.round(
      palletCountFromFreight ??
        (palletDimensions.length > 0 ? palletDimensions.length : sumPalletQuantity(apiLoad)),
    ),
  );

  const palletWeightFromPallets = (apiLoad.pallets ?? []).reduce(
    (acc, pallet) => acc + (pallet.weightKg ?? 0) * Math.max(1, pallet.quantity ?? 1),
    0,
  );
  const weightKg = Math.max(
    0,
    Math.round(
      (apiLoad.freightDetails?.weightTons ?? 0) > 0
        ? (apiLoad.freightDetails?.weightTons ?? 0) * 1000
        : palletWeightFromPallets,
    ),
  );

  const plannerLoad: PlannerLoad = {
    id: apiLoad.id,
    referenceCode: apiLoad.referenceNumber,
    brokerage: apiLoad.broker?.companyName ?? apiLoad.brokerageName ?? 'Brokerage not set',
    originCity: apiLoad.pickupCity,
    destCity: apiLoad.deliveryCity,
    pickupDate: toDateOnly(apiLoad.pickupDateFrom),
    deliveryDate: toDateOnly(apiLoad.deliveryDateFrom),
    pickupWindowStart: apiLoad.pickupDateFrom ?? undefined,
    pickupWindowEnd: apiLoad.pickupDateTo ?? undefined,
    deliveryWindowStart: apiLoad.deliveryDateFrom ?? undefined,
    deliveryWindowEnd: apiLoad.deliveryDateTo ?? undefined,
    pallets: palletCount,
    ldm: Number(apiLoad.freightDetails?.loadingMeters ?? 0),
    weight: weightKg,
    price: Number(apiLoad.agreedPrice ?? apiLoad.publishedPrice ?? 0),
    distance: Number(apiLoad.distanceKm ?? 0),
    color: apiLoad.color ?? DEFAULT_COLOR,
    x: 100,
    y: 100,
    status,
    originAddress: originAddressLine,
    destAddress: destAddressLine,
    originTranseuLink: apiLoad.originTranseuLink ?? undefined,
    destTranseuLink: apiLoad.destTranseuLink ?? undefined,
    contactPerson: brokerContactName || (apiLoad.contactPerson ?? undefined),
    phone: brokerContactPhone || (apiLoad.contactPhone ?? undefined),
    email: brokerContactEmail || (apiLoad.contactEmail ?? undefined),
    paymentTerms:
      apiLoad.paymentTermDays !== null && apiLoad.paymentTermDays !== undefined
        ? String(apiLoad.paymentTermDays)
        : undefined,
    isInactive: apiLoad.isInactive ?? false,
    tripId: apiLoad.tripId ?? undefined,
    additionalDescription,
    sourceFreightPdfUrl,
    palletDimensions,
    extraStops: getExtraStopsFromApi(apiLoad),
  };

  if (plannerLoad.palletDimensions) {
    plannerLoad.palletDimensions = normalizePlannerPalletDimensions(plannerLoad);
  }

  return plannerLoad;
};

const mapStopFromApi = (load: Load, stopType: StopType): LoadStop | null => {
  const sortedStops = [...(load.stops ?? [])].sort((a, b) => a.orderIndex - b.orderIndex);
  if (sortedStops.length === 0) return null;

  if (stopType === StopType.PICKUP) {
    return sortedStops.find((stop) => stop.stopType === StopType.PICKUP) ?? null;
  }

  for (let idx = sortedStops.length - 1; idx >= 0; idx -= 1) {
    if (sortedStops[idx].stopType === StopType.DELIVERY) {
      return sortedStops[idx];
    }
  }
  return null;
};

export interface PlannerSidebarSeedStop {
  loadId: string;
  type: 'pickup' | 'delivery';
  city: string;
  postcode: string;
  eta: string;
  pallets: number;
  weight: number;
  color: string;
}

export const buildSidebarSeedStops = (
  apiLoads: Load[],
  plannerLoads: PlannerLoad[],
): PlannerSidebarSeedStop[] => {
  const plannerById = new Map(plannerLoads.map((load) => [load.id, load]));

  return apiLoads.flatMap((apiLoad) => {
    const plannerLoad = plannerById.get(apiLoad.id);
    if (!plannerLoad) return [];

    const pickupStop = mapStopFromApi(apiLoad, StopType.PICKUP);
    const deliveryStop = mapStopFromApi(apiLoad, StopType.DELIVERY);
    const fallbackPickupPostcode = extractPostcode(plannerLoad.originAddress) || apiLoad.pickupPostcode;
    const fallbackDeliveryPostcode = extractPostcode(plannerLoad.destAddress) || apiLoad.deliveryPostcode;

    return [
      {
        loadId: plannerLoad.id,
        type: 'pickup' as const,
        city: pickupStop?.city ?? plannerLoad.originCity,
        postcode: pickupStop?.postcode ?? fallbackPickupPostcode,
        eta: pickupStop?.dateFrom ?? plannerLoad.pickupWindowStart ?? plannerLoad.pickupDate,
        pallets: pickupStop?.pallets ?? plannerLoad.pallets,
        weight: plannerLoad.weight,
        color: plannerLoad.color,
      },
      {
        loadId: plannerLoad.id,
        type: 'delivery' as const,
        city: deliveryStop?.city ?? plannerLoad.destCity,
        postcode: deliveryStop?.postcode ?? fallbackDeliveryPostcode,
        eta: deliveryStop?.dateFrom ?? plannerLoad.deliveryWindowStart ?? plannerLoad.deliveryDate,
        pallets: deliveryStop?.pallets ?? plannerLoad.pallets,
        weight: plannerLoad.weight,
        color: plannerLoad.color,
      },
    ];
  });
};

export const buildLoadUpsertDto = (load: PlannerLoad): CreateLoadDto => {
  const origin = parseAddressFields(load.originAddress, load.originCity);
  const destination = parseAddressFields(load.destAddress, load.destCity);
  const safePrice = Number.isFinite(load.price) ? Math.max(0, load.price) : 0;
  const safeDistance = Number.isFinite(load.distance) ? Math.max(0, load.distance) : 0;
  const safeWeight = Number.isFinite(load.weight) ? Math.max(0, load.weight) : 0;
  const safeLdm = Number.isFinite(load.ldm) ? Math.max(0, load.ldm) : 0;
  const parsedPaymentTerm = load.paymentTerms ? Number.parseInt(load.paymentTerms, 10) : undefined;
  const pickupDateFrom = normalizeDateInput(load.pickupWindowStart, load.pickupDate);
  const deliveryDateFrom = normalizeDateInput(load.deliveryWindowStart, load.deliveryDate);
  const pickupDateTo = load.pickupWindowEnd?.trim() || undefined;
  const deliveryDateTo = load.deliveryWindowEnd?.trim() || undefined;

  const normalizedPallets = normalizePlannerPalletDimensions(load);
  const palletCount = normalizedPallets.length;
  const averagePalletWeight =
    palletCount > 0 ? Number((safeWeight / palletCount).toFixed(2)) : undefined;

  const extraStops =
    load.extraStops?.map((extraStop) =>
      typeof extraStop === 'string'
        ? { address: extraStop, pallets: 1, action: 'dropoff' as const }
        : {
            address: extraStop.address,
            pallets: Math.max(0, Math.round(extraStop.pallets || 0)),
            action: extraStop.action === 'pickup' ? 'pickup' : 'dropoff',
          },
    ) ?? [];

  const stops = [
    {
      stopType: StopType.PICKUP,
      address: origin.fullAddress,
      city: origin.city,
      postcode: origin.postcode,
      country: DEFAULT_COUNTRY,
      dateFrom: pickupDateFrom,
      ...(pickupDateTo ? { dateTo: pickupDateTo } : {}),
      pallets: Math.max(0, Math.round(load.pallets)),
      ...(load.originTranseuLink ? { transeuLink: load.originTranseuLink } : {}),
      orderIndex: 0,
    },
    ...extraStops.map((extraStop, index) => {
      const parsed = parseAddressFields(extraStop.address, destination.city, destination.postcode);
      const dateFrom = extraStop.action === 'pickup' ? pickupDateFrom : deliveryDateFrom;
      return {
        stopType: extraStop.action === 'pickup' ? StopType.PICKUP : StopType.DELIVERY,
        address: parsed.fullAddress,
        city: parsed.city,
        postcode: parsed.postcode,
        country: DEFAULT_COUNTRY,
        dateFrom,
        pallets: extraStop.pallets,
        orderIndex: index + 1,
      };
    }),
    {
      stopType: StopType.DELIVERY,
      address: destination.fullAddress,
      city: destination.city,
      postcode: destination.postcode,
      country: DEFAULT_COUNTRY,
      dateFrom: deliveryDateFrom,
      ...(deliveryDateTo ? { dateTo: deliveryDateTo } : {}),
      pallets: Math.max(0, Math.round(load.pallets)),
      ...(load.destTranseuLink ? { transeuLink: load.destTranseuLink } : {}),
      orderIndex: extraStops.length + 1,
    },
  ];

  return {
    referenceNumber: load.referenceCode?.trim() || load.id,
    status: toApiStatus(load.status),
    color: load.color || DEFAULT_COLOR,
    pickupAddress: origin.fullAddress,
    pickupCity: origin.city,
    pickupPostcode: origin.postcode || DEFAULT_POSTCODE,
    pickupCountry: DEFAULT_COUNTRY,
    pickupDateFrom,
    ...(pickupDateTo ? { pickupDateTo } : {}),
    deliveryAddress: destination.fullAddress,
    deliveryCity: destination.city,
    deliveryPostcode: destination.postcode || DEFAULT_POSTCODE,
    deliveryCountry: DEFAULT_COUNTRY,
    deliveryDateFrom,
    ...(deliveryDateTo ? { deliveryDateTo } : {}),
    agreedPrice: Number(safePrice.toFixed(2)),
    publishedPrice: Number(safePrice.toFixed(2)),
    currency: Currency.EUR,
    ...(parsedPaymentTerm && parsedPaymentTerm > 0 ? { paymentTermDays: parsedPaymentTerm } : {}),
    distanceKm: Number(safeDistance.toFixed(1)),
    ...(load.contactPerson ? { contactPerson: load.contactPerson } : {}),
    ...(load.phone ? { contactPhone: load.phone } : {}),
    ...(load.email ? { contactEmail: load.email } : {}),
    ...(load.tripId ? { tripId: load.tripId } : {}),
    vehicleMonitoringRequired: false,
    ...(load.originTranseuLink ? { originTranseuLink: load.originTranseuLink } : {}),
    ...(load.destTranseuLink ? { destTranseuLink: load.destTranseuLink } : {}),
    isInactive: Boolean(load.isInactive),
    freightDetails: {
      weightTons: Number((safeWeight / 1000).toFixed(3)),
      loadingMeters: Number(safeLdm.toFixed(2)),
      palletCount: Math.max(0, Math.round(load.pallets)),
      isStackable: true,
      isHazardous: false,
    },
    pallets: normalizedPallets.map((pallet, index) => ({
      label: `PAL-${index + 1}`,
      widthCm: pallet.width,
      heightCm: pallet.height,
      depthCm: 120,
      ...(
        typeof pallet.weightKg === 'number' && Number.isFinite(pallet.weightKg)
          ? { weightKg: Math.max(0, Number(pallet.weightKg.toFixed(2))) }
          : averagePalletWeight
            ? { weightKg: averagePalletWeight }
            : {}
      ),
      isStackable: true,
      quantity: 1,
    })),
    stops,
  };
};

export const buildPlannerSyncFingerprint = (loads: PlannerLoad[]): string => {
  const syncable = loads
    .filter((load) => isUuid(load.id))
    .map((load) => ({
      id: load.id,
      payload: buildLoadUpsertDto(load),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  return JSON.stringify(syncable);
};
