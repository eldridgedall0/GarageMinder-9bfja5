import { useState, useEffect, useCallback } from 'react';
import { Vehicle } from '../types/trip';
import { getVehicles, getActiveVehicle, setActiveVehicle as setActiveVehicleService } from '../services/tripService';

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

  return {
    vehicles,
    activeVehicle,
    loading,
    switchVehicle,
    refreshVehicles: loadVehicles,
  };
}
