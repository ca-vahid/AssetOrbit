import React from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  PieChart as RePieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Bar,
  Legend,
  LineChart,
  Line,
} from 'recharts';
import { 
  Server, 
  Users, 
  Package, 
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Plus,
  Download,
  Search,
  Laptop,
  Smartphone,
  Monitor,
  Tablet,
  Upload,
  Eye,
  ArrowRight,
  MapPin,
  Building
} from 'lucide-react';
import { useStore } from '../store';
import { assetsApi, departmentsApi, locationsApi } from '../services/api';
import type { Asset } from '../services/api';

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

  const { data: recentAssetsData } = useQuery({
    queryKey: ['dashboard-recent-assets'],
    queryFn: () => assetsApi.getAll({ limit: 10, sortBy: 'createdAt', sortOrder: 'desc' }),
  });

  // Lightweight analytics sample for charts and insights
  const { data: analyticsSample } = useQuery({
    queryKey: ['dashboard-analytics-sample'],
    queryFn: () => assetsApi.getAll({ limit: 500, sortBy: 'createdAt', sortOrder: 'desc' }),
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

  // Derived analytics from sample
  const sampleAssets: Asset[] = analyticsSample?.data ?? [];

  const conditionCounts = sampleAssets.reduce<Record<string, number>>((acc, a) => {
    const key = (a.condition || 'Unknown').toUpperCase();
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const conditionData = Object.entries(conditionCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  const statusData = Object.entries(statsData?.statuses || {})
    .map(([k, v]) => ({ status: k, count: v as number }));

  const typePieData = Object.entries(statsData?.assetTypes || {})
    .map(([k, v]) => ({ name: k, value: v as number }))
    .filter(d => d.value > 0);

  const topModels = (() => {
    const counts = new Map<string, number>();
    for (const a of sampleAssets) {
      const key = `${a.make || 'Unknown'} ${a.model || ''}`.trim();
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 7);
  })();

  const upcomingWarranties = sampleAssets
    .filter(a => a.warrantyEndDate)
    .map(a => ({
      id: a.id,
      assetTag: a.assetTag,
      warrantyEndDate: new Date(a.warrantyEndDate as string),
      daysLeft: Math.ceil((new Date(a.warrantyEndDate as string).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
    }))
    .filter(x => x.daysLeft <= 120)
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .slice(0, 6);

  const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6', '#f97316'];

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
            onClick={() => navigate('/assets/bulk')}
            className="btn-secondary flex items-center gap-2 border border-slate-200 dark:border-slate-600"
          >
            <div className="flex items-center">
              <Plus className="w-4 h-4" />
              <div className="w-3 h-3 bg-slate-400 dark:bg-slate-500 rounded-full ml-1 flex items-center justify-center">
                <Plus className="w-2 h-2 text-white" />
              </div>
            </div>
            Bulk Upload
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/assets/new')}
            className="btn-primary flex items-center gap-2"
          >
            <div className="flex items-center justify-center w-4 h-4 bg-white/20 rounded-sm">
              <Plus className="w-3 h-3" />
            </div>
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

      {/* Charts and insights */}
      <div className="grid grid-cols-1 2xl:grid-cols-3 gap-6">
        {/* Asset Type Distribution (Pie) */}
        <motion.div variants={itemVariants} className="card p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Asset Types</h2>
            <button onClick={() => navigate('/assets')} className="btn-ghost text-sm">View</button>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RePieChart>
                <Pie data={typePieData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                  {typePieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </RePieChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Status Distribution (Bar) */}
        <motion.div variants={itemVariants} className="card p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Status</h2>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="status" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Condition Breakdown (Pie/Bar) */}
        <motion.div variants={itemVariants} className="card p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Condition</h2>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RePieChart>
                <Pie data={conditionData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80}>
                  {conditionData.map((entry, index) => (
                    <Cell key={`cond-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </RePieChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* Lists and activity */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Top Models */}
        <motion.div variants={itemVariants} className="card p-6 xl:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Top Models</h2>
            <button onClick={() => navigate('/assets')} className="btn-ghost text-sm">Explore</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {topModels.length === 0 ? (
              <div className="text-slate-500">No data</div>
            ) : (
              topModels.map((m, idx) => (
                <div key={m.name} className="flex items-center justify-between p-3 rounded-lg bg-slate-50/50 dark:bg-slate-800/30">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-10 rounded bg-slate-300 dark:bg-slate-600" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                    <div className="truncate">
                      <div className="font-medium text-slate-900 dark:text-slate-100 truncate">{m.name}</div>
                      <div className="text-xs text-slate-500">{m.count} assets</div>
                    </div>
                  </div>
                  <button onClick={() => navigate(`/assets?model=${encodeURIComponent(m.name)}`)} className="btn-ghost text-sm">View</button>
                </div>
              ))
            )}
          </div>
        </motion.div>

        {/* Upcoming Warranties */}
        <motion.div variants={itemVariants} className="card p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Warranties (next 120 days)</h2>
            <button onClick={() => navigate('/assets?sortBy=warrantyEndDate&sortOrder=asc')} className="btn-ghost text-sm">View</button>
          </div>
          <div className="space-y-3">
            {upcomingWarranties.length === 0 ? (
              <div className="text-slate-500">No upcoming expirations</div>
            ) : (
              upcomingWarranties.map(w => (
                <div key={w.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50/50 dark:bg-slate-800/30">
                  <div className="font-mono text-sm text-brand-600 dark:text-brand-400">{w.assetTag}</div>
                  <div className="text-sm text-slate-600 dark:text-slate-300">{w.warrantyEndDate.toLocaleDateString()} ({w.daysLeft}d)</div>
                </div>
              ))
            )}
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
              onClick={() => navigate('/assets/bulk')}
              className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-success-500/10 to-success-600/10 hover:from-success-500/20 hover:to-success-600/20 border border-success-200/50 dark:border-success-700/50 transition-all text-left"
            >
              <div className="flex items-center">
                <Upload className="w-5 h-5 text-success-600 dark:text-success-400" />
                <div className="w-3 h-3 bg-success-600 dark:bg-success-400 rounded-full ml-1 flex items-center justify-center">
                  <Plus className="w-2 h-2 text-white" />
                </div>
              </div>
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