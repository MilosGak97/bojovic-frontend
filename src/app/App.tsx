import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Upload,
  Settings,
  Bell,
  User,
  Check,
  Copy,
  ExternalLink,
  Loader2,
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
import { RouteComparison, type RouteStats } from './components/RouteComparison';
import { TripSelector } from './components/TripSelector';
import { documentApi, loadApi } from '../api';
import type { ScreenshotIntakeResult, ScreenshotPreviewResult } from '../api';
import type { Load as ApiLoad } from '../domain/entities';
import { DocumentCategory, DocumentType, LoadStatus } from '../domain/enums';
import { API_BASE } from '../api/client';
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
  lat?: number | null;
  lng?: number | null;
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
type RouteComparisonSnapshot = {
  currentRoute: RouteStats;
  plannedRoute: RouteStats;
};

const ORGANIZER_STATUSES: OrganizerStatus[] = [
  'ON BOARD',
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

const normalizeHexColor = (color: string | null | undefined): string | null => {
  const raw = (color ?? '').trim();
  const shortHex = raw.match(/^#([A-Fa-f0-9]{3})$/);
  if (shortHex) {
    const expanded = shortHex[1]
      .split('')
      .map((char) => `${char}${char}`)
      .join('')
      .toLowerCase();
    return `#${expanded}`;
  }
  const longHex = raw.match(/^#([A-Fa-f0-9]{6})$/);
  if (longHex) {
    return `#${longHex[1].toLowerCase()}`;
  }
  return null;
};

const hashText = (input: string): number => {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }
  return hash;
};

const hslToHex = (hue: number, saturation: number, lightness: number): string => {
  const s = Math.max(0, Math.min(100, saturation)) / 100;
  const l = Math.max(0, Math.min(100, lightness)) / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hPrime = ((hue % 360) + 360) % 360 / 60;
  const x = c * (1 - Math.abs((hPrime % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;

  if (hPrime >= 0 && hPrime < 1) {
    r = c;
    g = x;
  } else if (hPrime >= 1 && hPrime < 2) {
    r = x;
    g = c;
  } else if (hPrime >= 2 && hPrime < 3) {
    g = c;
    b = x;
  } else if (hPrime >= 3 && hPrime < 4) {
    g = x;
    b = c;
  } else if (hPrime >= 4 && hPrime < 5) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }

  const m = l - c / 2;
  const toHex = (value: number) =>
    Math.round((value + m) * 255)
      .toString(16)
      .padStart(2, '0');

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const withHexAlpha = (hexColor: string, alpha: number): string => {
  const normalizedAlpha = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hexColor}${normalizedAlpha}`;
};

const buildDistinctColorMap = (plannerLoads: PlannerLoad[]): Map<string, string> => {
  const byId = new Map<string, string>();
  const usedColors = new Set<string>();

  plannerLoads.forEach((load, index) => {
    const preferred = normalizeHexColor(load.color);
    if (preferred && !usedColors.has(preferred)) {
      byId.set(load.id, preferred);
      usedColors.add(preferred);
      return;
    }

    const baseHash = hashText(load.id || `load-${index}`);
    let attempt = 0;
    let candidate = '';
    do {
      const hue = (baseHash + attempt * 47) % 360;
      const saturation = 62 + ((baseHash + attempt) % 18);
      const lightness = 42 + ((baseHash + attempt * 3) % 14);
      candidate = hslToHex(hue, saturation, lightness);
      attempt += 1;
    } while (usedColors.has(candidate) && attempt < 720);

    byId.set(load.id, candidate);
    usedColors.add(candidate);
  });

  return byId;
};

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

const normalizeCountryCode = (value?: string): string => {
  const raw = value?.trim();
  if (!raw) return 'DE';
  const normalized = raw.replace(/[^A-Za-z]/g, '').toUpperCase();
  if (!normalized) return 'DE';
  if (normalized.length === 2) return normalized;
  return normalized.slice(0, 2);
};

const truncateWithEllipsis = (value: string | null | undefined, maxChars = 30): string => {
  const text = (value ?? '').trim();
  if (!text) return '—';
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}...`;
};

const LOAD_TAGS_STORAGE_KEY = 'route_planner_load_tags_v1';

const normalizeTagValue = (value: string): string => value.trim().replace(/\s+/g, ' ');

const dedupeTagList = (values: string[]): string[] => {
  const seen = new Set<string>();
  const normalized: string[] = [];
  values.forEach((value) => {
    const cleanValue = normalizeTagValue(value);
    if (!cleanValue) return;
    const key = cleanValue.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    normalized.push(cleanValue);
  });
  return normalized;
};

const loadStoredPlannerTags = (): Record<string, string[]> => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(LOAD_TAGS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};

    const normalized: Record<string, string[]> = {};
    Object.entries(parsed as Record<string, unknown>).forEach(([loadId, value]) => {
      if (!Array.isArray(value)) return;
      const tagList = dedupeTagList(
        value.filter((item): item is string => typeof item === 'string'),
      );
      if (tagList.length === 0) return;
      normalized[loadId] = tagList;
    });
    return normalized;
  } catch {
    return {};
  }
};

interface GeoPoint {
  lat: number;
  lon: number;
}

const isFiniteCoordinate = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const toGeoPointFromStop = (
  stop: Pick<SidebarStop, 'lat' | 'lng'>,
): GeoPoint | null => {
  if (!isFiniteCoordinate(stop.lat) || !isFiniteCoordinate(stop.lng)) return null;
  return {
    lat: stop.lat,
    lon: stop.lng,
  };
};

const buildGeocodeCacheKey = (
  stop: Pick<SidebarStop, 'city' | 'postcode' | 'countryCode'>,
): string => {
  const city = (stop.city ?? '').trim().toLowerCase();
  const postcode = (stop.postcode ?? '').trim().toLowerCase();
  const countryCode = normalizeCountryCode(stop.countryCode).toLowerCase();
  return `${countryCode}|${postcode}|${city}`;
};

const buildGeocodeTextQuery = (
  stop: Pick<SidebarStop, 'city' | 'postcode' | 'countryCode'>,
): string => {
  const countryCode = normalizeCountryCode(stop.countryCode);
  const city = (stop.city ?? '').trim();
  const postcode = (stop.postcode ?? '').trim();
  return [postcode, city, countryCode].filter(Boolean).join(', ');
};

const haversineDistanceKm = (from: GeoPoint, to: GeoPoint): number => {
  const earthRadiusKm = 6371;
  const toRadians = (deg: number) => (deg * Math.PI) / 180;
  const latDelta = toRadians(to.lat - from.lat);
  const lonDelta = toRadians(to.lon - from.lon);
  const fromLat = toRadians(from.lat);
  const toLat = toRadians(to.lat);

  const a =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(fromLat) * Math.cos(toLat) * Math.sin(lonDelta / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
};

const areDistanceMapsEqual = (
  left: Record<string, number>,
  right: Record<string, number>,
): boolean => {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  for (const key of leftKeys) {
    if (left[key] !== right[key]) return false;
  }
  return true;
};

const buildSegmentDistanceKey = (fromStopId: string, toStopId: string): string =>
  `${fromStopId}->${toStopId}`;

const countryCodeToFlag = (value?: string): string => {
  const code = normalizeCountryCode(value);
  if (!/^[A-Z]{2}$/.test(code)) return '';
  return String.fromCodePoint(
    ...code.split('').map((char) => 127397 + char.charCodeAt(0)),
  );
};

const formatCountryWithFlag = (value?: string): string => {
  const code = normalizeCountryCode(value);
  const flag = countryCodeToFlag(code);
  return flag ? `${flag} ${code}` : code;
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

const formatMarketplaceDatePart = (value: string): string => {
  const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return `${isoMatch[3]}.${isoMatch[2]}.`;
  }
  const euMatch = value.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (euMatch) {
    return `${euMatch[1]}.${euMatch[2]}.`;
  }
  return value;
};

const formatMarketplaceSchedule = (
  startDateValue?: string,
  endDateValue?: string,
  startTimeHint?: string,
): string => {
  const start = parseEtaDisplay(startDateValue ?? '', startTimeHint);
  const startDate = formatMarketplaceDatePart(start.date);
  const startTime = start.time !== '—' ? start.time : '';

  if (endDateValue) {
    const end = parseEtaDisplay(endDateValue);
    if (end.time !== '—') {
      if (end.date === start.date) {
        return startTime ? `${startDate}, ${startTime} - ${end.time}` : `${startDate}`;
      }
      const endDate = formatMarketplaceDatePart(end.date);
      return startTime
        ? `${startDate}, ${startTime} - ${endDate}, ${end.time}`
        : `${startDate} - ${endDate}, ${end.time}`;
    }
  }

  return startTime ? `${startDate}, ${startTime}` : startDate;
};

const splitMetaChips = (value?: string): string[] => {
  if (!value) return [];
  return value
    .split(/[|,;/]+/g)
    .map((part) => part.trim())
    .filter(Boolean)
    .filter(
      (part, index, all) =>
        all.findIndex((candidate) => candidate.toLowerCase() === part.toLowerCase()) === index,
    );
};

const isIgnoredFreightToken = (value: string): boolean => {
  const normalized = value.trim();
  return /^shipment tracking$/i.test(normalized) || /^ship$/i.test(normalized);
};

const ADDITIONAL_DESCRIPTION_HINT_PATTERNS: RegExp[] = [
  /\bpal(?:let)?s?\b/i,
  /\bcol(?:li|lis)\b/i,
  /\bkg\b/i,
  /\bwinda\b/i,
  /\btail\s*lift\b/i,
  /\blift\b/i,
  /\bboite\b/i,
  /\bneed a truck\b/i,
  /\bun\d{3,4}\b/i,
  /€/,
  /\beur\b/i,
  /\d+\s*[x*]\s*\d+/i,
];

const hasAdditionalDescriptionHint = (value: string): boolean =>
  ADDITIONAL_DESCRIPTION_HINT_PATTERNS.some((pattern) => pattern.test(value));

const cleanAdditionalDescriptionDisplay = (value?: string | null): string | undefined => {
  const cleaned = (value ?? '')
    .replace(/\bshipment tracking\b/gi, '')
    .replace(/\bship\b/gi, '')
    .replace(/[|;]+/g, ',')
    .replace(/\s*,\s*/g, ', ')
    .replace(/,\s*,+/g, ', ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[,\s\-+/]+|[,\s\-+/]+$/g, '')
    .trim();
  if (!cleaned || cleaned === '-') return undefined;
  return cleaned;
};

const splitBodySizeForDisplay = (
  bodySize?: string | null,
): { line2BodySize?: string; inferredLine3?: string } => {
  const raw = bodySize?.trim();
  if (!raw) return {};

  const splitPatterns = [
    /^(.*?\b(?:Shipment tracking|Safepay|Ship)\b)\s*(?:[,;|]\s*|\s{2,}|-\s*)?(.+)$/i,
    /^(.*?\b(?:FTL|LTL)\b)\s*(?:[,;|]\s*|\s{2,}|-\s*)?(.+)$/i,
  ];

  for (const pattern of splitPatterns) {
    const match = raw.match(pattern);
    if (!match?.[1] || !match[2]) continue;
    const inferredLine3 = cleanAdditionalDescriptionDisplay(match[2]);
    if (!inferredLine3 || !hasAdditionalDescriptionHint(inferredLine3)) continue;
    return {
      line2BodySize: match[1].trim(),
      inferredLine3,
    };
  }

  return { line2BodySize: raw };
};

const dedupeMetaTokens = (tokens: string[]): string[] =>
  tokens.filter(
    (token, index, all) =>
      all.findIndex((candidate) => candidate.toLowerCase() === token.toLowerCase()) === index,
  );

const TRANSPORT_META_PATTERNS: RegExp[] = [
  /^van$/i,
  /^with double trailer$/i,
  /^with semi-trailer$/i,
  /^solo$/i,
  /^ftl$/i,
  /^ltl$/i,
  /^shipment tracking$/i,
  /^ship$/i,
  /^safepay$/i,
];

const isTransportMetaChip = (value: string): boolean => {
  const normalized = value.trim();
  if (!normalized) return false;
  return TRANSPORT_META_PATTERNS.some((pattern) => pattern.test(normalized));
};

const normalizeTransportMetaChip = (value: string): string => {
  const normalized = value.trim();
  if (/^ftl$/i.test(normalized)) return 'FTL';
  if (/^ltl$/i.test(normalized)) return 'LTL';
  if (/^shipment tracking$/i.test(normalized)) return 'Shipment tracking';
  if (/^ship$/i.test(normalized)) return 'Ship';
  if (/^safepay$/i.test(normalized)) return 'Safepay';
  return normalized.toLowerCase();
};

const extractAdditionalFreightMeta = (
  value?: string,
): { transportChips: string[]; detailText?: string } => {
  const raw = value?.trim();
  if (!raw) {
    return { transportChips: [] };
  }

  const transportChips = splitMetaChips(raw)
    .filter((token) => isTransportMetaChip(token))
    .map((token) => normalizeTransportMetaChip(token))
    .filter(
      (token, index, all) =>
        all.findIndex((candidate) => candidate.toLowerCase() === token.toLowerCase()) === index,
    );

  if (transportChips.length === 0) {
    return { transportChips: [], detailText: raw };
  }

  let detailText = raw;
  const removalPatterns = [
    /\bvan\b/gi,
    /\bwith double trailer\b/gi,
    /\bwith semi-trailer\b/gi,
    /\bsolo\b/gi,
    /\bftl\b/gi,
    /\bltl\b/gi,
    /\bshipment tracking\b/gi,
    /\bship\b/gi,
    /\bsafepay\b/gi,
  ];

  removalPatterns.forEach((pattern) => {
    detailText = detailText.replace(pattern, ' ');
  });

  detailText = detailText
    .replace(/[|;]+/g, ',')
    .replace(/\s*,\s*/g, ', ')
    .replace(/,\s*,+/g, ', ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[,\s\-+/]+|[,\s\-+/]+$/g, '')
    .trim();

  return {
    transportChips,
    ...(detailText ? { detailText } : {}),
  };
};

const buildFreightTextRows = (input: {
  capacityTons?: number | null;
  bodyTypeText?: string | null;
  loadingMeters?: number | null;
  distanceKm?: number | null;
  bodySize?: string | null;
  freightMode?: string | null;
  additionalDescription?: string | null;
}): { line1?: string; line2?: string; line3?: string } => {
  const formatTons = (value: number): string => `${Number(value.toFixed(3))}T`;
  const splitBodySize = splitBodySizeForDisplay(input.bodySize ?? undefined);

  const additionalMeta = extractAdditionalFreightMeta(
    input.additionalDescription ?? undefined,
  );

  const line1Tokens = dedupeMetaTokens([
    ...(typeof input.capacityTons === 'number' && Number.isFinite(input.capacityTons)
      ? [formatTons(input.capacityTons)]
      : []),
    ...splitMetaChips(input.bodyTypeText ?? undefined),
    ...(typeof input.loadingMeters === 'number' && Number.isFinite(input.loadingMeters)
      ? [`${Number(input.loadingMeters.toFixed(2))} ldm`]
      : []),
  ]);

  const line2Tokens = dedupeMetaTokens([
    ...(typeof input.distanceKm === 'number' && Number.isFinite(input.distanceKm) && input.distanceKm > 0
      ? [`${Math.round(input.distanceKm)} km`]
      : []),
    ...splitMetaChips(splitBodySize.line2BodySize ?? undefined),
    ...splitMetaChips(input.freightMode ?? undefined),
    ...additionalMeta.transportChips,
  ]).filter((token) => !isIgnoredFreightToken(token));

  const line3Candidate =
    cleanAdditionalDescriptionDisplay(input.additionalDescription ?? undefined) ??
    splitBodySize.inferredLine3;
  const line3 =
    line3Candidate && line3Candidate !== '-' ? line3Candidate : undefined;

  return {
    ...(line1Tokens.length > 0 ? { line1: line1Tokens.join(', ') } : {}),
    ...(line2Tokens.length > 0 ? { line2: line2Tokens.join(', ') } : {}),
    ...(line3 ? { line3 } : {}),
  };
};

const formatPastePreviewDateTime = (value?: string | null): string => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleString('en-GB', {
    timeZone: 'Europe/Belgrade',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
};

const formatPastePreviewMoney = (amount?: number | null, currency?: string | null): string => {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return '—';
  const normalizedCurrency =
    typeof currency === 'string' && currency.trim() ? currency.trim().toUpperCase() : 'EUR';
  return `${amount.toFixed(2)} ${normalizedCurrency}`;
};

const formatCardHeaderPrice = (price: number): string => {
  const safePrice = Number(price);
  if (!Number.isFinite(safePrice) || safePrice <= 0) {
    return 'No Price';
  }
  const normalized =
    Math.abs(safePrice - Math.round(safePrice)) < 0.01
      ? String(Math.round(safePrice))
      : safePrice.toFixed(2);
  return `${normalized}e`;
};

const buildDocumentOpenUrl = (documentId: string): string =>
  `${API_BASE}/documents/${encodeURIComponent(documentId)}/open`;

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
  const [loads, setLoads] = useState<PlannerLoad[]>([]);
  const [stops, setStops] = useState<CanvasStop[]>([]);
  const [selectedStops, setSelectedStops] = useState<string[]>([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadModalInitialTab, setUploadModalInitialTab] = useState<'manual' | 'pdf' | 'screenshot' | undefined>(undefined);
  const [pendingPastedScreenshotFile, setPendingPastedScreenshotFile] = useState<File | null>(null);
  const [isPasteConfirmOpen, setIsPasteConfirmOpen] = useState(false);
  const [isPastePreviewOpen, setIsPastePreviewOpen] = useState(false);
  const [isPastePreviewLoading, setIsPastePreviewLoading] = useState(false);
  const [isPastePreviewSubmitting, setIsPastePreviewSubmitting] = useState(false);
  const [pastePreviewError, setPastePreviewError] = useState<string | null>(null);
  const [pastePreviewResult, setPastePreviewResult] = useState<ScreenshotPreviewResult | null>(null);
  const [pastePreviewSelectedRows, setPastePreviewSelectedRows] = useState<number[]>([]);
  const [pasteDuplicatePopup, setPasteDuplicatePopup] = useState<{
    count: number;
    duplicates: ScreenshotIntakeResult['duplicates'];
  } | null>(null);

  // Simulation Mode State
  const [routeMode, setRouteMode] = useState<'active' | 'simulation'>('active');
  const [hasSimulation, setHasSimulation] = useState(false);
  const [simulationStops, setSimulationStops] = useState<CanvasStop[]>([]);
  const [simulationImpact, setSimulationImpact] = useState<SimulationImpact>({
    kmDelta: 87,
    timeDelta: '+1h 20m',
    warnings: ['Pushes Stop 4 by +45m', '12 cm overflow at Stop 3'],
  });
  const [selectedCargoStopId, setSelectedCargoStopId] = useState(''); // For cargo timeline
  const [selectedTrip, setSelectedTrip] = useState('');
  const [middleWorkspaceTab, setMiddleWorkspaceTab] = useState<MiddleWorkspaceTab>('load-planner');
  const [draggingSidebarStopIndex, setDraggingSidebarStopIndex] = useState<number | null>(null);
  const [draggingLoadId, setDraggingLoadId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<OrganizerStatus | null>(null);
  const [selectedOrganizerStatus, setSelectedOrganizerStatus] = useState<OrganizerStatus | null>(
    null,
  );
  const [selectedOrganizerLoadIds, setSelectedOrganizerLoadIds] = useState<string[]>([]);
  const [organizerSelectionAnchorId, setOrganizerSelectionAnchorId] = useState<string | null>(
    null,
  );
  const [organizerLoadFilter, setOrganizerLoadFilter] = useState<'ALL' | 'NEGOTIATING' | 'ON_BOARD'>('ALL');
  const [isInactiveModalOpen, setIsInactiveModalOpen] = useState(false);
  const [isDeletingInactive, setIsDeletingInactive] = useState(false);
  const [editingLoadId, setEditingLoadId] = useState<string | null>(null);
  const [editingPalletLoadId, setEditingPalletLoadId] = useState<string | null>(null);
  const [selectedLoadId, setSelectedLoadId] = useState<string | null>(null);
  const [copiedIndicatorKey, setCopiedIndicatorKey] = useState<string | null>(null);
  const [quickPriceEditor, setQuickPriceEditor] = useState<{
    loadId: string;
    value: string;
  } | null>(null);
  const [loadTagsByLoadId, setLoadTagsByLoadId] =
    useState<Record<string, string[]>>(loadStoredPlannerTags);
  const [tagEditor, setTagEditor] = useState<{
    loadId: string;
    draftTags: string[];
    inputValue: string;
  } | null>(null);
  const quickPriceInputRef = useRef<HTMLInputElement | null>(null);
  const [isApiConnected, setIsApiConnected] = useState(false);
  const [isPlannerHydrated, setIsPlannerHydrated] = useState(false);
  const [isSavingPlanner, setIsSavingPlanner] = useState(false);
  const [lastPlannerSyncError, setLastPlannerSyncError] = useState<string | null>(null);
  const [pendingTakenDeleteLoadId, setPendingTakenDeleteLoadId] = useState<string | null>(null);
  const [isDeletingTakenRoute, setIsDeletingTakenRoute] = useState(false);
  const [takenDeleteError, setTakenDeleteError] = useState<string | null>(null);
  const isLiveDistanceEnabled = true;
  const [isOptimizingRoute, setIsOptimizingRoute] = useState(false);
  const [routeOptimizationError, setRouteOptimizationError] = useState<string | null>(null);
  const [routeOptimizationSnapshot, setRouteOptimizationSnapshot] = useState<{
    previousStopIds: string[];
    previousTotalKm: number;
    optimizedTotalKm: number;
  } | null>(null);
  const [previousRouteComparison, setPreviousRouteComparison] =
    useState<RouteComparisonSnapshot | null>(null);
  const [routeOrderError, setRouteOrderError] = useState<string | null>(null);
  const [segmentDistanceKmBySegmentKey, setSegmentDistanceKmBySegmentKey] = useState<Record<string, number>>({});
  const geocodeCacheRef = useRef<Map<string, GeoPoint | null>>(new Map());
  const geocodeInFlightRef = useRef<Map<string, Promise<GeoPoint | null>>>(new Map());
  const osrmRouteDistanceCacheRef = useRef<Map<string, number>>(new Map());
  const routeComparisonRef = useRef<RouteComparisonSnapshot | null>(null);
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
  const organizerColorByLoadId = useMemo(() => buildDistinctColorMap(loads), [loads]);
  const getLoadDisplayColor = useCallback(
    (load: PlannerLoad) => organizerColorByLoadId.get(load.id) ?? '#2563eb',
    [organizerColorByLoadId],
  );

  useEffect(() => {
    if (!selectedLoadId) return;
    const isStillVisible = visiblePlannerLoads.some((load) => load.id === selectedLoadId);
    if (!isStillVisible) {
      setSelectedLoadId(null);
      setSelectedStops([]);
    }
  }, [selectedLoadId, visiblePlannerLoads]);

  useEffect(() => {
    setSelectedOrganizerLoadIds((prev) => {
      if (prev.length === 0) return prev;
      const allowedIds = new Set(visiblePlannerLoads.map((load) => load.id));
      return prev.filter((id) => allowedIds.has(id));
    });
    setOrganizerSelectionAnchorId((prev) => {
      if (!prev) return prev;
      const allowedIds = new Set(visiblePlannerLoads.map((load) => load.id));
      return allowedIds.has(prev) ? prev : null;
    });
  }, [visiblePlannerLoads]);

  useEffect(() => {
    const existingLoadIds = new Set(loads.map((load) => load.id));
    setLoadTagsByLoadId((prev) => {
      let didChange = false;
      const next: Record<string, string[]> = {};
      Object.entries(prev).forEach(([loadId, tags]) => {
        if (!existingLoadIds.has(loadId)) {
          didChange = true;
          return;
        }
        const normalizedTags = dedupeTagList(tags);
        if (normalizedTags.length === 0) {
          didChange = true;
          return;
        }
        if (
          normalizedTags.length !== tags.length ||
          normalizedTags.some((tag, index) => tag !== tags[index])
        ) {
          didChange = true;
        }
        next[loadId] = normalizedTags;
      });
      return didChange ? next : prev;
    });
  }, [loads]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(
        LOAD_TAGS_STORAGE_KEY,
        JSON.stringify(loadTagsByLoadId),
      );
    } catch {
      // Ignore storage errors (private mode, quota limits).
    }
  }, [loadTagsByLoadId]);

  const buildCanvasStopsFromApiLoads = useCallback(
    (apiLoads: ApiLoad[], plannerLoads: PlannerLoad[]): CanvasStop[] => {
      const seedStops = buildSidebarSeedStops(apiLoads, plannerLoads);

      return seedStops.map((seed, index) => ({
        id: `S-${seed.loadId}-${seed.type}`,
        number: index + 1,
        type: seed.type,
        city: seed.city,
        postcode: seed.postcode,
        lat: seed.lat ?? null,
        lng: seed.lng ?? null,
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

  const handleFreightCreatedMany = useCallback(
    (createdLoads: ApiLoad[]) => {
      createdLoads.forEach((load) => {
        handleFreightCreated(load);
      });
    },
    [handleFreightCreated],
  );

  useEffect(() => {
    let isCancelled = false;

    const hydratePlanner = async () => {
      try {
        const initialResponse = await loadApi.getAll({ limit: 200, offset: 0 });
        const apiLoads = initialResponse.data;

        if (isCancelled) return;

        const plannerLoads = apiLoads.map(mapApiLoadToPlannerLoad);
        const plannerStops = buildCanvasStopsFromApiLoads(apiLoads, plannerLoads);

        setLoads(plannerLoads);
        setStops(plannerStops);
        setSelectedStops([]);
        setSelectedLoadId(null);
        setEditingLoadId(null);
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

  useEffect(() => {
    const handleWindowPaste = (event: ClipboardEvent) => {
      if (selectedOrganizerStatus !== 'ON BOARD') return;
      if (showUploadModal || isPasteConfirmOpen || isPastePreviewOpen || isPastePreviewLoading) {
        return;
      }

      const target = event.target as HTMLElement | null;
      const targetTag = target?.tagName?.toLowerCase();
      if (
        targetTag === 'input' ||
        targetTag === 'textarea' ||
        target?.isContentEditable
      ) {
        return;
      }

      const clipboardItems = event.clipboardData?.items;
      if (!clipboardItems) return;

      for (let index = 0; index < clipboardItems.length; index += 1) {
        const item = clipboardItems[index];
        if (!item.type.startsWith('image/')) continue;

        const clipboardFile = item.getAsFile();
        if (!clipboardFile) continue;

        const extension = (item.type.split('/')[1] || 'png').toLowerCase();
        const normalizedFile = new File([clipboardFile], `route-board-${Date.now()}.${extension}`, {
          type: item.type,
        });

        setPendingPastedScreenshotFile(normalizedFile);
        setIsPasteConfirmOpen(true);
        event.preventDefault();
        break;
      }
    };

    window.addEventListener('paste', handleWindowPaste);
    return () => {
      window.removeEventListener('paste', handleWindowPaste);
    };
  }, [
    isPasteConfirmOpen,
    isPastePreviewLoading,
    isPastePreviewOpen,
    selectedOrganizerStatus,
    showUploadModal,
  ]);

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
  const filteredStops = useMemo(
    () =>
      combinedStops.filter((stop) => {
        const load = visiblePlannerLoads.find((currentLoad) => currentLoad.id === stop.loadId);
        if (!load || load.isInactive) return false;
        return load.status === 'TAKEN' || load.status === 'NEGOTIATING';
      }),
    [combinedStops, visiblePlannerLoads],
  );

  const visibleLoadDistanceKmById = useMemo(
    () =>
      new Map(
        visiblePlannerLoads.map((load) => [
          load.id,
          Math.max(0, Math.round(Number(load.distance ?? 0))),
        ] as const),
      ),
    [visiblePlannerLoads],
  );

  const getFallbackSegmentKm = useCallback(
    (previousStop: SidebarStop | null, currentStop: SidebarStop | null): number => {
      if (!previousStop) return 0;
      const rawDistanceFromStop = Math.max(0, Math.round(previousStop.distanceToNext ?? 0));
      if (rawDistanceFromStop > 0) return rawDistanceFromStop;

      if (!currentStop) return 0;
      if (previousStop.loadId === currentStop.loadId) {
        return visibleLoadDistanceKmById.get(previousStop.loadId) ?? 0;
      }

      const fromPoint = toGeoPointFromStop(previousStop);
      const toPoint = toGeoPointFromStop(currentStop);
      if (fromPoint && toPoint) {
        return Math.max(0, Math.round(haversineDistanceKm(fromPoint, toPoint)));
      }

      return 0;
    },
    [visibleLoadDistanceKmById],
  );

  const getDisplayedSegmentKm = useCallback(
    (previousStop: SidebarStop | null, currentStop: SidebarStop | null): number => {
      if (!previousStop) return 0;
      if (!currentStop) return 0;
      const segmentKey = buildSegmentDistanceKey(previousStop.id, currentStop.id);
      const resolved = segmentDistanceKmBySegmentKey[segmentKey];
      if (typeof resolved === 'number' && Number.isFinite(resolved) && resolved > 0) {
        return Math.max(0, Math.round(resolved));
      }
      return getFallbackSegmentKm(previousStop, currentStop);
    },
    [getFallbackSegmentKm, segmentDistanceKmBySegmentKey],
  );

  const computeTotalKmForStopOrder = useCallback(
    (orderedStops: SidebarStop[]): number => {
      if (orderedStops.length <= 1) return 0;
      let total = 0;
      for (let index = 1; index < orderedStops.length; index += 1) {
        const previousStop = orderedStops[index - 1];
        const currentStop = orderedStops[index];
        total += getDisplayedSegmentKm(previousStop, currentStop);
      }
      return Math.max(0, Math.round(total));
    },
    [getDisplayedSegmentKm],
  );
  
  const sidebarStops: SidebarStop[] = useMemo(
    () =>
      filteredStops
        .map((stop) => {
          const relatedLoad = visiblePlannerLoads.find((load) => load.id === stop.loadId);
          const fallbackDate =
            stop.type === 'pickup' ? relatedLoad?.pickupDate : relatedLoad?.deliveryDate;
          const { date: etaDate, time: etaTime } = parseEtaDisplay(stop.eta, fallbackDate);
          const countryCode = normalizeCountryCode(
            stop.type === 'pickup' ? relatedLoad?.originCountry : relatedLoad?.destCountry,
          );

          return {
            id: stop.id,
            number: stop.number,
            type: stop.type,
            city: stop.city,
            postcode: stop.postcode,
            countryCode,
            lat: stop.lat ?? null,
            lng: stop.lng ?? null,
            eta: stop.eta,
            etaDate,
            etaTime,
            color: relatedLoad ? getLoadDisplayColor(relatedLoad) : stop.color,
            loadId: stop.loadId,
            brokerage: relatedLoad?.brokerage ?? '',
            locationLine: `${countryCode}, ${stop.postcode}, ${stop.city}`,
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
        .sort((a, b) => a.number - b.number), // Sort by number to maintain correct visual order
    [filteredStops, getLoadDisplayColor, visiblePlannerLoads],
  );

  const resolveSidebarStopCoordinates = useCallback(async (stop: SidebarStop): Promise<GeoPoint | null> => {
    const directCoordinates = toGeoPointFromStop(stop);
    if (directCoordinates) return directCoordinates;

    const cacheKey = buildGeocodeCacheKey(stop);
    const cached = geocodeCacheRef.current.get(cacheKey);
    if (cached !== undefined) return cached;

    const inFlight = geocodeInFlightRef.current.get(cacheKey);
    if (inFlight) return inFlight;

    const geocodePromise = (async (): Promise<GeoPoint | null> => {
      const countryCode = normalizeCountryCode(stop.countryCode).toLowerCase();
      const city = (stop.city ?? '').trim();
      const postcode = (stop.postcode ?? '').trim();
      const textQuery = buildGeocodeTextQuery(stop);
      if (!textQuery) return null;

      const fetchFirstGeocodeResult = async (params: URLSearchParams): Promise<GeoPoint | null> => {
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), 4000);
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/search?${params.toString()}`,
            {
              signal: controller.signal,
            },
          );
          if (!response.ok) return null;
          const data = (await response.json()) as Array<{ lat?: string; lon?: string }>;
          const first = data?.[0];
          const lat = Number(first?.lat);
          const lon = Number(first?.lon);
          if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
          return { lat, lon };
        } catch {
          return null;
        } finally {
          window.clearTimeout(timeoutId);
        }
      };

      const structuredParams = new URLSearchParams({
        format: 'jsonv2',
        limit: '1',
      });
      if (countryCode) structuredParams.set('countrycodes', countryCode);
      if (postcode) structuredParams.set('postalcode', postcode);
      if (city) structuredParams.set('city', city);

      if (postcode || city) {
        const structuredResult = await fetchFirstGeocodeResult(structuredParams);
        if (structuredResult) return structuredResult;
      }

      const fallbackParams = new URLSearchParams({
        format: 'jsonv2',
        limit: '1',
        q: textQuery,
      });
      if (countryCode) fallbackParams.set('countrycodes', countryCode);
      return fetchFirstGeocodeResult(fallbackParams);
    })();

    geocodeInFlightRef.current.set(cacheKey, geocodePromise);
    try {
      const resolved = await geocodePromise;
      geocodeCacheRef.current.set(cacheKey, resolved);
      return resolved;
    } finally {
      geocodeInFlightRef.current.delete(cacheKey);
    }
  }, []);

  const fetchOsrmDistanceKm = useCallback(async (from: GeoPoint, to: GeoPoint): Promise<number | null> => {
    const cacheKey = `${from.lat.toFixed(6)},${from.lon.toFixed(6)}>${to.lat.toFixed(6)},${to.lon.toFixed(6)}`;
    const cached = osrmRouteDistanceCacheRef.current.get(cacheKey);
    if (cached !== undefined) {
      return cached >= 0 ? cached : null;
    }

    try {
      const response = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}?overview=false&alternatives=false&steps=false`,
      );
      if (!response.ok) {
        osrmRouteDistanceCacheRef.current.set(cacheKey, -1);
        return null;
      }

      const payload = (await response.json()) as {
        code?: string;
        routes?: Array<{ distance?: number }>;
      };
      const meters = payload.routes?.[0]?.distance;
      if (payload.code !== 'Ok' || !Number.isFinite(meters)) {
        osrmRouteDistanceCacheRef.current.set(cacheKey, -1);
        return null;
      }

      const distanceKm = Math.max(0, Math.round((meters as number) / 1000));
      osrmRouteDistanceCacheRef.current.set(cacheKey, distanceKm);
      return distanceKm;
    } catch {
      osrmRouteDistanceCacheRef.current.set(cacheKey, -1);
      return null;
    }
  }, []);

  const sidebarDistanceSignature = useMemo(
    () =>
      sidebarStops
        .map(
          (stop) =>
            `${stop.id}:${stop.city}:${stop.postcode}:${stop.countryCode ?? ''}:${stop.lat ?? ''}:${stop.lng ?? ''}`,
        )
        .join('|'),
    [sidebarStops],
  );

  useEffect(() => {
    let isCancelled = false;

    const resolveDistances = async () => {
      if (!isLiveDistanceEnabled) {
        setSegmentDistanceKmBySegmentKey((prev) => (Object.keys(prev).length === 0 ? prev : {}));
        return;
      }

      if (sidebarStops.length <= 1) {
        setSegmentDistanceKmBySegmentKey((prev) => (Object.keys(prev).length === 0 ? prev : {}));
        return;
      }

      const nextDistances: Record<string, number> = {};

      for (let index = 1; index < sidebarStops.length; index += 1) {
        const previousStop = sidebarStops[index - 1];
        const currentStop = sidebarStops[index];
        const from = await resolveSidebarStopCoordinates(previousStop);
        const to = await resolveSidebarStopCoordinates(currentStop);
        const fallbackSourceKm = getFallbackSegmentKm(previousStop, currentStop);
        const segmentKey = buildSegmentDistanceKey(previousStop.id, currentStop.id);
        if (!from || !to) {
          if (fallbackSourceKm > 0) {
            nextDistances[segmentKey] = fallbackSourceKm;
          }
          continue;
        }

        const routedKm = await fetchOsrmDistanceKm(from, to);
        const fallbackKm =
          fallbackSourceKm > 0
            ? fallbackSourceKm
            : Math.max(0, Math.round(haversineDistanceKm(from, to)));
        nextDistances[segmentKey] = routedKm ?? fallbackKm;
      }

      if (isCancelled) return;
      setSegmentDistanceKmBySegmentKey((prev) =>
        areDistanceMapsEqual(prev, nextDistances) ? prev : nextDistances,
      );
    };

    void resolveDistances();
    return () => {
      isCancelled = true;
    };
  }, [
    fetchOsrmDistanceKm,
    getFallbackSegmentKm,
    isLiveDistanceEnabled,
    resolveSidebarStopCoordinates,
    sidebarDistanceSignature,
    sidebarStops,
  ]);

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
        color: relatedLoad ? getLoadDisplayColor(relatedLoad) : stop.color,
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
        color: relatedLoad ? getLoadDisplayColor(relatedLoad) : stop.color,
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

  const handleWorkspaceBackgroundClick = () => {
    clearLoadSelection();
    setSelectedOrganizerStatus(null);
    setQuickPriceEditor(null);
  };

  const handleOpenUploadModal = () => {
    setUploadModalInitialTab('manual');
    setShowUploadModal(true);
  };

  const handleCloseUploadModal = () => {
    setShowUploadModal(false);
  };

  const handleCancelPasteUpload = () => {
    setIsPasteConfirmOpen(false);
    setPendingPastedScreenshotFile(null);
  };

  const resetPastePreviewState = () => {
    setIsPastePreviewOpen(false);
    setIsPastePreviewLoading(false);
    setIsPastePreviewSubmitting(false);
    setPastePreviewError(null);
    setPastePreviewResult(null);
    setPastePreviewSelectedRows([]);
    setPendingPastedScreenshotFile(null);
  };

  const handleAnalyzePastedScreenshot = async (file: File) => {
    if (!selectedTrip) {
      setPastePreviewError('Select an active trip before analyzing screenshot rows.');
      return;
    }

    setIsPastePreviewOpen(true);
    setIsPastePreviewLoading(true);
    setPastePreviewError(null);
    setPastePreviewResult(null);
    setPastePreviewSelectedRows([]);

    try {
      const preview = await loadApi.previewFromScreenshot(file, {
        tripId: selectedTrip,
        status: LoadStatus.ON_BOARD,
      });
      setPastePreviewResult(preview);
      setPastePreviewSelectedRows(preview.candidates.map((candidate) => candidate.row));
      if (preview.candidates.length === 0 && preview.duplicateCount === 0) {
        setPastePreviewError('No creatable routes found in screenshot.');
      }
    } catch (error) {
      setPastePreviewError(
        error instanceof Error ? error.message : 'Failed to analyze screenshot.',
      );
    } finally {
      setIsPastePreviewLoading(false);
    }
  };

  const handleConfirmPasteUpload = () => {
    if (!pendingPastedScreenshotFile) {
      setIsPasteConfirmOpen(false);
      return;
    }
    if (!selectedTrip) {
      setLastPlannerSyncError(
        'Select an active trip before uploading screenshot into ON BOARD container.',
      );
      setIsPasteConfirmOpen(false);
      setPendingPastedScreenshotFile(null);
      return;
    }

    setIsPasteConfirmOpen(false);
    void handleAnalyzePastedScreenshot(pendingPastedScreenshotFile);
  };

  const handleTogglePastePreviewRow = (row: number) => {
    setPastePreviewSelectedRows((prev) =>
      prev.includes(row) ? prev.filter((entry) => entry !== row) : [...prev, row],
    );
  };

  const handleCommitPastePreview = async () => {
    if (!pendingPastedScreenshotFile || !pastePreviewResult) return;
    if (!selectedTrip) {
      setPastePreviewError('Select an active trip before creating routes.');
      return;
    }

    const selectedOffers = pastePreviewResult.candidates
      .filter((candidate) => pastePreviewSelectedRows.includes(candidate.row))
      .map((candidate) => candidate.offer);

    if (selectedOffers.length === 0) {
      setPastePreviewError('Select at least one route to add.');
      return;
    }

    setIsPastePreviewSubmitting(true);
    setPastePreviewError(null);
    const previewDuplicateCount = pastePreviewResult.duplicateCount;
    const previewDuplicates = pastePreviewResult.duplicates;

    try {
      const result = await loadApi.commitFromScreenshotSelection(selectedOffers, {
        tripId: selectedTrip,
        status: LoadStatus.ON_BOARD,
        file: pendingPastedScreenshotFile,
      });

      if (result.created.length > 0) {
        handleFreightCreatedMany(result.created);
      }

      const totalDuplicateCount = previewDuplicateCount + result.duplicateCount;
      if (totalDuplicateCount > 0) {
        setPasteDuplicatePopup({
          count: totalDuplicateCount,
          duplicates: [...previewDuplicates, ...result.duplicates],
        });
      }

      if (result.created.length === 0 && totalDuplicateCount === 0) {
        setPastePreviewError('No loads were created from selected rows.');
        return;
      }

      resetPastePreviewState();
    } catch (error) {
      setPastePreviewError(
        error instanceof Error ? error.message : 'Failed to create routes from screenshot.',
      );
    } finally {
      setIsPastePreviewSubmitting(false);
    }
  };

  const handleSelectStop = (id: string, multiSelect: boolean) => {
    setSelectedCargoStopId(id);
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

  const validateSidebarStopOrder = useCallback(
    (orderedSidebarStopIds: string[]): string | null => {
      const sidebarStopById = new Map(
        sidebarStops.map((stop) => [stop.id, stop] as const),
      );
      const seenPickupLoadIds = new Set<string>();

      for (const stopId of orderedSidebarStopIds) {
        const stop = sidebarStopById.get(stopId);
        if (!stop) continue;

        if (stop.type === 'pickup') {
          seenPickupLoadIds.add(stop.loadId);
          continue;
        }

        if (!seenPickupLoadIds.has(stop.loadId)) {
          const load = visiblePlannerLoads.find((currentLoad) => currentLoad.id === stop.loadId);
          const loadLabel =
            load?.referenceCode?.trim() ||
            `${load?.originCity ?? 'Unknown'} → ${load?.destCity ?? 'Unknown'}`;
          return `Unload cannot come before loading (${loadLabel}).`;
        }
      }

      return null;
    },
    [sidebarStops, visiblePlannerLoads],
  );

  const buildConstrainedStopOrder = useCallback(
    (orderedStopIds: string[], orderedStops: SidebarStop[]): string[] => {
      if (orderedStopIds.length <= 1) return orderedStopIds;

      const stopById = new Map(
        orderedStops.map((stop) => [stop.id, stop] as const),
      );
      const rankByStopId = new Map(
        orderedStopIds.map((stopId, index) => [stopId, index] as const),
      );

      const pickupByLoadId = new Map<string, string>();
      orderedStopIds.forEach((stopId) => {
        const stop = stopById.get(stopId);
        if (stop?.type === 'pickup' && !pickupByLoadId.has(stop.loadId)) {
          pickupByLoadId.set(stop.loadId, stopId);
        }
      });

      const indegreeByStopId = new Map<string, number>();
      const outgoingByStopId = new Map<string, string[]>();
      orderedStopIds.forEach((stopId) => {
        indegreeByStopId.set(stopId, 0);
        outgoingByStopId.set(stopId, []);
      });

      orderedStopIds.forEach((stopId) => {
        const stop = stopById.get(stopId);
        if (!stop || stop.type !== 'delivery') return;
        const pickupStopId = pickupByLoadId.get(stop.loadId);
        if (!pickupStopId || pickupStopId === stopId) return;
        outgoingByStopId.get(pickupStopId)?.push(stopId);
        indegreeByStopId.set(stopId, (indegreeByStopId.get(stopId) ?? 0) + 1);
      });

      const sortedQueue: string[] = orderedStopIds
        .filter((stopId) => (indegreeByStopId.get(stopId) ?? 0) === 0)
        .sort((left, right) => {
          const leftRank = rankByStopId.get(left) ?? Number.MAX_SAFE_INTEGER;
          const rightRank = rankByStopId.get(right) ?? Number.MAX_SAFE_INTEGER;
          return leftRank - rightRank;
        });

      const constrained: string[] = [];
      while (sortedQueue.length > 0) {
        const current = sortedQueue.shift();
        if (!current) break;
        constrained.push(current);

        const outgoing = outgoingByStopId.get(current) ?? [];
        outgoing.forEach((nextStopId) => {
          const nextInDegree = (indegreeByStopId.get(nextStopId) ?? 0) - 1;
          indegreeByStopId.set(nextStopId, nextInDegree);
          if (nextInDegree !== 0) return;

          const nextRank = rankByStopId.get(nextStopId) ?? Number.MAX_SAFE_INTEGER;
          let inserted = false;
          for (let index = 0; index < sortedQueue.length; index += 1) {
            const queuedRank =
              rankByStopId.get(sortedQueue[index]) ?? Number.MAX_SAFE_INTEGER;
            if (queuedRank > nextRank) {
              sortedQueue.splice(index, 0, nextStopId);
              inserted = true;
              break;
            }
          }
          if (!inserted) {
            sortedQueue.push(nextStopId);
          }
        });
      }

      if (constrained.length !== orderedStopIds.length) {
        return orderedStopIds;
      }

      return constrained;
    },
    [],
  );

  const applySidebarStopOrder = useCallback((orderedSidebarStopIds: string[]): boolean => {
    const orderError = validateSidebarStopOrder(orderedSidebarStopIds);
    if (orderError) {
      setRouteOrderError(orderError);
      return false;
    }

    setRouteOrderError(null);
    setStops((prevStops) => {
      if (orderedSidebarStopIds.length <= 1) return prevStops;

      const stopById = new Map(prevStops.map((stop) => [stop.id, stop] as const));
      const orderedStops = orderedSidebarStopIds
        .map((stopId) => stopById.get(stopId))
        .filter((stop): stop is CanvasStop => Boolean(stop));

      if (orderedStops.length <= 1) return prevStops;

      const nextNumberByStopId = new Map(
        orderedStops.map((stop, index) => [stop.id, index + 1] as const),
      );

      let didChange = false;
      const nextStops = prevStops.map((stop) => {
        const nextNumber = nextNumberByStopId.get(stop.id);
        if (typeof nextNumber !== 'number' || stop.number === nextNumber) {
          return stop;
        }
        didChange = true;
        return { ...stop, number: nextNumber };
      });

      return didChange ? nextStops : prevStops;
    });
    return true;
  }, [validateSidebarStopOrder]);

  const handleReorderStops = useCallback(
    (fromIndex: number, toIndex: number) => {
      const orderedSidebarStopIds = sidebarStops.map((stop) => stop.id);
      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= orderedSidebarStopIds.length ||
        toIndex >= orderedSidebarStopIds.length ||
        fromIndex === toIndex
      ) {
        return;
      }

      const reordered = [...orderedSidebarStopIds];
      const [movedStopId] = reordered.splice(fromIndex, 1);
      if (!movedStopId) {
        return;
      }
      reordered.splice(toIndex, 0, movedStopId);
      const previousComparison = routeComparisonRef.current;
      const didApply = applySidebarStopOrder(reordered);
      if (didApply && previousComparison) {
        setPreviousRouteComparison(previousComparison);
      }
    },
    [applySidebarStopOrder, sidebarStops],
  );

  const handleOptimizeRoute = useCallback(async () => {
    if (isOptimizingRoute) return;
    if (sidebarStops.length < 3) {
      setRouteOptimizationError('Need at least 3 stops to optimize.');
      return;
    }

    setIsOptimizingRoute(true);
    setRouteOptimizationError(null);

    const currentStops = [...sidebarStops];
    const previousStopIds = currentStops.map((stop) => stop.id);
    const previousTotalKm = computeTotalKmForStopOrder(currentStops);

    try {
      const resolved = [] as Array<{ stopId: string; point: GeoPoint }>;
      for (const stop of currentStops) {
        const point = await resolveSidebarStopCoordinates(stop);
        if (!point) {
          throw new Error(`Missing coordinates for ${stop.city} (${stop.postcode}).`);
        }
        resolved.push({ stopId: stop.id, point });
      }

      const coordsParam = resolved
        .map(({ point }) => `${point.lon},${point.lat}`)
        .join(';');
      const optimizationResponse = await fetch(
        `https://router.project-osrm.org/trip/v1/driving/${coordsParam}?source=first&destination=last&roundtrip=false&steps=false&overview=false`,
      );
      if (!optimizationResponse.ok) {
        throw new Error('Route optimization request failed.');
      }

      const payload = (await optimizationResponse.json()) as {
        code?: string;
        waypoints?: Array<{ waypoint_index?: number }>;
        trips?: Array<{ distance?: number }>;
      };

      if (payload.code !== 'Ok' || !payload.waypoints || payload.waypoints.length !== resolved.length) {
        throw new Error('Optimizer returned incomplete route.');
      }

      const optimizedStopIds = payload.waypoints
        .map((waypoint, originalIndex) => ({
          originalIndex,
          waypointIndex:
            typeof waypoint.waypoint_index === 'number'
              ? waypoint.waypoint_index
              : originalIndex,
        }))
        .sort((left, right) => left.waypointIndex - right.waypointIndex)
        .map(({ originalIndex }) => resolved[originalIndex].stopId);

      const constrainedStopIds = buildConstrainedStopOrder(
        optimizedStopIds,
        currentStops,
      );
      const constrainedStops = constrainedStopIds
        .map((stopId) => currentStops.find((stop) => stop.id === stopId))
        .filter((stop): stop is SidebarStop => Boolean(stop));

      const optimizedMeters =
        constrainedStopIds.every((stopId, index) => stopId === optimizedStopIds[index])
          ? payload.trips?.[0]?.distance
          : undefined;
      const optimizedTotalKm =
        typeof optimizedMeters === 'number' && Number.isFinite(optimizedMeters)
          ? Math.max(0, Math.round(optimizedMeters / 1000))
          : computeTotalKmForStopOrder(constrainedStops);

      const previousComparison = routeComparisonRef.current;
      const didApply = applySidebarStopOrder(constrainedStopIds);
      if (!didApply) {
        setRouteOptimizationError(
          'Optimization failed to produce a valid loading order.',
        );
        return;
      }
      if (previousComparison) {
        setPreviousRouteComparison(previousComparison);
      }

      setRouteOptimizationSnapshot({
        previousStopIds,
        previousTotalKm,
        optimizedTotalKm,
      });
    } catch (error) {
      setRouteOptimizationError(
        error instanceof Error ? error.message : 'Failed to optimize route.',
      );
    } finally {
      setIsOptimizingRoute(false);
    }
  }, [
    applySidebarStopOrder,
    computeTotalKmForStopOrder,
    isOptimizingRoute,
    resolveSidebarStopCoordinates,
    sidebarStops,
  ]);

  const handleUndoRouteOptimization = useCallback(() => {
    if (!routeOptimizationSnapshot) return;
    const previousComparison = routeComparisonRef.current;
    const didApply = applySidebarStopOrder(routeOptimizationSnapshot.previousStopIds);
    if (!didApply) {
      setRouteOptimizationError('Cannot restore route order: loading must come before unload.');
      return;
    }
    if (previousComparison) {
      setPreviousRouteComparison(previousComparison);
    }
    setRouteOptimizationSnapshot(null);
    setRouteOptimizationError(null);
  }, [applySidebarStopOrder, routeOptimizationSnapshot]);

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
    const loadDisplayColor = getLoadDisplayColor(load);

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
      color: loadDisplayColor,
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
      color: loadDisplayColor,
      loadId: load.id,
      pallets: load.pallets,
      weight: load.weight,
      x: 1100,
      y: 100 + nextStopNumber * 180,
    };

    setStops(prev => [...prev, pickupStop, deliveryStop]);
  }, [getLoadDisplayColor, stops]);

  // Handle Remove from Van - removes stops from active route
  const handleRemoveFromVan = useCallback((load: PlannerLoad) => {
    // Remove stops associated with this load from active stops
    setStops(prev => prev.filter(stop => stop.loadId !== load.id));
  }, []);

  const normalizeOrganizerStatus = (status: PlannerLoad['status']): OrganizerStatus =>
    status === 'TAKEN' || status === 'NEGOTIATING' ? status : 'ON BOARD';

  const inactiveLoads = visiblePlannerLoads.filter((load) => load.isInactive);
  const getOrganizerLoads = (status: OrganizerStatus) =>
    status === 'ON BOARD'
      ? visiblePlannerLoads.filter(
          (load) =>
            !load.isInactive &&
            (load.status === 'ON BOARD' || load.status === 'NEGOTIATING'),
        )
      : visiblePlannerLoads.filter((load) => !load.isInactive && load.status === status);
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

  const removeLoadFromPlannerState = (loadId: string) => {
    setLoads((prev) => prev.filter((load) => load.id !== loadId));
    setStops((prev) => prev.filter((stop) => stop.loadId !== loadId));
    setLoadTagsByLoadId((prev) => {
      if (!(loadId in prev)) return prev;
      const next = { ...prev };
      delete next[loadId];
      return next;
    });
    setSelectedLoadId((current) => (current === loadId ? null : current));
    setEditingLoadId((current) => (current === loadId ? null : current));
    setEditingPalletLoadId((current) => (current === loadId ? null : current));
    setTagEditor((current) => (current?.loadId === loadId ? null : current));
    setSelectedStops([]);
  };

  const handleRequestDeleteTakenRoute = (loadId: string) => {
    setTakenDeleteError(null);
    setPendingTakenDeleteLoadId(loadId);
  };

  const handleCancelDeleteTakenRoute = () => {
    if (isDeletingTakenRoute) return;
    setTakenDeleteError(null);
    setPendingTakenDeleteLoadId(null);
  };

  const handleConfirmDeleteTakenRoute = async () => {
    if (!pendingTakenDeleteLoadId || isDeletingTakenRoute) return;

    setIsDeletingTakenRoute(true);
    setTakenDeleteError(null);
    try {
      await loadApi.delete(pendingTakenDeleteLoadId);
      removeLoadFromPlannerState(pendingTakenDeleteLoadId);
      setPendingTakenDeleteLoadId(null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to delete taken route.';
      setLastPlannerSyncError(message);
      setTakenDeleteError(message);
    } finally {
      setIsDeletingTakenRoute(false);
    }
  };

  const handleHardDeleteInactiveLoad = async (loadId: string) => {
    const load = loads.find((currentLoad) => currentLoad.id === loadId);
    if (!load || !load.isInactive || isDeletingInactive) return;

    const confirmed = window.confirm(
      'Delete this inactive load permanently? This removes the load, stops, pallets, documents, and payments. Brokers stay untouched.',
    );
    if (!confirmed) return;

    setIsDeletingInactive(true);
    try {
      await loadApi.delete(loadId);
      removeLoadFromPlannerState(loadId);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to delete inactive load.';
      setLastPlannerSyncError(message);
      window.alert(message);
    } finally {
      setIsDeletingInactive(false);
    }
  };

  const handleHardDeleteAllInactive = async () => {
    if (isDeletingInactive || inactiveLoads.length === 0) return;

    const confirmed = window.confirm(
      `Delete all inactive loads (${inactiveLoads.length}) permanently? This cannot be undone.`,
    );
    if (!confirmed) return;

    setIsDeletingInactive(true);
    try {
      const inactiveIds = inactiveLoads.map((load) => load.id);
      const results = await Promise.allSettled(
        inactiveIds.map((loadId) => loadApi.delete(loadId)),
      );
      const deletedIds: string[] = [];
      let failedCount = 0;

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          deletedIds.push(inactiveIds[index]);
          return;
        }
        failedCount += 1;
      });

      if (deletedIds.length > 0) {
        setLoads((prev) => prev.filter((load) => !deletedIds.includes(load.id)));
        setStops((prev) => prev.filter((stop) => !deletedIds.includes(stop.loadId)));
        setLoadTagsByLoadId((prev) => {
          const shouldPrune = deletedIds.some((id) => id in prev);
          if (!shouldPrune) return prev;
          const next = { ...prev };
          deletedIds.forEach((loadId) => {
            delete next[loadId];
          });
          return next;
        });
        setSelectedLoadId((current) => (current && deletedIds.includes(current) ? null : current));
        setEditingLoadId((current) => (current && deletedIds.includes(current) ? null : current));
        setEditingPalletLoadId((current) =>
          current && deletedIds.includes(current) ? null : current,
        );
        setTagEditor((current) =>
          current && deletedIds.includes(current.loadId) ? null : current,
        );
        setSelectedStops([]);
      }

      if (failedCount > 0) {
        const message = `${failedCount} inactive load(s) failed to delete.`;
        setLastPlannerSyncError(message);
        window.alert(message);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to delete inactive loads.';
      setLastPlannerSyncError(message);
      window.alert(message);
    } finally {
      setIsDeletingInactive(false);
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

  const formatLoadAddressLine = (city: string, address?: string, country?: string) =>
    `${normalizeCountryCode(country)}, ${extractPostcode(address)}, ${city}`;

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

  const handleOpenLoadPdf = async (loadId: string) => {
    const currentLoad = loads.find((load) => load.id === loadId);
    if (!currentLoad) return;

    if (currentLoad.sourceFreightPdfUrl) {
      window.open(currentLoad.sourceFreightPdfUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    try {
      const docs = await documentApi.getByEntity(DocumentCategory.LOAD, loadId);
      const sourcePdfDoc =
        docs.find((doc) => doc.documentType === DocumentType.FREIGHT_ORDER) ??
        docs.find((doc) => doc.mimeType?.toLowerCase().includes('pdf'));

      if (!sourcePdfDoc) {
        window.alert('No PDF document found for this load.');
        return;
      }

      const openUrl = buildDocumentOpenUrl(sourcePdfDoc.id);
      setLoads((prev) =>
        prev.map((load) => (load.id === loadId ? { ...load, sourceFreightPdfUrl: openUrl } : load)),
      );
      window.open(openUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to open PDF document.';
      setLastPlannerSyncError(message);
      window.alert(message);
    }
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

  const setLoadNegotiatingState = (loadId: string, isNegotiating: boolean) => {
    setLoads((prev) =>
      prev.map((load) => {
        if (load.id !== loadId) return load;
        if (load.status === 'TAKEN') return load;
        return {
          ...load,
          status: isNegotiating ? 'NEGOTIATING' : 'ON BOARD',
        };
      }),
    );
  };

  const applyOrganizerSelection = useCallback(
    (
      loadId: string,
      statusLoadIds: string[],
      options: { isShift: boolean; isToggle: boolean },
    ) => {
      if (options.isShift) {
        const anchorId =
          organizerSelectionAnchorId && statusLoadIds.includes(organizerSelectionAnchorId)
            ? organizerSelectionAnchorId
            : loadId;
        const anchorIndex = statusLoadIds.indexOf(anchorId);
        const currentIndex = statusLoadIds.indexOf(loadId);

        if (anchorIndex >= 0 && currentIndex >= 0) {
          const [start, end] =
            anchorIndex <= currentIndex
              ? [anchorIndex, currentIndex]
              : [currentIndex, anchorIndex];
          const rangeIds = statusLoadIds.slice(start, end + 1);
          setSelectedOrganizerLoadIds((prev) => {
            const merged = new Set(prev);
            rangeIds.forEach((id) => merged.add(id));
            return Array.from(merged);
          });
        } else {
          setSelectedOrganizerLoadIds([loadId]);
        }

        setOrganizerSelectionAnchorId(loadId);
        return;
      }

      if (options.isToggle) {
        setSelectedOrganizerLoadIds((prev) =>
          prev.includes(loadId) ? prev.filter((id) => id !== loadId) : [...prev, loadId],
        );
        setOrganizerSelectionAnchorId(loadId);
        return;
      }

      setSelectedOrganizerLoadIds([loadId]);
      setOrganizerSelectionAnchorId(loadId);
    },
    [organizerSelectionAnchorId],
  );

  const handleOpenQuickPriceEditor = (load: PlannerLoad) => {
    const hasPrice = Number.isFinite(load.price) && load.price > 0;
    const initialValue = hasPrice ? String(load.price) : '';
    setQuickPriceEditor({ loadId: load.id, value: initialValue });
  };

  const handleSaveQuickPriceEditor = () => {
    if (!quickPriceEditor) return;

    const normalized = quickPriceEditor.value.replace(',', '.').trim();
    const parsed = Number.parseFloat(normalized);
    const nextValue = normalized === '' || !Number.isFinite(parsed) ? 0 : parsed;
    updateLoadPrice(quickPriceEditor.loadId, nextValue);
    setQuickPriceEditor(null);
  };

  useEffect(() => {
    if (!quickPriceEditor) return;

    const timer = window.setTimeout(() => {
      const input = quickPriceInputRef.current;
      if (!input) return;
      input.focus();
      if (quickPriceEditor.value.trim()) {
        input.select();
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, [quickPriceEditor?.loadId]);

  const plannerTagOptions = useMemo(() => {
    const uniqueTags = new Map<string, string>();
    loads.forEach((load) => {
      const tags = loadTagsByLoadId[load.id] ?? [];
      tags.forEach((tag) => {
        const normalized = normalizeTagValue(tag);
        if (!normalized) return;
        const key = normalized.toLowerCase();
        if (!uniqueTags.has(key)) {
          uniqueTags.set(key, normalized);
        }
      });
    });

    return Array.from(uniqueTags.values()).sort((left, right) =>
      left.localeCompare(right, undefined, { sensitivity: 'base' }),
    );
  }, [loadTagsByLoadId, loads]);
  const tagEditorSuggestions = useMemo(() => {
    if (!tagEditor) return [];
    const selected = new Set(tagEditor.draftTags.map((tag) => tag.toLowerCase()));
    return plannerTagOptions.filter((tag) => !selected.has(tag.toLowerCase()));
  }, [plannerTagOptions, tagEditor]);
  const tagEditorLoad = useMemo(
    () =>
      tagEditor
        ? loads.find((load) => load.id === tagEditor.loadId) ?? null
        : null,
    [loads, tagEditor],
  );

  const openTagEditor = useCallback(
    (loadId: string) => {
      const existingTags = loadTagsByLoadId[loadId] ?? [];
      setTagEditor({
        loadId,
        draftTags: [...existingTags],
        inputValue: '',
      });
    },
    [loadTagsByLoadId],
  );

  const closeTagEditor = useCallback(() => {
    setTagEditor(null);
  }, []);

  const addTagToEditor = useCallback((rawTag: string) => {
    setTagEditor((current) => {
      if (!current) return current;
      const normalizedTag = normalizeTagValue(rawTag);
      if (!normalizedTag) return current;
      const exists = current.draftTags.some(
        (tag) => tag.toLowerCase() === normalizedTag.toLowerCase(),
      );
      if (exists) {
        return { ...current, inputValue: '' };
      }
      return {
        ...current,
        draftTags: [...current.draftTags, normalizedTag],
        inputValue: '',
      };
    });
  }, []);

  const removeTagFromEditor = useCallback((tagToRemove: string) => {
    setTagEditor((current) => {
      if (!current) return current;
      return {
        ...current,
        draftTags: current.draftTags.filter(
          (tag) => tag.toLowerCase() !== tagToRemove.toLowerCase(),
        ),
      };
    });
  }, []);

  const saveTagEditor = useCallback(() => {
    setTagEditor((current) => {
      if (!current) return current;
      const normalizedTags = dedupeTagList([
        ...current.draftTags,
        current.inputValue,
      ]);
      setLoadTagsByLoadId((prev) => {
        const existing = prev[current.loadId] ?? [];
        const sameLength = existing.length === normalizedTags.length;
        const sameValues =
          sameLength &&
          existing.every(
            (tag, index) =>
              tag.toLowerCase() === normalizedTags[index].toLowerCase(),
          );
        if (sameValues) return prev;

        if (normalizedTags.length === 0) {
          if (!(current.loadId in prev)) return prev;
          const next = { ...prev };
          delete next[current.loadId];
          return next;
        }

        return {
          ...prev,
          [current.loadId]: normalizedTags,
        };
      });
      return null;
    });
  }, []);

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

  const routeComparison = useMemo<RouteComparisonSnapshot>(() => {
    const FUEL_PRICE_PER_LITER = 1.65;
    const FUEL_LITER_PER_KM = 0.35;
    const AVERAGE_SPEED_KMH = 65;
    const activeLoads = visiblePlannerLoads.filter((load) => !load.isInactive);

    const formatDurationByKm = (totalKm: number): string => {
      const safeKm = Math.max(0, totalKm);
      const totalMinutes = Math.max(
        0,
        Math.round((safeKm / AVERAGE_SPEED_KMH) * 60),
      );
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      if (hours <= 0) return `${minutes}m`;
      return `${hours}h ${String(minutes).padStart(2, '0')}m`;
    };

    const buildStats = (predicate: (load: PlannerLoad) => boolean) => {
      const scopedLoads = activeLoads.filter(predicate);
      const scopedLoadIds = new Set(scopedLoads.map((load) => load.id));
      const scopedStops = sidebarStops.filter((stop) => scopedLoadIds.has(stop.loadId));
      const representedLoadIds = new Set(scopedStops.map((stop) => stop.loadId));
      const representedLoads = scopedLoads.filter((load) => representedLoadIds.has(load.id));
      const totalKm = computeTotalKmForStopOrder(scopedStops);
      const estimatedFuel = Math.max(0, Math.round(totalKm * FUEL_LITER_PER_KM));
      const fuelCost = Math.max(0, Math.round(estimatedFuel * FUEL_PRICE_PER_LITER));
      const totalRevenue = Number(
        representedLoads
          .reduce((sum, load) => sum + Number(load.price ?? 0), 0)
          .toFixed(2),
      );
      const estimatedMargin = Number((totalRevenue - fuelCost).toFixed(2));
      const stopCount = scopedStops.length;

      return {
        totalKm,
        totalTime: formatDurationByKm(totalKm),
        estimatedFuel,
        fuelCost,
        totalRevenue,
        pricePerKm: totalKm > 0 ? totalRevenue / totalKm : 0,
        estimatedMargin,
        stopCount: Math.max(0, stopCount),
      };
    };

    return {
      currentRoute: buildStats((load) => load.status === 'TAKEN'),
      plannedRoute: buildStats(
        (load) => load.status === 'TAKEN' || load.status === 'NEGOTIATING',
      ),
    };
  }, [computeTotalKmForStopOrder, sidebarStops, visiblePlannerLoads]);
  useEffect(() => {
    routeComparisonRef.current = routeComparison;
  }, [routeComparison]);
  const hasSelectedStops = selectedStops.length > 0;
  const takenSidebarRoutes = useMemo(
    () =>
      visiblePlannerLoads.filter(
        (load) => !load.isInactive && load.status === 'TAKEN',
      ),
    [visiblePlannerLoads],
  );
  const pendingTakenDeleteLoad = useMemo(
    () =>
      pendingTakenDeleteLoadId
        ? loads.find((load) => load.id === pendingTakenDeleteLoadId) ?? null
        : null,
    [loads, pendingTakenDeleteLoadId],
  );

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
              onClick={handleOpenUploadModal}
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
        <div className="flex-1 flex overflow-hidden" onClick={handleWorkspaceBackgroundClick}>
          {/* Right Sidebar - Route Stops + Taken Routes */}
          <div className="order-last flex w-80 min-h-0 flex-col overflow-hidden border-l border-gray-300 bg-white">
            {/* Sidebar Header */}
            <div className="relative z-10 bg-gray-50 border-b border-gray-300 px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-semibold text-sm text-gray-900">
                  {routeMode === 'simulation' ? 'Simulation Route' : 'Route Stops'}
                </h2>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Click to select, drag to reorder
              </p>

              <div className="mt-2 space-y-1.5">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleOptimizeRoute()}
                    disabled={isOptimizingRoute || sidebarStops.length < 3}
                    className="rounded border border-slate-300 bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                    title="Optimize current stop order once"
                  >
                    {isOptimizingRoute ? 'Optimizing...' : 'Optimize'}
                  </button>
                  <button
                    type="button"
                    onClick={handleUndoRouteOptimization}
                    disabled={!routeOptimizationSnapshot}
                    className="rounded border border-slate-300 bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                    title="Undo last optimization"
                  >
                    Undo
                  </button>
                  {hasSelectedStops ? (
                    <span className="text-[10px] font-semibold text-slate-500">
                      Selected: {selectedStops.length}
                    </span>
                  ) : null}
                </div>
                {routeOptimizationError ? (
                  <p className="text-[10px] font-semibold text-rose-600">{routeOptimizationError}</p>
                ) : null}
                {routeOrderError ? (
                  <p className="text-[10px] font-semibold text-rose-600">{routeOrderError}</p>
                ) : null}
              </div>
            </div>

            {/* Simulation Impact Panel */}
            {routeMode === 'simulation' && hasSimulation && (
              <div className="px-3 pt-3">
                <SimulationImpactPanel impact={simulationImpact} />
              </div>
            )}

            {/* Stops List */}
            <div className="min-h-0 flex-1 overflow-y-auto">
              {sidebarStops.length === 0 ? (
                <p className="m-3 rounded border border-dashed border-gray-300 bg-white px-2 py-3 text-center text-xs text-gray-500">
                  No route stops.
                </p>
              ) : (
                sidebarStops.map((stop, index) => {
                  const previousStop = index > 0 ? sidebarStops[index - 1] : null;
                  const segmentKmValue = previousStop
                    ? getDisplayedSegmentKm(previousStop, stop)
                    : 0;
                  const segmentKmLabel = segmentKmValue > 0 ? `${segmentKmValue} km` : '— km';

                  return (
                    <div key={stop.id} onClick={(event) => event.stopPropagation()}>
                      <div className="relative h-px bg-gray-200 z-50">
                        {index > 0 && (
                          <span className="pointer-events-none absolute right-11 top-1/2 -translate-y-1/2 rounded bg-white px-1 text-[10px] font-medium text-gray-400">
                            {segmentKmLabel}
                          </span>
                        )}
                      </div>

                      <SidebarStopCard
                        stop={stop}
                        index={index}
                        draggingIndex={draggingSidebarStopIndex}
                        isSelected={selectedStops.includes(stop.id)}
                        onSelect={handleSelectStop}
                        onReorder={handleReorderStops}
                        onDraggingIndexChange={setDraggingSidebarStopIndex}
                        onTranseuAction={handleSidebarStopTranseuAction}
                      />
                    </div>
                  );
                })
              )}
            </div>

            {/* Taken Routes compact list (bottom) */}
            <div className="border-t border-gray-200 bg-gray-50/50">
              <div className="px-3 py-2">
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-700">
                  Taken Routes
                </h3>
              </div>
              <div className="max-h-48 overflow-y-auto px-2 pb-2">
                <div className="flex min-h-full flex-col justify-end gap-2">
                  {takenSidebarRoutes.length === 0 ? (
                    <p className="rounded border border-dashed border-gray-300 bg-white px-2 py-2 text-center text-xs text-gray-500">
                      No taken routes.
                    </p>
                  ) : (
                    takenSidebarRoutes.map((load) => {
                      const pickupStop = combinedStops.find(
                        (stop) => stop.loadId === load.id && stop.type === 'pickup',
                      );
                      const deliveryStop = combinedStops.find(
                        (stop) => stop.loadId === load.id && stop.type === 'delivery',
                      );
                      const pickupCountry = normalizeCountryCode(load.originCountry);
                      const deliveryCountry = normalizeCountryCode(load.destCountry);
                      const pickupPostcode =
                        pickupStop?.postcode || extractPostcode(load.originAddress);
                      const deliveryPostcode =
                        deliveryStop?.postcode || extractPostcode(load.destAddress);
                      const routeLine = `${pickupCountry}, ${pickupPostcode} > ${deliveryCountry}, ${deliveryPostcode}`;
                      const formattedPrice = `${Number(load.price || 0).toFixed(2)} €`;

                      return (
                        <div
                          key={`taken-sidebar-${load.id}`}
                          className="flex items-stretch gap-1"
                        >
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleSelectLoad(load.id);
                            }}
                            className={`flex-1 rounded border px-2 py-1.5 text-left transition-colors ${
                              selectedLoadId === load.id
                                ? 'border-blue-400 bg-blue-50'
                                : 'border-gray-200 bg-white hover:bg-gray-50'
                            }`}
                            title="Select load"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="truncate text-[11px] font-semibold text-gray-900">
                                {truncateWithEllipsis(load.brokerage, 30)}
                              </p>
                              <span className="shrink-0 text-[11px] font-semibold text-gray-700">
                                {formattedPrice}
                              </span>
                            </div>
                            <p className="mt-0.5 truncate text-[10px] text-gray-600">{routeLine}</p>
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleRequestDeleteTakenRoute(load.id);
                            }}
                            className="rounded border border-red-200 bg-white px-2 text-red-600 transition-colors hover:bg-red-50"
                            title="Delete taken route"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>

          <div
            className="grid h-full min-h-0 flex-1 min-w-0 overflow-hidden"
            style={{ gridTemplateColumns: 'minmax(0, 1fr) 1px 480px' }}
          >
              <aside className="min-w-0 min-h-0 bg-white border-r border-gray-300 flex flex-col">
                <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-semibold text-gray-900">Route Status Organizer</h2>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Transeu-style table view for ON BOARD routes.
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

                <div className="flex-1 min-h-0 overflow-hidden p-3 flex flex-col gap-3">
                  <div className="h-full min-h-0 flex-1 grid grid-cols-2 grid-rows-[minmax(0,1fr)] gap-3">
                    {ORGANIZER_STATUSES.map((status) => {
                      const baseStatusLoads = getOrganizerLoads(status);
                      const filteredStatusLoads = baseStatusLoads.filter((load) => {
                        if (organizerLoadFilter === 'ALL') return true;
                        if (organizerLoadFilter === 'NEGOTIATING') {
                          return load.status === 'NEGOTIATING';
                        }
                        return load.status === 'ON BOARD';
                      });
                      const statusLoads = [...filteredStatusLoads];
                      const statusLoadIds = statusLoads.map((load) => load.id);
                      const selectedIdsInView = statusLoadIds.filter((id) =>
                        selectedOrganizerLoadIds.includes(id),
                      );
                      const selectedCountInView = selectedIdsInView.length;
                      const singleSelectedId =
                        selectedCountInView === 1 ? selectedIdsInView[0] : null;
                      const statusStyle =
                        status === 'TAKEN'
                          ? 'border-blue-300 bg-blue-50'
                          : status === 'NEGOTIATING'
                            ? 'border-emerald-300 bg-emerald-50'
                            : 'border-slate-300 bg-slate-50';
                      const layoutStyle =
                        status === 'ON BOARD'
                          ? 'col-span-2 row-start-1'
                          : 'col-span-2 row-start-2';
                      const renderOrganizerLoadRow = (load: (typeof statusLoads)[number]) => {
                        const loadRouteStops = combinedStops
                          .filter(
                            (stop) =>
                              stop.loadId === load.id &&
                              (stop.type === 'pickup' || stop.type === 'delivery'),
                          )
                          .sort((a, b) => a.number - b.number);
                        const pickupStop = loadRouteStops.find((stop) => stop.type === 'pickup');
                        const deliveryStop = loadRouteStops.find((stop) => stop.type === 'delivery');
                        const pickupCountryCode = normalizeCountryCode(load.originCountry);
                        const deliveryCountryCode = normalizeCountryCode(load.destCountry);
                        const pickupPostcode = pickupStop?.postcode || extractPostcode(load.originAddress);
                        const deliveryPostcode = deliveryStop?.postcode || extractPostcode(load.destAddress);
                        const pickupScheduleLabel = formatMarketplaceSchedule(
                          load.pickupWindowStart ?? load.pickupDate,
                          load.pickupWindowEnd,
                          pickupStop?.eta,
                        );
                        const deliveryScheduleLabel = formatMarketplaceSchedule(
                          load.deliveryWindowStart ?? load.deliveryDate,
                          load.deliveryWindowEnd,
                          deliveryStop?.eta,
                        );
                        const freightTextRows = buildFreightTextRows({
                          capacityTons:
                            load.capacityTons ??
                            (Number.isFinite(load.weight) && load.weight > 0
                              ? load.weight / 1000
                              : undefined),
                          bodyTypeText: load.bodyTypeText,
                          loadingMeters: load.loadingMeters,
                          distanceKm: load.distance,
                          bodySize: load.bodySize,
                          freightMode: load.freightMode,
                          additionalDescription: load.additionalDescription,
                        });
                        const pickupLocationLabel = `${pickupCountryCode} ${pickupPostcode} ${load.originCity}`;
                        const deliveryLocationLabel = `${deliveryCountryCode} ${deliveryPostcode} ${load.destCity}`;
                        const priceLabel = load.price > 0 ? `${Number(load.price.toFixed(2))} EUR` : '- EUR';
                        const loadTags = loadTagsByLoadId[load.id] ?? [];
                        const loadTagSummary =
                          loadTags.length === 0
                            ? 'No tags'
                            : loadTags.length <= 2
                              ? loadTags.join(', ')
                              : `${loadTags.slice(0, 2).join(', ')} +${loadTags.length - 2}`;
                        const isNegotiatingChecked = load.status === 'NEGOTIATING';
                        const pickupFlag = countryCodeToFlag(load.originCountry) || '🏳️';
                        const deliveryFlag = countryCodeToFlag(load.destCountry) || '🏳️';
                        const ratingValue = load.brokerTransEuRating?.trim() || null;
                        const reviewCountLabel =
                          typeof load.brokerTransEuReviewCount === 'number'
                            ? `(${load.brokerTransEuReviewCount})`
                            : '';
                        const paidOnTimeValue =
                          typeof load.brokerTransEuPaidOnTime === 'number'
                            ? String(load.brokerTransEuPaidOnTime)
                            : '—';
                        const paidWithDelayValue =
                          typeof load.brokerTransEuPaidWithDelay === 'number'
                            ? String(load.brokerTransEuPaidWithDelay)
                            : '—';
                        const paymentIssuesValue =
                          typeof load.brokerTransEuPaymentIssues === 'number'
                            ? String(load.brokerTransEuPaymentIssues)
                            : '—';
                        const loadAccentColor = getLoadDisplayColor(load);
                        const rowBorderColor = isNegotiatingChecked ? loadAccentColor : '#d1d5db';
                        const negotiatingBackgroundColor = withHexAlpha(loadAccentColor, 0.16);
                        const isRowSelectedForActions = selectedOrganizerLoadIds.includes(load.id);
                        const rowToneClass = isRowSelectedForActions
                          ? 'bg-blue-50'
                          : selectedLoadId === load.id
                              ? 'bg-blue-50'
                              : 'bg-white';

                        return (
                          <tr
                            key={load.id}
                            onMouseDown={(event) => {
                              if (event.ctrlKey) {
                                event.preventDefault();
                              }
                            }}
                            onContextMenu={(event) => {
                              if (event.ctrlKey) {
                                event.preventDefault();
                              }
                            }}
                            onClick={(event) => {
                              event.stopPropagation();
                              handleSelectLoad(load.id);
                              applyOrganizerSelection(load.id, statusLoadIds, {
                                isShift: event.shiftKey,
                                isToggle: event.ctrlKey || event.metaKey,
                              });
                            }}
                            style={{
                              boxShadow: `inset -6px 0 0 ${rowBorderColor}`,
                              backgroundColor:
                                !isRowSelectedForActions &&
                                selectedLoadId !== load.id &&
                                isNegotiatingChecked
                                  ? negotiatingBackgroundColor
                                  : undefined,
                            }}
                            className={`select-none cursor-pointer border-b border-slate-200 transition-colors hover:bg-slate-50 ${rowToneClass}`}
                          >
                            <td className="px-2 py-2 align-top">
                              <div className="flex items-start gap-2">
                                <button
                                  type="button"
                                  role="checkbox"
                                  aria-checked={isRowSelectedForActions}
                                  onMouseDown={(event) => {
                                    event.stopPropagation();
                                    if (event.ctrlKey) {
                                      event.preventDefault();
                                    }
                                  }}
                                  onContextMenu={(event) => {
                                    event.stopPropagation();
                                    if (event.ctrlKey) {
                                      event.preventDefault();
                                    }
                                  }}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    applyOrganizerSelection(load.id, statusLoadIds, {
                                      isShift: event.shiftKey,
                                      isToggle: event.ctrlKey || event.metaKey,
                                    });
                                  }}
                                  className={`mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded border ${
                                    isRowSelectedForActions
                                      ? 'border-blue-600 bg-blue-600'
                                      : 'border-slate-300 bg-white'
                                  }`}
                                  title={
                                    isRowSelectedForActions
                                      ? 'Selected'
                                      : 'Select (Shift: range, Ctrl/Cmd: toggle)'
                                  }
                                >
                                  {isRowSelectedForActions ? (
                                    <Check className="h-3 w-3 text-white" />
                                  ) : null}
                                </button>
                                <span className="shrink-0 text-lg leading-none">{pickupFlag}</span>
                                <div className="min-w-0">
                                  <p className="truncate text-[12px] font-semibold text-slate-800">
                                    {pickupLocationLabel}
                                  </p>
                                  <p className="truncate text-[11px] text-slate-600">{pickupScheduleLabel}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-2 py-2 align-top">
                              <div className="flex items-start gap-2">
                                <span className="shrink-0 text-lg leading-none">{deliveryFlag}</span>
                                <div className="min-w-0">
                                  <p className="truncate text-[12px] font-semibold text-slate-800">
                                    {deliveryLocationLabel}
                                  </p>
                                  <p className="truncate text-[11px] text-slate-600">{deliveryScheduleLabel}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-2 py-2 align-top">
                              <div className="min-w-0">
                                <p className="truncate text-[12px] font-semibold text-slate-800">
                                  {freightTextRows.line1 || '—'}
                                </p>
                                <p className="truncate text-[11px] text-slate-700">
                                  {freightTextRows.line2 || '—'}
                                </p>
                                {freightTextRows.line3 ? (
                                  <p className="truncate text-[11px] text-slate-600" title={freightTextRows.line3}>
                                    {freightTextRows.line3}
                                  </p>
                                ) : null}
                              </div>
                            </td>
                            <td className="px-2 py-2 align-top">
                              <button
                                type="button"
                                onMouseDown={(event) => event.stopPropagation()}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleOpenQuickPriceEditor(load);
                                }}
                                className="text-[12px] font-semibold text-slate-800 hover:text-blue-700"
                                title="Quick edit price"
                              >
                                {priceLabel}
                              </button>
                            </td>
                            <td className="px-2 py-2 align-top">
                              <button
                                type="button"
                                onMouseDown={(event) => event.stopPropagation()}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openTagEditor(load.id);
                                }}
                                className={`truncate text-left text-[11px] ${
                                  loadTags.length === 0
                                    ? 'text-slate-400 hover:text-slate-500'
                                    : 'text-slate-700 hover:text-blue-700'
                                }`}
                                title={loadTags.length === 0 ? 'Set tags' : loadTags.join(', ')}
                              >
                                {loadTagSummary}
                              </button>
                            </td>
                            <td className="px-2 py-2 align-top">
                              <p className="truncate text-[12px] font-semibold text-slate-800">
                                {truncateWithEllipsis(load.brokerage, 30)}
                              </p>
                              <p className="truncate text-[11px] text-slate-600">
                                {load.contactPerson || 'Contact not set'}
                              </p>
                              <div className="mt-1 flex flex-wrap gap-1">
                                <span className="inline-flex items-center rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                                  {`★ ${ratingValue ?? '—'}${reviewCountLabel ? ` ${reviewCountLabel}` : ''}`}
                                </span>
                                <span
                                  className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold"
                                  title="Paid on time / paid with delay / payment issues"
                                >
                                  <span className="text-emerald-700">{paidOnTimeValue}</span>
                                  <span className="text-slate-400">/</span>
                                  <span className="text-amber-700">{paidWithDelayValue}</span>
                                  <span className="text-slate-400">/</span>
                                  <span className="text-rose-700">{paymentIssuesValue}</span>
                                </span>
                              </div>
                            </td>
                            <td className="py-2 pl-2 pr-4 align-middle">
                              <div className="flex items-center justify-end">
                                <button
                                  type="button"
                                  role="switch"
                                  aria-checked={isNegotiatingChecked}
                                  onMouseDown={(event) => event.stopPropagation()}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleSelectLoad(load.id);
                                    applyOrganizerSelection(load.id, statusLoadIds, {
                                      isShift: false,
                                      isToggle: false,
                                    });
                                    setLoadNegotiatingState(load.id, !isNegotiatingChecked);
                                  }}
                                  className="relative inline-flex h-5 w-10 items-center rounded-full border transition-colors"
                                  style={{
                                    borderColor: isNegotiatingChecked ? loadAccentColor : '#94a3b8',
                                    backgroundColor: isNegotiatingChecked
                                      ? loadAccentColor
                                      : '#e5e7eb',
                                  }}
                                  title={isNegotiatingChecked ? 'Negotiating: ON' : 'Negotiating: OFF'}
                                >
                                  <span
                                    className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
                                      isNegotiatingChecked ? 'translate-x-[18px]' : 'translate-x-[2px]'
                                    }`}
                                  />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      };

                      return (
                        <section
                          key={status}
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedOrganizerStatus(status);
                          }}
                          className={`min-h-0 overflow-hidden rounded-xl border p-3 transition-colors flex flex-col ${layoutStyle} ${
                            dragOverStatus === status || selectedOrganizerStatus === status
                              ? 'ring-2 ring-blue-400 ring-offset-1'
                              : ''
                          } ${statusStyle}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex min-h-[24px] items-center gap-1">
                              {selectedCountInView > 0 ? (
                                <>
                                  <span className="rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                                    {selectedCountInView} selected
                                  </span>
                                  <button
                                    type="button"
                                    onMouseDown={(event) => event.stopPropagation()}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      selectedIdsInView.forEach((id) =>
                                        setLoadNegotiatingState(id, true),
                                      );
                                    }}
                                    className="rounded border border-emerald-300 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-50"
                                  >
                                    Set Neg
                                  </button>
                                  <button
                                    type="button"
                                    onMouseDown={(event) => event.stopPropagation()}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      selectedIdsInView.forEach((id) =>
                                        setLoadNegotiatingState(id, false),
                                      );
                                    }}
                                    className="rounded border border-blue-300 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 hover:bg-blue-50"
                                  >
                                    Set On
                                  </button>
                                  <button
                                    type="button"
                                    onMouseDown={(event) => event.stopPropagation()}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      selectedIdsInView.forEach((id) => handleSetLoadInactive(id));
                                      setSelectedOrganizerLoadIds((prev) =>
                                        prev.filter((id) => !selectedIdsInView.includes(id)),
                                      );
                                    }}
                                    className="rounded border border-red-300 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-red-700 hover:bg-red-50"
                                  >
                                    Inactive
                                  </button>
                                  <button
                                    type="button"
                                    onMouseDown={(event) => event.stopPropagation()}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      setSelectedOrganizerLoadIds((prev) =>
                                        prev.filter((id) => !selectedIdsInView.includes(id)),
                                      );
                                    }}
                                    className="rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 hover:bg-slate-100"
                                  >
                                    Clear
                                  </button>
                                  <button
                                    type="button"
                                    disabled={!singleSelectedId}
                                    onMouseDown={(event) => event.stopPropagation()}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      if (!singleSelectedId) return;
                                      void handleOpenLoadPdf(singleSelectedId);
                                    }}
                                    className="rounded border border-blue-300 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    PDF
                                  </button>
                                  <button
                                    type="button"
                                    disabled={!singleSelectedId}
                                    onMouseDown={(event) => event.stopPropagation()}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      if (!singleSelectedId) return;
                                      handleOpenLoadEditor(singleSelectedId);
                                    }}
                                    className="rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    Edit
                                  </button>
                                </>
                              ) : null}
                            </div>
                            <div className="flex items-center gap-1">
                              {status === 'ON BOARD' && selectedOrganizerStatus === 'ON BOARD' ? (
                                <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                                  Ctrl/Cmd + V ready
                                </span>
                              ) : null}
                              <button
                                type="button"
                                onMouseDown={(event) => event.stopPropagation()}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setOrganizerLoadFilter('ALL');
                                }}
                                className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${
                                  organizerLoadFilter === 'ALL'
                                    ? 'border-slate-400 bg-slate-900 text-white'
                                    : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-100'
                                }`}
                              >
                                All
                              </button>
                              <button
                                type="button"
                                onMouseDown={(event) => event.stopPropagation()}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setOrganizerLoadFilter('NEGOTIATING');
                                }}
                                className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${
                                  organizerLoadFilter === 'NEGOTIATING'
                                    ? 'border-emerald-400 bg-emerald-600 text-white'
                                    : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-100'
                                }`}
                              >
                                Neg
                              </button>
                              <button
                                type="button"
                                onMouseDown={(event) => event.stopPropagation()}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setOrganizerLoadFilter('ON_BOARD');
                                }}
                                className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${
                                  organizerLoadFilter === 'ON_BOARD'
                                    ? 'border-blue-400 bg-blue-600 text-white'
                                    : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-100'
                                }`}
                              >
                                On
                              </button>
                              <button
                                type="button"
                                onMouseDown={(event) => event.stopPropagation()}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  if (status !== 'ON BOARD' || statusLoads.length <= 1) return;
                                  const sortedIds = [...statusLoads]
                                    .sort((left, right) => {
                                      const leftRank = left.status === 'NEGOTIATING' ? 0 : 1;
                                      const rightRank = right.status === 'NEGOTIATING' ? 0 : 1;
                                      return leftRank - rightRank;
                                    })
                                    .map((load) => load.id);
                                  const rankById = new Map(sortedIds.map((id, index) => [id, index]));

                                  setLoads((prevLoads) => {
                                    const targetLoads = prevLoads.filter((load) => rankById.has(load.id));
                                    if (targetLoads.length <= 1) return prevLoads;
                                    const sortedTargetLoads = [...targetLoads].sort(
                                      (left, right) =>
                                        (rankById.get(left.id) ?? 0) - (rankById.get(right.id) ?? 0),
                                    );
                                    let replacementIndex = 0;
                                    return prevLoads.map((load) =>
                                      rankById.has(load.id)
                                        ? sortedTargetLoads[replacementIndex++]
                                        : load,
                                    );
                                  });
                                }}
                                className="rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 hover:bg-slate-100"
                                title="Sort negotiating first"
                              >
                                Sort
                              </button>
                              <span className="text-xs text-gray-600">{statusLoads.length}</span>
                            </div>
                          </div>

                          <div className="mt-2 min-h-0 flex-1 overflow-hidden">
                            {statusLoads.length === 0 ? (
                              <p className="rounded-lg border border-dashed border-gray-300 bg-white/70 px-2 py-3 text-center text-xs text-gray-500">
                                No routes in this view
                              </p>
                            ) : (
                              <div className="h-full overflow-auto rounded-lg border border-slate-200 bg-white">
                                <table className="w-full min-w-[1320px] table-fixed border-collapse">
                                  <thead className="sticky top-0 z-10 bg-slate-100">
                                    <tr className="text-[10px] uppercase tracking-wide text-slate-500">
                                      <th className="w-[18%] border-b border-slate-200 px-2 py-2 text-left font-semibold">
                                        Loading
                                      </th>
                                      <th className="w-[18%] border-b border-slate-200 px-2 py-2 text-left font-semibold">
                                        Unloading
                                      </th>
                                      <th className="w-[28%] border-b border-slate-200 px-2 py-2 text-left font-semibold">
                                        Vehicle Details
                                      </th>
                                      <th className="w-[10%] border-b border-slate-200 px-2 py-2 text-left font-semibold">
                                        Publication Price
                                      </th>
                                      <th className="w-[9%] border-b border-slate-200 px-2 py-2 text-left font-semibold">
                                        Tags
                                      </th>
                                      <th className="w-[12%] border-b border-slate-200 px-2 py-2 text-left font-semibold">
                                        Orderer
                                      </th>
                                      <th className="w-[5%] border-b border-slate-200 px-2 py-2 text-right font-semibold">
                                        Neg
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>{statusLoads.map((load) => renderOrganizerLoadRow(load))}</tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        </section>
                      );
                    })}
                  </div>

                </div>
              </aside>

              <div className="bg-slate-200" />

              <section className="min-w-0 w-[480px] max-w-full justify-self-start flex flex-col bg-slate-100">
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

                <div className="min-h-0 flex flex-1 flex-col">
                  <div className="min-h-0 flex-1 overflow-hidden">
                    {middleWorkspaceTab === 'load-planner' && (
                      <div className="h-full min-h-[560px] overflow-auto">
                        <CanvasVanCargo
                          vanId={selectedTrip}
                          x={0}
                          y={0}
                          onMove={() => {}}
                          allowPanelDrag={false}
                          scale={1}
                          selectedStopId={selectedCargoStopId}
                          onStopSelect={setSelectedCargoStopId}
                          routedStops={cargoRoutedStops}
                        />
                      </div>
                    )}

                    {middleWorkspaceTab === 'maps' && (
                      <div className="h-full min-h-[560px] overflow-hidden rounded-lg border border-slate-300 bg-white p-3">
                        {organizerMapPoints.length > 0 ? (
                          <div className="relative h-full overflow-hidden rounded-lg border border-slate-200 bg-[linear-gradient(130deg,#e2e8f0_0%,#f8fafc_45%,#dbeafe_100%)]">
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
                          <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white/70 text-sm font-medium text-slate-500">
                            No stops available for map preview.
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="border-t border-slate-300 bg-white">
                    <RouteComparison
                      currentRoute={routeComparison.currentRoute}
                      plannedRoute={routeComparison.plannedRoute}
                      previousRoute={previousRouteComparison}
                    />
                  </div>
                </div>
              </section>
            </div>
        </div>

        {quickPriceEditor && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4"
            onClick={() => setQuickPriceEditor(null)}
          >
            <div
              className="w-full max-w-sm rounded-lg border border-slate-300 bg-white p-4 shadow-xl"
              onClick={(event) => event.stopPropagation()}
            >
              <h3 className="text-sm font-semibold text-slate-900">Quick Price</h3>
              <p className="mt-0.5 text-xs text-slate-600">Set price and press Enter to save.</p>

              <input
                ref={quickPriceInputRef}
                type="number"
                min={0}
                step="0.01"
                value={quickPriceEditor.value}
                onChange={(event) =>
                  setQuickPriceEditor((prev) =>
                    prev ? { ...prev, value: event.target.value } : prev,
                  )
                }
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    handleSaveQuickPriceEditor();
                  }
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    setQuickPriceEditor(null);
                  }
                }}
                className="mt-3 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 focus:border-blue-400 focus:outline-none"
                placeholder="Enter price..."
              />

              <div className="mt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setQuickPriceEditor(null)}
                  className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveQuickPriceEditor}
                  className="rounded bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        {tagEditor && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4"
            onClick={closeTagEditor}
          >
            <div
              className="w-full max-w-lg rounded-lg border border-slate-300 bg-white p-4 shadow-xl"
              onClick={(event) => event.stopPropagation()}
            >
              <h3 className="text-sm font-semibold text-slate-900">Load Tags</h3>
              <p className="mt-0.5 text-xs text-slate-600">
                {tagEditorLoad
                  ? `Set tags for ${tagEditorLoad.referenceCode || truncateWithEllipsis(tagEditorLoad.brokerage, 24)}`
                  : 'Set tags for selected load'}
              </p>

              <div className="mt-3 flex gap-2">
                <input
                  type="text"
                  value={tagEditor.inputValue}
                  onChange={(event) =>
                    setTagEditor((current) =>
                      current ? { ...current, inputValue: event.target.value } : current,
                    )
                  }
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      addTagToEditor(tagEditor.inputValue);
                    }
                    if (event.key === 'Escape') {
                      event.preventDefault();
                      closeTagEditor();
                    }
                  }}
                  className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 focus:border-blue-400 focus:outline-none"
                  placeholder="Type a tag and press Enter..."
                />
                <button
                  type="button"
                  onClick={() => addTagToEditor(tagEditor.inputValue)}
                  className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Add
                </button>
              </div>

              <div className="mt-3 rounded border border-slate-200 bg-slate-50 p-2">
                {tagEditor.draftTags.length === 0 ? (
                  <p className="text-xs text-slate-400">No tags selected yet.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {tagEditor.draftTags.map((tag) => (
                      <button
                        key={`tag-selected-${tag}`}
                        type="button"
                        onClick={() => removeTagFromEditor(tag)}
                        className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
                        title="Remove tag"
                      >
                        <span>{tag}</span>
                        <span className="text-slate-400">×</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Existing tags in planner
                </p>
                <div className="mt-1.5 flex max-h-28 flex-wrap gap-1.5 overflow-auto rounded border border-slate-200 bg-white p-2">
                  {tagEditorSuggestions.length === 0 ? (
                    <span className="text-xs text-slate-400">No predefined tags yet.</span>
                  ) : (
                    tagEditorSuggestions.map((tag) => (
                      <button
                        key={`tag-option-${tag}`}
                        type="button"
                        onClick={() => addTagToEditor(tag)}
                        className="rounded border border-slate-300 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
                      >
                        {tag}
                      </button>
                    ))
                  )}
                </div>
              </div>

              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={closeTagEditor}
                  className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveTagEditor}
                  className="rounded bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  Save Tags
                </button>
              </div>
            </div>
          </div>
        )}

        {pendingTakenDeleteLoadId && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4 py-6"
            onClick={handleCancelDeleteTakenRoute}
          >
            <div
              className="w-full max-w-md rounded-xl border border-slate-300 bg-white shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="border-b border-slate-200 px-4 py-3">
                <h3 className="text-sm font-semibold text-slate-900">Delete Taken Route</h3>
                <p className="mt-0.5 text-xs text-slate-600">
                  This permanently deletes the load and related stops/documents/payments.
                </p>
              </div>

              <div className="space-y-2 px-4 py-3">
                <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="truncate text-xs font-semibold text-slate-800">
                    {truncateWithEllipsis(pendingTakenDeleteLoad?.brokerage, 40)}
                  </p>
                  <p className="truncate text-[11px] text-slate-600">
                    Ref: {pendingTakenDeleteLoad?.referenceCode || pendingTakenDeleteLoadId}
                  </p>
                </div>
                {takenDeleteError ? (
                  <p className="text-xs font-semibold text-rose-600">{takenDeleteError}</p>
                ) : null}
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-4 py-3">
                <button
                  type="button"
                  onClick={handleCancelDeleteTakenRoute}
                  disabled={isDeletingTakenRoute}
                  className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleConfirmDeleteTakenRoute()}
                  disabled={isDeletingTakenRoute}
                  className="rounded border border-red-300 bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isDeletingTakenRoute ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}

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
                    Restore or permanently delete inactive loads.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => void handleHardDeleteAllInactive()}
                    disabled={inactiveLoads.length === 0 || isDeletingInactive}
                    className="rounded border border-red-300 bg-white px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Delete All
                  </button>
                  <button
                    onClick={() => setIsInactiveModalOpen(false)}
                    className="rounded border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    Close
                  </button>
                </div>
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
                      load.originCountry,
                    );
                    const deliveryAddressLine = formatLoadAddressLine(
                      load.destCity,
                      load.destAddress,
                      load.destCountry,
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
                    const pickupCountryLabel = formatCountryWithFlag(load.originCountry);
                    const deliveryCountryLabel = formatCountryWithFlag(load.destCountry);

                    return (
                      <article
                        key={load.id}
                        className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">
                              {truncateWithEllipsis(load.brokerage, 30)}
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
                              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                Pickup • {pickupCountryLabel}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  handleCopyAddressWithFeedback(
                                    pickupLineCopyKey,
                                    load.originAddress || pickupAddressLine,
                                  )
                                }
                                className="min-w-0 flex-1 truncate text-left text-[11px] text-slate-600 hover:text-slate-800"
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
                              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                Delivery • {deliveryCountryLabel}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  handleCopyAddressWithFeedback(
                                    deliveryLineCopyKey,
                                    load.destAddress || deliveryAddressLine,
                                  )
                                }
                                className="min-w-0 flex-1 truncate text-left text-[11px] text-slate-600 hover:text-slate-800"
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
                            onClick={() => void handleHardDeleteInactiveLoad(load.id)}
                            disabled={isDeletingInactive}
                            className="px-2 py-1 text-[10px] font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Delete
                          </button>
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

        {isPasteConfirmOpen && pendingPastedScreenshotFile && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
            <div className="w-full max-w-lg rounded-lg border border-slate-200 bg-white shadow-xl">
              <div className="border-b border-slate-200 px-4 py-3">
                <h3 className="text-sm font-semibold text-slate-900">Upload Screenshot To ON BOARD</h3>
                <p className="mt-0.5 text-xs text-slate-600">
                  We will parse this screenshot, run duplicate checks, and show extracted routes for
                  final confirmation.
                </p>
              </div>
              <div className="px-4 py-3 text-xs text-slate-700">
                <p>
                  File: <span className="font-medium text-slate-900">{pendingPastedScreenshotFile.name}</span>
                </p>
                <p className="mt-1">
                  Size: {Math.max(1, Math.round(pendingPastedScreenshotFile.size / 1024))} KB
                </p>
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-4 py-3">
                <button
                  type="button"
                  onClick={handleCancelPasteUpload}
                  className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmPasteUpload}
                  className="inline-flex items-center rounded bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  Analyze Screenshot
                </button>
              </div>
            </div>
          </div>
        )}

        {isPastePreviewOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
            <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl">
              <div className="border-b border-slate-200 px-4 py-3">
                <h3 className="text-sm font-semibold text-slate-900">Confirm Screenshot Routes</h3>
                <p className="mt-0.5 text-xs text-slate-600">
                  Select rows to add into ON BOARD for the selected trip.
                </p>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
                {isPastePreviewLoading ? (
                  <div className="flex items-center justify-center py-12 text-sm text-slate-600">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing screenshot...
                  </div>
                ) : null}

                {!isPastePreviewLoading && pastePreviewError && (
                  <div className="mb-3 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                    {pastePreviewError}
                  </div>
                )}

                {!isPastePreviewLoading && pastePreviewResult && (
                  <>
                    <div className="mb-3 grid gap-2 text-[11px] text-slate-700 md:grid-cols-4">
                      <span className="rounded border border-slate-200 bg-slate-50 px-2 py-1">
                        Extracted: {pastePreviewResult.extractedCount}
                      </span>
                      <span className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-700">
                        Creatable: {pastePreviewResult.creatableCount}
                      </span>
                      <span className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-amber-700">
                        Duplicates: {pastePreviewResult.duplicateCount}
                      </span>
                      <span className="rounded border border-slate-200 bg-slate-50 px-2 py-1">
                        Selected: {pastePreviewSelectedRows.length}
                      </span>
                    </div>

                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setPastePreviewSelectedRows(
                            pastePreviewResult.candidates.map((candidate) => candidate.row),
                          )
                        }
                        className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        Select all
                      </button>
                      <button
                        type="button"
                        onClick={() => setPastePreviewSelectedRows([])}
                        className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        Clear
                      </button>
                    </div>

                    <div className="space-y-2">
                      {pastePreviewResult.candidates.map((candidate) => {
                        const isSelected = pastePreviewSelectedRows.includes(candidate.row);
                        const freightTextRows = buildFreightTextRows({
                          capacityTons: candidate.weightTons,
                          bodyTypeText: candidate.bodyTypeText,
                          loadingMeters: candidate.loadingMeters,
                          distanceKm: candidate.distanceKm,
                          bodySize: candidate.bodySize,
                          freightMode: candidate.freightMode,
                          additionalDescription: candidate.additionalDescription,
                        });

                        return (
                          <label
                            key={`paste-preview-row-${candidate.row}`}
                            className={`block cursor-pointer rounded border px-3 py-2 ${
                              isSelected
                                ? 'border-blue-300 bg-blue-50'
                                : 'border-slate-200 bg-white hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => handleTogglePastePreviewRow(candidate.row)}
                                  />
                                  <p className="truncate text-xs font-semibold text-slate-900">
                                    Row {candidate.row} • {candidate.brokerName || 'Broker n/a'}
                                  </p>
                                </div>
                                <p className="mt-1 truncate text-xs text-slate-700">
                                  {candidate.pickupCountry}, {candidate.pickupPostcode},{' '}
                                  {candidate.pickupCity} → {candidate.deliveryCountry},{' '}
                                  {candidate.deliveryPostcode}, {candidate.deliveryCity}
                                </p>
                                <p className="mt-1 text-[11px] text-slate-600">
                                  Pickup: {formatPastePreviewDateTime(candidate.pickupDateTimeIso)} •
                                  Delivery: {formatPastePreviewDateTime(candidate.deliveryDateTimeIso)}
                                </p>
                                {(freightTextRows.line1 ||
                                  freightTextRows.line2 ||
                                  freightTextRows.line3) && (
                                  <div className="mt-1 rounded border border-slate-200 bg-slate-50 px-2 py-1.5">
                                    {freightTextRows.line1 && (
                                      <p className="text-[11px] font-semibold leading-4 text-slate-700">
                                        {freightTextRows.line1}
                                      </p>
                                    )}
                                    {freightTextRows.line2 && (
                                      <p className="mt-0.5 text-[11px] leading-4 text-slate-700">
                                        {freightTextRows.line2}
                                      </p>
                                    )}
                                    {freightTextRows.line3 && (
                                      <p className="mt-0.5 text-[11px] leading-4 text-slate-600">
                                        {freightTextRows.line3}
                                      </p>
                                    )}
                                  </div>
                                )}
                              </div>
                              <div className="text-right text-xs text-slate-700">
                                <p className="font-semibold text-slate-900">
                                  {formatPastePreviewMoney(candidate.priceAmount, candidate.currency)}
                                </p>
                                <p className="mt-0.5">{candidate.paymentTermDays ?? '—'} days</p>
                              </div>
                            </div>
                          </label>
                        );
                      })}
                    </div>

                    {pastePreviewResult.duplicates.length > 0 && (
                      <div className="mt-3 rounded border border-amber-200 bg-amber-50 px-3 py-2">
                        <p className="text-xs font-semibold text-amber-800">
                          Duplicate rows skipped in preview
                        </p>
                        <div className="mt-1 space-y-1">
                          {pastePreviewResult.duplicates.map((duplicate, index) => (
                            <p
                              key={`paste-preview-duplicate-${duplicate.row}-${index}`}
                              className="text-[11px] text-amber-700"
                            >
                              Row {duplicate.row} • {duplicate.pickupCity} → {duplicate.deliveryCity}{' '}
                              • existing ref {duplicate.existingReferenceNumber || '—'}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-4 py-3">
                <button
                  type="button"
                  onClick={resetPastePreviewState}
                  className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  disabled={isPastePreviewSubmitting}
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => void handleCommitPastePreview()}
                  className="inline-flex items-center rounded bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={
                    isPastePreviewSubmitting ||
                    isPastePreviewLoading ||
                    !pastePreviewResult ||
                    pastePreviewSelectedRows.length === 0
                  }
                >
                  {isPastePreviewSubmitting ? (
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  ) : null}
                  Add Selected Routes
                </button>
              </div>
            </div>
          </div>
        )}

        {pasteDuplicatePopup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
            <div className="w-full max-w-2xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl">
              <div className="border-b border-slate-200 px-4 py-3">
                <h3 className="text-sm font-semibold text-slate-900">Duplicates Detected</h3>
                <p className="mt-0.5 text-xs text-slate-600">
                  {pasteDuplicatePopup.count} duplicate load(s) were skipped.
                </p>
              </div>
              <div className="max-h-[52vh] overflow-y-auto px-4 py-3">
                <div className="space-y-2">
                  {pasteDuplicatePopup.duplicates.map((duplicate, index) => (
                    <div
                      key={`paste-duplicate-${duplicate.row}-${index}`}
                      className="rounded border border-amber-200 bg-amber-50 px-3 py-2"
                    >
                      <p className="text-xs font-semibold text-amber-800">
                        Row {duplicate.row} • {duplicate.pickupCity} → {duplicate.deliveryCity}
                      </p>
                      <p className="mt-0.5 text-[11px] text-amber-700">
                        Existing Ref: {duplicate.existingReferenceNumber || '—'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-end border-t border-slate-200 px-4 py-3">
                <button
                  type="button"
                  onClick={() => setPasteDuplicatePopup(null)}
                  className="rounded bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

        <UploadModal
          isOpen={showUploadModal}
          onClose={handleCloseUploadModal}
          onCreated={handleFreightCreated}
          onCreatedMany={handleFreightCreatedMany}
          defaultTripId={selectedTrip}
          initialTab={uploadModalInitialTab}
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
