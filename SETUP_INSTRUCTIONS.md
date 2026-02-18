# GarageMinder Mobile App - Setup Instructions

## Authentication Flow

The app uses **direct login** with the GarageMinder API - no WebView or native dependencies required.

### How It Works

1. **User opens the app** → Sees login form
2. **User enters credentials** → Email/username and password
3. **App calls API** → `POST /auth/login` with credentials
4. **Server returns JWT tokens** → Access token (30 min) + refresh token (30 days)
5. **App fetches vehicles** → `GET /vehicles` to load user's vehicles
6. **Navigate to home** → User sees their vehicles and trip history

### API Endpoints Used

- **POST** `/auth/login` - Authenticate with username/password
- **POST** `/auth/refresh` - Refresh access token
- **POST** `/auth/logout` - Revoke refresh token
- **GET** `/auth/verify` - Verify current token
- **GET** `/vehicles` - Fetch user's vehicles
- **POST** `/sync/register-device` - Register device for sync tracking

## No Additional Setup Required

✅ No native dependencies  
✅ No package installation needed  
✅ Works on all platforms (iOS, Android, Web)  
✅ Simple and reliable

Just run the app and sign in!

## Security Features

- **Secure token storage** using `expo-secure-store`
- **Automatic token refresh** when access token expires
- **Device registration** for push notifications and sync tracking
- **Encrypted local storage** for user data and tokens

## How to Use

### First Time
1. Open the app
2. Enter your GarageMinder email/username
3. Enter your password
4. Tap "Sign In"
5. Wait for vehicles to load
6. Start tracking trips!

### Subsequent Opens
- If token is valid → Auto-login to home screen
- If token expired → Show login screen

## Troubleshooting

### "Invalid email or password" error
- Check your credentials
- Make sure you're using the correct email/username
- Password is case-sensitive

### "Network error" message
- Check your internet connection
- Verify API is accessible: https://yesca.st/gm/api/v1
- Check firewall/VPN settings

### Vehicles not loading
- Check network logs in console
- Verify user has vehicles in their account
- Try logging out and back in

### Token expired
- App automatically refreshes tokens
- If refresh fails, you'll be logged out
- Just sign in again

## Console Logs to Monitor

Watch for these logs during login:

```
[LoginScreen] Attempting login...
[AuthService] Login endpoint: https://yesca.st/gm/api/v1/auth/login
[AuthService] Login response status: 200
[AuthContext] Fetching vehicles from API...
[LoginScreen] Login successful, navigating to home...
```

Any errors will show detailed messages in the console.

## API Response Format

All API responses follow this structure:

```json
{
  "success": true,
  "data": { ... },
  "error": null,
  "meta": {
    "api_version": "1.0.0",
    "timestamp": 1739404800
  }
}
```

Error responses:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid username or password",
    "details": null
  },
  "meta": { ... }
}
```

## Features

✅ JWT-based authentication  
✅ Automatic token refresh  
✅ Secure token storage  
✅ Vehicle sync from server  
✅ Device registration  
✅ Multi-device support  
✅ Session management  

## Next Steps After Login

Once logged in, the app automatically:
1. Stores JWT tokens securely
2. Fetches your vehicles from the server
3. Caches vehicles locally
4. Sets first vehicle as active
5. Registers device for sync
6. Navigates to home screen

You can then:
- View your vehicles
- Start tracking trips
- Manually adjust odometer readings
- Sync trip data to server
- Export trip history
- Manage account settings
