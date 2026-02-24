export interface CreateTripDto {
  driverId: string;
  vanId: string;
  departureDate: string;
  returnDate?: string;
  startOdometerKm?: number;
  endOdometerKm?: number;
  notes?: string;
}

export type UpdateTripDto = Partial<CreateTripDto>;

export interface CompleteTripDto {
  returnDate: string;
  endOdometerKm?: number;
}
