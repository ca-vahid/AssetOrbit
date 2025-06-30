import React, { useEffect, useState } from 'react';
import AuthButtons from './components/AuthButtons';
import { useMsal } from '@azure/msal-react';
import axios from 'axios';

const App: React.FC = () => {
  const { instance, accounts } = useMsal();
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchProtected = async () => {
      if (accounts.length === 0) return;
      try {
        // Use the API scope (your client ID + /.default for app permissions)
        const apiScope = `api://${import.meta.env.VITE_AZURE_AD_CLIENT_ID}/access_as_user`;
        const result = await instance.acquireTokenSilent({ 
          scopes: [apiScope], 
          account: accounts[0] 
        });
        const res = await axios.get('http://localhost:4000/api/protected', {
          headers: { Authorization: `Bearer ${result.accessToken}` },
        });
        setMessage(JSON.stringify(res.data));
      } catch (err) {
        console.error(err);
      }
    };
    fetchProtected();
  }, [accounts, instance]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gray-50 p-6 dark:bg-gray-900">
      <h1 className="text-3xl font-bold text-primary-600 dark:text-primary-400">AssetOrbit</h1>
      <AuthButtons />
      {message && (
        <pre className="whitespace-pre-wrap rounded bg-gray-800 p-4 text-sm text-green-400">
          {message}
        </pre>
      )}
    </div>
  );
};

export default App; 