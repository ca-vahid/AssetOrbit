import React from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
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
  Tablet,
  Upload,
  FileText,
  Settings,
  Eye,
  ArrowRight,
  Calendar,
  MapPin,
  Building
} from 'lucide-react';
import { useStore } from '../store';
import { assetsApi, activitiesApi, usersApi, departmentsApi, locationsApi } from '../services/api';

interface StatCard {
  title: string;
  value: string;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  onClick?: () => void;
}

const Dashboard: React.FC = () => {
  const { currentUser } = useStore();
  const navigate = useNavigate();

  // Fetch real data
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => assetsApi.getStats(),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: recentAssetsData, isLoading: recentLoading } = useQuery({
    queryKey: ['dashboard-recent-assets'],
    queryFn: () => assetsApi.getAll({ limit: 10, sortBy: 'createdAt', sortOrder: 'desc' }),
  });

  const { data: departmentsData } = useQuery({
    queryKey: ['dashboard-departments'],
    queryFn: () => departmentsApi.getAll(),
  });

  const { data: locationsData } = useQuery({
    queryKey: ['dashboard-locations'],
    queryFn: () => locationsApi.getLocations(),
  });

  // Process stats data
  const stats: StatCard[] = [
    {
      title: 'Total Assets',
      value: statsData?.total?.toString() || '0',
      icon: Server,
      color: 'from-brand-500 to-brand-600',
      onClick: () => navigate('/assets')
    },
    {
      title: 'Assigned',
      value: statsData?.statuses?.ASSIGNED?.toString() || '0',
      icon: Users,
      color: 'from-blue-500 to-blue-600',
      onClick: () => navigate('/assets?status=ASSIGNED')
    },
    {
      title: 'Available',
      value: statsData?.statuses?.AVAILABLE?.toString() || '0',
      icon: CheckCircle,
      color: 'from-success-500 to-success-600',
      onClick: () => navigate('/assets?status=AVAILABLE')
    },
    {
      title: 'Maintenance',
      value: statsData?.statuses?.MAINTENANCE?.toString() || '0',
      icon: AlertTriangle,
      color: 'from-warning-500 to-warning-600',
      onClick: () => navigate('/assets?status=MAINTENANCE')
    }
  ];

  // Process asset breakdown
  const assetBreakdown = [
    {
      name: 'Laptops',
      count: statsData?.assetTypes?.LAPTOP || 0,
      percentage: statsData?.total ? ((statsData?.assetTypes?.LAPTOP || 0) / statsData.total * 100) : 0,
      icon: Laptop,
      color: 'from-brand-500 to-brand-600'
    },
    {
      name: 'Desktops',
      count: statsData?.assetTypes?.DESKTOP || 0,
      percentage: statsData?.total ? ((statsData?.assetTypes?.DESKTOP || 0) / statsData.total * 100) : 0,
      icon: Monitor,
      color: 'from-navy-500 to-navy-600'
    },
    {
      name: 'Tablets',
      count: statsData?.assetTypes?.TABLET || 0,
      percentage: statsData?.total ? ((statsData?.assetTypes?.TABLET || 0) / statsData.total * 100) : 0,
      icon: Tablet,
      color: 'from-purple-500 to-purple-600'
    },
    {
      name: 'Phones',
      count: statsData?.assetTypes?.PHONE || 0,
      percentage: statsData?.total ? ((statsData?.assetTypes?.PHONE || 0) / statsData.total * 100) : 0,
      icon: Smartphone,
      color: 'from-green-500 to-green-600'
    },
    {
      name: 'Other',
      count: statsData?.assetTypes?.OTHER || 0,
      percentage: statsData?.total ? ((statsData?.assetTypes?.OTHER || 0) / statsData.total * 100) : 0,
      icon: Package,
      color: 'from-slate-500 to-slate-600'
    }
  ].filter(item => item.count > 0); // Only show types that have assets

  // Process recent activity
  const recentActivity = recentAssetsData?.data?.slice(0, 5)?.map(asset => ({
    id: asset.id,
    user: asset.assignedTo?.displayName || 'System',
    action: asset.assignedTo ? 'assigned' : 'added',
    asset: asset.assetTag,
    assetType: asset.assetType,
    timestamp: new Date(asset.createdAt).toLocaleDateString(),
    createdAt: asset.createdAt
  })) || [];

  const getActivityIcon = (action: string) => {
    switch (action) {
      case 'assigned': return <Users className="w-4 h-4 text-brand-600" />;
      case 'added': return <Plus className="w-4 h-4 text-success-600" />;
      case 'updated': return <Activity className="w-4 h-4 text-warning-600" />;
      default: return <Activity className="w-4 h-4 text-slate-600" />;
    }
  };

  const getAssetTypeIcon = (type: string) => {
    switch (type?.toUpperCase()) {
      case 'LAPTOP': return <Laptop className="w-4 h-4" />;
      case 'DESKTOP': return <Monitor className="w-4 h-4" />;
      case 'TABLET': return <Tablet className="w-4 h-4" />;
      case 'PHONE': return <Smartphone className="w-4 h-4" />;
      default: return <Package className="w-4 h-4" />;
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

  if (statsLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-12 h-12 bg-gradient-to-r from-brand-500 to-navy-600 rounded-full animate-spin mx-auto mb-4 flex items-center justify-center">
            <div className="w-6 h-6 bg-white rounded-full"></div>
          </div>
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
      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gradient-brand">
            Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, {currentUser?.displayName?.split(' ')[0] || 'there'}! 👋
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Here's your asset management overview for {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/assets/export')}
            className="btn-secondary flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export Report
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/assets/add')}
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
            onClick={stat.onClick}
            className="card p-6 group cursor-pointer"
          >
            <div className="flex items-center justify-between mb-4">
                             <div className={`p-3 rounded-xl bg-gradient-to-r ${stat.color}`}>
                 <stat.icon className="w-6 h-6 text-white" />
              </div>
              <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors" />
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
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/assets')}
                className="btn-ghost flex items-center gap-2 text-sm"
              >
                View All <ArrowRight className="w-4 h-4" />
              </motion.button>
            </div>
            <div className="space-y-4">
              {assetBreakdown.length > 0 ? assetBreakdown.map((item, index) => (
                <motion.div
                  key={item.name}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ scale: 1.02 }}
                  onClick={() => navigate(`/assets?type=${item.name.toUpperCase()}`)}
                  className="flex items-center justify-between p-4 rounded-xl bg-slate-50/50 dark:bg-slate-800/30 hover:bg-slate-100/50 dark:hover:bg-slate-700/30 transition-colors cursor-pointer"
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
                      {item.percentage.toFixed(1)}%
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
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/assets')}
                className="btn-ghost text-sm"
              >
                View All
              </motion.button>
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
                    {getActivityIcon(activity.action)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {getAssetTypeIcon(activity.assetType)}
                      <span className="font-mono text-sm text-brand-600 dark:text-brand-400">
                        {activity.asset}
                      </span>
                    </div>
                    <p className="text-sm text-slate-900 dark:text-slate-100">
                      {activity.action === 'assigned' ? (
                        <>Assigned to <span className="font-medium">{activity.user}</span></>
                      ) : (
                        <>Added by <span className="font-medium">{activity.user}</span></>
                      )}
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
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-6">
            Quick Actions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <motion.button
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/assets')}
              className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-brand-500/10 to-navy-500/10 hover:from-brand-500/20 hover:to-navy-500/20 border border-brand-200/50 dark:border-brand-700/50 transition-all text-left"
            >
              <Search className="w-5 h-5 text-brand-600 dark:text-brand-400" />
              <div>
                <div className="font-medium text-slate-900 dark:text-slate-100">
                  Search Assets
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  Find equipment
                </div>
              </div>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/bulk-upload')}
              className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-success-500/10 to-success-600/10 hover:from-success-500/20 hover:to-success-600/20 border border-success-200/50 dark:border-success-700/50 transition-all text-left"
            >
              <Upload className="w-5 h-5 text-success-600 dark:text-success-400" />
              <div>
                <div className="font-medium text-slate-900 dark:text-slate-100">
                  Bulk Import
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  Upload CSV/Excel
                </div>
              </div>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/staff')}
              className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-purple-500/10 to-purple-600/10 hover:from-purple-500/20 hover:to-purple-600/20 border border-purple-200/50 dark:border-purple-700/50 transition-all text-left"
            >
              <Users className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              <div>
                <div className="font-medium text-slate-900 dark:text-slate-100">
                  Manage Staff
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  View assignments
                </div>
              </div>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/locations')}
              className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-orange-500/10 to-orange-600/10 hover:from-orange-500/20 hover:to-orange-600/20 border border-orange-200/50 dark:border-orange-700/50 transition-all text-left"
            >
              <MapPin className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              <div>
                <div className="font-medium text-slate-900 dark:text-slate-100">
                  Locations
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  Manage locations
                </div>
              </div>
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* System Info */}
      <motion.div variants={itemVariants}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="card p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-gradient-to-r from-blue-500/20 to-blue-600/20">
                <Building className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                Departments
              </h3>
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1">
              {departmentsData?.length || 0}
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-400">
              Active departments
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-gradient-to-r from-green-500/20 to-green-600/20">
                <MapPin className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                Locations
              </h3>
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1">
              {locationsData?.length || 0}
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-400">
              Tracked locations
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-gradient-to-r from-purple-500/20 to-purple-600/20">
                <Eye className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                Your Role
              </h3>
            </div>
            <div className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1">
              {currentUser?.role === 'ADMIN' ? 'Administrator' : 
               currentUser?.role === 'WRITE' ? 'Editor' : 
               currentUser?.role === 'read' ? 'Viewer' : 'User'}
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-400">
              Access level
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default Dashboard; 