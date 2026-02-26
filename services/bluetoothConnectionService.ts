/**
 * bluetoothConnectionService.ts
 *
 * Handles real-time Bluetooth connection detection using the custom
 * ExpoBluetoothClassic native module for Classic Bluetooth events.
 *
 * Android: BroadcastReceiver for BluetoothDevice.ACTION_ACL_CONNECTED/DISCONNECTED
 * iOS: ExternalAccessory framework notifications
 *
 * Falls back to BLE polling via react-native-ble-manager if the native
 * module is not available (e.g. Expo Go).
 */

import { Platform } from 'react-native';
import { getDeviceMappings, BluetoothDeviceMapping } from './bluetoothService';
import * as NativeBluetooth from '../modules/expo-bluetooth-classic';
import type { EventSubscription } from 'expo-modules-core';

// ─── Public: Check if native Classic BT is available ────────────────────────

export function isNativeBluetoothAvailable(): boolean {
  return NativeBluetooth.isAvailable();
}

// ─── Public: Get Bluetooth adapter state ────────────────────────────────────

export async function getBluetoothState(): Promise<'on' | 'off' | 'unavailable'> {
  // Try native module first (works for Classic + BLE)
  if (NativeBluetooth.isAvailable()) {
    return await NativeBluetooth.getBluetoothState();
  }

  // Fallback: try react-native-ble-manager
  return await getBleBluetoothState();
}

// ─── Public: Check if a specific device is connected ────────────────────────

export async function isDeviceConnected(deviceId: string): Promise<boolean | null> {
  if (Platform.OS === 'web') return null;

  // Native module handles Classic BT
  if (NativeBluetooth.isAvailable()) {
    return await NativeBluetooth.isDeviceConnected(deviceId);
  }

  // Fallback to BLE check
  return await isBleDeviceConnected(deviceId);
}

// ─── Public: Find first connected mapped device ────────────────────────────

export async function getConnectedMappedDevice(): Promise<BluetoothDeviceMapping | null> {
  const mappings = await getDeviceMappings();
  const enabledMappings = mappings.filter(m => m.enabled && m.vehicleId);

  if (enabledMappings.length === 0) return null;

  for (const mapping of enabledMappings) {
    const connected = await isDeviceConnected(mapping.deviceId);
    if (connected === true) return mapping;
  }

  return null;
}

// ─── Public: Start monitoring for connection events ─────────────────────────
//
// Uses native Classic BT events when available, falls back to BLE polling.
// Returns a cleanup function.

export function startMonitoring(
  onConnect: (mapping: BluetoothDeviceMapping) => void,
  onDisconnect: (mapping: BluetoothDeviceMapping) => void
): () => void {
  if (Platform.OS === 'web') {
    console.warn('[BluetoothConnectionService] Not available on web');
    return () => {};
  }

  // ── Native Classic Bluetooth monitoring (preferred) ──────────────────
  if (NativeBluetooth.isAvailable()) {
    return startNativeMonitoring(onConnect, onDisconnect);
  }

  // ── Fallback: BLE polling ────────────────────────────────────────────
  console.warn('[BluetoothConnectionService] Native module not available, falling back to BLE polling');
  return startBlePollingMonitoring(onConnect, onDisconnect);
}

// ─── Native Classic BT Monitoring ───────────────────────────────────────────

function startNativeMonitoring(
  onConnect: (mapping: BluetoothDeviceMapping) => void,
  onDisconnect: (mapping: BluetoothDeviceMapping) => void
): () => void {
  let connectSub: EventSubscription | null = null;
  let disconnectSub: EventSubscription | null = null;

  // Start the native BroadcastReceiver / EA notifications
  NativeBluetooth.startConnectionListener().then((started) => {
    if (!started) {
      console.error('[BluetoothConnectionService] Failed to start native listener');
      return;
    }

    console.log('[BluetoothConnectionService] Native Classic BT listener started');

    // Listen for connection events
    connectSub = NativeBluetooth.addDeviceConnectedListener(async (event) => {
      console.log('[BluetoothConnectionService] Device connected:', event.name, event.address);
      const mapping = await findMappingForNativeDevice(event.address, event.name);
      if (mapping) {
        console.log('[BluetoothConnectionService] Mapped device connected → vehicle:', mapping.vehicleName);
        onConnect(mapping);
      }
    });

    // Listen for disconnection events
    disconnectSub = NativeBluetooth.addDeviceDisconnectedListener(async (event) => {
      console.log('[BluetoothConnectionService] Device disconnected:', event.name, event.address);
      const mapping = await findMappingForNativeDevice(event.address, event.name);
      if (mapping) {
        console.log('[BluetoothConnectionService] Mapped device disconnected → vehicle:', mapping.vehicleName);
        onDisconnect(mapping);
      }
    });
  });

  // Return cleanup function
  return () => {
    connectSub?.remove();
    disconnectSub?.remove();
    NativeBluetooth.stopConnectionListener();
    console.log('[BluetoothConnectionService] Native listener stopped');
  };
}

/**
 * Find a device mapping by MAC address or device name.
 *
 * Native module returns MAC addresses (Android) or connectionIDs (iOS),
 * but the user may have mapped by MAC address OR by a manual name-based ID.
 * We check both the deviceId field and try matching by name.
 */
async function findMappingForNativeDevice(
  address: string,
  name: string
): Promise<BluetoothDeviceMapping | null> {
  const mappings = await getDeviceMappings();
  const enabledMappings = mappings.filter(m => m.enabled && m.vehicleId);

  // Direct match by address/ID
  const directMatch = enabledMappings.find(m => m.deviceId === address);
  if (directMatch) return directMatch;

  // Match by device name (for manually-added devices where deviceId is "manual_xxx")
  const nameMatch = enabledMappings.find(
    m => m.deviceName.toLowerCase() === name.toLowerCase()
  );
  if (nameMatch) return nameMatch;

  // Partial name match (car audio names can vary slightly)
  const partialMatch = enabledMappings.find(
    m =>
      name.toLowerCase().includes(m.deviceName.toLowerCase()) ||
      m.deviceName.toLowerCase().includes(name.toLowerCase())
  );
  return partialMatch || null;
}

// ─── BLE Fallback: Polling-based monitoring ─────────────────────────────────

function startBlePollingMonitoring(
  onConnect: (mapping: BluetoothDeviceMapping) => void,
  onDisconnect: (mapping: BluetoothDeviceMapping) => void
): () => void {
  let isMonitoring = true;
  let lastConnectedDeviceId: string | null = null;

  const pollInterval = setInterval(async () => {
    if (!isMonitoring) return;

    try {
      const connectedMapping = await getConnectedMappedDevice();

      if (connectedMapping && connectedMapping.deviceId !== lastConnectedDeviceId) {
        lastConnectedDeviceId = connectedMapping.deviceId;
        onConnect(connectedMapping);
      }

      if (!connectedMapping && lastConnectedDeviceId) {
        const mappings = await getDeviceMappings();
        const disconnectedMapping = mappings.find(m => m.deviceId === lastConnectedDeviceId);
        if (disconnectedMapping) {
          onDisconnect(disconnectedMapping);
        }
        lastConnectedDeviceId = null;
      }
    } catch (error) {
      console.error('[BluetoothConnectionService] BLE polling error:', error);
    }
  }, 5000);

  return () => {
    isMonitoring = false;
    clearInterval(pollInterval);
  };
}

// ─── BLE Helpers (react-native-ble-manager fallback) ────────────────────────

let BleManager: any = null;
let bleManagerAvailable = false;
let bleStarted = false;

if (Platform.OS !== 'web') {
  try {
    BleManager = require('react-native-ble-manager').default;
    bleManagerAvailable = true;
  } catch {
    bleManagerAvailable = false;
  }
}

async function ensureBleStarted(): Promise<void> {
  if (!bleStarted && BleManager) {
    await BleManager.start({ showAlert: false });
    bleStarted = true;
  }
}

async function isBleDeviceConnected(deviceId: string): Promise<boolean | null> {
  if (!bleManagerAvailable || !BleManager) return null;
  try {
    await ensureBleStarted();
    const connectedDevices = await BleManager.getConnectedPeripherals([]);
    return connectedDevices.some((device: any) => device.id === deviceId);
  } catch {
    return false;
  }
}

async function getBleBluetoothState(): Promise<'on' | 'off' | 'unavailable'> {
  if (Platform.OS === 'web' || !bleManagerAvailable || !BleManager) return 'unavailable';
  try {
    await ensureBleStarted();
    return await new Promise<'on' | 'off' | 'unavailable'>((resolve) => {
      const { NativeEventEmitter, NativeModules } = require('react-native');
      const emitter = new NativeEventEmitter(NativeModules.BleManager);
      const sub = emitter.addListener('BleManagerDidUpdateState', (args: any) => {
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
