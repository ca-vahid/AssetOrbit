import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { 
  Plus, Search, Eye, X, Trash2, AlertTriangle, 
  Monitor, Users, MapPin, Calendar, MoreHorizontal,
  Edit, Edit2, CheckCircle, XCircle, Clock, Settings,
  Laptop, Smartphone, Tablet, Monitor as Desktop, Server,
  List, LayoutGrid, Copy, Archive, Share2, Keyboard,
  HelpCircle, ChevronUp, ChevronDown, ChevronsUpDown
} from 'lucide-react';
import { assetsApi, usersApi, customFieldsApi } from '../services/api';
import AssetDetailView from '../components/AssetDetailView';
import AssetFilterPanelV2 from '../components/AssetFilterPanelV2';
import { useDebounce } from '../hooks/useDebounce';
import ProfilePicture from '../components/ProfilePicture';
import SourceBadge from '../components/SourceBadge';
import { useStore } from '../store';
import { AssetSource } from '@shared/types/Asset';
import * as Tooltip from '@radix-ui/react-tooltip';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as Dialog from '@radix-ui/react-dialog';

// Asset type configurations
const ASSET_TYPES = {
  LAPTOP: { label: 'Laptops', icon: Laptop, emoji: '💻' },
  DESKTOP: { label: 'Desktops', icon: Desktop, emoji: '🖥️' },
  TABLET: { label: 'Tablets', icon: Tablet, emoji: '📱' },
  PHONE: { label: 'Phones', icon: Smartphone, emoji: '📱' },
  SERVER: { label: 'Servers', icon: Server, emoji: '🖥️' },
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
  // Basic filters
  assignedTo?: string;
  status?: string | string[];
  condition?: string | string[];
  assetType?: string | string[];
  departmentId?: string | string[];
  locationId?: string | string[];
  workloadCategoryId?: string | string[];
  
  // Specification filters
  processor?: string;
  ram?: string;
  ramMin?: string;
  ramMax?: string;
  storage?: string;
  storageMin?: string;
  storageMax?: string;
  operatingSystem?: string | string[];
  
  // Hardware filters
  make?: string | string[];
  model?: string;
  serialNumber?: string;
  
  // Financial filters
  purchasePriceMin?: string;
  purchasePriceMax?: string;
  purchaseDateFrom?: string;
  purchaseDateTo?: string;
  
  // Warranty filters
  warrantyStartFrom?: string;
  warrantyStartTo?: string;
  warrantyEndFrom?: string;
  warrantyEndTo?: string;
  warrantyStatus?: string | string[];
  
  // Vendor and source filters
  vendorId?: string | string[];
  source?: string | string[];
  
  // Date filters
  dateFrom?: string;
  dateTo?: string;
  
  // Asset identification filters
  assetTag?: string;
  
  // Custom fields (dynamic)
  [key: string]: string | string[] | undefined;
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

// Helper function to format phone numbers
const formatPhoneNumber = (phoneNumber?: string) => {
  if (!phoneNumber) return null;
  // Remove all non-digits
  const digits = phoneNumber.replace(/\D/g, '');
  // Format as (XXX) XXX-XXXX for North American numbers
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  // Return original if not 10 digits
  return phoneNumber;
};

// Check if we're viewing phones specifically
const isPhoneView = (currentFilter?: string) => {
  return currentFilter === 'PHONE';
};

const AssetList: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  // Items per page limit for pagination
  const [limit, setLimit] = useState(50);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<AssetFilters>({});
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [isResizing, setIsResizing] = useState(false);
  const [resizeColumn, setResizeColumn] = useState<string | null>(null);
  const [showLeftScroll, setShowLeftScroll] = useState(false);
  const [showRightScroll, setShowRightScroll] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [deleteConfirmAsset, setDeleteConfirmAsset] = useState<{ id: string; tag: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  // Bulk delete progress tracking
  const [deleteCompleted, setDeleteCompleted] = useState(0);
  const [deleteTotal, setDeleteTotal] = useState(0);
  const [viewDensity, setViewDensity] = useState<'compact' | 'comfortable'>('compact');
  const [focusedAssetIndex, setFocusedAssetIndex] = useState<number | null>(null);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
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
    const urlLimit = parseInt(searchParams.get('limit') || '50');
    const urlSortBy = searchParams.get('sortBy') || 'createdAt';
    const urlSortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc';
    
    // Extract filter parameters
    const urlFilters: AssetFilters = {};
    searchParams.forEach((value, key) => {
      if (key !== 'search' && key !== 'page' && key !== 'limit' && key !== 'sortBy' && key !== 'sortOrder') {
        urlFilters[key] = value;
      }
    });

    setSearch(urlSearch);
    setPage(urlPage);
    setLimit(urlLimit);
    setSortBy(urlSortBy);
    setSortOrder(urlSortOrder);
    setFilters(urlFilters);
  }, [searchParams]); // Rerun when URL search params change

  // Load saved column widths and sort preferences from localStorage
  useEffect(() => {
    const savedWidths = localStorage.getItem('assetTableColumnWidths');
    if (savedWidths) {
      try {
        setColumnWidths(JSON.parse(savedWidths));
      } catch (error) {
        console.warn('Failed to parse saved column widths:', error);
      }
    }

    const savedSortBy = localStorage.getItem('assetTableSortBy');
    const savedSortOrder = localStorage.getItem('assetTableSortOrder');
    
    if (savedSortBy && !searchParams.get('sortBy')) {
      setSortBy(savedSortBy);
    }
    if (savedSortOrder && !searchParams.get('sortOrder')) {
      setSortOrder(savedSortOrder as 'asc' | 'desc');
    }
  }, []);

  // Save column widths to localStorage
  useEffect(() => {
    if (Object.keys(columnWidths).length > 0) {
      localStorage.setItem('assetTableColumnWidths', JSON.stringify(columnWidths));
    }
  }, [columnWidths]);

  // Save sort preferences to localStorage
  useEffect(() => {
    localStorage.setItem('assetTableSortBy', sortBy);
    localStorage.setItem('assetTableSortOrder', sortOrder);
  }, [sortBy, sortOrder]);



  // Update URL only for debounced search to avoid loops
  useEffect(() => {
    const newParams = new URLSearchParams(searchParams);
    const currentSearch = newParams.get('search') || '';

    if (debouncedSearch !== currentSearch) {
      if (debouncedSearch) {
        newParams.set('search', debouncedSearch);
      } else {
        newParams.delete('search');
      }
      // Reset page to 1 when search changes
      newParams.delete('page');
      setSearchParams(newParams, { replace: true });
    }
  }, [debouncedSearch, searchParams, setSearchParams]);

  // Build query parameters
  const queryParams = {
    page,
    limit,
    search: debouncedSearch,
    sortBy,
    sortOrder,
    ...filters,
  };

  const { data: assetsData, isLoading } = useQuery({
    queryKey: ['assets', queryParams],
    queryFn: () => assetsApi.getAll(queryParams),
  });

  // Fetch asset statistics (total counts by type and status)
  const { data: statsData } = useQuery({
    queryKey: ['assets-stats'],
    queryFn: () => assetsApi.getStats(),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const assets = assetsData?.data || [];
  const pagination = assetsData?.pagination;

  // Check scroll state when data changes
  useEffect(() => {
    const tableContainer = document.querySelector('.overflow-x-auto') as HTMLDivElement;
    // Use a small delay to ensure the table is fully rendered
    setTimeout(() => checkScrollState(tableContainer), 100);
  }, [assetsData, filters.assetType, columnWidths]);

  // Handle window resize to update scroll indicators
  useEffect(() => {
    const handleResize = () => {
      const tableContainer = document.querySelector('.overflow-x-auto') as HTMLDivElement;
      checkScrollState(tableContainer);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const focusedAsset = focusedAssetIndex !== null ? assets[focusedAssetIndex] : null;
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setFocusedAssetIndex(prev => {
            if (prev === null) return 0;
            return Math.min(prev + 1, assets.length - 1);
          });
          break;

        case 'ArrowUp':
          e.preventDefault();
          setFocusedAssetIndex(prev => {
            if (prev === null) return assets.length - 1;
            return Math.max(prev - 1, 0);
          });
          break;

        case 'Enter':
          e.preventDefault();
          if (focusedAsset) {
            setSelectedAssetId(focusedAsset.id);
          }
          break;

        case 'c':
          if (isCtrlOrCmd && focusedAsset) {
            e.preventDefault();
            navigator.clipboard.writeText(focusedAsset.assetTag);
            // Could add a toast notification here
          }
          break;

        case 'e':
          if (isCtrlOrCmd && focusedAsset && currentUser?.role !== 'read') {
            e.preventDefault();
            window.location.href = `/assets/${focusedAsset.id}/edit`;
          }
          break;

        case 'Delete':
          if (focusedAsset && currentUser?.role === 'ADMIN') {
            e.preventDefault();
            setDeleteConfirmAsset({ id: focusedAsset.id, tag: focusedAsset.assetTag });
          }
          break;

        case 'Escape':
          e.preventDefault();
          setFocusedAssetIndex(null);
          break;

        case '/':
          e.preventDefault();
          // Focus search input
          const searchInput = document.querySelector('input[placeholder="Search assets..."]') as HTMLInputElement;
          if (searchInput) {
            searchInput.focus();
          }
          break;

        case '?':
          e.preventDefault();
          setShowKeyboardHelp(true);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusedAssetIndex, assets, currentUser, setSelectedAssetId, setDeleteConfirmAsset]);

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
    // Keep sort and limit preferences, but clear everything else
    const newParams = new URLSearchParams(searchParams);
    const preservedKeys = ['sortBy', 'sortOrder', 'limit'];
    for (const key of Array.from(newParams.keys())) {
      if (!preservedKeys.includes(key)) {
        newParams.delete(key);
      }
    }
    setSearchParams(newParams, { replace: true });
  };

  const handleFiltersChange = (newFilters: AssetFilters) => {
    const newParams = new URLSearchParams(searchParams);
 
    // Reset page when filters change
    newParams.delete('page');
 
    // Preserve sort and limit
    if (!newParams.get('sortBy')) newParams.set('sortBy', sortBy);
    if (!newParams.get('sortOrder')) newParams.set('sortOrder', sortOrder);
    if (!newParams.get('limit')) newParams.set('limit', String(limit));
 
    Object.entries(newFilters).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') {
        newParams.delete(key);
      } else {
        if (Array.isArray(value)) {
          newParams.set(key, value.join(','));
        } else {
          newParams.set(key, String(value));
        }
      }
    });
 
    setFilters(newFilters);
    setSearchParams(newParams, { replace: true });
  };

  // Sorting functions
  const handleSort = (columnKey: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (newParams.get('sortBy') === columnKey) {
      newParams.set('sortOrder', newParams.get('sortOrder') === 'asc' ? 'desc' : 'asc');
    } else {
      newParams.set('sortBy', columnKey);
      newParams.set('sortOrder', 'asc');
    }
    newParams.delete('page');
    setSearchParams(newParams, { replace: true });
  };

  const getSortIcon = (columnKey: string) => {
    if (sortBy !== columnKey) {
      return <ChevronsUpDown className="w-4 h-4 text-slate-400" />;
    }
    return sortOrder === 'asc' ? 
      <ChevronUp className="w-4 h-4 text-brand-600" /> : 
      <ChevronDown className="w-4 h-4 text-brand-600" />;
  };

  // Column resizing functions
  const handleMouseDown = (columnKey: string, e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    setResizeColumn(columnKey);
    
    const startX = e.clientX;
    const startWidth = columnWidths[columnKey] || 150;
    
    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(80, startWidth + (e.clientX - startX));
      setColumnWidths(prev => ({
        ...prev,
        [columnKey]: newWidth
      }));
    };
    
    const handleMouseUp = () => {
      setIsResizing(false);
      setResizeColumn(null);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Handle scroll indicators
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const element = e.currentTarget;
    const { scrollLeft, scrollWidth, clientWidth } = element;
    
    const canScrollLeft = scrollLeft > 0;
    const canScrollRight = scrollLeft < scrollWidth - clientWidth - 5;
    
    setShowLeftScroll(canScrollLeft);
    setShowRightScroll(canScrollRight);
  };

  // Check initial scroll state
  const checkScrollState = (element: HTMLDivElement | null) => {
    if (!element) return;
    
    const { scrollLeft, scrollWidth, clientWidth } = element;
    const canScrollLeft = scrollLeft > 0;
    const canScrollRight = scrollLeft < scrollWidth - clientWidth - 5;
    
    setShowLeftScroll(canScrollLeft);
    setShowRightScroll(canScrollRight);
  };

  const handleDeleteAsset = async () => {
    if (!deleteConfirmAsset) return;
    
    setIsDeleting(true);
    try {
      await assetsApi.delete(deleteConfirmAsset.id);
      // Refresh the assets list and stats
      await queryClient.invalidateQueries({ queryKey: ['assets'] });
      await queryClient.invalidateQueries({ queryKey: ['assets-stats'] });
      setDeleteConfirmAsset(null);
    } catch (error) {
      console.error('Failed to delete asset:', error);
      alert('Failed to delete asset. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedAssets.length === 0) return;

    const total = selectedAssets.length;
    setDeleteTotal(total);
    setDeleteCompleted(0);
    setIsDeleting(true);

    try {
      const CHUNK_SIZE = 50; // delete up to 50 assets per request
      for (let i = 0; i < selectedAssets.length; i += CHUNK_SIZE) {
        const chunk = selectedAssets.slice(i, i + CHUNK_SIZE);
        await assetsApi.bulkDelete(chunk);
        setDeleteCompleted((prev) => prev + chunk.length);
      }

      // Refresh the assets list and stats
      await queryClient.invalidateQueries({ queryKey: ['assets'] });
      await queryClient.invalidateQueries({ queryKey: ['assets-stats'] });

      // Clear selection
      setSelectedAssets([]);

      // Show success toast
      setToast({
        message: `Successfully deleted ${total} asset${total > 1 ? 's' : ''}`,
        type: 'success',
      });

      // Close confirmation dialog
      setShowBulkDeleteConfirm(false);
    } catch (error) {
      console.error('Failed to delete assets:', error);
      setToast({
        message: 'Failed to delete some assets. Please try again.',
        type: 'error',
      });
    } finally {
      setIsDeleting(false);
      setDeleteCompleted(0);
      setDeleteTotal(0);
    }
  };

  // Auto-hide toast after 5 seconds
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Get active filter count
  const activeFilterCount = Object.entries(filters).reduce((count, [key, value]) => {
    if (!value) return count;
    if (Array.isArray(value)) {
      return count + (value.length > 0 ? 1 : 0);
    }
    return count + (value.trim() !== '' ? 1 : 0);
  }, 0);

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
      case 'workloadCategoryId':
        return 'Workload Category';
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

  // Calculate statistics - use real stats data for both asset type and status counts
  const stats = useMemo(() => {
    const currentTypeFilter = filters.assetType;
    
    // Asset type counts (for top row) - use real stats data
    const assetTypeCounts = Object.keys(ASSET_TYPES).reduce((acc, type) => {
      acc[type] = statsData?.assetTypes?.[type] || 0;
      return acc;
    }, {} as Record<string, number>);
    
    // Status counts (for bottom row) - use real stats data
    const total = statsData?.total || 0;
    const available = statsData?.statuses?.['AVAILABLE'] || 0;
    const assigned = statsData?.statuses?.['ASSIGNED'] || 0;
    const spare = statsData?.statuses?.['SPARE'] || 0;
    const retired = statsData?.statuses?.['RETIRED'] || 0;
    const maintenance = statsData?.statuses?.['MAINTENANCE'] || 0;
    
    return { 
      assetTypeCounts,
      statusCounts: { total, available, assigned, spare, retired, maintenance },
      currentFilter: currentTypeFilter
    };
  }, [filters.assetType, statsData]);

  const [selectedAssets, setSelectedAssets] = useState<string[]>([]);

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

  // Handler for navigating to staff detail page
  const handleUserClick = (userId: string) => {
    navigate(`/management/staff?user=${userId}`);
  };

  // Get column width style for table cells
  const getColumnStyle = (columnKey: string) => {
    const width = columnWidths[columnKey];
    return width ? { width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px` } : {};
  };

  // Sortable column header component
  const SortableHeader = ({ 
    columnKey, 
    label, 
    className = '',
    sortable = true,
    resizable = true 
  }: { 
    columnKey: string; 
    label: string; 
    className?: string;
    sortable?: boolean;
    resizable?: boolean;
  }) => {
    const isCurrentSort = sortBy === columnKey;
    const width = columnWidths[columnKey];
    
    const thStyle = width ? { width: `${width}px`, minWidth: `${width}px` } : {};

    if (!sortable) {
      return (
        <th 
          className={`px-4 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider ${viewDensity === 'compact' ? 'py-3' : 'py-4'} ${className} relative`}
          style={thStyle}
        >
          <div className="flex items-center justify-between">
            <span>{label}</span>
            {resizable && (
              <div
                className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-brand-300 dark:hover:bg-brand-600 transition-colors"
                onMouseDown={(e) => handleMouseDown(columnKey, e)}
              />
            )}
          </div>
        </th>
      );
    }

    return (
      <th 
        className={`px-4 text-left text-xs font-medium ${isCurrentSort ? 'text-slate-700 dark:text-slate-200' : 'text-slate-500 dark:text-slate-400'} uppercase tracking-wider ${viewDensity === 'compact' ? 'py-3' : 'py-4'} ${className} relative`}
        style={thStyle}
      >
        <div className="flex items-center justify-between">
          <button
            onClick={() => handleSort(columnKey)}
            className="flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200 transition-colors group"
          >
            <span>{label}</span>
            <span className={`transition-opacity ${isCurrentSort ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
              {getSortIcon(columnKey)}
            </span>
          </button>
          {resizable && (
            <div
              className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-brand-300 dark:hover:bg-brand-600 transition-colors"
              onMouseDown={(e) => handleMouseDown(columnKey, e)}
            />
          )}
        </div>
      </th>
    );
  };

  return (
    <div className="space-y-4 text-sm leading-normal">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-brand-500 to-brand-600 rounded-lg shadow-sm">
            <Monitor className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
              Assets
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Inventory Management
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/assets/bulk"
            className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-all duration-200 shadow-sm hover:shadow-md font-medium text-sm border border-slate-200 dark:border-slate-600"
          >
            <div className="flex items-center">
              <Plus className="w-4 h-4" />
              <div className="w-3 h-3 bg-slate-400 dark:bg-slate-500 rounded-full ml-1 flex items-center justify-center">
                <Plus className="w-2 h-2 text-white" />
              </div>
            </div>
            Bulk Upload
          </Link>
          <Link
            to="/assets/new"
            className="flex items-center gap-2 px-3 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-all duration-200 shadow-sm hover:shadow-md font-medium text-sm"
          >
            <Plus className="w-4 h-4" />
            Add Asset
          </Link>
        </div>
      </div>

      {/* Statistics Overview */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-visible">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-700/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider w-1/4">
                  Overview
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider w-1/2">
                  Asset Types
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider w-1/4">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              <tr>
                {/* Total Assets Column */}
                <td className="px-4 py-3">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <Monitor className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                    </div>
                    <div className="ml-2">
                      <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Total Assets</p>
                      <p className="text-base font-semibold text-slate-900 dark:text-slate-100 tabular-nums">{statsData?.total || 0}</p>
                    </div>
                  </div>
                </td>

                {/* Asset Types Column */}
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(ASSET_TYPES).map(([type, config]) => {
                      const IconComponent = config.icon;
                      const count = stats.assetTypeCounts[type] || 0;
                      const isActive = filters.assetType === type;
                      
                      return (
                        <button
                          key={type}
                          onClick={() => updateFilter('assetType', isActive ? undefined : type)}
                          className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-all duration-200 ${
                            isActive 
                              ? 'bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 ring-1 ring-brand-400/30' 
                              : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                          }`}
                        >
                          <IconComponent className={`h-3 w-3 ${
                            isActive 
                              ? 'text-brand-500 dark:text-brand-400' 
                              : 'text-slate-400 dark:text-slate-500'
                          }`} />
                          <span className="font-medium">{type}</span>
                          <span className="tabular-nums">{count}</span>
                        </button>
                      );
                    })}
                  </div>
                </td>

                {/* Status Column */}
                <td className="px-4 py-3">
                  <div className="grid grid-cols-2 gap-2 max-w-xs">
                    <button
                      onClick={() => updateFilter('status', filters.status === 'AVAILABLE' ? undefined : 'AVAILABLE')}
                      className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-all duration-200 ${
                        filters.status === 'AVAILABLE'
                          ? 'bg-green-200 dark:bg-green-800/50 text-green-800 dark:text-green-200 ring-2 ring-green-400/50 shadow-sm'
                          : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-800/50 hover:shadow-sm'
                      }`}
                    >
                      <CheckCircle className="h-3 w-3 text-green-500 dark:text-green-400" />
                      <span className="font-medium">AVAILABLE</span>
                      <span className="tabular-nums">{stats.statusCounts.available}</span>
                    </button>
                    <button
                      onClick={() => updateFilter('status', filters.status === 'ASSIGNED' ? undefined : 'ASSIGNED')}
                      className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-all duration-200 ${
                        filters.status === 'ASSIGNED'
                          ? 'bg-blue-200 dark:bg-blue-800/50 text-blue-800 dark:text-blue-200 ring-2 ring-blue-400/50 shadow-sm'
                          : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800/50 hover:shadow-sm'
                      }`}
                    >
                      <Users className="h-3 w-3 text-blue-500 dark:text-blue-400" />
                      <span className="font-medium">ASSIGNED</span>
                      <span className="tabular-nums">{stats.statusCounts.assigned}</span>
                    </button>
                    <button
                      onClick={() => updateFilter('status', filters.status === 'SPARE' ? undefined : 'SPARE')}
                      className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-all duration-200 ${
                        filters.status === 'SPARE'
                          ? 'bg-orange-200 dark:bg-orange-800/50 text-orange-800 dark:text-orange-200 ring-2 ring-orange-400/50 shadow-sm'
                          : 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 hover:bg-orange-200 dark:hover:bg-orange-800/50 hover:shadow-sm'
                      }`}
                    >
                      <Settings className="h-3 w-3 text-orange-500 dark:text-orange-400" />
                      <span className="font-medium">SPARE</span>
                      <span className="tabular-nums">{stats.statusCounts.spare}</span>
                    </button>
                    <button
                      onClick={() => updateFilter('status', filters.status === 'RETIRED' ? undefined : 'RETIRED')}
                      className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-all duration-200 ${
                        filters.status === 'RETIRED'
                          ? 'bg-red-200 dark:bg-red-800/50 text-red-800 dark:text-red-200 ring-2 ring-red-400/50 shadow-sm'
                          : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-800/50 hover:shadow-sm'
                      }`}
                    >
                      <XCircle className="h-3 w-3 text-red-500 dark:text-red-400" />
                      <span className="font-medium">RETIRED</span>
                      <span className="tabular-nums">{stats.statusCounts.retired}</span>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search assets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-500 focus:border-transparent text-sm"
          />
        </div>
        
        {/* View Controls */}
        <div className="flex items-center gap-2">
          {/* View Density Toggle */}
          <div className="flex items-center gap-1 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg p-1">
            <Tooltip.Provider>
              <Tooltip.Root>
                <Tooltip.Trigger asChild>
                  <button
                    onClick={() => setViewDensity('comfortable')}
                    className={`p-2 rounded-md transition-colors ${
                      viewDensity === 'comfortable' 
                        ? 'bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300' 
                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                </Tooltip.Trigger>
                <Tooltip.Content side="bottom" className="px-2 py-1 text-xs bg-slate-900 text-white rounded shadow-lg">
                  Comfortable view
                </Tooltip.Content>
              </Tooltip.Root>
            </Tooltip.Provider>
            
            <Tooltip.Provider>
              <Tooltip.Root>
                <Tooltip.Trigger asChild>
                  <button
                    onClick={() => setViewDensity('compact')}
                    className={`p-2 rounded-md transition-colors ${
                      viewDensity === 'compact' 
                        ? 'bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300' 
                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                  >
                    <List className="w-4 h-4" />
                  </button>
                </Tooltip.Trigger>
                <Tooltip.Content side="bottom" className="px-2 py-1 text-xs bg-slate-900 text-white rounded shadow-lg">
                  Compact view
                </Tooltip.Content>
              </Tooltip.Root>
            </Tooltip.Provider>
          </div>

          {/* Keyboard Shortcuts Help */}
          <Tooltip.Provider>
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <button
                  onClick={() => setShowKeyboardHelp(true)}
                  className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <Keyboard className="w-4 h-4" />
                </button>
              </Tooltip.Trigger>
              <Tooltip.Content side="bottom" className="px-2 py-1 text-xs bg-slate-900 text-white rounded shadow-lg">
                Keyboard shortcuts (?)
              </Tooltip.Content>
            </Tooltip.Root>
          </Tooltip.Provider>
        </div>
        
        <AssetFilterPanelV2
          filters={filters as any}
          onFiltersChange={(f: any) => handleFiltersChange(f as any)}
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
            if (Array.isArray(value) && value.length === 0) return null;
            
            const filterKey = key as keyof AssetFilters;
            
            // Handle array values
            if (Array.isArray(value)) {
              return value.map((val, index) => {
                const label = getFilterDisplayLabel(filterKey, val);
                
                const colorClasses: Record<string, string> = {
                  assignedTo: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
                  status: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
                  condition: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
                  assetType: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
                  departmentId: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300',
                  locationId: 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300',
                  make: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300',
                  source: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
                  operatingSystem: 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300',
                };

                return (
                  <div key={`${key}-${index}`} className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm ${colorClasses[filterKey] || 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300'}`}>
                    <span>{label}</span>
                    <button
                      onClick={() => {
                        const newValues = value.filter((_, i) => i !== index);
                        handleFiltersChange({ ...filters, [key]: newValues.length > 0 ? newValues : undefined });
                      }}
                      className="ml-1 hover:bg-white/20 rounded-full p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              });
            }
            
            // Handle single string values
            let label = getFilterDisplayLabel(filterKey, value as string);
            if (key.startsWith('cf_')) {
              const fieldId = key.slice(3);
              const field = customFieldMap[fieldId];
              if (field) {
                let displayVal = value;
                if (value === 'true') displayVal = 'Yes';
                if (value === 'false') displayVal = 'No';
                label = `${field.name}: ${displayVal}`;
              }
            } else {
              // Add more descriptive labels for new filter types
              const labelMap: Record<string, string> = {
                processor: `Processor: ${value}`,
                ram: `RAM: ${value}`,
                ramMin: `RAM ≥ ${value}GB`,
                ramMax: `RAM ≤ ${value}GB`,
                storage: `Storage: ${value}`,
                storageMin: `Storage ≥ ${value}GB`,
                storageMax: `Storage ≤ ${value}GB`,
                model: `Model: ${value}`,
                serialNumber: `Serial: ${value}`,
                assetTag: `Asset Tag: ${value}`,
                purchasePriceMin: `Price ≥ $${value}`,
                purchasePriceMax: `Price ≤ $${value}`,
                purchaseDateFrom: `Purchased ≥ ${value}`,
                purchaseDateTo: `Purchased ≤ ${value}`,
                warrantyStartFrom: `Warranty Start ≥ ${value}`,
                warrantyStartTo: `Warranty Start ≤ ${value}`,
                warrantyEndFrom: `Warranty End ≥ ${value}`,
                warrantyEndTo: `Warranty End ≤ ${value}`,
                dateFrom: `Created ≥ ${value}`,
                dateTo: `Created ≤ ${value}`,
              };
              
              if (labelMap[key]) {
                label = labelMap[key];
              }
            }

            const colorClasses: Record<string, string> = {
              assignedTo: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
              status: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
              condition: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
              assetType: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
              departmentId: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300',
              locationId: 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300',
              dateFrom: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
              dateTo: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
              processor: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
              ram: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
              ramMin: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
              ramMax: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
              storage: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
              storageMin: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
              storageMax: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
              make: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300',
              source: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
            };

            return (
              <div key={key} className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm ${colorClasses[filterKey] || 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300'}`}>
                <span>{label}</span>
                <button
                  onClick={() => clearFilter(filterKey)}
                  className="ml-1 hover:bg-white/20 rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          }).flat()}

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

      {/* Floating Bulk Actions Bar */}
      {selectedAssets.length > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-white dark:bg-slate-800 border-2 border-brand-200 dark:border-brand-700 rounded-xl shadow-xl shadow-brand-900/20 dark:shadow-brand-900/40 p-4 flex items-center justify-between gap-6 z-50 backdrop-blur-sm ring-1 ring-brand-100 dark:ring-brand-800">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 bg-brand-100 dark:bg-brand-900/30 rounded-lg border border-brand-200 dark:border-brand-700">
              <span className="text-sm font-semibold text-brand-700 dark:text-brand-300">
                {selectedAssets.length}
              </span>
            </div>
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              asset{selectedAssets.length > 1 ? 's' : ''} selected
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="px-3 py-1.5 text-sm bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              onClick={() => setSelectedAssets([])}
            >
              Clear
            </button>
            <button 
              className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm flex items-center gap-1.5"
              onClick={() => setShowBulkDeleteConfirm(true)}
              disabled={isDeleting}
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button className="px-3 py-1.5 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors shadow-sm flex items-center gap-1.5">
                  <Edit2 className="w-4 h-4" />
                  Update
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content 
                  className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg p-1 min-w-[160px] z-50"
                  sideOffset={5}
                >
                  <DropdownMenu.Item className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md cursor-pointer">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    Mark Available
                  </DropdownMenu.Item>
                  <DropdownMenu.Item className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md cursor-pointer">
                    <Users className="w-4 h-4 text-blue-500" />
                    Mark Assigned
                  </DropdownMenu.Item>
                  <DropdownMenu.Item className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md cursor-pointer">
                    <Settings className="w-4 h-4 text-orange-500" />
                    Mark Spare
                  </DropdownMenu.Item>
                  <DropdownMenu.Item className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md cursor-pointer">
                    <XCircle className="w-4 h-4 text-red-500" />
                    Mark Retired
                  </DropdownMenu.Item>
                  <DropdownMenu.Separator className="my-1 h-px bg-slate-200 dark:bg-slate-700" />
                  <DropdownMenu.Item className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md cursor-pointer">
                    <MapPin className="w-4 h-4 text-purple-500" />
                    Change Location
                  </DropdownMenu.Item>
                  <DropdownMenu.Item className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md cursor-pointer">
                    <Archive className="w-4 h-4 text-slate-500" />
                    Export Selected
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
        </div>
      )}

      {/* Assets Table */}
      <div className={`bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-visible min-w-0 ${isResizing ? 'select-none' : ''}`}>
        {isLoading ? (
          <div className="animate-pulse">
            <div className="bg-slate-50 dark:bg-slate-700/50 px-4 py-3 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 bg-slate-200 dark:bg-slate-600 rounded"></div>
                <div className="w-20 h-3 bg-slate-200 dark:bg-slate-600 rounded"></div>
                <div className="w-14 h-3 bg-slate-200 dark:bg-slate-600 rounded"></div>
                <div className="w-28 h-3 bg-slate-200 dark:bg-slate-600 rounded"></div>
              </div>
            </div>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 bg-slate-200 dark:bg-slate-600 rounded"></div>
                  <div className="w-18 h-3 bg-slate-200 dark:bg-slate-600 rounded"></div>
                  <div className="w-14 h-3 bg-slate-200 dark:bg-slate-600 rounded"></div>
                  <div className="w-28 h-3 bg-slate-200 dark:bg-slate-600 rounded"></div>
                  <div className="w-20 h-3 bg-slate-200 dark:bg-slate-600 rounded"></div>
                  <div className="w-24 h-3 bg-slate-200 dark:bg-slate-600 rounded"></div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="relative">
            {/* Left scroll indicator */}
            <div className={`absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-white dark:from-slate-800 via-white/90 dark:via-slate-800/90 to-transparent z-20 pointer-events-none transition-opacity duration-300 ${showLeftScroll ? 'opacity-100' : 'opacity-0'}`}>
                <div className="absolute left-2 top-1/2 transform -translate-y-1/2 w-8 h-8 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center shadow-lg border border-slate-200 dark:border-slate-600">
                  <svg className="w-4 h-4 text-slate-600 dark:text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </div>
            </div>
            
            {/* Right scroll indicator */}
            <div className={`absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-white dark:from-slate-800 via-white/90 dark:via-slate-800/90 to-transparent z-20 pointer-events-none transition-opacity duration-300 ${showRightScroll ? 'opacity-100' : 'opacity-0'}`}>
                <div className="absolute right-2 top-1/2 transform -translate-y-1/2 w-8 h-8 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center shadow-lg border border-slate-200 dark:border-slate-600">
                  <svg className="w-4 h-4 text-slate-600 dark:text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
            </div>
            
            <div 
              className="overflow-x-auto w-full scrollbar-thin"
              onScroll={handleScroll}
              ref={(el) => {
                if (el) {
                  setTimeout(() => checkScrollState(el), 500);
                }
              }}
            >
            <table 
                className="min-w-max" 
              style={{ 
                minWidth: shouldShowSpecColumns(String(filters.assetType)) 
                    ? `${1200 + (getAssetSpecColumns(String(filters.assetType)).length * 150)}px` 
                    : '1200px'
              }}
            >
              <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className={`w-12 px-4 text-left ${viewDensity === 'compact' ? 'py-3' : 'py-4'}`}>
                    <input
                      type="checkbox"
                      checked={selectedAssets.length === assets.length && assets.length > 0}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="w-4 h-4 text-brand-600 bg-white border-slate-300 rounded focus:ring-brand-500 focus:ring-2"
                    />
                  </th>
                  
                  {isPhoneView(String(filters.assetType)) ? (
                    // Phone-specific headers
                    <>
                      <SortableHeader columnKey="assignedToAadId" label="User" />
                      <SortableHeader columnKey="assetType" label="Type" className="hidden sm:table-cell" />
                      <SortableHeader columnKey="make" label="Make/Model" />
                      <SortableHeader columnKey="storage" label="Capacity" className="hidden md:table-cell" sortable={false} />
                      <SortableHeader columnKey="phoneNumber" label="Phone #" className="hidden lg:table-cell" sortable={false} />
                      <SortableHeader columnKey="locationId" label="Location" className="hidden xl:table-cell" />
                      <SortableHeader columnKey="status" label="Status" />
                    </>
                  ) : (
                    // Default headers
                    <>
                      <SortableHeader columnKey="assetTag" label="Asset" />
                      <SortableHeader columnKey="assetType" label="Type" className="hidden sm:table-cell" />
                      <SortableHeader columnKey="make" label="Make/Model" />
                      
                      {/* Adaptive Specification Columns */}
                      {shouldShowSpecColumns(String(filters.assetType)) && 
                        getAssetSpecColumns(String(filters.assetType)).map((column) => (
                          <SortableHeader 
                            key={column.key} 
                            columnKey={column.key} 
                            label={column.label}
                            className={`hidden lg:table-cell px-3 ${column.width}`}
                            sortable={false}
                          />
                        ))
                      }
                      
                      <SortableHeader columnKey="status" label="Status" />
                      <SortableHeader columnKey="assignedToAadId" label="Assigned To" className="hidden lg:table-cell" />
                      <SortableHeader columnKey="locationId" label="Location" className="hidden xl:table-cell" />
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700 bg-white dark:bg-slate-800">
                {assets.map((asset, index) => (
                  <tr 
                    key={asset.id} 
                    className={`group hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors duration-150 ${
                      selectedAssets.includes(asset.id) ? 'bg-brand-50 dark:bg-brand-900/20' : ''
                    } ${
                      focusedAssetIndex === index ? 'ring-2 ring-brand-500 ring-inset bg-brand-25 dark:bg-brand-950/50' : ''
                    } ${viewDensity === 'compact' ? 'text-sm' : ''}`}
                    onClick={() => setFocusedAssetIndex(index)}
                  >
                    <td className={`w-12 px-4 whitespace-nowrap ${viewDensity === 'compact' ? 'py-2' : 'py-3'}`}>
                      <input
                        type="checkbox"
                        checked={selectedAssets.includes(asset.id)}
                        onChange={(e) => handleSelectAsset(asset.id, e.target.checked)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-4 h-4 text-brand-600 bg-white border-slate-300 rounded focus:ring-brand-500 focus:ring-2"
                      />
                    </td>
                    
                    {isPhoneView(String(filters.assetType)) ? (
                      // Phone-specific layout
                      <>
                        {/* User Column */}
                        <td className={`px-4 whitespace-nowrap ${viewDensity === 'compact' ? 'py-2' : 'py-3'}`} style={getColumnStyle('assignedToAadId')}>
                          {asset.assignedToStaff ? (
                            <Tooltip.Provider>
                              <Tooltip.Root>
                                <Tooltip.Trigger asChild>
                                  <div 
                                    className="flex items-center gap-2 group cursor-pointer"
                                    style={{ maxWidth: columnWidths['assignedToAadId'] ? `${columnWidths['assignedToAadId'] - 32}px` : '140px' }}
                                    onClick={() => asset.assignedToStaff && handleUserClick(asset.assignedToStaff.id)}
                                  >
                                    <div className="relative">
                                      <ProfilePicture 
                                        azureAdId={asset.assignedToStaff.id} 
                                        displayName={asset.assignedToStaff.displayName} 
                                        size="xs" 
                                      />
                                      <div className="absolute -inset-0.5 bg-gradient-to-r from-brand-500 to-brand-600 rounded-full opacity-0 group-hover:opacity-20 transition-opacity duration-200" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <div className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                                        {asset.assignedToStaff.displayName.split(' ').slice(0, 2).join(' ')}
                                      </div>
                                      {asset.assignedToStaff.jobTitle && (
                                        <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                          {asset.assignedToStaff.jobTitle.length > 20 ? 
                                            `${asset.assignedToStaff.jobTitle.substring(0, 20)}...` : 
                                            asset.assignedToStaff.jobTitle
                                          }
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </Tooltip.Trigger>
                                <Tooltip.Content side="top" className="px-3 py-2 text-sm bg-slate-900 text-white rounded-lg shadow-lg max-w-xs">
                                  <div className="font-semibold">{asset.assignedToStaff.displayName}</div>
                                  {asset.assignedToStaff.jobTitle && (
                                    <div className="text-slate-300 text-xs mt-1">{asset.assignedToStaff.jobTitle}</div>
                                  )}
                                  {asset.assignedToStaff.department && (
                                    <div className="text-slate-300 text-xs">{asset.assignedToStaff.department}</div>
                                  )}
                                  {asset.assignedToStaff.mail && (
                                    <div className="text-slate-300 text-xs mt-1">{asset.assignedToStaff.mail}</div>
                                  )}
                                </Tooltip.Content>
                              </Tooltip.Root>
                            </Tooltip.Provider>
                          ) : asset.assignedTo ? (
                            <Tooltip.Provider>
                              <Tooltip.Root>
                                <Tooltip.Trigger asChild>
                                  <div 
                                    className="flex items-center gap-2 group cursor-pointer"
                                    style={{ maxWidth: columnWidths['assignedToAadId'] ? `${columnWidths['assignedToAadId'] - 32}px` : '140px' }}
                                    onClick={() => asset.assignedTo && handleUserClick(asset.assignedTo.id)}
                                  >
                                    <div className="relative">
                                      <ProfilePicture 
                                        displayName={asset.assignedTo.displayName} 
                                        size="xs" 
                                      />
                                      <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-full opacity-0 group-hover:opacity-20 transition-opacity duration-200" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <div className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                                        {asset.assignedTo.displayName.split(' ').slice(0, 2).join(' ')}
                                      </div>
                                      <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">IT Tech</div>
                                    </div>
                                  </div>
                                </Tooltip.Trigger>
                                <Tooltip.Content side="top" className="px-3 py-2 text-sm bg-slate-900 text-white rounded-lg shadow-lg">
                                  <div className="font-semibold">{asset.assignedTo.displayName}</div>
                                  <div className="text-emerald-300 text-xs mt-1">IT Technician</div>
                                  {asset.assignedTo.email && (
                                    <div className="text-slate-300 text-xs mt-1">{asset.assignedTo.email}</div>
                                  )}
                                </Tooltip.Content>
                              </Tooltip.Root>
                            </Tooltip.Provider>
                          ) : asset.assignedToAadId ? (
                            <Tooltip.Provider>
                              <Tooltip.Root>
                                <Tooltip.Trigger asChild>
                                  <div 
                                    className="flex items-center gap-2 group cursor-pointer"
                                    style={{ maxWidth: columnWidths['assignedToAadId'] ? `${columnWidths['assignedToAadId'] - 32}px` : '140px' }}
                                  >
                                    <div className="w-6 h-6 bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-600 dark:to-slate-700 rounded-full flex items-center justify-center">
                                      <span className="text-xs font-medium text-slate-600 dark:text-slate-300">?</span>
                                    </div>
                                    <span className="text-sm text-slate-600 dark:text-slate-400 truncate font-mono">
                                      {asset.assignedToAadId.substring(0, 8)}...
                                    </span>
                                  </div>
                                </Tooltip.Trigger>
                                <Tooltip.Content side="top" className="px-3 py-2 text-sm bg-slate-900 text-white rounded-lg shadow-lg">
                                  <div className="font-semibold">Azure AD User</div>
                                  <div className="text-slate-300 text-xs mt-1 font-mono">{asset.assignedToAadId}</div>
                                </Tooltip.Content>
                              </Tooltip.Root>
                            </Tooltip.Provider>
                          ) : (
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 rounded-full flex items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-600">
                                <span className="text-xs text-slate-400">—</span>
                              </div>
                              <span className="text-slate-500 dark:text-slate-400 text-sm">Unassigned</span>
                            </div>
                          )}
                        </td>

                        {/* Type Column with Source Badge */}
                        <td className={`hidden sm:table-cell px-4 whitespace-nowrap ${viewDensity === 'compact' ? 'py-2' : 'py-3'}`} style={getColumnStyle('assetType')}>
                          <div className="flex items-center justify-center gap-2">
                            {/* Source Badge */}
                            <SourceBadge source={(asset.source as AssetSource) || AssetSource.MANUAL} size="overlay" />
                            
                            {/* Type Icon */}
                            <Tooltip.Provider>
                              <Tooltip.Root>
                                <Tooltip.Trigger asChild>
                                  <div className={`flex items-center justify-center rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-700 dark:to-slate-800 border border-slate-200 dark:border-slate-600 shadow-sm ${viewDensity === 'compact' ? 'w-8 h-8' : 'w-10 h-10'}`}>
                                    {(() => {
                                      const IconComponent = ASSET_TYPES[asset.assetType as keyof typeof ASSET_TYPES]?.icon || Monitor;
                                      const iconColors = {
                                        LAPTOP: 'text-blue-600 dark:text-blue-400',
                                        DESKTOP: 'text-purple-600 dark:text-purple-400', 
                                        TABLET: 'text-green-600 dark:text-green-400',
                                        PHONE: 'text-orange-600 dark:text-orange-400',
                                        SERVER: 'text-red-600 dark:text-red-400',
                                        OTHER: 'text-slate-600 dark:text-slate-400'
                                      };
                                      const colorClass = iconColors[asset.assetType as keyof typeof iconColors] || iconColors.OTHER;
                                      return <IconComponent className={`${viewDensity === 'compact' ? 'w-4 h-4' : 'w-5 h-5'} ${colorClass}`} />;
                                    })()}
                                  </div>
                                </Tooltip.Trigger>
                                <Tooltip.Content side="top" className="px-2 py-1 text-xs bg-slate-900 text-white rounded shadow-lg">
                                  {ASSET_TYPES[asset.assetType as keyof typeof ASSET_TYPES]?.label || asset.assetType}
                                </Tooltip.Content>
                              </Tooltip.Root>
                            </Tooltip.Provider>
                          </div>
                        </td>

                        {/* Make/Model Column */}
                        <td className={`px-4 whitespace-nowrap relative pr-12 ${viewDensity === 'compact' ? 'py-2' : 'py-3'}`} style={getColumnStyle('make')}>
                          <div className="min-w-0">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedAssetId(asset.id);
                              }}
                              className="group/asset text-left w-full"
                            >
                              <div 
                                className="font-medium text-slate-900 dark:text-slate-100 truncate hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
                                style={{ maxWidth: columnWidths['make'] ? `${columnWidths['make'] - 32}px` : '200px' }}
                              >
                                {asset.model}
                              </div>
                              <div 
                                className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide truncate"
                                style={{ maxWidth: columnWidths['make'] ? `${columnWidths['make'] - 32}px` : '200px' }}
                              >
                                {asset.make}
                              </div>
                            </button>
                          </div>

                          {/* Inline actions button – appears on row hover */}
                          <DropdownMenu.Root>
                            <DropdownMenu.Trigger asChild>
                              <button
                                className="p-2 absolute right-0 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-all duration-200 opacity-0 group-hover:opacity-100"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreHorizontal className="w-4 h-4" />
                              </button>
                            </DropdownMenu.Trigger>

                            <DropdownMenu.Portal>
                              <DropdownMenu.Content
                                className="min-w-[180px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg p-1 z-50"
                                side="right"
                                align="start"
                                sideOffset={5}
                              >
                                <DropdownMenu.Item
                                  className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md cursor-pointer outline-none"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedAssetId(asset.id);
                                  }}
                                >
                                  <Eye className="w-4 h-4" />
                                  View Details
                                </DropdownMenu.Item>
                                {currentUser?.role !== 'READ' && (
                                  <DropdownMenu.Item
                                    className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md cursor-pointer outline-none"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      window.location.href = `/assets/${asset.id}/edit`;
                                    }}
                                  >
                                    <Edit className="w-4 h-4" />
                                    Edit Asset
                                  </DropdownMenu.Item>
                                )}
                                <DropdownMenu.Item
                                  className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md cursor-pointer outline-none"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigator.clipboard.writeText(asset.assetTag);
                                  }}
                                >
                                  <Copy className="w-4 h-4" />
                                  Copy Asset Tag
                                </DropdownMenu.Item>
                                <DropdownMenu.Separator className="h-px bg-slate-200 dark:bg-slate-700 my-1" />
                                {currentUser?.role === 'ADMIN' && (
                                  <DropdownMenu.Item
                                    className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md cursor-pointer outline-none"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDeleteConfirmAsset({ id: asset.id, tag: asset.assetTag });
                                    }}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                    Delete Asset
                                  </DropdownMenu.Item>
                                )}
                              </DropdownMenu.Content>
                            </DropdownMenu.Portal>
                          </DropdownMenu.Root>
                        </td>

                        {/* Capacity Column */}
                        <td className={`hidden md:table-cell px-4 whitespace-nowrap ${viewDensity === 'compact' ? 'py-2' : 'py-3'}`} style={getColumnStyle('storage')}>
                          <div className="text-sm text-slate-900 dark:text-slate-100">
                            {(() => {
                              const specs = parseSpecifications(asset.specifications);
                              return specs.storage || (
                                <span className="text-slate-400 dark:text-slate-500">—</span>
                              );
                            })()}
                          </div>
                        </td>

                        {/* Phone Number Column */}
                        <td className={`hidden lg:table-cell px-4 whitespace-nowrap ${viewDensity === 'compact' ? 'py-2' : 'py-3'}`} style={getColumnStyle('phoneNumber')}>
                          <div className="text-sm text-slate-900 dark:text-slate-100 font-mono">
                            {(() => {
                              const specs = parseSpecifications(asset.specifications);
                              const phoneNumber = specs.phoneNumber;
                              const formatted = formatPhoneNumber(phoneNumber);
                              return formatted || (
                                <span className="text-slate-400 dark:text-slate-500">—</span>
                              );
                            })()}
                          </div>
                        </td>

                        {/* Location Column */}
                        <td className={`hidden xl:table-cell px-4 whitespace-nowrap ${viewDensity === 'compact' ? 'py-2' : 'py-3'}`} style={getColumnStyle('locationId')}>
                          {asset.location ? (
                            <div className="flex items-center gap-2">
                              <MapPin className={`text-slate-400 flex-shrink-0 ${viewDensity === 'compact' ? 'w-3 h-3' : 'w-4 h-4'}`} />
                              <span className="text-slate-900 dark:text-slate-100 truncate">
                                {asset.location.city}, {asset.location.province}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-500">—</span>
                          )}
                        </td>

                        {/* Minimized Status Column */}
                        <td className={`px-4 whitespace-nowrap ${viewDensity === 'compact' ? 'py-2' : 'py-3'}`} style={getColumnStyle('status')}>
                          <div className="flex items-center justify-center">
                            <Tooltip.Provider>
                              <Tooltip.Root>
                                <Tooltip.Trigger asChild>
                                  <div className={`rounded-full ${viewDensity === 'compact' ? 'w-3 h-3' : 'w-4 h-4'} ${
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
                                </Tooltip.Trigger>
                                <Tooltip.Content side="top" className="px-2 py-1 text-xs bg-slate-900 text-white rounded shadow-lg">
                                  {STATUS_CONFIG[asset.status as keyof typeof STATUS_CONFIG]?.label || asset.status}
                                </Tooltip.Content>
                              </Tooltip.Root>
                            </Tooltip.Provider>
                          </div>
                        </td>
                      </>
                    ) : (
                      // Default layout
                      <>
                        <td className={`px-4 whitespace-nowrap relative pr-12 ${viewDensity === 'compact' ? 'py-2' : 'py-3'}`} style={getColumnStyle('assetTag')}>
                          <div className="min-w-0 relative">
                            {/* Source Badge - positioned to the left of the asset tag */}
                            <div className="absolute -left-3 top-1/2 -translate-y-1/2 z-10">
                              <SourceBadge source={(asset.source as AssetSource) || AssetSource.MANUAL} size="overlay" />
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedAssetId(asset.id);
                              }}
                              className="group/asset text-left font-medium text-slate-900 dark:text-slate-100 hover:text-brand-600 dark:hover:text-brand-400 truncate transition-all duration-200 hover:bg-brand-50 dark:hover:bg-brand-900/20 px-2 py-1 ml-10 -mr-2 -my-1 rounded-lg border border-transparent hover:border-brand-200 dark:hover:border-brand-700 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1"
                              style={{ maxWidth: columnWidths['assetTag'] ? `${columnWidths['assetTag'] - 80}px` : '140px' }}
                            >
                              <div className="flex items-center gap-2">
                                <span className="relative">
                                  {asset.assetTag}
                                  <div className="absolute inset-x-0 -bottom-0.5 h-0.5 bg-brand-500 scale-x-0 group-hover/asset:scale-x-100 transition-transform duration-200 origin-left"></div>
                                </span>
                                <div className="opacity-0 group-hover/asset:opacity-100 transition-opacity duration-200">
                                  <svg className="w-3 h-3 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                  </svg>
                                </div>
                              </div>
                            </button>
                            {asset.serialNumber && (
                              <div 
                                className="text-sm text-slate-500 dark:text-slate-400 truncate ml-10"
                                style={{ maxWidth: columnWidths['assetTag'] ? `${columnWidths['assetTag'] - 60}px` : '160px' }}
                              >
                                SN: {asset.serialNumber}
                              </div>
                            )}
                            {/* Show type on small screens */}
                            <div className="sm:hidden ml-10">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 mt-1">
                                {asset.assetType}
                              </span>
                            </div>
                          </div>

                          {/* Inline actions button – appears on row hover */}
                          <DropdownMenu.Root>
                            <DropdownMenu.Trigger asChild>
                              <button
                                className="p-2 absolute right-0 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-all duration-200 opacity-0 group-hover:opacity-100"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreHorizontal className="w-4 h-4" />
                              </button>
                            </DropdownMenu.Trigger>

                            <DropdownMenu.Portal>
                              <DropdownMenu.Content
                                className="min-w-[180px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg p-1 z-50"
                                side="right"
                                align="start"
                                sideOffset={5}
                              >
                                {currentUser?.role !== 'READ' && (
                                  <DropdownMenu.Item
                                    className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md cursor-pointer outline-none"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      window.location.href = `/assets/${asset.id}/edit`;
                                    }}
                                  >
                                    <Edit className="w-4 h-4" />
                                    Edit Asset
                                  </DropdownMenu.Item>
                                )}
                                <DropdownMenu.Item
                                  className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md cursor-pointer outline-none"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigator.clipboard.writeText(asset.assetTag);
                                  }}
                                >
                                  <Copy className="w-4 h-4" />
                                  Copy Asset Tag
                                </DropdownMenu.Item>
                                <DropdownMenu.Separator className="h-px bg-slate-200 dark:bg-slate-700 my-1" />
                                {currentUser?.role === 'ADMIN' && (
                                  <DropdownMenu.Item
                                    className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md cursor-pointer outline-none"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDeleteConfirmAsset({ id: asset.id, tag: asset.assetTag });
                                    }}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                    Delete Asset
                                  </DropdownMenu.Item>
                                )}
                              </DropdownMenu.Content>
                            </DropdownMenu.Portal>
                          </DropdownMenu.Root>
                        </td>
                        <td className={`hidden sm:table-cell px-4 whitespace-nowrap ${viewDensity === 'compact' ? 'py-2' : 'py-3'}`} style={getColumnStyle('assetType')}>
                          <Tooltip.Provider>
                            <Tooltip.Root>
                              <Tooltip.Trigger asChild>
                                <div className={`flex items-center justify-center rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-700 dark:to-slate-800 border border-slate-200 dark:border-slate-600 shadow-sm ${viewDensity === 'compact' ? 'w-8 h-8' : 'w-10 h-10'}`}>
                                  {(() => {
                                    const IconComponent = ASSET_TYPES[asset.assetType as keyof typeof ASSET_TYPES]?.icon || Monitor;
                                    const iconColors = {
                                      LAPTOP: 'text-blue-600 dark:text-blue-400',
                                      DESKTOP: 'text-purple-600 dark:text-purple-400', 
                                      TABLET: 'text-green-600 dark:text-green-400',
                                      PHONE: 'text-orange-600 dark:text-orange-400',
                                      SERVER: 'text-red-600 dark:text-red-400',
                                      OTHER: 'text-slate-600 dark:text-slate-400'
                                    };
                                    const colorClass = iconColors[asset.assetType as keyof typeof iconColors] || iconColors.OTHER;
                                    return <IconComponent className={`${viewDensity === 'compact' ? 'w-4 h-4' : 'w-5 h-5'} ${colorClass}`} />;
                                  })()}
                                </div>
                              </Tooltip.Trigger>
                              <Tooltip.Content side="top" className="px-2 py-1 text-xs bg-slate-900 text-white rounded shadow-lg">
                                {ASSET_TYPES[asset.assetType as keyof typeof ASSET_TYPES]?.label || asset.assetType}
                              </Tooltip.Content>
                            </Tooltip.Root>
                          </Tooltip.Provider>
                        </td>
                        <td className={`px-4 whitespace-nowrap ${viewDensity === 'compact' ? 'py-2' : 'py-3'}`} style={getColumnStyle('make')}>
                          <div className="min-w-0">
                            <div 
                              className="font-medium text-slate-900 dark:text-slate-100 truncate"
                              style={{ maxWidth: columnWidths['make'] ? `${columnWidths['make'] - 32}px` : '200px' }}
                            >
                              {asset.model}
                            </div>
                            <div 
                              className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide truncate"
                              style={{ maxWidth: columnWidths['make'] ? `${columnWidths['make'] - 32}px` : '200px' }}
                            >
                              {asset.make}
                            </div>
                          </div>
                          {/* Show assigned user on small screens */}
                          <div className="lg:hidden mt-1 ml-10">
                            {asset.assignedToStaff ? (
                              <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                → {asset.assignedToStaff.displayName}
                              </div>
                            ) : asset.assignedTo ? (
                              <div className="flex flex-col">
                                <span className="text-sm text-slate-800 dark:text-slate-200 truncate">{asset.assignedTo.displayName}</span>
                                <span className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">IT Tech</span>
                              </div>
                            ) : asset.assignedToAadId ? (
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-slate-600 dark:text-slate-400 truncate">{asset.assignedToAadId}</span>
                              </div>
                            ) : (
                              <span className="text-slate-500 dark:text-slate-400">Unassigned</span>
                            )}
                          </div>
                        </td>
                        
                        {/* Adaptive Specification Cells */}
                        {shouldShowSpecColumns(String(filters.assetType)) && 
                          getAssetSpecColumns(String(filters.assetType)).map((column) => {
                            const specs = parseSpecifications(asset.specifications);
                            const value = specs[column.key];
                            
                            return (
                              <td key={column.key} className={`hidden lg:table-cell px-3 whitespace-nowrap ${column.width} ${viewDensity === 'compact' ? 'py-2' : 'py-3'}`} style={getColumnStyle(column.key)}>
                                <div 
                                  className="text-sm text-slate-900 dark:text-slate-100 truncate"
                                  style={{ maxWidth: columnWidths[column.key] ? `${columnWidths[column.key] - 24}px` : '100%' }}
                                >
                                  {value || (
                                    <span className="text-slate-400 dark:text-slate-500">—</span>
                                  )}
                                </div>
                              </td>
                            );
                          })
                        }
                        
                        <td className={`px-4 whitespace-nowrap ${viewDensity === 'compact' ? 'py-2' : 'py-3'}`} style={getColumnStyle('status')}>
                          <div className="flex items-center justify-center">
                            <span className={`inline-flex items-center gap-1.5 rounded-full font-medium shadow-sm ${
                              viewDensity === 'compact' ? 'px-2 py-1 text-xs' : 'px-2.5 py-1.5 text-xs'
                            } ${
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
                              <div className={`rounded-full ${viewDensity === 'compact' ? 'w-1.5 h-1.5' : 'w-2 h-2'} ${
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
                                {viewDensity === 'compact' 
                                  ? STATUS_CONFIG[asset.status as keyof typeof STATUS_CONFIG]?.short || asset.status
                                  : STATUS_CONFIG[asset.status as keyof typeof STATUS_CONFIG]?.label || asset.status
                                }
                              </span>
                            </span>
                          </div>
                        </td>
                        <td className={`hidden lg:table-cell px-4 whitespace-nowrap ${viewDensity === 'compact' ? 'py-2' : 'py-3'}`} style={getColumnStyle('assignedToAadId')}>
                          {asset.assignedToStaff ? (
                            <Tooltip.Provider>
                              <Tooltip.Root>
                                <Tooltip.Trigger asChild>
                                  <div 
                                    className="flex items-center gap-2 group cursor-pointer"
                                    style={{ maxWidth: columnWidths['assignedToAadId'] ? `${columnWidths['assignedToAadId'] - 32}px` : '140px' }}
                                    onClick={() => asset.assignedToStaff && handleUserClick(asset.assignedToStaff.id)}
                                  >
                                    <div className="relative">
                              <ProfilePicture 
                                azureAdId={asset.assignedToStaff.id} 
                                displayName={asset.assignedToStaff.displayName} 
                                size="xs" 
                              />
                                      <div className="absolute -inset-0.5 bg-gradient-to-r from-brand-500 to-brand-600 rounded-full opacity-0 group-hover:opacity-20 transition-opacity duration-200" />
                                    </div>
                              <div className="min-w-0 flex-1">
                                      <div className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                                        {asset.assignedToStaff.displayName.split(' ').slice(0, 2).join(' ')}
                              </div>
                                      {asset.assignedToStaff.jobTitle && (
                                        <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                          {asset.assignedToStaff.jobTitle.length > 20 ? 
                                            `${asset.assignedToStaff.jobTitle.substring(0, 20)}...` : 
                                            asset.assignedToStaff.jobTitle
                                          }
                            </div>
                                      )}
                                    </div>
                                  </div>
                                </Tooltip.Trigger>
                                <Tooltip.Content side="top" className="px-3 py-2 text-sm bg-slate-900 text-white rounded-lg shadow-lg max-w-xs">
                                  <div className="font-semibold">{asset.assignedToStaff.displayName}</div>
                                  {asset.assignedToStaff.jobTitle && (
                                    <div className="text-slate-300 text-xs mt-1">{asset.assignedToStaff.jobTitle}</div>
                                  )}
                                  {asset.assignedToStaff.department && (
                                    <div className="text-slate-300 text-xs">{asset.assignedToStaff.department}</div>
                                  )}
                                  {asset.assignedToStaff.mail && (
                                    <div className="text-slate-300 text-xs mt-1">{asset.assignedToStaff.mail}</div>
                                  )}
                                </Tooltip.Content>
                              </Tooltip.Root>
                            </Tooltip.Provider>
                          ) : asset.assignedTo ? (
                            <Tooltip.Provider>
                              <Tooltip.Root>
                                <Tooltip.Trigger asChild>
                                  <div 
                                    className="flex items-center gap-2 group cursor-pointer"
                                    style={{ maxWidth: columnWidths['assignedToAadId'] ? `${columnWidths['assignedToAadId'] - 32}px` : '140px' }}
                                    onClick={() => asset.assignedTo && handleUserClick(asset.assignedTo.id)}
                                  >
                                    <div className="relative">
                              <ProfilePicture 
                                displayName={asset.assignedTo.displayName} 
                                size="xs" 
                              />
                                      <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-full opacity-0 group-hover:opacity-20 transition-opacity duration-200" />
                                    </div>
                              <div className="min-w-0 flex-1">
                                      <div className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                                        {asset.assignedTo.displayName.split(' ').slice(0, 2).join(' ')}
                              </div>
                                      <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">IT Tech</div>
                            </div>
                                  </div>
                                </Tooltip.Trigger>
                                <Tooltip.Content side="top" className="px-3 py-2 text-sm bg-slate-900 text-white rounded-lg shadow-lg">
                                  <div className="font-semibold">{asset.assignedTo.displayName}</div>
                                  <div className="text-emerald-300 text-xs mt-1">IT Technician</div>
                                  {asset.assignedTo.email && (
                                    <div className="text-slate-300 text-xs mt-1">{asset.assignedTo.email}</div>
                                  )}
                                </Tooltip.Content>
                              </Tooltip.Root>
                            </Tooltip.Provider>
                          ) : asset.assignedToAadId ? (
                            <Tooltip.Provider>
                              <Tooltip.Root>
                                <Tooltip.Trigger asChild>
                                  <div 
                                    className="flex items-center gap-2 group cursor-pointer"
                                    style={{ maxWidth: columnWidths['assignedToAadId'] ? `${columnWidths['assignedToAadId'] - 32}px` : '140px' }}
                                  >
                                    <div className="w-6 h-6 bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-600 dark:to-slate-700 rounded-full flex items-center justify-center">
                                      <span className="text-xs font-medium text-slate-600 dark:text-slate-300">?</span>
                            </div>
                                    <span className="text-sm text-slate-600 dark:text-slate-400 truncate font-mono">
                                      {asset.assignedToAadId.substring(0, 8)}...
                                    </span>
                                  </div>
                                </Tooltip.Trigger>
                                <Tooltip.Content side="top" className="px-3 py-2 text-sm bg-slate-900 text-white rounded-lg shadow-lg">
                                  <div className="font-semibold">Azure AD User</div>
                                  <div className="text-slate-300 text-xs mt-1 font-mono">{asset.assignedToAadId}</div>
                                </Tooltip.Content>
                              </Tooltip.Root>
                            </Tooltip.Provider>
                          ) : (
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 rounded-full flex items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-600">
                                <span className="text-xs text-slate-400">—</span>
                              </div>
                              <span className="text-slate-500 dark:text-slate-400 text-sm">Unassigned</span>
                            </div>
                          )}
                        </td>
                        <td className={`hidden xl:table-cell px-4 whitespace-nowrap ${viewDensity === 'compact' ? 'py-2' : 'py-3'}`} style={getColumnStyle('locationId')}>
                          {asset.location ? (
                            <div className="flex items-center gap-2">
                              <MapPin className={`text-slate-400 flex-shrink-0 ${viewDensity === 'compact' ? 'w-3 h-3' : 'w-4 h-4'}`} />
                              <span className="text-slate-900 dark:text-slate-100 truncate">
                                {asset.location.city}, {asset.location.province}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-500">—</span>
                          )}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Showing <span className="font-medium text-slate-900 dark:text-slate-100">{((pagination.page - 1) * pagination.limit) + 1}</span> to <span className="font-medium text-slate-900 dark:text-slate-100">{Math.min(pagination.page * pagination.limit, pagination.total)}</span> of <span className="font-medium text-slate-900 dark:text-slate-100">{pagination.total}</span> results
              </p>
              {/* Page size selector */}
              <select
                value={limit}
                onChange={(e) => {
                  const newLimit = parseInt(e.target.value);
                  const newParams = new URLSearchParams(searchParams);
                  newParams.set('limit', String(newLimit));
                  newParams.delete('page'); // Reset to first page
                  setSearchParams(newParams, { replace: true });
                }}
                className="ml-2 px-2 py-1 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {[50, 100, 250, 500].map((size) => (
                  <option key={size} value={size}>{size} / page</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  const newParams = new URLSearchParams(searchParams);
                  newParams.set('page', '1');
                  setSearchParams(newParams, { replace: true });
                }}
                disabled={page <= 1}
                className="px-2 py-1 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                First
              </button>
              <button
                onClick={() => {
                  const newParams = new URLSearchParams(searchParams);
                  newParams.set('page', String(page - 1));
                  setSearchParams(newParams, { replace: true });
                }}
                disabled={page <= 1}
                className="px-2 py-1 text-xs font-medium border border-slate-300 dark:border-slate-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
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
                      onClick={() => {
                        const newParams = new URLSearchParams(searchParams);
                        newParams.set('page', String(pageNum));
                        setSearchParams(newParams, { replace: true });
                      }}
                      className={`px-2 py-1 text-xs font-medium rounded-lg transition-colors ${
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
                onClick={() => {
                  const newParams = new URLSearchParams(searchParams);
                  newParams.set('page', String(page + 1));
                  setSearchParams(newParams, { replace: true });
                }}
                disabled={page >= pagination.totalPages}
                className="px-2 py-1 text-xs font-medium border border-slate-300 dark:border-slate-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                Next
              </button>
              <button
                onClick={() => {
                  const newParams = new URLSearchParams(searchParams);
                  newParams.set('page', String(pagination.totalPages));
                  setSearchParams(newParams, { replace: true });
                }}
                disabled={page >= pagination.totalPages}
                className="px-2 py-1 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
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
        <AssetDetailView
          assetId={selectedAssetId}
          isOpen={!!selectedAssetId}
          onClose={() => setSelectedAssetId(null)}
        />
      )}

      {/* Keyboard Shortcuts Help Modal */}
      {showKeyboardHelp && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-brand-100 dark:bg-brand-900/30 rounded-lg">
                  <Keyboard className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Keyboard Shortcuts
                </h3>
              </div>
              <button
                onClick={() => setShowKeyboardHelp(false)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="grid gap-3">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-700 pb-2">
                      Navigation
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-600 dark:text-slate-400">Select asset</span>
                        <div className="flex gap-1">
                          <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded text-xs font-mono">↑</kbd>
                          <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded text-xs font-mono">↓</kbd>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-600 dark:text-slate-400">View details</span>
                        <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded text-xs font-mono">Enter</kbd>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-600 dark:text-slate-400">Search</span>
                        <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded text-xs font-mono">/</kbd>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-600 dark:text-slate-400">Clear selection</span>
                        <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded text-xs font-mono">Esc</kbd>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-700 pb-2">
                      Actions
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-600 dark:text-slate-400">Copy asset tag</span>
                        <div className="flex gap-1">
                          <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded text-xs font-mono">Ctrl</kbd>
                          <span className="text-slate-400">+</span>
                          <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded text-xs font-mono">C</kbd>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-600 dark:text-slate-400">Edit asset</span>
                        <div className="flex gap-1">
                          <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded text-xs font-mono">Ctrl</kbd>
                          <span className="text-slate-400">+</span>
                          <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded text-xs font-mono">E</kbd>
                        </div>
                      </div>
                      {currentUser?.role === 'ADMIN' && (
                        <div className="flex justify-between items-center">
                          <span className="text-red-600 dark:text-red-400">Delete asset</span>
                          <kbd className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded text-xs font-mono">Del</kbd>
                        </div>
                      )}
                      <div className="flex justify-between items-center">
                        <span className="text-slate-600 dark:text-slate-400">Show shortcuts</span>
                        <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded text-xs font-mono">?</kbd>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  <strong>Tip:</strong> Use arrow keys to navigate between assets, then press actions keys to interact with the selected asset. 
                  All shortcuts work when not typing in input fields.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Dialog */}
      <Dialog.Root open={showBulkDeleteConfirm} onOpenChange={setShowBulkDeleteConfirm}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-6 w-full max-w-md mx-4 z-50">
            <div className="flex items-start gap-4 mb-6">
              <div className="flex-shrink-0 p-3 bg-red-100 dark:bg-red-900/30 rounded-full">
                <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <div className="flex-1">
                <Dialog.Title className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">
                  Delete {selectedAssets.length} Asset{selectedAssets.length > 1 ? 's' : ''}
                </Dialog.Title>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  This action cannot be undone
                </p>
              </div>
            </div>
            
            <div className="mb-6">
              {isDeleting ? (
                <>
                  <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-red-600 dark:bg-red-500 h-3 transition-all duration-300"
                      style={{ width: `${deleteTotal ? (deleteCompleted / deleteTotal) * 100 : 0}%` }}
                    />
                  </div>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 text-center">
                    Deleting {deleteCompleted} / {deleteTotal} asset{deleteTotal > 1 ? 's' : ''}...
                  </p>
                </>
              ) : (
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                  Are you sure you want to permanently delete{' '}
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {selectedAssets.length} asset{selectedAssets.length > 1 ? 's' : ''}
                  </span>
                  ? All associated data will be removed and cannot be recovered.
                </p>
              )}
            </div>
            
            <div className="flex gap-3 justify-end">
              <Dialog.Close asChild>
                <button
                  disabled={isDeleting}
                  className="px-4 py-2.5 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 font-medium"
                >
                  Cancel
                </button>
              </Dialog.Close>
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
                    Delete Asset{selectedAssets.length > 1 ? 's' : ''}
                  </>
                )}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Toast Notifications */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-2 duration-300">
          <div className={`max-w-md rounded-xl border shadow-lg backdrop-blur-sm p-4 flex items-start gap-3 ${
            toast.type === 'success'
              ? 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-700'
              : 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-700'
          }`}>
            <div className={`flex-shrink-0 p-1 rounded-full ${
              toast.type === 'success'
                ? 'bg-green-100 dark:bg-green-900/50'
                : 'bg-red-100 dark:bg-red-900/50'
            }`}>
              {toast.type === 'success' ? (
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
              ) : (
                <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
              )}
            </div>
            <div className="flex-1">
              <p className={`text-sm font-medium ${
                toast.type === 'success'
                  ? 'text-green-800 dark:text-green-200'
                  : 'text-red-800 dark:text-red-200'
              }`}>
                {toast.type === 'success' ? 'Success' : 'Error'}
              </p>
              <p className={`text-sm ${
                toast.type === 'success'
                  ? 'text-green-700 dark:text-green-300'
                  : 'text-red-700 dark:text-red-300'
              }`}>
                {toast.message}
              </p>
            </div>
            <button
              onClick={() => setToast(null)}
              className={`flex-shrink-0 p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors ${
                toast.type === 'success'
                  ? 'text-green-500 dark:text-green-400'
                  : 'text-red-500 dark:text-red-400'
              }`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssetList; 