import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import * as Dialog from '@radix-ui/react-dialog';
import * as Select from '@radix-ui/react-select';
import { Filter, X, ChevronDown, Search } from 'lucide-react';
import { departmentsApi, locationsApi, customFieldsApi, categoriesApi } from '../services/api';

interface AssetFilters {
  assignedTo?: string;
  status?: string;
  condition?: string;
  assetType?: string;
  departmentId?: string;
  locationId?: string;
  workloadCategoryId?: string;
  dateFrom?: string;
  dateTo?: string;
  [key: string]: string | undefined; // dynamic custom-field keys: cf_<id>
}

interface AssetFilterPanelProps {
  filters: AssetFilters;
  onFiltersChange: (filters: AssetFilters) => void;
  activeFilterCount: number;
}

const ASSET_STATUSES = [
  { value: 'AVAILABLE', label: 'Available' },
  { value: 'ASSIGNED', label: 'Assigned' },
  { value: 'SPARE', label: 'Spare' },
  { value: 'RETIRED', label: 'Retired' },
  { value: 'MAINTENANCE', label: 'Maintenance' },
];

const ASSET_CONDITIONS = [
  { value: 'NEW', label: 'New' },
  { value: 'GOOD', label: 'Good' },
  { value: 'FAIR', label: 'Fair' },
  { value: 'POOR', label: 'Poor' },
];

const ASSET_TYPES = [
  { value: 'LAPTOP', label: 'Laptop' },
  { value: 'DESKTOP', label: 'Desktop' },
  { value: 'TABLET', label: 'Tablet' },
  { value: 'PHONE', label: 'Phone' },
  { value: 'MONITOR', label: 'Monitor' },
  { value: 'PRINTER', label: 'Printer' },
  { value: 'OTHER', label: 'Other' },
];

const AssetFilterPanel: React.FC<AssetFilterPanelProps> = ({
  filters,
  onFiltersChange,
  activeFilterCount,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [localFilters, setLocalFilters] = useState<AssetFilters>(filters);

  // Fetch departments, locations, and workload categories for dropdowns
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

  // Fetch active custom fields
  const { data: customFields } = useQuery({
    queryKey: ['custom-fields'],
    queryFn: () => customFieldsApi.getAll(),
  });

  // Update local filters when props change
  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  const updateLocalFilter = (key: keyof AssetFilters, value: string | undefined) => {
    setLocalFilters(prev => {
      const newFilters = { ...prev };
      if (value) {
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
    const emptyFilters: AssetFilters = {};
    setLocalFilters(emptyFilters);
    onFiltersChange(emptyFilters);
    setIsOpen(false);
  };

  const resetToOriginal = () => {
    setLocalFilters(filters);
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
      <Dialog.Trigger asChild>
        <button className="flex items-center gap-2 px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
          <Filter className="w-4 h-4" />
          Filters
          {activeFilterCount > 0 && (
            <span className="ml-1 px-2 py-0.5 bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 text-xs rounded-full">
              {activeFilterCount}
            </span>
          )}
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 w-full max-w-2xl z-50 max-h-[80vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <Dialog.Title className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              Filter Assets
            </Dialog.Title>
            <Dialog.Close asChild>
              <button 
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                onClick={resetToOriginal}
              >
                <X className="w-4 h-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Status Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Status
                </label>
                <Select.Root 
                  value={localFilters.status || ''} 
                  onValueChange={(value) => updateLocalFilter('status', value || undefined)}
                >
                  <Select.Trigger className="w-full flex items-center justify-between px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100">
                    <Select.Value placeholder="Any status" />
                    <Select.Icon>
                      <ChevronDown className="w-4 h-4" />
                    </Select.Icon>
                  </Select.Trigger>
                  <Select.Portal>
                    <Select.Content className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-50">
                      <Select.Viewport className="p-1">
                        {ASSET_STATUSES.map((status) => (
                          <Select.Item key={status.value} value={status.value} className="px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer rounded-md">
                            <Select.ItemText>{status.label}</Select.ItemText>
                          </Select.Item>
                        ))}
                      </Select.Viewport>
                    </Select.Content>
                  </Select.Portal>
                </Select.Root>
                {localFilters.status && (
                  <button
                    onClick={() => updateLocalFilter('status', undefined)}
                    className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  >
                    Clear status filter
                  </button>
                )}
              </div>

              {/* Condition Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Condition
                </label>
                <Select.Root 
                  value={localFilters.condition || ''} 
                  onValueChange={(value) => updateLocalFilter('condition', value || undefined)}
                >
                  <Select.Trigger className="w-full flex items-center justify-between px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100">
                    <Select.Value placeholder="Any condition" />
                    <Select.Icon>
                      <ChevronDown className="w-4 h-4" />
                    </Select.Icon>
                  </Select.Trigger>
                  <Select.Portal>
                    <Select.Content className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-50">
                      <Select.Viewport className="p-1">
                        {ASSET_CONDITIONS.map((condition) => (
                          <Select.Item key={condition.value} value={condition.value} className="px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer rounded-md">
                            <Select.ItemText>{condition.label}</Select.ItemText>
                          </Select.Item>
                        ))}
                      </Select.Viewport>
                    </Select.Content>
                  </Select.Portal>
                </Select.Root>
                {localFilters.condition && (
                  <button
                    onClick={() => updateLocalFilter('condition', undefined)}
                    className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  >
                    Clear condition filter
                  </button>
                )}
              </div>

              {/* Asset Type Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Asset Type
                </label>
                <Select.Root 
                  value={localFilters.assetType || ''} 
                  onValueChange={(value) => updateLocalFilter('assetType', value || undefined)}
                >
                  <Select.Trigger className="w-full flex items-center justify-between px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100">
                    <Select.Value placeholder="Any type" />
                    <Select.Icon>
                      <ChevronDown className="w-4 h-4" />
                    </Select.Icon>
                  </Select.Trigger>
                  <Select.Portal>
                    <Select.Content className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-50">
                      <Select.Viewport className="p-1">
                        {ASSET_TYPES.map((type) => (
                          <Select.Item key={type.value} value={type.value} className="px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer rounded-md">
                            <Select.ItemText>{type.label}</Select.ItemText>
                          </Select.Item>
                        ))}
                      </Select.Viewport>
                    </Select.Content>
                  </Select.Portal>
                </Select.Root>
                {localFilters.assetType && (
                  <button
                    onClick={() => updateLocalFilter('assetType', undefined)}
                    className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  >
                    Clear type filter
                  </button>
                )}
              </div>

              {/* Department Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Department
                </label>
                <Select.Root 
                  value={localFilters.departmentId || ''} 
                  onValueChange={(value) => updateLocalFilter('departmentId', value || undefined)}
                >
                  <Select.Trigger className="w-full flex items-center justify-between px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100">
                    <Select.Value placeholder="Any department" />
                    <Select.Icon>
                      <ChevronDown className="w-4 h-4" />
                    </Select.Icon>
                  </Select.Trigger>
                  <Select.Portal>
                    <Select.Content className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-50">
                      <Select.Viewport className="p-1">
                        {departments?.map((dept) => (
                          <Select.Item key={dept.id} value={dept.id} className="px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer rounded-md">
                            <Select.ItemText>{dept.name}</Select.ItemText>
                          </Select.Item>
                        ))}
                      </Select.Viewport>
                    </Select.Content>
                  </Select.Portal>
                </Select.Root>
                {localFilters.departmentId && (
                  <button
                    onClick={() => updateLocalFilter('departmentId', undefined)}
                    className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  >
                    Clear department filter
                  </button>
                )}
              </div>

              {/* Location Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Location
                </label>
                <Select.Root 
                  value={localFilters.locationId || ''} 
                  onValueChange={(value) => updateLocalFilter('locationId', value || undefined)}
                >
                  <Select.Trigger className="w-full flex items-center justify-between px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100">
                    <Select.Value placeholder="Any location" />
                    <Select.Icon>
                      <ChevronDown className="w-4 h-4" />
                    </Select.Icon>
                  </Select.Trigger>
                  <Select.Portal>
                    <Select.Content className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-50">
                      <Select.Viewport className="p-1">
                        {locations?.map((location) => (
                          <Select.Item key={location.id} value={location.id} className="px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer rounded-md">
                            <Select.ItemText>{location.city}, {location.province}</Select.ItemText>
                          </Select.Item>
                        ))}
                      </Select.Viewport>
                    </Select.Content>
                  </Select.Portal>
                </Select.Root>
                {localFilters.locationId && (
                  <button
                    onClick={() => updateLocalFilter('locationId', undefined)}
                    className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  >
                    Clear location filter
                  </button>
                )}
              </div>

              {/* Workload Category Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Workload Category
                </label>
                <Select.Root 
                  value={localFilters.workloadCategoryId || ''} 
                  onValueChange={(value) => updateLocalFilter('workloadCategoryId', value || undefined)}
                >
                  <Select.Trigger className="w-full flex items-center justify-between px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100">
                    <Select.Value placeholder="Any category" />
                    <Select.Icon>
                      <ChevronDown className="w-4 h-4" />
                    </Select.Icon>
                  </Select.Trigger>
                  <Select.Portal>
                    <Select.Content className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-50">
                      <Select.Viewport className="p-1">
                        {workloadCategories?.filter(cat => cat.isActive).map((category) => (
                          <Select.Item key={category.id} value={category.id} className="px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer rounded-md">
                            <Select.ItemText>{category.name}</Select.ItemText>
                          </Select.Item>
                        ))}
                      </Select.Viewport>
                    </Select.Content>
                  </Select.Portal>
                </Select.Root>
                {localFilters.workloadCategoryId && (
                  <button
                    onClick={() => updateLocalFilter('workloadCategoryId', undefined)}
                    className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  >
                    Clear category filter
                  </button>
                )}
              </div>

              {/* Date Range Filters */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Created From
                </label>
                <input
                  type="date"
                  value={localFilters.dateFrom || ''}
                  onChange={(e) => updateLocalFilter('dateFrom', e.target.value || undefined)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Created To
                </label>
                <input
                  type="date"
                  value={localFilters.dateTo || ''}
                  onChange={(e) => updateLocalFilter('dateTo', e.target.value || undefined)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                />
              </div>

              {/* Dynamic Custom Field Filters */}
              {customFields?.filter((f) => f.isActive).map((field) => {
                const key = `cf_${field.id}`;
                const value = localFilters[key] || '';
                return (
                  <div key={field.id} className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
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
                        <Select.Trigger className="w-full flex items-center justify-between px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100">
                          <Select.Value placeholder="Any" />
                          <Select.Icon>
                            <ChevronDown className="w-4 h-4" />
                          </Select.Icon>
                        </Select.Trigger>
                        <Select.Portal>
                          <Select.Content className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-50">
                            <Select.Viewport className="p-1">
                              <Select.Item value="__any" className="px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer rounded-md">
                                <Select.ItemText>Any</Select.ItemText>
                              </Select.Item>
                              <Select.Item value="true" className="px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer rounded-md">
                                <Select.ItemText>Yes</Select.ItemText>
                              </Select.Item>
                              <Select.Item value="false" className="px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer rounded-md">
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
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                      />
                    )}
                    {value && (
                      <button
                        onClick={() => updateLocalFilter(key, undefined)}
                        className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                      >
                        Clear {field.name} filter
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Action Buttons */}
            <div className="flex justify-between pt-6 border-t border-slate-200 dark:border-slate-700">
              <button
                onClick={clearAllFilters}
                className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
              >
                Clear All
              </button>
              <div className="flex gap-3">
                <Dialog.Close asChild>
                  <button 
                    className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                    onClick={resetToOriginal}
                  >
                    Cancel
                  </button>
                </Dialog.Close>
                <button
                  onClick={applyFilters}
                  className="px-6 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default AssetFilterPanel; 