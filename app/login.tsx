import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, ActivityIndicator, Pressable, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { theme } from '../constants/theme';
import { useAuth } from '../hooks/useAuth';
import { useAlert } from '@/template';

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { login } = useAuth();
  const { showAlert } = useAlert();
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    // Validate inputs
    if (!username.trim()) {
      showAlert('Required Field', 'Please enter your email or username');
      return;
    }
    
    if (!password) {
      showAlert('Required Field', 'Please enter your password');
      return;
    }

    setIsLoading(true);
    
    try {
      console.log('[LoginScreen] Attempting login...');
      await login(username.trim(), password);
      
      console.log('[LoginScreen] Login successful, navigating to home...');
      
      // Small delay to ensure state updates
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Navigate to home screen
      router.replace('/(tabs)');
      
    } catch (error: any) {
      console.error('[LoginScreen] Login error:', error);
      
      let errorMessage = 'Unable to sign in. Please check your credentials.';
      
      if (error.code === 'INVALID_CREDENTIALS') {
        errorMessage = 'Invalid email or password';
      } else if (error.code === 'NETWORK_ERROR') {
        errorMessage = 'Network error. Please check your connection.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      showAlert('Sign In Failed', errorMessage);
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <Pressable 
              style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
              onPress={() => router.back()}
              disabled={isLoading}
            >
              <MaterialIcons name="arrow-back" size={24} color={theme.colors.text} />
            </Pressable>
          </View>

          {/* Logo & Title */}
          <View style={styles.logoContainer}>
            <View style={styles.logoCircle}>
              <MaterialIcons name="directions-car" size={48} color={theme.colors.primary} />
            </View>
            <Text style={styles.title}>GarageMinder</Text>
            <Text style={styles.subtitle}>Track your vehicle mileage</Text>
          </View>

          {/* Login Form */}
          <View style={styles.formContainer}>
            {/* Email/Username Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Email or Username</Text>
              <View style={styles.inputWrapper}>
                <MaterialIcons 
                  name="person-outline" 
                  size={20} 
                  color={theme.colors.textSubtle}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  value={username}
                  onChangeText={setUsername}
                  placeholder="Enter your email or username"
                  placeholderTextColor={theme.colors.textSubtle}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  editable={!isLoading}
                  returnKeyType="next"
                  onSubmitEditing={() => {}} // Focus password input
                />
              </View>
            </View>

            {/* Password Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Password</Text>
              <View style={styles.inputWrapper}>
                <MaterialIcons 
                  name="lock-outline" 
                  size={20} 
                  color={theme.colors.textSubtle}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter your password"
                  placeholderTextColor={theme.colors.textSubtle}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoading}
                  returnKeyType="go"
                  onSubmitEditing={handleLogin}
                />
                <Pressable 
                  style={styles.eyeButton}
                  onPress={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                >
                  <MaterialIcons 
                    name={showPassword ? "visibility" : "visibility-off"} 
                    size={20} 
                    color={theme.colors.textSubtle}
                  />
                </Pressable>
              </View>
            </View>

            {/* Login Button */}
            <Pressable
              style={({ pressed }) => [
                styles.loginButton,
                pressed && styles.loginButtonPressed,
                isLoading && styles.loginButtonDisabled,
              ]}
              onPress={handleLogin}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.loginButtonText}>Sign In</Text>
                  <MaterialIcons name="arrow-forward" size={20} color="#FFFFFF" />
                </>
              )}
            </Pressable>

            {/* Help Text */}
            <View style={styles.helpContainer}>
              <MaterialIcons name="info-outline" size={16} color={theme.colors.textSubtle} />
              <Text style={styles.helpText}>
                Use your GarageMinder account credentials
              </Text>
            </View>
          </View>

          {/* Footer */}
          <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
            <Text style={styles.footerText}>
              Don't have an account?
            </Text>
            <Pressable 
              onPress={() => {
                // TODO: Navigate to signup or open web signup
                showAlert('Create Account', 'Please visit our website to create an account.');
              }}
              disabled={isLoading}
            >
              <Text style={styles.footerLink}>Create one</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  backButton: {
    padding: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
    alignSelf: 'flex-start',
  },
  backButtonPressed: {
    opacity: 0.7,
  },
  logoContainer: {
    alignItems: 'center',
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.xxl,
  },
  logoCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.lg,
  },
  title: {
    fontSize: theme.typography.h1,
    fontWeight: theme.typography.weightBold,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
    includeFontPadding: false,
  },
  subtitle: {
    fontSize: theme.typography.bodyMedium,
    color: theme.colors.textSecondary,
    includeFontPadding: false,
  },
  formContainer: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  inputContainer: {
    marginBottom: theme.spacing.lg,
  },
  inputLabel: {
    fontSize: theme.typography.bodyMedium,
    fontWeight: theme.typography.weightMedium,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    includeFontPadding: false,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  inputIcon: {
    marginLeft: theme.spacing.md,
  },
  input: {
    flex: 1,
    fontSize: theme.typography.bodyMedium,
    color: theme.colors.text,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.sm,
    includeFontPadding: false,
  },
  passwordInput: {
    paddingRight: theme.spacing.xs,
  },
  eyeButton: {
    padding: theme.spacing.md,
  },
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.md + 2,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    marginTop: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  loginButtonPressed: {
    opacity: 0.9,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    fontSize: theme.typography.bodyLarge,
    fontWeight: theme.typography.weightSemiBold,
    color: '#FFFFFF',
    includeFontPadding: false,
  },
  helpContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  helpText: {
    fontSize: theme.typography.labelSmall,
    color: theme.colors.textSubtle,
    includeFontPadding: false,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.lg,
    gap: theme.spacing.xs,
    marginTop: 'auto',
  },
  footerText: {
    fontSize: theme.typography.bodySmall,
    color: theme.colors.textSecondary,
    includeFontPadding: false,
  },
  footerLink: {
    fontSize: theme.typography.bodySmall,
    color: theme.colors.primary,
    fontWeight: theme.typography.weightSemiBold,
    includeFontPadding: false,
  },
});
