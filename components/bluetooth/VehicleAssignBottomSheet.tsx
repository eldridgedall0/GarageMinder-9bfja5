import React from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  Pressable,
  FlatList,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../../constants/theme';
import { Vehicle } from '../../types/trip';

interface VehicleAssignBottomSheetProps {
  visible: boolean;
  deviceName: string;
  vehicles: Vehicle[];
  currentVehicleId?: string;
  onAssign: (vehicleId: string, vehicleName: string) => void;
  onSkip: () => void;
  onClose: () => void;
}

export function VehicleAssignBottomSheet({
  visible,
  deviceName,
  vehicles,
  currentVehicleId,
  onAssign,
  onSkip,
  onClose,
}: VehicleAssignBottomSheetProps) {
  const insets = useSafeAreaInsets();

  const renderVehicle = ({ item }: { item: Vehicle }) => {
    const isSelected = item.id === currentVehicleId;
    return (
      <Pressable
        style={({ pressed }) => [
          styles.vehicleRow,
          isSelected && styles.vehicleRowSelected,
          pressed && styles.vehicleRowPressed,
        ]}
        onPress={() => onAssign(item.id, `${item.year} ${item.make} ${item.model}`)}
      >
        <View style={[styles.vehicleIcon, isSelected && styles.vehicleIconSelected]}>
          <MaterialIcons
            name="directions-car"
            size={22}
            color={isSelected ? '#FFFFFF' : theme.colors.primary}
          />
        </View>
        <View style={styles.vehicleInfo}>
          <Text style={[styles.vehicleName, isSelected && styles.vehicleNameSelected]}>
            {item.year} {item.make} {item.model}
          </Text>
          <Text style={styles.vehicleOdo}>
            {item.currentOdometer.toLocaleString()} mi
          </Text>
        </View>
        {isSelected && (
          <MaterialIcons name="check-circle" size={22} color={theme.colors.primary} />
        )}
      </Pressable>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
        {/* Handle */}
        <View style={styles.handle} />

        {/* Device info */}
        <View style={styles.deviceInfo}>
          <View style={styles.deviceIconCircle}>
            <MaterialIcons name="bluetooth" size={24} color={theme.colors.primary} />
          </View>
          <View style={styles.deviceText}>
            <Text style={styles.deviceAddedLabel}>Device added</Text>
            <Text style={styles.deviceName}>{deviceName}</Text>
          </View>
        </View>

        <Text style={styles.assignTitle}>
          Which vehicle does this Bluetooth belong to?
        </Text>
        <Text style={styles.assignSubtitle}>
          When your phone connects to "{deviceName}", GarageMinder will automatically start tracking a trip for the selected vehicle.
        </Text>

        {vehicles.length === 0 ? (
          <View style={styles.noVehicles}>
            <Text style={styles.noVehiclesText}>No vehicles found. Add a vehicle in your GarageMinder account first.</Text>
          </View>
        ) : (
          <FlatList
            data={vehicles}
            renderItem={renderVehicle}
            keyExtractor={item => item.id}
            style={styles.vehicleList}
            scrollEnabled={vehicles.length > 4}
          />
        )}

        <Pressable style={styles.skipButton} onPress={onSkip}>
          <Text style={styles.skipButtonText}>Assign later</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: theme.spacing.lg,
    maxHeight: '80%',
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: theme.colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: theme.spacing.lg,
  },
  deviceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    backgroundColor: `${theme.colors.primary}10`,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  deviceIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: `${theme.colors.primary}20`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceText: {
    flex: 1,
  },
  deviceAddedLabel: {
    fontSize: theme.typography.bodySmall,
    color: theme.colors.primary,
    fontWeight: theme.typography.weightMedium,
    includeFontPadding: false,
  },
  deviceName: {
    fontSize: theme.typography.bodyLarge,
    fontWeight: theme.typography.weightSemiBold,
    color: theme.colors.text,
    includeFontPadding: false,
  },
  assignTitle: {
    fontSize: theme.typography.bodyLarge,
    fontWeight: theme.typography.weightSemiBold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    includeFontPadding: false,
  },
  assignSubtitle: {
    fontSize: theme.typography.bodySmall,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.lg,
    lineHeight: theme.typography.bodySmall * 1.4,
    includeFontPadding: false,
  },
  vehicleList: {
    maxHeight: 280,
    marginBottom: theme.spacing.md,
  },
  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  vehicleRowSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: `${theme.colors.primary}08`,
  },
  vehicleRowPressed: {
    opacity: 0.8,
  },
  vehicleIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${theme.colors.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleIconSelected: {
    backgroundColor: theme.colors.primary,
  },
  vehicleInfo: {
    flex: 1,
  },
  vehicleName: {
    fontSize: theme.typography.bodyMedium,
    fontWeight: theme.typography.weightMedium,
    color: theme.colors.text,
    includeFontPadding: false,
  },
  vehicleNameSelected: {
    color: theme.colors.primary,
  },
  vehicleOdo: {
    fontSize: theme.typography.bodySmall,
    color: theme.colors.textSecondary,
    marginTop: 2,
    includeFontPadding: false,
  },
  noVehicles: {
    padding: theme.spacing.lg,
    alignItems: 'center',
  },
  noVehiclesText: {
    fontSize: theme.typography.bodyMedium,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    includeFontPadding: false,
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
  },
  skipButtonText: {
    fontSize: theme.typography.bodyMedium,
    color: theme.colors.textSubtle,
    includeFontPadding: false,
  },
});
