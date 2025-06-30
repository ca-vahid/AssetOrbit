import { PublicClientApplication, type Configuration } from '@azure/msal-browser';

const msalConfig: Configuration = {
  auth: {
    clientId: import.meta.env.VITE_AZURE_AD_CLIENT_ID as string,
    authority: import.meta.env.VITE_AZURE_AD_AUTHORITY as string,
    redirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: 'localStorage',
    storeAuthStateInCookie: false,
  },
};

export const msalInstance = new PublicClientApplication(msalConfig);

// Initialize the MSAL instance
export const initializeMsal = async () => {
  await msalInstance.initialize();
}; 