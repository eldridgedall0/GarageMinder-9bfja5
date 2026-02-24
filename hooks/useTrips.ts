import { useState, useEffect, useCallback } from 'react';
import { Trip, TripFilters, SortOption } from '../types/trip';
import { getTrips, deleteTrip as deleteServiceTrip, saveTrip } from '../services/tripService';

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
      result = result.filter(t => new Date(t.startTime) >= filters.dateFrom!);
    }
    if (filters.dateTo) {
      result = result.filter(t => new Date(t.startTime) <= filters.dateTo!);
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
          return new Date(b.startTime).getTime() - new Date(a.startTime).getTime();
        case 'date-asc':
          return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
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
    await saveTrip({ ...trip, status: 'edited' });
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