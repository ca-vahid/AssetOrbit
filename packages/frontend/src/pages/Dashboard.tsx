import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  ComputerDesktopIcon,
  CheckCircleIcon,
  UserGroupIcon,
  WrenchScrewdriverIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline';
import { assetsApi } from '../services/api';
import { useStore } from '../store';

interface StatCard {
  name: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  link?: string;
}

const Dashboard: React.FC = () => {
  const { currentUser } = useStore();
  
  // Fetch asset statistics
  const { data: availableAssets } = useQuery({
    queryKey: ['assets', 'available'],
    queryFn: () => assetsApi.getAll({ status: 'AVAILABLE', limit: 1 }),
    enabled: !!currentUser,
  });
  
  const { data: assignedAssets } = useQuery({
    queryKey: ['assets', 'assigned'],
    queryFn: () => assetsApi.getAll({ status: 'ASSIGNED', limit: 1 }),
    enabled: !!currentUser,
  });
  
  const { data: maintenanceAssets } = useQuery({
    queryKey: ['assets', 'maintenance'],
    queryFn: () => assetsApi.getAll({ status: 'MAINTENANCE', limit: 1 }),
    enabled: !!currentUser,
  });
  
  const { data: totalAssets } = useQuery({
    queryKey: ['assets', 'total'],
    queryFn: () => assetsApi.getAll({ limit: 1 }),
    enabled: !!currentUser,
  });
  
  // Fetch recent assets for activity feed
  const { data: recentAssets } = useQuery({
    queryKey: ['assets', 'recent'],
    queryFn: () => assetsApi.getAll({ limit: 5, sortBy: 'createdAt', sortOrder: 'desc' }),
    enabled: !!currentUser,
  });
  
  const stats: StatCard[] = [
    {
      name: 'Total Assets',
      value: totalAssets?.pagination.total || 0,
      icon: ComputerDesktopIcon,
      color: 'bg-blue-500',
      link: '/assets',
    },
    {
      name: 'Available',
      value: availableAssets?.pagination.total || 0,
      icon: CheckCircleIcon,
      color: 'bg-green-500',
      link: '/assets?status=AVAILABLE',
    },
    {
      name: 'Assigned',
      value: assignedAssets?.pagination.total || 0,
      icon: UserGroupIcon,
      color: 'bg-purple-500',
      link: '/assets?status=ASSIGNED',
    },
    {
      name: 'In Maintenance',
      value: maintenanceAssets?.pagination.total || 0,
      icon: WrenchScrewdriverIcon,
      color: 'bg-yellow-500',
      link: '/assets?status=MAINTENANCE',
    },
  ];
  
  const quickActions = [
    {
      name: 'Add New Asset',
      description: 'Register a new device in the system',
      icon: PlusIcon,
      link: '/assets/new',
      color: 'bg-primary-600 hover:bg-primary-700',
      requiresWrite: true,
    },
    {
      name: 'Search Assets',
      description: 'Find devices by tag, serial, or user',
      icon: MagnifyingGlassIcon,
      link: '/assets',
      color: 'bg-gray-600 hover:bg-gray-700',
    },
    {
      name: 'Export Report',
      description: 'Download asset data as CSV or Excel',
      icon: ArrowDownTrayIcon,
      link: '/assets?export=true',
      color: 'bg-indigo-600 hover:bg-indigo-700',
    },
  ];
  
  // Filter quick actions based on user role
  const filteredQuickActions = quickActions.filter((action) => {
    if (action.requiresWrite && currentUser?.role === 'READ') return false;
    return true;
  });
  
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Welcome back, {currentUser?.displayName || 'User'}!
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Here's an overview of your asset inventory
        </p>
      </div>
      
      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link
              key={stat.name}
              to={stat.link || '#'}
              className="relative overflow-hidden rounded-lg bg-white dark:bg-gray-800 px-6 py-5 shadow hover:shadow-lg transition-shadow"
            >
              <dt>
                <div className={`absolute rounded-md p-3 ${stat.color}`}>
                  <Icon className="h-6 w-6 text-white" aria-hidden="true" />
                </div>
                <p className="ml-16 truncate text-sm font-medium text-gray-500 dark:text-gray-400">
                  {stat.name}
                </p>
              </dt>
              <dd className="ml-16 flex items-baseline">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stat.value}
                </p>
              </dd>
            </Link>
          );
        })}
      </div>
      
      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredQuickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.name}
                to={action.link}
                className="group relative rounded-lg p-6 bg-white dark:bg-gray-800 hover:shadow-lg transition-shadow"
              >
                <div>
                  <span
                    className={`inline-flex rounded-lg p-3 text-white ${action.color}`}
                  >
                    <Icon className="h-6 w-6" aria-hidden="true" />
                  </span>
                </div>
                <div className="mt-4">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                    {action.name}
                  </h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {action.description}
                  </p>
                </div>
                <span
                  className="pointer-events-none absolute top-6 right-6 text-gray-300 group-hover:text-gray-400 dark:text-gray-600 dark:group-hover:text-gray-500"
                  aria-hidden="true"
                >
                  <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20 4h1a1 1 0 00-1-1v1zm-1 12a1 1 0 102 0h-2zM8 3a1 1 0 000 2V3zM3.293 19.293a1 1 0 101.414 1.414l-1.414-1.414zM19 4v12h2V4h-2zm1-1H8v2h12V3zm-.707.293l-16 16 1.414 1.414 16-16-1.414-1.414z" />
                  </svg>
                </span>
              </Link>
            );
          })}
        </div>
      </div>
      
      {/* Recent Activity */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Recent Assets
        </h2>
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {recentAssets?.data.map((asset) => (
              <li key={asset.id}>
                <Link
                  to={`/assets/${asset.id}`}
                  className="block px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {asset.assetTag}
                        </p>
                        <span className="ml-2 inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                          {asset.assetType}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {asset.make} {asset.model}
                        {asset.assignedTo && ` • Assigned to ${asset.assignedTo.displayName}`}
                      </p>
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {new Date(asset.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
            {!recentAssets?.data.length && (
              <li className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                No assets found
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Dashboard; 