import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Cross-platform storage service
 * Uses AsyncStorage on native (iOS/Android) and localStorage on web
 */

const isWeb = Platform.OS === 'web';

export const storage = {
  async getItem(key: string): Promise<string | null> {
    if (isWeb) {
      try {
        return localStorage.getItem(key);
      } catch (error) {
        console.error('[Storage] Web getItem error:', error);
        return null;
      }
    }
    return AsyncStorage.getItem(key);
  },

  async setItem(key: string, value: string): Promise<void> {
    if (isWeb) {
      try {
        localStorage.setItem(key, value);
      } catch (error) {
        console.error('[Storage] Web setItem error:', error);
      }
      return;
    }
    return AsyncStorage.setItem(key, value);
  },

  async removeItem(key: string): Promise<void> {
    if (isWeb) {
      try {
        localStorage.removeItem(key);
      } catch (error) {
        console.error('[Storage] Web removeItem error:', error);
      }
      return;
    }
    return AsyncStorage.removeItem(key);
  },

  async multiGet(keys: string[]): Promise<readonly [string, string | null][]> {
    if (isWeb) {
      try {
        return keys.map(key => [key, localStorage.getItem(key)] as [string, string | null]);
      } catch (error) {
        console.error('[Storage] Web multiGet error:', error);
        return keys.map(key => [key, null] as [string, string | null]);
      }
    }
    return AsyncStorage.multiGet(keys);
  },

  async multiSet(keyValuePairs: [string, string][]): Promise<void> {
    if (isWeb) {
      try {
        keyValuePairs.forEach(([key, value]) => {
          localStorage.setItem(key, value);
        });
      } catch (error) {
        console.error('[Storage] Web multiSet error:', error);
      }
      return;
    }
    return AsyncStorage.multiSet(keyValuePairs);
  },

  async multiRemove(keys: string[]): Promise<void> {
    if (isWeb) {
      try {
        keys.forEach(key => localStorage.removeItem(key));
      } catch (error) {
        console.error('[Storage] Web multiRemove error:', error);
      }
      return;
    }
    return AsyncStorage.multiRemove(keys);
  },

  async clear(): Promise<void> {
    if (isWeb) {
      try {
        localStorage.clear();
      } catch (error) {
        console.error('[Storage] Web clear error:', error);
      }
      return;
    }
    return AsyncStorage.clear();
  },

  async getAllKeys(): Promise<readonly string[]> {
    if (isWeb) {
      try {
        return Object.keys(localStorage);
      } catch (error) {
        console.error('[Storage] Web getAllKeys error:', error);
        return [];
      }
    }
    return AsyncStorage.getAllKeys();
  },
};
