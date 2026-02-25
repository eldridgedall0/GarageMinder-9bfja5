import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { theme } from '../../constants/theme';
import { Button } from '../../components/ui/Button';
import { ActiveTripCard } from '../../components/trip/ActiveTripCard';
import { useTripTracking } from '../../hooks/useTripTracking';
import { useTrips } from '../../hooks/useTrips';
import { useAuth } from '../../hooks/useAuth';
import { useAlert } from '@/template';
import { getAutoStartSettings, getAutoStartState, getBluetoothState } from '../../services/bluetoothService';

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const { isAuthenticated, vehicles, vehiclesLoading, vehicleError, reloadVehicles } = useAuth();
  const [activeVehicleId, setActiveVehicleId] = useState<string | null>(null);
  const activeVehicle = vehicles.find(v => v.id === activeVehicleId) || vehicles[0] || null;
  const { activeTrip, isTracking, startTrip, stopTrip } = useTripTracking({ activeVehicle });
  const { getPendingCount } = useTrips();
  const { showAlert } = useAlert();
  const [showVehicleSelector, setShowVehicleSelector] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [isStartingTrip, setIsStartingTrip] = useState(false);
  const [autoStartEnabled, setAutoStartEnabled] = useState(false);
  const [autoStartPhase, setAutoStartPhase] = useState<string>('idle');
  const [bluetoothState, setBluetoothState] = useState<'on' | 'off' | 'unavailable'>('unavailable');
  const [checkingBluetooth, setCheckingBluetooth] = useState(false);

  // Check AutoStart status and Bluetooth state
  useEffect(() => {
    const checkAutoStart = async () => {
      const settings = await getAutoStartSettings();
      const state = await getAutoStartState();
      const { getBluetoothState } = await import('../../services/bluetoothConnectionService');
      const btState = await getBluetoothState();
      setAutoStartEnabled(settings.enabled);
      setAutoStartPhase(state.phase);
      setBluetoothState(btState);
    };
    checkAutoStart();
    
    // Refresh every 5 seconds
    const interval = setInterval(checkAutoStart, 5000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  const handleCheckBluetoothStatus = async () => {
    setCheckingBluetooth(true);
    try {
      const { getBluetoothState, getConnectedMappedDevice } = await import('../../services/bluetoothConnectionService');
      const btState = await getBluetoothState();
      const connectedDevice = await getConnectedMappedDevice();
      
      setBluetoothState(btState);
      
      let message = '';
      if (btState === 'on') {
        message = 'Bluetooth is ON\n';
        if (connectedDevice) {
          message += `\nConnected to: ${connectedDevice.deviceName}\nVehicle: ${connectedDevice.vehicleName}\nAutoStart: Ready`;
        } else {
          message += '\nNo mapped devices connected\nWaiting for car Bluetooth...';
        }
      } else if (btState === 'off') {
        message = 'Bluetooth is OFF\n\nTurn on Bluetooth to use AutoStart';
      } else {
        message = 'Bluetooth is unavailable on this device';
      }
      
      showAlert('Bluetooth Status', message);
    } catch (error) {
      showAlert('Error', 'Failed to check Bluetooth status');
    } finally {
      setCheckingBluetooth(false);
    }
  };

  // On first load or when vehicles change, set active vehicle from AsyncStorage
  useEffect(() => {
    (async () => {
      const { getActiveVehicle, setActiveVehicle } = await import('../../services/vehicleService');
      const active = await getActiveVehicle();
      if (active) {
        setActiveVehicleId(active.id);
      } else if (vehicles.length > 0) {
        // Set first vehicle as active if none selected
        await setActiveVehicle(vehicles[0].id);
        setActiveVehicleId(vehicles[0].id);
      }
    })();
  }, [vehicles]);



  const handleRetry = async () => {
    setRetrying(true);
    try {
      await reloadVehicles();
      showAlert('Success', 'Vehicles loaded successfully');
    } catch (error: any) {
      console.error('[DashboardScreen] Retry failed:', error);
      
      // Build detailed error message for development debugging
      let errorMessage = '';
      if (error?.message) errorMessage += `Message: ${error.message}\n\n`;
      if (error?.code) errorMessage += `Code: ${error.code}\n\n`;
      if (error?.details) errorMessage += `Details: ${JSON.stringify(error.details, null, 2)}\n\n`;
      if (error?.stack) errorMessage += `Stack:\n${error.stack.split('\n').slice(0, 5).join('\n')}`;
      
      if (!errorMessage) {
        errorMessage = `Unknown error\n\nError: ${JSON.stringify(error, null, 2)}`;
      }
      
      showAlert('Failed to Load Vehicles', errorMessage);
    } finally {
      setRetrying(false);
    }
  };

  const handleStartTrip = async () => {
    if (!activeVehicle) {
      showAlert('No Vehicle Selected', 'Please select a vehicle first');
      return;
    }
    setIsStartingTrip(true);
    try {
      const success = await startTrip();
      if (!success) {
        showAlert(
          'Could Not Start Trip',
          'Location permission is required to track trips. Please enable location access in your device settings and try again.'
        );
      }
    } catch (error: any) {
      showAlert('Error', error?.message || 'Failed to start trip. Please try again.');
    } finally {
      setIsStartingTrip(false);
    }
  };

  const handleStopTrip = () => {
    showAlert('Stop Trip?', 'Are you sure you want to end this trip?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Stop Trip', style: 'destructive', onPress: stopTrip },
    ]);
  };

  const handleVehicleSelect = async (vehicleId: string) => {
    const { setActiveVehicle } = await import('../../services/vehicleService');
    await setActiveVehicle(vehicleId);
    setActiveVehicleId(vehicleId);
    setShowVehicleSelector(false);
  };

  const pendingCount = getPendingCount();

  // Show loading state while vehicles are loading (only on initial load)
  if (vehiclesLoading && vehicles.length === 0 && isAuthenticated) {
    return (
      <View style={[styles.container, styles.loadingContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Loading your vehicles...</Text>
      </View>
    );
  }

  // Show empty state if no vehicles after loading
  const showEmptyState = !vehiclesLoading && vehicles.length === 0 && isAuthenticated;
  if (showEmptyState) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>GarageMinder</Text>
            <Text style={styles.headerSubtitle}>Mileage Tracker</Text>
          </View>
        </View>
        <View style={[styles.container, styles.loadingContainer]}>
          <MaterialIcons name="directions-car-filled" size={64} color={theme.colors.textSubtle} />
          <Text style={styles.emptyStateTitle}>No Vehicles Found</Text>
          <Text style={styles.emptyStateText}>Add a vehicle to your GarageMinder account to start tracking</Text>
          <Button
            title={retrying ? "Loading..." : "Retry"}
            onPress={handleRetry}
            variant="secondary"
            size="small"
            disabled={retrying}
            style={{ marginTop: theme.spacing.lg }}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>GarageMinder</Text>
          <Text style={styles.headerSubtitle}>Mileage Tracker</Text>
        </View>
        {pendingCount > 0 && (
          <View style={styles.pendingBadge}>
            <MaterialIcons name="cloud-upload" size={16} color={theme.colors.pending} />
            <Text style={styles.pendingText}>{pendingCount} pending</Text>
          </View>
        )}
        {autoStartEnabled && !isTracking && (
          <Pressable 
            style={[styles.pendingBadge, { backgroundColor: `${theme.colors.primary}15` }]}
            onPress={handleCheckBluetoothStatus}
          >
            <MaterialIcons
              name={bluetoothState === 'on' ? 'bluetooth-connected' : bluetoothState === 'off' ? 'bluetooth-disabled' : 'bluetooth'}
              size={16}
              color={
                bluetoothState === 'off' ? theme.colors.error :
                autoStartPhase === 'monitoring' ? theme.colors.primary : 
                bluetoothState === 'on' ? theme.colors.success : theme.colors.textSubtle
              }
            />
            <Text style={[styles.pendingText, {
              color: 
                bluetoothState === 'off' ? theme.colors.error :
                autoStartPhase === 'monitoring' ? theme.colors.primary : 
                bluetoothState === 'on' ? theme.colors.success : theme.colors.textSubtle
            }]}>
              {checkingBluetooth ? 'Checking...' :
               bluetoothState === 'off' ? 'BT Off' :
               autoStartPhase === 'monitoring' ? 'Monitoring' : 
               bluetoothState === 'on' ? 'AutoStart Ready' : 'AutoStart On'}
            </Text>
          </Pressable>
        )}
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Vehicle Selector */}
        <Pressable 
          style={styles.vehicleSelector}
          onPress={() => setShowVehicleSelector(!showVehicleSelector)}
        >
          <Image
            source={require('@/assets/images/vehicle-icon.png')}
            style={styles.vehicleIcon}
            contentFit="contain"
            transition={200}
          />
          <View style={styles.vehicleDetails}>
            <Text style={styles.vehicleLabel}>Current Vehicle</Text>
            <Text style={styles.vehicleName}>
              {activeVehicle 
                ? `${activeVehicle.year} ${activeVehicle.make} ${activeVehicle.model}`
                : 'No Vehicle Selected'}
            </Text>
            {activeVehicle && (
              <Text style={styles.vehicleOdometer}>
                Odometer: {activeVehicle.currentOdometer.toLocaleString()} mi
              </Text>
            )}
          </View>
          <MaterialIcons 
            name={showVehicleSelector ? 'expand-less' : 'expand-more'} 
            size={24} 
            color={theme.colors.primary} 
          />
        </Pressable>

        {/* Vehicle List */}
        {showVehicleSelector && (
          <View style={styles.vehicleList}>
            {vehicles.map(vehicle => (
              <Pressable
                key={vehicle.id}
                style={[
                  styles.vehicleItem,
                  activeVehicleId === vehicle.id && styles.vehicleItemActive,
                ]}
                onPress={() => handleVehicleSelect(vehicle.id)}
              >
                <View style={styles.vehicleItemDetails}>
                  <Text style={styles.vehicleItemName}>
                    {vehicle.year} {vehicle.make} {vehicle.model}
                  </Text>
                  <Text style={styles.vehicleItemOdometer}>
                    {vehicle.currentOdometer.toLocaleString()} mi
                  </Text>
                </View>
                {activeVehicleId === vehicle.id && (
                  <MaterialIcons name="check-circle" size={20} color={theme.colors.primary} />
                )}
              </Pressable>
            ))}
          </View>
        )}

        {/* Active Trip or Start Button */}
        {isTracking && activeTrip ? (
          <>
            <ActiveTripCard trip={activeTrip} vehicle={activeVehicle} />
            <Button
              title="Stop Trip"
              onPress={handleStopTrip}
              variant="danger"
              size="large"
              style={styles.actionButton}
            />
          </>
        ) : (
          <View style={styles.startSection}>
            <Text style={styles.startTitle}>Ready to Track</Text>
            <Text style={styles.startDescription}>
              Tap below to start recording your trip. Distance and time will be tracked automatically.
            </Text>
            <Button
              title={isStartingTrip ? "Starting..." : "Start Trip"}
              onPress={handleStartTrip}
              size="large"
              disabled={isStartingTrip || !activeVehicle}
              style={styles.actionButton}
            />
            <View style={styles.features}>
              <View style={styles.featureItem}>
                <MaterialIcons name="location-on" size={20} color={theme.colors.primary} />
                <Text style={styles.featureText}>GPS Tracking</Text>
              </View>
              <View style={styles.featureItem}>
                <MaterialIcons name="trending-up" size={20} color={theme.colors.primary} />
                <Text style={styles.featureText}>Live Metrics</Text>
              </View>
              <View style={styles.featureItem}>
                <MaterialIcons name="privacy-tip" size={20} color={theme.colors.primary} />
                <Text style={styles.featureText}>Private & Secure</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
  },
  headerTitle: {
    fontSize: theme.typography.headlineLarge,
    fontWeight: theme.typography.weightBold,
    color: theme.colors.text,
    includeFontPadding: false,
  },
  headerSubtitle: {
    fontSize: theme.typography.bodySmall,
    color: theme.colors.textSecondary,
    marginTop: 2,
    includeFontPadding: false,
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${theme.colors.pending}20`,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.full,
  },
  pendingText: {
    fontSize: theme.typography.labelSmall,
    color: theme.colors.pending,
    marginLeft: 6,
    fontWeight: theme.typography.weightMedium,
    includeFontPadding: false,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: theme.spacing.md,
  },
  vehicleSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  vehicleIcon: {
    width: 48,
    height: 48,
    marginRight: theme.spacing.md,
  },
  vehicleDetails: {
    flex: 1,
  },
  vehicleLabel: {
    fontSize: theme.typography.labelSmall,
    color: theme.colors.textSubtle,
    marginBottom: 2,
    includeFontPadding: false,
  },
  vehicleName: {
    fontSize: theme.typography.bodyLarge,
    fontWeight: theme.typography.weightSemiBold,
    color: theme.colors.text,
    marginBottom: 2,
    includeFontPadding: false,
  },
  vehicleOdometer: {
    fontSize: theme.typography.bodySmall,
    color: theme.colors.textSecondary,
    includeFontPadding: false,
  },
  vehicleList: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  vehicleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderSubtle,
  },
  vehicleItemActive: {
    backgroundColor: `${theme.colors.primary}10`,
  },
  vehicleItemDetails: {
    flex: 1,
  },
  vehicleItemName: {
    fontSize: theme.typography.bodyMedium,
    fontWeight: theme.typography.weightMedium,
    color: theme.colors.text,
    marginBottom: 2,
    includeFontPadding: false,
  },
  vehicleItemOdometer: {
    fontSize: theme.typography.bodySmall,
    color: theme.colors.textSecondary,
    includeFontPadding: false,
  },
  startSection: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
  },
  startTitle: {
    fontSize: theme.typography.headlineMedium,
    fontWeight: theme.typography.weightBold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    includeFontPadding: false,
  },
  startDescription: {
    fontSize: theme.typography.bodyMedium,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
    lineHeight: theme.typography.bodyMedium * theme.typography.lineHeightRelaxed,
  },
  actionButton: {
    width: '100%',
  },
  features: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: theme.spacing.xl,
  },
  featureItem: {
    alignItems: 'center',
  },
  featureText: {
    fontSize: theme.typography.labelSmall,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.sm,
    includeFontPadding: false,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: theme.typography.bodyMedium,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.md,
    includeFontPadding: false,
  },
  emptyStateTitle: {
    fontSize: theme.typography.headlineMedium,
    fontWeight: theme.typography.weightBold,
    color: theme.colors.text,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
    includeFontPadding: false,
  },
  emptyStateText: {
    fontSize: theme.typography.bodyMedium,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: theme.spacing.xl,
    lineHeight: theme.typography.bodyMedium * 1.5,
    includeFontPadding: false,
  },
});
