import { secureStorage } from './secureStorageService';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import { API_CONFIG, STORAGE_KEYS } from '../constants/config';
import { api, storeTokens, clearTokens, ApiError, ApiResponse } from './apiClient';

export interface User {
  id: number;
  username: string;
  email: string;
  display_name: string;
  subscription_level: 'free' | 'paid';
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

export interface TokenExchangeRequest {
  device_id?: string;
  device_name?: string;
  platform?: string;
}

// Generate unique device ID
async function getOrCreateDeviceId(): Promise<string> {
  let deviceId = await secureStorage.getItemAsync('device_id');
  
  if (!deviceId) {
    // Generate new device ID
    const uniqueId = Device.modelId || Device.osInternalBuildId || Math.random().toString(36);
    deviceId = `${Platform.OS}_${uniqueId}`;
    await secureStorage.setItemAsync('device_id', deviceId);
  }
  
  return deviceId;
}

// Get device info
async function getDeviceInfo() {
  const deviceId = await getOrCreateDeviceId();
  const deviceName = Device.deviceName || `${Device.manufacturer} ${Device.modelName}`;
  
  return {
    device_id: deviceId,
    device_name: deviceName,
    platform: Platform.OS as 'ios' | 'android',
    device_model: Device.modelName || 'Unknown',
    os_version: Device.osVersion || 'Unknown',
    app_version: '1.5.0',
  };
}

/**
 * Direct login with username and password
 */
export async function login(username: string, password: string): Promise<User> {
  const deviceInfo = await getDeviceInfo();
  
  try {
    const endpoint = `${API_CONFIG.BASE_URL}/auth/login`;
    console.log('Login endpoint:', endpoint);
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username,
        password,
        ...deviceInfo,
      }),
    });

    console.log('Login response status:', response.status);
    const responseText = await response.text();
    console.log('Login response body:', responseText.substring(0, 200));

    let result: ApiResponse<LoginResponse>;
    try {
      result = JSON.parse(responseText);
    } catch (parseError) {
      throw new ApiError(
        'INVALID_RESPONSE',
        `Server returned invalid response. Status: ${response.status}. Body: ${responseText.substring(0, 100)}`
      );
    }

    if (!result.success || !result.data) {
      throw new ApiError(
        result.error?.code || 'LOGIN_FAILED',
        result.error?.message || 'Login failed'
      );
    }

    // Store tokens
    await storeTokens(result.data.access_token, result.data.refresh_token);
    
    // Store user data
    await secureStorage.setItemAsync(STORAGE_KEYS.USER_DATA, JSON.stringify(result.data.user));

    // Register device for push notifications
    await registerDevice(deviceInfo);

    return result.data.user;
  } catch (error) {
    console.error('Login error:', error);
    if (error instanceof ApiError) {
      throw error;
    }
    
    // Provide more helpful error messages
    let errorMessage = 'Login failed. ';
    
    if (error instanceof Error) {
      if (error.message === 'Failed to fetch') {
        if (Platform.OS === 'web') {
          errorMessage += 'Cannot reach API server from web preview. This is likely a CORS issue. Please test on the OnSpace mobile app instead.';
        } else {
          errorMessage += 'Network error. Please check your internet connection.';
        }
      } else {
        errorMessage += error.message;
      }
    } else {
      errorMessage += 'Please check your connection.';
    }
    
    throw new ApiError('LOGIN_FAILED', errorMessage);
  }
}

/**
 * Exchange WordPress session cookie for JWT tokens
 * Used after WebView login
 */
export async function exchangeToken(cookies: string): Promise<User> {
  const deviceInfo = await getDeviceInfo();
  
  try {
    const endpoint = `${API_CONFIG.BASE_URL}/auth/token-exchange`;
    console.log('[AuthService] Token exchange URL:', endpoint);
    console.log('[AuthService] Cookie preview:', cookies.substring(0, 80) + '...');
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookies,
      },
      body: JSON.stringify({
        device_id: deviceInfo.device_id,
        device_name: deviceInfo.device_name,
        platform: deviceInfo.platform,
      }),
    });

    console.log('[AuthService] Exchange status:', response.status);
    const responseText = await response.text();
    console.log('[AuthService] Exchange body preview:', responseText.substring(0, 200));
    
    let result: ApiResponse<LoginResponse>;
    try {
      result = JSON.parse(responseText);
    } catch (parseError) {
      throw new ApiError(
        'INVALID_RESPONSE',
        `Server returned invalid response. Status: ${response.status}. Body: ${responseText.substring(0, 100)}`
      );
    }

    if (!result.success || !result.data) {
      throw new ApiError(
        result.error?.code || 'TOKEN_EXCHANGE_FAILED',
        result.error?.message || 'Failed to exchange token'
      );
    }

    // Store tokens
    await storeTokens(result.data.access_token, result.data.refresh_token);
    
    // Store user data
    await secureStorage.setItemAsync(STORAGE_KEYS.USER_DATA, JSON.stringify(result.data.user));

    // Register device
    await registerDevice(deviceInfo);

    return result.data.user;
  } catch (error) {
    console.error('Token exchange error:', error);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      'TOKEN_EXCHANGE_FAILED',
      error instanceof Error ? error.message : 'Failed to exchange token. Please try logging in again.'
    );
  }
}

/**
 * Logout - revoke refresh token
 */
export async function logout(allDevices: boolean = false): Promise<void> {
  try {
    const refreshToken = await secureStorage.getItemAsync(STORAGE_KEYS.REFRESH_TOKEN);
    
    if (refreshToken) {
      await api.post('/auth/logout', {
        refresh_token: refreshToken,
        all_devices: allDevices,
      });
    }
  } catch (error) {
    // Continue with local logout even if API call fails
    console.error('Logout API error:', error);
  } finally {
    // Always clear local tokens
    await clearTokens();
  }
}

/**
 * Verify current token is valid
 */
export async function verifyToken(): Promise<User | null> {
  try {
    const response = await api.get<{ valid: boolean; user: User; active_sessions: number }>('/auth/verify');
    
    if (response.valid && response.user) {
      // Update stored user data
      await secureStorage.setItemAsync(STORAGE_KEYS.USER_DATA, JSON.stringify(response.user));
      return response.user;
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Get current user from storage
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    const userData = await secureStorage.getItemAsync(STORAGE_KEYS.USER_DATA);
    if (!userData) return null;
    
    return JSON.parse(userData);
  } catch {
    return null;
  }
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const accessToken = await secureStorage.getItemAsync(STORAGE_KEYS.ACCESS_TOKEN);
  return !!accessToken;
}

/**
 * Register device for sync tracking
 */
async function registerDevice(deviceInfo: any): Promise<void> {
  try {
    await api.post('/sync/register-device', deviceInfo);
  } catch (error) {
    // Non-critical, log but don't fail
    console.error('Device registration failed:', error);
  }
}

/**
 * Fetch user profile from server
 */
export async function fetchUserProfile(): Promise<User> {
  const profile = await api.get<User>('/user/profile');
  
  // Update stored user data
  await secureStorage.setItemAsync(STORAGE_KEYS.USER_DATA, JSON.stringify(profile));
  
  return profile;
}
