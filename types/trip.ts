export type TripStatus = 'active' | 'completed' | 'synced' | 'edited';

export interface Trip {
  id: string;
  vehicleId: string;
  startTime: Date;
  endTime: Date | null;
  startOdometer: number;
  endOdometer: number | null;
  calculatedDistance: number; // GPS calculated
  adjustedDistance: number | null; // User override
  duration: number; // milliseconds
  status: TripStatus;
  notes: string;
  syncedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Vehicle {
  id: string;
  year: number;
  make: string;
  model: string;
  currentOdometer: number;
  userId: string;
  createdAt: Date;
}

export interface TripFilters {
  status?: TripStatus | 'all' | 'pending';
  vehicleId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  searchQuery?: string;
}

export type SortOption = 'date-desc' | 'date-asc' | 'distance-desc' | 'duration-desc';
