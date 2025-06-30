import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
// import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useMsal } from '@azure/msal-react';
import { api, usersApi, setupAuthInterceptor } from './services/api';
import { useStore } from './store';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
// import AssetsList from './pages/AssetsList';
// import AssetDetail from './pages/AssetDetail';
// import AssetForm from './pages/AssetForm';
import AuthButtons from './components/AuthButtons';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute
      retry: 1,
    },
  },
});

const AuthenticatedApp: React.FC = () => {
  const { currentUser, setCurrentUser } = useStore();
  const { instance, accounts } = useMsal();
  
  // Acquire token and fetch current user
  useEffect(() => {
    if (accounts.length === 0) return;
    (async () => {
      try {
        const apiScope = `api://${import.meta.env.VITE_AZURE_AD_CLIENT_ID}/access_as_user`;
        const result = await instance.acquireTokenSilent({ scopes: [apiScope], account: accounts[0] });
        api.defaults.headers.common['Authorization'] = `Bearer ${result.accessToken}`;
        const user = await usersApi.getMe();
        setCurrentUser(user);
      } catch (error: any) {
        if (error.response?.status !== 401) {
          console.error('Failed to fetch user info:', error);
        }
      }
    })();
  }, [instance, accounts, setCurrentUser]);
  
  // Wait for currentUser to load before rendering routes
  if (!currentUser) {
    return <div className="flex items-center justify-center h-full">Loading user...</div>;
  }
  
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="assets" element={<div className="p-8">Assets List - Coming Soon</div>} />
        <Route path="assets/new" element={<div className="p-8">Add Asset - Coming Soon</div>} />
        <Route path="assets/:id" element={<div className="p-8">Asset Detail - Coming Soon</div>} />
        <Route path="assets/:id/edit" element={<div className="p-8">Edit Asset - Coming Soon</div>} />
        <Route path="reports" element={<div className="p-8">Reports - Coming Soon</div>} />
        <Route path="settings" element={<div className="p-8">Settings - Coming Soon</div>} />
      </Route>
    </Routes>
  );
};

const App: React.FC = () => {
  const { instance, accounts } = useMsal();
  
  // Setup auth interceptor when instance is available
  useEffect(() => {
    if (instance) {
      setupAuthInterceptor(instance as any);
    }
  }, [instance]);
  
  // If not authenticated, show login page
  if (accounts.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gray-50 p-6 dark:bg-gray-900">
        <h1 className="text-3xl font-bold text-primary-600 dark:text-primary-400">AssetOrbit</h1>
        <p className="text-gray-600 dark:text-gray-400">Please sign in to continue</p>
        <AuthButtons />
      </div>
    );
  }
  
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthenticatedApp />
      </BrowserRouter>
      {/* <ReactQueryDevtools initialIsOpen={false} /> */}
    </QueryClientProvider>
  );
};

export default App; 