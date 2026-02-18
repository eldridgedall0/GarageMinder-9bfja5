import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable, TextInput } from 'react-native';
import { WebView, WebViewNavigation, WebViewMessageEvent } from 'react-native-webview';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { theme } from '../constants/theme';
import { API_CONFIG } from '../constants/config';
import { useAuth } from '../hooks/useAuth';
import { useAlert } from '@/template';

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { loginWithCookies } = useAuth();
  const { showAlert } = useAlert();
  const webViewRef = useRef<WebView>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [canGoBack, setCanGoBack] = useState(false);
  const [showDirectLogin, setShowDirectLogin] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleNavigationStateChange = (navState: WebViewNavigation) => {
    setCanGoBack(navState.canGoBack);
    console.log('[LoginScreen] URL changed:', navState.url);

    // Detect successful login redirect
    if (navState.url.includes('login_success=1') || navState.url.includes('/app/')) {
      // WordPress cookies are HttpOnly and cannot be accessed via JavaScript
      // Redirect user to direct login form instead
      console.log('[LoginScreen] Login detected, redirecting to direct login');
      showAlert(
        'Complete Login',
        'Please enter your credentials below to complete sign-in.',
        [
          {
            text: 'OK',
            onPress: () => setShowDirectLogin(true),
          },
        ]
      );
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    if (showDirectLogin) {
      setShowDirectLogin(false);
    } else if (canGoBack && webViewRef.current) {
      webViewRef.current.goBack();
    } else {
      router.back();
    }
  };

  const handleDirectLogin = async () => {
    if (!username || !password) {
      showAlert('Required Fields', 'Please enter both email and password.');
      return;
    }
    
    setIsLoading(true);
    try {
      const { login } = await import('../services/authService');
      await login(username, password);
      router.replace('/(tabs)');
    } catch (error: any) {
      showAlert('Login Failed', error.message || 'Invalid username or password.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable 
          style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
          onPress={handleBack}
        >
          <MaterialIcons name="arrow-back" size={24} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Sign In</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Loading Indicator */}
      {isLoading && !showDirectLogin && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      )}

      {/* WebView or Direct Login Form */}
      {!showDirectLogin ? (
        <WebView
          ref={webViewRef}
          source={{ uri: API_CONFIG.LOGIN_URL }}
          style={styles.webview}
          onNavigationStateChange={handleNavigationStateChange}
          onLoadStart={() => setIsLoading(true)}
          onLoadEnd={() => setIsLoading(false)}
          sharedCookiesEnabled={true}
          thirdPartyCookiesEnabled={true}
          javaScriptEnabled={true}
          domStorageEnabled={true}
        />
      ) : (
        <View style={styles.directLoginForm}>
          <View style={styles.formContainer}>
            <Text style={styles.formTitle}>Sign In</Text>
            <Text style={styles.formSubtitle}>Enter your GarageMinder credentials</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email Address</Text>
              <TextInput
                style={styles.input}
                placeholder="your@email.com"
                placeholderTextColor={theme.colors.textSubtle}
                value={username}
                onChangeText={setUsername}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Password</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your password"
                placeholderTextColor={theme.colors.textSubtle}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={true}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
              />
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.loginButton,
                pressed && styles.loginButtonPressed,
                isLoading && styles.loginButtonDisabled,
              ]}
              onPress={handleDirectLogin}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.loginButtonText}>Sign In</Text>
              )}
            </Pressable>

            <Pressable
              style={styles.switchMethodButton}
              onPress={() => setShowDirectLogin(false)}
              disabled={isLoading}
            >
              <MaterialIcons name="arrow-back" size={16} color={theme.colors.primary} />
              <Text style={styles.switchMethodText}>Back to web login</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Help Text */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        {!showDirectLogin ? (
          <>
            <MaterialIcons name="info-outline" size={16} color={theme.colors.textSubtle} />
            <Text style={styles.footerText}>
              Sign in with your GarageMinder account
            </Text>
            <Pressable
              style={styles.troubleButton}
              onPress={() => setShowDirectLogin(true)}
            >
              <Text style={styles.troubleText}>Use direct login</Text>
            </Pressable>
          </>
        ) : (
          <>
            <MaterialIcons name="lock-outline" size={16} color={theme.colors.textSubtle} />
            <Text style={styles.footerText}>
              Your credentials are securely encrypted
            </Text>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backButton: {
    padding: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
  },
  backButtonPressed: {
    opacity: 0.7,
  },
  headerTitle: {
    fontSize: theme.typography.bodyLarge,
    fontWeight: theme.typography.weightSemiBold,
    color: theme.colors.text,
    includeFontPadding: false,
  },
  headerSpacer: {
    width: 40,
  },
  webview: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  loadingText: {
    fontSize: theme.typography.bodyMedium,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.md,
    includeFontPadding: false,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
    gap: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  footerText: {
    fontSize: theme.typography.labelSmall,
    color: theme.colors.textSubtle,
    includeFontPadding: false,
  },
  troubleButton: {
    marginLeft: 'auto',
  },
  troubleText: {
    fontSize: theme.typography.labelSmall,
    color: theme.colors.primary,
    fontWeight: theme.typography.weightSemiBold,
    includeFontPadding: false,
  },
  directLoginForm: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  formContainer: {
    maxWidth: 400,
    width: '100%',
    alignSelf: 'center',
  },
  formTitle: {
    fontSize: 28,
    fontWeight: theme.typography.weightBold,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
    includeFontPadding: false,
  },
  formSubtitle: {
    fontSize: theme.typography.bodyMedium,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xl,
    includeFontPadding: false,
  },
  inputGroup: {
    marginBottom: theme.spacing.lg,
  },
  inputLabel: {
    fontSize: theme.typography.labelMedium,
    fontWeight: theme.typography.weightSemiBold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    includeFontPadding: false,
  },
  input: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    fontSize: theme.typography.bodyMedium,
    color: theme.colors.text,
    includeFontPadding: false,
  },
  loginButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    marginTop: theme.spacing.md,
    minHeight: 48,
    justifyContent: 'center',
  },
  loginButtonPressed: {
    opacity: 0.8,
  },
  loginButtonDisabled: {
    opacity: 0.5,
  },
  loginButtonText: {
    fontSize: theme.typography.bodyLarge,
    fontWeight: theme.typography.weightSemiBold,
    color: '#FFFFFF',
    includeFontPadding: false,
  },
  switchMethodButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
  },
  switchMethodText: {
    fontSize: theme.typography.bodyMedium,
    color: theme.colors.primary,
    includeFontPadding: false,
  },
});
