/**
 * Design System - GarageMinder Mileage Tracker
 * Physical Metaphor: Glass with automotive dashboard aesthetics
 * Signature: Dark gradient backgrounds + Golden accents + Large metric displays
 */

export const theme = {
  colors: {
    // Base - Dark automotive theme
    background: '#0a0a0a',
    backgroundSecondary: '#121212',
    backgroundTertiary: '#1a1a1a',
    
    // Surface - Glass layers
    surface: '#1a1a1a',
    surfaceElevated: '#242424',
    surfaceOverlay: 'rgba(26, 26, 26, 0.95)',
    
    // Brand - Golden accents
    primary: '#FFD700',
    primaryDark: '#E5C100',
    primaryLight: '#FFE44D',
    
    // Text
    text: '#FFFFFF',
    textSecondary: '#B0B0B0',
    textSubtle: '#666666',
    textInverse: '#0a0a0a',
    
    // Semantic
    success: '#4CAF50',
    warning: '#FFA726',
    error: '#EF5350',
    info: '#42A5F5',
    
    // Status badges
    active: '#4CAF50',
    pending: '#FFA726',
    synced: '#42A5F5',
    edited: '#9C27B0',
    
    // Border
    border: '#2a2a2a',
    borderSubtle: '#1a1a1a',
    
    // Overlay
    overlay: 'rgba(0, 0, 0, 0.7)',
    scrim: 'rgba(0, 0, 0, 0.5)',
  },
  
  typography: {
    // Font families
    fontRegular: 'System',
    fontMedium: 'System',
    fontBold: 'System',
    
    // Font sizes (1.2 scale based on 16px)
    displayLarge: 40,
    displayMedium: 32,
    displaySmall: 28,
    headlineLarge: 24,
    headlineMedium: 20,
    headlineSmall: 18,
    bodyLarge: 18,
    bodyMedium: 16,
    bodySmall: 14,
    labelLarge: 16,
    labelMedium: 14,
    labelSmall: 12,
    
    // Font weights
    weightRegular: '400' as const,
    weightMedium: '500' as const,
    weightSemiBold: '600' as const,
    weightBold: '700' as const,
    
    // Line heights
    lineHeightTight: 1.2,
    lineHeightNormal: 1.5,
    lineHeightRelaxed: 1.7,
  },
  
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  
  borderRadius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    full: 9999,
  },
  
  shadows: {
    small: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 2,
    },
    medium: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 4,
    },
    large: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.4,
      shadowRadius: 16,
      elevation: 8,
    },
  },
  
  layout: {
    screenPadding: 16,
    cardPadding: 16,
    maxWidth: 960,
  },
};

export type Theme = typeof theme;
