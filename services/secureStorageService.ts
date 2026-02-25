import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * Cross-platform secure storage service
 * Uses SecureStore on native (iOS/Android) and localStorage on web
 * 
 * WARNING: On web, localStorage is NOT encrypted. For production web apps,
 * consider using session storage or server-side session management.
 */

const isWeb = Platform.OS === 'web';

export const secureStorage = {
  async getItemAsync(key: string): Promise<string | null> {
    if (isWeb) {
      try {
        return localStorage.getItem(key);
      } catch (error) {
        console.error('[SecureStorage] Web getItemAsync error:', error);
        return null;
      }
    }
    return SecureStore.getItemAsync(key);
  },

  async setItemAsync(key: string, value: string): Promise<void> {
    if (isWeb) {
      try {
        localStorage.setItem(key, value);
      } catch (error) {
        console.error('[SecureStorage] Web setItemAsync error:', error);
      }
      return;
    }
    return SecureStore.setItemAsync(key, value);
  },

  async deleteItemAsync(key: string): Promise<void> {
    if (isWeb) {
      try {
        localStorage.removeItem(key);
      } catch (error) {
        console.error('[SecureStorage] Web deleteItemAsync error:', error);
      }
      return;
    }
    return SecureStore.deleteItemAsync(key);
  },
};
