/**
 * useAutoStart.ts
 *
 * Manages the AutoStart state machine:
 * IDLE → MONITORING → TRACKING → STOPPING → IDLE
 *
 * Polls every 15 seconds (when app is foregrounded) to check
 * if any mapped Bluetooth device is connected.
 *
 * In the background, expo-task-manager handles the polling.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { startMonitoring, getBluetoothState } from '../services/bluetoothConnectionService';
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

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load settings on mount ──────────────────────────────────────────────────
  useEffect(() => {
    loadAll();
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
    if (!isLoaded || !settings?.enabled) return;

    const enabledMappings = mappings.filter(m => m.enabled && m.vehicleId);
    if (enabledMappings.length === 0) return;

    console.log('[AutoStart] Starting Bluetooth monitoring for', enabledMappings.length, 'devices');

    // Start monitoring for connection changes
    const cleanup = startMonitoring(
      // On device connected
      async (mapping) => {
        console.log('[AutoStart] Device connected:', mapping.deviceName);
        const currentState = await getAutoStartState();
        
        // If already tracking, ignore
        if (currentState.phase === 'tracking') return;

        // If in stopping phase (grace period), cancel the stop timer
        if (currentState.phase === 'stopping') {
          await cancelStop();
          return;
        }

        // Transition to monitoring phase
        const newState: AutoStartState = {
          phase: 'monitoring',
          connectedDeviceId: mapping.deviceId,
          monitoringStartedAt: Date.now(),
          stopTimerStartedAt: null,
          triggeredVehicleId: mapping.vehicleId,
        };
        await setAutoStartState(newState);
        setState(newState);

        // For now, immediately start tracking (speed threshold will be handled in trip tracking)
        await handleStartTracking(mapping.vehicleId, newState);
      },
      // On device disconnected
      async (mapping) => {
        console.log('[AutoStart] Device disconnected:', mapping.deviceName);
        await handleBluetoothDisconnect();
      }
    );

    return () => {
      console.log('[AutoStart] Stopping Bluetooth monitoring');
      cleanup();
    };
  }, [isLoaded, settings?.enabled, mappings]);

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
    // Immediately transition to tracking (simulated — no speed threshold needed for test)
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
    await onTriggerStart(vehicleId);
  };

  const handleBluetoothDisconnect = async () => {
    const currentState = await getAutoStartState();
    if (currentState.phase !== 'tracking') return;

    const settings = await getAutoStartSettings();
    const stopState: AutoStartState = {
      ...currentState,
      phase: 'stopping',
      stopTimerStartedAt: Date.now(),
    };
    await setAutoStartState(stopState);
    setState(stopState);

    // Start the stop grace period timer
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    stopTimerRef.current = setTimeout(async () => {
      await finalizeStop();
    }, settings.stopTimeoutMinutes * 60 * 1000);
  };

  const finalizeStop = async () => {
    await onTriggerStop();
    await resetAutoStartState();
    setState({ ...DEFAULT_RESET_STATE });
  };

  const cancelStop = async () => {
    // BT reconnected during grace period — cancel stop timer
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    const currentState = await getAutoStartState();
    const resumeState: AutoStartState = { ...currentState, phase: 'tracking', stopTimerStartedAt: null };
    await setAutoStartState(resumeState);
    setState(resumeState);
  };

  return {
    settings,
    mappings,
    state,
    isLoaded,
    updateSettings,
    refreshSettings,
    refreshMappings,
    simulateBluetoothConnect,
    simulateBluetoothDisconnect,
  };
}
