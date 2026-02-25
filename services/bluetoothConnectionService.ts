/**
 * bluetoothConnectionService.ts
 * 
 * Handles real-time Bluetooth connection detection.
 * 
 * LIMITATIONS:
 * React Native (including Expo) cannot reliably detect Classic Bluetooth
 * connections (which most car audio systems use) without native modules.
 * 
 * This service provides:
 * 1. BLE device connection monitoring (for BLE-capable car systems)
 * 2. A placeholder for native Classic BT integration
 * 3. Manual connection triggers for testing
 * 
 * PRODUCTION SOLUTION:
 * For Classic Bluetooth detection, you need:
 * - Android: BroadcastReceiver for BluetoothDevice.ACTION_ACL_CONNECTED
 * - iOS: CoreBluetooth framework or External Accessory framework
 * - Both require custom native modules (bare workflow or expo-modules)
 */

import { Platform, NativeEventEmitter, NativeModules } from 'react-native';
import { getDeviceMappings, BluetoothDeviceMapping } from './bluetoothService';

// Only import BleManager on native platforms
let BleManager: any = null;
let bleManagerAvailable = false;

if (Platform.OS !== 'web') {
  try {
    BleManager = require('react-native-ble-manager').default;
    bleManagerAvailable = true;
  } catch (error) {
    console.warn('[BluetoothConnectionService] react-native-ble-manager not available');
    bleManagerAvailable = false;
  }
}

let bleStarted = false;

async function ensureBleStarted(): Promise<void> {
  if (!bleStarted && BleManager) {
    await BleManager.start({ showAlert: false });
    bleStarted = true;
  }
}

/**
 * Check if a specific Bluetooth device is currently connected.
 * 
 * IMPORTANT: This only works for BLE devices. Classic Bluetooth devices
 * (most car audio systems) cannot be detected this way.
 * 
 * Returns:
 * - true: Device is connected (BLE only)
 * - false: Device not connected or cannot be detected
 * - null: Bluetooth not available
 */
export async function isDeviceConnected(deviceId: string): Promise<boolean | null> {
  if (Platform.OS === 'web' || !bleManagerAvailable || !BleManager) {
    return null;
  }

  try {
    await ensureBleStarted();

    // Get list of connected BLE peripherals
    const connectedDevices = await BleManager.getConnectedPeripherals([]);
    
    // Check if our device is in the list
    const isConnected = connectedDevices.some((device: any) => device.id === deviceId);
    
    return isConnected;
  } catch (error) {
    console.error('[BluetoothConnectionService] Error checking device connection:', error);
    return false;
  }
}

/**
 * Check if ANY of the user's mapped devices are currently connected.
 * 
 * Returns:
 * - BluetoothDeviceMapping: The first connected device found
 * - null: No mapped devices are connected
 */
export async function getConnectedMappedDevice(): Promise<BluetoothDeviceMapping | null> {
  const mappings = await getDeviceMappings();
  const enabledMappings = mappings.filter(m => m.enabled && m.vehicleId);

  if (enabledMappings.length === 0) {
    return null;
  }

  // Check each mapped device
  for (const mapping of enabledMappings) {
    const connected = await isDeviceConnected(mapping.deviceId);
    if (connected === true) {
      return mapping;
    }
  }

  return null;
}

/**
 * Start monitoring for Bluetooth connection events.
 * 
 * NOTE: This only monitors BLE connections. For Classic Bluetooth,
 * you need native modules.
 * 
 * @param onConnect - Called when a mapped device connects
 * @param onDisconnect - Called when a mapped device disconnects
 * @returns Cleanup function to stop monitoring
 */
export function startMonitoring(
  onConnect: (mapping: BluetoothDeviceMapping) => void,
  onDisconnect: (mapping: BluetoothDeviceMapping) => void
): () => void {
  if (Platform.OS === 'web' || !bleManagerAvailable || !BleManager) {
    console.warn('[BluetoothConnectionService] Bluetooth monitoring not available on this platform');
    return () => {};
  }

  let isMonitoring = true;
  let lastConnectedDeviceId: string | null = null;

  // Poll for connection changes every 5 seconds
  // (BleManager doesn't provide reliable connection events for all devices)
  const pollInterval = setInterval(async () => {
    if (!isMonitoring) return;

    try {
      const connectedMapping = await getConnectedMappedDevice();

      // Connection established
      if (connectedMapping && connectedMapping.deviceId !== lastConnectedDeviceId) {
        lastConnectedDeviceId = connectedMapping.deviceId;
        onConnect(connectedMapping);
      }

      // Connection lost
      if (!connectedMapping && lastConnectedDeviceId) {
        // Find the mapping that was disconnected
        const mappings = await getDeviceMappings();
        const disconnectedMapping = mappings.find(m => m.deviceId === lastConnectedDeviceId);
        if (disconnectedMapping) {
          onDisconnect(disconnectedMapping);
        }
        lastConnectedDeviceId = null;
      }
    } catch (error) {
      console.error('[BluetoothConnectionService] Monitoring error:', error);
    }
  }, 5000);

  // Cleanup function
  return () => {
    isMonitoring = false;
    clearInterval(pollInterval);
  };
}

/**
 * Get Bluetooth adapter state.
 */
export async function getBluetoothState(): Promise<'on' | 'off' | 'unavailable'> {
  if (Platform.OS === 'web' || !bleManagerAvailable || !BleManager) {
    return 'unavailable';
  }

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
      
      // Timeout fallback
      setTimeout(() => {
        sub.remove();
        resolve('unavailable');
      }, 2000);
    });
  } catch {
    return 'unavailable';
  }
}
