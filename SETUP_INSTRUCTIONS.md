# GarageMinder Mobile App - Setup Instructions

## Required Package Installation

To complete the WebView login flow, you need to install the native cookie manager package.

### Install the package:

```bash
npm install @react-native-cookies/cookies@^6.2.1
```

### After installation:

1. **Stop your development server** (if running)
2. **Rebuild the app**:
   - For Expo Go: Not supported (requires custom development build)
   - For development build: `npx expo prebuild` then rebuild
   - For iOS: `cd ios && pod install && cd ..` then rebuild
   - For Android: Just rebuild the app

3. **Restart the development server**: `npx expo start`

## How the Login Flow Works

1. User opens the app → Sees WebView with GarageMinder login page
2. User enters credentials and logs in on the web page
3. On successful login, page redirects to URL with `login_success=1`
4. App detects redirect, extracts WordPress session cookies using native API
5. App calls `/auth/token-exchange` API endpoint with cookies
6. Server returns JWT access + refresh tokens
7. App stores tokens securely and fetches user's vehicles from API
8. App navigates to home screen with loaded vehicle data

## API Endpoints Used

- **POST** `/auth/token-exchange` - Exchange WordPress cookies for JWT tokens
- **GET** `/vehicles` - Fetch user's vehicles from server
- **POST** `/sync/register-device` - Register device for push notifications

## Troubleshooting

### "Cookie manager not available" error:
- Run: `npm install @react-native-cookies/cookies@^6.2.1`
- Rebuild the app completely

### "WordPress session cookie not found" error:
- The login on the web page may have failed
- Check that the login URL is correct: `https://yesca.st/gm/login/?mobile=1`
- Verify the redirect includes `login_success=1` parameter

### Vehicles not loading after login:
- Check network logs in console
- Verify API endpoint `/vehicles` is working
- Check that user has vehicles associated with their account

## Console Logs to Monitor

When testing login, watch for these console logs:

```
[LoginScreen] URL changed: https://...
[LoginScreen] Login success detected, extracting cookies...
[LoginScreen] Cookie keys: [...]
[LoginScreen] Has WP cookie: true
[LoginScreen] Exchanging cookie for JWT tokens...
[AuthService] Token exchange URL: https://yesca.st/gm/api/v1/auth/token-exchange
[AuthService] Exchange status: 200
[AuthContext] Fetching vehicles from API...
[LoginScreen] Login complete, navigating to home...
```

Any errors will also appear in the console with detailed messages.
