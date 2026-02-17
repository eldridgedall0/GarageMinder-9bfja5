import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';

export function EmptyTrips() {
  return (
    <View style={styles.container}>
      <Image
        source={require('@/assets/images/empty-trips.png')}
        style={styles.image}
        contentFit="contain"
        transition={200}
      />
      <View style={styles.textContainer}>
        <Text style={styles.title}>No Trips Yet</Text>
        <Text style={styles.description}>
          Start tracking your mileage by tapping the button below
        </Text>
      </View>
      <View style={styles.features}>
        <View style={styles.feature}>
          <MaterialIcons name="gps-fixed" size={20} color={theme.colors.primary} />
          <Text style={styles.featureText}>GPS tracking</Text>
        </View>
        <View style={styles.feature}>
          <MaterialIcons name="sync" size={20} color={theme.colors.primary} />
          <Text style={styles.featureText}>Auto sync</Text>
        </View>
        <View style={styles.feature}>
          <MaterialIcons name="lock" size={20} color={theme.colors.primary} />
          <Text style={styles.featureText}>Privacy first</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
  },
  image: {
    width: 240,
    height: 320,
    marginBottom: theme.spacing.xl,
  },
  textContainer: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  title: {
    fontSize: theme.typography.headlineLarge,
    fontWeight: theme.typography.weightBold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    includeFontPadding: false,
  },
  description: {
    fontSize: theme.typography.bodyMedium,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: theme.typography.bodyMedium * theme.typography.lineHeightRelaxed,
  },
  features: {
    flexDirection: 'row',
    gap: theme.spacing.lg,
  },
  feature: {
    alignItems: 'center',
  },
  featureText: {
    fontSize: theme.typography.labelSmall,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
    includeFontPadding: false,
  },
});
