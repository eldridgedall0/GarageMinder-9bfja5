import { Stack, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AlertProvider } from '@/template';
import { useEffect } from 'react';
import { initializeStorage } from '../services/tripService';
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { LOCATION_TASK_NAME_EXPORT } from '../services/locationService';
import { AuthProvider } from '../contexts/AuthContext';
import { useAuth } from '../hooks/useAuth';

// Define background location task
TaskManager.defineTask(LOCATION_TASK_NAME_EXPORT, async ({ data, error }: any) => {
  if (error) {
    console.error('Background location error:', error);
    return;
  }

  if (data) {
    const { locations } = data;
    // Location updates are handled in the active trip hook
    // This task ensures tracking continues when app is backgrounded
    console.log('Background location update:', locations?.length || 0, 'points');
  }
});

// Protected route wrapper
function RootLayoutNav() {
  const { isAuthenticated, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(tabs)';

    if (!isAuthenticated && inAuthGroup) {
      // Redirect to welcome if not authenticated
      router.replace('/welcome');
    } else if (isAuthenticated && !inAuthGroup && segments[0] !== 'trip-details') {
      // Redirect to app if authenticated
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, segments, isLoading]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#0a0a0a' },
      }}
    >
      <Stack.Screen name="welcome" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen 
        name="trip-details" 
        options={{ 
          headerShown: true,
          headerStyle: { backgroundColor: '#0a0a0a' },
          headerTintColor: '#FFD700',
          headerTitle: 'Trip Details',
        }} 
      />
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    initializeStorage();
    
    // Request notification permissions
    (async () => {
      const { requestNotificationPermissions } = await import('../services/notificationService');
      await requestNotificationPermissions();
    })();
  }, []);

  return (
    <AlertProvider>
      <AuthProvider>
        <SafeAreaProvider>
          <StatusBar style="light" />
          <RootLayoutNav />
        </SafeAreaProvider>
      </AuthProvider>
    </AlertProvider>
  );
}
