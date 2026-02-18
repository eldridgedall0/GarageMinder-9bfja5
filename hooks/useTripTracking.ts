import { useState, useEffect, useCallback, useRef } from 'react';
import { Trip, Vehicle } from '../types/trip';
import { 
  getActiveTrip, 
  setActiveTrip, 
  saveTrip, 
} from '../services/tripService';
import { updateVehicleOdometer } from '../services/vehicleService';
import { useLocationTracking } from './useLocationTracking';
import { metersToMiles } from '../services/locationService';
import { canAutoSync } from '../services/subscriptionService';
import { syncTrips } from '../services/tripService';

interface UseTripTrackingOptions {
  activeVehicle: Vehicle | null;
}

export function useTripTracking({ activeVehicle }: UseTripTrackingOptions) {
  const [activeTrip, setActiveTripState] = useState<Trip | null>(null);
  const [isTracking, setIsTracking] = useState(false);

  // Keep a ref to the vehicle so callbacks always see the latest value
  const activeVehicleRef = useRef<Vehicle | null>(activeVehicle);
  useEffect(() => {
    activeVehicleRef.current = activeVehicle;
  }, [activeVehicle]);

  const {
    isTracking: isGpsTracking,
    totalDistance: gpsDistance,
    startTracking: startGpsTracking,
    stopTracking: stopGpsTracking,
  } = useLocationTracking({
    onLocationUpdate: (location, distance) => {
      setActiveTripState(prev => {
        if (!prev || !activeVehicleRef.current) return prev;
        const distanceMiles = metersToMiles(distance);
        const now = new Date();
        const duration = now.getTime() - prev.startTime.getTime();
        const updated: Trip = {
          ...prev,
          duration,
          calculatedDistance: distanceMiles,
          endOdometer: prev.startOdometer + distanceMiles,
          updatedAt: now,
        };
        setActiveTrip(updated); // fire-and-forget save
        return updated;
      });
    },
    onTripComplete: async (totalDistance, duration) => {
      await finalizeTrip(metersToMiles(totalDistance), duration);
    },
  });

  // Load any in-progress trip from storage on mount
  useEffect(() => {
    (async () => {
      const trip = await getActiveTrip();
      if (trip && trip.status === 'active') {
        setActiveTripState(trip);
        setIsTracking(true);
      }
    })();
  }, []);

  const startTrip = async (): Promise<boolean> => {
    const vehicle = activeVehicleRef.current;
    if (!vehicle) {
      console.warn('[useTripTracking] startTrip called but no activeVehicle');
      return false;
    }

    const vehicleName = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
    console.log('[useTripTracking] Starting trip for:', vehicleName);

    const started = await startGpsTracking(vehicleName);
    if (!started) {
      console.warn('[useTripTracking] GPS tracking failed to start');
      return false;
    }

    const newTrip: Trip = {
      id: `trip-${Date.now()}`,
      vehicleId: vehicle.id,
      startTime: new Date(),
      endTime: null,
      startOdometer: vehicle.currentOdometer,
      endOdometer: null,
      calculatedDistance: 0,
      adjustedDistance: null,
      duration: 0,
      status: 'active',
      notes: '',
      classification: 'unclassified',
      isAutoTracked: false,
      syncedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    setActiveTripState(newTrip);
    await setActiveTrip(newTrip);
    setIsTracking(true);
    console.log('[useTripTracking] Trip started:', newTrip.id);
    return true;
  };

  const stopTrip = async () => {
    if (!activeTrip) return;
    console.log('[useTripTracking] Stopping trip:', activeTrip.id);
    await stopGpsTracking();
    const finalDistance = metersToMiles(gpsDistance);
    const duration = Date.now() - activeTrip.startTime.getTime();
    await finalizeTrip(finalDistance, duration);
  };

  const finalizeTrip = async (distance: number, duration: number) => {
    const trip = activeTrip;
    const vehicle = activeVehicleRef.current;
    if (!trip) return;

    const now = new Date();
    const endOdometer = trip.startOdometer + distance;

    const completed: Trip = {
      ...trip,
      endTime: now,
      duration,
      calculatedDistance: distance,
      endOdometer,
      status: 'completed',
      updatedAt: now,
    };

    await saveTrip(completed);
    await setActiveTrip(null);

    if (vehicle) {
      await updateVehicleOdometer(vehicle.id, endOdometer);
    }

    setActiveTripState(null);
    setIsTracking(false);
    console.log('[useTripTracking] Trip finalized:', completed.id, distance.toFixed(2), 'miles');

    const shouldAutoSync = await canAutoSync();
    if (shouldAutoSync) {
      setTimeout(() => syncTrips([completed.id]), 30000);
    }
  };

  return {
    activeTrip,
    isTracking: isTracking || isGpsTracking,
    startTrip,
    stopTrip,
  };
}
