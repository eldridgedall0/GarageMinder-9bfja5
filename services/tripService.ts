import { storage } from './storageService';
import { Trip, Vehicle, TripStatus } from '../types/trip';

const TRIPS_KEY = '@garageminder_trips';
const VEHICLES_KEY = '@garageminder_vehicles';
const ACTIVE_TRIP_KEY = '@garageminder_active_trip';
const ACTIVE_VEHICLE_KEY = '@garageminder_active_vehicle';

// Initialize storage (no longer creates demo vehicle - vehicles come from API)
export async function initializeStorage(): Promise<void> {
  // Just initialize storage, vehicles will be fetched from API after login
  const existingTrips = await getTrips();
  if (!existingTrips) {
    await storage.setItem(TRIPS_KEY, JSON.stringify([]));
  }
}

// Trip operations
export async function getTrips(): Promise<Trip[]> {
  const data = await storage.getItem(TRIPS_KEY);
  if (!data) return [];
  
  return JSON.parse(data, (key, value) => {
    if (key === 'startTime' || key === 'endTime' || key === 'syncedAt' || key === 'createdAt' || key === 'updatedAt') {
      return value ? new Date(value) : null;
    }
    return value;
  });
}

export async function saveTrip(trip: Trip): Promise<void> {
  const trips = await getTrips();
  const index = trips.findIndex(t => t.id === trip.id);
  
  if (index >= 0) {
    trips[index] = { ...trip, updatedAt: new Date() };
  } else {
    trips.push(trip);
  }
  
  await storage.setItem(TRIPS_KEY, JSON.stringify(trips));
}

export async function deleteTrip(tripId: string): Promise<void> {
  const trips = await getTrips();
  const filtered = trips.filter(t => t.id !== tripId);
  await AsyncStorage.setItem(TRIPS_KEY, JSON.stringify(filtered));
}

export async function getActiveTrip(): Promise<Trip | null> {
  const data = await storage.getItem(ACTIVE_TRIP_KEY);
  if (!data) return null;
  
  return JSON.parse(data, (key, value) => {
    if (key === 'startTime' || key === 'endTime' || key === 'syncedAt' || key === 'createdAt' || key === 'updatedAt') {
      return value ? new Date(value) : null;
    }
    return value;
  });
}

export async function setActiveTrip(trip: Trip | null): Promise<void> {
  if (trip) {
    await storage.setItem(ACTIVE_TRIP_KEY, JSON.stringify(trip));
  } else {
    await storage.removeItem(ACTIVE_TRIP_KEY);
  }
}

// Vehicle operations - DEPRECATED: Use vehicleService.ts instead
// These are kept for backward compatibility only
export async function getVehicles(): Promise<Vehicle[]> {
  const data = await storage.getItem(VEHICLES_KEY);
  if (!data) return [];
  
  return JSON.parse(data, (key, value) => {
    if (key === 'createdAt') {
      return new Date(value);
    }
    return value;
  });
}

export async function updateVehicleOdometer(vehicleId: string, newOdometer: number): Promise<void> {
  const vehicles = await getVehicles();
  const vehicle = vehicles.find(v => v.id === vehicleId);
  
  if (vehicle) {
    vehicle.currentOdometer = newOdometer;
    await storage.setItem(VEHICLES_KEY, JSON.stringify(vehicles));
  }
}

export async function getActiveVehicle(): Promise<Vehicle | null> {
  const activeId = await storage.getItem(ACTIVE_VEHICLE_KEY);
  if (!activeId) return null;
  
  const vehicles = await getVehicles();
  return vehicles.find(v => v.id === activeId) || null;
}

export async function setActiveVehicle(vehicleId: string): Promise<void> {
  await storage.setItem(ACTIVE_VEHICLE_KEY, vehicleId);
}

// Simulated sync
export async function syncTrips(tripIds: string[]): Promise<{ success: boolean; synced: number }> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const trips = await getTrips();
  let syncedCount = 0;
  
  for (const tripId of tripIds) {
    const trip = trips.find(t => t.id === tripId);
    if (trip && trip.status !== 'active') {
      trip.status = 'synced';
      trip.syncedAt = new Date();
      await saveTrip(trip);
      syncedCount++;
    }
  }
  
  return { success: true, synced: syncedCount };
}

// Calculate distance (simulated GPS)
export function calculateDistance(startOdometer: number, durationMs: number): number {
  // Simulate average 30 mph = 0.008333 miles per second
  const averageSpeed = 0.008333;
  const seconds = durationMs / 1000;
  return Number((seconds * averageSpeed).toFixed(2));
}
