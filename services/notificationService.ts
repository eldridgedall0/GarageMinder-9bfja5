import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function requestNotificationPermissions(): Promise<boolean> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  
  return finalStatus === 'granted';
}

export async function scheduleNotification(
  title: string,
  body: string,
  data?: any
): Promise<string> {
  return await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
    },
    trigger: null, // Show immediately
  });
}

export async function showSyncNotification(
  tripCount: number,
  totalMiles: number
): Promise<void> {
  await scheduleNotification(
    'Sync Complete',
    `${tripCount} trips synced (+${totalMiles} miles)`,
    { type: 'sync_complete' }
  );
}

export async function showSyncErrorNotification(): Promise<void> {
  await scheduleNotification(
    'Sync Failed',
    'Unable to sync trips. Tap to retry.',
    { type: 'sync_failed' }
  );
}

export async function showSyncProgressNotification(
  current: number,
  total: number
): Promise<void> {
  await scheduleNotification(
    'Syncing Trips',
    `Uploading ${current} of ${total} trips...`,
    { type: 'sync_progress' }
  );
}

export async function showTripStartedNotification(vehicleName: string): Promise<void> {
  await scheduleNotification(
    'Trip Started',
    `Tracking mileage for ${vehicleName}`,
    { type: 'trip_started' }
  );
}

export async function showTripCompletedNotification(
  distance: number,
  duration: number
): Promise<void> {
  const minutes = Math.floor(duration / 60000);
  await scheduleNotification(
    'Trip Completed',
    `${distance.toFixed(1)} miles • ${minutes} minutes`,
    { type: 'trip_completed' }
  );
}

export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function setBadgeCount(count: number): Promise<void> {
  if (Platform.OS === 'ios') {
    await Notifications.setBadgeCountAsync(count);
  }
}
