import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MsalProvider, useMsal } from '@azure/msal-react';
import { msalInstance, acquireTokenSafely, resetAuthState } from './auth/msal';
import { api, usersApi, setupAuthInterceptor } from './services/api';
import { useStore } from './store';
import Layout from './components/Layout';
import AuthButtons from './components/AuthButtons';
import Dashboard from './pages/Dashboard';
import CustomFields from './pages/CustomFields';
import AddAsset from './pages/AddAsset';
import AssetList from './pages/AssetList';
import EditAsset from './pages/EditAsset';
import BulkUpload from './pages/BulkUpload';
import Technicians from './pages/Technicians';
import Staff from './pages/Staff';
import WorkloadCategories from './pages/WorkloadCategories';
import WorkloadRules from './pages/WorkloadRules';
import Locations from './pages/Locations';
import AdminSettings from './pages/AdminSettings';
import ImportRuns from './pages/ImportRuns';
import MissingBySource from './pages/MissingBySource';
import { PhotoBatchProvider } from './contexts/PhotoBatchContext';

// Create a query client for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

// Authentication wrapper component
const AuthWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { instance, accounts } = useMsal();
  const { currentUser, setCurrentUser } = useStore();
  const [authError, setAuthError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  // Set up authentication and fetch user info
  useEffect(() => {
    // If there is no signed-in account => nothing to do
    if (accounts.length === 0) {
      setCurrentUser(null);
      setAuthError(null);
      return;
    }

    // Already have a current user => no need to refetch
    if (currentUser) {
      return;
    }

    // Prevent multiple simultaneous auth attempts
    if (isLoading) return;

    const setupAuth = async () => {
      setIsLoading(true);
      setAuthError(null);
      
      try {
        // Set up auth interceptor
        setupAuthInterceptor(instance as any);

        // Acquire token and fetch user info
        const clientId = import.meta.env.VITE_AZURE_AD_CLIENT_ID;
        if (!clientId) {
          throw new Error('VITE_AZURE_AD_CLIENT_ID environment variable is required');
        }
        
        const apiScope = `api://${clientId}/access_as_user`;
        const result = await acquireTokenSafely([apiScope]);
        
        // Set auth header
        api.defaults.headers.common['Authorization'] = `Bearer ${result.accessToken}`;
        
        // Fetch user info
        const user = await usersApi.getMe();
        setCurrentUser(user);
      } catch (error: any) {
        console.error('Failed to setup auth or fetch user info:', error);
        
        // Handle different types of authentication errors
        if (error.name === 'InteractionRequiredAuthError') {
          setAuthError('Please sign in again to continue.');
        } else if (error.name === 'BrowserAuthError' && error.errorMessage?.includes('timeout')) {
          setAuthError('Authentication timed out. Please try refreshing the page.');
        } else if (error.response?.status === 401) {
          setAuthError('Your session has expired. Please sign in again.');
        } else {
          setAuthError('Authentication failed. Please try again.');
        }
        
        // Don't automatically redirect - let user choose
        setCurrentUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    setupAuth();
  }, [instance, accounts.length, currentUser]); // Depend on accounts length and currentUser

  // Show auth error state
  if (authError && accounts.length > 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gradient-to-br from-slate-50 via-slate-100/50 to-brand-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-navy-950 p-6">
        <div className="text-center max-w-md">
          <div className="relative mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-orange-600 rounded-2xl shadow-elevation-3 mx-auto" />
            <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent rounded-2xl mx-auto w-16 h-16" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">Authentication Error</h1>
          <p className="text-slate-600 dark:text-slate-400 mb-6">{authError}</p>
          <div className="space-y-3">
            <button
              onClick={async () => {
                try {
                  setAuthError(null);
                  setIsLoading(true);
                  resetAuthState();
                  const clientId = import.meta.env.VITE_AZURE_AD_CLIENT_ID as string;
                  const apiScope = `api://${clientId}/access_as_user`;
                  const result = await acquireTokenSafely([apiScope]);
                  api.defaults.headers.common['Authorization'] = `Bearer ${result.accessToken}`;
                  const user = await usersApi.getMe();
                  setCurrentUser(user);
                } catch (e: any) {
                  // If popup is blocked or more interaction is required, fall back to redirect
                  const clientId = import.meta.env.VITE_AZURE_AD_CLIENT_ID as string;
                  const apiScope = `api://${clientId}/access_as_user`;
                  await (instance as any).loginRedirect({ scopes: [apiScope], prompt: 'select_account' });
                } finally {
                  setIsLoading(false);
                }
              }}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={() => {
                instance.logoutRedirect();
              }}
              className="w-full px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors"
            >
              Sign Out & Sign In Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

// Protected Route component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { accounts } = useMsal();
  const { currentUser } = useStore();
  
  // If not authenticated with MSAL, show login
  if (accounts.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gradient-to-br from-slate-50 via-slate-100/50 to-brand-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-navy-950 p-6">
        <div className="text-center">
          <div className="relative mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-brand-500 to-navy-600 rounded-2xl shadow-elevation-3 mx-auto" />
            <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent rounded-2xl mx-auto w-16 h-16" />
          </div>
          <h1 className="text-4xl font-bold text-gradient-brand mb-2">AssetOrbit</h1>
          <p className="text-slate-600 dark:text-slate-400 mb-8">Enterprise Asset Management</p>
          <AuthButtons />
        </div>
      </div>
    );
  }

  // If authenticated but currentUser not loaded yet, show loading
  if (!currentUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-slate-100/50 to-brand-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-navy-950">
        <div className="text-center">
          <div className="w-8 h-8 bg-gradient-to-r from-brand-500 to-navy-600 rounded-full animate-pulse mx-auto mb-4" />
          <p className="text-slate-600 dark:text-slate-400">Loading your profile...</p>
        </div>
      </div>
    );
  }
  
  return <>{children}</>;
};

// Theme wrapper component
const ThemeWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { theme } = useStore();

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
    }
  }, [theme]);

  return <>{children}</>;
};

// Placeholder components for routes that don't exist yet
const ReportsPage = () => (
  <div className="p-6">
    <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Reports</h1>
    <p className="text-slate-600 dark:text-slate-400 mt-2">Reports and analytics coming soon...</p>
  </div>
);

const SettingsPage = () => (
  <div className="p-6">
    <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Settings</h1>
    <p className="text-slate-600 dark:text-slate-400 mt-2">Application settings coming soon...</p>
  </div>
);

const UsersPage = () => (
  <div className="p-6">
    <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Users</h1>
    <p className="text-slate-600 dark:text-slate-400 mt-2">User management coming soon...</p>
  </div>
);

const DepartmentsPage = () => (
  <div className="p-6">
    <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Departments</h1>
    <p className="text-slate-600 dark:text-slate-400 mt-2">Department management coming soon...</p>
  </div>
);



const VendorsPage = () => (
  <div className="p-6">
    <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Vendors</h1>
    <p className="text-slate-600 dark:text-slate-400 mt-2">Vendor management coming soon...</p>
  </div>
);

const App: React.FC = () => {
  return (
    <MsalProvider instance={msalInstance}>
      <QueryClientProvider client={queryClient}>
        <ThemeWrapper>
          <AuthWrapper>
            <Router>
              <Routes>
                {/* Protected routes with layout */}
                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <PhotoBatchProvider>
                        <Layout />
                      </PhotoBatchProvider>
                    </ProtectedRoute>
                  }
                >
                  {/* Dashboard */}
                  <Route index element={<Dashboard />} />
                  
                  {/* Assets */}
                  <Route path="assets" element={<AssetList />} />
                  <Route path="assets/new" element={<AddAsset />} />
                  <Route path="assets/:id/edit" element={<EditAsset />} />
                  <Route path="assets/bulk" element={<BulkUpload />} />
                  
                  {/* Management */}
                  <Route path="management/technicians" element={<Technicians />} />
                  <Route path="management/staff" element={<Staff />} />
                  <Route path="users" element={<UsersPage />} />
                  <Route path="departments" element={<DepartmentsPage />} />
                  <Route path="workload-categories" element={<WorkloadCategories />} />
                  <Route path="locations" element={<Locations />} />
                  <Route path="vendors" element={<VendorsPage />} />
                  
                  {/* Reports */}
                  <Route path="reports" element={<ReportsPage />} />
                  <Route path="reports/analytics" element={<ReportsPage />} />
                  <Route path="reports/activity" element={<ReportsPage />} />
                  <Route path="reports/import-runs" element={<ImportRuns />} />
                  <Route path="reports/missing" element={<MissingBySource />} />
                  <Route path="reports/custom" element={<ReportsPage />} />
                  
                  {/* Settings */}
                  <Route path="settings" element={<SettingsPage />} />
                  <Route path="settings/custom-fields" element={<CustomFields />} />
                  <Route path="settings/workload-rules" element={<WorkloadRules />} />
                  <Route path="settings/admin" element={<AdminSettings />} />
                  
                  {/* Catch all - redirect to dashboard */}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
              </Routes>
            </Router>
          </AuthWrapper>
        </ThemeWrapper>
      </QueryClientProvider>
    </MsalProvider>
  );
};

export default App; 