import React from 'react';
import { motion } from 'framer-motion';
import * as Tooltip from '@radix-ui/react-tooltip';
import { 
  Wifi,
  WifiOff,
  Database,
  Server,
  Clock,
  Users,
  HardDrive,
  Activity,
  AlertCircle,
  CheckCircle,
  Zap
} from 'lucide-react';
import { useStore } from '../../store';
import clsx from 'clsx';

interface StatusIndicator {
  label: string;
  status: 'online' | 'offline' | 'warning' | 'error';
  icon: React.ComponentType<{ className?: string }>;
  value?: string;
  tooltip?: string;
}

const StatusBar: React.FC = () => {
  const { currentUser } = useStore();
  const [currentTime, setCurrentTime] = React.useState(new Date());
  const [isOnline, setIsOnline] = React.useState(navigator.onLine);

  React.useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(timer);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const statusIndicators: StatusIndicator[] = [
    {
      label: 'Network',
      status: isOnline ? 'online' : 'error',
      icon: isOnline ? Wifi : WifiOff,
      tooltip: isOnline ? 'Connected to network' : 'No network connection'
    },
    {
      label: 'Database',
      status: 'online',
      icon: Database,
      value: '< 50ms',
      tooltip: 'Database connection healthy'
    },
    {
      label: 'API',
      status: 'online',
      icon: Server,
      value: '99.9%',
      tooltip: 'API services operational'
    },
    {
      label: 'Active Users',
      status: 'online',
      icon: Users,
      value: '12',
      tooltip: '12 users currently online'
    },
    {
      label: 'Storage',
      status: 'warning',
      icon: HardDrive,
      value: '78%',
      tooltip: 'Storage usage at 78%'
    },
  ];

  const getStatusColor = (status: StatusIndicator['status']) => {
    switch (status) {
      case 'online':
        return 'text-success-600 dark:text-success-400';
      case 'warning':
        return 'text-warning-600 dark:text-warning-400';
      case 'error':
        return 'text-error-600 dark:text-error-400';
      default:
        return 'text-slate-500 dark:text-slate-400';
    }
  };

  const getStatusBg = (status: StatusIndicator['status']) => {
    switch (status) {
      case 'online':
        return 'bg-success-50 dark:bg-success-900/20';
      case 'warning':
        return 'bg-warning-50 dark:bg-warning-900/20';
      case 'error':
        return 'bg-error-50 dark:bg-error-900/20';
      default:
        return 'bg-slate-50 dark:bg-slate-800/50';
    }
  };

  return (
    <motion.footer
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed bottom-0 left-0 right-0 z-30 h-8"
    >
      {/* Glass morphism background */}
      <div className="absolute inset-0 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border-t border-white/20 dark:border-slate-700/50" />
      
      <div className="relative flex items-center justify-between h-full px-6 text-xs">
        {/* Left Section - Status Indicators */}
        <div className="flex items-center gap-4">
          {statusIndicators.map((indicator, index) => (
            <Tooltip.Provider key={indicator.label}>
              <Tooltip.Root>
                <Tooltip.Trigger asChild>
                  <div className={clsx(
                    "flex items-center gap-1.5 px-2 py-1 rounded-md transition-all duration-200",
                    getStatusBg(indicator.status)
                  )}>
                    <indicator.icon className={clsx("w-3 h-3", getStatusColor(indicator.status))} />
                    <span className={clsx("font-medium", getStatusColor(indicator.status))}>
                      {indicator.label}
                    </span>
                    {indicator.value && (
                      <span className="text-slate-600 dark:text-slate-400">
                        {indicator.value}
                      </span>
                    )}
                  </div>
                </Tooltip.Trigger>
                <Tooltip.Content side="top" className="px-3 py-1 text-sm bg-slate-900 text-white rounded-lg shadow-lg mb-2">
                  {indicator.tooltip || indicator.label}
                </Tooltip.Content>
              </Tooltip.Root>
            </Tooltip.Provider>
          ))}
        </div>

        {/* Center Section - System Status */}
        <div className="flex items-center gap-3">
          <Tooltip.Provider>
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-success-50 dark:bg-success-900/20">
                  <CheckCircle className="w-3 h-3 text-success-600 dark:text-success-400" />
                  <span className="font-medium text-success-600 dark:text-success-400">
                    All Systems Operational
                  </span>
                </div>
              </Tooltip.Trigger>
              <Tooltip.Content side="top" className="px-3 py-1 text-sm bg-slate-900 text-white rounded-lg shadow-lg mb-2">
                All services are running normally
              </Tooltip.Content>
            </Tooltip.Root>
          </Tooltip.Provider>

          <div className="w-px h-4 bg-slate-300 dark:bg-slate-600" />

          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
            <Activity className="w-3 h-3" />
            <span>Last sync: {currentTime.toLocaleTimeString()}</span>
          </div>
        </div>

        {/* Right Section - User & Time */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
            <Clock className="w-3 h-3" />
            <span className="font-mono">
              {currentTime.toLocaleTimeString()}
            </span>
          </div>

          <div className="w-px h-4 bg-slate-300 dark:bg-slate-600" />

          <div className="text-slate-600 dark:text-slate-400">
            Logged in as <span className="font-medium text-slate-700 dark:text-slate-300">
              {currentUser?.displayName || 'User'}
            </span>
          </div>

          <Tooltip.Provider>
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-brand-50 dark:bg-brand-900/20">
                  <Zap className="w-3 h-3 text-brand-600 dark:text-brand-400" />
                  <span className="font-medium text-brand-600 dark:text-brand-400">
                    Enterprise
                  </span>
                </div>
              </Tooltip.Trigger>
              <Tooltip.Content side="top" className="px-3 py-1 text-sm bg-slate-900 text-white rounded-lg shadow-lg mb-2">
                AssetOrbit Enterprise Edition
              </Tooltip.Content>
            </Tooltip.Root>
          </Tooltip.Provider>
        </div>
      </div>
    </motion.footer>
  );
};

export default StatusBar; 