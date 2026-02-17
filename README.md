# GarageMinder Mileage Tracker

A comprehensive, privacy-first mileage tracking app built with React Native and Expo, based on the complete blueprint specifications.

## 🚗 Features Implemented (V1.5)

### ✅ Core Trip Tracking
- **Real GPS Tracking**: Integrated expo-location for accurate distance calculation using Haversine formula
- **Background Location**: Continues tracking when app is backgrounded (foreground service on Android)
- **Automatic Trip Detection**: Movement-based start detection with 30-second grace period
- **Smart Stop Detection**: 5-minute grace period prevents accidental trip splits during brief stops
- **Live Metrics**: Real-time distance, duration, and speed updates

### ✅ Subscription-Based Sync
- **Free Users**: Manual sync only via button tap
- **Paid Users**: Automatic sync options
  - After trip completion (30s delay)
  - On app open
  - Scheduled sync (future)
- **Background Sync**: Progress notifications, retry on failure
- **Subscription Management**: Easy upgrade/downgrade in settings

### ✅ Trip Management
- View all trips with status filters (All, Pending, Synced)
- Sort by date, distance, duration
- Edit trip details (distance, notes, vehicle)
- Delete trips with confirmation
- **Manual Odometer Adjustments**: Override GPS calculations to match dashboard
- Detailed trip view with discrepancy warnings

### ✅ Vehicle Management
- Multiple vehicle support
- Quick vehicle switching
- Auto-update odometer after trips
- Vehicle-specific trip history

### ✅ Security & Privacy
- **Biometric Authentication**: Fingerprint/Face ID unlock
- **Secure Storage**: expo-secure-store for sensitive data
- **GPS Privacy**: Location data NEVER leaves device
- **Encrypted Sessions**: Secure credential storage
- **Local-First**: Fully functional offline

### ✅ Export & Reporting
- **CSV Export**: Compatible with Excel/Sheets
- **JSON Export**: Complete data backup
- **Mileage Reports**: Summary statistics
- **Share Functionality**: Email, cloud storage

### ✅ Notifications
- Trip started/completed notifications
- Sync progress and completion
- Background tracking indicator
- Customizable notification preferences

### ✅ User Experience
- Material 3 dark theme with golden accents
- Automotive-inspired design
- Safe area support (notches, home indicators)
- Pull-to-refresh
- Loading states and error handling

## 🏗️ Architecture

### Tech Stack
- **Framework**: React Native with Expo SDK 52
- **Routing**: Expo Router (file-based)
- **State**: React Hooks + AsyncStorage
- **Location**: expo-location + expo-task-manager
- **Security**: expo-local-authentication + expo-secure-store
- **Notifications**: expo-notifications
- **Storage**: @react-native-async-storage/async-storage

### Project Structure
```
├── app/                          # Expo Router pages
│   ├── (tabs)/                   # Tab navigation
│   │   ├── index.tsx             # Dashboard (active trip)
│   │   ├── trips.tsx             # Trip history
│   │   ├── export.tsx            # Export & reports
│   │   └── settings.tsx          # Settings & subscription
│   ├── trip-details.tsx          # Trip detail view
│   └── _layout.tsx               # Root layout + background tasks
├── services/                     # Data & business logic
│   ├── tripService.ts            # Trip CRUD + sync
│   ├── locationService.ts        # GPS tracking + calculations
│   ├── subscriptionService.ts    # Subscription management
│   ├── biometricService.ts       # Biometric auth
│   ├── notificationService.ts    # Push notifications
│   └── exportService.ts          # CSV/JSON export
├── hooks/                        # Custom React hooks
│   ├── useTripTracking.ts        # Main trip tracking logic
│   ├── useLocationTracking.ts    # GPS location handling
│   ├── useTrips.ts               # Trip list management
│   └── useVehicles.ts            # Vehicle management
├── components/                   # Reusable UI components
│   ├── ui/                       # Base components
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   └── Badge.tsx
│   └── trip/                     # Trip-specific components
│       ├── ActiveTripCard.tsx
│       ├── TripListItem.tsx
│       └── EmptyTrips.tsx
├── constants/                    # Design system
│   └── theme.ts                  # Colors, typography, spacing
├── types/                        # TypeScript definitions
│   └── trip.ts
└── assets/                       # Images & icons
    └── images/
        ├── empty-trips.png
        └── vehicle-icon.png
```

## 🔐 Security Features

### Privacy-First Design
- **No Cloud GPS Storage**: Location data stays on device
- **Odometer Deltas Only**: Server only receives mileage totals
- **Offline-Capable**: Works 100% without internet
- **User Control**: Manual sync, manual trip creation

### Authentication & Encryption
- Biometric unlock (fingerprint/Face ID)
- Encrypted credential storage (Keystore/SecureStore)
- Session validation
- Secure data export

## 📱 Permissions

### iOS (Info.plist)
- `NSLocationWhenInUseUsageDescription`: Foreground location
- `NSLocationAlwaysAndWhenInUseUsageDescription`: Background location
- `NSFaceIDUsageDescription`: Biometric authentication
- `UIBackgroundModes`: location, fetch

### Android (Manifest)
- `ACCESS_FINE_LOCATION`: High-accuracy GPS
- `ACCESS_BACKGROUND_LOCATION`: Background tracking
- `FOREGROUND_SERVICE_LOCATION`: Persistent tracking
- `USE_BIOMETRIC`: Fingerprint/face unlock

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and npm/yarn
- Expo CLI: `npm install -g expo-cli`
- iOS Simulator (Mac) or Android Emulator

### Installation
```bash
# Install dependencies
npm install

# Start development server
npx expo start

# Run on iOS
npx expo start --ios

# Run on Android
npx expo start --android
```

### Testing Location Features

**iOS Simulator:**
1. Debug > Location > Custom Location
2. Enter coordinates or select preset (e.g., City Run)

**Android Emulator:**
1. Extended Controls (...) > Location
2. Select route or enter coordinates

## 🎯 Usage Guide

### Starting a Trip
1. Open app → Dashboard tab
2. Select vehicle from dropdown
3. Tap "Start Trip" button
4. Grant location permissions when prompted
5. Trip begins tracking automatically

### Viewing Trips
1. Navigate to Trips tab
2. Use filters to view pending/synced trips
3. Tap any trip to see details
4. Edit distance, notes, or delete trip

### Syncing Data
**Free Users:**
- Tap sync button in Trips tab
- Wait for background notification

**Paid Users:**
- Enable auto-sync in Settings
- Trips sync automatically after completion
- Configure sync frequency

### Exporting Data
1. Navigate to Export tab
2. Choose CSV or JSON format
3. Share via email, Drive, etc.

### Security Setup
1. Go to Settings tab
2. Enable "Biometric Unlock"
3. Authenticate with fingerprint/Face ID
4. Future app opens require biometric

## 📊 Subscription Plans

### Free Plan
- ✅ Unlimited trip tracking
- ✅ GPS distance calculation
- ✅ Manual odometer adjustments
- ✅ Trip editing & deletion
- ✅ Manual sync
- ✅ Export (CSV/JSON)
- ❌ Auto-sync

### Paid Plan
- ✅ Everything in Free
- ✅ Automatic sync after trips
- ✅ Background sync
- ✅ Scheduled sync
- ✅ Priority support
- 🔮 Future: Analytics, OCR receipts

## 🛠️ Development

### Adding New Features
1. Create service in `services/` for data/API logic
2. Create hook in `hooks/` for state management
3. Create component in `components/` for UI
4. Add screen in `app/(tabs)/` if needed

### Testing
```bash
# Run type checking
npx tsc --noEmit

# Run linter
npx eslint .
```

### Building for Production
```bash
# iOS
eas build --platform ios

# Android
eas build --platform android
```

## 📈 Future Enhancements (Blueprint Roadmap)

### Phase 2 (Planned)
- [ ] Bluetooth auto-detection (car connection)
- [ ] Android Auto integration
- [ ] Trip merging for split trips
- [ ] Manual trip creation
- [ ] Route visualization on map
- [ ] Statistics dashboard

### Phase 3 (Future)
- [ ] Smart trip classification (business/personal)
- [ ] IRS mileage reports
- [ ] OCR receipt scanning
- [ ] Voice commands
- [ ] OBD-II adapter support
- [ ] Fleet management

## 📄 License

Proprietary - GarageMinder © 2025

## 🤝 Support

For issues or questions:
- Email: support@garageminder.com
- Documentation: https://docs.garageminder.com

---

**Version**: 1.5.0  
**Last Updated**: January 2026  
**Blueprint Implementation**: 70% Complete
