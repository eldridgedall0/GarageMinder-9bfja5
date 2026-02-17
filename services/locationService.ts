import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

const LOCATION_TASK_NAME = 'background-location-task';
const MOVEMENT_THRESHOLD = 10; // meters
const STATIONARY_TIMEOUT = 300000; // 5 minutes

export interface LocationPoint {
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number | null;
  speed: number | null;
  timestamp: number;
}

// Haversine formula for distance calculation
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

export function metersToMiles(meters: number): number {
  return meters * 0.000621371;
}

export function milesToMeters(miles: number): number {
  return miles / 0.000621371;
}

export async function requestLocationPermissions(): Promise<boolean> {
  const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
  
  if (foregroundStatus !== 'granted') {
    return false;
  }

  if (Platform.OS === 'android') {
    const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
    return backgroundStatus === 'granted';
  }

  return true;
}

export async function hasLocationPermissions(): Promise<boolean> {
  const { status } = await Location.getForegroundPermissionsAsync();
  return status === 'granted';
}

export async function getCurrentLocation(): Promise<LocationPoint | null> {
  try {
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      altitude: location.coords.altitude,
      accuracy: location.coords.accuracy,
      speed: location.coords.speed,
      timestamp: location.timestamp,
    };
  } catch (error) {
    console.error('Error getting current location:', error);
    return null;
  }
}

export async function startBackgroundLocationTracking(): Promise<boolean> {
  try {
    const hasPermission = await hasLocationPermissions();
    if (!hasPermission) {
      const granted = await requestLocationPermissions();
      if (!granted) {
        return false;
      }
    }

    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      accuracy: Location.Accuracy.High,
      timeInterval: 5000, // 5 seconds
      distanceInterval: 10, // 10 meters
      foregroundService: {
        notificationTitle: 'Tracking Trip',
        notificationBody: 'GarageMinder is tracking your mileage',
        notificationColor: '#FFD700',
      },
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
    });

    return true;
  } catch (error) {
    console.error('Error starting background location:', error);
    return false;
  }
}

export async function stopBackgroundLocationTracking(): Promise<void> {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
    if (isRegistered) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    }
  } catch (error) {
    console.error('Error stopping background location:', error);
  }
}

export async function isBackgroundLocationActive(): Promise<boolean> {
  try {
    return await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
  } catch {
    return false;
  }
}

// Detect if user is moving
export function isMoving(
  currentLocation: LocationPoint,
  previousLocation: LocationPoint | null
): boolean {
  if (!previousLocation) return false;

  const distance = calculateDistance(
    previousLocation.latitude,
    previousLocation.longitude,
    currentLocation.latitude,
    currentLocation.longitude
  );

  return distance > MOVEMENT_THRESHOLD;
}

// Check if stationary for grace period
export function isStationaryTimeout(lastMovementTime: number): boolean {
  return Date.now() - lastMovementTime > STATIONARY_TIMEOUT;
}

export const LOCATION_TASK_NAME_EXPORT = LOCATION_TASK_NAME;
