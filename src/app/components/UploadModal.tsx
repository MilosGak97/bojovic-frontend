import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Loader2, Plus, Trash2, Upload, X } from 'lucide-react';
import { brokerApi, brokerContactApi, loadApi, tripApi } from '../../api';
import type { CreateBrokerCompanyDto, CreateBrokerContactDto, CreateLoadDto } from '../../domain/dto';
import {
  Currency,
  LoadBoardSource,
  LoadStatus,
  StopType,
} from '../../domain/enums';
import type { Load, Trip } from '../../domain/entities';
import { DateTimePicker } from './DateTimePicker';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (load: Load) => void;
  defaultTripId?: string;
}

interface PalletDraft {
  id: string;
  label: string;
  widthCm: string;
  heightCm: string;
  depthCm: string;
  weightTons: string;
  quantity: string;
}

interface ExtraStopDraft {
  id: string;
  stopType: StopType;
  address: string;
  city: string;
  postcode: string;
  country: string;
  dateFrom: string;
  dateTo: string;
  pallets: string;
  transeuLink: string;
  notes: string;
}

type UploadModalTab = 'manual' | 'pdf';

const createRowId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const formatDateTimeLocal = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const defaultPickupDate = formatDateTimeLocal(new Date());
const defaultDeliveryDate = formatDateTimeLocal(new Date(Date.now() + 24 * 60 * 60 * 1000));

const defaultPalletRow = (): PalletDraft => ({
  id: createRowId(),
  label: '',
  widthCm: '120',
  heightCm: '80',
  depthCm: '120',
  weightTons: '',
  quantity: '1',
});

const defaultExtraStopRow = (): ExtraStopDraft => ({
  id: createRowId(),
  stopType: StopType.DELIVERY,
  address: '',
  city: '',
  postcode: '',
  country: 'DE',
  dateFrom: '',
  dateTo: '',
  pallets: '',
  transeuLink: '',
  notes: '',
});

const toOptionalNumber = (value: string): number | undefined => {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const toIsoDateTime = (value: string): string | null => {
  if (!value.trim()) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
};

const toOptionalInteger = (value: string): number | undefined => {
  const parsed = toOptionalNumber(value);
  if (parsed === undefined) return undefined;
  return Math.max(0, Math.floor(parsed));
};

const isValidEmail = (value: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

const splitContactName = (fullName: string): { firstName: string; lastName: string } => {
  const trimmed = fullName.trim();
  if (!trimmed) return { firstName: '', lastName: '' };
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return { firstName: parts[0], lastName: '-' };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
};

export function UploadModal({
  isOpen,
  onClose,
  onCreated,
  defaultTripId,
}: UploadModalProps) {
  const [activeTab, setActiveTab] = useState<UploadModalTab>('manual');
  const [isBrokerTranseuExpanded, setIsBrokerTranseuExpanded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [activeTrips, setActiveTrips] = useState<Trip[]>([]);
  const [isLoadingTrips, setIsLoadingTrips] = useState(false);
  const [tripsError, setTripsError] = useState<string | null>(null);

  const [form, setForm] = useState({
    referenceNumber: '',
    transEuFreightNumber: '',
    status: LoadStatus.ON_BOARD,
    tripId: defaultTripId ?? '',
    boardSource: LoadBoardSource.MANUAL,
    color: '#3B82F6',
    brokerageName: '',
    isInactive: false,
    originTranseuLink: '',
    destTranseuLink: '',

    pickupAddress: '',
    pickupCity: '',
    pickupPostcode: '',
    pickupCountry: 'DE',
    pickupDateFrom: defaultPickupDate,
    pickupDateTo: '',
    pickupStopPallets: '',

    deliveryAddress: '',
    deliveryCity: '',
    deliveryPostcode: '',
    deliveryCountry: 'DE',
    deliveryDateFrom: defaultDeliveryDate,
    deliveryDateTo: '',
    deliveryStopPallets: '',

    publishedPrice: '',
    agreedPrice: '',
    currency: Currency.EUR,
    paymentTermDays: '',
    distanceKm: '',
    contactPerson: '',
    contactPhone: '',
    contactEmail: '',
    brokerTransEuId: '',
    brokerCompanyAddress: '',
    brokerEmployeeCount: '',
    brokerPaidOnTime: '',
    brokerPaidWithDelay: '',
    brokerPaymentIssues: '',
    brokerRating: '',
    brokerReviewCount: '',
    pricingInvoitix: false,
    pricingValutaCheck: false,
    pricingNotes: '',

    freightWeightTons: '',
    freightNotes: '',
  });

  const [pallets, setPallets] = useState<PalletDraft[]>([defaultPalletRow()]);
  const [extraStops, setExtraStops] = useState<ExtraStopDraft[]>([]);

  const totalPalletQuantity = useMemo(
    () =>
      pallets.reduce((sum, row) => {
        const quantity = Number(row.quantity);
        return sum + (Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : 0);
      }, 0),
    [pallets],
  );

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    const loadActiveTrips = async () => {
      setIsLoadingTrips(true);
      setTripsError(null);
      try {
        const response = await tripApi.getActive();
        if (!cancelled) {
          setActiveTrips(response);
          setForm((prev) => {
            const hasCurrent = prev.tripId && response.some((trip) => trip.id === prev.tripId);
            if (hasCurrent) return prev;
            if (defaultTripId && response.some((trip) => trip.id === defaultTripId)) {
              return { ...prev, tripId: defaultTripId };
            }
            return { ...prev, tripId: '' };
          });
        }
      } catch (requestError) {
        if (!cancelled) {
          setActiveTrips([]);
          setTripsError(
            requestError instanceof Error ? requestError.message : 'Failed to load trips.',
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoadingTrips(false);
        }
      }
    };

    void loadActiveTrips();

    return () => {
      cancelled = true;
    };
  }, [isOpen, defaultTripId]);

  if (!isOpen) return null;

  const updateForm = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const updatePallet = (id: string, patch: Partial<PalletDraft>) => {
    setPallets((prev) =>
      prev.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  };

  const updateExtraStop = (id: string, patch: Partial<ExtraStopDraft>) => {
    setExtraStops((prev) =>
      prev.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  };

  const resetFormState = () => {
    setForm({
      referenceNumber: '',
      transEuFreightNumber: '',
      status: LoadStatus.ON_BOARD,
      tripId: defaultTripId ?? '',
      boardSource: LoadBoardSource.MANUAL,
      color: '#3B82F6',
      brokerageName: '',
      isInactive: false,
      originTranseuLink: '',
      destTranseuLink: '',
      pickupAddress: '',
      pickupCity: '',
      pickupPostcode: '',
      pickupCountry: 'DE',
      pickupDateFrom: formatDateTimeLocal(new Date()),
      pickupDateTo: '',
      pickupStopPallets: '',
      deliveryAddress: '',
      deliveryCity: '',
      deliveryPostcode: '',
      deliveryCountry: 'DE',
      deliveryDateFrom: formatDateTimeLocal(new Date(Date.now() + 24 * 60 * 60 * 1000)),
      deliveryDateTo: '',
      deliveryStopPallets: '',
      publishedPrice: '',
      agreedPrice: '',
      currency: Currency.EUR,
      paymentTermDays: '',
      distanceKm: '',
      contactPerson: '',
      contactPhone: '',
      contactEmail: '',
      brokerTransEuId: '',
      brokerCompanyAddress: '',
      brokerEmployeeCount: '',
      brokerPaidOnTime: '',
      brokerPaidWithDelay: '',
      brokerPaymentIssues: '',
      brokerRating: '',
      brokerReviewCount: '',
      pricingInvoitix: false,
      pricingValutaCheck: false,
      pricingNotes: '',
      freightWeightTons: '',
      freightNotes: '',
    });
    setPallets([defaultPalletRow()]);
    setExtraStops([]);
    setPdfFile(null);
  };

  const handleCreateFreight = async () => {
    setFormError(null);
    setSuccessMessage(null);

    const requiredErrors: string[] = [];
    if (!form.referenceNumber.trim()) requiredErrors.push('Reference Number is required.');
    if (!form.pickupCity.trim()) requiredErrors.push('Pickup City is required.');
    if (!form.pickupPostcode.trim()) requiredErrors.push('Pickup Postcode is required.');
    if (!form.pickupCountry.trim()) requiredErrors.push('Pickup Country is required.');
    if (!form.deliveryCity.trim()) requiredErrors.push('Delivery City is required.');
    if (!form.deliveryPostcode.trim()) requiredErrors.push('Delivery Postcode is required.');
    if (!form.deliveryCountry.trim()) requiredErrors.push('Delivery Country is required.');

    const pickupDateFromIso = toIsoDateTime(form.pickupDateFrom);
    const deliveryDateFromIso = toIsoDateTime(form.deliveryDateFrom);
    const pickupDateToIso = toIsoDateTime(form.pickupDateTo);
    const deliveryDateToIso = toIsoDateTime(form.deliveryDateTo);

    if (!pickupDateFromIso) requiredErrors.push('Pickup Date From must be valid.');
    if (!deliveryDateFromIso) requiredErrors.push('Delivery Date From must be valid.');
    if (form.pickupDateTo.trim() && !pickupDateToIso) requiredErrors.push('Pickup Date To must be valid.');
    if (form.deliveryDateTo.trim() && !deliveryDateToIso) requiredErrors.push('Delivery Date To must be valid.');

    const parsedPalletRows: CreateLoadDto['pallets'] = [];
    for (const pallet of pallets) {
      const widthCm = Number(pallet.widthCm);
      const heightCm = Number(pallet.heightCm);
      const quantity = Number(pallet.quantity);
      if (!Number.isFinite(widthCm) || widthCm <= 0) {
        requiredErrors.push('Each pallet Width must be a positive number.');
        break;
      }
      if (!Number.isFinite(heightCm) || heightCm <= 0) {
        requiredErrors.push('Each pallet Height must be a positive number.');
        break;
      }
      if (!Number.isFinite(quantity) || quantity <= 0) {
        requiredErrors.push('Each pallet Quantity must be a positive number.');
        break;
      }

      parsedPalletRows.push({
        ...(pallet.label.trim() ? { label: pallet.label.trim() } : {}),
        widthCm,
        heightCm,
        ...(toOptionalNumber(pallet.depthCm) !== undefined ? { depthCm: Number(pallet.depthCm) } : {}),
        ...(toOptionalNumber(pallet.weightTons) !== undefined
          ? { weightKg: Number(((toOptionalNumber(pallet.weightTons) ?? 0) * 1000).toFixed(2)) }
          : {}),
        quantity: Math.floor(quantity),
      });
    }

    const parsedExtraStops: CreateLoadDto['stops'] = [];
    for (const extraStop of extraStops) {
      const isCompletelyEmpty =
        !extraStop.address.trim() &&
        !extraStop.city.trim() &&
        !extraStop.postcode.trim() &&
        !extraStop.country.trim() &&
        !extraStop.dateFrom.trim() &&
        !extraStop.dateTo.trim() &&
        !extraStop.pallets.trim() &&
        !extraStop.transeuLink.trim() &&
        !extraStop.notes.trim();
      if (isCompletelyEmpty) continue;

      if (
        !extraStop.address.trim() ||
        !extraStop.city.trim() ||
        !extraStop.postcode.trim() ||
        !extraStop.country.trim() ||
        !extraStop.dateFrom.trim()
      ) {
        requiredErrors.push('Each extra stop needs Address, City, Postcode, Country, and Date From.');
        break;
      }

      const dateFromIso = toIsoDateTime(extraStop.dateFrom);
      const dateToIso = toIsoDateTime(extraStop.dateTo);
      if (!dateFromIso) {
        requiredErrors.push('Each extra stop Date From must be valid.');
        break;
      }
      if (extraStop.dateTo.trim() && !dateToIso) {
        requiredErrors.push('Each extra stop Date To must be valid.');
        break;
      }

      const palletsCount = toOptionalNumber(extraStop.pallets);
      parsedExtraStops.push({
        stopType: extraStop.stopType,
        address: extraStop.address.trim(),
        city: extraStop.city.trim(),
        postcode: extraStop.postcode.trim(),
        country: extraStop.country.trim(),
        dateFrom: dateFromIso,
        ...(dateToIso ? { dateTo: dateToIso } : {}),
        ...(palletsCount !== undefined ? { pallets: palletsCount } : {}),
        ...(extraStop.transeuLink.trim() ? { transeuLink: extraStop.transeuLink.trim() } : {}),
        ...(extraStop.notes.trim() ? { notes: extraStop.notes.trim() } : {}),
      });
    }

    if (requiredErrors.length > 0) {
      setFormError(requiredErrors[0]);
      return;
    }

    const pickupPallets =
      toOptionalNumber(form.pickupStopPallets) ??
      (totalPalletQuantity > 0 ? totalPalletQuantity : undefined);
    const deliveryPallets =
      toOptionalNumber(form.deliveryStopPallets) ??
      (totalPalletQuantity > 0 ? totalPalletQuantity : undefined);
    const pickupAddressValue = form.pickupAddress.trim() || form.pickupCity.trim();
    const deliveryAddressValue = form.deliveryAddress.trim() || form.deliveryCity.trim();
    const pricingNotesValue = form.pricingNotes.trim();

    const payload: CreateLoadDto = {
      referenceNumber: form.referenceNumber.trim(),
      ...(form.transEuFreightNumber.trim()
        ? { transEuFreightNumber: form.transEuFreightNumber.trim() }
        : {}),
      ...(form.tripId ? { tripId: form.tripId } : {}),
      status: form.status,
      boardSource: form.boardSource,
      ...(form.color.trim() ? { color: form.color.trim() } : {}),
      ...(form.originTranseuLink.trim() ? { originTranseuLink: form.originTranseuLink.trim() } : {}),
      ...(form.destTranseuLink.trim() ? { destTranseuLink: form.destTranseuLink.trim() } : {}),
      isInactive: form.isInactive,

      pickupAddress: pickupAddressValue,
      pickupCity: form.pickupCity.trim(),
      pickupPostcode: form.pickupPostcode.trim(),
      pickupCountry: form.pickupCountry.trim(),
      pickupDateFrom: pickupDateFromIso as string,
      ...(pickupDateToIso ? { pickupDateTo: pickupDateToIso } : {}),

      deliveryAddress: deliveryAddressValue,
      deliveryCity: form.deliveryCity.trim(),
      deliveryPostcode: form.deliveryPostcode.trim(),
      deliveryCountry: form.deliveryCountry.trim(),
      deliveryDateFrom: deliveryDateFromIso as string,
      ...(deliveryDateToIso ? { deliveryDateTo: deliveryDateToIso } : {}),

      ...(toOptionalNumber(form.publishedPrice) !== undefined
        ? { publishedPrice: Number(form.publishedPrice) }
        : {}),
      ...(toOptionalNumber(form.agreedPrice) !== undefined
        ? { agreedPrice: Number(form.agreedPrice) }
        : {}),
      currency: form.currency,
      ...(toOptionalNumber(form.paymentTermDays) !== undefined
        ? { paymentTermDays: Math.floor(Number(form.paymentTermDays)) }
        : {}),
      invoitix: form.pricingInvoitix,
      valutaCheck: form.pricingValutaCheck,
      ...(toOptionalNumber(form.distanceKm) !== undefined ? { distanceKm: Number(form.distanceKm) } : {}),
      ...(pricingNotesValue ? { notes: pricingNotesValue } : {}),
      ...(parsedPalletRows.length > 0 ? { pallets: parsedPalletRows } : {}),
    };

    const freightDetails: CreateLoadDto['freightDetails'] = {
      ...(toOptionalNumber(form.freightWeightTons) !== undefined
        ? { weightTons: Number(form.freightWeightTons) }
        : {}),
      ...(form.freightNotes.trim()
        ? { goodsDescription: form.freightNotes.trim() }
        : {}),
    };

    if (Object.keys(freightDetails).length > 0) {
      payload.freightDetails = freightDetails;
    }

    const pickupStop: CreateLoadDto['stops'][number] = {
      stopType: StopType.PICKUP,
      address: pickupAddressValue,
      city: form.pickupCity.trim(),
      postcode: form.pickupPostcode.trim(),
      country: form.pickupCountry.trim(),
      dateFrom: pickupDateFromIso as string,
      ...(pickupDateToIso ? { dateTo: pickupDateToIso } : {}),
      ...(pickupPallets !== undefined ? { pallets: pickupPallets } : {}),
      ...(form.originTranseuLink.trim() ? { transeuLink: form.originTranseuLink.trim() } : {}),
      orderIndex: 0,
    };

    const deliveryStop: CreateLoadDto['stops'][number] = {
      stopType: StopType.DELIVERY,
      address: deliveryAddressValue,
      city: form.deliveryCity.trim(),
      postcode: form.deliveryPostcode.trim(),
      country: form.deliveryCountry.trim(),
      dateFrom: deliveryDateFromIso as string,
      ...(deliveryDateToIso ? { dateTo: deliveryDateToIso } : {}),
      ...(deliveryPallets !== undefined ? { pallets: deliveryPallets } : {}),
      ...(form.destTranseuLink.trim() ? { transeuLink: form.destTranseuLink.trim() } : {}),
      orderIndex: parsedExtraStops.length + 1,
    };

    payload.stops = [
      pickupStop,
      ...parsedExtraStops.map((stop, index) => ({
        ...stop,
        orderIndex: index + 1,
      })),
      deliveryStop,
    ];

    setIsSubmitting(true);
    try {
      const brokerName = form.brokerageName.trim();
      const brokerTransEuId = form.brokerTransEuId.trim();
      const contactPerson = form.contactPerson.trim();
      const contactPhone = form.contactPhone.trim();
      const contactEmail = form.contactEmail.trim();
      let brokerIdToUse: string | undefined;
      let brokerContactIdToUse: string | undefined;

      const hasBrokerMetrics =
        form.brokerPaidOnTime.trim() ||
        form.brokerPaidWithDelay.trim() ||
        form.brokerPaymentIssues.trim() ||
        form.brokerRating.trim() ||
        form.brokerReviewCount.trim();
      const hasContactDetails = contactPerson || contactPhone || contactEmail;
      const hasBrokerDetails =
        brokerName ||
        brokerTransEuId ||
        form.brokerCompanyAddress.trim() ||
        form.brokerEmployeeCount.trim() ||
        hasBrokerMetrics;

      if (hasBrokerDetails && !brokerName) {
        setFormError('Brokerage Name is required when entering broker details.');
        setIsSubmitting(false);
        return;
      }
      if (hasContactDetails && !brokerName) {
        setFormError('Brokerage Name is required when entering broker contact details.');
        setIsSubmitting(false);
        return;
      }
      if ((contactPhone || contactEmail) && !contactPerson) {
        setFormError('Contact Person is required when entering contact phone or email.');
        setIsSubmitting(false);
        return;
      }
      if (contactEmail && !isValidEmail(contactEmail)) {
        setFormError('Contact Email must be a valid email address.');
        setIsSubmitting(false);
        return;
      }

      if (brokerName) {
        const searchResult = brokerTransEuId
          ? await brokerApi.getAll()
          : await brokerApi.getAll(brokerName);
        const normalizedBrokerName = brokerName.toLowerCase();
        const normalizedTransEuId = brokerTransEuId.toLowerCase();
        const existingBroker = searchResult.find((broker) => {
          if (
            brokerTransEuId &&
            (broker.transEuId ?? '').trim().toLowerCase() === normalizedTransEuId
          ) {
            return true;
          }
          return broker.companyName.trim().toLowerCase() === normalizedBrokerName;
        });

        const brokerEmployeeCount = toOptionalInteger(form.brokerEmployeeCount);
        const brokerCompanyAddress = form.brokerCompanyAddress.trim();
        const transEuPaidOnTime = toOptionalInteger(form.brokerPaidOnTime);
        const transEuPaidWithDelay = toOptionalInteger(form.brokerPaidWithDelay);
        const transEuPaymentIssues = toOptionalInteger(form.brokerPaymentIssues);
        const transEuReviewCount = toOptionalInteger(form.brokerReviewCount);
        const transEuRating = form.brokerRating.trim();

        if (existingBroker) {
          brokerIdToUse = existingBroker.id;

          const brokerPatch: Partial<CreateBrokerCompanyDto> = {};
          if (brokerCompanyAddress && brokerCompanyAddress !== existingBroker.street) {
            brokerPatch.street = brokerCompanyAddress;
          }
          if (
            brokerEmployeeCount !== undefined &&
            brokerEmployeeCount !== existingBroker.employeeCount
          ) {
            brokerPatch.employeeCount = brokerEmployeeCount;
          }
          if (brokerTransEuId && brokerTransEuId !== (existingBroker.transEuId ?? '')) {
            brokerPatch.transEuId = brokerTransEuId;
          }
          if (
            transEuPaidOnTime !== undefined &&
            transEuPaidOnTime !== existingBroker.transEuPaidOnTime
          ) {
            brokerPatch.transEuPaidOnTime = transEuPaidOnTime;
          }
          if (
            transEuPaidWithDelay !== undefined &&
            transEuPaidWithDelay !== existingBroker.transEuPaidWithDelay
          ) {
            brokerPatch.transEuPaidWithDelay = transEuPaidWithDelay;
          }
          if (
            transEuPaymentIssues !== undefined &&
            transEuPaymentIssues !== existingBroker.transEuPaymentIssues
          ) {
            brokerPatch.transEuPaymentIssues = transEuPaymentIssues;
          }
          if (transEuRating && transEuRating !== (existingBroker.transEuRating ?? '')) {
            brokerPatch.transEuRating = transEuRating;
          }
          if (
            transEuReviewCount !== undefined &&
            transEuReviewCount !== existingBroker.transEuReviewCount
          ) {
            brokerPatch.transEuReviewCount = transEuReviewCount;
          }
          if (Object.keys(brokerPatch).length > 0) {
            await brokerApi.update(existingBroker.id, brokerPatch);
          }
        } else {
          const brokerCreatePayload: CreateBrokerCompanyDto = {
            companyName: brokerName,
            street: brokerCompanyAddress || pickupAddressValue,
            city: form.pickupCity.trim(),
            postcode: form.pickupPostcode.trim(),
            country: form.pickupCountry.trim(),
            ...(brokerEmployeeCount !== undefined ? { employeeCount: brokerEmployeeCount } : {}),
            ...(brokerTransEuId ? { transEuId: brokerTransEuId } : {}),
            ...(transEuPaidOnTime !== undefined ? { transEuPaidOnTime } : {}),
            ...(transEuPaidWithDelay !== undefined ? { transEuPaidWithDelay } : {}),
            ...(transEuPaymentIssues !== undefined ? { transEuPaymentIssues } : {}),
            ...(transEuRating ? { transEuRating } : {}),
            ...(transEuReviewCount !== undefined ? { transEuReviewCount } : {}),
            ...(form.contactPhone.trim() ? { phone: form.contactPhone.trim() } : {}),
            ...(isValidEmail(form.contactEmail) ? { email: form.contactEmail.trim() } : {}),
            isActive: true,
          };

          const createdBroker = await brokerApi.create(brokerCreatePayload);
          brokerIdToUse = createdBroker.id;
        }

        if (brokerIdToUse && hasContactDetails && contactPerson) {
          const normalizedEmail = contactEmail.toLowerCase();
          const normalizedPhone = contactPhone.replace(/\s+/g, '');
          const { firstName, lastName } = splitContactName(contactPerson);
          const companyContacts = await brokerContactApi.getByCompany(brokerIdToUse);

          const existingContact = companyContacts.find((contact) => {
            const contactEmailValue = (contact.email ?? '').trim().toLowerCase();
            if (normalizedEmail && contactEmailValue === normalizedEmail) {
              return true;
            }

            const contactPhoneValue = (contact.phone ?? contact.mobile ?? '').replace(/\s+/g, '');
            if (
              normalizedPhone &&
              contactPhoneValue === normalizedPhone &&
              contact.firstName.trim().toLowerCase() === firstName.toLowerCase() &&
              contact.lastName.trim().toLowerCase() === lastName.toLowerCase()
            ) {
              return true;
            }

            return (
              contact.firstName.trim().toLowerCase() === firstName.toLowerCase() &&
              contact.lastName.trim().toLowerCase() === lastName.toLowerCase()
            );
          });

          if (existingContact) {
            brokerContactIdToUse = existingContact.id;
          } else {
            const contactCreatePayload: CreateBrokerContactDto = {
              companyId: brokerIdToUse,
              firstName,
              lastName,
              ...(contactPhone ? { phone: contactPhone } : {}),
              ...(contactEmail ? { email: contactEmail } : {}),
              isPrimary: companyContacts.length === 0,
            };
            const createdContact = await brokerContactApi.create(contactCreatePayload);
            brokerContactIdToUse = createdContact.id;
          }
        }
      }

      if (brokerIdToUse) {
        payload.brokerId = brokerIdToUse;
      }
      if (brokerContactIdToUse) {
        payload.brokerContactId = brokerContactIdToUse;
      }

      const createdLoad = await loadApi.create(payload);
      onCreated?.(createdLoad);
      setSuccessMessage(`Freight ${createdLoad.referenceNumber} created successfully.`);
      resetFormState();
      onClose();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to create freight.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative flex h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Freight Intake</h2>
            <p className="text-xs text-gray-500">Create manually now, PDF parser next.</p>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex items-center gap-2 border-b border-gray-200 px-6 py-3">
          <button
            type="button"
            onClick={() => setActiveTab('manual')}
            className={`rounded px-3 py-1.5 text-sm font-medium ${
              activeTab === 'manual'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Create Freight
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('pdf')}
            className={`rounded px-3 py-1.5 text-sm font-medium ${
              activeTab === 'pdf'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Upload PDF
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {activeTab === 'pdf' && (
            <div className="rounded-lg border border-dashed border-gray-300 p-10 text-center">
              <Upload className="mx-auto mb-4 h-10 w-10 text-gray-400" />
              <p className="text-sm text-gray-700">PDF upload parser integration is next.</p>
              <p className="mt-1 text-xs text-gray-500">
                You can already create freight manually in the other tab.
              </p>
              <label
                htmlFor="freight-pdf-upload"
                className="mt-4 inline-flex cursor-pointer rounded bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-700"
              >
                Select PDF
              </label>
              <input
                id="freight-pdf-upload"
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={(event) => setPdfFile(event.target.files?.[0] ?? null)}
              />
              {pdfFile && (
                <p className="mt-3 text-xs text-gray-600">
                  Selected: {pdfFile.name} ({Math.max(1, Math.round(pdfFile.size / 1024))} KB)
                </p>
              )}
            </div>
          )}

          {activeTab === 'manual' && (
            <div className="space-y-6">
              {formError && (
                <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {formError}
                </div>
              )}
              {successMessage && (
                <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  {successMessage}
                </div>
              )}

              <section className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Load Info
                </h3>
                <div className="grid gap-3 md:grid-cols-4">
                  <label className="text-xs text-gray-600">
                    Reference Number *
                    <input
                      type="text"
                      value={form.referenceNumber}
                      onChange={(event) => updateForm('referenceNumber', event.target.value)}
                      className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
                    />
                  </label>
                  <label className="text-xs text-gray-600">
                    Trans.eu Freight Number
                    <input
                      type="text"
                      value={form.transEuFreightNumber}
                      onChange={(event) => updateForm('transEuFreightNumber', event.target.value)}
                      className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
                      placeholder="optional"
                    />
                  </label>
                  <label className="text-xs text-gray-600">
                    Add To Load Planner (Trip)
                    <select
                      value={form.tripId}
                      onChange={(event) => updateForm('tripId', event.target.value)}
                      disabled={isLoadingTrips}
                      className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 disabled:bg-gray-100"
                    >
                      <option value="">Not assigned</option>
                      {activeTrips.map((trip) => {
                        const driverName = trip.driver
                          ? `${trip.driver.firstName} ${trip.driver.lastName}`.trim()
                          : 'No driver';
                        const vanInfo = trip.van
                          ? `${trip.van.name} (${trip.van.licensePlate})`
                          : 'No vehicle';
                        return (
                          <option key={trip.id} value={trip.id}>
                            {driverName} — {vanInfo}
                          </option>
                        );
                      })}
                    </select>
                    {tripsError && (
                      <span className="mt-1 block text-[11px] text-rose-600">{tripsError}</span>
                    )}
                  </label>
                  <label className="text-xs text-gray-600">
                    Status
                    <select
                      value={form.status}
                      onChange={(event) => updateForm('status', event.target.value as LoadStatus)}
                      className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
                    >
                      <option value={LoadStatus.DRAFT}>DRAFT</option>
                      <option value={LoadStatus.PUBLISHED}>PUBLISHED</option>
                      <option value={LoadStatus.ON_BOARD}>ON_BOARD</option>
                      <option value={LoadStatus.NEGOTIATING}>NEGOTIATING</option>
                      <option value={LoadStatus.TAKEN}>TAKEN</option>
                      <option value={LoadStatus.IN_TRANSIT}>IN_TRANSIT</option>
                      <option value={LoadStatus.DELIVERED}>DELIVERED</option>
                      <option value={LoadStatus.NOT_INTERESTED}>NOT_INTERESTED</option>
                      <option value={LoadStatus.CANCELED}>CANCELED</option>
                    </select>
                  </label>
                  <label className="text-xs text-gray-600">
                    Board
                    <select
                      value={form.boardSource}
                      onChange={(event) =>
                        updateForm('boardSource', event.target.value as LoadBoardSource)
                      }
                      className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
                    >
                      <option value={LoadBoardSource.MANUAL}>MANUAL</option>
                      <option value={LoadBoardSource.TRANS_EU}>TRANS_EU</option>
                      <option value={LoadBoardSource.TIMOCOM}>TIMOCOM</option>
                      <option value={LoadBoardSource.OTHER}>OTHER</option>
                    </select>
                  </label>
                  <label className="text-xs text-gray-600">
                    Color
                    <input
                      type="color"
                      value={form.color}
                      onChange={(event) => updateForm('color', event.target.value)}
                      className="mt-1 h-9 w-full rounded border border-gray-300 bg-white px-1 py-1"
                    />
                  </label>
                  <label className="flex items-center gap-2 text-xs text-gray-700">
                    <input
                      type="checkbox"
                      checked={form.isInactive}
                      onChange={(event) => updateForm('isInactive', event.target.checked)}
                    />
                    Mark as inactive
                  </label>
                  <label className="text-xs text-gray-600 md:col-span-2">
                    Contact Person
                    <input
                      type="text"
                      value={form.contactPerson}
                      onChange={(event) => updateForm('contactPerson', event.target.value)}
                      className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
                    />
                  </label>
                  <label className="text-xs text-gray-600">
                    Contact Phone
                    <input
                      type="text"
                      value={form.contactPhone}
                      onChange={(event) => updateForm('contactPhone', event.target.value)}
                      className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
                    />
                  </label>
                  <label className="text-xs text-gray-600">
                    Contact Email
                    <input
                      type="email"
                      value={form.contactEmail}
                      onChange={(event) => updateForm('contactEmail', event.target.value)}
                      className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
                    />
                  </label>
                </div>
              </section>

              <section className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Brokerage Info
                </h3>
                <p className="mb-3 text-[11px] text-gray-500">Default company information</p>
                <div className="grid gap-3 md:grid-cols-4">
                  <label className="text-xs text-gray-600 md:col-span-2">
                    Brokerage Name
                    <input
                      type="text"
                      value={form.brokerageName}
                      onChange={(event) => updateForm('brokerageName', event.target.value)}
                      className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
                    />
                  </label>
                  <label className="text-xs text-gray-600 md:col-span-2">
                    Company Address (optional)
                    <input
                      type="text"
                      value={form.brokerCompanyAddress}
                      onChange={(event) => updateForm('brokerCompanyAddress', event.target.value)}
                      className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
                    />
                  </label>
                  <label className="text-xs text-gray-600">
                    Employee Number (optional)
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={form.brokerEmployeeCount}
                      onChange={(event) => updateForm('brokerEmployeeCount', event.target.value)}
                      className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
                    />
                  </label>
                </div>

                <button
                  type="button"
                  onClick={() => setIsBrokerTranseuExpanded((prev) => !prev)}
                  className="mt-4 flex w-full items-center justify-between rounded border border-gray-300 bg-white px-3 py-2 text-left text-xs font-semibold text-gray-700 hover:bg-gray-100"
                >
                  <span>Trans.eu Information</span>
                  {isBrokerTranseuExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>

                {isBrokerTranseuExpanded && (
                  <div className="mt-3 grid gap-3 md:grid-cols-4">
                    <label className="text-xs text-gray-600 md:col-span-2">
                      Broker UUID (Trans.eu)
                      <input
                        type="text"
                        value={form.brokerTransEuId}
                        onChange={(event) => updateForm('brokerTransEuId', event.target.value)}
                        className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
                        placeholder="optional Trans.eu broker id"
                      />
                    </label>
                    <label className="text-xs text-gray-600">
                      Paid On Time
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={form.brokerPaidOnTime}
                        onChange={(event) => updateForm('brokerPaidOnTime', event.target.value)}
                        className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
                      />
                    </label>
                    <label className="text-xs text-gray-600">
                      Paid With Delay
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={form.brokerPaidWithDelay}
                        onChange={(event) => updateForm('brokerPaidWithDelay', event.target.value)}
                        className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
                      />
                    </label>
                    <label className="text-xs text-gray-600">
                      Payment Issues
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={form.brokerPaymentIssues}
                        onChange={(event) => updateForm('brokerPaymentIssues', event.target.value)}
                        className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
                      />
                    </label>
                    <label className="text-xs text-gray-600">
                      Rating
                      <input
                        type="text"
                        value={form.brokerRating}
                        onChange={(event) => updateForm('brokerRating', event.target.value)}
                        placeholder="e.g. 5,0"
                        className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
                      />
                    </label>
                    <label className="text-xs text-gray-600">
                      Number Of Reviews
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={form.brokerReviewCount}
                        onChange={(event) => updateForm('brokerReviewCount', event.target.value)}
                        className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
                      />
                    </label>
                  </div>
                )}
              </section>

              <section className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Pickup
                </h3>
                <div className="grid gap-3 md:grid-cols-3">
                  <label className="text-xs text-gray-600 md:col-span-3">
                    Address (optional)
                    <input
                      type="text"
                      value={form.pickupAddress}
                      onChange={(event) => updateForm('pickupAddress', event.target.value)}
                      className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
                    />
                  </label>
                  <label className="text-xs text-gray-600">
                    City *
                    <input
                      type="text"
                      value={form.pickupCity}
                      onChange={(event) => updateForm('pickupCity', event.target.value)}
                      className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
                    />
                  </label>
                  <label className="text-xs text-gray-600">
                    Postcode *
                    <input
                      type="text"
                      value={form.pickupPostcode}
                      onChange={(event) => updateForm('pickupPostcode', event.target.value)}
                      className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
                    />
                  </label>
                  <label className="text-xs text-gray-600">
                    Country *
                    <input
                      type="text"
                      value={form.pickupCountry}
                      onChange={(event) => updateForm('pickupCountry', event.target.value)}
                      className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
                    />
                  </label>
                  <label className="text-xs text-gray-600">
                    Date From *
                    <DateTimePicker
                      mode="datetime"
                      value={form.pickupDateFrom}
                      onChange={(value) => updateForm('pickupDateFrom', value)}
                    />
                  </label>
                  <label className="text-xs text-gray-600">
                    Date To
                    <DateTimePicker
                      mode="datetime"
                      value={form.pickupDateTo}
                      onChange={(value) => updateForm('pickupDateTo', value)}
                    />
                  </label>
                  <label className="text-xs text-gray-600">
                    Stop Pallets
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={form.pickupStopPallets}
                      onChange={(event) => updateForm('pickupStopPallets', event.target.value)}
                      className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
                    />
                  </label>
                  <label className="text-xs text-gray-600 md:col-span-3">
                    Pickup Transeu Link
                    <input
                      type="text"
                      value={form.originTranseuLink}
                      onChange={(event) => updateForm('originTranseuLink', event.target.value)}
                      className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
                    />
                  </label>
                </div>
              </section>

              <section className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Delivery
                </h3>
                <div className="grid gap-3 md:grid-cols-3">
                  <label className="text-xs text-gray-600 md:col-span-3">
                    Address (optional)
                    <input
                      type="text"
                      value={form.deliveryAddress}
                      onChange={(event) => updateForm('deliveryAddress', event.target.value)}
                      className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
                    />
                  </label>
                  <label className="text-xs text-gray-600">
                    City *
                    <input
                      type="text"
                      value={form.deliveryCity}
                      onChange={(event) => updateForm('deliveryCity', event.target.value)}
                      className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
                    />
                  </label>
                  <label className="text-xs text-gray-600">
                    Postcode *
                    <input
                      type="text"
                      value={form.deliveryPostcode}
                      onChange={(event) => updateForm('deliveryPostcode', event.target.value)}
                      className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
                    />
                  </label>
                  <label className="text-xs text-gray-600">
                    Country *
                    <input
                      type="text"
                      value={form.deliveryCountry}
                      onChange={(event) => updateForm('deliveryCountry', event.target.value)}
                      className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
                    />
                  </label>
                  <label className="text-xs text-gray-600">
                    Date From *
                    <DateTimePicker
                      mode="datetime"
                      value={form.deliveryDateFrom}
                      onChange={(value) => updateForm('deliveryDateFrom', value)}
                    />
                  </label>
                  <label className="text-xs text-gray-600">
                    Date To
                    <DateTimePicker
                      mode="datetime"
                      value={form.deliveryDateTo}
                      onChange={(value) => updateForm('deliveryDateTo', value)}
                    />
                  </label>
                  <label className="text-xs text-gray-600">
                    Stop Pallets
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={form.deliveryStopPallets}
                      onChange={(event) => updateForm('deliveryStopPallets', event.target.value)}
                      className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
                    />
                  </label>
                  <label className="text-xs text-gray-600 md:col-span-3">
                    Delivery Transeu Link
                    <input
                      type="text"
                      value={form.destTranseuLink}
                      onChange={(event) => updateForm('destTranseuLink', event.target.value)}
                      className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
                    />
                  </label>
                </div>
              </section>

              <section className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Pricing And Contact
                </h3>
                <div className="grid gap-3 md:grid-cols-4">
                  <label className="text-xs text-gray-600">
                    Published Price
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={form.publishedPrice}
                      onChange={(event) => updateForm('publishedPrice', event.target.value)}
                      className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
                    />
                  </label>
                  <label className="text-xs text-gray-600">
                    Agreed Price
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={form.agreedPrice}
                      onChange={(event) => updateForm('agreedPrice', event.target.value)}
                      className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
                    />
                  </label>
                  <label className="text-xs text-gray-600">
                    Currency
                    <select
                      value={form.currency}
                      onChange={(event) => updateForm('currency', event.target.value as Currency)}
                      className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
                    >
                      <option value={Currency.EUR}>EUR</option>
                      <option value={Currency.USD}>USD</option>
                      <option value={Currency.GBP}>GBP</option>
                      <option value={Currency.PLN}>PLN</option>
                      <option value={Currency.CZK}>CZK</option>
                      <option value={Currency.CHF}>CHF</option>
                    </select>
                  </label>
                  <label className="text-xs text-gray-600">
                    Payment Term (days)
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={form.paymentTermDays}
                      onChange={(event) => updateForm('paymentTermDays', event.target.value)}
                      className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
                    />
                  </label>
                  <label className="text-xs text-gray-600">
                    Distance (km)
                    <input
                      type="number"
                      min={0}
                      step={0.1}
                      value={form.distanceKm}
                      onChange={(event) => updateForm('distanceKm', event.target.value)}
                      className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
                    />
                  </label>
                  <label className="flex items-center gap-2 text-xs text-gray-700">
                    <input
                      type="checkbox"
                      checked={form.pricingInvoitix}
                      onChange={(event) => updateForm('pricingInvoitix', event.target.checked)}
                    />
                    Invoitix
                  </label>
                  <label className="flex items-center gap-2 text-xs text-gray-700">
                    <input
                      type="checkbox"
                      checked={form.pricingValutaCheck}
                      onChange={(event) => updateForm('pricingValutaCheck', event.target.checked)}
                    />
                    Valuta Check
                  </label>
                </div>
                <label className="mt-3 block text-xs text-gray-600">
                  Pricing Notes
                  <textarea
                    rows={3}
                    value={form.pricingNotes}
                    onChange={(event) => updateForm('pricingNotes', event.target.value)}
                    className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
                  />
                </label>
              </section>

              <section className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                    Pallets
                  </h3>
                  <button
                    type="button"
                    onClick={() => setPallets((prev) => [...prev, defaultPalletRow()])}
                    className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                  >
                    <Plus className="h-3 w-3" />
                    Add Pallet Row
                  </button>
                </div>
                <div className="mb-3 grid gap-3 md:grid-cols-2">
                  <label className="text-xs text-gray-600">
                    Total Weight (tons)
                    <input
                      type="number"
                      min={0}
                      step={0.001}
                      value={form.freightWeightTons}
                      onChange={(event) => updateForm('freightWeightTons', event.target.value)}
                      className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
                    />
                  </label>
                </div>
                <div className="space-y-2">
                  {pallets.map((row) => (
                    <div
                      key={row.id}
                      className="grid gap-2 rounded border border-gray-200 bg-white p-2 md:grid-cols-[1.3fr_100px_100px_100px_100px_80px_auto]"
                    >
                      <input
                        type="text"
                        value={row.label}
                        onChange={(event) => updatePallet(row.id, { label: event.target.value })}
                        className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900"
                        placeholder="Label"
                      />
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={row.widthCm}
                        onChange={(event) => updatePallet(row.id, { widthCm: event.target.value })}
                        className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900"
                        placeholder="Width"
                      />
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={row.heightCm}
                        onChange={(event) => updatePallet(row.id, { heightCm: event.target.value })}
                        className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900"
                        placeholder="Height"
                      />
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={row.depthCm}
                        onChange={(event) => updatePallet(row.id, { depthCm: event.target.value })}
                        className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900"
                        placeholder="Depth"
                      />
                      <input
                        type="number"
                        min={0}
                        step={0.001}
                        value={row.weightTons}
                        onChange={(event) => updatePallet(row.id, { weightTons: event.target.value })}
                        className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900"
                        placeholder="tons"
                      />
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={row.quantity}
                        onChange={(event) => updatePallet(row.id, { quantity: event.target.value })}
                        className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900"
                        placeholder="Qty"
                      />
                      <button
                        type="button"
                        onClick={() => setPallets((prev) => prev.filter((entry) => entry.id !== row.id))}
                        className="rounded border border-red-200 bg-red-50 p-1 text-red-600 hover:bg-red-100"
                        title="Remove pallet row"
                        disabled={pallets.length === 1}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <label className="mt-3 block text-xs text-gray-600">
                  Freight Notes
                  <textarea
                    rows={2}
                    value={form.freightNotes}
                    onChange={(event) => updateForm('freightNotes', event.target.value)}
                    className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
                  />
                </label>
              </section>

              <section className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                    Extra Stops (Optional)
                  </h3>
                  <button
                    type="button"
                    onClick={() => setExtraStops((prev) => [...prev, defaultExtraStopRow()])}
                    className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                  >
                    <Plus className="h-3 w-3" />
                    Add Stop
                  </button>
                </div>
                {extraStops.length === 0 && (
                  <p className="text-xs text-gray-500">No extra stops added.</p>
                )}
                <div className="space-y-2">
                  {extraStops.map((stop) => (
                    <div
                      key={stop.id}
                      className="grid gap-2 rounded border border-gray-200 bg-white p-2 md:grid-cols-4"
                    >
                      <select
                        value={stop.stopType}
                        onChange={(event) =>
                          updateExtraStop(stop.id, { stopType: event.target.value as StopType })
                        }
                        className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900"
                      >
                        <option value={StopType.PICKUP}>PICKUP</option>
                        <option value={StopType.DELIVERY}>DELIVERY</option>
                      </select>
                      <input
                        type="text"
                        value={stop.address}
                        onChange={(event) => updateExtraStop(stop.id, { address: event.target.value })}
                        className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900 md:col-span-3"
                        placeholder="Address"
                      />
                      <input
                        type="text"
                        value={stop.city}
                        onChange={(event) => updateExtraStop(stop.id, { city: event.target.value })}
                        className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900"
                        placeholder="City"
                      />
                      <input
                        type="text"
                        value={stop.postcode}
                        onChange={(event) => updateExtraStop(stop.id, { postcode: event.target.value })}
                        className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900"
                        placeholder="Postcode"
                      />
                      <input
                        type="text"
                        value={stop.country}
                        onChange={(event) => updateExtraStop(stop.id, { country: event.target.value })}
                        className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900"
                        placeholder="Country"
                      />
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={stop.pallets}
                        onChange={(event) => updateExtraStop(stop.id, { pallets: event.target.value })}
                        className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900"
                        placeholder="Pallets"
                      />
                      <DateTimePicker
                        mode="datetime"
                        value={stop.dateFrom}
                        onChange={(value) => updateExtraStop(stop.id, { dateFrom: value })}
                        triggerClassName="mt-0 px-2 py-1 text-xs"
                      />
                      <DateTimePicker
                        mode="datetime"
                        value={stop.dateTo}
                        onChange={(value) => updateExtraStop(stop.id, { dateTo: value })}
                        triggerClassName="mt-0 px-2 py-1 text-xs"
                      />
                      <input
                        type="text"
                        value={stop.transeuLink}
                        onChange={(event) =>
                          updateExtraStop(stop.id, { transeuLink: event.target.value })
                        }
                        className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900"
                        placeholder="Transeu Link"
                      />
                      <input
                        type="text"
                        value={stop.notes}
                        onChange={(event) => updateExtraStop(stop.id, { notes: event.target.value })}
                        className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900 md:col-span-2"
                        placeholder="Notes"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setExtraStops((prev) => prev.filter((entry) => entry.id !== stop.id))
                        }
                        className="rounded border border-red-200 bg-red-50 p-1 text-red-600 hover:bg-red-100"
                        title="Remove extra stop"
                      >
                        <Trash2 className="mx-auto h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          {activeTab === 'manual' ? (
            <button
              onClick={() => void handleCreateFreight()}
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Create Freight
            </button>
          ) : (
            <button
              disabled
              className="rounded bg-gray-300 px-4 py-2 text-sm font-medium text-gray-600"
            >
              PDF Processing Soon
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
