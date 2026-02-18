import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, Pressable, TextInput, ActivityIndicator, AppState, AppStateStatus } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { 
  getSubscriptionLevel, 
  setSubscriptionLevel, 
  getSyncSettings, 
  updateSyncSettings,
  type SubscriptionLevel,
  type SyncSettings 
} from '../../services/subscriptionService';
import { 
  checkBiometricCapability, 
  isBiometricEnabled, 
  enableBiometric, 
  disableBiometric 
} from '../../services/biometricService';
import { useAlert } from '@/template';
import { useAuth } from '../../hooks/useAuth';
import {
  checkAllPermissions,
  requestPermission,
  openAppSettings,
  getPermissionStatusLabel,
  getPermissionStatusColor,
  type AppPermission,
} from '../../services/permissionsService';
import { BluetoothDevicePickerModal } from '../../components/bluetooth/BluetoothDevicePickerModal';
import { VehicleAssignBottomSheet } from '../../components/bluetooth/VehicleAssignBottomSheet';
import {
  getAutoStartSettings,
  updateAutoStartSettings,
  getDeviceMappings,
  addDeviceMapping,
  removeDeviceMapping,
  updateDeviceMapping,
  createDeviceIdFromName,
  type AutoStartSettings,
  type BluetoothDeviceMapping,
  type SpeedThreshold,
  type TripClassification,
} from '../../services/bluetoothService';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();
  const { user, logout, vehicles } = useAuth();
  
  const [subscription, setSubscription] = useState<SubscriptionLevel>('free');
  const [syncSettings, setSyncSettings] = useState<SyncSettings | null>(null);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [autoStartSettings, setAutoStartSettings] = useState<AutoStartSettings | null>(null);
  const [deviceMappings, setDeviceMappings] = useState<BluetoothDeviceMapping[]>([]);
  const [showDevicePicker, setShowDevicePicker] = useState(false);
  const [pendingDevice, setPendingDevice] = useState<{ id: string; name: string } | null>(null);
  const [showVehicleAssign, setShowVehicleAssign] = useState(false);
  const [permissions, setPermissions] = useState<AppPermission[]>([]);
  const [permissionsLoading, setPermissionsLoading] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        // Re-check permissions when user returns from device settings
        const perms = await checkAllPermissions();
        setPermissions(perms);
      }
    });
    return () => subscription.remove();
  }, []);

  const loadSettings = async () => {
    const level = await getSubscriptionLevel();
    const settings = await getSyncSettings();
    const capability = await checkBiometricCapability();
    const bioEnabled = await isBiometricEnabled();
    const autoStart = await getAutoStartSettings();
    const mappings = await getDeviceMappings();
    const perms = await checkAllPermissions();

    setSubscription(level);
    setSyncSettings(settings);
    setBiometricAvailable(capability.isAvailable);
    setBiometricEnabled(bioEnabled);
    setAutoStartSettings(autoStart);
    setDeviceMappings(mappings);
    setPermissions(perms);
  };

  const handleSubscriptionToggle = async () => {
    const newLevel: SubscriptionLevel = subscription === 'free' ? 'paid' : 'free';
    await setSubscriptionLevel(newLevel);
    setSubscription(newLevel);
    
    showAlert(
      'Subscription Updated',
      `You are now on the ${newLevel} plan${newLevel === 'paid' ? '. Auto-sync features unlocked!' : '.'}`
    );
  };

  const handleAutoSyncToggle = async (enabled: boolean) => {
    if (subscription === 'free' && enabled) {
      showAlert('Upgrade Required', 'Auto-sync is only available for paid subscribers');
      return;
    }

    await updateSyncSettings({ autoSyncEnabled: enabled });
    setSyncSettings(prev => prev ? { ...prev, autoSyncEnabled: enabled } : null);
  };

  const handleBiometricToggle = async (enabled: boolean) => {
    if (enabled) {
      const success = await enableBiometric();
      if (success) {
        setBiometricEnabled(true);
        showAlert('Biometric Enabled', 'You can now use biometric authentication to unlock the app');
      } else {
        showAlert('Failed', 'Could not enable biometric authentication');
      }
    } else {
      await disableBiometric();
      setBiometricEnabled(false);
      showAlert('Biometric Disabled', 'Biometric authentication has been disabled');
    }
  };

  const handleAutoStartToggle = async (enabled: boolean) => {
    const updated = await updateAutoStartSettings({ enabled });
    setAutoStartSettings(updated);
  };

  const handleSpeedThresholdChange = async (value: SpeedThreshold) => {
    const updated = await updateAutoStartSettings({ speedThreshold: value });
    setAutoStartSettings(updated);
  };

  const handleStopTimeoutChange = async (minutes: number) => {
    const updated = await updateAutoStartSettings({ stopTimeoutMinutes: minutes });
    setAutoStartSettings(updated);
  };

  const handleDetectionWindowChange = async (minutes: number) => {
    const updated = await updateAutoStartSettings({ detectionWindowMinutes: minutes });
    setAutoStartSettings(updated);
  };

  const handleTripClassificationChange = async (value: TripClassification) => {
    const updated = await updateAutoStartSettings({ tripClassification: value });
    setAutoStartSettings(updated);
  };

  const handleDeviceSelected = async (device: { id: string; name: string }) => {
    // Add device with no vehicle yet
    await addDeviceMapping({
      deviceId: device.id,
      deviceName: device.name,
      vehicleId: '',
      vehicleName: 'Not assigned',
      enabled: true,
    });
    const updated = await getDeviceMappings();
    setDeviceMappings(updated);
    // Now show vehicle assignment
    setPendingDevice(device);
    setShowVehicleAssign(true);
  };

  const handleVehicleAssigned = async (vehicleId: string, vehicleName: string) => {
    if (!pendingDevice) return;
    await updateDeviceMapping(pendingDevice.id, { vehicleId, vehicleName });
    const updated = await getDeviceMappings();
    setDeviceMappings(updated);
    setPendingDevice(null);
    setShowVehicleAssign(false);
  };

  const handleVehicleAssignSkipped = () => {
    setPendingDevice(null);
    setShowVehicleAssign(false);
  };

  const handleRemoveDevice = async (deviceId: string) => {
    showAlert(
      'Remove Device',
      'Remove this Bluetooth device trigger? Trips will no longer auto-start when you connect to it.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await removeDeviceMapping(deviceId);
            const updated = await getDeviceMappings();
            setDeviceMappings(updated);
          },
        },
      ]
    );
  };

  const handlePermissionAction = async (permission: AppPermission) => {
    if (permission.status === 'granted') return; // Nothing to do

    if (permission.requiresNativeSettings || permission.status === 'denied') {
      // Can't re-request denied permissions in-app — must go to settings
      showAlert(
        `${permission.title} Permission Required`,
        `This permission was denied. To enable it, go to your device Settings → Apps → GarageMinder → Permissions and allow "${permission.title}".`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Open Settings',
            onPress: () => openAppSettings(),
          },
        ]
      );
      return;
    }

    // Permission not asked yet — request it inline
    setPermissionsLoading(true);
    try {
      const result = await requestPermission(permission.key);
      const updated = await checkAllPermissions();
      setPermissions(updated);

      if (result === 'granted') {
        showAlert('Permission Granted', `${permission.title} has been enabled.`);
      } else if (result === 'denied') {
        showAlert(
          'Permission Denied',
          `${permission.title} was denied. You can enable it in your device Settings → Apps → GarageMinder → Permissions.`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => openAppSettings() },
          ]
        );
      }
    } finally {
      setPermissionsLoading(false);
    }
  };

  const handleLogout = () => {
    showAlert(
      'Sign Out',
      'Are you sure you want to sign out? Your local trip data will remain on this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Sign Out', 
          style: 'destructive',
          onPress: async () => {
            setIsLoggingOut(true);
            try {
              await logout();
              // Navigation is handled by AuthProvider
            } catch (error) {
              showAlert('Error', 'Failed to sign out. Please try again.');
            } finally {
              setIsLoggingOut(false);
            }
          }
        },
      ]
    );
  };

  const SettingRow = ({ 
    icon, 
    title, 
    value, 
    onPress,
    rightElement 
  }: { 
    icon: keyof typeof MaterialIcons.glyphMap; 
    title: string; 
    value?: string; 
    onPress?: () => void;
    rightElement?: React.ReactNode;
  }) => (
    <Pressable 
      style={({ pressed }) => [styles.settingItem, pressed && !rightElement && styles.settingItemPressed]}
      onPress={onPress}
      disabled={!!rightElement}
    >
      <MaterialIcons name={icon} size={24} color={theme.colors.primary} />
      <View style={styles.settingContent}>
        <Text style={styles.settingTitle}>{title}</Text>
        {value && <Text style={styles.settingValue}>{value}</Text>}
      </View>
      {rightElement || <MaterialIcons name="chevron-right" size={24} color={theme.colors.textSubtle} />}
    </Pressable>
  );

  if (!syncSettings) {
    return null;
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Account Section */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          
          {user && (
            <View style={styles.accountInfo}>
              <View style={styles.accountHeader}>
                <MaterialIcons name="account-circle" size={48} color={theme.colors.primary} />
                <View style={styles.accountDetails}>
                  <Text style={styles.accountName}>{user.display_name}</Text>
                  <Text style={styles.accountEmail}>{user.email}</Text>
                  <View style={styles.accountBadge}>
                    <MaterialIcons 
                      name={user.subscription_level === 'paid' ? 'workspace-premium' : 'person'} 
                      size={14} 
                      color={theme.colors.primary} 
                    />
                    <Text style={styles.accountBadgeText}>
                      {user.subscription_level === 'paid' ? 'Paid' : 'Free'}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          )}

          <Button
            title={isLoggingOut ? 'Signing Out...' : 'Sign Out'}
            onPress={handleLogout}
            variant="secondary"
            disabled={isLoggingOut}
            style={{ marginTop: theme.spacing.md }}
          />
        </Card>

        {/* Subscription Section */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Subscription</Text>
          
          <View style={styles.subscriptionCard}>
            <View style={styles.subscriptionHeader}>
              <MaterialIcons 
                name={subscription === 'paid' ? 'workspace-premium' : 'person'} 
                size={32} 
                color={theme.colors.primary} 
              />
              <View style={styles.subscriptionInfo}>
                <Text style={styles.subscriptionLevel}>
                  {subscription === 'paid' ? 'Paid Subscriber' : 'Free Plan'}
                </Text>
                <Text style={styles.subscriptionDescription}>
                  {subscription === 'paid' 
                    ? 'Auto-sync & premium features enabled' 
                    : 'Manual sync only'}
                </Text>
              </View>
            </View>
            <Button
              title={subscription === 'paid' ? 'Downgrade to Free' : 'Upgrade to Paid'}
              onPress={handleSubscriptionToggle}
              variant={subscription === 'paid' ? 'secondary' : 'primary'}
              size="small"
            />
          </View>
        </Card>

        {/* ── AutoStart Section ──────────────────────────────────────────── */}
        {autoStartSettings && (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>AutoStart</Text>

            {/* Master Toggle */}
            <View style={styles.autoStartHeader}>
              <View style={styles.autoStartHeaderText}>
                <View style={styles.autoStartTitleRow}>
                  <MaterialIcons name="bluetooth" size={20} color={theme.colors.primary} />
                  <Text style={styles.autoStartTitle}>Bluetooth AutoStart</Text>
                </View>
                <Text style={styles.autoStartSubtitle}>
                  Automatically start and stop trips when you connect to your car's Bluetooth
                </Text>
              </View>
              <Switch
                value={autoStartSettings.enabled}
                onValueChange={handleAutoStartToggle}
                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                thumbColor={theme.colors.text}
              />
            </View>

            {/* Everything below only visible when AutoStart is ON */}
            {autoStartSettings.enabled && (
              <>
                {/* Divider */}
                <View style={styles.divider} />

                {/* Linked Bluetooth Devices */}
                <Text style={styles.subSectionTitle}>Bluetooth Devices</Text>
                <Text style={styles.subSectionHint}>
                  Add your car's Bluetooth name as it appears in your phone's Bluetooth settings (e.g. "Toyota Audio", "Honda Hands-Free")
                </Text>

                {deviceMappings.length === 0 ? (
                  <View style={styles.emptyDevices}>
                    <MaterialIcons name="bluetooth-searching" size={32} color={theme.colors.textSubtle} />
                    <Text style={styles.emptyDevicesText}>No devices added yet</Text>
                    <Text style={styles.emptyDevicesHint}>
                      Tap "Add Device" below, then enter the name of your car's Bluetooth as shown in your phone settings
                    </Text>
                  </View>
                ) : (
                  <View style={styles.deviceList}>
                    {deviceMappings.map((mapping) => (
                      <View key={mapping.deviceId} style={styles.deviceItem}>
                        <View style={styles.deviceItemLeft}>
                          <View style={styles.deviceIconCircle}>
                            <MaterialIcons name="bluetooth" size={18} color={theme.colors.primary} />
                          </View>
                          <View style={styles.deviceItemInfo}>
                            <Text style={styles.deviceName}>{mapping.deviceName}</Text>
                            <Pressable
                              onPress={() => {
                                setPendingDevice({ id: mapping.deviceId, name: mapping.deviceName });
                                setShowVehicleAssign(true);
                              }}
                            >
                              <Text style={[
                                styles.deviceVehicle,
                                !mapping.vehicleId && styles.deviceVehicleUnset
                              ]}>
                                {mapping.vehicleId
                                  ? `→ ${mapping.vehicleName}`
                                  : 'Tap to assign vehicle →'}
                              </Text>
                            </Pressable>
                          </View>
                        </View>
                        <View style={styles.deviceItemRight}>
                          <Switch
                            value={mapping.enabled}
                            onValueChange={async (val) => {
                              await updateDeviceMapping(mapping.deviceId, { enabled: val });
                              const updated = await getDeviceMappings();
                              setDeviceMappings(updated);
                            }}
                            trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                            thumbColor={theme.colors.text}
                            style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                          />
                          <Pressable
                            onPress={() => handleRemoveDevice(mapping.deviceId)}
                            style={styles.removeButton}
                          >
                            <MaterialIcons name="delete-outline" size={20} color={theme.colors.error || '#FF4444'} />
                          </Pressable>
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {/* Add Device Button */}
                <Pressable
                  style={styles.addDeviceButton}
                  onPress={() => setShowDevicePicker(true)}
                >
                  <MaterialIcons name="add" size={18} color={theme.colors.primary} />
                  <Text style={styles.addDeviceButtonText}>Add Bluetooth Device</Text>
                </Pressable>

                {/* Modals */}
                <BluetoothDevicePickerModal
                  visible={showDevicePicker}
                  onClose={() => setShowDevicePicker(false)}
                  onDeviceSelected={handleDeviceSelected}
                  alreadyMappedIds={deviceMappings.map(m => m.deviceId)}
                />

                <VehicleAssignBottomSheet
                  visible={showVehicleAssign}
                  deviceName={pendingDevice?.name || ''}
                  vehicles={vehicles}
                  currentVehicleId={pendingDevice ? deviceMappings.find(m => m.deviceId === pendingDevice.id)?.vehicleId : undefined}
                  onAssign={handleVehicleAssigned}
                  onSkip={handleVehicleAssignSkipped}
                  onClose={handleVehicleAssignSkipped}
                />

                <View style={styles.divider} />

                {/* Monitoring Notification Toggle */}
                <SettingRow
                  icon="notifications-none"
                  title="Show Monitoring Notification"
                  value="Subtle notification while waiting for movement"
                  rightElement={
                    <Switch
                      value={autoStartSettings.showMonitoringNotification}
                      onValueChange={(val) => updateAutoStartSettings({ showMonitoringNotification: val }).then(setAutoStartSettings)}
                      trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                      thumbColor={theme.colors.text}
                    />
                  }
                />

                {/* Show Edit After Trip Toggle */}
                <SettingRow
                  icon="edit"
                  title="Review Trip After Auto-Stop"
                  value="Show trip summary when tracking ends automatically"
                  rightElement={
                    <Switch
                      value={autoStartSettings.showEditAfterTrip}
                      onValueChange={(val) => updateAutoStartSettings({ showEditAfterTrip: val }).then(setAutoStartSettings)}
                      trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                      thumbColor={theme.colors.text}
                    />
                  }
                />
              </>
            )}
          </Card>
        )}

        {/* ── Trip Logging Settings Section ──────────────────────────────── */}
        {autoStartSettings && (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Trip Logging</Text>

            {/* Speed Threshold */}
            <View style={styles.tripSettingGroup}>
              <View style={styles.tripSettingHeader}>
                <MaterialIcons name="speed" size={20} color={theme.colors.primary} />
                <View style={styles.tripSettingHeaderText}>
                  <Text style={styles.tripSettingTitle}>Trip Start Threshold</Text>
                  <Text style={styles.tripSettingSubtitle}>
                    How fast you need to be moving before a trip officially starts after Bluetooth connects
                  </Text>
                </View>
              </View>
              <View style={styles.optionPills}>
                {(['immediate', 3, 5, 10, 15] as SpeedThreshold[]).map((option) => (
                  <Pressable
                    key={String(option)}
                    style={[
                      styles.optionPill,
                      autoStartSettings.speedThreshold === option && styles.optionPillActive,
                    ]}
                    onPress={() => handleSpeedThresholdChange(option)}
                  >
                    <Text style={[
                      styles.optionPillText,
                      autoStartSettings.speedThreshold === option && styles.optionPillTextActive,
                    ]}>
                      {option === 'immediate' ? 'Instant' : `${option} mph`}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.divider} />

            {/* Detection Window */}
            <View style={styles.tripSettingGroup}>
              <View style={styles.tripSettingHeader}>
                <MaterialIcons name="timer" size={20} color={theme.colors.primary} />
                <View style={styles.tripSettingHeaderText}>
                  <Text style={styles.tripSettingTitle}>Start Detection Window</Text>
                  <Text style={styles.tripSettingSubtitle}>
                    How long to wait for movement after Bluetooth connects before giving up
                  </Text>
                </View>
              </View>
              <View style={styles.optionPills}>
                {[5, 10, 15, 20, 30].map((minutes) => (
                  <Pressable
                    key={minutes}
                    style={[
                      styles.optionPill,
                      autoStartSettings.detectionWindowMinutes === minutes && styles.optionPillActive,
                    ]}
                    onPress={() => handleDetectionWindowChange(minutes)}
                  >
                    <Text style={[
                      styles.optionPillText,
                      autoStartSettings.detectionWindowMinutes === minutes && styles.optionPillTextActive,
                    ]}>
                      {minutes} min
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.divider} />

            {/* Stop Timeout */}
            <View style={styles.tripSettingGroup}>
              <View style={styles.tripSettingHeader}>
                <MaterialIcons name="pause-circle-outline" size={20} color={theme.colors.primary} />
                <View style={styles.tripSettingHeaderText}>
                  <Text style={styles.tripSettingTitle}>Trip Stop Timeout</Text>
                  <Text style={styles.tripSettingSubtitle}>
                    Grace period after Bluetooth disconnects before the trip ends. Handles tunnels, parking briefly, etc.
                  </Text>
                </View>
              </View>
              <View style={styles.optionPills}>
                {[2, 3, 5, 10, 15].map((minutes) => (
                  <Pressable
                    key={minutes}
                    style={[
                      styles.optionPill,
                      autoStartSettings.stopTimeoutMinutes === minutes && styles.optionPillActive,
                    ]}
                    onPress={() => handleStopTimeoutChange(minutes)}
                  >
                    <Text style={[
                      styles.optionPillText,
                      autoStartSettings.stopTimeoutMinutes === minutes && styles.optionPillTextActive,
                    ]}>
                      {minutes} min
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.divider} />

            {/* Default Trip Classification */}
            <View style={styles.tripSettingGroup}>
              <View style={styles.tripSettingHeader}>
                <MaterialIcons name="label-outline" size={20} color={theme.colors.primary} />
                <View style={styles.tripSettingHeaderText}>
                  <Text style={styles.tripSettingTitle}>Default Trip Type</Text>
                  <Text style={styles.tripSettingSubtitle}>
                    How auto-tracked trips are classified
                  </Text>
                </View>
              </View>
              <View style={styles.optionPills}>
                {([
                  { value: 'personal', label: 'Personal' },
                  { value: 'business', label: 'Business' },
                  { value: 'ask', label: 'Ask Me' },
                ] as { value: TripClassification; label: string }[]).map((option) => (
                  <Pressable
                    key={option.value}
                    style={[
                      styles.optionPill,
                      autoStartSettings.tripClassification === option.value && styles.optionPillActive,
                    ]}
                    onPress={() => handleTripClassificationChange(option.value)}
                  >
                    <Text style={[
                      styles.optionPillText,
                      autoStartSettings.tripClassification === option.value && styles.optionPillTextActive,
                    ]}>
                      {option.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </Card>
        )}

        {/* Sync Section */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Synchronization</Text>
          
          <SettingRow
            icon="sync"
            title="Auto Sync"
            value={subscription === 'free' ? 'Paid Feature' : (syncSettings.autoSyncEnabled ? 'Enabled' : 'Disabled')}
            rightElement={
              <Switch
                value={syncSettings.autoSyncEnabled}
                onValueChange={handleAutoSyncToggle}
                disabled={subscription === 'free'}
                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                thumbColor={theme.colors.text}
              />
            }
          />
          
          <SettingRow
            icon="notifications"
            title="Sync Notifications"
            rightElement={
              <Switch
                value={syncSettings.showSyncNotifications}
                onValueChange={(val) => updateSyncSettings({ showSyncNotifications: val })}
                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                thumbColor={theme.colors.text}
              />
            }
          />
          
          <SettingRow
            icon="wifi"
            title="Sync on Mobile Data"
            rightElement={
              <Switch
                value={syncSettings.syncOverMobileData}
                onValueChange={(val) => updateSyncSettings({ syncOverMobileData: val })}
                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                thumbColor={theme.colors.text}
              />
            }
          />
        </Card>

        {/* ── App Permissions Section ──────────────────────────────────────── */}
        <Card style={styles.section}>
          <View style={styles.permissionsHeader}>
            <Text style={styles.sectionTitle}>App Permissions</Text>
            <Pressable
              onPress={async () => {
                setPermissionsLoading(true);
                const perms = await checkAllPermissions();
                setPermissions(perms);
                setPermissionsLoading(false);
              }}
              style={styles.permissionsRefresh}
            >
              {permissionsLoading
                ? <ActivityIndicator size="small" color={theme.colors.primary} />
                : <MaterialIcons name="refresh" size={20} color={theme.colors.primary} />
              }
            </Pressable>
          </View>

          <Text style={styles.permissionsSubtitle}>
            GarageMinder needs these permissions to work correctly. Tap any item to enable it.
          </Text>

          {permissions.map((perm, index) => {
            const statusColor = getPermissionStatusColor(perm.status, theme.colors);
            const label = getPermissionStatusLabel(perm.status);
            const isActionable = perm.status !== 'granted' && perm.status !== 'unavailable';

            return (
              <Pressable
                key={perm.key}
                style={({ pressed }) => [
                  styles.permissionRow,
                  index < permissions.length - 1 && styles.permissionRowBorder,
                  pressed && isActionable && styles.permissionRowPressed,
                ]}
                onPress={() => isActionable && handlePermissionAction(perm)}
                disabled={!isActionable}
              >
                {/* Left: icon */}
                <View style={[styles.permissionIcon, { backgroundColor: `${statusColor}18` }]}>
                  <MaterialIcons
                    name={perm.icon as any}
                    size={22}
                    color={statusColor}
                  />
                </View>

                {/* Middle: title + description */}
                <View style={styles.permissionInfo}>
                  <View style={styles.permissionTitleRow}>
                    <Text style={styles.permissionTitle}>{perm.title}</Text>
                    {perm.isRequired && (
                      <View style={styles.requiredBadge}>
                        <Text style={styles.requiredBadgeText}>Required</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.permissionDescription}>{perm.description}</Text>

                  {/* Action hint for non-granted */}
                  {perm.status === 'denied' && (
                    <View style={styles.permissionActionHint}>
                      <MaterialIcons name="settings" size={12} color={statusColor} />
                      <Text style={[styles.permissionActionHintText, { color: statusColor }]}>
                        Tap to open device settings
                      </Text>
                    </View>
                  )}
                  {perm.status === 'not_asked' && (
                    <View style={styles.permissionActionHint}>
                      <MaterialIcons name="touch-app" size={12} color={statusColor} />
                      <Text style={[styles.permissionActionHintText, { color: statusColor }]}>
                        Tap to allow
                      </Text>
                    </View>
                  )}
                </View>

                {/* Right: status badge */}
                <View style={[styles.permissionStatusBadge, { backgroundColor: `${statusColor}18` }]}>
                  <View style={[styles.permissionStatusDot, { backgroundColor: statusColor }]} />
                  <Text style={[styles.permissionStatusLabel, { color: statusColor }]}>
                    {label}
                  </Text>
                </View>
              </Pressable>
            );
          })}

          {/* Footer note */}
          <View style={styles.permissionsFooter}>
            <MaterialIcons name="info-outline" size={14} color={theme.colors.textSubtle} />
            <Text style={styles.permissionsFooterText}>
              After granting permissions in device settings, return to this screen to refresh.
            </Text>
          </View>
        </Card>

        {/* Security Section */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Security</Text>
          
          <SettingRow
            icon="fingerprint"
            title="Biometric Unlock"
            value={!biometricAvailable ? 'Not Available' : (biometricEnabled ? 'Enabled' : 'Disabled')}
            rightElement={
              <Switch
                value={biometricEnabled}
                onValueChange={handleBiometricToggle}
                disabled={!biometricAvailable}
                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                thumbColor={theme.colors.text}
              />
            }
          />
          
          <SettingRow
            icon="lock"
            title="Encrypted Storage"
            value="Active"
          />
        </Card>

        {/* Privacy Section */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Privacy</Text>
          
          <SettingRow
            icon="location-on"
            title="GPS Data"
            value="Stored Locally Only"
          />
          
          <SettingRow
            icon="delete"
            title="Delete GPS After Sync"
            rightElement={
              <Switch
                value={syncSettings.deleteGpsAfterSync}
                onValueChange={(val) => updateSyncSettings({ deleteGpsAfterSync: val })}
                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                thumbColor={theme.colors.text}
              />
            }
          />
        </Card>

        {/* App Info */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <SettingRow
            icon="info"
            title="Version"
            value="1.5.0 (Beta)"
          />
          <SettingRow
            icon="help"
            title="Help & Support"
          />
          <SettingRow
            icon="description"
            title="Privacy Policy"
          />
        </Card>

        {/* Privacy Footer */}
        <View style={styles.footer}>
          <MaterialIcons name="shield" size={16} color={theme.colors.textSubtle} />
          <Text style={styles.footerText}>
            Your location data never leaves your device · Only odometer deltas are synced
          </Text>
        </View>
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
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
  },
  headerTitle: {
    fontSize: theme.typography.headlineLarge,
    fontWeight: theme.typography.weightBold,
    color: theme.colors.text,
    includeFontPadding: false,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: theme.spacing.md,
  },
  section: {
    marginBottom: theme.spacing.md,
  },
  sectionTitle: {
    fontSize: theme.typography.labelMedium,
    fontWeight: theme.typography.weightSemiBold,
    color: theme.colors.textSubtle,
    textTransform: 'uppercase',
    marginBottom: theme.spacing.md,
    includeFontPadding: false,
  },
  subscriptionCard: {
    gap: theme.spacing.md,
  },
  subscriptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  subscriptionInfo: {
    flex: 1,
  },
  subscriptionLevel: {
    fontSize: theme.typography.bodyLarge,
    fontWeight: theme.typography.weightSemiBold,
    color: theme.colors.text,
    includeFontPadding: false,
  },
  subscriptionDescription: {
    fontSize: theme.typography.bodySmall,
    color: theme.colors.textSecondary,
    marginTop: 2,
    includeFontPadding: false,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderSubtle,
  },
  settingItemPressed: {
    opacity: 0.7,
  },
  settingContent: {
    flex: 1,
    marginLeft: theme.spacing.md,
  },
  settingTitle: {
    fontSize: theme.typography.bodyMedium,
    fontWeight: theme.typography.weightMedium,
    color: theme.colors.text,
    marginBottom: 2,
    includeFontPadding: false,
  },
  settingValue: {
    fontSize: theme.typography.bodySmall,
    color: theme.colors.textSecondary,
    includeFontPadding: false,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xl,
    gap: theme.spacing.sm,
  },
  footerText: {
    fontSize: theme.typography.labelSmall,
    color: theme.colors.textSubtle,
    flex: 1,
    includeFontPadding: false,
  },
  accountInfo: {
    marginBottom: theme.spacing.sm,
  },
  accountHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  accountDetails: {
    flex: 1,
  },
  accountName: {
    fontSize: theme.typography.bodyLarge,
    fontWeight: theme.typography.weightSemiBold,
    color: theme.colors.text,
    includeFontPadding: false,
  },
  accountEmail: {
    fontSize: theme.typography.bodyMedium,
    color: theme.colors.textSecondary,
    marginTop: 2,
    includeFontPadding: false,
  },
  accountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    backgroundColor: `${theme.colors.primary}15`,
    borderRadius: theme.borderRadius.sm,
    alignSelf: 'flex-start',
  },
  accountBadgeText: {
    fontSize: theme.typography.labelSmall,
    fontWeight: theme.typography.weightMedium,
    color: theme.colors.primary,
    includeFontPadding: false,
  },
  // AutoStart styles
  autoStartHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  autoStartHeaderText: {
    flex: 1,
  },
  autoStartTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: 4,
  },
  autoStartTitle: {
    fontSize: theme.typography.bodyLarge,
    fontWeight: theme.typography.weightSemiBold,
    color: theme.colors.text,
    includeFontPadding: false,
  },
  autoStartSubtitle: {
    fontSize: theme.typography.bodySmall,
    color: theme.colors.textSecondary,
    lineHeight: theme.typography.bodySmall * 1.4,
    includeFontPadding: false,
  },
  subSectionTitle: {
    fontSize: theme.typography.bodyMedium,
    fontWeight: theme.typography.weightSemiBold,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
    marginTop: theme.spacing.sm,
    includeFontPadding: false,
  },
  subSectionHint: {
    fontSize: theme.typography.bodySmall,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
    lineHeight: theme.typography.bodySmall * 1.4,
    includeFontPadding: false,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.borderSubtle,
    marginVertical: theme.spacing.md,
  },
  emptyDevices: {
    alignItems: 'center',
    paddingVertical: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  emptyDevicesText: {
    fontSize: theme.typography.bodyMedium,
    fontWeight: theme.typography.weightMedium,
    color: theme.colors.textSecondary,
    includeFontPadding: false,
  },
  emptyDevicesHint: {
    fontSize: theme.typography.bodySmall,
    color: theme.colors.textSubtle,
    textAlign: 'center',
    lineHeight: theme.typography.bodySmall * 1.4,
    paddingHorizontal: theme.spacing.md,
    includeFontPadding: false,
  },
  deviceList: {
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  deviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
  deviceItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    flex: 1,
  },
  deviceIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `${theme.colors.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceItemInfo: {
    flex: 1,
  },
  deviceName: {
    fontSize: theme.typography.bodyMedium,
    fontWeight: theme.typography.weightMedium,
    color: theme.colors.text,
    includeFontPadding: false,
  },
  deviceVehicle: {
    fontSize: theme.typography.bodySmall,
    color: theme.colors.primary,
    marginTop: 2,
    includeFontPadding: false,
  },
  deviceVehicleUnset: {
    color: theme.colors.textSubtle,
    fontStyle: 'italic',
  },
  deviceItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  removeButton: {
    padding: theme.spacing.xs,
  },
  vehicleSelector: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.md,
    overflow: 'hidden',
  },
  vehicleSelectorTitle: {
    fontSize: theme.typography.bodySmall,
    fontWeight: theme.typography.weightMedium,
    color: theme.colors.textSecondary,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    includeFontPadding: false,
  },
  vehicleSelectorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderSubtle,
  },
  vehicleSelectorItemText: {
    fontSize: theme.typography.bodyMedium,
    color: theme.colors.text,
    includeFontPadding: false,
  },
  vehicleSelectorCancel: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderSubtle,
  },
  vehicleSelectorCancelText: {
    fontSize: theme.typography.bodySmall,
    color: theme.colors.textSubtle,
    includeFontPadding: false,
  },
  addDeviceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderStyle: 'dashed',
    marginTop: theme.spacing.sm,
  },
  addDeviceButtonText: {
    fontSize: theme.typography.bodyMedium,
    color: theme.colors.primary,
    fontWeight: theme.typography.weightMedium,
    includeFontPadding: false,
  },
  addDeviceSheet: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    marginTop: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  addDeviceSheetTitle: {
    fontSize: theme.typography.bodyMedium,
    fontWeight: theme.typography.weightSemiBold,
    color: theme.colors.text,
    includeFontPadding: false,
  },
  addDeviceSheetHint: {
    fontSize: theme.typography.bodySmall,
    color: theme.colors.textSecondary,
    lineHeight: theme.typography.bodySmall * 1.4,
    includeFontPadding: false,
  },
  addDeviceInput: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    fontSize: theme.typography.bodyMedium,
    color: theme.colors.text,
    includeFontPadding: false,
  },
  addDeviceActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xs,
  },
  addDeviceAction: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
  },
  addDeviceActionCancel: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  addDeviceActionCancelText: {
    fontSize: theme.typography.bodyMedium,
    color: theme.colors.textSecondary,
    fontWeight: theme.typography.weightMedium,
    includeFontPadding: false,
  },
  addDeviceActionConfirm: {
    backgroundColor: theme.colors.primary,
  },
  addDeviceActionConfirmText: {
    fontSize: theme.typography.bodyMedium,
    color: '#FFFFFF',
    fontWeight: theme.typography.weightSemiBold,
    includeFontPadding: false,
  },
  // Trip Logging styles
  tripSettingGroup: {
    gap: theme.spacing.md,
  },
  tripSettingHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
  },
  tripSettingHeaderText: {
    flex: 1,
  },
  tripSettingTitle: {
    fontSize: theme.typography.bodyMedium,
    fontWeight: theme.typography.weightSemiBold,
    color: theme.colors.text,
    includeFontPadding: false,
  },
  tripSettingSubtitle: {
    fontSize: theme.typography.bodySmall,
    color: theme.colors.textSecondary,
    marginTop: 2,
    lineHeight: theme.typography.bodySmall * 1.4,
    includeFontPadding: false,
  },
  optionPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  optionPill: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  optionPillActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  optionPillText: {
    fontSize: theme.typography.bodySmall,
    color: theme.colors.textSecondary,
    fontWeight: theme.typography.weightMedium,
    includeFontPadding: false,
  },
  optionPillTextActive: {
    color: '#FFFFFF',
  },
  // Permissions section
  permissionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.xs,
  },
  permissionsRefresh: {
    padding: theme.spacing.xs,
  },
  permissionsSubtitle: {
    fontSize: theme.typography.bodySmall,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
    lineHeight: theme.typography.bodySmall * 1.4,
    includeFontPadding: false,
  },
  permissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.md,
  },
  permissionRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderSubtle,
  },
  permissionRowPressed: {
    opacity: 0.7,
  },
  permissionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  permissionInfo: {
    flex: 1,
    gap: 2,
  },
  permissionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  permissionTitle: {
    fontSize: theme.typography.bodyMedium,
    fontWeight: theme.typography.weightSemiBold,
    color: theme.colors.text,
    includeFontPadding: false,
  },
  requiredBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    backgroundColor: `${theme.colors.primary}20`,
    borderRadius: 4,
  },
  requiredBadgeText: {
    fontSize: 10,
    fontWeight: theme.typography.weightSemiBold,
    color: theme.colors.primary,
    includeFontPadding: false,
  },
  permissionDescription: {
    fontSize: theme.typography.bodySmall,
    color: theme.colors.textSecondary,
    lineHeight: theme.typography.bodySmall * 1.3,
    includeFontPadding: false,
  },
  permissionActionHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  permissionActionHintText: {
    fontSize: 11,
    fontWeight: theme.typography.weightMedium,
    includeFontPadding: false,
  },
  permissionStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.full,
    flexShrink: 0,
  },
  permissionStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  permissionStatusLabel: {
    fontSize: theme.typography.labelSmall,
    fontWeight: theme.typography.weightSemiBold,
    includeFontPadding: false,
  },
  permissionsFooter: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderSubtle,
  },
  permissionsFooterText: {
    flex: 1,
    fontSize: theme.typography.labelSmall,
    color: theme.colors.textSubtle,
    lineHeight: theme.typography.labelSmall * 1.4,
    includeFontPadding: false,
  },
});
