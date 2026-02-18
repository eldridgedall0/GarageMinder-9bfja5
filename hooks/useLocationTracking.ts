import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import * as Location from 'expo-location';
import {
  getCurrentLocation,
  startBackgroundLocationTracking,
  stopBackgroundLocationTracking,
  calculateDistance,
  metersToMiles,
  isMoving,
  isStationaryTimeout,
  type LocationPoint,
} from '../services/locationService';
import { showTripStartedNotification, showTripCompletedNotification } from '../services/notificationService';

const START_GRACE_PERIOD = 30000; // 30 seconds
const STOP_GRACE_PERIOD = 300000; // 5 minutes

interface UseLocationTrackingProps {
  onLocationUpdate?: (location: LocationPoint, distance: number) => void;
  onTripComplete?: (totalDistance: number, duration: number) => void;
}

export function useLocationTracking({
  onLocationUpdate,
  onTripComplete,
}: UseLocationTrackingProps = {}) {
  const [isTracking, setIsTracking] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<LocationPoint | null>(null);
  const [totalDistance, setTotalDistance] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  
  // --- FIX: Use refs for all values read inside stopTracking/callbacks
  // to avoid stale closure bugs. React state is async and closures capture
  // the value at creation time, not the current value at call time.
  const isTrackingRef = useRef(false);
  const totalDistanceRef = useRef(0);
  const startTimeRef = useRef<number | null>(null);
  const onTripCompleteRef = useRef(onTripComplete);
  const onLocationUpdateRef = useRef(onLocationUpdate);

  // Keep callback refs in sync
  useEffect(() => { onTripCompleteRef.current = onTripComplete; }, [onTripComplete]);
  useEffect(() => { onLocationUpdateRef.current = onLocationUpdate; }, [onLocationUpdate]);

  const previousLocationRef = useRef<LocationPoint | null>(null);
  const lastMovementTimeRef = useRef<number>(Date.now());
  const startGraceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const stopGraceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const locationSubscriptionRef = useRef<Location.LocationSubscription | null>(null);

  // Sync state → refs whenever state changes
  useEffect(() => { isTrackingRef.current = isTracking; }, [isTracking]);
  useEffect(() => { totalDistanceRef.current = totalDistance; }, [totalDistance]);
  useEffect(() => { startTimeRef.current = startTime; }, [startTime]);

  // Internal stop that always uses refs (no stale closure issues)
  // silent=true suppresses the onTripComplete callback (used when caller handles finalization itself)
  const stopTrackingInternal = useCallback(async (silent = false) => {
    if (!isTrackingRef.current) return;

    const currentTotal = totalDistanceRef.current;
    const currentStart = startTimeRef.current;
    const duration = currentStart ? Date.now() - currentStart : 0;
    const distanceMiles = metersToMiles(currentTotal);

    // Mark as not tracking immediately to prevent re-entrant calls
    isTrackingRef.current = false;
    setIsTracking(false);

    // Show completion notification
    try {
      await showTripCompletedNotification(distanceMiles, duration);
    } catch (e) {
      console.warn('[useLocationTracking] Notification error (non-fatal):', e);
    }

    // Clean up location subscription
    if (locationSubscriptionRef.current) {
      locationSubscriptionRef.current.remove();
      locationSubscriptionRef.current = null;
    }

    // Stop background tracking
    try {
      await stopBackgroundLocationTracking();
    } catch (e) {
      console.warn('[useLocationTracking] stopBackgroundLocation error (non-fatal):', e);
    }

    // Clear timers
    if (startGraceTimerRef.current) {
      clearTimeout(startGraceTimerRef.current);
      startGraceTimerRef.current = null;
    }
    if (stopGraceTimerRef.current) {
      clearTimeout(stopGraceTimerRef.current);
      stopGraceTimerRef.current = null;
    }

    // Reset state
    setTotalDistance(0);
    setStartTime(null);
    setCurrentLocation(null);
    previousLocationRef.current = null;
    totalDistanceRef.current = 0;
    startTimeRef.current = null;

    // Notify completion — use ref to avoid stale closure
    if (!silent) {
      onTripCompleteRef.current?.(currentTotal, duration);
    }
  }, []); // stable — reads everything from refs

  // Start tracking
  const startTracking = useCallback(async (vehicleName: string) => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    
    if (status !== 'granted') {
      return false;
    }

    const now = Date.now();
    isTrackingRef.current = true;
    totalDistanceRef.current = 0;
    startTimeRef.current = now;

    setIsTracking(true);
    setTotalDistance(0);
    setStartTime(now);
    previousLocationRef.current = null;
    lastMovementTimeRef.current = now;

    // Show notification
    await showTripStartedNotification(vehicleName);

    // Get initial location
    const initialLocation = await getCurrentLocation();
    if (initialLocation) {
      setCurrentLocation(initialLocation);
      previousLocationRef.current = initialLocation;
    }

    // Start foreground tracking
    const subscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 5000,
        distanceInterval: 10,
      },
      (location) => {
        const point: LocationPoint = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          altitude: location.coords.altitude,
          accuracy: location.coords.accuracy,
          speed: location.coords.speed,
          timestamp: location.timestamp,
        };
        handleLocationUpdate(point);
      }
    );

    locationSubscriptionRef.current = subscription;

    // Start background tracking for when app goes to background
    await startBackgroundLocationTracking();

    return true;
  }, []);

  // Handle location updates — reads from refs to avoid stale closures
  const handleLocationUpdate = useCallback((location: LocationPoint) => {
    setCurrentLocation(location);

    const previous = previousLocationRef.current;
    
    if (previous) {
      const distance = calculateDistance(
        previous.latitude,
        previous.longitude,
        location.latitude,
        location.longitude
      );

      if (isMoving(location, previous)) {
        lastMovementTimeRef.current = Date.now();
        
        // Clear stop grace timer if exists
        if (stopGraceTimerRef.current) {
          clearTimeout(stopGraceTimerRef.current);
          stopGraceTimerRef.current = null;
        }

        // Accumulate distance via ref for accurate reads in stopTracking
        totalDistanceRef.current += distance;
        setTotalDistance(totalDistanceRef.current);
        onLocationUpdateRef.current?.(location, totalDistanceRef.current);
      } else {
        // Not moving - start stop grace period
        if (!stopGraceTimerRef.current) {
          stopGraceTimerRef.current = setTimeout(() => {
            if (isStationaryTimeout(lastMovementTimeRef.current)) {
              stopTrackingInternal();
            }
          }, STOP_GRACE_PERIOD);
        }
      }
    }

    previousLocationRef.current = location;
  }, [stopTrackingInternal]);

  // Public stopTracking — silent=true means caller handles finalization (prevents double-finalize)
  const stopTracking = useCallback(async (silent = false) => {
    await stopTrackingInternal(silent);
  }, [stopTrackingInternal]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (locationSubscriptionRef.current) {
        locationSubscriptionRef.current.remove();
      }
      if (startGraceTimerRef.current) {
        clearTimeout(startGraceTimerRef.current);
      }
      if (stopGraceTimerRef.current) {
        clearTimeout(stopGraceTimerRef.current);
      }
    };
  }, []);

  // Handle app state changes
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'background' && isTracking) {
        // Ensure background tracking is active
        startBackgroundLocationTracking();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [isTracking]);

  return {
    isTracking,
    currentLocation,
    totalDistance,
    startTime,
    startTracking,
    stopTracking,
  };
}
