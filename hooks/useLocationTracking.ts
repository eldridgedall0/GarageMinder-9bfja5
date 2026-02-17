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
  
  const previousLocationRef = useRef<LocationPoint | null>(null);
  const lastMovementTimeRef = useRef<number>(Date.now());
  const startGraceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const stopGraceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const locationSubscriptionRef = useRef<Location.LocationSubscription | null>(null);

  // Start tracking
  const startTracking = useCallback(async (vehicleName: string) => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    
    if (status !== 'granted') {
      return false;
    }

    setIsTracking(true);
    setTotalDistance(0);
    setStartTime(Date.now());
    previousLocationRef.current = null;
    lastMovementTimeRef.current = Date.now();

    // Show notification
    await showTripStartedNotification(vehicleName);

    // Start with grace period - wait for movement
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

  // Handle location updates
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

      // Check if moving
      if (isMoving(location, previous)) {
        lastMovementTimeRef.current = Date.now();
        
        // Clear stop grace timer if exists
        if (stopGraceTimerRef.current) {
          clearTimeout(stopGraceTimerRef.current);
          stopGraceTimerRef.current = null;
        }

        // Add distance
        setTotalDistance(prev => {
          const newTotal = prev + distance;
          onLocationUpdate?.(location, newTotal);
          return newTotal;
        });
      } else {
        // Not moving - check for stop grace period
        if (!stopGraceTimerRef.current) {
          stopGraceTimerRef.current = setTimeout(() => {
            if (isStationaryTimeout(lastMovementTimeRef.current)) {
              // Auto-stop trip
              stopTracking();
            }
          }, STOP_GRACE_PERIOD);
        }
      }
    }

    previousLocationRef.current = location;
  }, [onLocationUpdate]);

  // Stop tracking
  const stopTracking = useCallback(async () => {
    if (!isTracking) return;

    const duration = startTime ? Date.now() - startTime : 0;
    const distanceMiles = metersToMiles(totalDistance);

    // Show completion notification
    await showTripCompletedNotification(distanceMiles, duration);

    // Clean up
    if (locationSubscriptionRef.current) {
      locationSubscriptionRef.current.remove();
      locationSubscriptionRef.current = null;
    }

    await stopBackgroundLocationTracking();

    if (startGraceTimerRef.current) {
      clearTimeout(startGraceTimerRef.current);
      startGraceTimerRef.current = null;
    }

    if (stopGraceTimerRef.current) {
      clearTimeout(stopGraceTimerRef.current);
      stopGraceTimerRef.current = null;
    }

    setIsTracking(false);
    
    // Notify completion
    onTripComplete?.(totalDistance, duration);

    // Reset state
    setTotalDistance(0);
    setStartTime(null);
    setCurrentLocation(null);
    previousLocationRef.current = null;
  }, [isTracking, startTime, totalDistance, onTripComplete]);

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
