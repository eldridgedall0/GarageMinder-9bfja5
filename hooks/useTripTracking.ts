import { useState, useEffect, useCallback } from 'react';
import { Trip, Vehicle } from '../types/trip';
import { 
  getActiveTrip, 
  setActiveTrip, 
  saveTrip, 
  getActiveVehicle, 
  updateVehicleOdometer 
} from '../services/tripService';
import { useLocationTracking } from './useLocationTracking';
import { metersToMiles } from '../services/locationService';
import { canAutoSync } from '../services/subscriptionService';
import { syncTrips } from '../services/tripService';

export function useTripTracking() {
  const [activeTrip, setActiveTripState] = useState<Trip | null>(null);
  const [activeVehicle, setActiveVehicle] = useState<Vehicle | null>(null);
  const [isTracking, setIsTracking] = useState(false);

  // Use real GPS tracking
  const {
    isTracking: isGpsTracking,
    totalDistance: gpsDistance,
    startTime: gpsStartTime,
    startTracking: startGpsTracking,
    stopTracking: stopGpsTracking,
  } = useLocationTracking({
    onLocationUpdate: (location, distance) => {
      // Update trip in real-time
      if (activeTrip) {
        const distanceMiles = metersToMiles(distance);
        const now = new Date();
        const duration = now.getTime() - activeTrip.startTime.getTime();
        const endOdometer = activeTrip.startOdometer + distanceMiles;

        const updated: Trip = {
          ...activeTrip,
          duration,
          calculatedDistance: distanceMiles,
          endOdometer,
          updatedAt: now,
        };

        setActiveTripState(updated);
        setActiveTrip(updated); // Save to storage
      }
    },
    onTripComplete: async (totalDistance, duration) => {
      // GPS tracking completed - finalize trip
      if (activeTrip) {
        await finalizeTrip(metersToMiles(totalDistance), duration);
      }
    },
  });

  // Load active trip and vehicle on mount
  useEffect(() => {
    loadActiveData();
  }, []);

  const loadActiveData = async () => {
    const trip = await getActiveTrip();
    const vehicle = await getActiveVehicle();
    
    setActiveTripState(trip);
    setActiveVehicle(vehicle);
    
    if (trip && trip.status === 'active') {
      setIsTracking(true);
    }
  };

  const startTrip = async () => {
    if (!activeVehicle) return false;

    // Start GPS tracking
    const vehicleName = `${activeVehicle.year} ${activeVehicle.make} ${activeVehicle.model}`;
    const started = await startGpsTracking(vehicleName);
    
    if (!started) {
      return false;
    }

    const newTrip: Trip = {
      id: `trip-${Date.now()}`,
      vehicleId: activeVehicle.id,
      startTime: new Date(),
      endTime: null,
      startOdometer: activeVehicle.currentOdometer,
      endOdometer: null,
      calculatedDistance: 0,
      adjustedDistance: null,
      duration: 0,
      status: 'active',
      notes: '',
      syncedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    setActiveTripState(newTrip);
    await setActiveTrip(newTrip);
    setIsTracking(true);
    
    return true;
  };

  const stopTrip = async () => {
    if (!activeTrip) return;

    // Stop GPS tracking
    await stopGpsTracking();

    // Calculate final distance from GPS
    const finalDistance = metersToMiles(gpsDistance);
    const duration = Date.now() - activeTrip.startTime.getTime();
    
    await finalizeTrip(finalDistance, duration);
  };

  const finalizeTrip = async (distance: number, duration: number) => {
    if (!activeTrip || !activeVehicle) return;

    const now = new Date();
    const endOdometer = activeTrip.startOdometer + distance;

    const completed: Trip = {
      ...activeTrip,
      endTime: now,
      duration,
      calculatedDistance: distance,
      endOdometer,
      status: 'completed',
      updatedAt: now,
    };

    await saveTrip(completed);
    await setActiveTrip(null);
    
    // Update vehicle odometer
    await updateVehicleOdometer(activeVehicle.id, endOdometer);

    setActiveTripState(null);
    setIsTracking(false);

    // Check if auto-sync is enabled (paid users)
    const shouldAutoSync = await canAutoSync();
    if (shouldAutoSync) {
      // Schedule background sync
      setTimeout(async () => {
        await syncTrips([completed.id]);
      }, 30000); // 30 second delay
    }
  };

  return {
    activeTrip,
    activeVehicle,
    isTracking: isTracking || isGpsTracking,
    startTrip,
    stopTrip,
  };
}
