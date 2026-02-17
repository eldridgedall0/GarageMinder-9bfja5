// API Configuration
export const API_CONFIG = {
  BASE_URL: 'https://yesca.st/gm/api/v1',
  LOGIN_URL: 'https://yesca.st/gm/login/?mobile=1',
  WEB_APP_URL: 'https://yesca.st/gm/app',
  
  // Token expiry times
  ACCESS_TOKEN_EXPIRY: 30 * 60 * 1000, // 30 minutes
  REFRESH_TOKEN_EXPIRY: 30 * 24 * 60 * 60 * 1000, // 30 days
  
  // Request timeouts
  TIMEOUT: 30000, // 30 seconds
};

// Storage keys
export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'gm_access_token',
  REFRESH_TOKEN: 'gm_refresh_token',
  USER_DATA: 'gm_user_data',
  TOKEN_EXPIRY: 'gm_token_expiry',
};
