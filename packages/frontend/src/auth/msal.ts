import { PublicClientApplication, type Configuration, BrowserCacheLocation } from '@azure/msal-browser';

const msalConfig: Configuration = {
  auth: {
    clientId: import.meta.env.VITE_AZURE_AD_CLIENT_ID as string,
    authority: import.meta.env.VITE_AZURE_AD_AUTHORITY as string,
    redirectUri: window.location.origin,
    postLogoutRedirectUri: window.location.origin,
    navigateToLoginRequestUrl: false, // Prevents redirect loops
  },
  cache: {
    cacheLocation: BrowserCacheLocation.LocalStorage,
    storeAuthStateInCookie: false,
    secureCookies: false,
  },
  system: {
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (!containsPii) {
          switch (level) {
            case 0: // Error
              console.error('MSAL Error:', message);
              break;
            case 1: // Warning
              console.warn('MSAL Warning:', message);
              break;
            case 2: // Info
              console.info('MSAL Info:', message);
              break;
            case 3: // Verbose
              console.debug('MSAL Verbose:', message);
              break;
          }
        }
      },
      piiLoggingEnabled: false,
    },
    allowNativeBroker: false, // Disables WAM which can cause issues
    windowHashTimeout: 60000,
    iframeHashTimeout: 6000,
  },
};

export const msalInstance = new PublicClientApplication(msalConfig);

// Track if we're currently in an authentication flow
let isAuthenticating = false;

// Initialize the MSAL instance
export const initializeMsal = async () => {
  await msalInstance.initialize();
  
  // Handle redirect promise to complete authentication
  try {
    const response = await msalInstance.handleRedirectPromise();
    if (response) {
      console.log('Authentication successful after redirect');
    }
  } catch (error) {
    console.error('Error handling redirect promise:', error);
  }
};

// Safe token acquisition with loop prevention
export const acquireTokenSafely = async (scopes: string[]) => {
  if (isAuthenticating) {
    throw new Error('Authentication already in progress');
  }

  const accounts = msalInstance.getAllAccounts();
  if (accounts.length === 0) {
    throw new Error('No accounts available');
  }

  try {
    // Try silent acquisition first
    const result = await msalInstance.acquireTokenSilent({
      scopes,
      account: accounts[0],
    });
    return result;
  } catch (error: any) {
    console.warn('Silent token acquisition failed:', error);
    
    // Only try interactive flow if it's an interaction required error
    // and we're not already authenticating
    if (error.name === 'InteractionRequiredAuthError' && !isAuthenticating) {
      isAuthenticating = true;
      try {
        const result = await msalInstance.acquireTokenPopup({
          scopes,
          account: accounts[0],
        });
        return result;
      } finally {
        isAuthenticating = false;
      }
    }
    
    throw error;
  }
};

// Check if currently authenticating
export const getIsAuthenticating = () => isAuthenticating;

// Reset authentication state (useful for error recovery)
export const resetAuthState = () => {
  isAuthenticating = false;
};

// Clear all authentication data (useful for debugging/recovery)
export const clearAuthData = async () => {
  try {
    isAuthenticating = false;
    
    // Clear MSAL cache by logging out all accounts
    const accounts = msalInstance.getAllAccounts();
    for (const account of accounts) {
      await msalInstance.logoutRedirect({ account });
    }
    
    console.log('Authentication data cleared');
  } catch (error) {
    console.error('Error clearing authentication data:', error);
  }
}; 