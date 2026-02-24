export interface CreateTripDto {
  driverId: string;
  vanId: string;
  loadboardFromDate: string;
  departureDate?: string;
  plannedEndDate?: string;
  startOdometerKm?: number;
  notes?: string;
}

export interface UpdateTripDto extends Partial<CreateTripDto> {
  departureDate?: string;
  returnDate?: string;
  endOdometerKm?: number;
}

export interface CompleteTripDto {
  returnDate: string;
  endOdometerKm?: number;
}

export interface StartTripDto {
  departureDate: string;
  startOdometerKm?: number;
  plannedEndDate?: string;
}
