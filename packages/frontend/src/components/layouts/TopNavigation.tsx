import React from 'react';
import { motion } from 'framer-motion';
import { useMsal } from '@azure/msal-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as Tooltip from '@radix-ui/react-tooltip';
import * as Switch from '@radix-ui/react-switch';
import { 
  Search, 
  Bell, 
  User, 
  Settings,
  LogOut,
  Sun,
  Moon,
  Menu,
  Zap,
  Activity,
  Wifi,
  WifiOff
} from 'lucide-react';
import { useStore } from '../../store';
import clsx from 'clsx';

interface TopNavigationProps {
  onSignOut: () => void;
  onShowChangelog: () => void;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
}

const TopNavigation: React.FC<TopNavigationProps> = ({
  onSignOut,
  onShowChangelog,
  sidebarCollapsed,
  onToggleSidebar,
}) => {
  const { accounts } = useMsal();
  const { currentUser, theme, toggleTheme } = useStore();
  const [isOnline, setIsOnline] = React.useState(navigator.onLine);

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed top-0 left-0 right-0 z-50 h-16"
    >
      {/* Glass morphism background */}
      <div className="absolute inset-0 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border-b border-white/20 dark:border-slate-700/50" />
      
      <div className="relative flex items-center justify-between h-full px-6">
        {/* Left Section */}
        <div className="flex items-center gap-4">
          {/* Sidebar Toggle */}
          <Tooltip.Provider>
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onToggleSidebar}
                  className="p-2 rounded-xl bg-white/50 dark:bg-slate-800/50 hover:bg-white/80 dark:hover:bg-slate-700/80 transition-all duration-200 shadow-glass-sm"
                >
                  <Menu className="w-5 h-5 text-slate-700 dark:text-slate-300" />
                </motion.button>
              </Tooltip.Trigger>
              <Tooltip.Content side="bottom" className="px-3 py-1 text-sm bg-slate-900 text-white rounded-lg shadow-lg">
                Toggle Sidebar
              </Tooltip.Content>
            </Tooltip.Root>
          </Tooltip.Provider>

          {/* Brand */}
          <motion.div 
            className="flex items-center gap-3"
            whileHover={{ scale: 1.02 }}
          >
            <div className="relative">
              <div className="w-8 h-8 bg-gradient-to-br from-brand-500 to-navy-600 rounded-xl shadow-elevation-2" />
              <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent rounded-xl" />
            </div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold bg-gradient-to-r from-brand-600 to-navy-600 dark:from-brand-400 dark:to-navy-400 bg-clip-text text-transparent">
                AssetOrbit
              </h1>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onShowChangelog}
                className="px-2 py-1 text-xs font-semibold bg-gradient-to-r from-brand-500/20 to-navy-500/20 hover:from-brand-500/30 hover:to-navy-500/30 text-brand-700 dark:text-brand-300 rounded-lg border border-brand-200 dark:border-brand-700 transition-all duration-200"
              >
                v0.5
              </motion.button>
            </div>
          </motion.div>

          {/* Search Bar */}
          <div className="relative ml-8 hidden lg:block">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="w-4 h-4 text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="Search assets, users, locations..."
              className="w-80 pl-10 pr-4 py-2 bg-white/50 dark:bg-slate-800/50 border border-white/20 dark:border-slate-700/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500/50 transition-all duration-200 placeholder-slate-400 text-slate-700 dark:text-slate-200"
            />
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-3">
          {/* Status Indicators */}
          <div className="flex items-center gap-2">
            {/* Online Status */}
            <Tooltip.Provider>
              <Tooltip.Root>
                <Tooltip.Trigger asChild>
                  <div className={clsx(
                    "p-2 rounded-lg transition-colors duration-200",
                    isOnline 
                      ? "bg-success-50 dark:bg-success-900/20" 
                      : "bg-error-50 dark:bg-error-900/20"
                  )}>
                    {isOnline ? (
                      <Wifi className="w-4 h-4 text-success-600 dark:text-success-400" />
                    ) : (
                      <WifiOff className="w-4 h-4 text-error-600 dark:text-error-400" />
                    )}
                  </div>
                </Tooltip.Trigger>
                <Tooltip.Content side="bottom" className="px-3 py-1 text-sm bg-slate-900 text-white rounded-lg shadow-lg">
                  {isOnline ? 'Online' : 'Offline'}
                </Tooltip.Content>
              </Tooltip.Root>
            </Tooltip.Provider>

            {/* System Status */}
            <Tooltip.Provider>
              <Tooltip.Root>
                <Tooltip.Trigger asChild>
                  <div className="p-2 rounded-lg bg-success-50 dark:bg-success-900/20">
                    <Activity className="w-4 h-4 text-success-600 dark:text-success-400" />
                  </div>
                </Tooltip.Trigger>
                <Tooltip.Content side="bottom" className="px-3 py-1 text-sm bg-slate-900 text-white rounded-lg shadow-lg">
                  All systems operational
                </Tooltip.Content>
              </Tooltip.Root>
            </Tooltip.Provider>
          </div>

          {/* Notifications */}
          <Tooltip.Provider>
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="relative p-2 rounded-xl bg-white/50 dark:bg-slate-800/50 hover:bg-white/80 dark:hover:bg-slate-700/80 transition-all duration-200 shadow-glass-sm"
                >
                  <Bell className="w-5 h-5 text-slate-700 dark:text-slate-300" />
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-brand-500 rounded-full" />
                </motion.button>
              </Tooltip.Trigger>
              <Tooltip.Content side="bottom" className="px-3 py-1 text-sm bg-slate-900 text-white rounded-lg shadow-lg">
                Notifications
              </Tooltip.Content>
            </Tooltip.Root>
          </Tooltip.Provider>

          {/* Theme Toggle */}
          <Tooltip.Provider>
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={toggleTheme}
                  className="p-2 rounded-xl bg-white/50 dark:bg-slate-800/50 hover:bg-white/80 dark:hover:bg-slate-700/80 transition-all duration-200 shadow-glass-sm"
                >
                  {theme === 'light' ? (
                    <Moon className="w-5 h-5 text-slate-700 dark:text-slate-300" />
                  ) : (
                    <Sun className="w-5 h-5 text-slate-700 dark:text-slate-300" />
                  )}
                </motion.button>
              </Tooltip.Trigger>
              <Tooltip.Content side="bottom" className="px-3 py-1 text-sm bg-slate-900 text-white rounded-lg shadow-lg">
                Toggle theme
              </Tooltip.Content>
            </Tooltip.Root>
          </Tooltip.Provider>

          {/* User Menu */}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex items-center gap-3 p-2 rounded-xl bg-white/50 dark:bg-slate-800/50 hover:bg-white/80 dark:hover:bg-slate-700/80 transition-all duration-200 shadow-glass-sm"
              >
                <div className="w-8 h-8 bg-gradient-to-br from-brand-500 to-navy-600 rounded-lg flex items-center justify-center">
                  <User className="w-4 h-4 text-white" />
                </div>
                <div className="hidden md:block text-left">
                  <div className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    {currentUser?.displayName || accounts[0]?.name || 'User'}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {currentUser?.role || 'User'}
                  </div>
                </div>
              </motion.button>
            </DropdownMenu.Trigger>

            <DropdownMenu.Portal>
              <DropdownMenu.Content
                side="bottom"
                align="end"
                className="min-w-64 p-1 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/20 dark:border-slate-700/50 rounded-2xl shadow-glass animate-slide-up"
              >
                {/* User Info */}
                <div className="px-3 py-3 border-b border-slate-200/50 dark:border-slate-700/50">
                  <div className="font-medium text-slate-900 dark:text-slate-100">
                    {currentUser?.displayName || accounts[0]?.name || 'User'}
                  </div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    {currentUser?.email || accounts[0]?.username || ''}
                  </div>
                  <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                    Role: {currentUser?.role || 'User'}
                  </div>
                </div>

                {/* Menu Items */}
                <DropdownMenu.Item className="flex items-center gap-3 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100/50 dark:hover:bg-slate-800/50 rounded-lg m-1 cursor-pointer">
                  <Settings className="w-4 h-4" />
                  Settings
                </DropdownMenu.Item>

                <DropdownMenu.Separator className="h-px bg-slate-200 dark:bg-slate-700 my-1" />

                <DropdownMenu.Item 
                  onClick={onSignOut}
                  className="flex items-center gap-3 px-3 py-2 text-sm text-error-600 dark:text-error-400 hover:bg-error-50 dark:hover:bg-error-900/20 rounded-lg m-1 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  Sign out
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </div>
    </motion.header>
  );
};

export default TopNavigation; 