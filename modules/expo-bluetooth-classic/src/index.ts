import { NativeModule, requireNativeModule } from 'expo-modules-core';
import { EventEmitter, EventSubscription } from 'expo-modules-core';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BondedDevice {
  id: string;        // MAC address (Android) or connectionID (iOS)
  name: string;      // Human-readable device name
  address: string;   // Same as id on Android, connectionID string on iOS
  type: 'classic' | 'ble' | 'dual' | 'unknown';
  bondState: 'bonded' | 'bonding' | 'none';
}

export interface BluetoothConnectionEvent {
  id: string;
  name: string;
  address: string;
}

export interface BluetoothStateEvent {
  state: 'on' | 'off' | 'turning_on' | 'turning_off' | 'unavailable' | 'unknown';
}

// ─── Native Module ────────────────────────────────────────────────────────────

interface ExpoBluetoothClassicModuleType extends NativeModule {
  getBondedDevices(): Promise<BondedDevice[]>;
  isDeviceConnected(address: string): Promise<boolean>;
  startConnectionListener(): Promise<boolean>;
  stopConnectionListener(): Promise<boolean>;
  getBluetoothState(): Promise<'on' | 'off' | 'unavailable'>;
}

// Load native module — will throw if not available (handled by wrapper)
let nativeModule: ExpoBluetoothClassicModuleType | null = null;
let emitter: EventEmitter | null = null;

try {
  nativeModule = requireNativeModule<ExpoBluetoothClassicModuleType>('ExpoBluetoothClassic');
  emitter = new EventEmitter(nativeModule);
} catch (error) {
  console.warn(
    '[ExpoBluetoothClassic] Native module not available. ' +
    'Classic Bluetooth features will be disabled. ' +
    'This is expected in Expo Go — use a development build.'
  );
}

// ─── Public API (safe wrappers with fallbacks) ────────────────────────────────

/**
 * Check if the native Classic Bluetooth module is available.
 * Returns false in Expo Go or web.
 */
export function isAvailable(): boolean {
  return nativeModule !== null;
}

/**
 * Get all paired/bonded Bluetooth devices from the phone's settings.
 * On Android: returns all paired Classic + BLE devices.
 * On iOS: returns currently connected External Accessories only.
 */
export async function getBondedDevices(): Promise<BondedDevice[]> {
  if (!nativeModule) return [];
  try {
    return await nativeModule.getBondedDevices();
  } catch (error) {
    console.error('[ExpoBluetoothClassic] getBondedDevices error:', error);
    return [];
  }
}

/**
 * Check if a specific Bluetooth device is currently connected.
 */
export async function isDeviceConnected(address: string): Promise<boolean> {
  if (!nativeModule) return false;
  try {
    return await nativeModule.isDeviceConnected(address);
  } catch (error) {
    console.error('[ExpoBluetoothClassic] isDeviceConnected error:', error);
    return false;
  }
}

/**
 * Start listening for Classic Bluetooth connection/disconnection events.
 * On Android: registers BroadcastReceiver for ACL_CONNECTED/DISCONNECTED.
 * On iOS: registers for EAAccessory notifications.
 */
export async function startConnectionListener(): Promise<boolean> {
  if (!nativeModule) return false;
  try {
    return await nativeModule.startConnectionListener();
  } catch (error) {
    console.error('[ExpoBluetoothClassic] startConnectionListener error:', error);
    return false;
  }
}

/**
 * Stop listening for connection events.
 */
export async function stopConnectionListener(): Promise<boolean> {
  if (!nativeModule) return false;
  try {
    return await nativeModule.stopConnectionListener();
  } catch (error) {
    console.error('[ExpoBluetoothClassic] stopConnectionListener error:', error);
    return false;
  }
}

/**
 * Get the current Bluetooth adapter state.
 */
export async function getBluetoothState(): Promise<'on' | 'off' | 'unavailable'> {
  if (!nativeModule) return 'unavailable';
  try {
    return await nativeModule.getBluetoothState();
  } catch (error) {
    console.error('[ExpoBluetoothClassic] getBluetoothState error:', error);
    return 'unavailable';
  }
}

// ─── Event Subscriptions ──────────────────────────────────────────────────────

/**
 * Subscribe to Classic Bluetooth device connection events.
 * Fires when phone connects to a paired BT device (e.g. car audio).
 */
export function addDeviceConnectedListener(
  callback: (event: BluetoothConnectionEvent) => void
): EventSubscription | null {
  if (!emitter) return null;
  return emitter.addListener('onDeviceConnected', callback);
}

/**
 * Subscribe to Classic Bluetooth device disconnection events.
 * Fires when phone disconnects from a paired BT device.
 */
export function addDeviceDisconnectedListener(
  callback: (event: BluetoothConnectionEvent) => void
): EventSubscription | null {
  if (!emitter) return null;
  return emitter.addListener('onDeviceDisconnected', callback);
}

/**
 * Subscribe to Bluetooth adapter state changes (on/off).
 */
export function addBluetoothStateChangedListener(
  callback: (event: BluetoothStateEvent) => void
): EventSubscription | null {
  if (!emitter) return null;
  return emitter.addListener('onBluetoothStateChanged', callback);
}
