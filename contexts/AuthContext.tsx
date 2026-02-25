import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../services/authService';
import * as authService from '../services/authService';
import { fetchVehiclesFromAPI, clearVehicleCache } from '../services/vehicleService';
import { Vehicle } from '../types/trip';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  loginWithCookies: (cookies: string) => Promise<void>;
  logout: (allDevices?: boolean) => Promise<void>;
  refreshUser: () => Promise<void>;
  vehicles: Vehicle[];
  vehiclesLoading: boolean;
  vehicleError: string | null;
  reloadVehicles: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(false);
  const [vehicleError, setVehicleError] = useState<string | null>(null);

  // Check authentication status on mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      setIsLoading(true);
      
      const authenticated = await authService.isAuthenticated();
      
      if (authenticated) {
        // Try to get cached user first
        const cachedUser = await authService.getCurrentUser();
        setUser(cachedUser);
        setIsAuthenticated(true);

        // Load vehicles from local cache immediately so UI isn't empty
        const { getVehicles } = await import('../services/vehicleService');
        const cachedVehicles = await getVehicles();
        if (cachedVehicles.length > 0) {
          setVehicles(cachedVehicles);
        }
        
        // Verify token in background
        const verifiedUser = await authService.verifyToken();
        if (verifiedUser) {
          setUser(verifiedUser);
          // Refresh vehicles from API in background (non-blocking)
          fetchVehiclesFromAPI()
            .then(freshVehicles => setVehicles(freshVehicles))
            .catch(err => console.warn('[AuthContext] Background vehicle refresh failed:', err));
        } else {
          // Token invalid, clear state
          setUser(null);
          setIsAuthenticated(false);
          setVehicles([]);
        }
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('Auth status check failed:', error);
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (username: string, password: string) => {
    // Clear old vehicle cache before logging in
    console.log('[AuthContext] Clearing old vehicle cache...');
    await clearVehicleCache();
    
    // Login and get user
    console.log('[AuthContext] Logging in...');
    const loggedInUser = await authService.login(username, password);
    setUser(loggedInUser);
    setIsAuthenticated(true);
    
    // Fetch user's vehicles from API and store in context state directly
    console.log('[AuthContext] Fetching vehicles from API...');
    setVehiclesLoading(true);
    setVehicleError(null);
    try {
      const fetchedVehicles = await fetchVehiclesFromAPI();
      setVehicles(fetchedVehicles); // Set directly in context, no cache read needed
      console.log(`[AuthContext] Loaded ${fetchedVehicles.length} vehicles from API`);
    } catch (error: any) {
      console.error('[AuthContext] Failed to fetch vehicles:', error);
      
      // Build detailed error message for development
      let detailedError = `Error: ${error?.message || 'Unknown error'}\n`;
      if (error?.code) detailedError += `Code: ${error.code}\n`;
      if (error?.details) detailedError += `Details: ${JSON.stringify(error.details)}\n`;
      if (error?.stack) detailedError += `Stack: ${error.stack.split('\n').slice(0, 3).join('\n')}`;
      
      setVehicleError(detailedError);
      throw error; // Throw the original error with all details
    } finally {
      setVehiclesLoading(false);
    }
  };

  const loginWithCookies = async (cookies: string) => {
    // Clear old vehicle cache
    console.log('[AuthContext] Clearing old vehicle cache...');
    await clearVehicleCache();
    
    // Exchange token and get user
    const loggedInUser = await authService.exchangeToken(cookies);
    setUser(loggedInUser);
    setIsAuthenticated(true);
    
    // Fetch user's vehicles from API and store in context state directly
    console.log('[AuthContext] Fetching vehicles from API...');
    setVehiclesLoading(true);
    setVehicleError(null);
    try {
      const fetchedVehicles = await fetchVehiclesFromAPI();
      setVehicles(fetchedVehicles); // Set directly in context, no cache read needed
      console.log(`[AuthContext] Loaded ${fetchedVehicles.length} vehicles from API`);
    } catch (error: any) {
      console.error('[AuthContext] Failed to fetch vehicles:', error);
      
      // Build detailed error message for development
      let detailedError = `Error: ${error?.message || 'Unknown error'}\n`;
      if (error?.code) detailedError += `Code: ${error.code}\n`;
      if (error?.details) detailedError += `Details: ${JSON.stringify(error.details)}\n`;
      if (error?.stack) detailedError += `Stack: ${error.stack.split('\n').slice(0, 3).join('\n')}`;
      
      setVehicleError(detailedError);
      throw error; // Throw the original error with all details
    } finally {
      setVehiclesLoading(false);
    }
  };

  const logout = async (allDevices: boolean = false) => {
    await authService.logout(allDevices);
    
    // Clear vehicle cache
    await clearVehicleCache();
    
    setUser(null);
    setIsAuthenticated(false);
    setVehicles([]);
    setVehicleError(null);
  };

  const refreshUser = async () => {
    try {
      const updatedUser = await authService.fetchUserProfile();
      setUser(updatedUser);
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }
  };

  const reloadVehicles = async () => {
    setVehiclesLoading(true);
    setVehicleError(null);
    try {
      const freshVehicles = await fetchVehiclesFromAPI();
      setVehicles(freshVehicles);
      console.log(`[AuthContext] Reloaded ${freshVehicles.length} vehicles from API`);
    } catch (error: any) {
      console.error('[AuthContext] Failed to reload vehicles:', error);
      
      // Build detailed error message for development
      let detailedError = `Error: ${error?.message || 'Unknown error'}\n`;
      if (error?.code) detailedError += `Code: ${error.code}\n`;
      if (error?.details) detailedError += `Details: ${JSON.stringify(error.details)}\n`;
      if (error?.stack) detailedError += `Stack: ${error.stack.split('\n').slice(0, 3).join('\n')}`;
      
      setVehicleError(detailedError);
      throw error;
    } finally {
      setVehiclesLoading(false);
    }
  };

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated,
    login,
    loginWithCookies,
    logout,
    refreshUser,
    vehicles,
    vehiclesLoading,
    vehicleError,
    reloadVehicles,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}