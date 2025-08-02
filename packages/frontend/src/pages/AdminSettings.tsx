import React, { useState, useEffect } from 'react';
import { AlertTriangle, Trash2, Server, Laptop, Smartphone, Monitor as Desktop, Package, Shield } from 'lucide-react';
import { api } from '../services/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface AssetStats {
  total: number;
  assetTypes: Record<string, number>;
  statuses: Record<string, number>;
}

interface BulkDeleteConfirmation {
  type: 'all' | 'LAPTOP' | 'PHONE' | 'DESKTOP' | 'TABLET' | 'OTHER';
  count: number;
  label: string;
}

const AdminSettings: React.FC = () => {
  const [deleteConfirmation, setDeleteConfirmation] = useState<BulkDeleteConfirmation | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState({ completed: 0, total: 0 });
  
  const queryClient = useQueryClient();

  // Fetch asset statistics
  const { data: stats, isLoading, error } = useQuery<AssetStats>({
    queryKey: ['asset-stats'],
    queryFn: async () => {
      const response = await api.get('/assets/stats');
      return response.data;
    },
  });

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (deleteType: 'all' | string) => {
      if (deleteType === 'all') {
        // Delete all assets
        const response = await api.post('/assets/bulk-delete-all');
        return response.data;
      } else {
        // Delete by asset type
        const response = await api.post('/assets/bulk-delete-by-type', {
          assetType: deleteType
        });
        return response.data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asset-stats'] });
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      setDeleteConfirmation(null);
      setIsDeleting(false);
    },
    onError: (error) => {
      console.error('Bulk delete failed:', error);
      setIsDeleting(false);
    },
  });

  const handleBulkDelete = async () => {
    if (!deleteConfirmation) return;
    
    setIsDeleting(true);
    setDeleteProgress({ completed: 0, total: deleteConfirmation.count });
    
    try {
      await bulkDeleteMutation.mutateAsync(deleteConfirmation.type);
    } catch (error) {
      console.error('Delete failed:', error);
    }
  };

  const openDeleteConfirmation = (type: BulkDeleteConfirmation['type']) => {
    if (!stats) return;
    
    let count = 0;
    let label = '';
    
    switch (type) {
      case 'all':
        count = stats.total;
        label = 'All Assets';
        break;
      case 'LAPTOP':
        count = stats.assetTypes.LAPTOP || 0;
        label = 'All Laptops';
        break;
      case 'PHONE':
        count = stats.assetTypes.PHONE || 0;
        label = 'All Phones';
        break;
      case 'DESKTOP':
        count = stats.assetTypes.DESKTOP || 0;
        label = 'All Desktops';
        break;
      case 'TABLET':
        count = stats.assetTypes.TABLET || 0;
        label = 'All Tablets';
        break;
      case 'OTHER':
        count = stats.assetTypes.OTHER || 0;
        label = 'All Other Assets';
        break;
    }
    
    setDeleteConfirmation({ type, count, label });
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/4 mb-4"></div>
          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2 mb-8"></div>
          <div className="space-y-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-20 bg-slate-200 dark:bg-slate-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
            <AlertTriangle className="w-5 h-5" />
            <span className="font-medium">Failed to load asset statistics</span>
          </div>
          <p className="text-red-600 dark:text-red-300 text-sm mt-1">
            Please refresh the page to try again.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
            <Shield className="w-6 h-6 text-red-600 dark:text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Admin Settings
          </h1>
        </div>
        <p className="text-slate-600 dark:text-slate-400">
          Dangerous operations that require administrator privileges. Use with caution.
        </p>
      </div>

      {/* Bulk Delete Section */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
            <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Bulk Delete Assets
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Permanently delete multiple assets by category. This action cannot be undone.
            </p>
          </div>
        </div>

        {/* Current Statistics */}
        <div className="mb-8 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
          <h3 className="font-medium text-slate-900 dark:text-slate-100 mb-3">Current Asset Counts</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="text-center">
              <Server className="w-8 h-8 text-slate-600 dark:text-slate-400 mx-auto mb-1" />
              <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {stats?.total || 0}
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400">Total</div>
            </div>
            <div className="text-center">
              <Laptop className="w-8 h-8 text-blue-600 dark:text-blue-400 mx-auto mb-1" />
              <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {stats?.assetTypes.LAPTOP || 0}
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400">Laptops</div>
            </div>
            <div className="text-center">
              <Desktop className="w-8 h-8 text-green-600 dark:text-green-400 mx-auto mb-1" />
              <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {stats?.assetTypes.DESKTOP || 0}
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400">Desktops</div>
            </div>
            <div className="text-center">
              <Smartphone className="w-8 h-8 text-purple-600 dark:text-purple-400 mx-auto mb-1" />
              <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {stats?.assetTypes.PHONE || 0}
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400">Phones</div>
            </div>
            <div className="text-center">
              <Package className="w-8 h-8 text-amber-600 dark:text-amber-400 mx-auto mb-1" />
              <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {stats?.assetTypes.TABLET || 0}
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400">Tablets</div>
            </div>
            <div className="text-center">
              <Package className="w-8 h-8 text-slate-600 dark:text-slate-400 mx-auto mb-1" />
              <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {stats?.assetTypes.OTHER || 0}
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400">Other</div>
            </div>
          </div>
        </div>

        {/* Delete Actions */}
        <div className="space-y-4">
          {/* Delete All Assets */}
          <div className="flex items-center justify-between p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-center gap-3">
              <Server className="w-5 h-5 text-red-600 dark:text-red-400" />
              <div>
                <div className="font-medium text-red-900 dark:text-red-100">
                  Delete All Assets
                </div>
                <div className="text-sm text-red-700 dark:text-red-300">
                  Permanently delete all {stats?.total || 0} assets
                </div>
              </div>
            </div>
            <button
              onClick={() => openDeleteConfirmation('all')}
              disabled={!stats?.total}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Delete All
            </button>
          </div>

          {/* Delete by Asset Type */}
          {[
            { type: 'LAPTOP' as const, icon: Laptop, label: 'Laptops', color: 'blue' },
            { type: 'DESKTOP' as const, icon: Desktop, label: 'Desktops', color: 'green' },
            { type: 'PHONE' as const, icon: Smartphone, label: 'Phones', color: 'purple' },
            { type: 'TABLET' as const, icon: Package, label: 'Tablets', color: 'amber' },
            { type: 'OTHER' as const, icon: Package, label: 'Other Assets', color: 'slate' },
          ].map(({ type, icon: Icon, label, color }) => {
            const count = stats?.assetTypes[type] || 0;
            return (
              <div
                key={type}
                className="flex items-center justify-between p-4 border border-slate-200 dark:border-slate-700 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-5 h-5 text-${color}-600 dark:text-${color}-400`} />
                  <div>
                    <div className="font-medium text-slate-900 dark:text-slate-100">
                      Delete All {label}
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                      Permanently delete all {count} {label.toLowerCase()}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => openDeleteConfirmation(type)}
                  disabled={!count}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete {count}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmation && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-6 max-w-md w-full mx-4">
            {/* Header */}
            <div className="flex items-start gap-4 mb-6">
              <div className="flex-shrink-0 p-3 bg-red-100 dark:bg-red-900/30 rounded-full">
                <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">
                  Delete {deleteConfirmation.label}
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  This action cannot be undone
                </p>
              </div>
            </div>
            
            {/* Content */}
            <div className="mb-6">
              {isDeleting ? (
                <>
                  <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-red-600 dark:bg-red-500 h-3 transition-all duration-300"
                      style={{ 
                        width: deleteProgress.total > 0 
                          ? `${(deleteProgress.completed / deleteProgress.total) * 100}%` 
                          : '0%' 
                      }}
                    />
                  </div>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 text-center">
                    Deleting assets... This may take a moment.
                  </p>
                </>
              ) : (
                <div className="space-y-4">
                  <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                    Are you sure you want to permanently delete{' '}
                    <span className="font-semibold text-red-600 dark:text-red-400">
                      {deleteConfirmation.count} {deleteConfirmation.count === 1 ? 'asset' : 'assets'}
                    </span>
                    ?
                  </p>
                  
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-red-800 dark:text-red-200">
                        <p className="font-medium mb-1">Warning:</p>
                        <ul className="space-y-1 text-red-700 dark:text-red-300">
                          <li>• All asset data will be permanently removed</li>
                          <li>• Associated custom field values will be deleted</li>
                          <li>• Activity logs will be preserved but orphaned</li>
                          <li>• This operation cannot be reversed</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Actions */}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirmation(null)}
                disabled={isDeleting}
                className="px-4 py-2.5 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={isDeleting}
                className="px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2 font-medium"
              >
                {isDeleting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete {deleteConfirmation.count} Asset{deleteConfirmation.count > 1 ? 's' : ''}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSettings;