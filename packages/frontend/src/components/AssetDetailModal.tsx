import React, { useState, useEffect } from 'react';
import { X, Calendar, User, MapPin, Package, Clock, Edit, ChevronDown, ChevronUp, Monitor, Cpu, HardDrive, MemoryStick, Zap, Shield, DollarSign, Building, Tag, Mail, Phone, UserCheck } from 'lucide-react';
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
        return Monitor;
      case 'DESKTOP':
        return Cpu;
      default:
        return Package;
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
                  <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 p-8 border-b border-slate-200 dark:border-slate-700">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-6">
                        {/* Asset Icon */}
                        <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700">
                          {React.createElement(getAssetTypeIcon(asset.assetType), {
                            className: "w-8 h-8 text-slate-700 dark:text-slate-300"
                          })}
                        </div>
                        
                        {/* Asset Info */}
                        <div>
                          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                            {asset.assetTag}
                          </h1>
                          <p className="text-xl text-slate-600 dark:text-slate-400 mb-4">
                            {asset.make} {asset.model}
                          </p>
                          
                          {/* Status Badges */}
                          <div className="flex gap-3">
                            <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium border ${getStatusColor(asset.status)}`}>
                              {asset.status}
                            </span>
                            <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium border ${getConditionColor(asset.condition)}`}>
                              {asset.condition}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Action Buttons */}
                      <div className="flex items-center gap-3">
                        <button
                          onClick={handleEdit}
                          className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl transition-colors shadow-lg"
                        >
                          <Edit className="w-4 h-4" />
                          Edit Asset
                        </button>
                        <button
                          onClick={onClose}
                          className="p-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors rounded-xl hover:bg-white dark:hover:bg-slate-700"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-8 overflow-y-auto max-h-[calc(95vh-200px)]">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      {/* Left Column */}
                      <div className="space-y-8">
                        {/* Assignment */}
              {(asset.assignedTo || asset.assignedToStaff || asset.assignedToAadId) && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-slate-500" />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Assigned To
                    </span>
                  </div>
                  
                  {asset.assignedToStaff ? (
                    <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <ProfilePicture
                          size="md"
                          azureAdId={asset.assignedToStaff.id}
                          displayName={asset.assignedToStaff.displayName}
                          className="flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium text-slate-900 dark:text-slate-100 truncate">
                              {asset.assignedToStaff.displayName}
                            </h4>
                          </div>
                          <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                            {asset.assignedToStaff.jobTitle || 'Employee'}
                          </p>
                          
                          <div className="grid grid-cols-1 gap-3 text-sm">
                            {asset.assignedToStaff.department && (
                              <div className="flex items-center gap-2">
                                <Building className="w-4 h-4 text-slate-400" />
                                <span className="text-slate-600 dark:text-slate-400">Department:</span>
                                <span className="text-slate-900 dark:text-slate-100 font-medium">
                                  {asset.assignedToStaff.department}
                                </span>
                              </div>
                            )}
                            
                            {asset.assignedToStaff.officeLocation && (
                              <div className="flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-slate-400" />
                                <span className="text-slate-600 dark:text-slate-400">Location:</span>
                                <span className="text-slate-900 dark:text-slate-100 font-medium">
                                  {asset.assignedToStaff.officeLocation}
                                </span>
                              </div>
                            )}
                            
                            {asset.assignedToStaff.mail && (
                              <div className="flex items-center gap-2">
                                <Mail className="w-4 h-4 text-slate-400" />
                                <a 
                                  href={`mailto:${asset.assignedToStaff.mail}`}
                                  className="text-brand-600 dark:text-brand-400 hover:underline truncate"
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
                    <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <ProfilePicture
                          size="md"
                          azureAdId={asset.assignedToAadId}
                          displayName={asset.assignedTo.displayName}
                          className="flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium text-slate-900 dark:text-slate-100 truncate">
                              {asset.assignedTo.displayName}
                            </h4>
                          </div>
                          
                          <div className="grid grid-cols-1 gap-3 text-sm">
                            {asset.assignedTo.department && (
                              <div className="flex items-center gap-2">
                                <Building className="w-4 h-4 text-slate-400" />
                                <span className="text-slate-600 dark:text-slate-400">Department:</span>
                                <span className="text-slate-900 dark:text-slate-100 font-medium">
                                  {asset.assignedTo.department}
                                </span>
                              </div>
                            )}
                            
                            <div className="flex items-center gap-2">
                              <Mail className="w-4 h-4 text-slate-400" />
                              <a 
                                href={`mailto:${asset.assignedTo.email}`}
                                className="text-brand-600 dark:text-brand-400 hover:underline truncate"
                              >
                                {asset.assignedTo.email}
                              </a>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : asset.assignedToAadId ? (
                    <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4">
                      <div className="flex items-center gap-3">
                        <User className="w-8 h-8 text-slate-400" />
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
              )}

                        {/* Workload Categories */}
                        {asset.workloadCategories && asset.workloadCategories.length > 0 && (
                          <div className="relative bg-gradient-to-br from-purple-50/50 via-pink-50/30 to-indigo-50/20 dark:from-purple-900/10 dark:via-pink-900/10 dark:to-indigo-900/5 rounded-xl p-6 border border-purple-200/50 dark:border-purple-700/50 shadow-sm hover:shadow-md transition-all duration-300 group">
                            <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                            
                            <h3 className="relative text-lg font-semibold text-slate-900 dark:text-slate-100 mb-5 flex items-center gap-3">
                              <div className="p-2.5 bg-gradient-to-br from-purple-100 to-purple-200 dark:from-purple-900/30 dark:to-purple-800/30 rounded-xl shadow-sm group-hover:scale-110 transition-transform duration-300">
                                <Tag className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                              </div>
                              <span className="bg-gradient-to-r from-purple-600 to-pink-600 dark:from-purple-400 dark:to-pink-400 bg-clip-text text-transparent">
                                Workload Categories
                              </span>
                            </h3>
                            <div className="relative flex flex-wrap gap-3">
                              {asset.workloadCategories.map((category, index) => (
                                <span
                                  key={category.id}
                                  className="inline-flex items-center px-4 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-purple-100 to-purple-200 dark:from-purple-900/30 dark:to-purple-800/30 text-purple-700 dark:text-purple-300 border border-purple-200/50 dark:border-purple-700/50 shadow-sm hover:shadow-md hover:scale-105 transition-all duration-300"
                                  style={{
                                    animationDelay: `${index * 100}ms`,
                                  }}
                                >
                                  <div className="w-2 h-2 bg-purple-500 rounded-full mr-2 animate-pulse" />
                                  {category.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Specifications */}
                        {(() => {
                          const specs = parseSpecifications(asset.specifications);
                          if (!specs && !asset.serialNumber) return null;
                          
                          return (
                            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
                              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                                <Cpu className="w-5 h-5 text-orange-600" />
                                Technical Specifications
                              </h3>
                              <div className="grid grid-cols-1 gap-4">
                                {asset.source && (
                                  <div className="flex items-center justify-between py-2 border-b border-slate-200 dark:border-slate-600 last:border-0">
                                    <span className="text-slate-600 dark:text-slate-400">Source</span>
                                    <SourceBadge source={asset.source} size="sm" />
                                  </div>
                                )}
                                {asset.serialNumber && (
                                  <div className="flex items-center justify-between py-2 border-b border-slate-200 dark:border-slate-600 last:border-0">
                                    <span className="text-slate-600 dark:text-slate-400">Serial Number</span>
                                    <span className="font-mono text-slate-900 dark:text-slate-100">{asset.serialNumber}</span>
                                  </div>
                                )}
                                {specs?.processor && (
                                  <div className="flex items-center justify-between py-2 border-b border-slate-200 dark:border-slate-600 last:border-0">
                                    <span className="text-slate-600 dark:text-slate-400">Processor</span>
                                    <span className="text-slate-900 dark:text-slate-100">{specs.processor}</span>
                                  </div>
                                )}
                                {specs?.ram && (
                                  <div className="flex items-center justify-between py-2 border-b border-slate-200 dark:border-slate-600 last:border-0">
                                    <span className="text-slate-600 dark:text-slate-400">Memory</span>
                                    <span className="text-slate-900 dark:text-slate-100">{specs.ram}</span>
                                  </div>
                                )}
                                {specs?.storage && (
                                  <div className="flex items-center justify-between py-2 border-b border-slate-200 dark:border-slate-600 last:border-0">
                                    <span className="text-slate-600 dark:text-slate-400">Storage</span>
                                    <span className="text-slate-900 dark:text-slate-100">{specs.storage}</span>
                                  </div>
                                )}
                                {specs?.operatingSystem && (
                                  <div className="flex items-center justify-between py-2 border-b border-slate-200 dark:border-slate-600 last:border-0">
                                    <span className="text-slate-600 dark:text-slate-400">Operating System</span>
                                    <span className="text-slate-900 dark:text-slate-100">{specs.operatingSystem}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })()}

                        {/* Location */}
                        {asset.location && (
                          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                              <MapPin className="w-5 h-5 text-green-600" />
                              Location
                            </h3>
                            <p className="text-slate-900 dark:text-slate-100">
                              {asset.location.city}, {asset.location.province}, {asset.location.country}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Right Column */}
                      <div className="space-y-8">
                        {/* Purchase & Warranty */}
                        {(asset.purchaseDate || asset.purchasePrice || asset.vendor || asset.warrantyEndDate) && (
                          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                              <DollarSign className="w-5 h-5 text-emerald-600" />
                              Purchase & Warranty
                            </h3>
                            <div className="space-y-4">
                              {asset.purchaseDate && (
                                <div className="flex items-center justify-between py-2 border-b border-slate-200 dark:border-slate-600 last:border-0">
                                  <span className="text-slate-600 dark:text-slate-400">Purchase Date</span>
                                  <span className="text-slate-900 dark:text-slate-100">{formatDate(asset.purchaseDate)}</span>
                                </div>
                              )}
                              {asset.purchasePrice && (
                                <div className="flex items-center justify-between py-2 border-b border-slate-200 dark:border-slate-600 last:border-0">
                                  <span className="text-slate-600 dark:text-slate-400">Purchase Price</span>
                                  <span className="text-slate-900 dark:text-slate-100 font-semibold">{formatCurrency(asset.purchasePrice)}</span>
                                </div>
                              )}
                              {asset.vendor && (
                                <div className="flex items-center justify-between py-2 border-b border-slate-200 dark:border-slate-600 last:border-0">
                                  <span className="text-slate-600 dark:text-slate-400">Vendor</span>
                                  <span className="text-slate-900 dark:text-slate-100">{asset.vendor.name}</span>
                                </div>
                              )}
                              {asset.warrantyEndDate && (
                                <div className="flex items-center justify-between py-2 border-b border-slate-200 dark:border-slate-600 last:border-0">
                                  <span className="text-slate-600 dark:text-slate-400">Warranty End</span>
                                  <span className="text-slate-900 dark:text-slate-100">{formatDate(asset.warrantyEndDate)}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Custom Fields */}
                        {customFields && customFields.length > 0 && (
                          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                              <Package className="w-5 h-5 text-indigo-600" />
                              Additional Attributes
                            </h3>
                            <div className="space-y-4">
                              {customFields.map((field) => {
                                const value = getCustomFieldValue(field.id);
                                if (value === '—') return null;
                                return (
                                  <div key={field.id} className="flex items-center justify-between py-2 border-b border-slate-200 dark:border-slate-600 last:border-0">
                                    <span className="text-slate-600 dark:text-slate-400">{field.name}</span>
                                    <span className="text-slate-900 dark:text-slate-100">{value}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Notes */}
                        {asset.notes && (
                          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
                              Notes
                            </h3>
                            <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                              {asset.notes}
                            </p>
                          </div>
                        )}
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