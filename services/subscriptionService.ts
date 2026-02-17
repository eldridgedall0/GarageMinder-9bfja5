import AsyncStorage from '@react-native-async-storage/async-storage';

const SUBSCRIPTION_KEY = '@garageminder_subscription';
const SYNC_SETTINGS_KEY = '@garageminder_sync_settings';

export type SubscriptionLevel = 'free' | 'paid';

export interface SubscriptionInfo {
  level: SubscriptionLevel;
  lastChecked: number;
}

export interface SyncSettings {
  autoSyncEnabled: boolean;
  syncFrequency: 'after_trip' | 'on_open' | 'daily' | 'weekly';
  syncOnAppOpen: boolean;
  backgroundSyncEnabled: boolean;
  showSyncNotifications: boolean;
  deleteGpsAfterSync: boolean;
  syncOverMobileData: boolean;
}

const DEFAULT_SYNC_SETTINGS: SyncSettings = {
  autoSyncEnabled: false,
  syncFrequency: 'after_trip',
  syncOnAppOpen: true,
  backgroundSyncEnabled: true,
  showSyncNotifications: true,
  deleteGpsAfterSync: false,
  syncOverMobileData: true,
};

// Get current subscription level
export async function getSubscriptionLevel(): Promise<SubscriptionLevel> {
  try {
    const data = await AsyncStorage.getItem(SUBSCRIPTION_KEY);
    if (!data) return 'free';
    
    const info: SubscriptionInfo = JSON.parse(data);
    return info.level;
  } catch {
    return 'free';
  }
}

// Set subscription level
export async function setSubscriptionLevel(level: SubscriptionLevel): Promise<void> {
  const info: SubscriptionInfo = {
    level,
    lastChecked: Date.now(),
  };
  await AsyncStorage.setItem(SUBSCRIPTION_KEY, JSON.stringify(info));
}

// Check if user is paid subscriber
export async function isPaidUser(): Promise<boolean> {
  const level = await getSubscriptionLevel();
  return level === 'paid';
}

// Get sync settings
export async function getSyncSettings(): Promise<SyncSettings> {
  try {
    const data = await AsyncStorage.getItem(SYNC_SETTINGS_KEY);
    if (!data) return DEFAULT_SYNC_SETTINGS;
    
    return JSON.parse(data);
  } catch {
    return DEFAULT_SYNC_SETTINGS;
  }
}

// Update sync settings
export async function updateSyncSettings(settings: Partial<SyncSettings>): Promise<void> {
  const current = await getSyncSettings();
  const updated = { ...current, ...settings };
  await AsyncStorage.setItem(SYNC_SETTINGS_KEY, JSON.stringify(updated));
}

// Check if auto-sync is allowed
export async function canAutoSync(): Promise<boolean> {
  const isPaid = await isPaidUser();
  const settings = await getSyncSettings();
  return isPaid && settings.autoSyncEnabled;
}

// Simulate fetching subscription from server
export async function fetchSubscriptionFromServer(): Promise<SubscriptionLevel> {
  // In real implementation, this would call the API
  // For now, return demo based on time (free for first use, paid after)
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const existing = await getSubscriptionLevel();
  return existing; // Keep current setting
}
