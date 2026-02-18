import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../services/authService';
import * as authService from '../services/authService';
import { fetchVehiclesFromAPI, clearVehicleCache } from '../services/vehicleService';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  loginWithCookies: (cookies: string) => Promise<void>;
  logout: (allDevices?: boolean) => Promise<void>;
  refreshUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

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
        
        // Verify token in background
        const verifiedUser = await authService.verifyToken();
        if (verifiedUser) {
          setUser(verifiedUser);
        } else {
          // Token invalid, clear state
          setUser(null);
          setIsAuthenticated(false);
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
    
    // Fetch user's vehicles from API - MUST complete before returning
    console.log('[AuthContext] Fetching vehicles from API...');
    try {
      const vehicles = await fetchVehiclesFromAPI();
      console.log(`[AuthContext] Loaded ${vehicles.length} vehicles from API`);
    } catch (error: any) {
      console.error('[AuthContext] Failed to fetch vehicles:', error);
      // Throw with descriptive error message for user
      throw new Error(error?.message || 'Failed to load your vehicles. Please check your internet connection and try again.');
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
    
    // Fetch user's vehicles from API - MUST complete before returning
    console.log('[AuthContext] Fetching vehicles from API...');
    try {
      const vehicles = await fetchVehiclesFromAPI();
      console.log(`[AuthContext] Loaded ${vehicles.length} vehicles from API`);
    } catch (error) {
      console.error('[AuthContext] Failed to fetch vehicles:', error);
      throw new Error('Failed to load your vehicles. Please try again.');
    }
  };

  const logout = async (allDevices: boolean = false) => {
    await authService.logout(allDevices);
    
    // Clear vehicle cache
    await clearVehicleCache();
    
    setUser(null);
    setIsAuthenticated(false);
  };

  const refreshUser = async () => {
    try {
      const updatedUser = await authService.fetchUserProfile();
      setUser(updatedUser);
    } catch (error) {
      console.error('Failed to refresh user:', error);
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
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
