import React, { useState } from 'react';
import { X, Calendar, User, MapPin, Package, Clock, Edit } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { assetsApi, activitiesApi, type Asset as ApiAsset } from '../services/api';
import { useCustomFields } from '../hooks/useCustomFields';
import type { Activity } from '@ats/shared';
import EditAsset from '../pages/EditAsset';

interface AssetDetailModalProps {
  assetId: string;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (asset: ApiAsset) => void;
}

const AssetDetailModal: React.FC<AssetDetailModalProps> = ({
  assetId,
  isOpen,
  onClose,
  onEdit,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  
  const { data: asset, isLoading: assetLoading } = useQuery({
    queryKey: ['asset', assetId],
    queryFn: () => assetsApi.getById(assetId),
    enabled: isOpen && !!assetId,
  });

  const { data: activities, isLoading: activitiesLoading } = useQuery({
    queryKey: ['activities', 'ASSET', assetId],
    queryFn: () => activitiesApi.getByEntity('ASSET', assetId),
    enabled: isOpen && !!assetId,
  });

  const { data: customFields } = useCustomFields();

  if (!isOpen) return null;

  const handleEdit = () => {
    console.log('AssetDetailModal handleEdit called', { asset: !!asset, onEdit: !!onEdit });
    if (onEdit && asset) {
      onEdit(asset);
    } else {
      console.log('Setting isEditing to true');
      setIsEditing(true);
    }
  };

  const handleSaveEdit = (updatedAsset: ApiAsset) => {
    setIsEditing(false);
    // The asset data will be automatically refreshed via React Query
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'AVAILABLE':
        return 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400';
      case 'ASSIGNED':
        return 'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-400';
      case 'SPARE':
        return 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-400';
      case 'MAINTENANCE':
        return 'bg-orange-100 dark:bg-orange-900/20 text-orange-800 dark:text-orange-400';
      case 'RETIRED':
        return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-400';
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-400';
    }
  };

  const getConditionColor = (condition: string) => {
    switch (condition) {
      case 'NEW':
        return 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400';
      case 'GOOD':
        return 'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-400';
      case 'FAIR':
        return 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-400';
      case 'POOR':
        return 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-400';
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-400';
    }
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString();
  };

  const formatCurrency = (amount: string | number | null | undefined) => {
    if (!amount) return '—';
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(numAmount)) return '—';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(numAmount);
  };

  const getCustomFieldValue = (fieldId: string) => {
    console.log('getCustomFieldValue:', { fieldId, customFields: asset?.customFields, allCustomFields: customFields });
    
    if (!asset?.customFields) return '—';
    const value = asset.customFields[fieldId];
    
    console.log('Custom field value for', fieldId, ':', value);
    
    if (value === null || value === undefined || value === '') return '—';
    
    // Handle different field types
    const field = customFields?.find(f => f.id === fieldId);
    if (field?.fieldType === 'BOOLEAN') {
      return value ? 'Yes' : 'No';
    }
    if (field?.fieldType === 'DATE' && value) {
      return formatDate(value);
    }
    return String(value);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/50 transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative w-full max-w-4xl bg-white dark:bg-slate-800 rounded-xl shadow-xl max-h-[90vh] overflow-hidden">
          {isEditing ? (
            <>
              {/* Edit Mode Header */}
              <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                  Edit Asset
                </h2>
                <button
                  onClick={handleCancelEdit}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              {/* Edit Form */}
              <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
                {(() => {
                  if (asset) {
                    console.log('Rendering EditAsset with asset:', asset.assetTag);
                    return (
                      <EditAsset
                        asset={asset}
                        onSave={handleSaveEdit}
                        onCancel={handleCancelEdit}
                        isModal={true}
                      />
                    );
                  } else {
                    console.log('Asset not available for edit');
                    return (
                      <div className="flex items-center justify-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
                      </div>
                    );
                  }
                })()}
              </div>
            </>
          ) : (
            <>
              {/* View Mode Header */}
              <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-4">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                      {assetLoading ? 'Loading...' : asset?.assetTag}
                    </h2>
                    {asset && (
                      <p className="text-slate-600 dark:text-slate-400">
                        {asset.make} {asset.model}
                      </p>
                    )}
                  </div>
                  {asset && (
                    <div className="flex gap-2">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(asset.status)}`}>
                        {asset.status}
                      </span>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getConditionColor(asset.condition)}`}>
                        {asset.condition}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {asset && (
                    <button
                      onClick={handleEdit}
                      className="flex items-center gap-2 px-3 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                      Edit
                    </button>
                  )}
                  <button
                    onClick={onClose}
                    className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* View Mode Content */}
              <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
                {assetLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
                  </div>
                ) : asset ? (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Main Details */}
                    <div className="lg:col-span-2 space-y-6">
                      {/* Basic Information */}
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                          <Package className="w-5 h-5" />
                          Basic Information
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                              Asset Type
                            </label>
                            <p className="text-slate-900 dark:text-slate-100">{asset.assetType}</p>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                              Serial Number
                            </label>
                            <p className="text-slate-900 dark:text-slate-100">{asset.serialNumber || '—'}</p>
                          </div>
                        </div>
                      </div>

                      {/* Assignment & Location */}
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                          <User className="w-5 h-5" />
                          Assignment & Location
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                              Assigned To
                            </label>
                            <p className="text-slate-900 dark:text-slate-100">
                              {asset.assignedTo?.displayName || '—'}
                            </p>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                              Department
                            </label>
                            <p className="text-slate-900 dark:text-slate-100">
                              {asset.department?.name || '—'}
                            </p>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                              Location
                            </label>
                            <p className="text-slate-900 dark:text-slate-100 flex items-center gap-1">
                              <MapPin className="w-4 h-4" />
                              {asset.location?.name || '—'}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Custom Fields */}
                      {customFields && customFields.length > 0 && (
                        <div>
                          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
                            Additional Attributes
                          </h3>
                          <div className="grid grid-cols-2 gap-4">
                            {customFields.map((field) => (
                              <div key={field.id}>
                                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                                  {field.name}
                                </label>
                                <p className="text-slate-900 dark:text-slate-100">
                                  {getCustomFieldValue(field.id)}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Purchase & Warranty */}
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                          <Calendar className="w-5 h-5" />
                          Purchase & Warranty
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                              Purchase Date
                            </label>
                            <p className="text-slate-900 dark:text-slate-100">
                              {formatDate(asset.purchaseDate)}
                            </p>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                              Purchase Price
                            </label>
                            <p className="text-slate-900 dark:text-slate-100">
                              {formatCurrency(asset.purchasePrice)}
                            </p>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                              Vendor
                            </label>
                            <p className="text-slate-900 dark:text-slate-100">
                              {asset.vendor?.name || '—'}
                            </p>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                              Warranty End Date
                            </label>
                            <p className="text-slate-900 dark:text-slate-100">
                              {formatDate(asset.warrantyEndDate)}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Notes */}
                      {asset.notes && (
                        <div>
                          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
                            Notes
                          </h3>
                          <p className="text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg">
                            {asset.notes}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Activity History */}
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                        <Clock className="w-5 h-5" />
                        Activity History
                      </h3>
                      {activitiesLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600"></div>
                        </div>
                      ) : activities && activities.length > 0 ? (
                        <div className="space-y-3 max-h-96 overflow-y-auto">
                          {activities.map((activity: Activity) => (
                            <div key={activity.id} className="bg-slate-50 dark:bg-slate-700/50 p-3 rounded-lg">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                  {activity.action}
                                </span>
                                <span className="text-xs text-slate-500 dark:text-slate-400">
                                  {formatDate(activity.createdAt)}
                                </span>
                              </div>
                              <p className="text-sm text-slate-600 dark:text-slate-400">
                                by {activity.user?.displayName || 'System'}
                              </p>
                              {activity.details && (
                                <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                                  {activity.details}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-slate-500 dark:text-slate-400 text-sm">
                          No activity history available.
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-slate-500 dark:text-slate-400">Asset not found.</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AssetDetailModal; 