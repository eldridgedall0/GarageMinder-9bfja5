import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { theme } from '../../constants/theme';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../hooks/useAuth';
import { useAlert } from '@/template';
import { updateVehicleOdometer } from '../../services/vehicleService';
import { Vehicle } from '../../types/trip';

export default function VehiclesScreen() {
  const insets = useSafeAreaInsets();
  const { vehicles, vehiclesLoading, reloadVehicles } = useAuth();
  const { showAlert } = useAlert();
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [newOdometer, setNewOdometer] = useState('');
  const [syncing, setSyncing] = useState(false);

  const handleEditOdometer = (vehicle: Vehicle) => {
    setEditingVehicleId(vehicle.id);
    setNewOdometer(vehicle.currentOdometer.toString());
  };

  const handleSaveOdometer = async (vehicleId: string) => {
    const odometerValue = parseFloat(newOdometer);
    if (isNaN(odometerValue) || odometerValue < 0) {
      showAlert('Invalid Odometer', 'Please enter a valid odometer reading');
      return;
    }

    try {
      await updateVehicleOdometer(vehicleId, odometerValue);
      await reloadVehicles();
      setEditingVehicleId(null);
      showAlert('Success', 'Odometer updated successfully');
    } catch (error: any) {
      showAlert('Error', error?.message || 'Failed to update odometer');
    }
  };

  const handleSyncAll = async () => {
    setSyncing(true);
    try {
      await reloadVehicles();
      showAlert('Success', 'Vehicles synced successfully');
    } catch (error: any) {
      showAlert('Error', error?.message || 'Failed to sync vehicles');
    } finally {
      setSyncing(false);
    }
  };

  if (vehiclesLoading && vehicles.length === 0) {
    return (
      <View style={[styles.container, styles.loadingContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Loading vehicles...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>My Vehicles</Text>
          <Text style={styles.headerSubtitle}>{vehicles.length} vehicle{vehicles.length !== 1 ? 's' : ''}</Text>
        </View>
        <Pressable 
          style={styles.syncButton}
          onPress={handleSyncAll}
          disabled={syncing}
        >
          <MaterialIcons 
            name="sync" 
            size={24} 
            color={syncing ? theme.colors.textSubtle : theme.colors.primary} 
          />
        </Pressable>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {vehicles.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="directions-car-filled" size={64} color={theme.colors.textSubtle} />
            <Text style={styles.emptyStateTitle}>No Vehicles</Text>
            <Text style={styles.emptyStateText}>
              Add vehicles to your GarageMinder account to start tracking
            </Text>
            <Button
              title="Sync Vehicles"
              onPress={handleSyncAll}
              variant="secondary"
              size="small"
              style={{ marginTop: theme.spacing.lg }}
            />
          </View>
        ) : (
          vehicles.map((vehicle) => {
            const isEditing = editingVehicleId === vehicle.id;
            
            return (
              <Card key={vehicle.id} style={styles.vehicleCard}>
                {/* Vehicle Header */}
                <View style={styles.vehicleHeader}>
                  <Image
                    source={require('@/assets/images/vehicle-icon.png')}
                    style={styles.vehicleIcon}
                    contentFit="contain"
                    transition={200}
                  />
                  <View style={styles.vehicleInfo}>
                    <Text style={styles.vehicleName}>
                      {vehicle.year} {vehicle.make} {vehicle.model}
                    </Text>
                    {vehicle.vin && (
                      <Text style={styles.vehicleVin}>VIN: {vehicle.vin}</Text>
                    )}
                  </View>
                </View>

                {/* Odometer Section */}
                <View style={styles.odometerSection}>
                  <View style={styles.odometerHeader}>
                    <View style={styles.odometerLabelRow}>
                      <MaterialIcons name="speed" size={20} color={theme.colors.primary} />
                      <Text style={styles.odometerLabel}>Current Odometer</Text>
                    </View>
                    {!isEditing && (
                      <Pressable
                        style={styles.editButton}
                        onPress={() => handleEditOdometer(vehicle)}
                      >
                        <MaterialIcons name="edit" size={18} color={theme.colors.primary} />
                        <Text style={styles.editButtonText}>Update</Text>
                      </Pressable>
                    )}
                  </View>

                  {isEditing ? (
                    <View style={styles.editOdometerContainer}>
                      <TextInput
                        style={styles.odometerInput}
                        value={newOdometer}
                        onChangeText={setNewOdometer}
                        placeholder="Enter odometer reading"
                        placeholderTextColor={theme.colors.textSubtle}
                        keyboardType="decimal-pad"
                        autoFocus
                      />
                      <View style={styles.editActions}>
                        <Pressable
                          style={[styles.editActionButton, styles.cancelButton]}
                          onPress={() => setEditingVehicleId(null)}
                        >
                          <Text style={styles.cancelButtonText}>Cancel</Text>
                        </Pressable>
                        <Pressable
                          style={[styles.editActionButton, styles.saveButton]}
                          onPress={() => handleSaveOdometer(vehicle.id)}
                        >
                          <Text style={styles.saveButtonText}>Save</Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : (
                    <Text style={styles.odometerValue}>
                      {vehicle.currentOdometer.toLocaleString()} mi
                    </Text>
                  )}
                </View>

                {/* Vehicle Details */}
                <View style={styles.detailsSection}>
                  <View style={styles.detailRow}>
                    <MaterialIcons name="calendar-today" size={16} color={theme.colors.textSecondary} />
                    <Text style={styles.detailLabel}>Year:</Text>
                    <Text style={styles.detailValue}>{vehicle.year}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <MaterialIcons name="build" size={16} color={theme.colors.textSecondary} />
                    <Text style={styles.detailLabel}>Make:</Text>
                    <Text style={styles.detailValue}>{vehicle.make}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <MaterialIcons name="directions-car" size={16} color={theme.colors.textSecondary} />
                    <Text style={styles.detailLabel}>Model:</Text>
                    <Text style={styles.detailValue}>{vehicle.model}</Text>
                  </View>
                </View>

                {/* Last Updated */}
                {vehicle.updatedAt && (
                  <View style={styles.lastUpdated}>
                    <MaterialIcons name="update" size={14} color={theme.colors.textSubtle} />
                    <Text style={styles.lastUpdatedText}>
                      Last updated: {new Date(vehicle.updatedAt).toLocaleDateString()}
                    </Text>
                  </View>
                )}
              </Card>
            );
          })
        )}

        {/* Info Footer */}
        <View style={styles.infoFooter}>
          <MaterialIcons name="info-outline" size={16} color={theme.colors.textSubtle} />
          <Text style={styles.infoText}>
            Odometer updates are stored locally and synced to your GarageMinder account
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
  },
  headerSubtitle: {
    fontSize: theme.typography.bodySmall,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  syncButton: {
    padding: theme.spacing.sm,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: theme.spacing.md,
  },
  vehicleCard: {
    marginBottom: theme.spacing.md,
  },
  vehicleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
    paddingBottom: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderSubtle,
  },
  vehicleIcon: {
    width: 56,
    height: 56,
    marginRight: theme.spacing.md,
  },
  vehicleInfo: {
    flex: 1,
  },
  vehicleName: {
    fontSize: theme.typography.bodyLarge,
    fontWeight: theme.typography.weightBold,
    color: theme.colors.text,
    marginBottom: 4,
  },
  vehicleVin: {
    fontSize: theme.typography.bodySmall,
    color: theme.colors.textSecondary,
    fontFamily: 'monospace',
  },
  odometerSection: {
    marginBottom: theme.spacing.md,
  },
  odometerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  odometerLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  odometerLabel: {
    fontSize: theme.typography.bodyMedium,
    fontWeight: theme.typography.weightSemiBold,
    color: theme.colors.text,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: `${theme.colors.primary}15`,
  },
  editButtonText: {
    fontSize: theme.typography.bodySmall,
    color: theme.colors.primary,
    fontWeight: theme.typography.weightMedium,
  },
  odometerValue: {
    fontSize: theme.typography.displaySmall,
    fontWeight: theme.typography.weightBold,
    color: theme.colors.primary,
  },
  editOdometerContainer: {
    gap: theme.spacing.sm,
  },
  odometerInput: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    padding: theme.spacing.md,
    fontSize: theme.typography.headlineSmall,
    fontWeight: theme.typography.weightBold,
    color: theme.colors.text,
  },
  editActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  editActionButton: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cancelButtonText: {
    fontSize: theme.typography.bodyMedium,
    color: theme.colors.textSecondary,
    fontWeight: theme.typography.weightMedium,
  },
  saveButton: {
    backgroundColor: theme.colors.primary,
  },
  saveButtonText: {
    fontSize: theme.typography.bodyMedium,
    color: theme.colors.textInverse,
    fontWeight: theme.typography.weightSemiBold,
  },
  detailsSection: {
    gap: theme.spacing.sm,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderSubtle,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  detailLabel: {
    fontSize: theme.typography.bodySmall,
    color: theme.colors.textSecondary,
    width: 60,
  },
  detailValue: {
    fontSize: theme.typography.bodyMedium,
    color: theme.colors.text,
    fontWeight: theme.typography.weightMedium,
  },
  lastUpdated: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderSubtle,
  },
  lastUpdatedText: {
    fontSize: theme.typography.labelSmall,
    color: theme.colors.textSubtle,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xxl,
  },
  emptyStateTitle: {
    fontSize: theme.typography.headlineMedium,
    fontWeight: theme.typography.weightBold,
    color: theme.colors.text,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
  },
  emptyStateText: {
    fontSize: theme.typography.bodyMedium,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: theme.spacing.xl,
    lineHeight: theme.typography.bodyMedium * 1.5,
  },
  infoFooter: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.xl,
    paddingHorizontal: theme.spacing.md,
  },
  infoText: {
    flex: 1,
    fontSize: theme.typography.labelSmall,
    color: theme.colors.textSubtle,
    lineHeight: theme.typography.labelSmall * 1.4,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: theme.typography.bodyMedium,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.md,
  },
});
