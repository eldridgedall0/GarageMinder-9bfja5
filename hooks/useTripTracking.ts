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

  // --- FIX: Use refs so callbacks always read current values, not stale closures
  const activeTripRef = useRef<Trip | null>(null);
  const activeVehicleRef = useRef<Vehicle | null>(activeVehicle);
  const isFinalizingRef = useRef(false); // prevent double-finalize

  // Keep refs in sync with state/props
  useEffect(() => {
    activeVehicleRef.current = activeVehicle;
  }, [activeVehicle]);

  // Sync activeTripState → ref
  useEffect(() => {
    activeTripRef.current = activeTrip;
  }, [activeTrip]);

  // --- FIX: finalizeTrip reads from ref, not from stale closure
  const finalizeTrip = useCallback(async (distance: number, duration: number) => {
    // Guard against double-finalize (can happen if stopTracking triggers onTripComplete
    // at the same time stopTrip manually calls finalizeTrip)
    if (isFinalizingRef.current) {
      console.log('[useTripTracking] finalizeTrip already in progress, skipping duplicate call');
      return;
    }
    isFinalizingRef.current = true;

    const trip = activeTripRef.current; // read from ref, not stale closure
    const vehicle = activeVehicleRef.current;

    if (!trip) {
      console.warn('[useTripTracking] finalizeTrip called but no activeTrip in ref');
      isFinalizingRef.current = false;
      return;
    }

    let completedTrip: Trip | null = null;

    try {
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
      completedTrip = completed;

      await saveTrip(completed);
      await setActiveTrip(null);

      // Odometer update is best-effort — don't let failure block UI reset
      if (vehicle) {
        try {
          await updateVehicleOdometer(vehicle.id, endOdometer);
        } catch (odometerError) {
          console.error('[useTripTracking] Odometer update failed (trip still saved):', odometerError);
        }
      }

      console.log('[useTripTracking] Trip finalized:', completed.id, distance.toFixed(2), 'miles');

      const shouldAutoSync = await canAutoSync();
      if (shouldAutoSync) {
        setTimeout(() => syncTrips([completed.id]), 30000);
      }
    } catch (error) {
      console.error('[useTripTracking] finalizeTrip error:', error);
    } finally {
      // ALWAYS reset UI state — even if saveTrip or other operations fail,
      // the trip tracking is stopped and user must not be stuck in tracking view
      activeTripRef.current = null;
      setActiveTripState(null);
      setIsTracking(false);
      isFinalizingRef.current = false;
    }
  }, []); // stable — reads from refs

  const gpsDistanceRef = useRef(0);

  const {
    isTracking: isGpsTracking,
    totalDistance: gpsDistance,
    startTracking: startGpsTracking,
    stopTracking: stopGpsTracking,
  } = useLocationTracking({
    onLocationUpdate: (location, distance) => {
      const currentTrip = activeTripRef.current;
      if (!currentTrip || !activeVehicleRef.current) return;

      gpsDistanceRef.current = distance; // keep ref in sync
      const distanceMiles = metersToMiles(distance);
      const now = new Date();
      const duration = now.getTime() - currentTrip.startTime.getTime();
      const updated: Trip = {
        ...currentTrip,
        duration,
        calculatedDistance: distanceMiles,
        endOdometer: currentTrip.startOdometer + distanceMiles,
        updatedAt: now,
      };
      activeTripRef.current = updated; // update ref immediately
      setActiveTripState(updated);
      setActiveTrip(updated); // fire-and-forget save
    },
    onTripComplete: async (totalDistance, duration) => {
      // Auto-complete (e.g. stationary timeout) — finalize from GPS callback
      console.log('[useTripTracking] onTripComplete fired (auto-stop)');
      await finalizeTrip(metersToMiles(totalDistance), duration);
    },
  });

  // Load any in-progress trip from storage on mount
  useEffect(() => {
    (async () => {
      const trip = await getActiveTrip();
      if (trip && trip.status === 'active') {
        activeTripRef.current = trip;
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

    activeTripRef.current = newTrip;
    setActiveTripState(newTrip);
    await setActiveTrip(newTrip);
    setIsTracking(true);
    console.log('[useTripTracking] Trip started:', newTrip.id);
    return true;
  };

  const stopTrip = async () => {
    const currentTrip = activeTripRef.current;
    if (!currentTrip) {
      console.warn('[useTripTracking] stopTrip called but no activeTrip');
      return;
    }
    console.log('[useTripTracking] Stopping trip:', currentTrip.id);

    // Stop GPS silently — we handle finalization below to avoid double-finalize
    try {
      await stopGpsTracking(true);
    } catch (error) {
      console.error('[useTripTracking] Error stopping GPS (non-fatal):', error);
    }

    // Use ref value for latest distance (avoids stale gpsDistance state)
    const finalDistance = metersToMiles(gpsDistanceRef.current);
    const duration = Date.now() - currentTrip.startTime.getTime();
    
    try {
      await finalizeTrip(finalDistance, duration);
    } catch (error) {
      console.error('[useTripTracking] finalizeTrip failed in stopTrip:', error);
      // Safety net: ensure UI is always reset even if finalizeTrip throws unexpectedly
      activeTripRef.current = null;
      setActiveTripState(null);
      setIsTracking(false);
    }
  };

  return {
    activeTrip,
    // Only show isTracking from our own state — GPS state is internal
    isTracking,
    startTrip,
    stopTrip,
  };
}