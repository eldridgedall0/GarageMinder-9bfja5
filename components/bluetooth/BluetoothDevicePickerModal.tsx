import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  Pressable,
  FlatList,
  ActivityIndicator,
  TextInput,
  SectionList,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../../constants/theme';
import {
  scanForBluetoothDevices,
  stopBluetoothScan,
  createDeviceIdFromName,
  getKnownDevices,
  type ScannedDevice,
  type DiscoveredDevice,
} from '../../services/bluetoothService';

interface BluetoothDevicePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onDeviceSelected: (device: { id: string; name: string }) => void;
  alreadyMappedIds: string[];
}

export function BluetoothDevicePickerModal({
  visible,
  onClose,
  onDeviceSelected,
  alreadyMappedIds,
}: BluetoothDevicePickerModalProps) {
  const insets = useSafeAreaInsets();
  const [isScanning, setIsScanning] = useState(false);
  const [isLoadingPaired, setIsLoadingPaired] = useState(false);
  const [pairedDevices, setPairedDevices] = useState<DiscoveredDevice[]>([]);
  const [scannedDevices, setScannedDevices] = useState<ScannedDevice[]>([]);
  const [scanError, setScanError] = useState<string | null>(null);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualName, setManualName] = useState('');
  const [scanProgress, setScanProgress] = useState(0);

  // Load paired devices when modal opens
  useEffect(() => {
    if (visible) {
      loadPairedDevices();
    } else {
      // Reset state on close
      setPairedDevices([]);
      setScannedDevices([]);
      setScanError(null);
      setShowManualEntry(false);
      setManualName('');
    }
  }, [visible]);

  const loadPairedDevices = async () => {
    setIsLoadingPaired(true);
    try {
      const devices = await getKnownDevices();
      setPairedDevices(devices);
    } catch (error) {
      console.error('Failed to load paired devices:', error);
    } finally {
      setIsLoadingPaired(false);
    }
  };

  const startScan = useCallback(async () => {
    setScannedDevices([]);
    setScanError(null);
    setIsScanning(true);
    setScanProgress(0);

    const progressInterval = setInterval(() => {
      setScanProgress(prev => Math.min(prev + 1.25, 100));
    }, 100);

    try {
      await scanForBluetoothDevices((device) => {
        setScannedDevices(prev => {
          if (prev.find(d => d.id === device.id)) return prev;
          return [...prev, device].sort((a, b) => b.rssi - a.rssi);
        });
      }, 8);
    } catch (error: any) {
      setScanError(error?.message || 'Bluetooth scan failed. Try using paired devices above or add manually.');
    } finally {
      clearInterval(progressInterval);
      setScanProgress(100);
      setIsScanning(false);
    }
  }, []);

  const handleClose = () => {
    stopBluetoothScan();
    setIsScanning(false);
    onClose();
  };

  const handleSelectDevice = (device: { id: string; name: string }) => {
    stopBluetoothScan();
    onDeviceSelected(device);
    handleClose();
  };

  const handleManualAdd = () => {
    if (!manualName.trim()) return;
    handleSelectDevice({
      id: createDeviceIdFromName(manualName.trim()),
      name: manualName.trim(),
    });
  };

  const isAlreadyAdded = (deviceId: string, deviceName?: string) => {
    if (alreadyMappedIds.includes(deviceId)) return true;
    // Also check by name for manually-added devices
    if (deviceName) {
      const manualId = createDeviceIdFromName(deviceName);
      return alreadyMappedIds.includes(manualId);
    }
    return false;
  };

  const renderPairedDevice = (item: DiscoveredDevice) => {
    const alreadyAdded = item.isAlreadyMapped || isAlreadyAdded(item.id, item.name);
    const typeLabel = item.deviceType === 'classic' ? 'Classic BT' :
                      item.deviceType === 'ble' ? 'BLE' :
                      item.deviceType === 'dual' ? 'Classic + BLE' : '';
    return (
      <Pressable
        key={item.id}
        style={[styles.deviceRow, alreadyAdded && styles.deviceRowDisabled]}
        onPress={() => !alreadyAdded && handleSelectDevice({ id: item.id, name: item.name })}
        disabled={alreadyAdded}
      >
        <View style={styles.deviceRowIcon}>
          <MaterialIcons
            name="bluetooth"
            size={22}
            color={alreadyAdded ? theme.colors.textSubtle : theme.colors.primary}
          />
        </View>
        <View style={styles.deviceRowInfo}>
          <Text style={[styles.deviceRowName, alreadyAdded && styles.deviceRowNameDisabled]}>
            {item.name}
          </Text>
          <Text style={styles.deviceRowId}>
            {alreadyAdded ? 'Already added' : typeLabel}
          </Text>
        </View>
        {!alreadyAdded && (
          <MaterialIcons name="add-circle-outline" size={22} color={theme.colors.primary} />
        )}
        {alreadyAdded && (
          <MaterialIcons name="check-circle" size={22} color={theme.colors.textSubtle} />
        )}
      </Pressable>
    );
  };

  const renderScannedDevice = ({ item }: { item: ScannedDevice }) => {
    const alreadyAdded = alreadyMappedIds.includes(item.id);
    return (
      <Pressable
        style={[styles.deviceRow, alreadyAdded && styles.deviceRowDisabled]}
        onPress={() => !alreadyAdded && handleSelectDevice({ id: item.id, name: item.name })}
        disabled={alreadyAdded}
      >
        <View style={styles.deviceRowIcon}>
          <MaterialIcons
            name="bluetooth-searching"
            size={22}
            color={alreadyAdded ? theme.colors.textSubtle : '#4FC3F7'}
          />
        </View>
        <View style={styles.deviceRowInfo}>
          <Text style={[styles.deviceRowName, alreadyAdded && styles.deviceRowNameDisabled]}>
            {item.name}
          </Text>
          <Text style={styles.deviceRowId}>
            {alreadyAdded ? 'Already added' : `BLE · Signal: ${item.rssi} dBm`}
          </Text>
        </View>
        {!alreadyAdded && (
          <MaterialIcons name="add-circle-outline" size={22} color={theme.colors.primary} />
        )}
        {alreadyAdded && (
          <MaterialIcons name="check-circle" size={22} color={theme.colors.textSubtle} />
        )}
      </Pressable>
    );
  };

  const hasPairedDevices = pairedDevices.length > 0 && !pairedDevices[0]?.isManuallyAdded;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={[styles.container, { paddingTop: insets.top || 16 }]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Add Bluetooth Device</Text>
          <Pressable onPress={handleClose} style={styles.closeButton}>
            <MaterialIcons name="close" size={24} color={theme.colors.text} />
          </Pressable>
        </View>

        <Text style={styles.subtitle}>
          {hasPairedDevices
            ? "Select your car's Bluetooth from your paired devices, or scan for nearby BLE devices."
            : "Select your car's Bluetooth from the list below, or add it manually if it doesn't appear."}
        </Text>

        {/* ── Paired Devices Section ──────────────────────────────────── */}
        {isLoadingPaired && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
            <Text style={styles.loadingText}>Loading paired devices...</Text>
          </View>
        )}

        {hasPairedDevices && (
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="bluetooth-connected" size={18} color={theme.colors.primary} />
              <Text style={styles.sectionTitle}>Paired Devices</Text>
              <View style={styles.sectionBadge}>
                <Text style={styles.sectionBadgeText}>{pairedDevices.length}</Text>
              </View>
            </View>
            <Text style={styles.sectionHint}>
              These are Bluetooth devices paired in your phone's settings
            </Text>
            <View style={styles.deviceListContainer}>
              {pairedDevices.map(renderPairedDevice)}
            </View>
          </View>
        )}

        {/* ── BLE Scan Section ────────────────────────────────────────── */}
        {!isScanning && scannedDevices.length === 0 && !scanError && (
          <Pressable style={styles.scanButton} onPress={startScan}>
            <MaterialIcons name="bluetooth-searching" size={24} color="#FFFFFF" />
            <Text style={styles.scanButtonText}>
              {hasPairedDevices ? 'Scan for BLE Devices' : 'Scan for Devices'}
            </Text>
          </Pressable>
        )}

        {isScanning && (
          <View style={styles.scanningContainer}>
            <View style={styles.scanningHeader}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
              <Text style={styles.scanningText}>Scanning for Bluetooth devices...</Text>
            </View>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${scanProgress}%` }]} />
            </View>
            <Text style={styles.scanningHint}>
              Make sure your car's Bluetooth is on and your phone is near the vehicle
            </Text>
          </View>
        )}

        {scanError && (
          <View style={styles.errorContainer}>
            <MaterialIcons name="info-outline" size={24} color={theme.colors.textSecondary} />
            <Text style={styles.errorText}>{scanError}</Text>
            {!hasPairedDevices && (
              <Pressable style={styles.retryButton} onPress={startScan}>
                <Text style={styles.retryButtonText}>Try Again</Text>
              </Pressable>
            )}
          </View>
        )}

        {scannedDevices.length > 0 && (
          <View style={styles.devicesContainer}>
            <View style={styles.devicesHeader}>
              <Text style={styles.devicesTitle}>
                {scannedDevices.length} BLE device{scannedDevices.length !== 1 ? 's' : ''} found
              </Text>
              {!isScanning && (
                <Pressable onPress={startScan}>
                  <Text style={styles.rescanText}>Scan again</Text>
                </Pressable>
              )}
            </View>
            <FlatList
              data={scannedDevices}
              renderItem={renderScannedDevice}
              keyExtractor={item => item.id}
              style={styles.deviceList}
              showsVerticalScrollIndicator={false}
            />
          </View>
        )}

        {/* ── Manual Entry Section ────────────────────────────────────── */}
        <View style={styles.manualSection}>
          {!showManualEntry ? (
            <Pressable
              style={styles.manualToggle}
              onPress={() => setShowManualEntry(true)}
            >
              <MaterialIcons name="edit" size={18} color={theme.colors.textSecondary} />
              <Text style={styles.manualToggleText}>
                Device not showing? Add manually
              </Text>
              <MaterialIcons name="chevron-right" size={18} color={theme.colors.textSecondary} />
            </Pressable>
          ) : (
            <View style={styles.manualEntry}>
              <Text style={styles.manualEntryLabel}>
                Enter the exact Bluetooth name as it appears in your phone's Bluetooth settings:
              </Text>
              <TextInput
                style={styles.manualEntryInput}
                value={manualName}
                onChangeText={setManualName}
                placeholder="e.g. Toyota Audio, Honda BT, MyCarStereo"
                placeholderTextColor={theme.colors.textSubtle}
                autoFocus
                autoCapitalize="words"
                returnKeyType="done"
                onSubmitEditing={handleManualAdd}
              />
              <View style={styles.manualEntryActions}>
                <Pressable
                  style={styles.manualEntryCancel}
                  onPress={() => { setShowManualEntry(false); setManualName(''); }}
                >
                  <Text style={styles.manualEntryCancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.manualEntryConfirm, !manualName.trim() && styles.manualEntryConfirmDisabled]}
                  onPress={handleManualAdd}
                  disabled={!manualName.trim()}
                >
                  <Text style={styles.manualEntryConfirmText}>Add Device</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  title: {
    fontSize: theme.typography.headlineMedium,
    fontWeight: theme.typography.weightBold,
    color: theme.colors.text,
  },
  closeButton: {
    padding: theme.spacing.sm,
  },
  subtitle: {
    fontSize: theme.typography.bodyMedium,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.lg,
    lineHeight: theme.typography.bodyMedium * 1.4,
  },
  // Paired devices section
  sectionContainer: {
    marginBottom: theme.spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: theme.typography.bodyMedium,
    fontWeight: theme.typography.weightSemiBold,
    color: theme.colors.text,
    flex: 1,
  },
  sectionBadge: {
    backgroundColor: `${theme.colors.primary}20`,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  sectionBadgeText: {
    fontSize: theme.typography.bodySmall,
    fontWeight: theme.typography.weightSemiBold,
    color: theme.colors.primary,
  },
  sectionHint: {
    fontSize: theme.typography.bodySmall,
    color: theme.colors.textSubtle,
    marginBottom: theme.spacing.sm,
  },
  deviceListContainer: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    maxHeight: 240,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.lg,
  },
  loadingText: {
    fontSize: theme.typography.bodyMedium,
    color: theme.colors.textSecondary,
  },
  // Scan button & states
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md,
  },
  scanButtonText: {
    fontSize: theme.typography.bodyLarge,
    fontWeight: theme.typography.weightSemiBold,
    color: '#FFFFFF',
  },
  scanningContainer: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  scanningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  scanningText: {
    fontSize: theme.typography.bodyMedium,
    color: theme.colors.text,
    fontWeight: theme.typography.weightMedium,
  },
  progressBar: {
    height: 3,
    backgroundColor: theme.colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: 2,
  },
  scanningHint: {
    fontSize: theme.typography.bodySmall,
    color: theme.colors.textSubtle,
  },
  errorContainer: {
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md,
  },
  errorText: {
    fontSize: theme.typography.bodyMedium,
    color: theme.colors.text,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  retryButtonText: {
    fontSize: theme.typography.bodyMedium,
    color: theme.colors.primary,
    fontWeight: theme.typography.weightMedium,
  },
  devicesContainer: {
    flex: 1,
    marginBottom: theme.spacing.md,
  },
  devicesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  devicesTitle: {
    fontSize: theme.typography.bodyMedium,
    fontWeight: theme.typography.weightSemiBold,
    color: theme.colors.text,
  },
  rescanText: {
    fontSize: theme.typography.bodySmall,
    color: theme.colors.primary,
    fontWeight: theme.typography.weightMedium,
  },
  deviceList: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderSubtle,
    gap: theme.spacing.sm,
  },
  deviceRowDisabled: {
    opacity: 0.5,
  },
  deviceRowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `${theme.colors.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceRowInfo: {
    flex: 1,
  },
  deviceRowName: {
    fontSize: theme.typography.bodyMedium,
    fontWeight: theme.typography.weightMedium,
    color: theme.colors.text,
  },
  deviceRowNameDisabled: {
    color: theme.colors.textSubtle,
  },
  deviceRowId: {
    fontSize: theme.typography.bodySmall,
    color: theme.colors.textSubtle,
    marginTop: 2,
  },
  // Manual entry
  manualSection: {
    marginBottom: theme.spacing.xl,
  },
  manualToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderSubtle,
  },
  manualToggleText: {
    flex: 1,
    fontSize: theme.typography.bodySmall,
    color: theme.colors.textSecondary,
  },
  manualEntry: {
    gap: theme.spacing.sm,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderSubtle,
  },
  manualEntryLabel: {
    fontSize: theme.typography.bodySmall,
    color: theme.colors.textSecondary,
    lineHeight: theme.typography.bodySmall * 1.4,
  },
  manualEntryInput: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    fontSize: theme.typography.bodyMedium,
    color: theme.colors.text,
  },
  manualEntryActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  manualEntryCancel: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  manualEntryCancelText: {
    fontSize: theme.typography.bodyMedium,
    color: theme.colors.textSecondary,
  },
  manualEntryConfirm: {
    flex: 2,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.primary,
  },
  manualEntryConfirmDisabled: {
    opacity: 0.5,
  },
  manualEntryConfirmText: {
    fontSize: theme.typography.bodyMedium,
    fontWeight: theme.typography.weightSemiBold,
    color: '#FFFFFF',
  },
});
