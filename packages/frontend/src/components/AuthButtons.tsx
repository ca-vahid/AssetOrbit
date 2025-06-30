import React from 'react';
import { useMsal } from '@azure/msal-react';
import { InteractionType, PopupRequest } from '@azure/msal-browser';

const loginRequest: PopupRequest = {
  scopes: [`api://${import.meta.env.VITE_AZURE_AD_CLIENT_ID}/access_as_user`],
};

const AuthButtons: React.FC = () => {
  const { instance, accounts } = useMsal();
  const isAuthenticated = accounts.length > 0;

  const handleLogin = () => {
    instance.loginPopup(loginRequest).catch((e) => console.error(e));
  };

  const handleLogout = () => {
    instance.logoutPopup().catch((e) => console.error(e));
  };

  return isAuthenticated ? (
    <button
      onClick={handleLogout}
      className="rounded bg-red-500 px-4 py-2 font-semibold text-white hover:bg-red-600"
    >
      Sign Out
    </button>
  ) : (
    <button
      onClick={handleLogin}
      className="rounded bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700"
    >
      Sign In
    </button>
  );
};

export default AuthButtons; 