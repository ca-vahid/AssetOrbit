import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { 
  Plus, Search, Eye, X, Trash2, AlertTriangle, 
  Monitor, Users, MapPin, Calendar, MoreHorizontal,
  Edit, CheckCircle, XCircle, Clock, Settings,
  Laptop, Smartphone, Tablet, Monitor as Desktop
} from 'lucide-react';
import { assetsApi, usersApi, customFieldsApi } from '../services/api';
import AssetDetailModal from '../components/AssetDetailModal';
import AssetFilterPanel from '../components/AssetFilterPanel';
import { useDebounce } from '../hooks/useDebounce';
import ProfilePicture from '../components/ProfilePicture';
import { useStore } from '../store';
import * as Tooltip from '@radix-ui/react-tooltip';

// Asset type configurations
const ASSET_TYPES = {
  LAPTOP: { label: 'Laptops', icon: Laptop, emoji: '💻' },
  DESKTOP: { label: 'Desktops', icon: Desktop, emoji: '🖥️' },
  TABLET: { label: 'Tablets', icon: Tablet, emoji: '📱' },
  PHONE: { label: 'Phones', icon: Smartphone, emoji: '📱' },
  OTHER: { label: 'Other', icon: Monitor, emoji: '📦' },
} as const;

// Status configurations with compact labels
const STATUS_CONFIG = {
  AVAILABLE: { label: 'Available', short: 'AVL', color: 'green', dot: '🟢' },
  ASSIGNED: { label: 'Assigned', short: 'ASN', color: 'blue', dot: '🔵' },
  SPARE: { label: 'Spare', short: 'SPR', color: 'orange', dot: '🟠' },
  RETIRED: { label: 'Retired', short: 'RET', color: 'red', dot: '🔴' },
  MAINTENANCE: { label: 'Maintenance', short: 'MNT', color: 'yellow', dot: '🟡' },
} as const;

interface AssetFilters {
  assignedTo?: string;
  status?: string;
  condition?: string;
  assetType?: string;
  departmentId?: string;
  locationId?: string;
  dateFrom?: string;
  dateTo?: string;
  [key: string]: string | undefined; // dynamic custom-field filters cf_<id>
}

// Helper functions for asset-specific specifications
const parseSpecifications = (specifications?: any) => {
  if (!specifications) return {};
  if (typeof specifications === 'string') {
    try {
      return JSON.parse(specifications);
    } catch {
      return {};
    }
  }
  return specifications;
};

const getAssetSpecColumns = (assetType: string) => {
  switch (assetType) {
    case 'LAPTOP':
    case 'DESKTOP':
      return [
        { key: 'processor', label: 'CPU', width: 'w-32' },
        { key: 'ram', label: 'RAM', width: 'w-20' },
        { key: 'storage', label: 'Storage', width: 'w-24' },
        { key: 'operatingSystem', label: 'OS', width: 'w-24' },
      ];
    case 'TABLET':
    case 'PHONE':
      return [
        { key: 'operatingSystem', label: 'OS', width: 'w-20' },
        { key: 'storage', label: 'Capacity', width: 'w-24' },
        { key: 'imei', label: 'IMEI', width: 'w-32' },
        { key: 'carrier', label: 'Carrier', width: 'w-24' },
        { key: 'phoneNumber', label: 'Phone #', width: 'w-28' },
      ];
    default:
      return [];
  }
};

const shouldShowSpecColumns = (currentFilter?: string) => {
  return currentFilter && currentFilter !== 'OTHER';
};

const AssetList: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<AssetFilters>({});
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [deleteConfirmAsset, setDeleteConfirmAsset] = useState<{ id: string; tag: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Debounce search input
  const debouncedSearch = useDebounce(search, 300);

  const queryClient = useQueryClient();

  const { data: currentUser } = useQuery({
    queryKey: ['me'],
    queryFn: () => usersApi.getMe(),
  });

  // Fetch custom field definitions for chip labels
  const { data: customFields } = useQuery({
    queryKey: ['custom-fields'],
    queryFn: () => customFieldsApi.getAll(),
  });

  const customFieldMap = React.useMemo(() => {
    const map: Record<string, any> = {};
    customFields?.forEach((f) => (map[f.id] = f));
    return map;
  }, [customFields]);

  // Initialize state from URL params on mount
  useEffect(() => {
    const urlSearch = searchParams.get('search') || '';
    const urlPage = parseInt(searchParams.get('page') || '1');
    
    // Extract filter parameters
    const urlFilters: AssetFilters = {};
    searchParams.forEach((value, key) => {
      if (key !== 'search' && key !== 'page') {
        urlFilters[key] = value;
      }
    });

    setSearch(urlSearch);
    setPage(urlPage);
    setFilters(urlFilters);
  }, []); // Only run on mount

  // Update URL when filters change
  useEffect(() => {
    const newParams = new URLSearchParams();
    
    if (debouncedSearch) newParams.set('search', debouncedSearch);
    if (page > 1) newParams.set('page', page.toString());
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value) newParams.set(key, value);
    });

    setSearchParams(newParams, { replace: true });
  }, [debouncedSearch, page, filters, setSearchParams]);

  // Build query parameters
  const queryParams = {
    page,
    limit: 50,
    search: debouncedSearch,
    ...filters,
  };

  const { data: assetsData, isLoading } = useQuery({
    queryKey: ['assets', queryParams],
    queryFn: () => assetsApi.getAll(queryParams),
  });

  const assets = assetsData?.data || [];
  const pagination = assetsData?.pagination;

  // Filter management functions
  const updateFilter = (key: keyof AssetFilters, value: string | undefined) => {
    setFilters(prev => {
      const newFilters = { ...prev };
      if (value) {
        newFilters[key] = value;
      } else {
        delete newFilters[key];
      }
      return newFilters;
    });
    setPage(1); // Reset to first page when filters change
  };

  const clearFilter = (key: keyof AssetFilters) => {
    updateFilter(key, undefined);
  };

  const clearAllFilters = () => {
    setFilters({});
    setSearch('');
    setPage(1);
  };

  const handleFiltersChange = (newFilters: AssetFilters) => {
    setFilters(newFilters);
    setPage(1); // Reset to first page when filters change
  };

  const handleDeleteAsset = async () => {
    if (!deleteConfirmAsset) return;
    
    setIsDeleting(true);
    try {
      await assetsApi.delete(deleteConfirmAsset.id);
      // Refresh the assets list
      await queryClient.invalidateQueries({ queryKey: ['assets'] });
      setDeleteConfirmAsset(null);
    } catch (error) {
      console.error('Failed to delete asset:', error);
      alert('Failed to delete asset. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Get active filter count
  const activeFilterCount = Object.keys(filters).length;

  // Helper function to get display label for filter values
  const getFilterDisplayLabel = (key: keyof AssetFilters, value: string): string => {
    switch (key) {
      case 'status':
        return value.charAt(0) + value.slice(1).toLowerCase();
      case 'condition':
        return value.charAt(0) + value.slice(1).toLowerCase();
      case 'assetType':
        return value.charAt(0) + value.slice(1).toLowerCase();
      case 'assignedTo':
        return 'Assigned User';
      case 'departmentId':
        return 'Department';
      case 'locationId':
        return 'Location';
      case 'dateFrom':
        return `From: ${value}`;
      case 'dateTo':
        return `To: ${value}`;
      case undefined:
        return value;
      case 'boolean':
        return value === 'true' ? 'Yes' : value === 'false' ? 'No' : value;
      default:
        return value;
    }
  };

  // Calculate statistics - smart stats based on current filters
  const stats = useMemo(() => {
    const currentTypeFilter = filters.assetType;
    const filteredAssets = currentTypeFilter 
      ? assets.filter(a => a.assetType === currentTypeFilter)
      : assets;
    
    // Asset type counts (for top row)
    const assetTypeCounts = Object.keys(ASSET_TYPES).reduce((acc, type) => {
      acc[type] = assets.filter(a => a.assetType === type).length;
      return acc;
    }, {} as Record<string, number>);
    
    // Status counts for current filter (for bottom row)
    const total = filteredAssets.length;
    const available = filteredAssets.filter(a => a.status === 'AVAILABLE').length;
    const assigned = filteredAssets.filter(a => a.status === 'ASSIGNED').length;
    const spare = filteredAssets.filter(a => a.status === 'SPARE').length;
    const retired = filteredAssets.filter(a => a.status === 'RETIRED').length;
    
    return { 
      assetTypeCounts,
      statusCounts: { total, available, assigned, spare, retired },
      currentFilter: currentTypeFilter
    };
  }, [assets, filters.assetType]);

  const [selectedAssets, setSelectedAssets] = useState<string[]>([]);
  const [showBulkActions, setShowBulkActions] = useState(false);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedAssets(assets.map(asset => asset.id));
    } else {
      setSelectedAssets([]);
    }
  };

  const handleSelectAsset = (assetId: string, checked: boolean) => {
    if (checked) {
      setSelectedAssets(prev => [...prev, assetId]);
    } else {
      setSelectedAssets(prev => prev.filter(id => id !== assetId));
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
            Assets
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Manage your organization's assets inventory
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/assets/new"
            className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-all duration-200 shadow-sm hover:shadow-md"
          >
            <Plus className="w-4 h-4" />
            Add Asset
          </Link>
        </div>
      </div>

      {/* Statistics Cards - Two Row Design */}
      <div className="space-y-4">
        {/* Asset Type Counts - Top Row */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Monitor className="h-6 w-6 text-slate-600 dark:text-slate-400" />
              </div>
              <div className="ml-3">
                <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Total Assets</p>
                <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{pagination?.total || 0}</p>
              </div>
            </div>
          </div>

          {Object.entries(ASSET_TYPES).map(([type, config]) => {
            const IconComponent = config.icon;
            const count = stats.assetTypeCounts[type] || 0;
            const isActive = filters.assetType === type;
            
            return (
              <button
                key={type}
                onClick={() => updateFilter('assetType', isActive ? undefined : type)}
                className={`bg-white dark:bg-slate-800 rounded-xl shadow-sm border transition-all duration-200 p-4 text-left hover:shadow-md ${
                  isActive 
                    ? 'border-brand-500 ring-2 ring-brand-500/20 bg-brand-50 dark:bg-brand-900/20' 
                    : 'border-slate-200 dark:border-slate-700 hover:border-brand-300'
                }`}
              >
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <IconComponent className={`h-5 w-5 ${isActive ? 'text-brand-600 dark:text-brand-400' : 'text-slate-600 dark:text-slate-400'}`} />
                  </div>
                  <div className="ml-3">
                    <p className={`text-xs font-medium ${isActive ? 'text-brand-700 dark:text-brand-300' : 'text-slate-600 dark:text-slate-400'}`}>
                      {config.label}
                    </p>
                    <p className={`text-lg font-bold ${isActive ? 'text-brand-900 dark:text-brand-100' : 'text-slate-900 dark:text-slate-100'}`}>
                      {count}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Status Counts - Bottom Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div className="ml-3">
                <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  Available{stats.currentFilter ? ` (${ASSET_TYPES[stats.currentFilter as keyof typeof ASSET_TYPES]?.label})` : ''}
                </p>
                <p className="text-xl font-bold text-green-600 dark:text-green-400">{stats.statusCounts.available}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="ml-3">
                <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  Assigned{stats.currentFilter ? ` (${ASSET_TYPES[stats.currentFilter as keyof typeof ASSET_TYPES]?.label})` : ''}
                </p>
                <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{stats.statusCounts.assigned}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Settings className="h-6 w-6 text-orange-600 dark:text-orange-400" />
              </div>
              <div className="ml-3">
                <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  Spare{stats.currentFilter ? ` (${ASSET_TYPES[stats.currentFilter as keyof typeof ASSET_TYPES]?.label})` : ''}
                </p>
                <p className="text-xl font-bold text-orange-600 dark:text-orange-400">{stats.statusCounts.spare}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <XCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <div className="ml-3">
                <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  Retired{stats.currentFilter ? ` (${ASSET_TYPES[stats.currentFilter as keyof typeof ASSET_TYPES]?.label})` : ''}
                </p>
                <p className="text-xl font-bold text-red-600 dark:text-red-400">{stats.statusCounts.retired}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search assets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />
        </div>
        <AssetFilterPanel
          filters={filters}
          onFiltersChange={handleFiltersChange}
          activeFilterCount={activeFilterCount}
        />
      </div>

      {/* Active Filter Chips */}
      {(activeFilterCount > 0 || search) && (
        <div className="flex flex-wrap gap-2 items-center">
          {search && (
            <div className="flex items-center gap-1 px-3 py-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-full text-sm">
              <Search className="w-3 h-3" />
              <span>Search: "{search}"</span>
              <button
                onClick={() => setSearch('')}
                className="ml-1 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-full p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
          
          {Object.entries(filters).map(([key, value]) => {
            if (!value) return null;
            
            const filterKey = key as keyof AssetFilters;
            let label = getFilterDisplayLabel(filterKey, value);
            if (key.startsWith('cf_')) {
              const fieldId = key.slice(3);
              const field = customFieldMap[fieldId];
              if (field) {
                let displayVal = value;
                if (value === 'true') displayVal = 'Yes';
                if (value === 'false') displayVal = 'No';
                label = `${field.name}: ${displayVal}`;
              }
            }

            const colorClasses: Record<string, string> = {
              assignedTo: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800/50',
              status: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-800/50',
              condition: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-200 dark:hover:bg-yellow-800/50',
              assetType: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-800/50',
              departmentId: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-800/50',
              locationId: 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 hover:bg-pink-200 dark:hover:bg-pink-800/50',
              dateFrom: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 hover:bg-orange-200 dark:hover:bg-orange-800/50',
              dateTo: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 hover:bg-orange-200 dark:hover:bg-orange-800/50',
            };

            return (
              <div key={key} className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm ${colorClasses[filterKey] || 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300'}`}>
                <span>{label}</span>
                <button
                  onClick={() => clearFilter(filterKey)}
                  className="ml-1 rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}

          {(activeFilterCount > 0 || search) && (
            <button
              onClick={clearAllFilters}
              className="px-3 py-1 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-sm underline"
            >
              Clear all
            </button>
          )}
        </div>
      )}

      {/* Bulk Actions Bar */}
      {selectedAssets.length > 0 && (
        <div className="bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-brand-700 dark:text-brand-300">
              {selectedAssets.length} asset{selectedAssets.length > 1 ? 's' : ''} selected
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="px-3 py-1.5 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              onClick={() => setSelectedAssets([])}
            >
              Clear
            </button>
            <button className="px-3 py-1.5 text-sm bg-brand-600 text-white rounded-md hover:bg-brand-700 transition-colors">
              Bulk Update
            </button>
          </div>
        </div>
      )}

      {/* Assets Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden min-w-0">
        {isLoading ? (
          <div className="animate-pulse">
            <div className="bg-slate-50 dark:bg-slate-700/50 px-6 py-4 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-4">
                <div className="w-4 h-4 bg-slate-200 dark:bg-slate-600 rounded"></div>
                <div className="w-24 h-4 bg-slate-200 dark:bg-slate-600 rounded"></div>
                <div className="w-16 h-4 bg-slate-200 dark:bg-slate-600 rounded"></div>
                <div className="w-32 h-4 bg-slate-200 dark:bg-slate-600 rounded"></div>
              </div>
            </div>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-4">
                  <div className="w-4 h-4 bg-slate-200 dark:bg-slate-600 rounded"></div>
                  <div className="w-20 h-4 bg-slate-200 dark:bg-slate-600 rounded"></div>
                  <div className="w-16 h-4 bg-slate-200 dark:bg-slate-600 rounded"></div>
                  <div className="w-32 h-4 bg-slate-200 dark:bg-slate-600 rounded"></div>
                  <div className="w-24 h-4 bg-slate-200 dark:bg-slate-600 rounded"></div>
                  <div className="w-28 h-4 bg-slate-200 dark:bg-slate-600 rounded"></div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table 
              className="w-full" 
              style={{ 
                minWidth: shouldShowSpecColumns(filters.assetType) 
                  ? `${1000 + (getAssetSpecColumns(filters.assetType!).length * 120)}px`
                  : '800px' 
              }}
            >
              <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="w-12 px-4 py-4 text-left">
                    <input
                      type="checkbox"
                      checked={selectedAssets.length === assets.length && assets.length > 0}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="w-4 h-4 text-brand-600 bg-white border-slate-300 rounded focus:ring-brand-500 focus:ring-2"
                    />
                  </th>
                  <th className="px-4 py-4 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                    Asset
                  </th>
                  <th className="hidden sm:table-cell px-4 py-4 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-4 py-4 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                    Make/Model
                  </th>
                  
                  {/* Adaptive Specification Columns */}
                  {shouldShowSpecColumns(filters.assetType) && 
                    getAssetSpecColumns(filters.assetType!).map((column) => (
                      <th key={column.key} className={`hidden lg:table-cell px-3 py-4 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider ${column.width}`}>
                        {column.label}
                      </th>
                    ))
                  }
                  
                  <th className="px-4 py-4 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="hidden lg:table-cell px-4 py-4 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                    Assigned To
                  </th>
                  <th className="hidden xl:table-cell px-4 py-4 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="w-32 px-4 py-4 text-right text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700 bg-white dark:bg-slate-800">
                {assets.map((asset) => (
                  <tr 
                    key={asset.id} 
                    className={`group hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors duration-150 ${
                      selectedAssets.includes(asset.id) ? 'bg-brand-50 dark:bg-brand-900/20' : ''
                    }`}
                  >
                    <td className="w-12 px-4 py-3 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedAssets.includes(asset.id)}
                        onChange={(e) => handleSelectAsset(asset.id, e.target.checked)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-4 h-4 text-brand-600 bg-white border-slate-300 rounded focus:ring-brand-500 focus:ring-2"
                      />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {asset.assetTag}
                        </div>
                        {asset.serialNumber && (
                          <div className="text-sm text-slate-500 dark:text-slate-400 truncate">
                            SN: {asset.serialNumber}
                          </div>
                        )}
                        {/* Show type on small screens */}
                        <div className="sm:hidden">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 mt-1">
                            {asset.assetType}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="hidden sm:table-cell px-4 py-3 whitespace-nowrap">
                      <Tooltip.Provider>
                        <Tooltip.Root>
                          <Tooltip.Trigger asChild>
                            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-700 dark:to-slate-800 border border-slate-200 dark:border-slate-600 shadow-sm">
                              {(() => {
                                const IconComponent = ASSET_TYPES[asset.assetType as keyof typeof ASSET_TYPES]?.icon || Monitor;
                                const iconColors = {
                                  LAPTOP: 'text-blue-600 dark:text-blue-400',
                                  DESKTOP: 'text-purple-600 dark:text-purple-400', 
                                  TABLET: 'text-green-600 dark:text-green-400',
                                  PHONE: 'text-orange-600 dark:text-orange-400',
                                  OTHER: 'text-slate-600 dark:text-slate-400'
                                };
                                const colorClass = iconColors[asset.assetType as keyof typeof iconColors] || iconColors.OTHER;
                                return <IconComponent className={`w-5 h-5 ${colorClass}`} />;
                              })()}
                            </div>
                          </Tooltip.Trigger>
                          <Tooltip.Content side="top" className="px-2 py-1 text-xs bg-slate-900 text-white rounded shadow-lg">
                            {ASSET_TYPES[asset.assetType as keyof typeof ASSET_TYPES]?.label || asset.assetType}
                          </Tooltip.Content>
                        </Tooltip.Root>
                      </Tooltip.Provider>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-slate-900 dark:text-slate-100 truncate">
                        <span className="font-semibold">{asset.make}</span> {asset.model}
                      </div>
                      {/* Show assigned user on small screens */}
                      <div className="lg:hidden mt-1">
                        {asset.assignedToStaff ? (
                          <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            → {asset.assignedToStaff.displayName}
                          </div>
                        ) : asset.assignedTo ? (
                          <div className="flex flex-col">
                            <span className="text-sm text-slate-800 dark:text-slate-200 truncate">{asset.assignedTo.displayName}</span>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">IT Tech</span>
                          </div>
                        ) : null}
                      </div>
                    </td>
                    
                    {/* Adaptive Specification Cells */}
                    {shouldShowSpecColumns(filters.assetType) && 
                      getAssetSpecColumns(filters.assetType!).map((column) => {
                        const specs = parseSpecifications(asset.specifications);
                        const value = specs[column.key];
                        
                        return (
                          <td key={column.key} className={`hidden lg:table-cell px-3 py-3 whitespace-nowrap ${column.width}`}>
                            <div className="text-sm text-slate-900 dark:text-slate-100 truncate">
                              {value || (
                                <span className="text-slate-400 dark:text-slate-500">—</span>
                              )}
                            </div>
                          </td>
                        );
                      })
                    }
                    
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center justify-center">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium shadow-sm ${
                          asset.status === 'AVAILABLE' 
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-700'
                            : asset.status === 'ASSIGNED'
                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700'
                            : asset.status === 'SPARE'
                            ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-700'
                            : asset.status === 'MAINTENANCE'
                            ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-700'
                            : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-700'
                        }`}>
                          <div className={`w-2 h-2 rounded-full ${
                            asset.status === 'AVAILABLE' 
                              ? 'bg-green-500'
                              : asset.status === 'ASSIGNED'
                              ? 'bg-blue-500'
                              : asset.status === 'SPARE'
                              ? 'bg-orange-500'
                              : asset.status === 'MAINTENANCE'
                              ? 'bg-yellow-500'
                              : 'bg-red-500'
                          }`} />
                          <span className="hidden sm:inline">
                            {STATUS_CONFIG[asset.status as keyof typeof STATUS_CONFIG]?.label || asset.status}
                          </span>
                        </span>
                      </div>
                    </td>
                    <td className="hidden lg:table-cell px-4 py-3 whitespace-nowrap">
                      {asset.assignedToStaff ? (
                        <div className="flex items-center gap-2">
                          <ProfilePicture 
                            azureAdId={asset.assignedToStaff.id} 
                            displayName={asset.assignedToStaff.displayName} 
                            size="xs" 
                          />
                          <div className="min-w-0 flex-1">
                            <div className="text-sm text-slate-800 dark:text-slate-200 truncate">{asset.assignedToStaff.displayName}</div>
                          </div>
                        </div>
                      ) : asset.assignedTo ? (
                        <div className="flex items-center gap-2">
                          <ProfilePicture 
                            displayName={asset.assignedTo.displayName} 
                            size="xs" 
                          />
                          <div className="min-w-0 flex-1">
                            <div className="text-sm text-slate-800 dark:text-slate-200 truncate">{asset.assignedTo.displayName}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">IT Tech</div>
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500">—</span>
                      )}
                    </td>
                    <td className="hidden xl:table-cell px-4 py-3 whitespace-nowrap">
                      {asset.location ? (
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />
                          <span className="text-slate-900 dark:text-slate-100 truncate">
                            {asset.location.city}, {asset.location.province}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500">—</span>
                      )}
                    </td>
                    <td className="w-32 px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-200">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedAssetId(asset.id);
                          }}
                          className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-lg transition-all duration-200 hover:scale-105 hover:shadow-sm"
                          title="View details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        
                        {currentUser?.role !== 'READ' && (
                          <Link
                            to={`/assets/${asset.id}/edit`}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all duration-200 hover:scale-105 hover:shadow-sm"
                            title="Edit asset"
                          >
                            <Edit className="w-4 h-4" />
                          </Link>
                        )}

                        {currentUser?.role === 'ADMIN' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirmAsset({ id: asset.id, tag: asset.assetTag });
                            }}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all duration-200 hover:scale-105 hover:shadow-sm"
                            title="Delete asset"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Showing <span className="font-medium text-slate-900 dark:text-slate-100">{((pagination.page - 1) * pagination.limit) + 1}</span> to <span className="font-medium text-slate-900 dark:text-slate-100">{Math.min(pagination.page * pagination.limit, pagination.total)}</span> of <span className="font-medium text-slate-900 dark:text-slate-100">{pagination.total}</span> results
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(1)}
                disabled={page <= 1}
                className="px-3 py-2 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                First
              </button>
              <button
                onClick={() => setPage(page - 1)}
                disabled={page <= 1}
                className="px-3 py-2 text-sm font-medium border border-slate-300 dark:border-slate-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                Previous
              </button>
              
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                  const pageNum = Math.max(1, Math.min(pagination.totalPages - 4, page - 2)) + i;
                  if (pageNum > pagination.totalPages) return null;
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                        pageNum === page
                          ? 'bg-brand-600 text-white'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setPage(page + 1)}
                disabled={page >= pagination.totalPages}
                className="px-3 py-2 text-sm font-medium border border-slate-300 dark:border-slate-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                Next
              </button>
              <button
                onClick={() => setPage(pagination.totalPages)}
                disabled={page >= pagination.totalPages}
                className="px-3 py-2 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Last
              </button>
            </div>
          </div>
        )}

        {assets.length === 0 && !isLoading && (
          <div className="text-center py-20">
            <div className="mx-auto w-32 h-32 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 rounded-2xl flex items-center justify-center mb-8 shadow-lg border border-slate-200 dark:border-slate-600">
              <div className="relative">
                <Monitor className="w-16 h-16 text-slate-400 dark:text-slate-500" />
                <div className="absolute -top-1 -right-1 w-6 h-6 bg-brand-100 dark:bg-brand-900/30 rounded-full flex items-center justify-center">
                  <Plus className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                </div>
              </div>
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-3">
              {Object.keys(filters).length > 0 || search ? 'No matching assets' : 'No assets yet'}
            </h3>
            <p className="text-slate-500 dark:text-slate-400 mb-8 max-w-lg mx-auto leading-relaxed">
              {Object.keys(filters).length > 0 || search ? 
                'No assets match your current search and filters. Try adjusting your criteria or clearing filters to see all assets.' :
                'Start building your asset inventory by adding laptops, desktops, tablets, phones, and other devices to track and manage.'
              }
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-3">
              {Object.keys(filters).length > 0 || search ? (
                <button
                  onClick={clearAllFilters}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-all duration-200 font-medium shadow-sm hover:shadow-md"
                >
                  <X className="w-4 h-4" />
                  Clear filters
                </button>
              ) : null}
              <Link
                to="/assets/new"
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-brand-600 to-brand-700 text-white rounded-xl hover:from-brand-700 hover:to-brand-800 transition-all duration-200 font-medium shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                <Plus className="w-4 h-4" />
                {Object.keys(filters).length > 0 || search ? 'Add new asset' : 'Add your first asset'}
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmAsset && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full">
                <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Delete Asset
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  This action cannot be undone
                </p>
              </div>
            </div>
            
            <p className="text-slate-700 dark:text-slate-300 mb-6">
              Are you sure you want to delete asset <span className="font-semibold text-slate-900 dark:text-slate-100">{deleteConfirmAsset.tag}</span>? 
              This will permanently remove all associated data.
            </p>
            
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirmAsset(null)}
                disabled={isDeleting}
                className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAsset}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete Asset
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Asset Detail Modal */}
      {selectedAssetId && (
        <AssetDetailModal
          assetId={selectedAssetId}
          isOpen={!!selectedAssetId}
          onClose={() => setSelectedAssetId(null)}
        />
      )}
    </div>
  );
};

export default AssetList; 