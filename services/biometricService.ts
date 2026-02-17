import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BIOMETRIC_ENABLED_KEY = '@garageminder_biometric_enabled';
const SESSION_KEY = 'user_session';

export type BiometricType = 'fingerprint' | 'face' | 'iris' | 'none';

export interface BiometricCapability {
  isAvailable: boolean;
  hasHardware: boolean;
  isEnrolled: boolean;
  supportedTypes: BiometricType[];
}

// Check biometric capabilities
export async function checkBiometricCapability(): Promise<BiometricCapability> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
  const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();

  const types: BiometricType[] = supportedTypes.map(type => {
    switch (type) {
      case LocalAuthentication.AuthenticationType.FINGERPRINT:
        return 'fingerprint';
      case LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION:
        return 'face';
      case LocalAuthentication.AuthenticationType.IRIS:
        return 'iris';
      default:
        return 'none';
    }
  }).filter(t => t !== 'none');

  return {
    isAvailable: hasHardware && isEnrolled,
    hasHardware,
    isEnrolled,
    supportedTypes: types,
  };
}

// Authenticate with biometrics
export async function authenticateWithBiometrics(): Promise<boolean> {
  try {
    const capability = await checkBiometricCapability();
    
    if (!capability.isAvailable) {
      return false;
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock GarageMinder',
      fallbackLabel: 'Use passcode',
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
    });

    return result.success;
  } catch (error) {
    console.error('Biometric authentication error:', error);
    return false;
  }
}

// Check if biometric is enabled
export async function isBiometricEnabled(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(BIOMETRIC_ENABLED_KEY);
    return value === 'true';
  } catch {
    return false;
  }
}

// Enable biometric authentication
export async function enableBiometric(): Promise<boolean> {
  try {
    const capability = await checkBiometricCapability();
    
    if (!capability.isAvailable) {
      return false;
    }

    // Test authentication first
    const authenticated = await authenticateWithBiometrics();
    
    if (!authenticated) {
      return false;
    }

    await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, 'true');
    return true;
  } catch (error) {
    console.error('Error enabling biometric:', error);
    return false;
  }
}

// Disable biometric authentication
export async function disableBiometric(): Promise<void> {
  await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, 'false');
}

// Store session securely
export async function storeSecureSession(sessionData: string): Promise<void> {
  await SecureStore.setItemAsync(SESSION_KEY, sessionData);
}

// Get secure session
export async function getSecureSession(): Promise<string | null> {
  return await SecureStore.getItemAsync(SESSION_KEY);
}

// Clear secure session
export async function clearSecureSession(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}

// Check if session exists
export async function hasSecureSession(): Promise<boolean> {
  const session = await getSecureSession();
  return session !== null;
}
