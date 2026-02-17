import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../../constants/theme';
import { TripStatus } from '../../types/trip';

interface BadgeProps {
  status: TripStatus | 'pending';
  label: string;
}

export function Badge({ status, label }: BadgeProps) {
  const getStatusColor = () => {
    switch (status) {
      case 'active':
        return theme.colors.active;
      case 'completed':
      case 'pending':
        return theme.colors.pending;
      case 'synced':
        return theme.colors.synced;
      case 'edited':
        return theme.colors.edited;
      default:
        return theme.colors.textSubtle;
    }
  };

  return (
    <View style={[styles.badge, { backgroundColor: `${getStatusColor()}20` }]}>
      <View style={[styles.dot, { backgroundColor: getStatusColor() }]} />
      <Text style={[styles.text, { color: getStatusColor() }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.sm,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  text: {
    fontSize: theme.typography.labelSmall,
    fontWeight: theme.typography.weightMedium,
    includeFontPadding: false,
  },
});
