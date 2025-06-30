import React from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { 
  Server, 
  Users, 
  Package, 
  TrendingUp,
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Plus,
  Download,
  Search,
  Filter,
  BarChart3,
  PieChart,
  Laptop,
  Smartphone,
  Monitor,
  TestTube,
  Settings
} from 'lucide-react';
import * as Switch from '@radix-ui/react-switch';
import { useStore } from '../store';
import { assetsApi, usersApi } from '../services/api';

interface StatCard {
  title: string;
  value: string;
  change: string;
  changeType: 'positive' | 'negative' | 'neutral';
  icon: React.ComponentType<{ className?: string }>;
  trend?: number[];
}

interface RecentActivity {
  id: string;
  user: string;
  action: string;
  asset: string;
  timestamp: string;
  type: 'added' | 'updated' | 'assigned' | 'returned';
}

const Dashboard: React.FC = () => {
  const { currentUser } = useStore();
  const [useMockData, setUseMockData] = React.useState(false);

  // Fetch real data
  const { data: assetsData, isLoading: assetsLoading } = useQuery({
    queryKey: ['dashboard-assets'],
    queryFn: () => assetsApi.getAll({ limit: 1 }),
    enabled: !useMockData
  });

  const { data: availableAssetsData } = useQuery({
    queryKey: ['dashboard-available'],
    queryFn: () => assetsApi.getAll({ status: 'AVAILABLE', limit: 1 }),
    enabled: !useMockData
  });

  const { data: assignedAssetsData } = useQuery({
    queryKey: ['dashboard-assigned'],
    queryFn: () => assetsApi.getAll({ status: 'ASSIGNED', limit: 1 }),
    enabled: !useMockData
  });

  const { data: maintenanceAssetsData } = useQuery({
    queryKey: ['dashboard-maintenance'],
    queryFn: () => assetsApi.getAll({ status: 'MAINTENANCE', limit: 1 }),
    enabled: !useMockData
  });

  const { data: recentAssetsData } = useQuery({
    queryKey: ['dashboard-recent'],
    queryFn: () => assetsApi.getAll({ limit: 5, sortBy: 'createdAt', sortOrder: 'desc' }),
    enabled: !useMockData
  });

  // Mock data (only used when toggle is enabled)
  const mockStats: StatCard[] = [
    {
      title: 'Total Assets',
      value: '1,247',
      change: '+12.5%',
      changeType: 'positive',
      icon: Server,
      trend: [65, 78, 82, 95, 88, 92, 105, 98, 110, 115]
    },
    {
      title: 'Available',
      value: '186',
      change: '-3.2%',
      changeType: 'negative',
      icon: CheckCircle,
      trend: [45, 52, 48, 55, 58, 52, 48, 42, 38, 35]
    },
    {
      title: 'Assigned',
      value: '924',
      change: '+8.1%',
      changeType: 'positive',
      icon: Users,
      trend: [120, 135, 142, 158, 165, 178, 185, 192, 198, 205]
    },
    {
      title: 'Maintenance',
      value: '37',
      change: '+2.4%',
      changeType: 'neutral',
      icon: AlertTriangle,
      trend: [25, 28, 30, 32, 35, 33, 36, 34, 37, 38]
    }
  ];

  const mockRecentActivity: RecentActivity[] = [
    {
      id: '1',
      user: 'Sarah Chen',
      action: 'assigned laptop',
      asset: 'MB-2024-0156',
      timestamp: '2 minutes ago',
      type: 'assigned'
    },
    {
      id: '2',
      user: 'Mike Johnson',
      action: 'added new asset',
      asset: 'DT-2024-0089',
      timestamp: '5 minutes ago',
      type: 'added'
    },
    {
      id: '3',
      user: 'Emma Davis',
      action: 'returned laptop',
      asset: 'MB-2023-0234',
      timestamp: '12 minutes ago',
      type: 'returned'
    }
  ];

  const mockAssetBreakdown = [
    { name: 'Laptops', count: 856, percentage: 68.7, icon: Laptop, color: 'from-brand-500 to-brand-600' },
    { name: 'Desktops', count: 234, percentage: 18.8, icon: Monitor, color: 'from-navy-500 to-navy-600' },
    { name: 'Tablets', count: 89, percentage: 7.1, icon: Smartphone, color: 'from-slate-500 to-slate-600' },
    { name: 'Other', count: 68, percentage: 5.4, icon: Package, color: 'from-slate-400 to-slate-500' }
  ];

  // Real data processing
  const realStats: StatCard[] = [
    {
      title: 'Total Assets',
      value: assetsData?.pagination.total?.toString() || '0',
      change: '0%',
      changeType: 'neutral',
      icon: Server
    },
    {
      title: 'Available',
      value: availableAssetsData?.pagination.total?.toString() || '0',
      change: '0%',
      changeType: 'neutral',
      icon: CheckCircle
    },
    {
      title: 'Assigned',
      value: assignedAssetsData?.pagination.total?.toString() || '0',
      change: '0%',
      changeType: 'neutral',
      icon: Users
    },
    {
      title: 'Maintenance',
      value: maintenanceAssetsData?.pagination.total?.toString() || '0',
      change: '0%',
      changeType: 'neutral',
      icon: AlertTriangle
    }
  ];

  const realRecentActivity: RecentActivity[] = recentAssetsData?.data.map((asset, index) => ({
    id: asset.id,
    user: asset.assignedTo?.displayName || 'System',
    action: 'added asset',
    asset: asset.assetTag,
    timestamp: new Date(asset.createdAt).toLocaleDateString(),
    type: 'added' as const
  })) || [];

  // Calculate real asset breakdown
  const totalAssets = assetsData?.pagination.total || 0;
  const realAssetBreakdown = [
    { 
      name: 'Laptops', 
      count: 0, 
      percentage: 0, 
      icon: Laptop, 
      color: 'from-brand-500 to-brand-600' 
    },
    { 
      name: 'Desktops', 
      count: 0, 
      percentage: 0, 
      icon: Monitor, 
      color: 'from-navy-500 to-navy-600' 
    },
    { 
      name: 'Tablets', 
      count: 0, 
      percentage: 0, 
      icon: Smartphone, 
      color: 'from-slate-500 to-slate-600' 
    },
    { 
      name: 'Other', 
      count: 0, 
      percentage: 0, 
      icon: Package, 
      color: 'from-slate-400 to-slate-500' 
    }
  ];

  // Use appropriate data based on toggle
  const stats = useMockData ? mockStats : realStats;
  const recentActivity = useMockData ? mockRecentActivity : realRecentActivity;
  const assetBreakdown = useMockData ? mockAssetBreakdown : realAssetBreakdown;

  const getActivityIcon = (type: RecentActivity['type']) => {
    switch (type) {
      case 'added': return <Plus className="w-4 h-4 text-success-600" />;
      case 'assigned': return <Users className="w-4 h-4 text-brand-600" />;
      case 'returned': return <CheckCircle className="w-4 h-4 text-slate-600" />;
      case 'updated': return <Activity className="w-4 h-4 text-warning-600" />;
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  if (assetsLoading && !useMockData) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-8 h-8 bg-gradient-to-r from-brand-500 to-navy-600 rounded-full animate-pulse mx-auto mb-4" />
          <p className="text-slate-600 dark:text-slate-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6 max-w-full"
    >
      {/* Header with Mock Data Toggle */}
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gradient-brand">
            Good morning, {currentUser?.displayName?.split(' ')[0] || 'there'}! 👋
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Here's what's happening with your assets today.
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Mock Data Toggle */}
          <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-white/50 dark:bg-slate-800/50 border border-white/20 dark:border-slate-700/50">
            <TestTube className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            <span className="text-sm text-slate-600 dark:text-slate-400">Mock Data</span>
            <Switch.Root
              checked={useMockData}
              onCheckedChange={setUseMockData}
              className="w-11 h-6 bg-slate-200 dark:bg-slate-700 rounded-full relative data-[state=checked]:bg-brand-500 transition-colors"
            >
              <Switch.Thumb className="block w-5 h-5 bg-white rounded-full transition-transform translate-x-0.5 data-[state=checked]:translate-x-[22px]" />
            </Switch.Root>
          </div>
          
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="btn-secondary flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export Report
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Asset
          </motion.button>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <motion.div 
        variants={itemVariants}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
      >
        {stats.map((stat, index) => (
          <motion.div
            key={stat.title}
            whileHover={{ scale: 1.02, y: -4 }}
            className="card p-6 group cursor-pointer"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-xl bg-gradient-to-r ${
                index === 0 ? 'from-brand-500/20 to-navy-500/20' :
                index === 1 ? 'from-success-500/20 to-success-600/20' :
                index === 2 ? 'from-brand-500/20 to-brand-600/20' :
                'from-warning-500/20 to-warning-600/20'
              }`}>
                <stat.icon className={`w-6 h-6 ${
                  index === 0 ? 'text-brand-600 dark:text-brand-400' :
                  index === 1 ? 'text-success-600 dark:text-success-400' :
                  index === 2 ? 'text-brand-600 dark:text-brand-400' :
                  'text-warning-600 dark:text-warning-400'
                }`} />
              </div>
              <div className={`text-sm font-medium px-2 py-1 rounded-lg ${
                stat.changeType === 'positive' ? 'text-success-700 bg-success-50 dark:text-success-400 dark:bg-success-900/20' :
                stat.changeType === 'negative' ? 'text-error-700 bg-error-50 dark:text-error-400 dark:bg-error-900/20' :
                'text-slate-700 bg-slate-50 dark:text-slate-400 dark:bg-slate-800/50'
              }`}>
                {stat.change}
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1">
                {stat.value}
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-400">
                {stat.title}
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Asset Breakdown */}
        <motion.div variants={itemVariants} className="lg:col-span-2">
          <div className="card p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                Asset Breakdown
              </h2>
              <div className="flex items-center gap-2">
                <button className="btn-ghost p-2">
                  <PieChart className="w-4 h-4" />
                </button>
                <button className="btn-ghost p-2">
                  <BarChart3 className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="space-y-4">
              {assetBreakdown.length > 0 ? assetBreakdown.map((item, index) => (
                <motion.div
                  key={item.name}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-center justify-between p-4 rounded-xl bg-slate-50/50 dark:bg-slate-800/30 hover:bg-slate-100/50 dark:hover:bg-slate-700/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-gradient-to-r ${item.color}`}>
                      <item.icon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="font-medium text-slate-900 dark:text-slate-100">
                        {item.name}
                      </div>
                      <div className="text-sm text-slate-600 dark:text-slate-400">
                        {item.count} assets
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-slate-900 dark:text-slate-100">
                      {item.percentage}%
                    </div>
                    <div className="w-24 h-2 bg-slate-200 dark:bg-slate-700 rounded-full mt-1 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${item.percentage}%` }}
                        transition={{ delay: index * 0.1 + 0.3, duration: 0.6 }}
                        className={`h-full bg-gradient-to-r ${item.color} rounded-full`}
                      />
                    </div>
                  </div>
                </motion.div>
              )) : (
                <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                  <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No assets found</p>
                  <p className="text-sm">Add some assets to see the breakdown</p>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Recent Activity */}
        <motion.div variants={itemVariants}>
          <div className="card p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                Recent Activity
              </h2>
              <button className="btn-ghost text-sm">View all</button>
            </div>
            <div className="space-y-4">
              {recentActivity.length > 0 ? recentActivity.map((activity, index) => (
                <motion.div
                  key={activity.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                >
                  <div className="mt-0.5">
                    {getActivityIcon(activity.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-900 dark:text-slate-100">
                      <span className="font-medium">{activity.user}</span>
                      {' '}{activity.action}{' '}
                      <span className="font-mono text-brand-600 dark:text-brand-400">
                        {activity.asset}
                      </span>
                    </p>
                    <div className="flex items-center gap-1 mt-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {activity.timestamp}
                      </span>
                    </div>
                  </div>
                </motion.div>
              )) : (
                <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                  <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No recent activity</p>
                  <p className="text-sm">Activity will appear here as you manage assets</p>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Quick Actions */}
      <motion.div variants={itemVariants}>
        <div className="card p-6">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-4">
            Quick Actions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <motion.button
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-brand-500/10 to-navy-500/10 hover:from-brand-500/20 hover:to-navy-500/20 border border-brand-200/50 dark:border-brand-700/50 transition-all"
            >
              <Search className="w-5 h-5 text-brand-600 dark:text-brand-400" />
              <div className="text-left">
                <div className="font-medium text-slate-900 dark:text-slate-100">
                  Search Assets
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  Find specific equipment
                </div>
              </div>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-success-500/10 to-success-600/10 hover:from-success-500/20 hover:to-success-600/20 border border-success-200/50 dark:border-success-700/50 transition-all"
            >
              <Plus className="w-5 h-5 text-success-600 dark:text-success-400" />
              <div className="text-left">
                <div className="font-medium text-slate-900 dark:text-slate-100">
                  Bulk Import
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  Upload CSV or Excel
                </div>
              </div>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-warning-500/10 to-warning-600/10 hover:from-warning-500/20 hover:to-warning-600/20 border border-warning-200/50 dark:border-warning-700/50 transition-all"
            >
              <BarChart3 className="w-5 h-5 text-warning-600 dark:text-warning-400" />
              <div className="text-left">
                <div className="font-medium text-slate-900 dark:text-slate-100">
                  Generate Report
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  Custom analytics
                </div>
              </div>
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default Dashboard; 