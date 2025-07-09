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
  WifiOff,
  Shield,
  Crown,
  Eye
} from 'lucide-react';
import { useStore } from '../../store';
import ProfilePicture from '../ProfilePicture';
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
      
      <div className="relative flex items-center justify-between h-full px-3">
        {/* Left Section */}
        <div className="flex items-center gap-4">
          {/* Logo & Controls Container */}
          <div className="flex items-center gap-3 pl-2 pr-4 py-2 bg-white/30 dark:bg-slate-800/30 backdrop-blur-sm rounded-2xl border border-white/20 dark:border-slate-700/30">
            {/* AssetOrbit Logo */}
            <motion.div 
              className="flex items-center"
              whileHover={{ scale: 1.02 }}
            >
              <img 
                src="/logo.png" 
                alt="AssetOrbit" 
                className="h-20 w-auto object-contain hover:scale-105 transition-transform duration-200 drop-shadow-lg cursor-pointer" 
                onClick={() => window.location.href = '/'}
              />
            </motion.div>

            {/* Divider */}
            <div className="w-px h-8 bg-slate-200/50 dark:bg-slate-700/50" />

            {/* Sidebar Toggle */}
            <Tooltip.Provider>
              <Tooltip.Root>
                <Tooltip.Trigger asChild>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={onToggleSidebar}
                    className="p-2 rounded-lg bg-white/50 dark:bg-slate-800/50 hover:bg-white/80 dark:hover:bg-slate-700/80 transition-all duration-200 shadow-glass-sm"
                  >
                    <Menu className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                  </motion.button>
                </Tooltip.Trigger>
                <Tooltip.Content side="bottom" className="px-3 py-1 text-sm bg-slate-900 text-white rounded-lg shadow-lg">
                  Toggle Sidebar
                </Tooltip.Content>
              </Tooltip.Root>
            </Tooltip.Provider>

            {/* Version Badge */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onShowChangelog}
              className="px-2 py-1 text-xs font-semibold bg-gradient-to-r from-brand-500/20 to-brand-600/20 hover:from-brand-500/30 hover:to-brand-600/30 text-brand-700 dark:text-brand-300 rounded-lg border border-brand-200 dark:border-brand-700 transition-all duration-200"
            >
              v0.91
            </motion.button>
          </div>

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
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all duration-200 border border-slate-200 dark:border-slate-700"
              >
                <ProfilePicture
                  azureAdId={currentUser?.azureAdId}
                  displayName={currentUser?.displayName || accounts[0]?.name || 'User'}
                  size="xs"
                  className="ring-1 ring-slate-300 dark:ring-slate-600"
                />
                <div className="hidden md:flex items-center gap-2 text-left">
                  <div className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate max-w-40">
                    {currentUser?.displayName || accounts[0]?.name || 'User'}
                  </div>
                  <div className="flex items-center">
                    {currentUser?.role === 'ADMIN' && (
                      <div className="flex items-center gap-1 px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded text-xs font-medium">
                        <Crown className="w-3 h-3" />
                        <span>Admin</span>
                      </div>
                    )}
                    {currentUser?.role === 'WRITE' && (
                      <div className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs font-medium">
                        <Shield className="w-3 h-3" />
                        <span>Editor</span>
                      </div>
                    )}
                    {currentUser?.role === 'READ' && (
                      <div className="flex items-center gap-1 px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 rounded text-xs font-medium">
                        <Eye className="w-3 h-3" />
                        <span>Viewer</span>
                      </div>
                    )}
                    {!currentUser?.role && (
                      <div className="flex items-center gap-1 px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 rounded text-xs font-medium">
                        <User className="w-3 h-3" />
                        <span>User</span>
                      </div>
                    )}
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
                  <div className="flex items-center gap-3 mb-2">
                    <ProfilePicture
                      azureAdId={currentUser?.azureAdId}
                      displayName={currentUser?.displayName || accounts[0]?.name || 'User'}
                      size="lg"
                      className="ring-2 ring-brand-200 dark:ring-brand-700"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-slate-900 dark:text-slate-100">
                        {currentUser?.displayName || accounts[0]?.name || 'User'}
                      </div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">
                        {currentUser?.email || accounts[0]?.username || ''}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 px-2 py-1 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                    {currentUser?.role === 'ADMIN' && (
                      <Crown className="w-4 h-4 text-amber-500" />
                    )}
                    {currentUser?.role === 'WRITE' && (
                      <Shield className="w-4 h-4 text-blue-500" />
                    )}
                    {currentUser?.role === 'read' && (
                      <Eye className="w-4 h-4 text-slate-500" />
                    )}
                    <span className={clsx(
                      "text-sm font-medium",
                      currentUser?.role === 'ADMIN' && "text-amber-600 dark:text-amber-400",
                      currentUser?.role === 'WRITE' && "text-blue-600 dark:text-blue-400",
                      currentUser?.role === 'read' && "text-slate-500 dark:text-slate-400",
                      !currentUser?.role && "text-slate-500 dark:text-slate-400"
                    )}>
                      {currentUser?.role === 'ADMIN' ? 'Administrator' : 
                       currentUser?.role === 'WRITE' ? 'Editor' : 
                       currentUser?.role === 'read' ? 'Viewer' : 'User'}
                    </span>
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