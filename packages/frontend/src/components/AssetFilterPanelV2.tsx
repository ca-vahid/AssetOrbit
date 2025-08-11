import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import * as Dialog from '@radix-ui/react-dialog';
import * as Tabs from '@radix-ui/react-tabs';
import * as Select from '@radix-ui/react-select';
import * as Separator from '@radix-ui/react-separator';
import { Filter, X, ChevronDown, Search, Calendar, Cpu, HardDrive, Monitor, DollarSign, Building, MapPin, User, Wrench, Tag, FileText } from 'lucide-react';
import { departmentsApi, locationsApi, customFieldsApi, categoriesApi } from '../services/api';

interface EnhancedAssetFilters {
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
  operatingSystem?: string;
  
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
  warrantyStatus?: string; // 'active' | 'expired' | 'expiring_soon'
  
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

interface AssetFilterPanelV2Props {
  filters: EnhancedAssetFilters;
  onFiltersChange: (filters: EnhancedAssetFilters) => void;
  activeFilterCount: number;
}

const ASSET_TYPES = [
  { value: 'LAPTOP', label: 'Laptop' },
  { value: 'DESKTOP', label: 'Desktop' },
  { value: 'TABLET', label: 'Tablet' },
  { value: 'PHONE', label: 'Phone' },
  { value: 'SERVER', label: 'Server' },
  { value: 'OTHER', label: 'Other' },
];

const ASSET_STATUSES = [
  { value: 'AVAILABLE', label: 'Available' },
  { value: 'ASSIGNED', label: 'Assigned' },
  { value: 'SPARE', label: 'Spare' },
  { value: 'MAINTENANCE', label: 'Maintenance' },
  { value: 'RETIRED', label: 'Retired' },
  { value: 'DISPOSED', label: 'Disposed' },
];

const ASSET_CONDITIONS = [
  { value: 'NEW', label: 'New' },
  { value: 'GOOD', label: 'Good' },
  { value: 'FAIR', label: 'Fair' },
  { value: 'POOR', label: 'Poor' },
];

const ASSET_SOURCES = [
  { value: 'MANUAL', label: 'Manual Entry' },
  { value: 'NINJAONE', label: 'NinjaOne' },
  { value: 'INTUNE', label: 'Microsoft Intune' },
  { value: 'EXCEL', label: 'Excel Import' },
  { value: 'INVOICE', label: 'Invoice/PO Import' },
  { value: 'BULK_UPLOAD', label: 'Bulk Upload' },
  { value: 'API', label: 'API Import' },
  { value: 'TELUS', label: 'Telus' },
];

const WARRANTY_STATUSES = [
  { value: 'active', label: 'Active Warranty' },
  { value: 'expired', label: 'Expired Warranty' },
  { value: 'expiring_soon', label: 'Expiring Soon (30 days)' },
];

const COMMON_MAKES = [
  { value: 'Apple', label: 'Apple' },
  { value: 'Dell', label: 'Dell' },
  { value: 'HP', label: 'HP' },
  { value: 'Lenovo', label: 'Lenovo' },
  { value: 'Microsoft', label: 'Microsoft' },
  { value: 'Asus', label: 'Asus' },
  { value: 'Acer', label: 'Acer' },
  { value: 'Samsung', label: 'Samsung' },
  { value: 'Google', label: 'Google' },
];

const COMMON_OS = [
  { value: 'Windows 11', label: 'Windows 11' },
  { value: 'Windows 10', label: 'Windows 10' },
  { value: 'macOS', label: 'macOS' },
  { value: 'iOS', label: 'iOS' },
  { value: 'Android', label: 'Android' },
  { value: 'Linux', label: 'Linux' },
  { value: 'Ubuntu', label: 'Ubuntu' },
];

const AssetFilterPanelV2: React.FC<AssetFilterPanelV2Props> = ({
  filters,
  onFiltersChange,
  activeFilterCount,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [localFilters, setLocalFilters] = useState<EnhancedAssetFilters>(filters);
  const [activeTab, setActiveTab] = useState('basic');

  // Fetch dropdown data
  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => departmentsApi.getAll(),
  });

  const { data: locations } = useQuery({
    queryKey: ['locations'],
    queryFn: () => locationsApi.getLocations(),
  });

  const { data: workloadCategories } = useQuery({
    queryKey: ['workload-categories'],
    queryFn: () => categoriesApi.getAll(),
  });

  const { data: customFields } = useQuery({
    queryKey: ['custom-fields'],
    queryFn: () => customFieldsApi.getAll(),
  });

  // Update local filters when props change
  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  const updateLocalFilter = (key: keyof EnhancedAssetFilters, value: string | string[] | undefined) => {
    setLocalFilters(prev => {
      const newFilters = { ...prev };
      if (value && (Array.isArray(value) ? value.length > 0 : value.trim() !== '')) {
        newFilters[key] = value;
      } else {
        delete newFilters[key];
      }
      return newFilters;
    });
  };

  const applyFilters = () => {
    onFiltersChange(localFilters);
    setIsOpen(false);
  };

  const clearAllFilters = () => {
    const emptyFilters: EnhancedAssetFilters = {};
    setLocalFilters(emptyFilters);
    onFiltersChange(emptyFilters);
    setIsOpen(false);
  };

  const resetToOriginal = () => {
    setLocalFilters(filters);
  };

  const handleMultiSelectChange = (key: keyof EnhancedAssetFilters, value: string, checked: boolean) => {
    const currentValues = Array.isArray(localFilters[key]) ? (localFilters[key] as string[]) : [];
    let newValues: string[];
    
    if (checked) {
      newValues = [...currentValues, value];
    } else {
      newValues = currentValues.filter(v => v !== value);
    }
    
    updateLocalFilter(key, newValues.length > 0 ? newValues : undefined);
  };

  const renderMultiSelect = (
    key: keyof EnhancedAssetFilters,
    options: { value: string; label: string }[],
    placeholder: string
  ) => {
    const selectedValues = Array.isArray(localFilters[key]) ? (localFilters[key] as string[]) : [];
    
    return (
      <div className="space-y-3">
        <div className="border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 shadow-sm max-h-40 overflow-y-auto">
          {options.map((option) => (
            <label key={option.value} className="flex items-center px-4 py-3 hover:bg-brand-50 dark:hover:bg-slate-600 cursor-pointer transition-all duration-150 group">
              <input
                type="checkbox"
                checked={selectedValues.includes(option.value)}
                onChange={(e) => handleMultiSelectChange(key, option.value, e.target.checked)}
                className="mr-3 w-4 h-4 text-brand-600 bg-gray-100 border-gray-300 rounded focus:ring-brand-500 dark:focus:ring-brand-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600 transition-all duration-150"
              />
              <span className="text-sm font-medium text-slate-900 dark:text-slate-100 group-hover:text-brand-700 dark:group-hover:text-brand-300 transition-colors duration-150">{option.label}</span>
            </label>
          ))}
        </div>
        {selectedValues.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedValues.map((value) => {
              const option = options.find(o => o.value === value);
              return (
                <span key={value} className="inline-flex items-center px-3 py-1.5 text-xs font-semibold bg-gradient-to-r from-brand-100 to-brand-200 dark:from-brand-900/30 dark:to-brand-800/30 text-brand-800 dark:text-brand-200 rounded-lg border border-brand-200 dark:border-brand-700 shadow-sm">
                  {option?.label || value}
                  <button
                    onClick={() => handleMultiSelectChange(key, value, false)}
                    className="ml-2 text-brand-600 dark:text-brand-400 hover:text-brand-800 dark:hover:text-brand-200 hover:bg-brand-200 dark:hover:bg-brand-700 rounded-full p-0.5 transition-all duration-150"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderDateInput = (key: keyof EnhancedAssetFilters, label: string) => (
    <div className="space-y-3">
      <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
        <Calendar className="w-4 h-4 text-brand-600 dark:text-brand-400" />
        {label}
      </label>
      <input
        type="date"
        value={localFilters[key] as string || ''}
        onChange={(e) => updateLocalFilter(key, e.target.value || undefined)}
        className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 focus:border-brand-500 dark:focus:border-brand-400 transition-all duration-200"
      />
    </div>
  );

  const renderTextInput = (key: keyof EnhancedAssetFilters, label: string, placeholder?: string) => (
    <div className="space-y-3">
      <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{label}</label>
      <input
        type="text"
        value={localFilters[key] as string || ''}
        onChange={(e) => updateLocalFilter(key, e.target.value || undefined)}
        placeholder={placeholder}
        className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 shadow-sm focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 focus:border-brand-500 dark:focus:border-brand-400 transition-all duration-200"
      />
    </div>
  );

  const renderNumberInput = (key: keyof EnhancedAssetFilters, label: string, placeholder?: string) => (
    <div className="space-y-3">
      <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{label}</label>
      <input
        type="number"
        value={localFilters[key] as string || ''}
        onChange={(e) => updateLocalFilter(key, e.target.value || undefined)}
        placeholder={placeholder}
        min="0"
        className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 shadow-sm focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 focus:border-brand-500 dark:focus:border-brand-400 transition-all duration-200"
      />
    </div>
  );

  return (
    <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
      <Dialog.Trigger asChild>
        <button className="flex items-center gap-3 px-5 py-2.5 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all duration-200 shadow-sm hover:shadow-md hover:border-brand-300 dark:hover:border-brand-600 group">
          <Filter className="w-4 h-4 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors" />
          <span className="font-semibold">Filters</span>
          {activeFilterCount > 0 && (
            <span className="ml-1 px-2.5 py-1 bg-gradient-to-r from-brand-100 to-brand-200 dark:from-brand-900/40 dark:to-brand-800/40 text-brand-700 dark:text-brand-300 text-xs rounded-full font-bold border border-brand-200 dark:border-brand-700 shadow-sm">
              {activeFilterCount}
            </span>
          )}
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 w-full max-w-6xl z-50 h-[90vh] overflow-hidden shadow-2xl flex flex-col">
          
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 shrink-0">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-brand-500 to-brand-600 text-white rounded-xl shadow-lg">
                <Filter className="w-6 h-6" />
              </div>
              <div>
                <Dialog.Title className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  Advanced Asset Filters
                </Dialog.Title>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  Filter assets by specifications, hardware, financial data, and more
                </p>
              </div>
            </div>
            <Dialog.Close asChild>
              <button 
                className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-all duration-200 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                onClick={resetToOriginal}
              >
                <X className="w-6 h-6" />
              </button>
            </Dialog.Close>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden">
            <Tabs.Root value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
              
              {/* Tab Navigation */}
              <Tabs.List className="flex w-full border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800/50 dark:to-slate-900/50 shrink-0">
                <Tabs.Trigger
                  value="basic"
                  className="flex items-center gap-2 px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 data-[state=active]:text-brand-600 dark:data-[state=active]:text-brand-400 data-[state=active]:border-b-2 data-[state=active]:border-brand-600 dark:data-[state=active]:border-brand-400 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 transition-all duration-200 relative"
                >
                  <Tag className="w-4 h-4" />
                  Basic
                </Tabs.Trigger>
                <Tabs.Trigger
                  value="specifications"
                  className="flex items-center gap-2 px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 data-[state=active]:text-brand-600 dark:data-[state=active]:text-brand-400 data-[state=active]:border-b-2 data-[state=active]:border-brand-600 dark:data-[state=active]:border-brand-400 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 transition-all duration-200"
                >
                  <Cpu className="w-4 h-4" />
                  Specifications
                </Tabs.Trigger>
                <Tabs.Trigger
                  value="financial"
                  className="flex items-center gap-2 px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 data-[state=active]:text-brand-600 dark:data-[state=active]:text-brand-400 data-[state=active]:border-b-2 data-[state=active]:border-brand-600 dark:data-[state=active]:border-brand-400 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 transition-all duration-200"
                >
                  <DollarSign className="w-4 h-4" />
                  Financial
                </Tabs.Trigger>
                <Tabs.Trigger
                  value="assignment"
                  className="flex items-center gap-2 px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 data-[state=active]:text-brand-600 dark:data-[state=active]:text-brand-400 data-[state=active]:border-b-2 data-[state=active]:border-brand-600 dark:data-[state=active]:border-brand-400 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 transition-all duration-200"
                >
                  <User className="w-4 h-4" />
                  Assignment
                </Tabs.Trigger>
                <Tabs.Trigger
                  value="custom"
                  className="flex items-center gap-2 px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 data-[state=active]:text-brand-600 dark:data-[state=active]:text-brand-400 data-[state=active]:border-b-2 data-[state=active]:border-brand-600 dark:data-[state=active]:border-brand-400 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 transition-all duration-200"
                >
                  <Wrench className="w-4 h-4" />
                  Custom Fields
                </Tabs.Trigger>
              </Tabs.List>

              {/* Tab Content */}
              <div className="flex-1 overflow-y-auto p-8 bg-gradient-to-br from-slate-50/50 to-white dark:from-slate-900/50 dark:to-slate-800">
                
                {/* Basic Filters Tab */}
                <Tabs.Content value="basic" className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    
                    {/* Asset Type */}
                    <div className="space-y-3">
                      <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                        <Monitor className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                        Asset Type
                      </label>
                      {renderMultiSelect('assetType', ASSET_TYPES, 'Select asset types')}
                    </div>

                    {/* Status */}
                    <div className="space-y-3">
                      <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                        <Tag className="w-4 h-4 text-green-600 dark:text-green-400" />
                        Status
                      </label>
                      {renderMultiSelect('status', ASSET_STATUSES, 'Select statuses')}
                    </div>

                    {/* Condition */}
                    <div className="space-y-3">
                      <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                        <Wrench className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                        Condition
                      </label>
                      {renderMultiSelect('condition', ASSET_CONDITIONS, 'Select conditions')}
                    </div>

                    {/* Make */}
                    <div className="space-y-3">
                      <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                        <Building className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                        Make/Manufacturer
                      </label>
                      {renderMultiSelect('make', COMMON_MAKES, 'Select manufacturers')}
                    </div>

                    {/* Source */}
                    <div className="space-y-3">
                      <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        Source
                      </label>
                      {renderMultiSelect('source', ASSET_SOURCES, 'Select sources')}
                    </div>

                    {/* Asset Tag */}
                    {renderTextInput('assetTag', 'Asset Tag', 'Enter asset tag')}

                    {/* Model */}
                    {renderTextInput('model', 'Model', 'Enter model name')}

                    {/* Serial Number */}
                    {renderTextInput('serialNumber', 'Serial Number', 'Enter serial number')}

                    {/* Date Range */}
                    {renderDateInput('dateFrom', 'Created From')}
                    {renderDateInput('dateTo', 'Created To')}
                  </div>
                </Tabs.Content>

                {/* Specifications Tab */}
                <Tabs.Content value="specifications" className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    
                    {/* Processor */}
                    <div className="space-y-3">
                      <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                        <Cpu className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                        Processor
                      </label>
                      <input
                        type="text"
                        value={localFilters.processor as string || ''}
                        onChange={(e) => updateLocalFilter('processor', e.target.value || undefined)}
                        placeholder="e.g., Intel i7, AMD Ryzen"
                        className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 shadow-sm focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 focus:border-brand-500 dark:focus:border-brand-400 transition-all duration-200"
                      />
                    </div>

                    {/* RAM */}
                    <div className="space-y-4">
                      <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                        <HardDrive className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        Memory (RAM)
                      </label>
                      <input
                        type="text"
                        value={localFilters.ram as string || ''}
                        onChange={(e) => updateLocalFilter('ram', e.target.value || undefined)}
                        placeholder="e.g., 16GB DDR4"
                        className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 shadow-sm focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 focus:border-brand-500 dark:focus:border-brand-400 transition-all duration-200"
                      />
                      <div className="grid grid-cols-2 gap-3">
                        {renderNumberInput('ramMin', 'Min RAM (GB)', '8')}
                        {renderNumberInput('ramMax', 'Max RAM (GB)', '64')}
                      </div>
                    </div>

                    {/* Storage */}
                    <div className="space-y-4">
                      <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                        <Monitor className="w-4 h-4 text-green-600 dark:text-green-400" />
                        Storage
                      </label>
                      <input
                        type="text"
                        value={localFilters.storage as string || ''}
                        onChange={(e) => updateLocalFilter('storage', e.target.value || undefined)}
                        placeholder="e.g., 512GB SSD"
                        className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 shadow-sm focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 focus:border-brand-500 dark:focus:border-brand-400 transition-all duration-200"
                      />
                      <div className="grid grid-cols-2 gap-3">
                        {renderNumberInput('storageMin', 'Min Storage (GB)', '256')}
                        {renderNumberInput('storageMax', 'Max Storage (GB)', '2048')}
                      </div>
                    </div>

                    {/* Operating System */}
                    <div className="space-y-3">
                      <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                        <Monitor className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                        Operating System
                      </label>
                      {renderMultiSelect('operatingSystem', COMMON_OS, 'Select operating systems')}
                    </div>
                  </div>
                </Tabs.Content>

                {/* Financial Tab */}
                <Tabs.Content value="financial" className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    
                    {/* Purchase Price Range */}
                    <div className="space-y-4">
                      <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-green-600 dark:text-green-400" />
                        Purchase Price Range
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        {renderNumberInput('purchasePriceMin', 'Min Price ($)', '0')}
                        {renderNumberInput('purchasePriceMax', 'Max Price ($)', '5000')}
                      </div>
                    </div>

                    {/* Purchase Date Range */}
                    <div className="space-y-4">
                      <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        Purchase Date Range
                      </label>
                      <div className="space-y-3">
                        {renderDateInput('purchaseDateFrom', 'Purchase From')}
                        {renderDateInput('purchaseDateTo', 'Purchase To')}
                      </div>
                    </div>

                    {/* Warranty Status */}
                    <div className="space-y-3">
                      <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                        <Wrench className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        Warranty Status
                      </label>
                      {renderMultiSelect('warrantyStatus', WARRANTY_STATUSES, 'Select warranty status')}
                    </div>

                    {/* Warranty Start Date Range */}
                    <div className="space-y-4">
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Warranty Start Range</label>
                      {renderDateInput('warrantyStartFrom', 'Warranty Start From')}
                      {renderDateInput('warrantyStartTo', 'Warranty Start To')}
                    </div>

                    {/* Warranty End Date Range */}
                    <div className="space-y-4">
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Warranty End Range</label>
                      {renderDateInput('warrantyEndFrom', 'Warranty End From')}
                      {renderDateInput('warrantyEndTo', 'Warranty End To')}
                    </div>
                  </div>
                </Tabs.Content>

                {/* Assignment Tab */}
                <Tabs.Content value="assignment" className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    
                    {/* Assigned To */}
                    <div className="space-y-3">
                      <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                        <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        Assigned To
                      </label>
                      <input
                        type="text"
                        value={localFilters.assignedTo as string || ''}
                        onChange={(e) => updateLocalFilter('assignedTo', e.target.value || undefined)}
                        placeholder="Enter username or ID"
                        className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 shadow-sm focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 focus:border-brand-500 dark:focus:border-brand-400 transition-all duration-200"
                      />
                    </div>

                    {/* Department */}
                    <div className="space-y-3">
                      <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                        <Building className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        Department
                      </label>
                      {departments && renderMultiSelect(
                        'departmentId',
                        departments.map(d => ({ value: d.id, label: d.name })),
                        'Select departments'
                      )}
                    </div>

                    {/* Location */}
                    <div className="space-y-3">
                      <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-pink-600 dark:text-pink-400" />
                        Location
                      </label>
                      {locations && renderMultiSelect(
                        'locationId',
                        locations.map(l => ({ value: l.id, label: l.name })),
                        'Select locations'
                      )}
                    </div>

                    {/* Workload Category */}
                    <div className="space-y-3">
                      <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                        <Tag className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                        Workload Category
                      </label>
                      {workloadCategories && renderMultiSelect(
                        'workloadCategoryId',
                        workloadCategories.map(c => ({ value: c.id, label: c.name })),
                        'Select categories'
                      )}
                    </div>
                  </div>
                </Tabs.Content>

                {/* Custom Fields Tab */}
                <Tabs.Content value="custom" className="space-y-8">
                  {customFields && customFields.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                      {customFields.map((field) => {
                        const key = `cf_${field.id}`;
                        const value = localFilters[key] as string || '';
                        
                        return (
                          <div key={field.id} className="space-y-3">
                            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                              <FileText className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                              {field.name}
                            </label>
                            {field.fieldType === 'BOOLEAN' ? (
                              <Select.Root
                                value={value || '__any'}
                                onValueChange={(v) => {
                                  if (v === '__any') updateLocalFilter(key, undefined);
                                  else updateLocalFilter(key, v);
                                }}
                              >
                                <Select.Trigger className="w-full flex items-center justify-between px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm">
                                  <Select.Value placeholder="Any" />
                                  <Select.Icon>
                                    <ChevronDown className="w-4 h-4" />
                                  </Select.Icon>
                                </Select.Trigger>
                                <Select.Portal>
                                  <Select.Content className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg z-50">
                                    <Select.Viewport className="p-2">
                                      <Select.Item value="__any" className="px-4 py-3 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer rounded-lg transition-colors">
                                        <Select.ItemText>Any</Select.ItemText>
                                      </Select.Item>
                                      <Select.Item value="true" className="px-4 py-3 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer rounded-lg transition-colors">
                                        <Select.ItemText>Yes</Select.ItemText>
                                      </Select.Item>
                                      <Select.Item value="false" className="px-4 py-3 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer rounded-lg transition-colors">
                                        <Select.ItemText>No</Select.ItemText>
                                      </Select.Item>
                                    </Select.Viewport>
                                  </Select.Content>
                                </Select.Portal>
                              </Select.Root>
                            ) : (
                              <input
                                type="text"
                                value={value}
                                onChange={(e) => updateLocalFilter(key, e.target.value || undefined)}
                                placeholder={`Enter ${field.name.toLowerCase()}`}
                                className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 shadow-sm focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 focus:border-brand-500 dark:focus:border-brand-400 transition-all duration-200"
                              />
                            )}
                            {value && (
                              <button
                                onClick={() => updateLocalFilter(key, undefined)}
                                className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-medium transition-colors"
                              >
                                Clear {field.name} filter
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-16">
                      <div className="p-4 bg-slate-100 dark:bg-slate-700 rounded-full w-24 h-24 mx-auto mb-6 flex items-center justify-center">
                        <FileText className="w-12 h-12 text-slate-400 dark:text-slate-500" />
                      </div>
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">No custom fields available</h3>
                      <p className="text-slate-600 dark:text-slate-400 max-w-sm mx-auto">
                        Create custom fields in the admin settings to filter by them here.
                      </p>
                    </div>
                  )}
                </Tabs.Content>
              </div>
            </Tabs.Root>
          </div>

          {/* Footer */}
          <div className="flex justify-between items-center p-6 border-t border-slate-200 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 shrink-0">
            <button
              onClick={clearAllFilters}
              className="px-6 py-3 text-slate-600 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-all duration-200 font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl"
            >
              Clear All Filters
            </button>
            <div className="flex items-center gap-4">
              <Dialog.Close asChild>
                <button 
                  className="px-6 py-3 text-slate-600 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-all duration-200 font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl"
                  onClick={resetToOriginal}
                >
                  Cancel
                </button>
              </Dialog.Close>
              <button
                onClick={applyFilters}
                className="px-8 py-3 bg-gradient-to-r from-brand-600 to-brand-700 text-white rounded-xl hover:from-brand-700 hover:to-brand-800 transition-all duration-200 font-semibold shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default AssetFilterPanelV2;