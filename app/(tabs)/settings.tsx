import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, Pressable } from 'react-native';
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

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();
  
  const [subscription, setSubscription] = useState<SubscriptionLevel>('free');
  const [syncSettings, setSyncSettings] = useState<SyncSettings | null>(null);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const level = await getSubscriptionLevel();
    const settings = await getSyncSettings();
    const capability = await checkBiometricCapability();
    const bioEnabled = await isBiometricEnabled();

    setSubscription(level);
    setSyncSettings(settings);
    setBiometricAvailable(capability.isAvailable);
    setBiometricEnabled(bioEnabled);
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
        showAlert('Success', 'Biometric unlock enabled');
      } else {
        showAlert('Failed', 'Could not enable biometric authentication');
      }
    } else {
      await disableBiometric();
      setBiometricEnabled(false);
      showAlert('Disabled', 'Biometric unlock disabled');
    }
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
});
