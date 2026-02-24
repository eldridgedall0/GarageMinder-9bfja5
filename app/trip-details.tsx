import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { theme } from '../constants/theme';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { useTrips } from '../hooks/useTrips';
import { useVehicles } from '../hooks/useVehicles';
import { useAlert } from '@/template';
import { Trip } from '../types/trip';

export default function TripDetailsScreen() {
  const { tripId } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { allTrips, updateTrip, deleteTrip } = useTrips();
  const { vehicles } = useVehicles();
  const { showAlert } = useAlert();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [adjustedDistance, setAdjustedDistance] = useState('');
  const [notes, setNotes] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    const foundTrip = allTrips.find(t => t.id === tripId);
    if (foundTrip) {
      setTrip(foundTrip);
      setAdjustedDistance(foundTrip.adjustedDistance?.toString() || '');
      setNotes(foundTrip.notes);
    }
  }, [tripId, allTrips]);

  if (!trip) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Trip not found</Text>
      </View>
    );
  }

  const vehicle = vehicles.find(v => v.id === trip.vehicleId);
  const displayDistance = trip.adjustedDistance || trip.calculatedDistance;
  const hasAdjustment = trip.adjustedDistance !== null;
  const discrepancy = hasAdjustment 
    ? Math.abs(trip.adjustedDistance! - trip.calculatedDistance)
    : 0;

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    }
    return `${minutes}m ${seconds % 60}s`;
  };

  const handleSave = async () => {
    const newAdjustedDistance = adjustedDistance ? parseFloat(adjustedDistance) : null;
    
    await updateTrip({
      ...trip,
      adjustedDistance: newAdjustedDistance,
      notes,
    });

    showAlert('Success', 'Trip updated successfully');
    setIsEditing(false);
  };

  const handleDelete = () => {
    showAlert('Delete Trip?', 'This action cannot be undone', [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Delete', 
        style: 'destructive', 
        onPress: async () => {
          await deleteTrip(trip.id);
          showAlert('Deleted', 'Trip has been deleted');
          router.back();
        }
      },
    ]);
  };

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Status Badge */}
        <View style={styles.statusRow}>
          <Badge 
            status={trip.status === 'completed' ? 'pending' : trip.status} 
            label={trip.status === 'completed' ? 'Pending Sync' : trip.status} 
          />
        </View>

        {/* Vehicle Card */}
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="directions-car" size={24} color={theme.colors.primary} />
            <Text style={styles.sectionTitle}>Vehicle</Text>
          </View>
          <Text style={styles.vehicleName}>
            {vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : 'Unknown Vehicle'}
          </Text>
        </Card>

        {/* Distance Card */}
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="straighten" size={24} color={theme.colors.primary} />
            <Text style={styles.sectionTitle}>Distance</Text>
          </View>
          
          <View style={styles.distanceRow}>
            <View style={styles.distanceItem}>
              <Text style={styles.distanceLabel}>GPS Calculated</Text>
              <Text style={styles.distanceValue}>{trip.calculatedDistance.toFixed(2)} mi</Text>
            </View>
            
            {hasAdjustment && (
              <>
                <MaterialIcons name="arrow-forward" size={20} color={theme.colors.textSubtle} />
                <View style={styles.distanceItem}>
                  <Text style={styles.distanceLabel}>Adjusted</Text>
                  <Text style={[styles.distanceValue, { color: theme.colors.primary }]}>
                    {trip.adjustedDistance!.toFixed(2)} mi
                  </Text>
                </View>
              </>
            )}
          </View>

          {hasAdjustment && discrepancy > 0 && (
            <View style={styles.discrepancyBanner}>
              <MaterialIcons name="info" size={16} color={theme.colors.warning} />
              <Text style={styles.discrepancyText}>
                Discrepancy: {discrepancy.toFixed(2)} mi
              </Text>
            </View>
          )}

          {isEditing && (
            <View style={styles.editField}>
              <Text style={styles.inputLabel}>Adjust Distance (miles)</Text>
              <TextInput
                style={styles.input}
                value={adjustedDistance}
                onChangeText={setAdjustedDistance}
                placeholder={trip.calculatedDistance.toFixed(2)}
                placeholderTextColor={theme.colors.textSubtle}
                keyboardType="decimal-pad"
              />
            </View>
          )}
        </Card>

        {/* Time Card */}
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="schedule" size={24} color={theme.colors.primary} />
            <Text style={styles.sectionTitle}>Time</Text>
          </View>
          
          <View style={styles.timeRow}>
            <View style={styles.timeItem}>
              <Text style={styles.timeLabel}>Started</Text>
              <Text style={styles.timeValue}>{formatDate(trip.startTime)}</Text>
            </View>
            
            {trip.endTime && (
              <View style={styles.timeItem}>
                <Text style={styles.timeLabel}>Ended</Text>
                <Text style={styles.timeValue}>{formatDate(trip.endTime)}</Text>
              </View>
            )}
            
            <View style={styles.timeItem}>
              <Text style={styles.timeLabel}>Duration</Text>
              <Text style={styles.timeValue}>{formatDuration(trip.duration)}</Text>
            </View>
          </View>
        </Card>

        {/* Odometer Card */}
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="speed" size={24} color={theme.colors.primary} />
            <Text style={styles.sectionTitle}>Odometer</Text>
          </View>
          
          <View style={styles.odometerRow}>
            <View style={styles.odometerItem}>
              <Text style={styles.odometerLabel}>Start</Text>
              <Text style={styles.odometerValue}>{trip.startOdometer.toLocaleString()} mi</Text>
            </View>
            
            <MaterialIcons name="arrow-forward" size={24} color={theme.colors.primary} />
            
            <View style={styles.odometerItem}>
              <Text style={styles.odometerLabel}>End</Text>
              <Text style={styles.odometerValue}>
                {trip.endOdometer ? trip.endOdometer.toLocaleString() : '---'} mi
              </Text>
            </View>
          </View>
        </Card>

        {/* Notes Card */}
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="notes" size={24} color={theme.colors.primary} />
            <Text style={styles.sectionTitle}>Notes</Text>
          </View>
          
          {isEditing ? (
            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={setNotes}
              placeholder="Add notes about this trip..."
              placeholderTextColor={theme.colors.textSubtle}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          ) : (
            <Text style={[styles.notesText, { fontStyle: trip.notes ? 'normal' : 'italic' }]}>
              {trip.notes || 'No notes'}
            </Text>
          )}
        </Card>

        {/* Actions */}
        <View style={styles.actions}>
          {isEditing ? (
            <>
              <Button
                title="Save Changes"
                onPress={handleSave}
                style={styles.actionButton}
              />
              <Button
                title="Cancel"
                onPress={() => {
                  setIsEditing(false);
                  setAdjustedDistance(trip.adjustedDistance?.toString() || '');
                  setNotes(trip.notes);
                }}
                variant="secondary"
                style={styles.actionButton}
              />
            </>
          ) : (
            <>
              <Button
                title="Edit Trip"
                onPress={() => setIsEditing(true)}
                style={styles.actionButton}
              />
              <Button
                title="Delete Trip"
                onPress={handleDelete}
                variant="danger"
                style={styles.actionButton}
              />
            </>
          )}
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
  scrollView: {
    flex: 1,
  },
  content: {
    padding: theme.spacing.md,
  },
  errorText: {
    fontSize: theme.typography.bodyLarge,
    color: theme.colors.error,
    textAlign: 'center',
    marginTop: theme.spacing.xl,
  },
  statusRow: {
    alignItems: 'flex-start',
    marginBottom: theme.spacing.md,
  },
  section: {
    marginBottom: theme.spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  sectionTitle: {
    fontSize: theme.typography.bodyLarge,
    fontWeight: theme.typography.weightSemiBold,
    color: theme.colors.text,
    marginLeft: theme.spacing.sm,
    includeFontPadding: false,
  },
  vehicleName: {
    fontSize: theme.typography.headlineSmall,
    fontWeight: theme.typography.weightBold,
    color: theme.colors.text,
    includeFontPadding: false,
  },
  distanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginBottom: theme.spacing.md,
  },
  distanceItem: {
    alignItems: 'center',
  },
  distanceLabel: {
    fontSize: theme.typography.labelSmall,
    color: theme.colors.textSecondary,
    marginBottom: 4,
    includeFontPadding: false,
  },
  distanceValue: {
    fontSize: theme.typography.headlineMedium,
    fontWeight: theme.typography.weightBold,
    color: theme.colors.text,
    includeFontPadding: false,
  },
  discrepancyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${theme.colors.warning}20`,
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    marginBottom: theme.spacing.md,
  },
  discrepancyText: {
    fontSize: theme.typography.bodySmall,
    color: theme.colors.warning,
    marginLeft: theme.spacing.sm,
    includeFontPadding: false,
  },
  editField: {
    marginTop: theme.spacing.md,
  },
  inputLabel: {
    fontSize: theme.typography.bodySmall,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
    includeFontPadding: false,
  },
  input: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    fontSize: theme.typography.bodyMedium,
    color: theme.colors.text,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  timeRow: {
    gap: theme.spacing.md,
  },
  timeItem: {
    marginBottom: theme.spacing.sm,
  },
  timeLabel: {
    fontSize: theme.typography.labelSmall,
    color: theme.colors.textSecondary,
    marginBottom: 4,
    includeFontPadding: false,
  },
  timeValue: {
    fontSize: theme.typography.bodyMedium,
    color: theme.colors.text,
    includeFontPadding: false,
  },
  odometerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  odometerItem: {
    alignItems: 'center',
  },
  odometerLabel: {
    fontSize: theme.typography.labelSmall,
    color: theme.colors.textSecondary,
    marginBottom: 4,
    includeFontPadding: false,
  },
  odometerValue: {
    fontSize: theme.typography.headlineSmall,
    fontWeight: theme.typography.weightBold,
    color: theme.colors.text,
    includeFontPadding: false,
  },
  notesInput: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    fontSize: theme.typography.bodyMedium,
    color: theme.colors.text,
    borderWidth: 1,
    borderColor: theme.colors.border,
    minHeight: 100,
  },
  notesText: {
    fontSize: theme.typography.bodyMedium,
    color: theme.colors.textSecondary,
  },
  actions: {
    gap: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
  actionButton: {
    width: '100%',
  },
});
