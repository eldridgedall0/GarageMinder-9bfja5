import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { theme } from '../constants/theme';
import { Button } from '../components/ui/Button';

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.content}>
        {/* Logo */}
        <View style={styles.logoContainer}>
          <MaterialIcons name="directions-car" size={80} color={theme.colors.primary} />
          <Text style={styles.appName}>GarageMinder</Text>
          <Text style={styles.tagline}>Mileage Tracker</Text>
        </View>

        {/* Features */}
        <View style={styles.features}>
          <FeatureItem 
            icon="gps-fixed" 
            text="Automatic GPS tracking"
          />
          <FeatureItem 
            icon="cloud-off" 
            text="Privacy-first (data stays local)"
          />
          <FeatureItem 
            icon="sync" 
            text="Sync odometer to GarageMinder"
          />
          <FeatureItem 
            icon="security" 
            text="Secure with biometric unlock"
          />
        </View>

        {/* CTA */}
        <View style={styles.actions}>
          <Button
            title="Sign In to Get Started"
            onPress={() => router.push('/login')}
            variant="primary"
          />
          
          <View style={styles.helpText}>
            <MaterialIcons name="help-outline" size={16} color={theme.colors.textSubtle} />
            <Text style={styles.helpTextContent}>
              Use your existing GarageMinder account
            </Text>
          </View>
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <MaterialIcons name="privacy-tip" size={14} color={theme.colors.textSubtle} />
        <Text style={styles.footerText}>
          Your GPS data never leaves your device
        </Text>
      </View>
    </SafeAreaView>
  );
}

function FeatureItem({ icon, text }: { icon: keyof typeof MaterialIcons.glyphMap; text: string }) {
  return (
    <View style={styles.featureItem}>
      <MaterialIcons name={icon} size={24} color={theme.colors.primary} />
      <Text style={styles.featureText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
    padding: theme.spacing.xl,
    justifyContent: 'space-between',
  },
  logoContainer: {
    alignItems: 'center',
    paddingTop: theme.spacing.xxl,
  },
  appName: {
    fontSize: theme.typography.headlineLarge,
    fontWeight: theme.typography.weightBold,
    color: theme.colors.text,
    marginTop: theme.spacing.md,
    includeFontPadding: false,
  },
  tagline: {
    fontSize: theme.typography.bodyLarge,
    color: theme.colors.primary,
    marginTop: theme.spacing.xs,
    includeFontPadding: false,
  },
  features: {
    gap: theme.spacing.lg,
    paddingVertical: theme.spacing.xl,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  featureText: {
    fontSize: theme.typography.bodyMedium,
    color: theme.colors.text,
    flex: 1,
    includeFontPadding: false,
  },
  actions: {
    gap: theme.spacing.md,
  },
  helpText: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    paddingTop: theme.spacing.sm,
  },
  helpTextContent: {
    fontSize: theme.typography.labelMedium,
    color: theme.colors.textSubtle,
    includeFontPadding: false,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    padding: theme.spacing.md,
  },
  footerText: {
    fontSize: theme.typography.labelSmall,
    color: theme.colors.textSubtle,
    includeFontPadding: false,
  },
});
