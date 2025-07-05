import React from 'react';

export const DebugInfo: React.FC = () => {
  const envVars = {
    VITE_AZURE_AD_CLIENT_ID: import.meta.env.VITE_AZURE_AD_CLIENT_ID,
    VITE_AZURE_AD_TENANT_ID: import.meta.env.VITE_AZURE_AD_TENANT_ID,
    VITE_AZURE_AD_AUTHORITY: import.meta.env.VITE_AZURE_AD_AUTHORITY,
    VITE_AZURE_AD_SCOPE: import.meta.env.VITE_AZURE_AD_SCOPE,
    VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
    NODE_ENV: import.meta.env.NODE_ENV,
    MODE: import.meta.env.MODE,
    DEV: import.meta.env.DEV,
    PROD: import.meta.env.PROD,
  };

  return (
    <div className="fixed bottom-4 right-4 bg-gray-800 text-white p-4 rounded-lg shadow-lg max-w-md overflow-auto max-h-96 z-50">
      <h3 className="font-bold mb-2">Debug Info</h3>
      <div className="space-y-1 text-xs">
        {Object.entries(envVars).map(([key, value]) => (
          <div key={key} className="flex flex-col">
            <span className="font-semibold text-blue-300">{key}:</span>
            <span className="text-gray-300 break-all">
              {value ? (key.includes('CLIENT_ID') ? `${String(value).substring(0, 8)}...` : String(value)) : 'undefined'}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-3 pt-2 border-t border-gray-600">
        <p className="text-xs text-gray-400">
          Current URL: {window.location.href}
        </p>
        <p className="text-xs text-gray-400">
          Origin: {window.location.origin}
        </p>
      </div>
    </div>
  );
}; 