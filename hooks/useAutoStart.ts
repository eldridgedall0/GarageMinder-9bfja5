/**
 * useAutoStart.ts
 *
 * Manages the AutoStart state machine:
 * IDLE → MONITORING → TRACKING → STOPPING → IDLE
 *
 * Uses the native ExpoBluetoothClassic module for real-time
 * Classic Bluetooth connection events (ACL_CONNECTED/DISCONNECTED).
 * Falls back to BLE polling if native module is unavailable.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import {
  startMonitoring,
  getBluetoothState,
  isNativeBluetoothAvailable,
} from '../services/bluetoothConnectionService';
import {
  getAutoStartSettings,
  updateAutoStartSettings,
  getDeviceMappings,
  getAutoStartState,
  setAutoStartState,
  resetAutoStartState,
  AutoStartSettings,
  BluetoothDeviceMapping,
  AutoStartState,
} from '../services/bluetoothService';

interface UseAutoStartOptions {
  onTriggerStart: (vehicleId: string) => Promise<void>;
  onTriggerStop: () => Promise<void>;
}

const DEFAULT_RESET_STATE: AutoStartState = {
  phase: 'idle',
  connectedDeviceId: null,
  monitoringStartedAt: null,
  stopTimerStartedAt: null,
  triggeredVehicleId: null,
};

export function useAutoStart({ onTriggerStart, onTriggerStop }: UseAutoStartOptions) {
  const [settings, setSettings] = useState<AutoStartSettings | null>(null);
  const [mappings, setMappings] = useState<BluetoothDeviceMapping[]>([]);
  const [state, setState] = useState<AutoStartState | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isNativeAvailable, setIsNativeAvailable] = useState(false);

  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  // ── Load settings on mount ──────────────────────────────────────────────────
  useEffect(() => {
    loadAll();
    setIsNativeAvailable(isNativeBluetoothAvailable());
  }, []);

  // ── Re-check when app comes to foreground ──────────────────────────────────
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        loadAll();
      }
    });
    return () => subscription.remove();
  }, []);

  const loadAll = async () => {
    const [s, m, st] = await Promise.all([
      getAutoStartSettings(),
      getDeviceMappings(),
      getAutoStartState(),
    ]);
    setSettings(s);
    setMappings(m);
    setState(st);
    setIsLoaded(true);
  };

  const refreshSettings = useCallback(async () => {
    const s = await getAutoStartSettings();
    setSettings(s);
    return s;
  }, []);

  const refreshMappings = useCallback(async () => {
    const m = await getDeviceMappings();
    setMappings(m);
    return m;
  }, []);

  const updateSettings = useCallback(async (partial: Partial<AutoStartSettings>) => {
    const updated = await updateAutoStartSettings(partial);
    setSettings(updated);
    return updated;
  }, []);

  // ── Bluetooth Connection Monitoring ────────────────────────────────────────
  useEffect(() => {
    if (!isLoaded || !settings?.enabled) {
      // Clean up if disabled
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
      return;
    }

    const enabledMappings = mappings.filter(m => m.enabled && m.vehicleId);
    if (enabledMappings.length === 0) return;

    const nativeLabel = isNativeAvailable ? 'Native Classic BT' : 'BLE fallback';
    console.log(`[AutoStart] Starting monitoring (${nativeLabel}) for ${enabledMappings.length} device(s)`);

    // Start monitoring — uses native ACL events or BLE polling
    const cleanup = startMonitoring(
      // On device connected
      async (mapping) => {
        console.log('[AutoStart] Device connected:', mapping.deviceName, '→', mapping.vehicleName);
        const currentState = await getAutoStartState();

        // If already tracking, ignore
        if (currentState.phase === 'tracking') return;

        // If in stopping phase (grace period), cancel the stop timer
        if (currentState.phase === 'stopping') {
          console.log('[AutoStart] Reconnected during stop grace period — cancelling stop');
          await cancelStop();
          return;
        }

        // Transition to monitoring → tracking
        const newState: AutoStartState = {
          phase: 'monitoring',
          connectedDeviceId: mapping.deviceId,
          monitoringStartedAt: Date.now(),
          stopTimerStartedAt: null,
          triggeredVehicleId: mapping.vehicleId,
        };
        await setAutoStartState(newState);
        setState(newState);

        // Start tracking (speed threshold handled in trip tracking)
        await handleStartTracking(mapping.vehicleId, newState);
      },
      // On device disconnected
      async (mapping) => {
        console.log('[AutoStart] Device disconnected:', mapping.deviceName);
        await handleBluetoothDisconnect();
      }
    );

    cleanupRef.current = cleanup;

    return () => {
      console.log('[AutoStart] Stopping monitoring');
      cleanup();
      cleanupRef.current = null;
    };
  }, [isLoaded, settings?.enabled, mappings]);

  // Clean up stop timer on unmount
  useEffect(() => {
    return () => {
      if (stopTimerRef.current) {
        clearTimeout(stopTimerRef.current);
      }
    };
  }, []);

  // ── Manually trigger start (for testing AutoStart without BT) ──────────────
  const simulateBluetoothConnect = useCallback(async (vehicleId: string) => {
    const newState: AutoStartState = {
      phase: 'monitoring',
      connectedDeviceId: 'simulated',
      monitoringStartedAt: Date.now(),
      stopTimerStartedAt: null,
      triggeredVehicleId: vehicleId,
    };
    await setAutoStartState(newState);
    setState(newState);
    await handleStartTracking(vehicleId, newState);
  }, [onTriggerStart]);

  const simulateBluetoothDisconnect = useCallback(async () => {
    await handleBluetoothDisconnect();
  }, []);

  // ── Internal state transitions ─────────────────────────────────────────────

  const handleStartTracking = async (vehicleId: string, currentState: AutoStartState) => {
    const newState: AutoStartState = {
      ...currentState,
      phase: 'tracking',
    };
    await setAutoStartState(newState);
    setState(newState);

    try {
      await onTriggerStart(vehicleId);
    } catch (error) {
      console.error('[AutoStart] Failed to start trip:', error);
      await resetAutoStartState();
      setState({ ...DEFAULT_RESET_STATE });
    }
  };

  const handleBluetoothDisconnect = async () => {
    const currentState = await getAutoStartState();
    if (currentState.phase !== 'tracking') return;

    const currentSettings = await getAutoStartSettings();
    const stopState: AutoStartState = {
      ...currentState,
      phase: 'stopping',
      stopTimerStartedAt: Date.now(),
    };
    await setAutoStartState(stopState);
    setState(stopState);

    console.log(`[AutoStart] Starting ${currentSettings.stopTimeoutMinutes}min stop grace period`);

    // Start the stop grace period timer
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    stopTimerRef.current = setTimeout(async () => {
      await finalizeStop();
    }, currentSettings.stopTimeoutMinutes * 60 * 1000);
  };

  const finalizeStop = async () => {
    console.log('[AutoStart] Grace period expired — stopping trip');
    try {
      await onTriggerStop();
    } catch (error) {
      console.error('[AutoStart] Failed to stop trip:', error);
    }
    await resetAutoStartState();
    setState({ ...DEFAULT_RESET_STATE });
  };

  const cancelStop = async () => {
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    const currentState = await getAutoStartState();
    const resumeState: AutoStartState = {
      ...currentState,
      phase: 'tracking',
      stopTimerStartedAt: null,
    };
    await setAutoStartState(resumeState);
    setState(resumeState);
  };

  return {
    settings,
    mappings,
    state,
    isLoaded,
    isNativeAvailable,
    updateSettings,
    refreshSettings,
    refreshMappings,
    simulateBluetoothConnect,
    simulateBluetoothDisconnect,
  };
}
