import React, { useState, useEffect } from 'react';
import { X, Calendar, User, MapPin, Package, Clock, Edit, ChevronDown, ChevronUp, Monitor, Cpu, HardDrive, MemoryStick, Zap, Shield, DollarSign, Building, Tag, Mail, Phone, UserCheck, Laptop, Smartphone, Tablet, Activity, Settings, FileText, ExternalLink, Plus } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Tab } from '@headlessui/react';
import clsx from 'clsx';
import { assetsApi, activitiesApi, staffApi, type Asset as ApiAsset } from '../services/api';
import { useCustomFields } from '../hooks/useCustomFields';
import type { Activity as ActivityType } from '@ats/shared';
import { AssetSource } from '@shared/types/Asset';
import EditAsset from '../pages/EditAsset';
import SourceBadge from './SourceBadge';
import { useStore } from '../store';
import { acquireTokenSafely } from '../auth/msal';

interface AssetDetailViewProps {
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

    return () => {
      if (photoUrl) {
        URL.revokeObjectURL(photoUrl);
      }
    };
  }, [azureAdId, hasAttempted]);

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
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
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
          'rounded-full object-cover border-2 border-white shadow-sm flex-shrink-0 ring-1 ring-slate-200 dark:ring-slate-600',
          className
        )}
        onError={() => {
          console.log('Profile image failed to load for:', displayName);
        }}
      />
    );
  }

  return (
    <div className={clsx(
      sizeClasses[size],
      'bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 rounded-full flex items-center justify-center text-white font-medium flex-shrink-0 border-2 border-white shadow-sm ring-1 ring-slate-200 dark:ring-slate-600',
      className
    )}>
      <span className="select-none font-medium text-white">
        {getInitials(displayName)}
      </span>
    </div>
  );
};

const AssetDetailView: React.FC<AssetDetailViewProps> = ({
  assetId,
  isOpen,
  onClose,
  onEdit,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [selectedTab, setSelectedTab] = useState(0);
  const queryClient = useQueryClient();
  const { currentUser } = useStore();
  
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

  const truncateMiddle = (text: string, max = 60) => {
    if (!text) return '';
    if (text.length <= max) return text;
    const head = Math.ceil((max - 1) * 0.6);
    const tail = max - 1 - head;
    return text.slice(0, head) + '…' + text.slice(-tail);
  };

  const openInvoiceDocument = async (documentId: string) => {
    try {
      const apiScope = `api://${import.meta.env.VITE_AZURE_AD_CLIENT_ID}/access_as_user`;
      const token = (await acquireTokenSafely([apiScope])).accessToken;
      const base = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'http://localhost:4000/api').replace(/\/$/, '');
      const resp = await fetch(`${base}/invoice/file/${documentId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error(`Failed to fetch file (${resp.status})`);
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      console.error('Failed to open invoice document', e);
      alert('Unable to open invoice. Please ensure you are signed in and have ADMIN access.');
    }
  };

  if (!isOpen) return null;

  const handleEdit = () => {
    if (onEdit && asset) {
      onEdit(asset);
    } else {
      setIsEditing(true);
    }
  };

  const handleSaveEdit = (updatedAsset: ApiAsset) => {
    setIsEditing(false);
    queryClient.invalidateQueries({ queryKey: ['activities', 'ASSET', assetId] });
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'AVAILABLE':
        return 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700';
      case 'ASSIGNED':
        return 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700';
      case 'SPARE':
        return 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700';
      case 'MAINTENANCE':
        return 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-700';
      case 'RETIRED':
        return 'bg-slate-50 dark:bg-slate-700/20 text-slate-700 dark:text-slate-400 border-slate-200 dark:border-slate-600';
      default:
        return 'bg-slate-50 dark:bg-slate-700/20 text-slate-700 dark:text-slate-400 border-slate-200 dark:border-slate-600';
    }
  };

  const getConditionColor = (condition: string) => {
    switch (condition) {
      case 'NEW':
        return 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700';
      case 'GOOD':
        return 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700';
      case 'FAIR':
        return 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700';
      case 'POOR':
        return 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700';
      default:
        return 'bg-slate-50 dark:bg-slate-700/20 text-slate-700 dark:text-slate-400 border-slate-200 dark:border-slate-600';
    }
  };

  const getAssetTypeIcon = (type: string) => {
    switch (type) {
      case 'LAPTOP':
        return Laptop;
      case 'DESKTOP':
        return Monitor;
      case 'TABLET':
        return Tablet;
      case 'PHONE':
        return Smartphone;
      case 'OTHER':
      default:
        return Package;
    }
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return '—';
    
    try {
      const date = new Date(dateString);
      
      // Check if the date is valid
      if (isNaN(date.getTime())) {
        console.warn('Invalid date string:', dateString);
        return '—';
      }
      
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (error) {
      console.error('Error formatting date:', dateString, error);
      return '—';
    }
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

  const tabs = [
    { name: 'Overview', icon: Package },
    { name: 'Specifications', icon: Cpu },
    { name: 'Activity', icon: Activity },
    { name: 'Custom Fields', icon: Settings },
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-3">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative w-full max-w-6xl bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-h-[95vh] overflow-hidden border border-slate-200 dark:border-slate-700">
          {isEditing ? (
            <>
              {/* Edit Mode Header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Edit Asset
                </h2>
                <button
                  onClick={handleCancelEdit}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              {/* Edit Form */}
              <div className="p-5 overflow-y-auto max-h-[calc(95vh-60px)]">
                {asset ? (
                  <EditAsset
                    asset={asset}
                    onSave={handleSaveEdit}
                    onCancel={handleCancelEdit}
                    isModal={true}
                  />
                ) : (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600"></div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              {/* Header */}
              {assetLoading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
                </div>
              ) : asset ? (
                <>
                  {/* Compact Header */}
                  <div className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 px-5 py-4 border-b border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {/* Asset Icon */}
                        <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
                          {React.createElement(getAssetTypeIcon(asset.assetType), {
                            className: "w-5 h-5 text-slate-700 dark:text-slate-300"
                          })}
                        </div>
                        
                        {/* Asset Info */}
                        <div>
                          <div className="flex items-center gap-3 mb-1">
                            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                              {asset.assetTag}
                            </h1>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${getStatusColor(asset.status)}`}>
                              {asset.status}
                            </span>
                                                         {asset.source && <SourceBadge source={asset.source as AssetSource} size="lg" />}
                          </div>
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            {asset.make} {asset.model}
                          </p>
                        </div>
                      </div>
                      
                      {/* Action Buttons */}
                      <div className="flex items-center gap-2">
                        {/* Quick Actions */}
                        <div className="flex items-center gap-1 mr-2">
                          <button
                            title="Coming Soon"
                            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 cursor-not-allowed opacity-50"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                          <button
                            title="Coming Soon"
                            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 cursor-not-allowed opacity-50"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </button>
                        </div>
                        
                        <button
                          onClick={handleEdit}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-md transition-colors text-sm font-medium"
                        >
                          <Edit className="w-3.5 h-3.5" />
                          Edit
                        </button>
                        <button
                          onClick={onClose}
                          className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors rounded-md hover:bg-slate-200 dark:hover:bg-slate-700"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Tabs */}
                  <Tab.Group selectedIndex={selectedTab} onChange={setSelectedTab}>
                    <Tab.List className="flex border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                      {tabs.map((tab) => (
                        <Tab
                          key={tab.name}
                          className={({ selected }) =>
                            clsx(
                              'flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors focus:outline-none',
                              selected
                                ? 'text-brand-600 dark:text-brand-400 border-b-2 border-brand-600 dark:border-brand-400 bg-white dark:bg-slate-900'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/50'
                            )
                          }
                        >
                          <tab.icon className="w-4 h-4" />
                          {tab.name}
                        </Tab>
                      ))}
                    </Tab.List>

                    <Tab.Panels className="overflow-y-auto max-h-[calc(95vh-140px)]">
                      {/* Overview Tab */}
                      <Tab.Panel className="p-5">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                          {/* Asset Overview Card */}
                          <div className="lg:col-span-2">
                            <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                                <Package className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                Asset Overview
                              </h3>
                              {(() => {
                                const specs = parseSpecifications(asset.specifications);
                                
                                if (asset.assetType === 'PHONE') {
                                  // Phone-specific overview showing critical mobile device information
                                  return (
                                    <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                                      <div className="flex justify-between">
                                        <span className="text-slate-600 dark:text-slate-400">Asset Tag</span>
                                        <span className="font-mono text-slate-900 dark:text-slate-100 font-medium">{asset.assetTag}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-slate-600 dark:text-slate-400">Device</span>
                                        <span className="text-slate-900 dark:text-slate-100">{asset.make} {asset.model}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-slate-600 dark:text-slate-400">Storage</span>
                                        <span className="text-slate-900 dark:text-slate-100">{specs?.storage || '—'}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-slate-600 dark:text-slate-400">Carrier</span>
                                        <span className="text-slate-900 dark:text-slate-100">{specs?.carrier || '—'}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-slate-600 dark:text-slate-400">Phone Number</span>
                                        <span className="font-mono text-slate-900 dark:text-slate-100">{specs?.phoneNumber || '—'}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-slate-600 dark:text-slate-400">Plan Type</span>
                                        <span className="text-slate-900 dark:text-slate-100">{specs?.planType || '—'}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-slate-600 dark:text-slate-400">IMEI</span>
                                        <span className="font-mono text-slate-900 dark:text-slate-100">{specs?.imei || asset.serialNumber || '—'}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-slate-600 dark:text-slate-400">Condition</span>
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${getConditionColor(asset.condition)}`}>
                                          {asset.condition}
                                        </span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-slate-600 dark:text-slate-400">Contract End</span>
                                        <span className="text-slate-900 dark:text-slate-100">{specs?.contractEndDate ? formatDate(specs.contractEndDate) : '—'}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-slate-600 dark:text-slate-400">Location</span>
                                        <span className="text-slate-900 dark:text-slate-100">
                                          {asset.location ? `${asset.location.city}, ${asset.location.province}` : '—'}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                } else if (asset.assetType === 'LAPTOP' || asset.assetType === 'DESKTOP') {
                                  // Computer-specific overview showing critical hardware information
                                  return (
                                    <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                                      <div className="flex justify-between">
                                        <span className="text-slate-600 dark:text-slate-400">Asset Tag</span>
                                        <span className="font-mono text-slate-900 dark:text-slate-100 font-medium">{asset.assetTag}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-slate-600 dark:text-slate-400">Type</span>
                                        <span className="text-slate-900 dark:text-slate-100">{asset.assetType}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-slate-600 dark:text-slate-400">Device</span>
                                        <span className="text-slate-900 dark:text-slate-100">{asset.make} {asset.model}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-slate-600 dark:text-slate-400">Processor</span>
                                        <span className="text-slate-900 dark:text-slate-100">{specs?.processor || '—'}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-slate-600 dark:text-slate-400">RAM</span>
                                        <span className="text-slate-900 dark:text-slate-100">{specs?.ram || '—'}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-slate-600 dark:text-slate-400">Storage</span>
                                        <span className="text-slate-900 dark:text-slate-100">{specs?.storage || '—'}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-slate-600 dark:text-slate-400">Operating System</span>
                                        <span className="text-slate-900 dark:text-slate-100">{specs?.operatingSystem || '—'}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-slate-600 dark:text-slate-400">Serial Number</span>
                                        <span className="font-mono text-slate-900 dark:text-slate-100">{asset.serialNumber || '—'}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-slate-600 dark:text-slate-400">Condition</span>
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${getConditionColor(asset.condition)}`}>
                                          {asset.condition}
                                        </span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-slate-600 dark:text-slate-400">Location</span>
                                        <span className="text-slate-900 dark:text-slate-100">
                                          {asset.location ? `${asset.location.city}, ${asset.location.province}` : '—'}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                } else {
                                  // Generic overview for other asset types
                                  return (
                                    <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                                      <div className="flex justify-between">
                                        <span className="text-slate-600 dark:text-slate-400">Asset Tag</span>
                                        <span className="font-mono text-slate-900 dark:text-slate-100 font-medium">{asset.assetTag}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-slate-600 dark:text-slate-400">Type</span>
                                        <span className="text-slate-900 dark:text-slate-100">{asset.assetType}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-slate-600 dark:text-slate-400">Make</span>
                                        <span className="text-slate-900 dark:text-slate-100">{asset.make}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-slate-600 dark:text-slate-400">Model</span>
                                        <span className="text-slate-900 dark:text-slate-100">{asset.model}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-slate-600 dark:text-slate-400">Serial Number</span>
                                        <span className="font-mono text-slate-900 dark:text-slate-100">{asset.serialNumber || '—'}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-slate-600 dark:text-slate-400">Condition</span>
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${getConditionColor(asset.condition)}`}>
                                          {asset.condition}
                                        </span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-slate-600 dark:text-slate-400">Location</span>
                                        <span className="text-slate-900 dark:text-slate-100">
                                          {asset.location ? `${asset.location.city}, ${asset.location.province}` : '—'}
                                        </span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-slate-600 dark:text-slate-400">Vendor</span>
                                        <span className="text-slate-900 dark:text-slate-100">{asset.vendor?.name || '—'}</span>
                                      </div>
                                    </div>
                                  );
                                }
                              })()}
                              
                              {/* Workload Categories */}
                              {asset.workloadCategories && asset.workloadCategories.length > 0 && (
                                <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-600">
                                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2 block">Workload Categories</span>
                                  <div className="flex flex-wrap gap-1">
                                    {asset.workloadCategories.map((category) => (
                                      <span
                                        key={category.id}
                                        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-700"
                                      >
                                        {category.name}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Right Column */}
                          <div className="space-y-4">
                            {/* Assigned To Card */}
                            <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                                <User className="w-4 h-4 text-green-600 dark:text-green-400" />
                                Assigned To
                              </h3>
                                                             {asset.assignedToStaff ? (
                                 <div className="flex items-center gap-3">
                                   <ProfilePicture
                                     azureAdId={asset.assignedToStaff.id}
                                     displayName={asset.assignedToStaff.displayName}
                                     size="md"
                                   />
                                   <div className="min-w-0 flex-1">
                                     <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                                       {asset.assignedToStaff.displayName}
                                     </p>
                                     <p className="text-xs text-slate-600 dark:text-slate-400 truncate">
                                       {asset.assignedToStaff.jobTitle || 'No title'}
                                     </p>
                                     <p className="text-xs text-slate-500 dark:text-slate-500 truncate">
                                       {asset.assignedToStaff.department || 'No department'}
                                     </p>
                                   </div>
                                 </div>
                               ) : (
                                <div className="text-center py-3">
                                  <UserCheck className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                                  <p className="text-sm text-slate-500 dark:text-slate-400">Unassigned</p>
                                </div>
                              )}
                            </div>

                            {/* Purchase & Warranty Card */}
                            <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                                <DollarSign className="w-4 h-4 text-green-600 dark:text-green-400" />
                                Purchase & Warranty
                              </h3>
                              <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-slate-600 dark:text-slate-400">Purchase Date</span>
                                  <span className="text-slate-900 dark:text-slate-100">{formatDate(asset.purchaseDate)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-600 dark:text-slate-400">Purchase Price</span>
                                  <span className="text-slate-900 dark:text-slate-100">{formatCurrency(asset.purchasePrice)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-600 dark:text-slate-400">Warranty End</span>
                                  <span className="text-slate-900 dark:text-slate-100">{formatDate(asset.warrantyEndDate)}</span>
                                </div>
                              </div>
                            </div>

                            {/* Original Invoice (Admin only) */}
                            {currentUser?.role === 'ADMIN' && asset.source === 'INVOICE' && asset.documents && asset.documents.length > 0 && (
                              <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                                  <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                  Original Invoice
                                </h3>
                                <div className="space-y-2 text-sm">
                                  {asset.documents.map((doc) => (
                                    <button
                                      key={doc.document.id}
                                      onClick={() => openInvoiceDocument(doc.document.id)}
                                      className="inline-flex items-center gap-2 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-medium max-w-full"
                                    >
                                      <FileText className="w-3 h-3 shrink-0" />
                                      <span className="truncate max-w-[22rem] md:max-w-[28rem] lg:max-w-[34rem]">
                                        {truncateMiddle(doc.document.fileName, 60)}
                                      </span>
                                      <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0">{`(${(doc.document.fileSize / 1024 / 1024).toFixed(1)} MB)`}</span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </Tab.Panel>

                      {/* Specifications Tab */}
                      <Tab.Panel className="p-5">
                        {(() => {
                          const specs = parseSpecifications(asset.specifications);
                          if (!specs || Object.keys(specs).length === 0) {
                            return (
                              <div className="text-center py-12">
                                <Cpu className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                                <p className="text-slate-500 dark:text-slate-400">No technical specifications available</p>
                              </div>
                            );
                          }

                          // Different layouts for different asset types
                          if (asset.assetType === 'PHONE') {
                            return (
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {/* Technical Identifiers */}
                                {(specs.imei || asset.serialNumber) && (
                                  <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                                    <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                                      <Tag className="w-4 h-4 text-blue-600" />
                                      IMEI / Serial
                                    </h4>
                                    <p className="text-sm text-slate-900 dark:text-slate-100 font-mono">{specs.imei || asset.serialNumber}</p>
                                  </div>
                                )}

                                {/* Service Information */}
                                {specs.phoneNumber && (
                                  <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                                    <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                                      <Phone className="w-4 h-4 text-green-600" />
                                      Phone Number
                                    </h4>
                                    <p className="text-sm text-slate-900 dark:text-slate-100 font-mono">{specs.phoneNumber}</p>
                                  </div>
                                )}

                                {specs.carrier && (
                                  <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                                    <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                                      <Building className="w-4 h-4 text-purple-600" />
                                      Carrier
                                    </h4>
                                    <p className="text-sm text-slate-900 dark:text-slate-100">{specs.carrier}</p>
                                  </div>
                                )}

                                {specs.planType && (
                                  <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                                    <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                                      <Settings className="w-4 h-4 text-indigo-600" />
                                      Plan Type
                                    </h4>
                                    <p className="text-sm text-slate-900 dark:text-slate-100">{specs.planType}</p>
                                  </div>
                                )}

                                {/* Hardware Specifications */}
                                {specs.storage && (
                                  <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                                    <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                                      <HardDrive className="w-4 h-4 text-orange-600" />
                                      Storage Capacity
                                    </h4>
                                    <p className="text-sm text-slate-900 dark:text-slate-100">{specs.storage}</p>
                                  </div>
                                )}

                                {specs.operatingSystem && (
                                  <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                                    <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                                      <Smartphone className="w-4 h-4 text-blue-600" />
                                      Operating System
                                    </h4>
                                    <p className="text-sm text-slate-900 dark:text-slate-100">{specs.operatingSystem}</p>
                                  </div>
                                )}

                                {/* Contract & Financial */}
                                {specs.contractEndDate && (
                                  <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                                    <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                                      <Calendar className="w-4 h-4 text-red-600" />
                                      Contract End Date
                                    </h4>
                                    <p className="text-sm text-slate-900 dark:text-slate-100">{formatDate(specs.contractEndDate)}</p>
                                  </div>
                                )}

                                {specs.balance && (
                                  <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                                    <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                                      <DollarSign className="w-4 h-4 text-green-600" />
                                      Account Balance
                                    </h4>
                                    <p className="text-sm text-slate-900 dark:text-slate-100">{formatCurrency(specs.balance)}</p>
                                  </div>
                                )}

                                {/* Network & Technical Details */}
                                {specs.networkType && (
                                  <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                                    <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                                      <Zap className="w-4 h-4 text-yellow-600" />
                                      Network Type
                                    </h4>
                                    <p className="text-sm text-slate-900 dark:text-slate-100">{specs.networkType}</p>
                                  </div>
                                )}

                                {specs.simSerialNumber && (
                                  <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                                    <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                                      <Shield className="w-4 h-4 text-cyan-600" />
                                      SIM Serial Number
                                    </h4>
                                    <p className="text-sm text-slate-900 dark:text-slate-100 font-mono">{specs.simSerialNumber}</p>
                                  </div>
                                )}

                                {/* Device Variant/Color */}
                                {specs.deviceColor && (
                                  <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                                    <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                                      <Package className="w-4 h-4 text-pink-600" />
                                      Device Color
                                    </h4>
                                    <p className="text-sm text-slate-900 dark:text-slate-100">{specs.deviceColor}</p>
                                  </div>
                                )}

                                {/* Last Online (for phones that report this) */}
                                {specs.lastOnline && (
                                  <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                                    <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                                      <Clock className="w-4 h-4 text-gray-600" />
                                      Last Seen
                                    </h4>
                                    <p className="text-sm text-slate-900 dark:text-slate-100">{formatDate(specs.lastOnline)}</p>
                                  </div>
                                )}
                              </div>
                            );
                          } else {
                            // Computer specifications (Laptop/Desktop)
                            return (
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {specs.processor && (
                                  <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                                    <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                                      <Cpu className="w-4 h-4 text-blue-600" />
                                      Processor
                                    </h4>
                                    <p className="text-sm text-slate-900 dark:text-slate-100">{specs.processor}</p>
                                  </div>
                                )}
                                {specs.ram && (
                                  <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                                    <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                                      <MemoryStick className="w-4 h-4 text-green-600" />
                                      Memory
                                    </h4>
                                    <p className="text-sm text-slate-900 dark:text-slate-100">{specs.ram}</p>
                                  </div>
                                )}
                                {specs.storage && (
                                  <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                                    <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                                      <HardDrive className="w-4 h-4 text-orange-600" />
                                      Storage
                                    </h4>
                                    <p className="text-sm text-slate-900 dark:text-slate-100">{specs.storage}</p>
                                  </div>
                                )}
                                {specs.operatingSystem && (
                                  <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                                    <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                                      <Monitor className="w-4 h-4 text-purple-600" />
                                      Operating System
                                    </h4>
                                    <p className="text-sm text-slate-900 dark:text-slate-100">{specs.operatingSystem}</p>
                                  </div>
                                )}
                                {specs.graphicsCard && (
                                  <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                                    <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                                      <Zap className="w-4 h-4 text-yellow-600" />
                                      Graphics Card
                                    </h4>
                                    <p className="text-sm text-slate-900 dark:text-slate-100">{specs.graphicsCard}</p>
                                  </div>
                                )}
                                {specs.screenSize && (
                                  <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                                    <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                                      <Monitor className="w-4 h-4 text-indigo-600" />
                                      Screen Size
                                    </h4>
                                    <p className="text-sm text-slate-900 dark:text-slate-100">{specs.screenSize}</p>
                                  </div>
                                )}
                              </div>
                            );
                          }
                        })()}
                      </Tab.Panel>

                      {/* Activity Tab */}
                      <Tab.Panel className="p-5">
                        {activitiesLoading ? (
                          <div className="flex items-center justify-center py-12">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600"></div>
                          </div>
                        ) : activities && activities.length > 0 ? (
                          <div className="space-y-3">
                            {activities.map((activity) => (
                              <div key={activity.id} className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                                <div className="flex items-start gap-3">
                                  <div className="p-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg flex-shrink-0">
                                    <Activity className="w-3.5 h-3.5" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-1">
                                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                        {activity.action}
                                      </p>
                                                                             <time className="text-xs text-slate-500 dark:text-slate-400">
                                         {formatDate(activity.createdAt)}
                                       </time>
                                     </div>
                                     {activity.details && (
                                       <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                                         {activity.details}
                                       </p>
                                     )}
                                    <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                                      <span>By {activity.userId}</span>
                                      <span>•</span>
                                      <span>{activity.entityType}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-12">
                            <Activity className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                            <p className="text-slate-500 dark:text-slate-400">No activity history available</p>
                          </div>
                        )}
                      </Tab.Panel>

                      {/* Custom Fields Tab */}
                      <Tab.Panel className="p-5">
                        {customFields && customFields.length > 0 ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {customFields.map((field) => (
                              <div key={field.id} className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                                <div className="flex items-center gap-2 mb-2">
                                  <Settings className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                                                                     <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                     {field.name}
                                   </h4>
                                </div>
                                <p className="text-sm text-slate-900 dark:text-slate-100">
                                  {getCustomFieldValue(field.id)}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                  {field.fieldType}
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-12">
                            <Settings className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                            <p className="text-slate-500 dark:text-slate-400">No custom fields configured</p>
                          </div>
                        )}
                      </Tab.Panel>
                    </Tab.Panels>
                  </Tab.Group>
                </>
              ) : (
                <div className="text-center py-20">
                  <p className="text-slate-500 dark:text-slate-400">Asset not found</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AssetDetailView; 