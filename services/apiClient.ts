import * as SecureStore from 'expo-secure-store';
import { API_CONFIG, STORAGE_KEYS } from '../constants/config';

export interface ApiResponse<T = any> {
  success: boolean;
  data: T | null;
  error: {
    code: string;
    message: string;
    details?: any;
  } | null;
  meta: {
    api_version: string;
    timestamp: number;
    pagination?: {
      total: number;
      page: number;
      per_page: number;
      total_pages: number;
      has_more: boolean;
    };
  };
}

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Get stored tokens
async function getAccessToken(): Promise<string | null> {
  return await SecureStore.getItemAsync(STORAGE_KEYS.ACCESS_TOKEN);
}

async function getRefreshToken(): Promise<string | null> {
  return await SecureStore.getItemAsync(STORAGE_KEYS.REFRESH_TOKEN);
}

// Store tokens
export async function storeTokens(accessToken: string, refreshToken: string): Promise<void> {
  await SecureStore.setItemAsync(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
  await SecureStore.setItemAsync(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
  
  // Store token expiry time
  const expiryTime = Date.now() + API_CONFIG.ACCESS_TOKEN_EXPIRY;
  await SecureStore.setItemAsync(STORAGE_KEYS.TOKEN_EXPIRY, expiryTime.toString());
}

// Clear tokens
export async function clearTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(STORAGE_KEYS.ACCESS_TOKEN);
  await SecureStore.deleteItemAsync(STORAGE_KEYS.REFRESH_TOKEN);
  await SecureStore.deleteItemAsync(STORAGE_KEYS.TOKEN_EXPIRY);
  await SecureStore.deleteItemAsync(STORAGE_KEYS.USER_DATA);
}

// Check if token is expired
async function isTokenExpired(): Promise<boolean> {
  const expiryStr = await SecureStore.getItemAsync(STORAGE_KEYS.TOKEN_EXPIRY);
  if (!expiryStr) return true;
  
  const expiry = parseInt(expiryStr, 10);
  return Date.now() >= expiry;
}

// Refresh access token
let refreshPromise: Promise<void> | null = null;

async function refreshAccessToken(): Promise<void> {
  // Prevent multiple simultaneous refresh attempts
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const refreshToken = await getRefreshToken();
      
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await fetch(`${API_CONFIG.BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      const result: ApiResponse = await response.json();

      if (!result.success || !result.data) {
        throw new Error('Token refresh failed');
      }

      // Store new tokens
      await storeTokens(result.data.access_token, result.data.refresh_token);
    } catch (error) {
      // Clear tokens on refresh failure
      await clearTokens();
      throw error;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// Main API request function
export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_CONFIG.BASE_URL}${endpoint}`;
  
  console.log(`[ApiClient] Request: ${options.method || 'GET'} ${url}`);
  
  // Get access token
  let accessToken = await getAccessToken();
  
  // Check if token is expired and refresh if needed
  if (accessToken && await isTokenExpired()) {
    console.log('[ApiClient] Token expired, refreshing...');
    try {
      await refreshAccessToken();
      accessToken = await getAccessToken();
      console.log('[ApiClient] Token refreshed successfully');
    } catch (error) {
      // Token refresh failed, proceed without token (will get 401)
      console.error('[ApiClient] Token refresh failed:', error);
      accessToken = null;
    }
  }

  // Build headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers as Record<string, string>,
  };

  // Add authorization if token exists
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
    console.log('[ApiClient] Using access token:', accessToken.substring(0, 20) + '...');
  } else {
    console.warn('[ApiClient] No access token available');
  }

  // Add device ID if available
  const deviceId = await SecureStore.getItemAsync('device_id');
  if (deviceId) {
    headers['X-Device-Id'] = deviceId;
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      signal: AbortSignal.timeout(API_CONFIG.TIMEOUT),
    });

    console.log(`[ApiClient] Response status: ${response.status} ${response.statusText}`);

    const result: ApiResponse<T> = await response.json();
    console.log('[ApiClient] Response data:', JSON.stringify(result).substring(0, 200));

    // Handle 401 Unauthorized - token expired
    if (response.status === 401 && accessToken) {
      console.log('[ApiClient] Got 401, attempting token refresh...');
      // Try to refresh token once
      try {
        await refreshAccessToken();
        
        // Retry request with new token
        const newToken = await getAccessToken();
        if (newToken) {
          headers['Authorization'] = `Bearer ${newToken}`;
          console.log('[ApiClient] Retrying request with new token...');
          const retryResponse = await fetch(url, { ...options, headers });
          const retryResult: ApiResponse<T> = await retryResponse.json();
          
          console.log(`[ApiClient] Retry response status: ${retryResponse.status}`);
          
          if (!retryResult.success) {
            console.error('[ApiClient] Retry request failed:', retryResult.error);
            throw new ApiError(
              retryResult.error?.code || 'UNKNOWN_ERROR',
              retryResult.error?.message || 'Request failed',
              retryResult.error?.details
            );
          }
          
          return retryResult.data as T;
        }
      } catch (refreshError) {
        // Refresh failed, clear tokens
        console.error('[ApiClient] Token refresh failed, clearing tokens');
        await clearTokens();
        throw new ApiError('TOKEN_EXPIRED', 'Session expired. Please log in again.');
      }
    }

    // Handle other errors
    if (!result.success) {
      console.error('[ApiClient] API error:', result.error);
      throw new ApiError(
        result.error?.code || 'UNKNOWN_ERROR',
        result.error?.message || 'Request failed',
        result.error?.details
      );
    }

    console.log('[ApiClient] Request successful, returning data');
    return result.data as T;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    
    // Network or other errors
    console.error('[ApiClient] Network error:', error);
    throw new ApiError(
      'NETWORK_ERROR',
      error instanceof Error ? error.message : 'Network request failed'
    );
  }
}

// Convenience methods
export const api = {
  get: <T = any>(endpoint: string, options?: RequestInit) => 
    apiRequest<T>(endpoint, { ...options, method: 'GET' }),
  
  post: <T = any>(endpoint: string, data?: any, options?: RequestInit) => 
    apiRequest<T>(endpoint, { 
      ...options, 
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    }),
  
  put: <T = any>(endpoint: string, data?: any, options?: RequestInit) => 
    apiRequest<T>(endpoint, { 
      ...options, 
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    }),
  
  delete: <T = any>(endpoint: string, options?: RequestInit) => 
    apiRequest<T>(endpoint, { ...options, method: 'DELETE' }),
};
