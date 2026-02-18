/**
 * permissionsService.ts
 *
 * Central service for checking and requesting all app permissions.
 * Uses expo-location, expo-notifications, and react-native's PermissionsAndroid
 * for Bluetooth permissions on Android 12+.
 */

import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { Platform, PermissionsAndroid, Linking } from 'react-native';

export type PermissionStatus = 'granted' | 'denied' | 'not_asked' | 'unavailable';

export interface AppPermission {
  key: PermissionKey;
  title: string;
  description: string;        // What the app uses it for
  icon: string;               // MaterialIcons name
  status: PermissionStatus;
  isRequired: boolean;        // true = core feature broken without it
  requiresNativeSettings: boolean; // true = can only fix in device settings (already denied)
}

export type PermissionKey =
  | 'location_foreground'
  | 'location_background'
  | 'bluetooth_scan'
  | 'bluetooth_connect'
  | 'notifications';

// ── Check all permissions ─────────────────────────────────────────────────────

export async function checkAllPermissions(): Promise<AppPermission[]> {
  const [locationFg, locationBg, btScan, btConnect, notifications] = await Promise.all([
    checkLocationForeground(),
    checkLocationBackground(),
    checkBluetoothScan(),
    checkBluetoothConnect(),
    checkNotifications(),
  ]);

  return [
    {
      key: 'location_foreground',
      title: 'Location',
      description: 'Required to track your trip distance via GPS',
      icon: 'location-on',
      status: locationFg,
      isRequired: true,
      requiresNativeSettings: locationFg === 'denied',
    },
    {
      key: 'location_background',
      title: 'Background Location',
      description: 'Allows trip tracking to continue when you switch apps',
      icon: 'my-location',
      status: locationBg,
      isRequired: false,
      requiresNativeSettings: locationBg === 'denied',
    },
    {
      key: 'bluetooth_scan',
      title: 'Bluetooth Scan',
      description: "Required to detect your car's Bluetooth for AutoStart",
      icon: 'bluetooth-searching',
      status: btScan,
      isRequired: false,
      requiresNativeSettings: btScan === 'denied',
    },
    {
      key: 'bluetooth_connect',
      title: 'Bluetooth Connect',
      description: 'Required to identify which car you connected to',
      icon: 'bluetooth-connected',
      status: btConnect,
      isRequired: false,
      requiresNativeSettings: btConnect === 'denied',
    },
    {
      key: 'notifications',
      title: 'Notifications',
      description: 'Shows live trip status and sync alerts',
      icon: 'notifications',
      status: notifications,
      isRequired: false,
      requiresNativeSettings: notifications === 'denied',
    },
  ];
}

// ── Individual permission checks ──────────────────────────────────────────────

async function checkLocationForeground(): Promise<PermissionStatus> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status === 'granted') return 'granted';
    if (status === 'denied') return 'denied';
    return 'not_asked';
  } catch {
    return 'unavailable';
  }
}

async function checkLocationBackground(): Promise<PermissionStatus> {
  try {
    // Background location only meaningful if foreground is granted first
    const fg = await Location.getForegroundPermissionsAsync();
    if (fg.status !== 'granted') return 'not_asked';

    const { status } = await Location.getBackgroundPermissionsAsync();
    if (status === 'granted') return 'granted';
    if (status === 'denied') return 'denied';
    return 'not_asked';
  } catch {
    return 'unavailable';
  }
}

async function checkBluetoothScan(): Promise<PermissionStatus> {
  // Android 12+ requires BLUETOOTH_SCAN permission
  // Android < 12 uses location for BT scanning (covered by location permission)
  // iOS: handled by Info.plist, no runtime request needed
  if (Platform.OS === 'ios') return 'granted'; // iOS handles via app.json plist

  if (Platform.OS === 'android') {
    const apiLevel = Platform.Version as number;
    if (apiLevel < 31) {
      // Android < 12: BT scan uses location permission
      return checkLocationForeground();
    }
    try {
      const result = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN
      );
      return result ? 'granted' : 'not_asked';
    } catch {
      return 'unavailable';
    }
  }

  return 'unavailable';
}

async function checkBluetoothConnect(): Promise<PermissionStatus> {
  if (Platform.OS === 'ios') return 'granted';

  if (Platform.OS === 'android') {
    const apiLevel = Platform.Version as number;
    if (apiLevel < 31) return 'granted'; // Not needed below Android 12
    try {
      const result = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT
      );
      return result ? 'granted' : 'not_asked';
    } catch {
      return 'unavailable';
    }
  }

  return 'unavailable';
}

async function checkNotifications(): Promise<PermissionStatus> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status === 'granted') return 'granted';
    if (status === 'denied') return 'denied';
    return 'not_asked';
  } catch {
    return 'unavailable';
  }
}

// ── Request permissions ───────────────────────────────────────────────────────

export async function requestPermission(key: PermissionKey): Promise<PermissionStatus> {
  switch (key) {
    case 'location_foreground': {
      const { status } = await Location.requestForegroundPermissionsAsync();
      return status === 'granted' ? 'granted' : 'denied';
    }
    case 'location_background': {
      const { status } = await Location.requestBackgroundPermissionsAsync();
      return status === 'granted' ? 'granted' : 'denied';
    }
    case 'bluetooth_scan': {
      if (Platform.OS !== 'android') return 'granted';
      const apiLevel = Platform.Version as number;
      if (apiLevel < 31) return 'granted';
      try {
        const result = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          {
            title: 'Bluetooth Scan Permission',
            message: "GarageMinder needs Bluetooth scan permission to detect your car and auto-start trips.",
            buttonPositive: 'Allow',
          }
        );
        return result === PermissionsAndroid.RESULTS.GRANTED ? 'granted' : 'denied';
      } catch {
        return 'denied';
      }
    }
    case 'bluetooth_connect': {
      if (Platform.OS !== 'android') return 'granted';
      const apiLevel = Platform.Version as number;
      if (apiLevel < 31) return 'granted';
      try {
        const result = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          {
            title: 'Bluetooth Connect Permission',
            message: 'GarageMinder needs Bluetooth connect permission to identify your car.',
            buttonPositive: 'Allow',
          }
        );
        return result === PermissionsAndroid.RESULTS.GRANTED ? 'granted' : 'denied';
      } catch {
        return 'denied';
      }
    }
    case 'notifications': {
      const { status } = await Notifications.requestPermissionsAsync();
      return status === 'granted' ? 'granted' : 'denied';
    }
    default:
      return 'unavailable';
  }
}

// ── Open device settings ──────────────────────────────────────────────────────

/**
 * Opens the app's permission settings page in the device OS settings.
 * User can manually grant denied permissions from here.
 */
export async function openAppSettings(): Promise<void> {
  await Linking.openSettings();
}

// ── Helper ────────────────────────────────────────────────────────────────────

export function getPermissionStatusLabel(status: PermissionStatus): string {
  switch (status) {
    case 'granted': return 'Allowed';
    case 'denied': return 'Denied';
    case 'not_asked': return 'Not Set';
    case 'unavailable': return 'N/A';
  }
}

export function getPermissionStatusColor(status: PermissionStatus, colors: any): string {
  switch (status) {
    case 'granted': return colors.success || '#22C55E';
    case 'denied': return colors.error || '#EF4444';
    case 'not_asked': return colors.pending || '#F59E0B';
    case 'unavailable': return colors.textSubtle;
  }
}
