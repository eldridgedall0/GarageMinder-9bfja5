import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import { Card } from '../ui/Card';
import { Trip, Vehicle } from '../../types/trip';

interface ActiveTripCardProps {
  trip: Trip;
  vehicle: Vehicle | null;
}

export function ActiveTripCard({ trip, vehicle }: ActiveTripCardProps) {
  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m ${seconds % 60}s`;
  };

  const formatDistance = (miles: number) => {
    return `${miles.toFixed(1)} mi`;
  };

  const calculateSpeed = () => {
    if (trip.duration === 0) return '0';
    const hours = trip.duration / (1000 * 60 * 60);
    const speed = trip.calculatedDistance / hours;
    return speed.toFixed(0);
  };

  return (
    <Card elevated style={styles.card}>
      {/* Vehicle Info */}
      <View style={styles.header}>
        <MaterialIcons name="directions-car" size={24} color={theme.colors.primary} />
        <View style={styles.vehicleInfo}>
          <Text style={styles.vehicleName}>
            {vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : 'No Vehicle Selected'}
          </Text>
          <Text style={styles.startTime}>
            Started {new Date(trip.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
        <View style={styles.activeBadge}>
          <View style={styles.pulsingDot} />
          <Text style={styles.activeText}>ACTIVE</Text>
        </View>
      </View>

      {/* Metrics Grid */}
      <View style={styles.metricsGrid}>
        <View style={styles.metricItem}>
          <MaterialIcons name="straighten" size={28} color={theme.colors.primary} />
          <Text style={styles.metricValue}>{formatDistance(trip.calculatedDistance)}</Text>
          <Text style={styles.metricLabel}>Distance</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.metricItem}>
          <MaterialIcons name="schedule" size={28} color={theme.colors.primary} />
          <Text style={styles.metricValue}>{formatDuration(trip.duration)}</Text>
          <Text style={styles.metricLabel}>Duration</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.metricItem}>
          <MaterialIcons name="speed" size={28} color={theme.colors.primary} />
          <Text style={styles.metricValue}>{calculateSpeed()}</Text>
          <Text style={styles.metricLabel}>Avg MPH</Text>
        </View>
      </View>

      {/* Odometer */}
      <View style={styles.odometerSection}>
        <View style={styles.odometerItem}>
          <Text style={styles.odometerLabel}>Start Odometer</Text>
          <Text style={styles.odometerValue}>{trip.startOdometer.toLocaleString()} mi</Text>
        </View>
        <MaterialIcons name="arrow-forward" size={20} color={theme.colors.textSubtle} />
        <View style={styles.odometerItem}>
          <Text style={styles.odometerLabel}>Current</Text>
          <Text style={styles.odometerValue}>
            {trip.endOdometer ? trip.endOdometer.toLocaleString() : trip.startOdometer.toLocaleString()} mi
          </Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surfaceElevated,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  vehicleInfo: {
    flex: 1,
    marginLeft: theme.spacing.md,
  },
  vehicleName: {
    fontSize: theme.typography.bodyLarge,
    fontWeight: theme.typography.weightSemiBold,
    color: theme.colors.text,
    includeFontPadding: false,
  },
  startTime: {
    fontSize: theme.typography.bodySmall,
    color: theme.colors.textSecondary,
    marginTop: 2,
    includeFontPadding: false,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${theme.colors.active}20`,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.sm,
  },
  pulsingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.active,
    marginRight: 6,
  },
  activeText: {
    fontSize: theme.typography.labelSmall,
    fontWeight: theme.typography.weightBold,
    color: theme.colors.active,
    includeFontPadding: false,
  },
  metricsGrid: {
    flexDirection: 'row',
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricValue: {
    fontSize: theme.typography.headlineMedium,
    fontWeight: theme.typography.weightBold,
    color: theme.colors.text,
    marginTop: theme.spacing.sm,
    includeFontPadding: false,
  },
  metricLabel: {
    fontSize: theme.typography.labelSmall,
    color: theme.colors.textSecondary,
    marginTop: 4,
    includeFontPadding: false,
  },
  divider: {
    width: 1,
    backgroundColor: theme.colors.border,
    marginHorizontal: theme.spacing.sm,
  },
  odometerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
  },
  odometerItem: {
    flex: 1,
    alignItems: 'center',
  },
  odometerLabel: {
    fontSize: theme.typography.labelSmall,
    color: theme.colors.textSecondary,
    marginBottom: 4,
    includeFontPadding: false,
  },
  odometerValue: {
    fontSize: theme.typography.bodyLarge,
    fontWeight: theme.typography.weightSemiBold,
    color: theme.colors.text,
    includeFontPadding: false,
  },
});
