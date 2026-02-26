import { useState, useEffect, useCallback } from 'react';
import { Trip, TripFilters, SortOption } from '../types/trip';
import { getTrips, deleteTrip as deleteServiceTrip, saveTrip } from '../services/tripService';
import { updateVehicleOdometer } from '../services/vehicleService';

export function useTrips() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<TripFilters>({ status: 'all' });
  const [sortBy, setSortBy] = useState<SortOption>('date-desc');

  const loadTrips = useCallback(async () => {
    setLoading(true);
    const allTrips = await getTrips();
    setTrips(allTrips);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadTrips();
  }, [loadTrips]);

  const filteredTrips = useCallback(() => {
    let result = [...trips];

    // Filter by status
    if (filters.status && filters.status !== 'all') {
      if (filters.status === 'pending') {
        result = result.filter(t => t.status === 'completed' || t.status === 'edited');
      } else {
        result = result.filter(t => t.status === filters.status);
      }
    }

    // Filter by vehicle
    if (filters.vehicleId) {
      result = result.filter(t => t.vehicleId === filters.vehicleId);
    }

    // Filter by date range
    if (filters.dateFrom) {
      result = result.filter(t => t.startTime >= filters.dateFrom!);
    }
    if (filters.dateTo) {
      result = result.filter(t => t.startTime <= filters.dateTo!);
    }

    // Filter by search query
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      result = result.filter(t => t.notes.toLowerCase().includes(query));
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'date-desc':
          return b.startTime.getTime() - a.startTime.getTime();
        case 'date-asc':
          return a.startTime.getTime() - b.startTime.getTime();
        case 'distance-desc':
          return (b.adjustedDistance || b.calculatedDistance) - (a.adjustedDistance || a.calculatedDistance);
        case 'duration-desc':
          return b.duration - a.duration;
        default:
          return 0;
      }
    });

    return result;
  }, [trips, filters, sortBy]);

  const updateTrip = async (trip: Trip) => {
    // Recalculate endOdometer based on adjustedDistance (if set) or calculatedDistance
    const effectiveDistance = trip.adjustedDistance ?? trip.calculatedDistance;
    const newEndOdometer = trip.startOdometer + effectiveDistance;

    const updatedTrip: Trip = {
      ...trip,
      endOdometer: newEndOdometer,
      status: 'edited',
    };

    // Save the updated trip locally
    await saveTrip(updatedTrip);

    // Update the vehicle's odometer locally to reflect the new end odometer
    // We need to check if this trip is the latest for the vehicle to avoid
    // overwriting a higher odometer from a newer trip
    const allCurrentTrips = await getTrips();
    const vehicleTrips = allCurrentTrips
      .filter(t => t.vehicleId === trip.vehicleId && t.status !== 'active' && t.id !== trip.id)
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

    // Find the highest endOdometer among all completed trips for this vehicle
    let highestOdometer = newEndOdometer;
    for (const vt of vehicleTrips) {
      const vtEndOdo = vt.endOdometer ?? (vt.startOdometer + (vt.adjustedDistance ?? vt.calculatedDistance));
      if (vtEndOdo > highestOdometer) {
        highestOdometer = vtEndOdo;
      }
    }

    try {
      await updateVehicleOdometer(trip.vehicleId, highestOdometer);
      console.log(`[useTrips] Updated vehicle ${trip.vehicleId} odometer to ${highestOdometer}`);
    } catch (error) {
      console.error('[useTrips] Failed to update vehicle odometer locally:', error);
    }

    await loadTrips();
  };

  const deleteTrip = async (tripId: string) => {
    await deleteServiceTrip(tripId);
    await loadTrips();
  };

  const getPendingCount = () => {
    return trips.filter(t => t.status === 'completed' || t.status === 'edited').length;
  };

  return {
    trips: filteredTrips(),
    allTrips: trips,
    loading,
    filters,
    sortBy,
    setFilters,
    setSortBy,
    updateTrip,
    deleteTrip,
    refreshTrips: loadTrips,
    getPendingCount,
  };
}