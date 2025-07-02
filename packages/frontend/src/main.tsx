import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { MsalProvider } from '@azure/msal-react';
import { msalInstance, initializeMsal } from './auth/msal';

// Initialize MSAL before rendering
initializeMsal()
  .then(() => {
    ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
      <React.StrictMode>
        <MsalProvider instance={msalInstance}>
          <App />
        </MsalProvider>
      </React.StrictMode>,
    );
  })
  .catch((error) => {
    console.error('Failed to initialize MSAL:', error);
    // Still render the app, but it will show the login screen
    ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
      <React.StrictMode>
        <MsalProvider instance={msalInstance}>
          <App />
        </MsalProvider>
      </React.StrictMode>,
    );
  }); 