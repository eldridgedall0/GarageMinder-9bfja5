import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Trip, Vehicle } from '../../types/trip';

interface TripListItemProps {
  trip: Trip;
  vehicle: Vehicle | null;
  onPress: () => void;
}

export function TripListItem({ trip, vehicle, onPress }: TripListItemProps) {
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m`;
  };

  const getStatusLabel = () => {
    switch (trip.status) {
      case 'active':
        return 'Active';
      case 'completed':
        return 'Pending Sync';
      case 'synced':
        return 'Synced';
      case 'edited':
        return 'Edited';
      default:
        return trip.status;
    }
  };

  const displayDistance = trip.adjustedDistance || trip.calculatedDistance;
  const hasAdjustment = trip.adjustedDistance !== null;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
      <Card style={styles.card}>
        {/* Header Row */}
        <View style={styles.header}>
          <View style={styles.vehicleInfo}>
            <MaterialIcons name="directions-car" size={16} color={theme.colors.primary} />
            <Text style={styles.vehicleName} numberOfLines={1}>
              {vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : 'Unknown Vehicle'}
            </Text>
          </View>
          <Badge status={trip.status === 'completed' ? 'pending' : trip.status} label={getStatusLabel()} />
        </View>

        {/* Metrics Row */}
        <View style={styles.metricsRow}>
          <View style={styles.metric}>
            <MaterialIcons name="straighten" size={20} color={theme.colors.textSecondary} />
            <View style={styles.metricText}>
              <Text style={styles.metricValue}>{displayDistance.toFixed(1)} mi</Text>
              {hasAdjustment && <Text style={styles.adjustedLabel}>Adjusted</Text>}
            </View>
          </View>

          <View style={styles.metric}>
            <MaterialIcons name="schedule" size={20} color={theme.colors.textSecondary} />
            <Text style={styles.metricValue}>{formatDuration(trip.duration)}</Text>
          </View>

          <View style={styles.metric}>
            <MaterialIcons name="event" size={20} color={theme.colors.textSecondary} />
            <Text style={styles.metricValue}>{formatDate(trip.startTime)}</Text>
          </View>
        </View>

        {/* Odometer Row */}
        <View style={styles.odometerRow}>
          <Text style={styles.odometerText}>
            {trip.startOdometer.toLocaleString()} → {trip.endOdometer?.toLocaleString() || '---'} mi
          </Text>
          {trip.notes && (
            <View style={styles.notesIndicator}>
              <MaterialIcons name="notes" size={14} color={theme.colors.textSubtle} />
            </View>
          )}
        </View>

        {/* Notes (if present) */}
        {trip.notes && (
          <Text style={styles.notes} numberOfLines={2}>
            {trip.notes}
          </Text>
        )}
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: theme.spacing.md,
  },
  pressed: {
    opacity: 0.7,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  vehicleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: theme.spacing.sm,
  },
  vehicleName: {
    fontSize: theme.typography.bodyMedium,
    fontWeight: theme.typography.weightSemiBold,
    color: theme.colors.text,
    marginLeft: theme.spacing.sm,
    flex: 1,
    includeFontPadding: false,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  metric: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  metricText: {
    marginLeft: 6,
  },
  metricValue: {
    fontSize: theme.typography.bodySmall,
    color: theme.colors.textSecondary,
    marginLeft: 6,
    includeFontPadding: false,
  },
  adjustedLabel: {
    fontSize: theme.typography.labelSmall,
    color: theme.colors.edited,
    marginLeft: 6,
    includeFontPadding: false,
  },
  odometerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  odometerText: {
    fontSize: theme.typography.labelSmall,
    color: theme.colors.textSubtle,
    includeFontPadding: false,
  },
  notesIndicator: {
    marginLeft: theme.spacing.sm,
  },
  notes: {
    fontSize: theme.typography.bodySmall,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.sm,
    fontStyle: 'italic',
    includeFontPadding: false,
  },
});
