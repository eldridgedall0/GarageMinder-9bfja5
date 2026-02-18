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
    setLoading(true);
    const allVehicles = await getVehicles();
    const active = await getActiveVehicle();
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
    setLoading(true);
    try {
      await fetchVehiclesFromAPI();
      await loadVehicles();
    } catch (error) {
      console.error('Failed to fetch vehicles from API:', error);
      // Still load cached vehicles on error
      await loadVehicles();
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
