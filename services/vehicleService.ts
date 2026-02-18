import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './apiClient';
import { Vehicle } from '../types/trip';

const VEHICLES_KEY = '@garageminder_vehicles';
const ACTIVE_VEHICLE_KEY = '@garageminder_active_vehicle';

// API Vehicle Response Interface (from API documentation)
interface ApiVehicle {
  id: string;
  user_id: string;
  name: string;
  display_name: string;
  vin: string | null;
  plate: string | null;
  year: number;
  make: string;
  model: string;
  engine: string | null;
  body_class: string | null;
  odometer: number;
  photo_path: string | null;
  insurance_expiry: string | null;
  registration_expiry: string | null;
}

/**
 * Fetch vehicles from GarageMinder API
 */
export async function fetchVehiclesFromAPI(): Promise<Vehicle[]> {
  try {
    console.log('[VehicleService] Fetching vehicles from API...');
    
    // API response structure: { success: true, data: [...vehicles] }
    // The api.get() method already extracts the 'data' field
    const apiVehicles = await api.get<ApiVehicle[]>('/vehicles');
    
    console.log('[VehicleService] API response:', apiVehicles);
    
    // Check if response is an array
    if (!Array.isArray(apiVehicles)) {
      console.error('[VehicleService] Invalid API response - expected array, got:', typeof apiVehicles);
      throw new Error('Invalid vehicles data received from server');
    }
    
    console.log(`[VehicleService] Received ${apiVehicles.length} vehicles from API`);
    
    // Transform API vehicles to app Vehicle format
    const vehicles: Vehicle[] = apiVehicles.map(v => {
      console.log('[VehicleService] Processing vehicle:', v.id, v.year, v.make, v.model);
      return {
        id: v.id,
        year: v.year,
        make: v.make,
        model: v.model,
        trim: v.engine || undefined,
        currentOdometer: v.odometer,
        userId: v.user_id,
        displayName: v.display_name || `${v.year} ${v.make} ${v.model}`,
        vin: v.vin || undefined,
        plate: v.plate || undefined,
        photoPath: v.photo_path || undefined,
        createdAt: new Date(),
      };
    });

    console.log(`[VehicleService] Transformed ${vehicles.length} vehicles`);

    // Cache vehicles locally
    await AsyncStorage.setItem(VEHICLES_KEY, JSON.stringify(vehicles));
    console.log('[VehicleService] Vehicles cached successfully');

    // Set first vehicle as active if none is set
    const activeVehicle = await AsyncStorage.getItem(ACTIVE_VEHICLE_KEY);
    if (!activeVehicle && vehicles.length > 0) {
      await AsyncStorage.setItem(ACTIVE_VEHICLE_KEY, vehicles[0].id);
      console.log('[VehicleService] Set active vehicle:', vehicles[0].id);
    }

    return vehicles;
  } catch (error: any) {
    console.error('[VehicleService] Failed to fetch vehicles from API');
    console.error('[VehicleService] Error type:', error?.name);
    console.error('[VehicleService] Error code:', error?.code);
    console.error('[VehicleService] Error message:', error?.message);
    console.error('[VehicleService] Error details:', error?.details);
    console.error('[VehicleService] Full error:', error);
    
    // Provide user-friendly error messages
    if (error?.code === 'TOKEN_EXPIRED') {
      throw new Error('Your session has expired. Please log in again.');
    } else if (error?.code === 'NETWORK_ERROR') {
      throw new Error('Network error. Please check your internet connection.');
    } else if (error?.code === 'UNAUTHORIZED') {
      throw new Error('Authentication failed. Please log in again.');
    } else {
      throw new Error(error?.message || 'Failed to load vehicles. Please try again.');
    }
  }
}

/**
 * Get vehicles from local storage (cached)
 */
export async function getVehicles(): Promise<Vehicle[]> {
  const data = await AsyncStorage.getItem(VEHICLES_KEY);
  if (!data) return [];
  
  return JSON.parse(data, (key, value) => {
    if (key === 'createdAt') {
      return new Date(value);
    }
    return value;
  });
}

/**
 * Get a single vehicle by ID
 */
export async function getVehicle(vehicleId: string): Promise<Vehicle | null> {
  const vehicles = await getVehicles();
  return vehicles.find(v => v.id === vehicleId) || null;
}

/**
 * Get active vehicle
 */
export async function getActiveVehicle(): Promise<Vehicle | null> {
  const activeId = await AsyncStorage.getItem(ACTIVE_VEHICLE_KEY);
  if (!activeId) return null;
  
  const vehicles = await getVehicles();
  return vehicles.find(v => v.id === activeId) || null;
}

/**
 * Set active vehicle
 */
export async function setActiveVehicle(vehicleId: string): Promise<void> {
  await AsyncStorage.setItem(ACTIVE_VEHICLE_KEY, vehicleId);
}

/**
 * Update vehicle odometer reading via API
 */
export async function updateVehicleOdometer(vehicleId: string, newOdometer: number): Promise<void> {
  try {
    // Update on server
    await api.put(`/vehicles/${vehicleId}/odometer`, {
      odometer: newOdometer,
    });

    // Update local cache
    const vehicles = await getVehicles();
    const vehicle = vehicles.find(v => v.id === vehicleId);
    
    if (vehicle) {
      vehicle.currentOdometer = newOdometer;
      await AsyncStorage.setItem(VEHICLES_KEY, JSON.stringify(vehicles));
    }
  } catch (error) {
    console.error('Failed to update vehicle odometer:', error);
    throw error;
  }
}

/**
 * Sync vehicles - fetch latest from server and update local cache
 */
export async function syncVehicles(): Promise<Vehicle[]> {
  return await fetchVehiclesFromAPI();
}

/**
 * Clear local vehicle cache (on logout)
 */
export async function clearVehicleCache(): Promise<void> {
  await AsyncStorage.removeItem(VEHICLES_KEY);
  await AsyncStorage.removeItem(ACTIVE_VEHICLE_KEY);
}
