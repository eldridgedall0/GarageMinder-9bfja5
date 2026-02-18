/**
 * bluetoothService.ts
 *
 * Handles Bluetooth device scanning, connection detection,
 * and device-to-vehicle mapping for AutoStart trip tracking.
 *
 * IMPORTANT: Car audio systems use Classic Bluetooth (not BLE).
 * react-native-ble-plx handles BLE. For Classic BT connection
 * detection, we use a polling approach via AppState + background fetch
 * since React Native has no direct Classic BT connection event listener.
 *
 * For devices that appear during BLE scan (some cars expose BLE),
 * we can use ble-plx directly. For Classic-only devices, the user
 * manually selects from their system-paired device list by name.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, NativeModules } from 'react-native';

// ─── Storage Keys ─────────────────────────────────────────────────────────────

const AUTOSTART_SETTINGS_KEY = '@garageminder_autostart_settings';
const BT_DEVICE_MAPPINGS_KEY = '@garageminder_bt_mappings';
const AUTOSTART_STATE_KEY = '@garageminder_autostart_state';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AutoStartSettings {
  enabled: boolean;
  speedThreshold: SpeedThreshold;        // mph before trip starts
  detectionWindowMinutes: number;         // how long to watch for movement after BT connects
  stopTimeoutMinutes: number;             // grace period after BT disconnects before ending trip
  showMonitoringNotification: boolean;    // silent notification while monitoring
  showEditAfterTrip: boolean;             // show trip review sheet after auto-stop
  tripClassification: TripClassification; // default classification for auto-tracked trips
}

export type SpeedThreshold = 'immediate' | 3 | 5 | 10 | 15; // mph

export type TripClassification = 'personal' | 'business' | 'ask';

export interface BluetoothDeviceMapping {
  deviceId: string;         // Bluetooth MAC address or system ID (string)
  deviceName: string;       // Human-readable device name e.g. "Toyota Audio"
  vehicleId: string;        // GarageMinder vehicle ID this device triggers
  vehicleName: string;      // Cached vehicle display name for UI
  enabled: boolean;         // Whether this mapping is active
  addedAt: number;          // Timestamp
}

export interface AutoStartState {
  phase: 'idle' | 'monitoring' | 'tracking' | 'stopping';
  connectedDeviceId: string | null;      // Currently connected mapped device
  monitoringStartedAt: number | null;    // When monitoring phase began
  stopTimerStartedAt: number | null;     // When stop grace period began
  triggeredVehicleId: string | null;     // Which vehicle was triggered
}

// ─── Default Values ───────────────────────────────────────────────────────────

const DEFAULT_AUTOSTART_SETTINGS: AutoStartSettings = {
  enabled: false,
  speedThreshold: 5,
  detectionWindowMinutes: 15,
  stopTimeoutMinutes: 5,
  showMonitoringNotification: false,
  showEditAfterTrip: true,
  tripClassification: 'ask',
};

const DEFAULT_AUTOSTART_STATE: AutoStartState = {
  phase: 'idle',
  connectedDeviceId: null,
  monitoringStartedAt: null,
  stopTimerStartedAt: null,
  triggeredVehicleId: null,
};

// ─── AutoStart Settings ───────────────────────────────────────────────────────

export async function getAutoStartSettings(): Promise<AutoStartSettings> {
  try {
    const data = await AsyncStorage.getItem(AUTOSTART_SETTINGS_KEY);
    if (!data) return DEFAULT_AUTOSTART_SETTINGS;
    return { ...DEFAULT_AUTOSTART_SETTINGS, ...JSON.parse(data) };
  } catch {
    return DEFAULT_AUTOSTART_SETTINGS;
  }
}

export async function updateAutoStartSettings(
  partial: Partial<AutoStartSettings>
): Promise<AutoStartSettings> {
  const current = await getAutoStartSettings();
  const updated = { ...current, ...partial };
  await AsyncStorage.setItem(AUTOSTART_SETTINGS_KEY, JSON.stringify(updated));
  return updated;
}

// ─── Device-to-Vehicle Mappings ───────────────────────────────────────────────

export async function getDeviceMappings(): Promise<BluetoothDeviceMapping[]> {
  try {
    const data = await AsyncStorage.getItem(BT_DEVICE_MAPPINGS_KEY);
    if (!data) return [];
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export async function addDeviceMapping(
  mapping: Omit<BluetoothDeviceMapping, 'addedAt'>
): Promise<void> {
  const mappings = await getDeviceMappings();
  // Remove any existing mapping for this device
  const filtered = mappings.filter(m => m.deviceId !== mapping.deviceId);
  filtered.push({ ...mapping, addedAt: Date.now() });
  await AsyncStorage.setItem(BT_DEVICE_MAPPINGS_KEY, JSON.stringify(filtered));
}

export async function removeDeviceMapping(deviceId: string): Promise<void> {
  const mappings = await getDeviceMappings();
  const filtered = mappings.filter(m => m.deviceId !== deviceId);
  await AsyncStorage.setItem(BT_DEVICE_MAPPINGS_KEY, JSON.stringify(filtered));
}

export async function updateDeviceMapping(
  deviceId: string,
  partial: Partial<BluetoothDeviceMapping>
): Promise<void> {
  const mappings = await getDeviceMappings();
  const updated = mappings.map(m =>
    m.deviceId === deviceId ? { ...m, ...partial } : m
  );
  await AsyncStorage.setItem(BT_DEVICE_MAPPINGS_KEY, JSON.stringify(updated));
}

export async function getMappingForDevice(
  deviceId: string
): Promise<BluetoothDeviceMapping | null> {
  const mappings = await getDeviceMappings();
  return mappings.find(m => m.deviceId === deviceId && m.enabled) || null;
}

// ─── AutoStart Phase State ────────────────────────────────────────────────────

export async function getAutoStartState(): Promise<AutoStartState> {
  try {
    const data = await AsyncStorage.getItem(AUTOSTART_STATE_KEY);
    if (!data) return DEFAULT_AUTOSTART_STATE;
    return JSON.parse(data);
  } catch {
    return DEFAULT_AUTOSTART_STATE;
  }
}

export async function setAutoStartState(state: AutoStartState): Promise<void> {
  await AsyncStorage.setItem(AUTOSTART_STATE_KEY, JSON.stringify(state));
}

export async function resetAutoStartState(): Promise<void> {
  await AsyncStorage.setItem(
    AUTOSTART_STATE_KEY,
    JSON.stringify(DEFAULT_AUTOSTART_STATE)
  );
}

// ─── Simulated Paired Device List ─────────────────────────────────────────────
//
// React Native cannot directly list system-paired Classic Bluetooth devices
// without a native module. We provide a manual "add device" flow where the user
// types or selects their device name, plus a BLE scan for discoverable devices.
// The deviceId for manually-added devices uses the device name as a stable key.

export interface DiscoveredDevice {
  id: string;
  name: string;
  rssi?: number;
  isManuallyAdded?: boolean;
}

/**
 * Returns manually-added devices from mappings (since we can't list
 * system-paired Classic BT devices without native code).
 * In a future native build, replace this with actual paired device enumeration.
 */
export async function getKnownDevices(): Promise<DiscoveredDevice[]> {
  const mappings = await getDeviceMappings();
  return mappings.map(m => ({
    id: m.deviceId,
    name: m.deviceName,
    isManuallyAdded: true,
  }));
}

/**
 * Creates a stable device ID from a device name.
 * Used for manually-added Classic BT devices.
 */
export function createDeviceIdFromName(deviceName: string): string {
  return `manual_${deviceName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
}

// ─── Connection Detection (Polling-Based) ─────────────────────────────────────
//
// Since we cannot receive Classic BT ACL_CONNECTED events in React Native,
// we detect connection changes by checking device availability on a poll interval.
// BLE devices can be checked via ble-plx scan. Classic-only devices rely on
// the user's report of their device name being "currently connected."
//
// In a production native build, this would be replaced with a proper
// BroadcastReceiver (Android) or CoreBluetooth (iOS) implementation.

export async function checkIfDeviceConnected(deviceId: string): Promise<boolean> {
  // For manually-added devices, we rely on background task polling.
  // Return false by default — the background task manages actual state transitions.
  // This is a placeholder for future native BT detection.
  return false;
}

// ─── BLE Scanning ─────────────────────────────────────────────────────────────

import { BleManager, Device, State } from 'react-native-ble-plx';

// Singleton BLE manager — only created when needed
let bleManager: BleManager | null = null;

function getBleManager(): BleManager {
  if (!bleManager) {
    bleManager = new BleManager();
  }
  return bleManager;
}

export interface ScannedDevice {
  id: string;
  name: string;
  rssi: number;
  isAlreadyMapped: boolean;
}

/**
 * Scan for nearby BLE devices for specified duration.
 * Returns unique devices with names (unnamed devices are filtered out).
 * Caller is responsible for calling stopScan() or this resolves automatically.
 */
export async function scanForBluetoothDevices(
  onDeviceFound: (device: ScannedDevice) => void,
  durationMs: number = 8000
): Promise<void> {
  const manager = getBleManager();
  const found = new Map<string, ScannedDevice>();

  // Check BT state first
  const state = await manager.state();
  if (state !== State.PoweredOn) {
    throw new Error(
      state === State.PoweredOff
        ? 'Bluetooth is turned off. Please enable Bluetooth and try again.'
        : 'Bluetooth is not available on this device.'
    );
  }

  const existingMappings = await getDeviceMappings();
  const mappedIds = new Set(existingMappings.map(m => m.deviceId));

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      manager.stopDeviceScan();
      resolve();
    }, durationMs);

    manager.startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
      if (error) {
        clearTimeout(timer);
        manager.stopDeviceScan();
        reject(new Error(error.message));
        return;
      }

      if (device && device.name && !found.has(device.id)) {
        const scanned: ScannedDevice = {
          id: device.id,
          name: device.name,
          rssi: device.rssi ?? -100,
          isAlreadyMapped: mappedIds.has(device.id),
        };
        found.set(device.id, scanned);
        onDeviceFound(scanned);
      }
    });
  });
}

export function stopBluetoothScan(): void {
  bleManager?.stopDeviceScan();
}

export async function getBluetoothState(): Promise<'on' | 'off' | 'unavailable'> {
  try {
    const manager = getBleManager();
    const state = await manager.state();
    if (state === State.PoweredOn) return 'on';
    if (state === State.PoweredOff) return 'off';
    return 'unavailable';
  } catch {
    return 'unavailable';
  }
}
