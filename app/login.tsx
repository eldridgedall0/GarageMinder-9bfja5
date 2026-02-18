import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { WebView, WebViewNavigation } from 'react-native-webview';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { theme } from '../constants/theme';
import { API_CONFIG } from '../constants/config';
import { useAuth } from '../hooks/useAuth';
import { useAlert } from '@/template';

// Import cookie manager
let CookieManager: any;
try {
  CookieManager = require('@react-native-cookies/cookies').default;
} catch (error) {
  console.warn('Cookie manager not available. Please install @react-native-cookies/cookies');
}

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { loginWithCookies } = useAuth();
  const { showAlert } = useAlert();
  const webViewRef = useRef<WebView>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [canGoBack, setCanGoBack] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const handleNavigationStateChange = async (navState: WebViewNavigation) => {
    setCanGoBack(navState.canGoBack);
    console.log('[LoginScreen] URL changed:', navState.url);

    // Detect successful login redirect
    if (navState.url.includes('login_success=1') || navState.url.includes('/app/')) {
      console.log('[LoginScreen] Login success detected, extracting cookies...');
      setIsAuthenticating(true);
      
      try {
        // Check if cookie manager is available
        if (!CookieManager) {
          throw new Error(
            'Cookie manager not installed. Please run: npm install @react-native-cookies/cookies'
          );
        }

        // Extract cookies using native cookie manager
        const cookies = await CookieManager.get('https://yesca.st');
        console.log('[LoginScreen] Cookie keys:', Object.keys(cookies));
        
        // Build cookie string
        const cookieString = Object.entries(cookies)
          .map(([name, cookie]: [string, any]) => `${name}=${cookie.value}`)
          .join('; ');
        
        console.log('[LoginScreen] Has WP cookie:', cookieString.includes('wordpress_logged_in'));
        console.log('[LoginScreen] Cookie preview:', cookieString.substring(0, 80) + '...');

        if (!cookieString || !cookieString.includes('wordpress_logged_in')) {
          throw new Error('WordPress session cookie not found. Login may have failed.');
        }

        // Exchange cookie for JWT tokens and fetch user data + vehicles
        console.log('[LoginScreen] Exchanging cookie for JWT tokens...');
        await loginWithCookies(cookieString);
        
        // Small delay to ensure state updates
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Navigate to home screen
        console.log('[LoginScreen] Login complete, navigating to home...');
        router.replace('/(tabs)');
        
      } catch (error: any) {
        console.error('[LoginScreen] Login error:', error);
        setIsAuthenticating(false);
        showAlert('Login Failed', error.message || 'Failed to complete login. Please try again.');
      }
    }
  };

  const handleBack = () => {
    if (canGoBack && webViewRef.current) {
      webViewRef.current.goBack();
    } else {
      router.back();
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable 
          style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
          onPress={handleBack}
          disabled={isAuthenticating}
        >
          <MaterialIcons name="arrow-back" size={24} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Sign In</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Loading Indicator */}
      {(isLoading || isAuthenticating) && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>
            {isAuthenticating ? 'Signing in...' : 'Loading...'}
          </Text>
        </View>
      )}

      {/* WebView */}
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

      {/* Help Text */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <MaterialIcons name="info-outline" size={16} color={theme.colors.textSubtle} />
        <Text style={styles.footerText}>
          Sign in with your GarageMinder account
        </Text>
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
});
