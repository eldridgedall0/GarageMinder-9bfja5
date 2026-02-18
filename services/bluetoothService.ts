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
import { Platform, NativeEventEmitter, NativeModules } from 'react-native';

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

// Only import BleManager on native platforms with proper error handling
let BleManager: any = null;
let bleManagerAvailable = false;

if (Platform.OS !== 'web') {
  try {
    BleManager = require('react-native-ble-manager').default;
    bleManagerAvailable = true;
  } catch (error) {
    console.warn('[bluetoothService] react-native-ble-manager not available. Bluetooth scanning will use manual entry only.');
    bleManagerAvailable = false;
  }
}

// NOTE: BleManager must be started once before scanning
let bleStarted = false;

async function ensureBleStarted(): Promise<void> {
  if (!bleStarted && BleManager) {
    await BleManager.start({ showAlert: false });
    bleStarted = true;
  }
}

export interface ScannedDevice {
  id: string;           // MAC address (Android) or UUID (iOS)
  name: string;
  rssi: number;
  isAlreadyMapped: boolean;
}

/**
 * Scan for nearby BLE devices for 8 seconds.
 * Requires BLUETOOTH_SCAN permission on Android 12+
 * Requires location permission on Android < 12
 *
 * Returns discovered devices with names (unnamed devices are filtered).
 */
export async function scanForBluetoothDevices(
  onDeviceFound: (device: ScannedDevice) => void,
  durationSeconds: number = 8
): Promise<void> {
  // Check if BLE scanning is available
  if (Platform.OS === 'web' || !bleManagerAvailable || !BleManager) {
    throw new Error(
      'Bluetooth scanning is not available in this build. Please use the "Add Manually" option to enter your car\'s Bluetooth name from your phone\'s Bluetooth settings.'
    );
  }

  await ensureBleStarted();

  // Check if Bluetooth is enabled
  await BleManager.checkState();
  // checkState returns void but fires 'BleManagerDidUpdateState' event
  // Use a short poll to get state
  const isEnabled = await new Promise<boolean>((resolve) => {
    const emitter = new NativeEventEmitter(NativeModules.BleManager);
    const sub = emitter.addListener('BleManagerDidUpdateState', (args) => {
      sub.remove();
      resolve(args.state === 'on');
    });
    BleManager.checkState();
    // Timeout fallback in case event doesn't fire
    setTimeout(() => { sub.remove(); resolve(true); }, 1000);
  });

  if (!isEnabled) {
    throw new Error(
      'Bluetooth is turned off. Please enable Bluetooth in your device settings and try again.'
    );
  }

  const existingMappings = await getDeviceMappings();
  const mappedIds = new Set(existingMappings.map(m => m.deviceId));
  const found = new Map<string, ScannedDevice>();

  // Listen for discovered peripherals
  const emitter = new NativeEventEmitter(NativeModules.BleManager);
  const sub = emitter.addListener('BleManagerDiscoverPeripheral', (peripheral) => {
    const name = peripheral.name || peripheral.advertising?.localName;
    if (!name || found.has(peripheral.id)) return;

    const device: ScannedDevice = {
      id: peripheral.id,
      name,
      rssi: peripheral.rssi ?? -100,
      isAlreadyMapped: mappedIds.has(peripheral.id),
    };
    found.set(peripheral.id, device);
    onDeviceFound(device);
  });

  try {
    await BleManager.scan([], durationSeconds, false);
    // Wait for scan to complete
    await new Promise<void>((resolve) => {
      const stopSub = emitter.addListener('BleManagerStopScan', () => {
        stopSub.remove();
        resolve();
      });
      // Fallback timeout
      setTimeout(resolve, (durationSeconds + 2) * 1000);
    });
  } finally {
    sub.remove();
  }
}

export async function stopBluetoothScan(): Promise<void> {
  if (Platform.OS === 'web' || !bleManagerAvailable || !BleManager) return;
  
  try {
    await ensureBleStarted();
    await BleManager.stopScan();
  } catch {
    // ignore if not scanning
  }
}

export async function getBluetoothState(): Promise<'on' | 'off' | 'unavailable'> {
  if (Platform.OS === 'web' || !bleManagerAvailable || !BleManager) return 'unavailable';
  
  try {
    await ensureBleStarted();
    return await new Promise<'on' | 'off' | 'unavailable'>((resolve) => {
      const emitter = new NativeEventEmitter(NativeModules.BleManager);
      const sub = emitter.addListener('BleManagerDidUpdateState', (args) => {
        sub.remove();
        if (args.state === 'on') resolve('on');
        else if (args.state === 'off') resolve('off');
        else resolve('unavailable');
      });
      BleManager.checkState();
      setTimeout(() => { sub.remove(); resolve('unavailable'); }, 2000);
    });
  } catch {
    return 'unavailable';
  }
}
