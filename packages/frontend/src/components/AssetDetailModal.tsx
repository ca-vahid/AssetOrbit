import React, { useState, useEffect } from 'react';
import { X, Calendar, User, MapPin, Package, Clock, Edit, ChevronDown, ChevronUp, Monitor, Cpu, HardDrive, MemoryStick, Zap, Shield, DollarSign, Building, Tag, Mail, Phone, UserCheck, Laptop, Smartphone, Tablet } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { assetsApi, activitiesApi, staffApi, type Asset as ApiAsset } from '../services/api';
import { useCustomFields } from '../hooks/useCustomFields';
import type { Activity } from '@ats/shared';
import EditAsset from '../pages/EditAsset';
import SourceBadge from './SourceBadge';

interface AssetDetailModalProps {
  assetId: string;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (asset: ApiAsset) => void;
}

// Custom hook for profile photos
const useProfilePhoto = (azureAdId: string | undefined) => {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasAttempted, setHasAttempted] = useState(false);

  useEffect(() => {
    if (!azureAdId || hasAttempted) return;

    const loadPhoto = async () => {
      setIsLoading(true);
      setError(null);
      setHasAttempted(true);
      
      try {
        const photoBlob = await staffApi.getProfilePhoto(azureAdId);
        const url = URL.createObjectURL(photoBlob);
        setPhotoUrl(url);
      } catch (err: any) {
        if (err.response?.status === 404) {
          // No photo available - this is normal, don't set as error
          setPhotoUrl(null);
          setError(null);
        } else {
          setError('Failed to load photo');
          console.error('Error loading profile photo:', err);
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadPhoto();

    // Cleanup function to revoke object URL
    return () => {
      if (photoUrl) {
        URL.revokeObjectURL(photoUrl);
      }
    };
  }, [azureAdId, hasAttempted]);

  // Reset when azureAdId changes
  useEffect(() => {
    setHasAttempted(false);
    setPhotoUrl(null);
    setError(null);
  }, [azureAdId]);

  return { photoUrl, isLoading, error };
};

// Profile picture component with fallback to initials
const ProfilePicture: React.FC<{
  azureAdId?: string;
  displayName?: string;
  size: 'sm' | 'md' | 'lg';
  className?: string;
}> = ({ azureAdId, displayName, size, className }) => {
  const { photoUrl, isLoading } = useProfilePhoto(azureAdId);
  
  const sizeClasses = {
    sm: 'w-10 h-10 text-sm',
    md: 'w-14 h-14 text-lg',
    lg: 'w-20 h-20 text-xl',
  };

  const getInitials = (name?: string): string => {
    if (!name) return '?';
    const parts = name.trim().split(' ').filter(part => part.length > 0);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  if (photoUrl && !isLoading) {
    return (
      <img
        src={photoUrl}
        alt={`${displayName || 'User'} profile`}
        className={clsx(
          sizeClasses[size],
          'rounded-full object-cover border-3 border-white shadow-lg flex-shrink-0 ring-2 ring-slate-200 dark:ring-slate-600',
          className
        )}
        onError={() => {
          // If image fails to load, we'll fall back to initials
          console.log('Profile image failed to load for:', displayName);
        }}
      />
    );
  }

  // Fallback to initials
  return (
    <div className={clsx(
      sizeClasses[size],
      'bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 border-3 border-white shadow-lg ring-2 ring-slate-200 dark:ring-slate-600',
      className
    )}>
      <span className="select-none font-bold text-white">
        {getInitials(displayName)}
      </span>
    </div>
  );
};

const AssetDetailModal: React.FC<AssetDetailModalProps> = ({
  assetId,
  isOpen,
  onClose,
  onEdit,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [showActivityHistory, setShowActivityHistory] = useState(false);
  const queryClient = useQueryClient();
  
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
    // Refresh the activity history for the updated asset
    queryClient.invalidateQueries({ queryKey: ['activities', 'ASSET', assetId] });
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'AVAILABLE':
        return 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700';
      case 'ASSIGNED':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700';
      case 'SPARE':
        return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700';
      case 'MAINTENANCE':
        return 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-700';
      case 'RETIRED':
        return 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-400 border-slate-200 dark:border-slate-600';
      default:
        return 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-400 border-slate-200 dark:border-slate-600';
    }
  };

  const getConditionColor = (condition: string) => {
    switch (condition) {
      case 'NEW':
        return 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700';
      case 'GOOD':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700';
      case 'FAIR':
        return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700';
      case 'POOR':
        return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700';
      default:
        return 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-400 border-slate-200 dark:border-slate-600';
    }
  };

  const getAssetTypeIcon = (type: string) => {
    switch (type) {
      case 'LAPTOP':
        return Laptop; // Laptop icon
      case 'DESKTOP':
        return Monitor; // Desktop/Monitor icon
      case 'TABLET':
        return Tablet; // Tablet icon
      case 'PHONE':
        return Smartphone; // Phone icon
      case 'OTHER':
      default:
        return Package; // Generic package icon
    }
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
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
    if (!asset?.customFields) return '—';
    const value = asset.customFields[fieldId];
    
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

  const parseSpecifications = (specs: any) => {
    if (!specs) return null;
    try {
      return typeof specs === 'string' ? JSON.parse(specs) : specs;
    } catch {
      return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative w-full max-w-5xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-h-[95vh] overflow-hidden border border-slate-200 dark:border-slate-700">
          {isEditing ? (
            <>
              {/* Edit Mode Header */}
              <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                  Edit Asset
                </h2>
                <button
                  onClick={handleCancelEdit}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              {/* Edit Form */}
              <div className="p-6 overflow-y-auto max-h-[calc(95vh-80px)]">
                {asset ? (
                  <EditAsset
                    asset={asset}
                    onSave={handleSaveEdit}
                    onCancel={handleCancelEdit}
                    isModal={true}
                  />
                ) : (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              {/* View Mode */}
              {assetLoading ? (
                <div className="flex items-center justify-center py-24">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
                </div>
              ) : asset ? (
                <>
                  {/* Hero Section */}
                  <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 p-6 border-b border-slate-200 dark:border-slate-700">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        {/* Asset Icon */}
                        <div className="p-3 bg-white dark:bg-slate-800 rounded-xl shadow-md border border-slate-200 dark:border-slate-700">
                          {React.createElement(getAssetTypeIcon(asset.assetType), {
                            className: "w-6 h-6 text-slate-700 dark:text-slate-300"
                          })}
                        </div>
                        
                        {/* Asset Info */}
                        <div className="flex-1">
                          <div className="flex items-center gap-4 mb-2">
                            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                            {asset.assetTag}
                          </h1>
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium border ${getStatusColor(asset.status)}`}>
                              {asset.status}
                            </span>
                          </div>
                          
                          <p className="text-lg text-slate-600 dark:text-slate-400 mb-3">
                            {asset.make} {asset.model}
                          </p>
                          
                          {/* Key Specs & Categories */}
                          <div className="flex flex-wrap items-center gap-4 text-sm">
                            {/* Vendor */}
                            {asset.vendor && (
                              <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                                <Building className="w-4 h-4" />
                                <span>{asset.vendor.name}</span>
                              </div>
                            )}
                            
                            {/* Key Hardware Specs */}
                            {(() => {
                              const specs = parseSpecifications(asset.specifications);
                              if (!specs) return null;
                              
                              return (
                                <>
                                  {specs.processor && (
                                    <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                                      <Cpu className="w-4 h-4" />
                                      <span>{specs.processor}</span>
                                    </div>
                                  )}
                                  {specs.ram && (
                                    <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                                      <MemoryStick className="w-4 h-4" />
                                      <span>{specs.ram}</span>
                                    </div>
                                  )}
                                  {specs.storage && (
                                    <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                                      <HardDrive className="w-4 h-4" />
                                      <span>{specs.storage}</span>
                                    </div>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                          
                          {/* Workload Categories */}
                          {asset.workloadCategories && asset.workloadCategories.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-3">
                              {asset.workloadCategories.map((category) => (
                                <span
                                  key={category.id}
                                  className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-700"
                                >
                                  <Tag className="w-3 h-3 mr-1" />
                                  {category.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Action Buttons */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleEdit}
                          className="flex items-center gap-2 px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors text-sm font-medium"
                        >
                          <Edit className="w-4 h-4" />
                          Edit
                        </button>
                        <button
                          onClick={onClose}
                          className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors rounded-lg hover:bg-white dark:hover:bg-slate-700"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-8 overflow-y-auto max-h-[calc(95vh-200px)]">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                      {/* Left Column - Asset Details */}
                      <div className="lg:col-span-2 space-y-8">
                        {/* Asset Overview */}
                        <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
                          <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-6 flex items-center gap-3">
                            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
                              <Package className="w-5 h-5" />
                            </div>
                            Asset Overview
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                              <div className="flex items-center justify-between py-2 border-b border-slate-200 dark:border-slate-600">
                                <span className="text-slate-600 dark:text-slate-400 font-medium">Asset Tag</span>
                                <span className="font-mono text-slate-900 dark:text-slate-100 font-semibold">{asset.assetTag}</span>
                              </div>
                              <div className="flex items-center justify-between py-2 border-b border-slate-200 dark:border-slate-600">
                                <span className="text-slate-600 dark:text-slate-400 font-medium">Type</span>
                                <span className="text-slate-900 dark:text-slate-100 font-medium">{asset.assetType}</span>
                              </div>
                              <div className="flex items-center justify-between py-2 border-b border-slate-200 dark:border-slate-600">
                                <span className="text-slate-600 dark:text-slate-400 font-medium">Make & Model</span>
                                <span className="text-slate-900 dark:text-slate-100 font-medium">{asset.make} {asset.model}</span>
                              </div>
                              <div className="flex items-center justify-between py-2 border-b border-slate-200 dark:border-slate-600">
                                <span className="text-slate-600 dark:text-slate-400 font-medium">Serial Number</span>
                                <span className="font-mono text-slate-900 dark:text-slate-100">{asset.serialNumber || '—'}</span>
                              </div>
                            </div>
                            <div className="space-y-4">
                              <div className="flex items-center justify-between py-2 border-b border-slate-200 dark:border-slate-600">
                                <span className="text-slate-600 dark:text-slate-400 font-medium">Status</span>
                                <span className={`inline-flex items-center px-3 py-1 rounded-lg text-sm font-medium border ${getStatusColor(asset.status)}`}>
                                  {asset.status}
                                </span>
                              </div>
                              <div className="flex items-center justify-between py-2 border-b border-slate-200 dark:border-slate-600">
                                <span className="text-slate-600 dark:text-slate-400 font-medium">Condition</span>
                                <span className={`inline-flex items-center px-3 py-1 rounded-lg text-sm font-medium border ${getConditionColor(asset.condition)}`}>
                                  {asset.condition}
                                </span>
                              </div>
                              <div className="flex items-center justify-between py-2 border-b border-slate-200 dark:border-slate-600">
                                <span className="text-slate-600 dark:text-slate-400 font-medium">Source</span>
                                {asset.source ? <SourceBadge source={asset.source} size="sm" /> : <span className="text-slate-500">—</span>}
                              </div>
                              <div className="flex items-center justify-between py-2 border-b border-slate-200 dark:border-slate-600">
                                <span className="text-slate-600 dark:text-slate-400 font-medium">Location</span>
                                <span className="text-slate-900 dark:text-slate-100 font-medium">
                                  {asset.location ? `${asset.location.city}, ${asset.location.province}` : '—'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Technical Specifications */}
                        {(() => {
                          const specs = parseSpecifications(asset.specifications);
                          if (!specs || Object.keys(specs).length === 0) return null;
                          
                          return (
                            <div className="bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 rounded-xl p-6 border border-orange-200 dark:border-orange-700">
                              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-6 flex items-center gap-3">
                                <div className="p-2 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-lg">
                                  <Cpu className="w-5 h-5" />
                                </div>
                                Technical Specifications
                              </h3>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {specs.processor && (
                                  <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-orange-200 dark:border-orange-700">
                                    <div className="flex items-center gap-3 mb-2">
                                      <Cpu className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                                      <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Processor</span>
                                    </div>
                                    <p className="text-slate-900 dark:text-slate-100 font-medium">{specs.processor}</p>
                                  </div>
                                )}
                                {specs.ram && (
                                  <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-orange-200 dark:border-orange-700">
                                    <div className="flex items-center gap-3 mb-2">
                                      <MemoryStick className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                                      <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Memory</span>
                                    </div>
                                    <p className="text-slate-900 dark:text-slate-100 font-medium">{specs.ram}</p>
                                  </div>
                                )}
                                {specs.storage && (
                                  <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-orange-200 dark:border-orange-700">
                                    <div className="flex items-center gap-3 mb-2">
                                      <HardDrive className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                                      <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Storage</span>
                                    </div>
                                    <p className="text-slate-900 dark:text-slate-100 font-medium">{specs.storage}</p>
                                  </div>
                                )}
                                {specs.operatingSystem && (
                                  <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-orange-200 dark:border-orange-700">
                                    <div className="flex items-center gap-3 mb-2">
                                      <Shield className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                                      <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Operating System</span>
                                    </div>
                                    <p className="text-slate-900 dark:text-slate-100 font-medium">{specs.operatingSystem}</p>
                                  </div>
                                )}
                                {specs.screenSize && (
                                  <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-orange-200 dark:border-orange-700">
                                    <div className="flex items-center gap-3 mb-2">
                                      <Monitor className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                                      <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Screen Size</span>
                                    </div>
                                    <p className="text-slate-900 dark:text-slate-100 font-medium">{specs.screenSize}</p>
                                  </div>
                                )}
                                {specs.batteryHealth && (
                                  <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-orange-200 dark:border-orange-700">
                                    <div className="flex items-center gap-3 mb-2">
                                      <Zap className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                                      <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Battery Health</span>
                                    </div>
                                    <p className="text-slate-900 dark:text-slate-100 font-medium">{specs.batteryHealth}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })()}

                        {/* Workload Categories */}
                        {asset.workloadCategories && asset.workloadCategories.length > 0 && (
                          <div className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-xl p-6 border border-purple-200 dark:border-purple-700">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-6 flex items-center gap-3">
                              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg">
                                <Tag className="w-5 h-5" />
                              </div>
                              Workload Categories
                            </h3>
                            <div className="flex flex-wrap gap-3">
                              {asset.workloadCategories.map((category, index) => (
                                <span
                                  key={category.id}
                                  className="inline-flex items-center px-4 py-2 rounded-xl text-sm font-semibold bg-white dark:bg-slate-800 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-700 shadow-sm hover:shadow-md transition-all duration-300"
                                >
                                  <div className="w-2 h-2 bg-purple-500 rounded-full mr-2" />
                                  {category.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Notes */}
                        {asset.notes && (
                          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                              <Package className="w-5 h-5 text-slate-600" />
                              Notes
                            </h3>
                            <p className="text-slate-700 dark:text-slate-300 leading-relaxed bg-white dark:bg-slate-700 p-4 rounded-lg">
                              {asset.notes}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Right Column - Assignment & Business Info */}
                      <div className="space-y-8">
                        {/* Assignment */}
                        {(asset.assignedTo || asset.assignedToStaff || asset.assignedToAadId) ? (
                          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-700">
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
                                <User className="w-4 h-4" />
                              </div>
                      Assigned To
                            </h3>
                  
                  {asset.assignedToStaff ? (
                              <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-blue-200 dark:border-blue-700">
                      <div className="flex items-start gap-3">
                        <ProfilePicture
                                    size="sm"
                          azureAdId={asset.assignedToStaff.id}
                          displayName={asset.assignedToStaff.displayName}
                          className="flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                                    <h4 className="font-semibold text-slate-900 dark:text-slate-100 truncate mb-1">
                              {asset.assignedToStaff.displayName}
                            </h4>
                          <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                            {asset.assignedToStaff.jobTitle || 'Employee'}
                          </p>
                          
                                    <div className="space-y-2 text-sm">
                            {asset.assignedToStaff.department && (
                              <div className="flex items-center gap-2">
                                          <Building className="w-3 h-3 text-slate-400" />
                                <span className="text-slate-900 dark:text-slate-100 font-medium">
                                  {asset.assignedToStaff.department}
                                </span>
                              </div>
                            )}
                            
                            {asset.assignedToStaff.officeLocation && (
                              <div className="flex items-center gap-2">
                                          <MapPin className="w-3 h-3 text-slate-400" />
                                <span className="text-slate-900 dark:text-slate-100 font-medium">
                                  {asset.assignedToStaff.officeLocation}
                                </span>
                              </div>
                            )}
                            
                            {asset.assignedToStaff.mail && (
                              <div className="flex items-center gap-2">
                                          <Mail className="w-3 h-3 text-slate-400" />
                                <a 
                                  href={`mailto:${asset.assignedToStaff.mail}`}
                                            className="text-blue-600 dark:text-blue-400 hover:underline truncate text-sm"
                                >
                                  {asset.assignedToStaff.mail}
                                </a>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : asset.assignedTo ? (
                              <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-blue-200 dark:border-blue-700">
                      <div className="flex items-start gap-3">
                        <ProfilePicture
                                    size="sm"
                          azureAdId={asset.assignedToAadId}
                          displayName={asset.assignedTo.displayName}
                          className="flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                                    <h4 className="font-semibold text-slate-900 dark:text-slate-100 truncate mb-1">
                              {asset.assignedTo.displayName}
                            </h4>
                          
                                    <div className="space-y-2 text-sm">
                            {asset.assignedTo.department && (
                              <div className="flex items-center gap-2">
                                          <Building className="w-3 h-3 text-slate-400" />
                                <span className="text-slate-900 dark:text-slate-100 font-medium">
                                  {asset.assignedTo.department}
                                </span>
                              </div>
                            )}
                            
                            <div className="flex items-center gap-2">
                                        <Mail className="w-3 h-3 text-slate-400" />
                              <a 
                                href={`mailto:${asset.assignedTo.email}`}
                                          className="text-blue-600 dark:text-blue-400 hover:underline truncate text-sm"
                              >
                                {asset.assignedTo.email}
                              </a>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : asset.assignedToAadId ? (
                              <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-blue-200 dark:border-blue-700">
                      <div className="flex items-center gap-3">
                                  <User className="w-6 h-6 text-slate-400" />
                        <div>
                          <h4 className="font-medium text-slate-900 dark:text-slate-100">
                            {asset.assignedToAadId}
                          </h4>
                          <p className="text-sm text-slate-500 dark:text-slate-400">
                            User (No additional details available)
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
                        ) : (
                          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
                            <div className="text-center py-8">
                              <div className="mx-auto w-12 h-12 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center mb-4">
                                <User className="w-6 h-6 text-slate-400" />
                              </div>
                              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">Unassigned</h3>
                              <p className="text-slate-600 dark:text-slate-400">This asset is not currently assigned to anyone</p>
                            </div>
                          </div>
                        )}

                        {/* Purchase & Warranty */}
                        {(asset.purchaseDate || asset.purchasePrice || asset.vendor || asset.warrantyEndDate) && (
                          <div className="bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 rounded-xl p-6 border border-emerald-200 dark:border-emerald-700">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-6 flex items-center gap-3">
                              <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg">
                                <DollarSign className="w-5 h-5" />
                              </div>
                              Purchase & Warranty
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {asset.purchaseDate && (
                                <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-emerald-200 dark:border-emerald-700">
                                  <div className="flex items-center gap-3 mb-2">
                                    <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Purchase Date</span>
                                  </div>
                                  <p className="text-slate-900 dark:text-slate-100 font-medium">{formatDate(asset.purchaseDate)}</p>
                                </div>
                              )}
                              {asset.purchasePrice && (
                                <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-emerald-200 dark:border-emerald-700">
                                  <div className="flex items-center gap-3 mb-2">
                                    <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Purchase Price</span>
                                  </div>
                                  <p className="text-slate-900 dark:text-slate-100 font-semibold text-lg">{formatCurrency(asset.purchasePrice)}</p>
                                </div>
                              )}
                              {asset.vendor && (
                                <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-emerald-200 dark:border-emerald-700">
                                  <div className="flex items-center gap-3 mb-2">
                                    <Building className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Vendor</span>
                                  </div>
                                  <p className="text-slate-900 dark:text-slate-100 font-medium">{asset.vendor.name}</p>
                                </div>
                              )}
                              {asset.warrantyEndDate && (
                                <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-emerald-200 dark:border-emerald-700">
                                  <div className="flex items-center gap-3 mb-2">
                                    <Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Warranty End</span>
                                  </div>
                                  <p className="text-slate-900 dark:text-slate-100 font-medium">{formatDate(asset.warrantyEndDate)}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Custom Fields */}
                        {customFields && customFields.length > 0 && (() => {
                          const hasCustomFieldValues = customFields.some(field => {
                            const value = getCustomFieldValue(field.id);
                            return value !== '—';
                          });
                          
                          if (!hasCustomFieldValues) return null;
                          
                          return (
                            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-xl p-6 border border-indigo-200 dark:border-indigo-700">
                              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-6 flex items-center gap-3">
                                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
                                  <Package className="w-5 h-5" />
                                </div>
                              Additional Attributes
                            </h3>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {customFields.map((field) => {
                                const value = getCustomFieldValue(field.id);
                                if (value === '—') return null;
                                return (
                                    <div key={field.id} className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-indigo-200 dark:border-indigo-700">
                                      <div className="flex items-center gap-3 mb-2">
                                        <Tag className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                                        <span className="text-sm font-medium text-slate-600 dark:text-slate-400">{field.name}</span>
                                      </div>
                                      <p className="text-slate-900 dark:text-slate-100 font-medium">{value}</p>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Activity History - Collapsible */}
                    <div className="mt-8 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                      <button
                        onClick={() => setShowActivityHistory(!showActivityHistory)}
                        className="w-full flex items-center justify-between p-6 text-left hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors rounded-xl"
                      >
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                          <Clock className="w-5 h-5 text-blue-600" />
                          Activity History
                          {activities && activities.length > 0 && (
                            <span className="ml-2 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded-full">
                              {activities.length}
                            </span>
                          )}
                        </h3>
                        {showActivityHistory ? (
                          <ChevronUp className="w-5 h-5 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-slate-400" />
                        )}
                      </button>
                      
                      {showActivityHistory && (
                        <div className="px-6 pb-6">
                          {activitiesLoading ? (
                            <div className="flex items-center justify-center py-8">
                              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600"></div>
                            </div>
                          ) : activities && activities.length > 0 ? (
                            <div className="space-y-3 max-h-64 overflow-y-auto">
                              {activities.map((activity: Activity) => (
                                <div key={activity.id} className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-600">
                                  <div className="flex items-center justify-between mb-2">
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
                            <p className="text-slate-500 dark:text-slate-400 text-sm py-4">
                              No activity history available.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-24">
                  <p className="text-slate-500 dark:text-slate-400">Asset not found.</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AssetDetailModal; 