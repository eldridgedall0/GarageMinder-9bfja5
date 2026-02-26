import { storage } from './storageService';
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

// ============================================================================
// LOCAL STORAGE OPERATIONS (no API calls — instant, offline-safe)
// ============================================================================

/**
 * Get vehicles from local storage (the ONLY read source for UI)
 */
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

/**
 * Get a single vehicle by ID from local storage
 */
export async function getVehicle(vehicleId: string): Promise<Vehicle | null> {
  const vehicles = await getVehicles();
  return vehicles.find(v => v.id === vehicleId) || null;
}

/**
 * Get active vehicle from local storage
 */
export async function getActiveVehicle(): Promise<Vehicle | null> {
  const activeId = await storage.getItem(ACTIVE_VEHICLE_KEY);
  if (!activeId) return null;
  
  const vehicles = await getVehicles();
  return vehicles.find(v => v.id === activeId) || null;
}

/**
 * Set active vehicle (local only)
 */
export async function setActiveVehicle(vehicleId: string): Promise<void> {
  await storage.setItem(ACTIVE_VEHICLE_KEY, vehicleId);
}

/**
 * Update vehicle odometer — LOCAL ONLY, no API call.
 * The API is updated later when the user explicitly syncs.
 */
export async function updateVehicleOdometer(vehicleId: string, newOdometer: number): Promise<void> {
  const odometerInt = Math.round(newOdometer);
  
  console.log(`[VehicleService] Updating odometer locally for ${vehicleId} to ${odometerInt}`);
  
  const vehicles = await getVehicles();
  const vehicle = vehicles.find(v => v.id === vehicleId);
  
  if (!vehicle) {
    throw new Error('Vehicle not found');
  }

  vehicle.currentOdometer = odometerInt;
  await storage.setItem(VEHICLES_KEY, JSON.stringify(vehicles));
  console.log(`[VehicleService] Local odometer updated: ${vehicleId} → ${odometerInt}`);
}

/**
 * Clear local vehicle cache (on logout)
 */
export async function clearVehicleCache(): Promise<void> {
  await storage.removeItem(VEHICLES_KEY);
  await storage.removeItem(ACTIVE_VEHICLE_KEY);
}

// ============================================================================
// API OPERATIONS (only called on login or explicit sync)
// ============================================================================

/**
 * Fetch vehicles from GarageMinder API and save to local storage.
 * Called ONLY on:
 *  - Login (to pull initial vehicle list)
 *  - Explicit sync (after pushing local data first)
 */
export async function fetchVehiclesFromAPI(): Promise<Vehicle[]> {
  try {
    console.log('[VehicleService] Fetching vehicles from API...');
    
    const apiVehicles = await api.get<ApiVehicle[]>('/vehicles');
    
    if (!Array.isArray(apiVehicles)) {
      console.error('[VehicleService] Invalid API response - expected array, got:', typeof apiVehicles);
      throw new Error('Invalid vehicles data received from server');
    }
    
    console.log(`[VehicleService] Received ${apiVehicles.length} vehicles from API`);
    
    // Transform API vehicles to app Vehicle format
    const vehicles: Vehicle[] = apiVehicles.map(v => ({
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
    }));

    // Save to local storage
    await storage.setItem(VEHICLES_KEY, JSON.stringify(vehicles));
    console.log('[VehicleService] Vehicles cached locally');

    // Set first vehicle as active if none is set
    const activeVehicle = await storage.getItem(ACTIVE_VEHICLE_KEY);
    if (!activeVehicle && vehicles.length > 0) {
      await storage.setItem(ACTIVE_VEHICLE_KEY, vehicles[0].id);
    }

    return vehicles;
  } catch (error: any) {
    console.error('[VehicleService] Failed to fetch vehicles from API:', error?.message);
    
    let errorMsg = `Failed to load vehicles.\n\n`;
    if (error?.code) errorMsg += `Code: ${error.code}\n`;
    if (error?.message) errorMsg += `Message: ${error.message}\n`;
    
    const { API_CONFIG } = await import('../constants/config');
    errorMsg += `\nAPI URL: ${API_CONFIG.BASE_URL}/vehicles`;
    
    throw new Error(errorMsg);
  }
}

/**
 * SYNC: Push local odometer values to server, then pull fresh data back.
 * This is the ONLY time we talk to the API after login.
 * 
 * Flow:
 *  1. Read local vehicles
 *  2. POST /sync/push with all odometer values  
 *  3. GET /vehicles to pull any changes from web app
 *  4. Save pulled data to local storage
 *  5. Return merged vehicles
 */
export async function syncVehicles(): Promise<Vehicle[]> {
  // Step 1: Read local data
  const localVehicles = await getVehicles();
  
  // Step 2: Push local odometers to server
  if (localVehicles.length > 0) {
    try {
      const pushPayload = {
        vehicles: localVehicles.map(v => ({
          id: v.id,
          odometer: Math.round(v.currentOdometer),
        })),
      };
      
      console.log('[VehicleService] Sync push:', pushPayload.vehicles.length, 'vehicles');
      const pushResult = await api.post('/sync/push', pushPayload);
      console.log('[VehicleService] Sync push result:', pushResult);
    } catch (pushError: any) {
      console.error('[VehicleService] Sync push failed:', pushError?.message);
      // Don't throw — still try to pull fresh data
    }
  }

  // Step 3 & 4: Pull fresh data from server (also saves to local storage)
  const freshVehicles = await fetchVehiclesFromAPI();
  
  console.log(`[VehicleService] Sync complete: ${freshVehicles.length} vehicles`);
  return freshVehicles;
}

/**
 * SYNC with discrepancy detection.
 * Pushes local odometers to server, then pulls fresh data to compare.
 * If the server odometer is higher than what we're pushing (e.g. web app was updated),
 * returns discrepancy info so the UI can prompt the user.
 * 
 * @param localOdometers Map of vehicleId → local odometer value to push
 */
export async function syncVehiclesWithDiscrepancyCheck(
  localOdometers: Map<string, number>
): Promise<{
  vehicles: Vehicle[];
  discrepancies: Array<{
    vehicleId: string;
    vehicleName: string;
    localOdometer: number;
    serverOdometer: number;
  }>;
}> {
  const discrepancies: Array<{
    vehicleId: string;
    vehicleName: string;
    localOdometer: number;
    serverOdometer: number;
  }> = [];

  // Step 1: Fetch current server state BEFORE pushing (to detect discrepancies)
  let serverVehiclesBefore: Vehicle[] = [];
  try {
    const apiVehicles = await api.get<any[]>('/vehicles');
    if (Array.isArray(apiVehicles)) {
      serverVehiclesBefore = apiVehicles.map(v => ({
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
      }));
    }
  } catch (err: any) {
    console.warn('[VehicleService] Could not fetch server vehicles for discrepancy check:', err?.message);
  }

  // Step 2: Check for discrepancies — server odometer differs from local
  for (const [vehicleId, localOdo] of localOdometers) {
    const serverVehicle = serverVehiclesBefore.find(v => v.id === vehicleId);
    if (serverVehicle) {
      const serverOdo = serverVehicle.currentOdometer;
      // Discrepancy: server is higher than local (web app was updated independently)
      // OR server is significantly lower than local (unusual but worth flagging)
      if (serverOdo > localOdo) {
        discrepancies.push({
          vehicleId,
          vehicleName: serverVehicle.displayName || `${serverVehicle.year} ${serverVehicle.make} ${serverVehicle.model}`,
          localOdometer: localOdo,
          serverOdometer: serverOdo,
        });
      }
    }
  }

  // Step 3: If no discrepancies where server > local, push local values
  // If there ARE discrepancies, still push — only the vehicles without discrepancies
  // (Vehicles with discrepancies will be handled by user choice in the UI)
  const vehiclesToPush = Array.from(localOdometers.entries())
    .filter(([id]) => !discrepancies.find(d => d.vehicleId === id))
    .map(([id, odometer]) => ({ id, odometer }));

  if (vehiclesToPush.length > 0) {
    try {
      const pushPayload = { vehicles: vehiclesToPush };
      console.log('[VehicleService] Sync push (non-discrepant):', vehiclesToPush.length, 'vehicles');
      const pushResult = await api.post('/sync/push', pushPayload);
      console.log('[VehicleService] Sync push result:', pushResult);
    } catch (pushError: any) {
      console.error('[VehicleService] Sync push failed:', pushError?.message);
      throw pushError;
    }
  }

  // Step 4: Pull fresh data and update local cache
  const freshVehicles = await fetchVehiclesFromAPI();

  return { vehicles: freshVehicles, discrepancies };
}

/**
 * Force-push a specific odometer value to the server for a vehicle.
 * Used when user resolves a discrepancy by choosing the local value.
 */
export async function forceUpdateOdometerOnServer(vehicleId: string, odometer: number): Promise<void> {
  try {
    console.log(`[VehicleService] Force-pushing odometer for ${vehicleId}: ${odometer}`);
    await api.put(`/vehicles/${vehicleId}/odometer`, { odometer: Math.round(odometer) });
    console.log(`[VehicleService] Force-push successful`);
  } catch (error: any) {
    console.error('[VehicleService] Force-push failed:', error?.message);
    throw error;
  }
}

/**
 * Accept the server's odometer value for a vehicle (update local to match server).
 */
export async function acceptServerOdometer(vehicleId: string, serverOdometer: number): Promise<void> {
  await updateVehicleOdometer(vehicleId, serverOdometer);
  console.log(`[VehicleService] Accepted server odometer for ${vehicleId}: ${serverOdometer}`);
}