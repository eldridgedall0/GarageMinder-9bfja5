import { useState, useEffect, useCallback } from 'react';
import { Vehicle } from '../types/trip';
import { 
  getVehicles, 
  getActiveVehicle, 
  setActiveVehicle as setActiveVehicleService,
  fetchVehiclesFromAPI,
  syncVehicles 
} from '../services/vehicleService';

export function useVehicles() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [activeVehicle, setActiveVehicleState] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);

  const loadVehicles = useCallback(async () => {
    console.log('[useVehicles] Loading vehicles from cache...');
    setLoading(true);
    const allVehicles = await getVehicles();
    const active = await getActiveVehicle();
    console.log(`[useVehicles] Loaded ${allVehicles.length} vehicles from cache`);
    setVehicles(allVehicles);
    setActiveVehicleState(active);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadVehicles();
  }, [loadVehicles]);

  const switchVehicle = async (vehicleId: string) => {
    await setActiveVehicleService(vehicleId);
    const vehicle = vehicles.find(v => v.id === vehicleId) || null;
    setActiveVehicleState(vehicle);
  };

  const fetchFromAPI = useCallback(async () => {
    console.log('[useVehicles] Fetching vehicles from API...');
    setLoading(true);
    try {
      const freshVehicles = await fetchVehiclesFromAPI();
      console.log(`[useVehicles] API returned ${freshVehicles.length} vehicles`);
      await loadVehicles(); // Reload from cache after API fetch
    } catch (error) {
      console.error('[useVehicles] Failed to fetch vehicles from API:', error);
      // Still load cached vehicles on error
      await loadVehicles();
      throw error; // Re-throw so caller knows it failed
    }
  }, [loadVehicles]);

  const sync = useCallback(async () => {
    setLoading(true);
    try {
      const synced = await syncVehicles();
      setVehicles(synced);
      const active = await getActiveVehicle();
      setActiveVehicleState(active);
    } catch (error) {
      console.error('Failed to sync vehicles:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    vehicles,
    activeVehicle,
    loading,
    switchVehicle,
    refreshVehicles: loadVehicles,
    fetchFromAPI,
    syncVehicles: sync,
  };
}
